import type { FacetKey, Item } from "../types.ts";

export const FACET_KEYS: readonly FacetKey[] = ["type", "scope", "domain", "scenario"];

export type ViewMode = "table" | "grid";

export type FilterState = Record<FacetKey, string[]> & { q: string };

export interface UrlState extends FilterState {
  view: ViewMode;
  item: string | null;
}

export const EMPTY_FILTER: FilterState = { type: [], scope: [], domain: [], scenario: [], q: "" };

export function itemValues(item: Item, key: FacetKey): string[] {
  switch (key) {
    case "type":
      return [item.type];
    case "scope":
      return item.scope ? [item.scope] : [];
    case "domain":
      return item.domains;
    case "scenario":
      return item.scenarios;
  }
}

/** 关键词按空白切分，每个词都要命中名称或描述（不区分大小写） */
export function matchesQuery(item: Item, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${item.name}\n${item.description}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** 维度内 OR、维度间 AND；except 指定的维度不参与判断 */
export function matches(item: Item, state: FilterState, except?: FacetKey): boolean {
  for (const key of FACET_KEYS) {
    if (key === except) continue;
    const selected = state[key];
    if (selected.length === 0) continue;
    const values = itemValues(item, key);
    if (!selected.some((v) => values.includes(v))) return false;
  }
  return matchesQuery(item, state.q);
}

export function filterItems(items: Item[], state: FilterState): Item[] {
  return items.filter((item) => matches(item, state));
}

/** 其他维度条件不变、只放开本维度时，每个选项的命中数 */
export function facetCounts(items: Item[], state: FilterState, key: FacetKey): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!matches(item, state, key)) continue;
    for (const value of itemValues(item, key)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

export function hasFilter(state: FilterState): boolean {
  return state.q.trim() !== "" || FACET_KEYS.some((key) => state[key].length > 0);
}

export function toggleValue(state: FilterState, key: FacetKey, value: string): FilterState {
  const selected = state[key];
  const next = selected.includes(value)
    ? selected.filter((v) => v !== value)
    : [...selected, value];
  return { ...state, [key]: next };
}

export function encodeState(state: UrlState): string {
  const params = new URLSearchParams();
  for (const key of FACET_KEYS) {
    if (state[key].length > 0) params.set(key, state[key].join(","));
  }
  if (state.q.trim()) params.set("q", state.q);
  if (state.view !== "table") params.set("view", state.view);
  if (state.item) params.set("item", state.item);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function decodeState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const list = (key: FacetKey) => (params.get(key) ?? "").split(",").filter(Boolean);
  return {
    type: list("type"),
    scope: list("scope"),
    domain: list("domain"),
    scenario: list("scenario"),
    q: params.get("q") ?? "",
    view: params.get("view") === "grid" ? "grid" : "table",
    item: params.get("item") || null,
  };
}
