// 从飞书多维表格导出 3 张表，生成 src/data/toolchain.json。
// 用法：vp node scripts/sync.ts
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { FacetKey, FacetOption, Item, ItemType, Toolchain } from "../src/types.ts";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "src/data/toolchain.json");

const TYPES: readonly ItemType[] = ["guide", "skill", "mcp"];
const TYPE_LABELS: Record<ItemType, string> = {
  guide: "智能体指南(AGENTS.md)",
  skill: "技能(Agent Skills)",
  mcp: "MCP 服务",
};
const COMMON = {
  name: "名称",
  description: "描述",
  scope: "范围",
  domains: "领域",
  scenarios: "场景",
  link: "链接",
};
// field-list 返回的字段顺序不稳定，专有字段按固定顺序输出；表里新增的字段按名称追加在后面
const DETAIL_ORDER: Record<ItemType, string[]> = {
  guide: ["文件路径", "内容摘要"],
  skill: ["来源仓库", "安装路径", "触发条件"],
  mcp: ["传输方式", "启动命令或 URL", "提供的工具", "认证方式", "配置示例"],
};

interface Config {
  baseToken: string;
  tables: Record<ItemType, string>;
}

interface Field {
  id: string;
  name: string;
  type: string;
  multiple?: boolean;
  options?: { name: string }[];
  style?: { type?: string };
}

interface Manifest {
  records_count: number;
  has_more: boolean;
  record_file: string;
}

type Cell = string | string[] | null | undefined;
type RawRecord = { record_id: string } & Record<string, Cell>;

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

async function listFields(config: Config, tableId: string): Promise<Field[]> {
  const fields: Field[] = [];
  for (;;) {
    const page = await lark<{ data: { fields: Field[]; total: number } }>([
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

/** url 字段导出为 Markdown 链接 `[text](url)`，取出其中的 URL */
function parseLink(value: string): string {
  return /^\[[^\]]*\]\((.+)\)$/.exec(value)?.[1] ?? value;
}

function normalize(type: ItemType, fields: Field[], raw: RawRecord): Item {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const where = `${TYPE_LABELS[type]} / ${raw.record_id}`;

  const cell = (name: string): string | string[] => {
    const field = byName.get(name);
    if (!field) throw new Error(`${TYPE_LABELS[type]} 缺少字段「${name}」`);
    const value = raw[name];
    if (field.type === "select") {
      const values = Array.isArray(value) ? value : value ? [value] : [];
      const allowed = new Set((field.options ?? []).map((option) => option.name));
      for (const v of values) {
        if (!allowed.has(v)) throw new Error(`${where}：「${name}」的值「${v}」不在选项中`);
      }
      return field.multiple ? values : (values[0] ?? "");
    }
    const text = Array.isArray(value) ? value.join("\n") : (value ?? "");
    return field.style?.type === "url" ? parseLink(text.trim()) : text;
  };
  const text = (name: string) => String(cell(name));
  const list = (name: string) => {
    const value = cell(name);
    return Array.isArray(value) ? value : value ? [value] : [];
  };

  const name = text(COMMON.name).trim();
  if (!name) throw new Error(`${where}：名称为空`);

  const common = new Set(Object.values(COMMON));
  const order = DETAIL_ORDER[type];
  const detailNames = fields
    .map((field) => field.name)
    .filter((fieldName) => !common.has(fieldName))
    .sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
      return a < b ? -1 : a > b ? 1 : 0;
    });

  return {
    id: raw.record_id,
    type,
    name,
    description: text(COMMON.description).trim(),
    scope: text(COMMON.scope),
    domains: list(COMMON.domains),
    scenarios: list(COMMON.scenarios),
    link: text(COMMON.link),
    detail: Object.fromEntries(detailNames.map((fieldName) => [fieldName, cell(fieldName)])),
  };
}

/** 合并三张表同名 select 字段的选项，保持飞书里的顺序 */
function selectOptions(tables: Field[][], fieldName: string): FacetOption[] {
  const names: string[] = [];
  for (const fields of tables) {
    for (const option of fields.find((field) => field.name === fieldName)?.options ?? []) {
      if (option.name.includes(","))
        throw new Error(`「${fieldName}」的选项「${option.name}」不能包含逗号`);
      if (!names.includes(option.name)) names.push(option.name);
    }
  }
  return names.map((value) => ({ value, label: value }));
}

async function main() {
  const config = JSON.parse(await readFile(join(root, "toolchain.config.json"), "utf8")) as Config;
  const dir = await mkdtemp(join(tmpdir(), "toolchain-sync-"));
  try {
    const fieldsByType = await Promise.all(
      TYPES.map((type) => listFields(config, config.tables[type])),
    );
    const recordsByType = await Promise.all(TYPES.map((type) => listRecords(config, type, dir)));

    const collator = new Intl.Collator("zh-Hans-CN", { numeric: true });
    const items = TYPES.flatMap((type, i) =>
      recordsByType[i].map((raw) => normalize(type, fieldsByType[i], raw)),
    ).sort(
      (a, b) =>
        TYPES.indexOf(a.type) - TYPES.indexOf(b.type) ||
        collator.compare(a.name, b.name) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

    const facets: Record<FacetKey, FacetOption[]> = {
      type: TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] })),
      scope: selectOptions(fieldsByType, COMMON.scope),
      domain: selectOptions(fieldsByType, COMMON.domains),
      scenario: selectOptions(fieldsByType, COMMON.scenarios),
    };
    const data: Toolchain = { generatedAt: new Date().toISOString(), facets, items };

    const tmpFile = `${outFile}.${process.pid}.tmp`;
    await writeFile(tmpFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmpFile, outFile);

    const counts = TYPES.map((type, i) => `${TYPE_LABELS[type]} ${recordsByType[i].length}`).join(
      "，",
    );
    console.log(`已同步 ${items.length} 条（${counts}）→ ${outFile}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
