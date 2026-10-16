import { describe, expect, it } from "vite-plus/test";
import {
  type Attachment,
  type FieldDef,
  type RawRecord,
  type TableInput,
  normalizeTable,
} from "./normalize.ts";

const text = (id: string, name: string, style = "plain"): FieldDef => ({
  id,
  name,
  type: "text",
  style: { type: style },
});
const select = (id: string, name: string, options: string[], multiple = false): FieldDef => ({
  id,
  name,
  type: "select",
  multiple,
  options: options.map((option) => ({ name: option })),
});

function table(partial: Partial<TableInput> = {}): TableInput {
  return {
    type: "skill",
    label: "Skills",
    fields: [text("f1", "名称"), text("f2", "描述")],
    viewOrder: ["名称", "描述"],
    records: [],
    ...partial,
  };
}
const record = (
  id: string,
  cells: Record<string, string | string[] | Attachment[] | null>,
): RawRecord => ({
  record_id: id,
  ...cells,
});

describe("normalizeTable", () => {
  it("名称取视图里的第一个字段，不要求字段叫「名称」", () => {
    const { collection } = normalizeTable(
      table({
        fields: [text("f1", "技能名"), text("f2", "描述")],
        viewOrder: ["技能名", "描述"],
        records: [record("r1", { 技能名: "ego-browser", 描述: "浏览器" })],
      }),
    );
    expect(collection.items[0]).toMatchObject({ name: "ego-browser", description: "浏览器" });
  });

  it("每张表只带自己的字段，顺序和视图一致，视图里没有的字段按 ID 排在最后", () => {
    const { collection } = normalizeTable(
      table({
        fields: [
          text("f9", "备注"),
          text("f3", "安装命令"),
          text("f1", "名称"),
          text("f2", "来源"),
          text("f5", "教程"),
        ],
        viewOrder: ["名称", "来源", "安装命令"],
        records: [record("r1", { 名称: "x", 来源: "a", 安装命令: "b", 教程: "c", 备注: "d" })],
      }),
    );
    expect(collection.items[0].fields.map((field) => field.name)).toEqual([
      "来源",
      "安装命令",
      "教程",
      "备注",
    ]);
  });

  it("单选 / 多选字段成为筛选项，选项按飞书顺序并按名称去重", () => {
    const { collection } = normalizeTable(
      table({
        fields: [
          text("f1", "名称"),
          select("f2", "场景", ["编码", "通用", "设计", "通用"], true),
          select("f3", "生效范围", ["用户目录", "项目目录"]),
        ],
        viewOrder: ["名称", "场景", "生效范围"],
        records: [record("r1", { 名称: "x", 场景: ["通用"], 生效范围: ["项目目录"] })],
      }),
    );
    expect(collection.facets).toEqual([
      { name: "场景", options: ["编码", "通用", "设计"] },
      { name: "生效范围", options: ["用户目录", "项目目录"] },
    ]);
    expect(collection.items[0].fields).toEqual([
      { name: "场景", value: ["通用"] },
      { name: "生效范围", value: ["项目目录"] },
    ]);
  });

  it("链接样式的文本字段和其他字段一样放在字段列表里，Markdown 链接还原成网址", () => {
    const { collection } = normalizeTable(
      table({
        fields: [text("f1", "名称"), text("f2", "网址", "url"), text("f3", "教程", "url")],
        viewOrder: ["名称", "网址", "教程"],
        records: [
          record("r1", { 名称: "x", 网址: "[官网](https://a.example)", 教程: "https://b.example" }),
        ],
      }),
    );
    expect(collection.items[0].fields).toEqual([
      { name: "网址", value: "https://a.example" },
      { name: "教程", value: "https://b.example" },
    ]);
  });

  it("任意文本字段里整段是 Markdown 链接时取出 url，其余文本原样保留", () => {
    const { collection } = normalizeTable(
      table({
        fields: [text("f1", "名称"), text("f2", "源仓库"), text("f3", "提示词")],
        viewOrder: ["名称", "源仓库", "提示词"],
        records: [
          record("r1", {
            名称: "x",
            源仓库: "[https://github.com/a/b](https://github.com/a/b)",
            提示词: "见 [文档](https://c.example) 了解",
          }),
        ],
      }),
    );
    expect(collection.items[0].fields).toEqual([
      { name: "源仓库", value: "https://github.com/a/b" },
      { name: "提示词", value: "见 [文档](https://c.example) 了解" },
    ]);
  });

  it("文本中间「文字和网址相同」的链接还原成网址", () => {
    const { collection } = normalizeTable(
      table({
        fields: [text("f1", "名称"), text("f2", "安装命令")],
        viewOrder: ["名称", "安装命令"],
        records: [
          record("r1", {
            名称: "x",
            安装命令: "npx skills add [https://github.com/a/b](https://github.com/a/b) -g -y",
          }),
        ],
      }),
    );
    expect(collection.items[0].fields).toEqual([
      { name: "安装命令", value: "npx skills add https://github.com/a/b -g -y" },
    ]);
  });

  it("缺少「描述」或链接字段时留空", () => {
    const { collection } = normalizeTable(
      table({
        fields: [text("f1", "名称")],
        viewOrder: ["名称"],
        records: [record("r1", { 名称: "x" })],
      }),
    );
    expect(collection.items[0]).toMatchObject({ description: "", fields: [] });
  });

  it("附件字段输出文件列表，路径按 file_token 分目录，文件名里的特殊字符被替换", () => {
    const { collection, warnings } = normalizeTable(
      table({
        fields: [text("f1", "名称"), { id: "f2", name: "文件", type: "attachment" }],
        viewOrder: ["名称", "文件"],
        records: [
          record("r1", {
            名称: "x",
            文件: [
              { file_token: "tokA", name: "AGENTS.md", size: 3463 },
              { file_token: "tokB", name: "a/b:c.md", size: 10 },
            ],
          }),
          record("r2", { 名称: "y", 文件: null }),
        ],
      }),
    );
    expect(warnings).toEqual([]);
    expect(collection.items[0].fields).toEqual([
      {
        name: "文件",
        files: [
          { name: "AGENTS.md", size: 3463, path: "files/tokA/AGENTS.md" },
          { name: "a/b:c.md", size: 10, path: "files/tokB/a_b_c.md" },
        ],
      },
    ]);
    expect(collection.items[1].fields).toEqual([{ name: "文件", files: [] }]);
  });

  it("不支持的字段类型被跳过并给出警告", () => {
    const { collection, warnings } = normalizeTable(
      table({
        fields: [text("f1", "名称"), { id: "f2", name: "关联", type: "link" }],
        viewOrder: ["名称", "关联"],
        records: [record("r1", { 名称: "x" })],
      }),
    );
    expect(collection.items[0].fields).toEqual([]);
    expect(warnings).toEqual(["Skills 表的字段「关联」是 link 类型，暂不支持，已跳过"]);
  });

  it("条目按名称排序，同名按 ID 排序", () => {
    const { collection } = normalizeTable(
      table({
        records: [
          record("r3", { 名称: "b" }),
          record("r2", { 名称: "a" }),
          record("r1", { 名称: "a" }),
        ],
      }),
    );
    expect(collection.items.map((i) => i.id)).toEqual(["r1", "r2", "r3"]);
  });

  describe("报错", () => {
    it("名称为空", () => {
      expect(() => normalizeTable(table({ records: [record("r1", { 名称: "  " })] }))).toThrow(
        "名称为空",
      );
    });

    it("单选的值不在选项里", () => {
      const input = table({
        fields: [text("f1", "名称"), select("f2", "范围", ["全局"])],
        viewOrder: ["名称", "范围"],
        records: [record("r1", { 名称: "x", 范围: ["项目"] })],
      });
      expect(() => normalizeTable(input)).toThrow("「范围」的值「项目」不在选项中");
    });

    it("筛选字段名是 URL 保留名", () => {
      const input = table({
        fields: [text("f1", "名称"), select("f2", "type", ["a"])],
        viewOrder: ["名称", "type"],
      });
      expect(() => normalizeTable(input)).toThrow("保留名");
    });

    it("选项里有逗号", () => {
      const input = table({
        fields: [text("f1", "名称"), select("f2", "场景", ["a,b"])],
        viewOrder: ["名称", "场景"],
      });
      expect(() => normalizeTable(input)).toThrow("不能包含逗号");
    });

    it("主字段不是文本字段", () => {
      const input = table({
        fields: [select("f1", "名称", ["a"])],
        viewOrder: ["名称"],
      });
      expect(() => normalizeTable(input)).toThrow("不是文本字段");
    });
  });
});
