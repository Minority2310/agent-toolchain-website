// 把一张飞书表的字段定义和记录规整成页面使用的 Collection。纯函数，不读写文件。
import type { Collection, Facet, Field, FileRef, Item, ItemType } from "../src/types.ts";

export interface FieldDef {
  id: string;
  name: string;
  type: string;
  multiple?: boolean;
  options?: { name: string }[];
  style?: { type?: string };
}

export interface Attachment {
  file_token: string;
  name: string;
  size: number;
}

export type Cell = string | string[] | Attachment[] | null | undefined;
export type RawRecord = { record_id: string } & Record<string, Cell>;

export interface TableInput {
  type: ItemType;
  label: string;
  fields: FieldDef[];
  /** 表的第一个视图里的字段顺序；排在第一位的是主字段 */
  viewOrder: string[];
  records: RawRecord[];
}

/** 这些名字是 URL 参数，不能当筛选字段名 */
const RESERVED = new Set(["type", "q", "view", "item"]);
const DESCRIPTION = "描述";

const collator = new Intl.Collator("zh-Hans-CN", { numeric: true });

/** 字段在视图里的顺序在前；视图里没有的字段按字段 ID 排在后面，保证输出稳定 */
function orderFields(fields: FieldDef[], viewOrder: string[]): FieldDef[] {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const inView = viewOrder.flatMap((name) => byName.get(name) ?? []);
  const seen = new Set(inView);
  const rest = fields
    .filter((field) => !seen.has(field))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [...inView, ...rest];
}

/**
 * 飞书把超链接导出成 `[文字](url)`：
 * - 整段文本就是一个链接时取出 url；
 * - 文本中间出现「文字和网址相同」的链接（粘贴网址时产生），还原成网址；
 * - 其他写法原样保留。
 */
function parseLink(value: string): string {
  const whole = /^\[[^\]]*\]\((.+)\)$/.exec(value)?.[1];
  return whole ?? value.replace(/\[([^\]]+)\]\(\1\)/g, "$1");
}

function isSupported(field: FieldDef): boolean {
  return field.type === "text" || field.type === "select" || field.type === "attachment";
}

/** 附件在站点里的路径。用 file_token 分目录，同一条记录里的同名文件也不会冲突 */
export function attachmentPath(file: Attachment): string {
  const safeName = file.name.replace(/[\p{Cc}\\/:*?"<>|]/gu, "_");
  return `files/${file.file_token}/${safeName}`;
}

export function normalizeTable(input: TableInput): { collection: Collection; warnings: string[] } {
  const { type, label, records } = input;
  const warnings: string[] = [];

  const ordered = orderFields(input.fields, input.viewOrder);
  const primary = ordered[0];
  if (!primary) throw new Error(`${label} 表没有字段`);
  if (primary.type !== "text") {
    throw new Error(`${label} 表的主字段「${primary.name}」不是文本字段`);
  }

  const usable = ordered.filter((field) => {
    if (isSupported(field)) return true;
    warnings.push(`${label} 表的字段「${field.name}」是 ${field.type} 类型，暂不支持，已跳过`);
    return false;
  });

  const facets: Facet[] = [];
  for (const field of usable) {
    if (field.type !== "select") continue;
    if (RESERVED.has(field.name)) {
      throw new Error(`${label} 表的筛选字段名「${field.name}」是保留名，请在飞书里改名`);
    }
    // 同一个字段里可能有同名的选项，筛选时按名称合并
    const options = [...new Set((field.options ?? []).map((option) => option.name))];
    for (const option of options) {
      if (option.includes(",")) {
        throw new Error(`${label} 表「${field.name}」的选项「${option}」不能包含逗号`);
      }
    }
    facets.push({ name: field.name, options });
  }

  const descriptionField = usable.find(
    (field) => field.type === "text" && field.name === DESCRIPTION,
  );
  // 名称和描述单独显示在标题下面，其余字段全部放进字段列表
  const hidden = new Set([primary.name, descriptionField?.name]);
  const shown = usable.filter((field) => !hidden.has(field.name));

  const items: Item[] = records.map((raw) => {
    const where = `${label} / ${raw.record_id}`;
    const text = (name: string): string => {
      const value = raw[name];
      const joined = Array.isArray(value) ? (value as string[]).join("\n") : (value ?? "");
      return parseLink((joined as string).trim());
    };

    const name = text(primary.name);
    if (!name) throw new Error(`${where}：名称为空`);

    const fields: Field[] = shown.map((field) => {
      if (field.type === "text") return { name: field.name, value: text(field.name) };
      const cell = raw[field.name];
      if (field.type === "attachment") {
        const files: FileRef[] = ((cell as Attachment[] | null | undefined) ?? []).map((file) => ({
          name: file.name,
          size: file.size,
          path: attachmentPath(file),
        }));
        return { name: field.name, files };
      }
      const values = (Array.isArray(cell) ? cell : cell ? [cell] : []) as string[];
      const allowed = new Set((field.options ?? []).map((option) => option.name));
      for (const value of values) {
        if (!allowed.has(value))
          throw new Error(`${where}：「${field.name}」的值「${value}」不在选项中`);
      }
      return { name: field.name, value: values };
    });

    return {
      id: raw.record_id,
      name,
      description: descriptionField ? text(descriptionField.name) : "",
      fields,
    };
  });

  items.sort(
    (a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  return { collection: { type, label, facets, items }, warnings };
}
