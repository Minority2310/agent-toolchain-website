import type { Collection, Facet, Item, ItemType } from "../types.ts";

/** 默认打开的视图，URL 里省略 type 时用它 */
export const DEFAULT_TYPE: ItemType = "guide";

export type ViewMode = "table" | "grid";

/** 筛选值按字段名存放：同一字段内是 OR，不同字段之间是 AND */
export interface FilterState {
  values: Record<string, string[]>;
  q: string;
}

export interface UrlState extends FilterState {
  type: ItemType;
  view: ViewMode;
  item: string | null;
}

export const EMPTY_FILTER: FilterState = { values: {}, q: "" };

/** 条目在某个筛选字段上的取值；这个条目没有该字段或没有值时为空数组 */
export function itemValues(item: Item, name: string): string[] {
  const field = item.fields.find((f) => f.name === name);
  return field && "value" in field && Array.isArray(field.value) ? field.value : [];
}

/** 关键词按空白切分，每个词都要命中名称或描述（不区分大小写） */
export function matchesQuery(item: Item, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${item.name}\n${item.description}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** 同一字段内 OR、不同字段间 AND；except 指定的字段不参与判断 */
export function matches(item: Item, facets: Facet[], state: FilterState, except?: string): boolean {
  for (const { name } of facets) {
    if (name === except) continue;
    const selected = state.values[name] ?? [];
    if (selected.length === 0) continue;
    const values = itemValues(item, name);
    if (!selected.some((v) => values.includes(v))) return false;
  }
  return matchesQuery(item, state.q);
}

export function filterItems(items: Item[], facets: Facet[], state: FilterState): Item[] {
  return items.filter((item) => matches(item, facets, state));
}

/** 其他字段条件不变、只放开本字段时，每个选项的命中数 */
export function facetCounts(
  items: Item[],
  facets: Facet[],
  state: FilterState,
  name: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!matches(item, facets, state, name)) continue;
    for (const value of itemValues(item, name)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

export function hasFilter(state: FilterState): boolean {
  return state.q.trim() !== "" || Object.values(state.values).some((v) => v.length > 0);
}

export function toggleValue(state: FilterState, name: string, value: string): FilterState {
  const selected = state.values[name] ?? [];
  const next = selected.includes(value)
    ? selected.filter((v) => v !== value)
    : [...selected, value];
  return { ...state, values: { ...state.values, [name]: next } };
}

export function encodeState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.type !== DEFAULT_TYPE) params.set("type", state.type);
  for (const [name, values] of Object.entries(state.values)) {
    if (values.length > 0) params.set(name, values.join(","));
  }
  if (state.q.trim()) params.set("q", state.q);
  if (state.view !== "table") params.set("view", state.view);
  if (state.item) params.set("item", state.item);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** type 缺省或不是已有的视图时回退到默认视图；筛选只认当前视图的字段，其余参数忽略 */
export function decodeState(search: string, collections: Collection[]): UrlState {
  const params = new URLSearchParams(search);
  const requested = params.get("type");
  const collection =
    collections.find((c) => c.type === requested) ??
    collections.find((c) => c.type === DEFAULT_TYPE) ??
    collections[0];
  const values: Record<string, string[]> = {};
  for (const { name } of collection?.facets ?? []) {
    const list = (params.get(name) ?? "").split(",").filter(Boolean);
    if (list.length > 0) values[name] = list;
  }
  return {
    type: collection?.type ?? DEFAULT_TYPE,
    values,
    q: params.get("q") ?? "",
    view: params.get("view") === "grid" ? "grid" : "table",
    item: params.get("item") || null,
  };
}
