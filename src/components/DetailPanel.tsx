import { useEffect, useRef } from "react";
import type { Field, Item } from "../types.ts";

/** 代码、命令类的字段用等宽字体原样显示 */
const PRE_FIELDS = new Set(["配置示例", "安装命令"]);

function text(field: Field): string {
  if ("files" in field) return field.files.map((file) => file.name).join("、");
  return (Array.isArray(field.value) ? field.value.join("、") : field.value).trim();
}

function isUrl(value: string): boolean {
  return /^https?:\/\//.test(value) && URL.canParse(value);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FieldValue({ field }: { field: Field }) {
  if ("files" in field && field.files.length > 0) {
    return (
      <ul className="detail-files">
        {field.files.map((file) => (
          <li key={file.path}>
            {/* 文件在同步时放进站点的 files/ 目录；BASE_URL 带有站点的路径前缀 */}
            <a href={`${import.meta.env.BASE_URL}${file.path}`} download={file.name}>
              {file.name}
            </a>
            <span className="num"> {formatSize(file.size)}</span>
          </li>
        ))}
      </ul>
    );
  }
  const value = text(field);
  if (value === "") return <span className="empty-value">—</span>;
  if (PRE_FIELDS.has(field.name)) return <pre>{value}</pre>;
  if (isUrl(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer noopener">
        {value}
      </a>
    );
  }
  return value;
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

        {/* 三张表的字段不同：列出这张表的全部字段，顺序和飞书里一致，没有值的显示「—」 */}
        <dl className="detail-fields">
          {item.fields.map((field) => (
            <div
              key={field.name}
              className={PRE_FIELDS.has(field.name) && text(field) !== "" ? "is-wide" : undefined}
            >
              <dt>{field.name}</dt>
              <dd>
                <FieldValue field={field} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
