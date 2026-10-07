import type { Item } from "../types.ts";

export interface ListProps {
  items: Item[];
  numberOf: (id: string) => string;
  typeLabel: (item: Item) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ItemTable({ items, numberOf, typeLabel, selectedId, onSelect }: ListProps) {
  return (
    <table className="item-table">
      <thead>
        <tr>
          <th scope="col" className="col-no">
            编号
          </th>
          <th scope="col">名称</th>
          <th scope="col">类型</th>
          <th scope="col">范围</th>
          <th scope="col" className="col-tags">
            领域
          </th>
          <th scope="col" className="col-tags">
            场景
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            aria-selected={item.id === selectedId}
            onClick={() => onSelect(item.id)}
          >
            <td className="col-no num">{numberOf(item.id)}</td>
            <th scope="row" className="col-name">
              <button type="button" className="row-button" data-item={item.id}>
                {item.name}
              </button>
              {item.description && <span className="row-desc">{item.description}</span>}
            </th>
            <td>{typeLabel(item)}</td>
            <td>{item.scope}</td>
            <td className="col-tags">{item.domains.join("、")}</td>
            <td className="col-tags">{item.scenarios.join("、")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
