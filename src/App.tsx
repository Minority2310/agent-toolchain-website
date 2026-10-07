import { useCallback, useEffect, useMemo, useState } from "react";
import { DetailPanel } from "./components/DetailPanel.tsx";
import { FacetBar } from "./components/FacetBar.tsx";
import { Header } from "./components/Header.tsx";
import { ItemGrid } from "./components/ItemGrid.tsx";
import { ItemTable } from "./components/ItemTable.tsx";
import data from "./data/toolchain.json";
import {
  EMPTY_FILTER,
  type UrlState,
  type ViewMode,
  decodeState,
  encodeState,
  filterItems,
  toggleValue,
} from "./lib/filter.ts";
import { installPaging } from "./lib/paging.ts";
import type { FacetKey, Item } from "./types.ts";

const toolchain = data;
const { items, facets } = toolchain;

const typeLabels = new Map(facets.type.map((option) => [option.value, option.label]));
const typeLabel = (item: Item) => typeLabels.get(item.type) ?? item.type;

const numbers = new Map(items.map((item, index) => [item.id, String(index + 1).padStart(2, "0")]));
const numberOf = (id: string) => numbers.get(id) ?? "";

function writeUrl(state: UrlState, mode: "push" | "replace") {
  const url = `${location.pathname}${encodeState(state)}${location.hash}`;
  if (mode === "push") history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

export default function App() {
  const [state, setState] = useState<UrlState>(() => decodeState(location.search));
  const [openFacet, setOpenFacet] = useState<FacetKey | null>(null);

  const update = useCallback((next: UrlState, mode: "push" | "replace" = "replace") => {
    setState(next);
    writeUrl(next, mode);
  }, []);

  useEffect(() => installPaging(), []);

  useEffect(() => {
    const onPop = () => setState(decodeState(location.search));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  const results = useMemo(() => filterItems(items, state), [state]);
  const selected = state.item ? (items.find((item) => item.id === state.item) ?? null) : null;

  const select = (id: string) => {
    if (id !== state.item) update({ ...state, item: id }, state.item ? "replace" : "push");
  };
  const closeDetail = useCallback(() => {
    const id = state.item;
    update({ ...state, item: null }, "push");
    if (id)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-item="${id}"]`)?.focus(),
      );
  }, [state, update]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openFacet) {
        setOpenFacet(null);
        document.querySelector<HTMLElement>(`[data-trigger="${openFacet}"]`)?.focus();
      } else if (state.item) closeDetail();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [openFacet, state.item, closeDetail]);

  const setView = (view: ViewMode) => update({ ...state, view });

  return (
    <div className="page" data-detail={selected ? "open" : "closed"}>
      <main className="main">
        <Header total={items.length} generatedAt={toolchain.generatedAt} />

        {/* 第二屏：筛选 + 结果，至少一屏高，保证首屏引导按钮能把筛选区滚到顶部 */}
        <div className="screen">
          <FacetBar
            facets={facets}
            items={items}
            state={state}
            openFacet={openFacet}
            onToggle={(key: FacetKey, value: string) =>
              update({ ...state, ...toggleValue(state, key, value) })
            }
            onQuery={(q) => update({ ...state, q })}
            onClear={() => update({ ...state, ...EMPTY_FILTER })}
            onOpenFacet={setOpenFacet}
          />

          <section className="section grid" aria-labelledby="result-heading">
            <h2 className="section-head" id="result-heading">
              <span className="section-no num">02</span>
              结果
            </h2>
            <div className="result-body">
              <div className="result-bar">
                <p className="result-count" aria-live="polite">
                  <span className="num">{results.length}</span>
                  <span className="result-total num"> / {items.length}</span>
                </p>
                <div className="view-switch" role="group" aria-label="视图">
                  <button
                    type="button"
                    aria-pressed={state.view === "table"}
                    onClick={() => setView("table")}
                  >
                    表格
                  </button>
                  <button
                    type="button"
                    aria-pressed={state.view === "grid"}
                    onClick={() => setView("grid")}
                  >
                    卡片
                  </button>
                </div>
              </div>

              {results.length === 0 ? (
                <p className="empty">没有符合条件的条目。减少筛选条件，或换一个关键词。</p>
              ) : state.view === "table" ? (
                <ItemTable
                  items={results}
                  numberOf={numberOf}
                  typeLabel={typeLabel}
                  selectedId={state.item}
                  onSelect={select}
                />
              ) : (
                <ItemGrid
                  items={results}
                  numberOf={numberOf}
                  typeLabel={typeLabel}
                  selectedId={state.item}
                  onSelect={select}
                />
              )}
            </div>
          </section>

          <footer className="colophon grid">
            <p>数据来自飞书多维表格「智能体工具链」，每次部署时同步。</p>
          </footer>
        </div>
      </main>

      {selected && (
        <DetailPanel
          item={selected}
          number={numberOf(selected.id)}
          typeLabel={typeLabel(selected)}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
