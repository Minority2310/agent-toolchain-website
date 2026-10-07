# 智能体工具链

一个静态网站，汇总我日常使用的智能体工具链：AGENTS.md 指南、Agent Skills 和 MCP 服务。可以按「类型 / 范围 / 领域 / 场景」筛选。

- **数据**：存放在飞书多维表格「智能体工具链」里，有 3 张表，用 lark-cli 导出成 `src/data/toolchain.json`。这个文件要提交到仓库。
- **构建**：使用 [Vite+](https://viteplus.dev)（`vp`）+ React 19 + TypeScript。
- **运行**：部署成 Cloudflare Workers 静态资源（Workers Static Assets），挂在 `https://agent.minority2310.com/toolchain/` 下。运行时不调用任何 API。

```
飞书多维表格 ──lark-cli──▶ src/data/toolchain.json ──git push──▶ GitHub ──Workers Builds──▶ agent.minority2310.com/toolchain
             （本地同步）        （提交入库）                          （云端构建、部署）
```

> 站点是公开的。表格里只填名称、描述和用途，**不要写任何 env、API key、token**。

## 目录

| 路径                      | 说明                                                            |
| ------------------------- | --------------------------------------------------------------- |
| `src/`                    | 页面源码，入口是 `main.tsx` / `App.tsx`                         |
| `src/lib/filter.ts`       | 筛选、计数和 URL 状态，测试在 `filter.test.ts`                  |
| `src/lib/paging.ts`       | 两屏之间整页切换                                                |
| `src/data/toolchain.json` | 同步产物，要提交到仓库                                          |
| `scripts/sync.ts`         | 从飞书导出数据，生成上面的 JSON                                 |
| `scripts/setup-base.sh`   | 一次性创建多维表格和示例数据（已经执行过）                      |
| `toolchain.config.json`   | 多维表格的 `baseToken` 和 3 个 `table_id`，只是标识，不是密钥   |
| `vite.config.ts`          | 构建配置，`base` 和 `outDir` 决定了站点所在的路径 `/toolchain/` |
| `wrangler.jsonc`          | Workers 配置：只有静态资源（没有 Worker 脚本）和域名路由        |

## 开发环境

### 1. 准备工具

- **Node.js 24**：版本见 `.node-version`，`vite-plus` 要求 `^22.18 || ^24.11`。
- **vp（Vite+ CLI）**：安装方式见 <https://viteplus.dev>。包管理器由 vp 管理，`package.json` 的 `devEngines` 里固定为 pnpm 12.8.1，不需要另外安装。
- **lark-cli**：只有同步数据时才需要。

### 2. 安装依赖并启动

```bash
vp install
```

```bash
vp dev
```

站点的路径前缀是 `/toolchain/`，所以开发和预览时要打开带这个前缀的地址，例如 `http://localhost:5173/toolchain/`，端口以终端里的输出为准。

### 3. 提交前检查

格式化、lint 和类型检查：

```bash
vp check
```

单元测试：

```bash
vp test
```

本地预览生产构建：

```bash
vp build && vp preview
```

### 4. 同步飞书数据

第一次使用时，先完成 lark-cli 的配置和授权（都要在浏览器里确认）：

```bash
lark-cli config init --new
```

```bash
lark-cli auth login --domain base
```

之后每次在飞书里改了数据，执行：

```bash
vp run sync
```

脚本会读取 `toolchain.config.json`，导出 3 张表，再校验并写入 `src/data/toolchain.json`。校验规则是：名称不能为空，单选和多选的值必须在选项里。任何一步失败都会以非零状态退出，旧文件保持不变。连续执行两次，除了 `generatedAt` 之外输出完全相同。

同步完成后检查改动并提交：

```bash
git add src/data/toolchain.json && git commit -m "同步工具链数据"
```

## 生产环境：Cloudflare Workers Builds（从 GitHub 拉取部署）

生产环境默认的部署方式是：把仓库连接到 Cloudflare Workers，每次推送到 `main` 分支，Cloudflare 都会自动拉取代码、构建并部署。

Cloudflare 的构建环境里没有飞书授权，所以**云端只构建，不同步数据**。数据要先在本地用 `vp run sync` 同步并提交，见上一节。

### 1. 推送到 GitHub

```bash
git init && git add . && git commit -m "初始化"
```

```bash
git remote add origin git@github.com:<你的账号>/agent-toolchain-website.git && git push -u origin main
```

### 2. 在 Cloudflare 连接仓库

1. 打开 Cloudflare 控制台的 **Workers & Pages**，选择 **Create application**，再选 **Import a repository**。
2. 授权 GitHub，然后选择这个仓库。
3. 按下表填写构建设置，然后选择 **Save and Deploy**。

| 设置项         | 值                          | 说明                                                                                                          |
| -------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Project name   | `agent-toolchain`           | **必须**和 `wrangler.jsonc` 里的 `name` 一致，否则构建会失败                                                  |
| Git branch     | `main`                      | 推送到这个分支时部署到生产环境                                                                                |
| Build command  | `pnpm run build`            | 执行 `vp build`，输出到 `dist/toolchain/`                                                                     |
| Deploy command | `pnpm exec wrangler deploy` | **不能用**默认的 `npx wrangler deploy`：`package.json` 的 `devEngines` 限定了 pnpm，npm 会报 `EBADDEVENGINES` |
| Root directory | 留空                        | 项目就在仓库根目录                                                                                            |

**构建变量**（Settings → Build → Build variables and secrets）：

| 变量           | 值       | 原因                                                       |
| -------------- | -------- | ---------------------------------------------------------- |
| `PNPM_VERSION` | `12.8.1` | 构建镜像默认用的是 pnpm 10，要和本地 `devEngines` 保持一致 |

Node.js 版本由仓库里的 `.node-version`（`24`）决定，不需要另外设置。部署用的 API token 由 Workers Builds 自动创建。

### 3. 绑定域名和路径

站点挂在 `agent.minority2310.com/toolchain` 下，用的是 Workers 的**路由（Routes）**，不是自定义域（Custom Domains）：自定义域会占用整个主机名，而路由可以只接管一个路径，主机名下的其他路径仍然可以留给别的服务。

路由写在 `wrangler.jsonc` 里，每次部署都会自动创建，不需要在控制台手动添加：

```jsonc
"routes": [
  { "pattern": "agent.minority2310.com/toolchain", "zone_name": "minority2310.com" },
  { "pattern": "agent.minority2310.com/toolchain/*", "zone_name": "minority2310.com" }
]
```

两条规则都要有：只写 `/toolchain/*` 的话，访问不带斜杠的 `/toolchain` 不会进入 Worker；写成 `/toolchain*` 又会误匹配 `/toolchain2` 这类路径。

部署前要满足两个前提：

- `minority2310.com` 已经托管在这个 Cloudflare 账号里。
- `agent.minority2310.com` 有一条**已开启代理（橙色云朵）**的 DNS 记录。如果这个子域名没有别的服务，可以添加一条指向占位地址的 A 记录，例如 `192.0.2.1`，请求会在 Cloudflare 这一层就被 Worker 接走，不会到达这个地址。

**路径前缀怎么生效的**：Workers 静态资源是按请求路径去目录里找文件的，不会去掉路径前缀。所以构建时 `vite.config.ts` 里设了 `base: "/toolchain/"`，页面引用的 JS、CSS 和图标都带这个前缀；同时 `outDir` 设成 `dist/toolchain`，让 `/toolchain/...` 的请求直接对应到文件。以后要改路径，这两处和 `wrangler.jsonc` 的路由三个地方一起改。

### 4. 验证部署

部署完成后访问 `https://agent.minority2310.com/toolchain/`（`*.workers.dev` 地址上的 `/toolchain/` 也可以用），检查以下几项：

- `/toolchain`（不带斜杠）会跳转到 `/toolchain/`。
- 带参数的链接可以直接打开，例如 `/toolchain/?type=mcp&domain=前端`。
- `?item=<记录 ID>` 能直接打开详情面板。
- 未知路径（例如 `/toolchain/foo/bar`）和根路径 `/` 返回 404。站点没有前端路由，只用查询参数，所以不需要兜底到首页。

之后日常更新数据的流程是：

```bash
vp run sync && git add src/data/toolchain.json && git commit -m "同步工具链数据" && git push
```

非 `main` 分支的推送会生成预览版本，可以在 **Settings → Builds** 里关闭。

### 备用方式：从本地直接部署

不想经过 GitHub 的时候，也可以从本机直接发布。先登录一次 Cloudflare：

```bash
vp exec wrangler login
```

```bash
vp run deploy
```

`deploy` 脚本只做构建和发布（`vp build && wrangler deploy`），不同步数据，需要的话先执行 `vp run sync`。

## 常见问题

- **访问 `agent.minority2310.com/toolchain/` 超时或报 `ERR_NAME_NOT_RESOLVED`**：这个子域名没有 DNS 记录，或者记录没有开启代理，见「绑定域名和路径」。
- **页面空白、控制台里 JS 和 CSS 返回 404**：`base` 和 `outDir` 没有同时对应 `/toolchain/`，检查 `vite.config.ts`。
- **部署报路由所在的 zone 找不到**：`wrangler.jsonc` 里的 `zone_name` 必须是这个账号下已有的域名 `minority2310.com`，部署用的 API token 也要有这个域名的 Workers Routes 编辑权限。
- **构建报 Worker 名称不匹配**：Cloudflare 里的 Worker 名称必须和 `wrangler.jsonc` 的 `name`（`agent-toolchain`）一致。
- **构建时 pnpm 版本不对或者安装失败**：检查是否设置了构建变量 `PNPM_VERSION=12.8.1`。
- **部署步骤报 `EBADDEVENGINES`**：部署命令还是默认的 `npx wrangler deploy`，改成 `pnpm exec wrangler deploy`。
- **`vp run sync` 报权限错误**：重新执行 `lark-cli auth login --domain base`，确认当前账号对多维表格有读取权限。
- **同步报「值不在选项中」**：飞书里某条记录用了表格没有定义的选项。先在飞书里补上这个选项或修正记录，再重新同步。
- **`scripts/setup-base.sh` 中途失败**：这个脚本不是幂等的，直接重跑会再建一个新的多维表格。应该先删掉已经建好的部分，或者手动补完剩下的步骤，最后把 token 写回 `toolchain.config.json`。
