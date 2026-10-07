import { describe, expect, it } from "vite-plus/test";
import type { Item } from "../types.ts";
import {
  EMPTY_FILTER,
  type UrlState,
  decodeState,
  encodeState,
  facetCounts,
  filterItems,
  hasFilter,
  toggleValue,
} from "./filter.ts";

function item(partial: Partial<Item> & Pick<Item, "id">): Item {
  return {
    type: "skill",
    name: partial.id,
    description: "",
    scope: "全局",
    domains: [],
    scenarios: [],
    link: "",
    detail: {},
    ...partial,
  };
}

const items: Item[] = [
  item({
    id: "a",
    type: "mcp",
    name: "context7",
    description: "查询文档",
    domains: ["前端", "后端"],
    scenarios: ["调研"],
  }),
  item({
    id: "b",
    type: "mcp",
    name: "chrome-devtools",
    domains: ["前端"],
    scenarios: ["调试", "测试"],
  }),
  item({
    id: "c",
    type: "skill",
    name: "lark-base",
    description: "多维表格 Base",
    domains: ["数据"],
    scenarios: ["自动化"],
  }),
  item({
    id: "d",
    type: "guide",
    name: "AGENTS.md",
    scope: "项目",
    domains: ["通用"],
    scenarios: ["编码"],
  }),
];

const ids = (list: Item[]) => list.map((i) => i.id);

describe("filterItems", () => {
  it("无条件时返回全部", () => {
    expect(ids(filterItems(items, EMPTY_FILTER))).toEqual(["a", "b", "c", "d"]);
  });

  it("同一维度内是 OR", () => {
    const state = { ...EMPTY_FILTER, domain: ["数据", "通用"] };
    expect(ids(filterItems(items, state))).toEqual(["c", "d"]);
  });

  it("不同维度之间是 AND", () => {
    const state = { ...EMPTY_FILTER, type: ["mcp"], scenario: ["测试", "自动化"] };
    expect(ids(filterItems(items, state))).toEqual(["b"]);
  });

  it("关键词匹配名称和描述，多个词都要命中，不区分大小写", () => {
    expect(ids(filterItems(items, { ...EMPTY_FILTER, q: "BASE" }))).toEqual(["c"]);
    expect(ids(filterItems(items, { ...EMPTY_FILTER, q: "  多维表格  lark " }))).toEqual(["c"]);
    expect(ids(filterItems(items, { ...EMPTY_FILTER, q: "文档 chrome" }))).toEqual([]);
  });
});

describe("facetCounts", () => {
  it("计数时放开本维度、保留其他维度和关键词", () => {
    const state = { ...EMPTY_FILTER, type: ["mcp"], domain: ["后端"] };
    expect(Object.fromEntries(facetCounts(items, state, "type"))).toEqual({ mcp: 1 });
    expect(Object.fromEntries(facetCounts(items, state, "domain"))).toEqual({ 前端: 2, 后端: 1 });
    expect(Object.fromEntries(facetCounts(items, state, "scenario"))).toEqual({ 调研: 1 });
  });

  it("本维度已选的值不影响本维度的计数", () => {
    const state = { ...EMPTY_FILTER, scope: ["项目"] };
    expect(Object.fromEntries(facetCounts(items, state, "scope"))).toEqual({ 全局: 3, 项目: 1 });
  });
});

describe("toggleValue / hasFilter", () => {
  it("切换选项并判断是否有筛选", () => {
    const on = toggleValue(EMPTY_FILTER, "domain", "前端");
    expect(on.domain).toEqual(["前端"]);
    expect(hasFilter(on)).toBe(true);
    expect(toggleValue(on, "domain", "前端").domain).toEqual([]);
    expect(hasFilter({ ...EMPTY_FILTER, q: "   " })).toBe(false);
  });
});

describe("URL 编解码", () => {
  const base: UrlState = { ...EMPTY_FILTER, view: "table", item: null };

  it("默认状态编码为空串", () => {
    expect(encodeState(base)).toBe("");
    expect(decodeState("")).toEqual(base);
  });

  it("往返保持一致（包括中文和空格）", () => {
    const state: UrlState = {
      type: ["mcp", "guide"],
      scope: ["全局"],
      domain: ["前端", "数据"],
      scenario: ["代码审查"],
      q: "Streamable HTTP 文档",
      view: "grid",
      item: "recABC123",
    };
    const search = encodeState(state);
    expect(search).not.toMatch(/[一-龥 ]/);
    expect(decodeState(search)).toEqual(state);
  });

  it("值中的空格和加号可以还原", () => {
    const state: UrlState = { ...base, scope: ["A B"], q: "a+b c" };
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it("未知 view 回退为表格", () => {
    expect(decodeState("?view=list").view).toBe("table");
  });
});
