import { goToPage } from "../lib/paging.ts";

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDate(iso: string): string {
  const parts = Object.fromEntries(
    dateFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

interface Props {
  total: number;
  generatedAt: string;
}

export function Header({ total, generatedAt }: Props) {
  return (
    <header className="masthead grid">
      <h1 className="masthead-title">
        智能体
        <br />
        工具链
      </h1>
      <div className="masthead-aside">
        <p className="masthead-lede">
          我日常使用的 AGENTS.md 指南、Agent Skills 与 MCP 服务，按类型、范围、领域和场景整理。
        </p>
        <dl className="masthead-meta">
          <div>
            <dt>条目</dt>
            <dd className="num masthead-count">{total}</dd>
          </div>
          <div>
            <dt>同步时间</dt>
            <dd className="num">
              <time dateTime={generatedAt}>{formatDate(generatedAt)}</time>
            </dd>
          </div>
        </dl>
      </div>
      <button
        type="button"
        className="masthead-next"
        aria-label="查看筛选与结果"
        onClick={() => goToPage(1)}
      >
        <svg viewBox="0 0 24 40" width="24" height="40" aria-hidden="true">
          <path d="M12 2v34M3 27l9 9 9-9" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </header>
  );
}
