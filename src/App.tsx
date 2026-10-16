import { useCallback, useEffect, useMemo, useState } from "react";
import { DetailPanel } from "./components/DetailPanel.tsx";
import { FacetBar } from "./components/FacetBar.tsx";
import { Header } from "./components/Header.tsx";
import { ItemGrid } from "./components/ItemGrid.tsx";
import { ItemTable } from "./components/ItemTable.tsx";
import { TypeTabs } from "./components/TypeTabs.tsx";
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
import type { ItemType } from "./types.ts";

const toolchain = data;
const { collections } = toolchain;
const total = collections.reduce((sum, c) => sum + c.items.length, 0);

/** 编号在每个视图内从 01 开始，按视图里的全部条目排序 */
const numbers = new Map(
  collections.flatMap((c) =>
    c.items.map((item, index) => [item.id, String(index + 1).padStart(2, "0")] as const),
  ),
);
const numberOf = (id: string) => numbers.get(id) ?? "";

function writeUrl(state: UrlState, mode: "push" | "replace") {
  const url = `${location.pathname}${encodeState(state)}${location.hash}`;
  if (mode === "push") history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

export default function App() {
  const [state, setState] = useState<UrlState>(() => decodeState(location.search, collections));
  const [openFacet, setOpenFacet] = useState<string | null>(null);

  const update = useCallback((next: UrlState, mode: "push" | "replace" = "replace") => {
    setState(next);
    writeUrl(next, mode);
  }, []);

  useEffect(() => installPaging(), []);

  useEffect(() => {
    const onPop = () => setState(decodeState(location.search, collections));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  // collections 不会为空：同步脚本固定输出三个视图，decodeState 保证 type 是其中之一
  const collection = collections.find((c) => c.type === state.type) ?? collections[0];
  const { facets, items } = collection;

  const results = useMemo(() => filterItems(items, facets, state), [items, facets, state]);
  const selected = state.item ? (items.find((item) => item.id === state.item) ?? null) : null;
  // 标签上的数量只按搜索词算，不受当前视图里选的筛选字段影响
  const tabs = useMemo(
    () =>
      collections.map((c) => ({
        type: c.type,
        label: c.label,
        count: filterItems(c.items, [], { ...EMPTY_FILTER, q: state.q }).length,
      })),
    [state.q],
  );

  // 三张表的字段不同，换视图时筛选字段全部清空；搜索词和表格 / 卡片视图保留
  const switchType = (type: ItemType) => {
    if (type === state.type) return;
    setOpenFacet(null);
    update({ ...state, type, values: {}, item: null }, "push");
  };

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
        document.querySelector<HTMLElement>(`[data-trigger="${CSS.escape(openFacet)}"]`)?.focus();
      } else if (state.item) closeDetail();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [openFacet, state.item, closeDetail]);

  const setView = (view: ViewMode) => update({ ...state, view });

  return (
    <div className="page" data-detail={selected ? "open" : "closed"}>
      <main className="main">
        <Header total={total} generatedAt={toolchain.generatedAt} />

        {/* 第二屏：筛选 + 结果，至少一屏高，保证首屏引导按钮能把筛选区滚到顶部 */}
        <div className="screen">
          <FacetBar
            facets={facets}
            items={items}
            state={state}
            openFacet={openFacet}
            tabs={<TypeTabs tabs={tabs} active={state.type} onSelect={switchType} />}
            onToggle={(name, value) => update({ ...state, ...toggleValue(state, name, value) })}
            onQuery={(q) => update({ ...state, q })}
            onClear={() => update({ ...state, ...EMPTY_FILTER })}
            onOpenFacet={setOpenFacet}
          />

          <section className="section grid" aria-labelledby="result-heading">
            <h2 className="section-head" id="result-heading">
              <span className="section-no num">02</span>
              结果
            </h2>
            <div
              className="result-body"
              id="results"
              role="tabpanel"
              aria-labelledby={`tab-${state.type}`}
            >
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
                  facets={facets}
                  numberOf={numberOf}
                  selectedId={state.item}
                  onSelect={select}
                />
              ) : (
                <ItemGrid
                  items={results}
                  facets={facets}
                  numberOf={numberOf}
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
          typeLabel={collection.label}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
