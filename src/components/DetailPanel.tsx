import { useEffect, useRef } from "react";
import type { Item } from "../types.ts";

const PRE_FIELDS = new Set(["配置示例"]);

function hostOf(link: string): string {
  return URL.canParse(link) ? new URL(link).host : link;
}

function show(value: string | string[]): string {
  const text = Array.isArray(value) ? value.join("、") : value;
  return text.trim() || "—";
}

interface Props {
  item: Item;
  number: string;
  typeLabel: string;
  onClose: () => void;
}

export function DetailPanel({ item, number, typeLabel, onClose }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [item.id]);

  return (
    <aside className="detail" role="dialog" aria-modal="false" aria-labelledby="detail-name">
      <div className="detail-bar">
        <span className="section-head">
          <span className="section-no num">03</span>
          详情
        </span>
        <button type="button" className="text-button" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="detail-body">
        <p className="detail-type">
          <span className="num">{number}</span>　{typeLabel}
        </p>
        <h2 className="detail-name" id="detail-name" tabIndex={-1} ref={headingRef}>
          {item.name}
        </h2>
        {item.description && <p className="detail-desc">{item.description}</p>}

        <dl className="detail-fields">
          <div>
            <dt>范围</dt>
            <dd>{show(item.scope)}</dd>
          </div>
          <div>
            <dt>领域</dt>
            <dd>{show(item.domains)}</dd>
          </div>
          <div>
            <dt>场景</dt>
            <dd>{show(item.scenarios)}</dd>
          </div>
          {Object.entries(item.detail).map(([name, value]) => (
            <div key={name} className={PRE_FIELDS.has(name) ? "is-wide" : undefined}>
              <dt>{name}</dt>
              <dd>
                {PRE_FIELDS.has(name) && !Array.isArray(value) && value ? (
                  <pre>{value}</pre>
                ) : (
                  show(value)
                )}
              </dd>
            </div>
          ))}
        </dl>

        {item.link && (
          <a className="detail-link" href={item.link} target="_blank" rel="noreferrer noopener">
            打开 {hostOf(item.link)}
          </a>
        )}
      </div>
    </aside>
  );
}
