import { useEffect, useRef } from "react";
import { FACET_KEYS, type FilterState, facetCounts, hasFilter } from "../lib/filter.ts";
import type { FacetKey, FacetOption, Item } from "../types.ts";

const FACET_LABELS: Record<FacetKey, string> = {
  type: "类型",
  scope: "范围",
  domain: "领域",
  scenario: "场景",
};

interface Props {
  facets: Record<FacetKey, FacetOption[]>;
  items: Item[];
  state: FilterState;
  openFacet: FacetKey | null;
  onToggle: (key: FacetKey, value: string) => void;
  onQuery: (q: string) => void;
  onClear: () => void;
  onOpenFacet: (key: FacetKey | null) => void;
}

export function FacetBar({
  facets,
  items,
  state,
  openFacet,
  onToggle,
  onQuery,
  onClear,
  onOpenFacet,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  // 点击下拉以外的地方收起
  useEffect(() => {
    if (!openFacet) return;
    const onPointerDown = (event: PointerEvent) => {
      const menu = barRef.current?.querySelector(`[data-facet="${openFacet}"]`);
      if (!menu?.contains(event.target as Node)) onOpenFacet(null);
    };
    addEventListener("pointerdown", onPointerDown);
    return () => removeEventListener("pointerdown", onPointerDown);
  }, [openFacet, onOpenFacet]);

  const labelOf = (key: FacetKey, value: string) =>
    facets[key].find((option) => option.value === value)?.label ?? value;
  const selected = FACET_KEYS.flatMap((key) => state[key].map((value) => ({ key, value })));

  return (
    <section className="section grid" id="filter" aria-labelledby="filter-heading">
      <h2 className="section-head" id="filter-heading">
        <span className="section-no num">01</span>
        筛选
      </h2>

      <div className="filter-body">
        <div className="filter-bar" ref={barRef}>
          <label className="search">
            <span className="visually-hidden">搜索名称或描述</span>
            <input
              type="search"
              value={state.q}
              placeholder="搜索名称或描述"
              onChange={(event) => onQuery(event.target.value)}
            />
          </label>

          <div className="facet-menus">
            {FACET_KEYS.map((key) => {
              const open = openFacet === key;
              const count = state[key].length;
              const counts = open ? facetCounts(items, state, key) : null;
              return (
                <div
                  className="facet-menu"
                  data-facet={key}
                  key={key}
                  onBlur={(event) => {
                    // 只处理键盘把焦点移到别处；鼠标点在面板内的文字上时 relatedTarget 为空，不能收起
                    const next = event.relatedTarget;
                    if (open && next && !event.currentTarget.contains(next)) {
                      onOpenFacet(null);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="facet-trigger"
                    data-trigger={key}
                    aria-expanded={open}
                    aria-controls={`facet-${key}`}
                    data-active={count > 0}
                    onClick={() => onOpenFacet(open ? null : key)}
                  >
                    {FACET_LABELS[key]}
                    {count > 0 && <span className="facet-count num">{count}</span>}
                  </button>
                  {counts && (
                    <fieldset className="facet-panel" id={`facet-${key}`}>
                      <legend className="visually-hidden">{FACET_LABELS[key]}</legend>
                      {facets[key].map((option) => {
                        const checked = state[key].includes(option.value);
                        const hits = counts.get(option.value) ?? 0;
                        return (
                          <label className="facet-option" key={option.value}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={hits === 0 && !checked}
                              onChange={() => onToggle(key, option.value)}
                            />
                            <span className="facet-option-label">{option.label}</span>
                            <span className="facet-option-count num">{hits}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="text-button clear"
            disabled={!hasFilter(state)}
            onClick={onClear}
          >
            清除筛选
          </button>
        </div>

        {selected.length > 0 && (
          <ul className="selected-tags" aria-label="已选条件">
            {selected.map(({ key, value }) => (
              <li key={`${key}:${value}`}>
                <button type="button" className="selected-tag" onClick={() => onToggle(key, value)}>
                  <span className="visually-hidden">移除{FACET_LABELS[key]}：</span>
                  {labelOf(key, value)}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
