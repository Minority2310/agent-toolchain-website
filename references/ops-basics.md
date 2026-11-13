# 运维基础：速查、硬性规则、状态自检

**任何运维任务开始前先读这一份**，再读对应任务的文档。命令都在仓库根目录执行。

## 项目速查

| 项目         | 值                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------- |
| 线上地址     | <https://agent.minority2310.com/toolchain/>                                                 |
| 代码仓库     | <https://github.com/Minority2310/agent-toolchain-website>（`main` 即生产）                  |
| 数据源       | 飞书多维表格「智能体工具链」<https://my.feishu.cn/base/SMEGbXByaapAZCs6gbLc7tSRnPg>，3 张表 |
| 部署         | Cloudflare Workers Builds，Worker 名称 `agent-toolchain-website`                            |
| 构建检查名称 | GitHub 提交上的 `Workers Builds: agent-toolchain-website`                                   |
| 工具链       | Node 24、`vp`（Vite+）、pnpm 12.8.1（由 vp 管理）、`lark-cli`、`gh`、`ego-browser`          |

数据流向：飞书多维表格 → `lark-cli` 本地同步 → `src/data/toolchain.json` 和 `public/files/` → `git push` → GitHub → Cloudflare 构建并部署。**云端构建不访问飞书**，所以数据必须先在本地同步并提交。

## 硬性规则

1. **站点是公开的。** 同步之前和提交之前，都要确认没有密钥、令牌、密码、内部备注、本机路径。附件会作为静态文件公开，任何人知道网址都能下载。
2. **推送到 `main` 就是上线。** 用户没有明确要求推送时，只提交，然后停下来确认。推送前 `vp check`、`vp test`、`vp build` 必须全部通过。
3. **不强制推送，不改写已推送的历史。** 推送前先 `git fetch origin main`，远程有新提交就 `git pull --rebase origin main`，再重新检查。
4. **`src/data/toolchain.json` 和 `public/files/` 是同步产物，不要手改。** 要改数据，去飞书里改，再同步。
5. **数据提交和代码提交分开。** 提交时按路径 `git add`，不要 `git add -A`。提交信息用中文，数据同步的标题写成「同步工具链数据：一句话概括变化」，正文列出具体变化。
6. **用 `vp`，不要直接用 `npm` / `npx`。** `package.json` 的 `devEngines` 限定了 pnpm，npm 会报 `EBADDEVENGINES`。
7. **飞书授权必须由用户在浏览器里完成**，智能体不能代替。流程见 [feishu-auth.md](feishu-auth.md)。
8. **不要重跑 `scripts/setup-base.sh`。** 它只用于一次性建表，不是幂等的，重跑会再建一个新的多维表格。
9. 浏览器操作用 `ego-browser`；临时文件放 `/tmp` 或被 git 忽略的 `.wrangler/`，用完删除。

## 状态自检

开始任何任务前先跑一遍，约 10 秒：

```bash
git status -sb
git fetch origin main && git log --oneline -1 origin/main
lark-cli auth status | jq -c '.identities.user | {status, tokenStatus, refreshExpiresAt}'
gh api repos/Minority2310/agent-toolchain-website/commits/$(git rev-parse origin/main)/check-runs --jq '.check_runs[0] | {status, conclusion}'
curl -s -o /dev/null -w "%{http_code}\n" https://agent.minority2310.com/toolchain/
```

| 命令                   | 正常                                                  | 异常时                                                                             |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `git status -sb`       | `## main...origin/main`，没有未提交的文件             | 有未提交的文件先问清楚是谁改的；显示 `behind` 就先 `git pull --rebase origin main` |
| `lark-cli auth status` | `status` 是 `ready`，或 `needs_refresh`（会自动续期） | 是 `missing` 或 `tokenStatus` 是 `expired`：见 [feishu-auth.md](feishu-auth.md)    |
| `gh api …check-runs`   | `completed` 且 `success`                              | `failure`：见 [deploy-troubleshooting.md](deploy-troubleshooting.md)               |
| `curl`                 | `200`                                                 | 非 200：见 [deploy-troubleshooting.md](deploy-troubleshooting.md)                  |

## 相关文档

- 同步飞书数据并发布：[sync-and-publish.md](sync-and-publish.md)
- 改页面代码或文案：[code-change.md](code-change.md)
- 飞书授权过期：[feishu-auth.md](feishu-auth.md)
- 推送后网站没更新、构建失败：[deploy-troubleshooting.md](deploy-troubleshooting.md)
- 回滚：[rollback.md](rollback.md)
- 改路径或域名、新增第四张表：[advanced-changes.md](advanced-changes.md)
- 飞书表格与网站的字段约定：[feishu-conventions.md](feishu-conventions.md)
- 报错速查：[error-lookup.md](error-lookup.md)
- 首次搭建、重建 Cloudflare：[first-time-setup.md](first-time-setup.md)
