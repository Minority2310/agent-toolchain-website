export type ItemType = "guide" | "skill" | "mcp";

/** 附件：文件在同步时下载到站点的 files/ 目录下，path 相对于站点根路径 */
export interface FileRef {
  name: string;
  size: number;
  path: string;
}

/** 单选 / 多选字段的值是字符串数组，文本字段的值是字符串，附件字段是文件列表 */
export type Field = { name: string; value: string | string[] } | { name: string; files: FileRef[] };

/** 一张表里的一个单选 / 多选字段：既是筛选项，也是表格里的一列 */
export interface Facet {
  name: string;
  options: string[];
}

export interface Item {
  id: string;
  /** 表的主字段 */
  name: string;
  /** 字段「描述」，没有则为空 */
  description: string;
  /** 除名称和描述以外的全部字段，按表里的字段顺序（空值也在） */
  fields: Field[];
}

/** 一张表对应的一个视图：条目的字段、筛选项都来自这张表自己 */
export interface Collection {
  type: ItemType;
  label: string;
  facets: Facet[];
  items: Item[];
}

export interface Toolchain {
  generatedAt: string;
  /** 固定顺序：guide、skill、mcp */
  collections: Collection[];
}
