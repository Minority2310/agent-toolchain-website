import { itemValues } from "../lib/filter.ts";
import type { Facet, Item } from "../types.ts";

export interface ListProps {
  items: Item[];
  /** 当前视图的筛选字段，表格里每个字段一列 */
  facets: Facet[];
  numberOf: (id: string) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ItemTable({ items, facets, numberOf, selectedId, onSelect }: ListProps) {
  // 主区域变窄时只留第一个字段列，其余列加 col-tags 由样式隐藏
  const cellClass = (index: number) => (index === 0 ? undefined : "col-tags");

  return (
    <table className="item-table">
      <thead>
        <tr>
          <th scope="col" className="col-no">
            编号
          </th>
          <th scope="col">名称</th>
          {facets.map(({ name }, index) => (
            <th scope="col" key={name} className={cellClass(index)}>
              {name}
            </th>
          ))}
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
            {facets.map(({ name }, index) => (
              <td key={name} className={cellClass(index)}>
                {itemValues(item, name).join("、")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
