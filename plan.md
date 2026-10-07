# 智能体工具链管理网站：实施计划（修订版）

## Context

做一个网站，汇总个人使用的智能体工具链：AGENTS.md 指南、Agent Skills、MCP 服务。
- 数据存放在飞书多维表格（Base），用 lark-cli 读写。
- 网站是部署在 Cloudflare Workers 上的纯静态站点（Workers Static Assets），运行时不调用任何 API。
- 同步方式：lark-cli 导出 → 生成 JSON → `vp build` → `wrangler deploy`。
- 页面采用国际主义平面设计风格，支持按「类型 / 范围 / 领域 / 场景」筛选。
- 站点公开访问，全部记录都导出（用户已确认）。


## 一、多维表格结构（Base「智能体工具链」）

一共 3 张表，没有主表和 link 字段。

**三张表都有的字段**

| 字段 | 飞书字段 JSON 要点 | 选项 |
|---|---|---|
| 名称（首列） | `text` | — |
| 描述 | `text` | — |
| 范围 | `select`, `multiple:false` | 全局 / 项目 / 目录 |
| 领域 | `select`, `multiple:true` | 前端、后端、数据、DevOps、文档、设计、通用 |
| 场景 | `select`, `multiple:true` | 编码、调试、代码审查、测试、写作、调研、自动化 |
| 链接 | `text` + `style:{type:"url"}` | — |

**各表的专有字段**（都是 `text`，另有说明的除外）
- **智能体指南收集表**：文件路径、内容摘要
- **智能体技能收集表**：来源仓库、安装路径、触发条件
- **智能体 MCP 服务收集表**：传输方式（单选：stdio / Streamable HTTP / SSE）、启动命令或 URL、提供的工具、认证方式（单选：无 / API Key / OAuth）、配置示例

**建表脚本 `scripts/setup-base.sh`**（一次性执行，所有命令都带 `--as user`，按顺序串行执行）
1. `lark-cli base +base-create --name 智能体工具链 --time-zone Asia/Shanghai --table-name 智能体指南收集表 --fields '<json>'`
2. `+table-create --fields` 建技能表、MCP 表
3. 每张表执行一次 `+record-batch-create --json @file.json` 写入示例数据。单元格写法：select 写成 `["选项"]`，url 写裸 URL
4. 把 base_token 和 3 个 table_id 写入 `toolchain.config.json`（`{ baseToken, tables: { guide, skill, mcp } }`）。这些是标识，不是密钥
- 执行前先加 `--dry-run` 跑一遍，检查请求内容

**示例数据**：从本机配置中挑几条真实条目，例如 MCP 选 context7、jina、chrome-devtools；Skills 选 lark-base、frontend-design；指南选 `~/.claude/CLAUDE.md`。只写名称、描述、用途，**不复制任何 env、API key、token**（站点是公开的）。

## 二、项目结构

```
agent-toolchain-website/
  AGENTS.md, plan.md       # 已有，保留
  package.json             # scripts: sync / deploy
  wrangler.jsonc           # 只配置 assets，没有 worker 脚本
  toolchain.config.json
  scripts/
    setup-base.sh
    sync.ts
  src/
    data/toolchain.json    # 同步产物，提交入库
    types.ts
    lib/filter.ts          # 纯函数：分面筛选、计数、URL 状态编解码
    lib/filter.test.ts
    components/            # Header, FacetBar, ItemTable, ItemGrid, DetailPanel
    styles/swiss.css
    App.tsx, main.tsx
  index.html, vite.config.ts, tsconfig.json
```

目录不为空，所以 `vp create`（React + TS 模板）先在 `$TMPDIR` 里生成项目，再把生成的文件移到项目根目录，避免覆盖已有的 `AGENTS.md`。如果 `vp create` 支持在当前目录生成，并且不会覆盖已有文件，就直接在根目录生成。

## 三、同步脚本 `scripts/sync.ts`

用 `vp node scripts/sync.ts` 运行（Node 24 原生类型剥离）。lark-cli 通过 `execFile` 调用，参数用数组传入。

1. 读取 `toolchain.config.json`。
2. 对 3 张表执行 `+field-list`（可以并发），取出 select 字段的选项定义，作为分面选项的顺序和全集。
3. 对 3 张表执行 `+record-list --format ndjson --output $TMPDIR/<table>.ndjson --overwrite`（可以并发）。读取 manifest 里的 `has_more`：如果为 true，用 `--offset` 继续读，直到读完。
4. 把每条记录规整为下面的结构，`type` 由来源表决定：
   ```ts
   { id, type: 'guide'|'skill'|'mcp', name, description, scope, domains[], scenarios[], link,
     detail: Record<string, string | string[]> }  // 该表的专有字段，key 用字段名
   ```
5. 输出 `{ generatedAt, facets: { type, scope, domain, scenario }, items }` 到 `src/data/toolchain.json`。items 按 类型 → 名称 排序，保证输出稳定。类型的显示名固定为 `智能体指南(AGENTS.md)` / `技能(Agent Skills)` / `MCP 服务`。
6. 校验：名称为空就报错；select 的值不在选项全集里就报错。任何一步失败都以非零码退出，**先写临时文件再 rename**，不覆盖旧文件。

注意：ndjson 每一行的单元格格式（select、url 具体长什么样）要等配置好之后先跑一次 `--limit 5` 看实际输出，再写解析代码，不要猜。

## 四、WebUI（国际主义平面设计风格）

**视觉**：12 栏网格，左对齐、右侧不齐；Helvetica Neue / Inter（用系统字体栈，不加载外部 CDN）；超大粗体标题配小号元信息；黑白加强调色 `#E30613`；用细线分隔区块，区块编号 01 / 02 / 03；不用圆角和阴影；数字用 `tabular-nums`。

**页面**
- 页头：站名、条目总数、同步时间，独占第一屏（`min-height: 100svh`，标题字号按宽高同时约束；竖屏时标题竖排两列）。导语和元信息放在标题右侧、与标题底边对齐（手机放在标题下方）；底部居中有向下箭头，点击平滑滚动到筛选区。第二屏（筛选 + 结果）至少一屏高。
- 筛选区：一行搜索框 +「类型 / 范围 / 领域 / 场景」四个下拉（复选框多选），已选条件在下方列成可移除的标签。
  - 同一维度内是 OR，不同维度之间是 AND。
  - 下拉里每个选项显示「其他维度条件不变、只看本维度」时的命中数，命中为 0 的置灰。同一时间只展开一个下拉，点击外部或焦点移出时收起。
  - 另有关键词搜索（名称、描述）和「清除筛选」。
- 结果区：表格视图，列为 编号 / 名称 / 类型 / 范围 / 领域 / 场景，可以切换成卡片网格视图。
- 详情面板：在右侧展开，按类型显示专有字段和外部链接。「配置示例」用 `<pre>` 显示。

**交互**
- 筛选、搜索、视图、选中的条目都同步到 URL query，例如 `?type=MCP 服务&domain=前端,数据&item=recxxx`（实际会被编码）。用 `history.replaceState` 更新 URL，打开或关闭详情面板用 `pushState`。
- 两页式滚动（`src/lib/paging.ts`）：第一屏和第二屏之间整页切换，不会停在两屏之间。第二屏内部正常滚动；向上滚到第二屏顶部会停住，需要新的一次向上手势才回到第一屏。滚轮、触控板惯性、键盘（方向键 / PageUp / PageDown / 空格）、触摸滑动都按这个规则处理；详情面板内的滚动不翻页。
- 按 Esc 先收起下拉，再按一次关闭详情面板。
- 主区域按容器宽度（`@container`）切换布局，详情面板打开时同样生效；移动端四个下拉四等分一行，面板与工具栏同宽，详情面板全屏显示。

## 五、部署

站点挂在子域名的路径下：`vite.config.ts` 设 `base: "/toolchain/"` 和 `build.outDir: "dist/toolchain"`（Workers 静态资源按请求路径找文件，不会去掉路径前缀）。

`wrangler.jsonc`：
```jsonc
{ "name": "agent-toolchain", "compatibility_date": "2026-10-01",
  "routes": [
    { "pattern": "agent.minority2310.com/toolchain", "zone_name": "minority2310.com" },
    { "pattern": "agent.minority2310.com/toolchain/*", "zone_name": "minority2310.com" } ],
  "assets": { "directory": "./dist" } }
```

package.json 脚本：
- `sync`：`vp node scripts/sync.ts`
- `deploy`：`vp run sync && vp build && wrangler deploy`

日常同步只需执行 `vp run deploy`。

**以后可选（这次不做）**：用 GitHub Actions 定时触发或 `workflow_dispatch` 手动触发；也可以由飞书自动化流程通过 repository_dispatch 触发。CI 里 lark-cli 改用 bot 身份，App ID 和 App Secret 存为 Secrets，并把 Base 授权给这个应用；wrangler 用 `CLOUDFLARE_API_TOKEN`。

## 六、需要用户操作的前置步骤

1. `lark-cli config init --new`，然后执行 `lark-cli auth login --domain base`。这两步要在浏览器里完成授权；我可以用 `--no-wait --json` 拿到授权链接发给你。
2. `vp exec wrangler login`（部署前执行）。
3. 网络访问需要 open.feishu.cn、registry.npmjs.org、api.cloudflare.com。如果本地预览时绑定端口报 EPERM，需要开启 `sandbox.network.allowLocalBinding`。

## 七、验证

1. `lark-cli base +table-list` 和 `+field-list`：确认 3 张表的字段和选项都建好了。
2. `vp run sync`：JSON 里的条目数等于 3 张表的记录数之和；facets 和飞书里的选项一致；再跑一次，除 `generatedAt` 外输出没有变化。
3. 用 `vp test` 跑 `lib/filter.test.ts`，覆盖维度内 OR / 维度间 AND、分面计数、URL 编解码往返（包括中文和空格）。最后跑 `vp check`。
4. 执行 `vp build && vp preview`，用 chrome-devtools MCP 打开页面并截图，逐项检查：组合筛选、URL 同步（刷新后状态还在）、`?item=` 能直接打开详情、Esc 能关闭面板、390px 移动端视口。
5. `vp run deploy` 后访问 `https://agent.minority2310.com/toolchain/`，确认带 query 的链接能打开，`/toolchain` 会跳转到 `/toolchain/`，未知路径返回 404。
