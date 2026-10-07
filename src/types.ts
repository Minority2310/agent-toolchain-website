export type ItemType = "guide" | "skill" | "mcp";

export type FacetKey = "type" | "scope" | "domain" | "scenario";

export interface Item {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  scope: string;
  domains: string[];
  scenarios: string[];
  link: string;
  /** 该表的专有字段，key 为字段名 */
  detail: Record<string, string | string[]>;
}

export interface FacetOption {
  value: string;
  label: string;
}

export interface Toolchain {
  generatedAt: string;
  facets: Record<FacetKey, FacetOption[]>;
  items: Item[];
}
