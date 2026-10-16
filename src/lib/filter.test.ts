import { describe, expect, it } from "vite-plus/test";
import type { Collection, Item } from "../types.ts";
import {
  DEFAULT_TYPE,
  EMPTY_FILTER,
  type UrlState,
  decodeState,
  encodeState,
  facetCounts,
  filterItems,
  hasFilter,
  toggleValue,
} from "./filter.ts";

function item(id: string, partial: Partial<Item> = {}): Item {
  return { id, name: id, description: "", fields: [], ...partial };
}

/** MCP 视图：有「领域」「场景」「认证方式」三个筛选字段 */
const mcp: Collection = {
  type: "mcp",
  label: "MCP 服务",
  facets: [
    { name: "领域", options: ["前端", "后端", "数据"] },
    { name: "场景", options: ["调研", "调试", "测试"] },
    { name: "认证方式", options: ["无", "API Key"] },
  ],
  items: [
    item("a", {
      name: "context7",
      description: "查询文档",
      fields: [
        { name: "领域", value: ["前端", "后端"] },
        { name: "场景", value: ["调研"] },
        { name: "认证方式", value: ["API Key"] },
      ],
    }),
    item("b", {
      name: "chrome-devtools",
      fields: [
        { name: "领域", value: ["前端"] },
        { name: "场景", value: ["调试", "测试"] },
        { name: "认证方式", value: ["无"] },
      ],
    }),
    item("c", {
      name: "jina",
      description: "多维表格 Base",
      fields: [{ name: "领域", value: ["数据"] }],
    }),
  ],
};

/** Skills 视图：筛选字段和 MCP 不同，且没有「领域」 */
const skill: Collection = {
  type: "skill",
  label: "Skills",
  facets: [{ name: "技能类型", options: ["技能库", "独立技能"] }],
  items: [item("s1", { fields: [{ name: "技能类型", value: ["技能库"] }] })],
};
const guide: Collection = { type: "guide", label: "AGENTS.md", facets: [], items: [] };
const collections = [guide, skill, mcp];

const { items, facets } = mcp;
const ids = (list: Item[]) => list.map((i) => i.id);

describe("filterItems", () => {
  it("无条件时返回全部", () => {
    expect(ids(filterItems(items, facets, EMPTY_FILTER))).toEqual(["a", "b", "c"]);
  });

  it("同一字段内是 OR", () => {
    const state = { ...EMPTY_FILTER, values: { 领域: ["数据", "后端"] } };
    expect(ids(filterItems(items, facets, state))).toEqual(["a", "c"]);
  });

  it("不同字段之间是 AND", () => {
    const state = { ...EMPTY_FILTER, values: { 领域: ["前端"], 场景: ["测试", "调研"] } };
    expect(ids(filterItems(items, facets, state))).toEqual(["a", "b"]);
    const narrower = { ...EMPTY_FILTER, values: { 领域: ["前端"], 认证方式: ["无"] } };
    expect(ids(filterItems(items, facets, narrower))).toEqual(["b"]);
  });

  it("条目没有某个字段时，选了该字段的筛选就不命中它", () => {
    const state = { ...EMPTY_FILTER, values: { 认证方式: ["无", "API Key"] } };
    expect(ids(filterItems(items, facets, state))).toEqual(["a", "b"]);
  });

  it("不属于当前视图的字段名被忽略", () => {
    const state = { ...EMPTY_FILTER, values: { 技能类型: ["技能库"] } };
    expect(ids(filterItems(items, facets, state))).toEqual(["a", "b", "c"]);
  });

  it("关键词匹配名称和描述，多个词都要命中，不区分大小写", () => {
    const q = (text: string) => ids(filterItems(items, facets, { ...EMPTY_FILTER, q: text }));
    expect(q("BASE")).toEqual(["c"]);
    expect(q("  多维表格  jina ")).toEqual(["c"]);
    expect(q("文档 chrome")).toEqual([]);
  });
});

describe("facetCounts", () => {
  const counts = (state: typeof EMPTY_FILTER, name: string) =>
    Object.fromEntries(facetCounts(items, facets, state, name));

  it("计数时放开本字段、保留其他字段和关键词", () => {
    const state = { ...EMPTY_FILTER, values: { 领域: ["后端"] } };
    expect(counts(state, "领域")).toEqual({ 前端: 2, 后端: 1, 数据: 1 });
    expect(counts(state, "场景")).toEqual({ 调研: 1 });
    expect(counts({ ...state, q: "chrome" }, "领域")).toEqual({ 前端: 1 });
  });

  it("没有这个字段的条目不计入", () => {
    expect(counts(EMPTY_FILTER, "认证方式")).toEqual({ 无: 1, "API Key": 1 });
  });
});

describe("toggleValue / hasFilter", () => {
  it("切换选项并判断是否有筛选", () => {
    const on = toggleValue(EMPTY_FILTER, "领域", "前端");
    expect(on.values).toEqual({ 领域: ["前端"] });
    expect(hasFilter(on)).toBe(true);
    const off = toggleValue(on, "领域", "前端");
    expect(off.values).toEqual({ 领域: [] });
    expect(hasFilter(off)).toBe(false);
    expect(hasFilter({ ...EMPTY_FILTER, q: "   " })).toBe(false);
  });
});

describe("URL 编解码", () => {
  const base: UrlState = { ...EMPTY_FILTER, type: DEFAULT_TYPE, view: "table", item: null };

  it("默认状态编码为空串", () => {
    expect(encodeState(base)).toBe("");
    expect(decodeState("", collections)).toEqual(base);
  });

  it("往返保持一致（包括中文字段名、空格）", () => {
    const state: UrlState = {
      type: "mcp",
      values: { 领域: ["前端", "数据"], 认证方式: ["API Key"] },
      q: "Streamable HTTP 文档",
      view: "grid",
      item: "recABC123",
    };
    const search = encodeState(state);
    expect(search).not.toMatch(/[一-龥 ]/);
    expect(decodeState(search, collections)).toEqual(state);
  });

  it("值中的空格和加号可以还原", () => {
    const state: UrlState = { ...base, type: "mcp", values: { 领域: ["A B"] }, q: "a+b c" };
    expect(decodeState(encodeState(state), collections)).toEqual(state);
  });

  it("默认视图不写 type，其他视图写", () => {
    expect(encodeState({ ...base, type: "guide" })).toBe("");
    expect(encodeState({ ...base, type: "skill" })).toBe("?type=skill");
  });

  it("type 无效时回退到默认视图", () => {
    expect(decodeState("?type=bogus", collections).type).toBe(DEFAULT_TYPE);
  });

  it("只识别当前视图的筛选字段", () => {
    const search = "?type=skill&技能类型=技能库&领域=前端";
    expect(decodeState(search, collections).values).toEqual({ 技能类型: ["技能库"] });
  });

  it("未知 view 回退为表格", () => {
    expect(decodeState("?view=list", collections).view).toBe("table");
  });
});
