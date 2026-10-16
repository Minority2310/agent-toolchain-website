// 从飞书多维表格导出 3 张表，生成 src/data/toolchain.json。
// 用法：node scripts/sync.ts（或 vp run sync）
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ItemType, Toolchain } from "../src/types.ts";
import {
  type Attachment,
  type FieldDef,
  type RawRecord,
  attachmentPath,
  normalizeTable,
} from "./normalize.ts";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "src/data/toolchain.json");
/** 附件下载到这里，随站点一起发布；Cloudflare 单个静态文件上限 25 MiB，这里留出余量 */
const filesDir = join(root, "public/files");
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const TYPES: readonly ItemType[] = ["guide", "skill", "mcp"];
const TYPE_LABELS: Record<ItemType, string> = {
  guide: "AGENTS.md",
  skill: "Skills",
  mcp: "MCP 服务",
};

interface Config {
  baseToken: string;
  tables: Record<ItemType, string>;
}

interface Manifest {
  records_count: number;
  has_more: boolean;
  record_file: string;
}

async function lark<T>(args: string[], cwd?: string): Promise<T> {
  const { stdout } = await run("lark-cli", ["base", ...args, "--as", "user"], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  }).catch((error: { stdout?: string; stderr?: string; message: string }) => {
    throw new Error(
      `lark-cli base ${args[0]} 失败：${error.stderr || error.stdout || error.message}`,
    );
  });
  const result = JSON.parse(stdout) as { ok?: boolean; error?: unknown };
  if (result.ok === false)
    throw new Error(`lark-cli base ${args[0]} 失败：${JSON.stringify(result.error)}`);
  return result as T;
}

async function listFields(config: Config, tableId: string): Promise<FieldDef[]> {
  const fields: FieldDef[] = [];
  for (;;) {
    const page = await lark<{ data: { fields: FieldDef[]; total: number } }>([
      "+field-list",
      "--base-token",
      config.baseToken,
      "--table-id",
      tableId,
      "--limit",
      "200",
      "--offset",
      String(fields.length),
    ]);
    fields.push(...page.data.fields);
    if (page.data.fields.length === 0 || fields.length >= page.data.total) return fields;
  }
}

async function listRecords(config: Config, type: ItemType, dir: string): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  for (let page = 0; ; page++) {
    const manifest = await lark<Manifest>(
      [
        "+record-list",
        "--base-token",
        config.baseToken,
        "--table-id",
        config.tables[type],
        "--format",
        "ndjson",
        "--output",
        `${type}-${page}.ndjson`,
        "--overwrite",
        "--offset",
        String(records.length),
      ],
      dir,
    );
    const lines = (await readFile(manifest.record_file, "utf8"))
      .split("\n")
      .filter((line) => line.trim());
    records.push(...lines.map((line) => JSON.parse(line) as RawRecord));
    if (!manifest.has_more) return records;
    if (manifest.records_count === 0)
      throw new Error(`${type} 表分页异常：has_more 为 true 但本页没有记录`);
  }
}

/** 表的第一个视图里的字段顺序：field-list 每次返回的顺序都不同，视图里的顺序是稳定的 */
async function viewOrder(config: Config, tableId: string): Promise<string[]> {
  const views = await lark<{ data: { views: { id: string }[] } }>([
    "+view-list",
    "--base-token",
    config.baseToken,
    "--table-id",
    tableId,
  ]);
  const first = views.data.views[0];
  if (!first) throw new Error(`表 ${tableId} 没有视图`);
  const visible = await lark<{ data: { visible_fields: string[] } }>([
    "+view-get-visible-fields",
    "--base-token",
    config.baseToken,
    "--table-id",
    tableId,
    "--view-id",
    first.id,
  ]);
  return visible.data.visible_fields;
}

interface Download {
  tableId: string;
  recordId: string;
  file: Attachment;
}

/** 把所有附件下载到 stage/files/<file_token>/<文件名>，任何一个失败都抛错，不动现有文件 */
async function downloadAttachments(config: Config, downloads: Download[], stage: string) {
  const seen = new Set<string>();
  for (const { tableId, recordId, file } of downloads) {
    if (seen.has(file.file_token)) continue;
    seen.add(file.file_token);
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `附件「${file.name}」（记录 ${recordId}）有 ${(file.size / 1024 / 1024).toFixed(1)} MB，超过 10 MB 的上限`,
      );
    }
    const target = attachmentPath(file);
    await mkdir(dirname(join(stage, target)), { recursive: true });
    await lark(
      [
        "+record-download-attachment",
        "--base-token",
        config.baseToken,
        "--table-id",
        tableId,
        "--record-id",
        recordId,
        "--file-token",
        file.file_token,
        "--output",
        target,
        "--overwrite",
      ],
      stage,
    );
  }
  return seen.size;
}

async function main() {
  const config = JSON.parse(await readFile(join(root, "toolchain.config.json"), "utf8")) as Config;
  const dir = await mkdtemp(join(tmpdir(), "toolchain-sync-"));
  try {
    const loaded = await Promise.all(
      TYPES.map(async (type) => {
        const tableId = config.tables[type];
        const [fields, viewFields, records] = await Promise.all([
          listFields(config, tableId),
          viewOrder(config, tableId),
          listRecords(config, type, dir),
        ]);
        return { type, tableId, fields, viewFields, records };
      }),
    );

    const tables = loaded.map(({ type, fields, viewFields, records }) =>
      normalizeTable({ type, label: TYPE_LABELS[type], fields, viewOrder: viewFields, records }),
    );

    // 附件字段：先全部下载到临时目录，成功之后再替换站点里的 files/ 目录
    const downloads: Download[] = loaded.flatMap(({ tableId, fields, records }) =>
      fields
        .filter((field) => field.type === "attachment")
        .flatMap((field) =>
          records.flatMap((record) =>
            ((record[field.name] as Attachment[] | null | undefined) ?? []).map((file) => ({
              tableId,
              recordId: record.record_id,
              file,
            })),
          ),
        ),
    );
    const stage = join(dir, "stage");
    await mkdir(join(stage, "files"), { recursive: true });
    const fileCount = await downloadAttachments(config, downloads, stage);

    const data: Toolchain = {
      generatedAt: new Date().toISOString(),
      collections: tables.map((table) => table.collection),
    };

    const pid = process.pid;
    await rm(`${filesDir}.${pid}.tmp`, { recursive: true, force: true });
    await cp(join(stage, "files"), `${filesDir}.${pid}.tmp`, { recursive: true });
    await rm(filesDir, { recursive: true, force: true });
    await rename(`${filesDir}.${pid}.tmp`, filesDir);

    const tmpFile = `${outFile}.${pid}.tmp`;
    await writeFile(tmpFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmpFile, outFile);

    for (const { warnings } of tables)
      for (const warning of warnings) console.warn(`警告：${warning}`);
    const total = data.collections.reduce((sum, c) => sum + c.items.length, 0);
    const counts = data.collections.map((c) => `${c.label} ${c.items.length}`).join("，");
    console.log(`已同步 ${total} 条（${counts}）、${fileCount} 个附件 → ${outFile}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
