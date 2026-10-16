import type { KeyboardEvent } from "react";
import type { ItemType } from "../types.ts";

export interface TabInfo {
  type: ItemType;
  label: string;
  count: number;
}

interface Props {
  tabs: TabInfo[];
  active: ItemType;
  onSelect: (type: ItemType) => void;
}

/** 在三个视图之间切换；数量是按当前搜索词算的，能看出搜索结果分布在哪个视图 */
export function TypeTabs({ tabs, active, onSelect }: Props) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onSelect(next.type);
    document.getElementById(`tab-${next.type}`)?.focus();
  };

  return (
    <div className="type-tabs" role="tablist" aria-label="类型">
      {tabs.map((tab, index) => {
        const selected = tab.type === active;
        return (
          <button
            key={tab.type}
            type="button"
            role="tab"
            id={`tab-${tab.type}`}
            className="type-tab"
            aria-selected={selected}
            aria-controls="results"
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.type)}
            onKeyDown={(event) => move(event, index)}
          >
            {tab.label}
            <span className="type-tab-count num">{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
}
