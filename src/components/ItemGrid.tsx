import { itemValues } from "../lib/filter.ts";
import type { ListProps } from "./ItemTable.tsx";

export function ItemGrid({ items, facets, numberOf, selectedId, onSelect }: ListProps) {
  return (
    <ul className="item-grid">
      {items.map((item) => (
        <li key={item.id} className="card" aria-current={item.id === selectedId || undefined}>
          <button
            type="button"
            className="card-button"
            onClick={() => onSelect(item.id)}
            data-item={item.id}
          >
            <span className="card-no num">{numberOf(item.id)}</span>
            <span className="card-name">{item.name}</span>
            {item.description && <span className="card-desc">{item.description}</span>}
            <span className="card-tags">
              {facets.flatMap(({ name }) => itemValues(item, name)).join("　")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
