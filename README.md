# 智能体工具链

常用 AGENTS.md 指南、Agent Skills 与 MCP 服务。按类型分开整理，可以逐项筛选。

线上地址：<https://agent.minority2310.com/toolchain/>

这是一个静态网站。页面顶部的切换栏可以在「AGENTS.md」「Skills」「MCP 服务」三个视图之间切换，每个视图的表格列和筛选项都取自对应那张飞书表自己的字段，三张表的字段不需要一致。

- **数据**：存放在飞书多维表格「智能体工具链」里，用 `lark-cli` 导出成 `src/data/toolchain.json`（附件下载到 `public/files/`），两者都要提交到仓库。
- **构建**：[Vite+](https://viteplus.dev)（`vp`）+ React 19 + TypeScript。
- **部署**：Cloudflare Workers 静态资源（Workers Static Assets），推送到 `main` 后由 Cloudflare 自动构建并部署。运行时不调用任何 API。

```
飞书多维表格 ──lark-cli──▶ src/data/toolchain.json ──git push──▶ GitHub ──Workers Builds──▶ agent.minority2310.com/toolchain
             （本地同步）    public/files/（附件）                          （云端构建、部署，不访问飞书）
```

> 站点是**公开**的：飞书里所有字段和附件都会公开发布，不要往表格里写密钥、令牌或内部备注。

## 本地开发

需要 Node 24（见 `.node-version`）和 `vp`（安装方式见 <https://viteplus.dev>，包管理器由 vp 管理）。

```bash
git clone https://github.com/Minority2310/agent-toolchain-website.git && cd agent-toolchain-website
vp install
vp dev
```

站点挂在 `/toolchain/` 路径下，本地要打开带这个前缀的地址，例如 `http://localhost:5173/toolchain/`（端口以终端输出为准）。

| 命令          | 作用                                         |
| ------------- | -------------------------------------------- |
| `vp check`    | 格式化、lint 和类型检查                      |
| `vp test`     | 单元测试                                     |
| `vp build`    | 生产构建，输出到 `dist/toolchain/`           |
| `vp preview`  | 预览生产构建                                 |
| `vp run sync` | 从飞书同步数据（需要 `lark-cli` 并完成授权） |

## 目录

| 路径                      | 说明                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `src/`                    | 页面源码，入口是 `main.tsx` / `App.tsx`                       |
| `src/lib/filter.ts`       | 按视图筛选、计数和 URL 状态                                   |
| `src/lib/paging.ts`       | 两屏之间整页切换                                              |
| `src/data/toolchain.json` | **同步产物**，要提交到仓库，不要手改                          |
| `public/files/`           | **同步产物**（附件），要提交到仓库，不要手改                  |
| `scripts/sync.ts`         | 从飞书读取数据，生成上面的 JSON 并下载附件                    |
| `scripts/normalize.ts`    | 把一张飞书表规整成页面用的数据                                |
| `scripts/setup-base.sh`   | 一次性建表脚本，已执行过，不要重跑                            |
| `toolchain.config.json`   | 多维表格的 `baseToken` 和 3 个 `table_id`，只是标识，不是密钥 |
| `vite.config.ts`          | 构建配置，`base` 和 `outDir` 决定站点所在的路径 `/toolchain/` |
| `wrangler.jsonc`          | Workers 配置：只有静态资源（没有 Worker 脚本）和域名路由      |
| `references/`             | 运维文档，见下                                                |

## 运维文档

日常运维（同步飞书数据、发布、排查、回滚等）的操作步骤在 [`references/`](references/) 目录里，每个任务一份文档：

- [ops-basics.md](references/ops-basics.md)：项目速查、硬性规则、状态自检，**运维前先读这份**
- [sync-and-publish.md](references/sync-and-publish.md)：同步飞书数据并发布
- [code-change.md](references/code-change.md)：修改页面代码或文案并发布
- [feishu-auth.md](references/feishu-auth.md)：飞书授权过期
- [deploy-troubleshooting.md](references/deploy-troubleshooting.md)：构建没触发、构建失败、线上没变
- [rollback.md](references/rollback.md)：回滚
- [advanced-changes.md](references/advanced-changes.md)：改路径或域名、新增第四张表
- [feishu-conventions.md](references/feishu-conventions.md)：飞书表格与网站的字段约定
- [error-lookup.md](references/error-lookup.md)：报错速查
- [first-time-setup.md](references/first-time-setup.md)：首次搭建、重建 Cloudflare

智能体的工作约定写在 [AGENTS.md](AGENTS.md) 里。
