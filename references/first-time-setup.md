# 首次搭建与重建（已完成，仅在重建时需要）

## 本地环境

```bash
git clone https://github.com/Minority2310/agent-toolchain-website.git && cd agent-toolchain-website && vp install
```

需要 Node 24、`vp`（安装方式见 <https://viteplus.dev>，包管理器由 vp 管理，不需要另外装 pnpm）。同步数据还需要 `lark-cli`，首次使用见 [feishu-auth.md](feishu-auth.md)。仓库的远程地址用 HTTPS（没有配置 SSH 密钥的机器上，SSH 地址会报 `Permission denied (publickey)`）。

## Cloudflare 连接仓库

在 Cloudflare 控制台的 **Workers & Pages** → **Create application** → **Import a repository**，授权 GitHub 并选择这个仓库，按下表填写：

| 设置项         | 值                          | 说明                                                          |
| -------------- | --------------------------- | ------------------------------------------------------------- |
| Project name   | `agent-toolchain-website`   | **必须**和 `wrangler.jsonc` 里的 `name` 一致，否则构建失败    |
| Git branch     | `main`                      | 推送到这个分支时部署到生产环境                                |
| Build command  | `pnpm run build`            | 执行 `vp build`，输出到 `dist/toolchain/`                     |
| Deploy command | `pnpm exec wrangler deploy` | **不能用**默认的 `npx wrangler deploy`，会报 `EBADDEVENGINES` |
| Root directory | 留空                        | 项目就在仓库根目录                                            |

构建变量（Settings → Build → Build variables and secrets）：`PNPM_VERSION` = `12.8.1`。构建镜像默认是 pnpm 10，要和本地 `devEngines` 保持一致。Node 版本由 `.node-version` 决定，部署用的 API token 由 Workers Builds 自动创建。非 `main` 分支的推送会生成预览版本，可以在 Settings → Builds 里关闭。

## 域名和路径

站点挂在 `agent.minority2310.com/toolchain` 下，用的是 Workers 的**路由（Routes）**，不是自定义域：自定义域会占用整个主机名，路由只接管一个路径。路由写在 `wrangler.jsonc` 里，每次部署自动创建：

```jsonc
"routes": [
  { "pattern": "agent.minority2310.com/toolchain", "zone_name": "minority2310.com" },
  { "pattern": "agent.minority2310.com/toolchain/*", "zone_name": "minority2310.com" }
]
```

两条都要有：只写 `/toolchain/*`，不带斜杠的 `/toolchain` 进不了 Worker；写成 `/toolchain*` 又会误匹配 `/toolchain2`。Workers 静态资源按请求路径找文件，不会去掉路径前缀，所以 `vite.config.ts` 里要设 `base: "/toolchain/"` 和 `outDir: "dist/toolchain"`（见 [advanced-changes.md](advanced-changes.md)）。

部署前要满足：`minority2310.com` 托管在这个 Cloudflare 账号里；`agent.minority2310.com` 有一条已开启代理的 DNS 记录（没有别的服务时，可以加一条指向占位地址 `192.0.2.1` 的 A 记录，请求在 Cloudflare 这一层就会被 Worker 接走）。

## 部署后的检查

- `/toolchain` 跳转到 `/toolchain/`（307）。
- `/toolchain/?type=mcp&领域=前端` 返回 200。
- `?item=<记录 ID>` 直接打开详情面板。
- 未知路径（`/toolchain/foo/bar`）和根路径 `/` 返回 404：站点没有前端路由，只用查询参数。

## 备用方式：从本机直接部署

不经过 GitHub 时，先登录 Cloudflare，再发布：

```bash
vp exec wrangler login
```

```bash
vp run deploy
```

`deploy` 只做构建和发布（`vp build && wrangler deploy`），**不同步数据**，需要的话先 `vp run sync`。

## 不要重跑建表脚本

`scripts/setup-base.sh` 只用于一次性建表，已经执行过。它不是幂等的，重跑会再建一个新的多维表格。如果当年中途失败，应该先删掉已经建好的部分，或手动补完剩下的步骤，最后把 token 写回 `toolchain.config.json`。
