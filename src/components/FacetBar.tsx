import { type ReactNode, useEffect, useRef } from "react";
import { type FilterState, facetCounts, hasFilter } from "../lib/filter.ts";
import type { Facet, Item } from "../types.ts";

interface Props {
  /** 当前视图（一张表）的筛选字段 */
  facets: Facet[];
  items: Item[];
  state: FilterState;
  openFacet: string | null;
  /** 放在搜索栏上方，用来切换视图 */
  tabs: ReactNode;
  onToggle: (name: string, value: string) => void;
  onQuery: (q: string) => void;
  onClear: () => void;
  onOpenFacet: (name: string | null) => void;
}

export function FacetBar({
  facets,
  items,
  state,
  openFacet,
  tabs,
  onToggle,
  onQuery,
  onClear,
  onOpenFacet,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  // 点击下拉以外的地方收起
  useEffect(() => {
    if (openFacet === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const menus = barRef.current?.querySelectorAll<HTMLElement>("[data-facet]") ?? [];
      const menu = [...menus].find((el) => el.dataset.facet === openFacet);
      if (!menu?.contains(event.target as Node)) onOpenFacet(null);
    };
    addEventListener("pointerdown", onPointerDown);
    return () => removeEventListener("pointerdown", onPointerDown);
  }, [openFacet, onOpenFacet]);

  const selected = facets.flatMap(({ name }) =>
    (state.values[name] ?? []).map((value) => ({ name, value })),
  );

  return (
    <section className="section grid" id="filter" aria-labelledby="filter-heading">
      <h2 className="section-head" id="filter-heading">
        <span className="section-no num">01</span>
        筛选
      </h2>

      <div className="filter-body">
        {tabs}

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
            {facets.map(({ name, options }, index) => {
              const open = openFacet === name;
              const count = (state.values[name] ?? []).length;
              const counts = open ? facetCounts(items, facets, state, name) : null;
              return (
                <div
                  className="facet-menu"
                  data-facet={name}
                  key={name}
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
                    data-trigger={name}
                    aria-expanded={open}
                    aria-controls={`facet-${index}`}
                    data-active={count > 0}
                    onClick={() => onOpenFacet(open ? null : name)}
                  >
                    {name}
                    {count > 0 && <span className="facet-count num">{count}</span>}
                  </button>
                  {counts && (
                    <fieldset className="facet-panel" id={`facet-${index}`}>
                      <legend className="visually-hidden">{name}</legend>
                      {options.map((option) => {
                        const checked = (state.values[name] ?? []).includes(option);
                        const hits = counts.get(option) ?? 0;
                        return (
                          <label className="facet-option" key={option}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={hits === 0 && !checked}
                              onChange={() => onToggle(name, option)}
                            />
                            <span className="facet-option-label">{option}</span>
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
            {selected.map(({ name, value }) => (
              <li key={`${name}:${value}`}>
                <button
                  type="button"
                  className="selected-tag"
                  onClick={() => onToggle(name, value)}
                >
                  <span className="visually-hidden">移除{name}：</span>
                  {value}
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
