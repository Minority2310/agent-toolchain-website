# 智能体工具链管理网站：实施计划（修订版）

## Context

做一个网站，汇总个人使用的智能体工具链：AGENTS.md 指南、Agent Skills、MCP 服务。
- 数据存放在飞书多维表格（Base），用 lark-cli 读写。
- 网站是部署在 Cloudflare Workers 上的纯静态站点（Workers Static Assets），运行时不调用任何 API。
- 同步方式：lark-cli 导出 → 生成 JSON → `vp build` → `wrangler deploy`。
- 页面采用国际主义平面设计风格，顶部切换栏在「AGENTS.md / Skills / MCP 服务」三个视图之间切换，每个视图按对应那张表自己的单选 / 多选字段筛选。
- 站点公开访问，全部记录都导出（用户已确认）。


## 一、多维表格结构（Base「智能体工具链」）

一共 3 张表，没有主表和 link 字段。

**初始字段**（建表脚本使用；建表之后字段由你在飞书里自由调整，三张表的字段不需要一致，网站按下面的规则适配）

| 字段 | 飞书字段 JSON 要点 | 选项 |
|---|---|---|
| 名称（首列） | `text` | — |
| 描述 | `text` | — |
| 范围 | `select`, `multiple:false` | 全局 / 项目 / 目录 |
| 领域 | `select`, `multiple:true` | 前端、后端、数据、DevOps、文档、设计、通用 |
| 场景 | `select`, `multiple:true` | 编码、调试、代码审查、测试、写作、调研、自动化 |
| 链接 | `text` + `style:{type:"url"}` | — |

另有各表的专有字段：指南表（文件路径、内容摘要）、技能表（来源仓库、安装路径、触发条件）、MCP 表（传输方式、启动命令或 URL、提供的工具、认证方式、配置示例）。

**网站对字段的约定**（详见 README「飞书表格与网站的约定」）
- 字段顺序取表的第一个视图；主字段（名称）是第一个字段；「描述」按字段名取。
- 所有单选 / 多选字段自动成为这个视图的筛选项和表格列；全部字段（含链接字段）都列在详情里，空值显示「—」。
- 支持文本、单选、多选和附件；附件在同步时下载到 `public/files/`，随站点一起发布（单个文件上限 10 MB）。其他类型被跳过并给出警告。

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
    sync.ts                # 读取飞书数据、写文件
    normalize.ts           # 纯函数：把一张表规整成页面数据
    normalize.test.ts
  src/
    data/toolchain.json    # 同步产物，提交入库
    types.ts
    lib/filter.ts          # 纯函数：按视图筛选、计数、URL 状态编解码
    lib/filter.test.ts
    components/            # Header, TypeTabs, FacetBar, ItemTable, ItemGrid, DetailPanel
    styles/swiss.css
    App.tsx, main.tsx
  index.html, vite.config.ts, tsconfig.json
```

目录不为空，所以 `vp create`（React + TS 模板）先在 `$TMPDIR` 里生成项目，再把生成的文件移到项目根目录，避免覆盖已有的 `AGENTS.md`。如果 `vp create` 支持在当前目录生成，并且不会覆盖已有文件，就直接在根目录生成。

## 三、同步脚本 `scripts/sync.ts`

用 `node scripts/sync.ts`（或 `vp run sync`）运行（Node 24 原生类型剥离）。lark-cli 通过 `execFile` 调用，参数用数组传入。读取和写文件在 `sync.ts`，规整逻辑是 `normalize.ts` 里的纯函数，方便测试。

1. 读取 `toolchain.config.json`。
2. 对每张表并发执行：`+field-list`（字段定义和选项，按偏移分页）、`+view-list` 加 `+view-get-visible-fields`（第一个视图的字段顺序）、`+record-list --format ndjson`（记录，`has_more` 为 true 时用 `--offset` 继续读）。
3. 每张表规整成一个视图 `Collection`：
   ```ts
   { type: 'guide'|'skill'|'mcp', label, facets: [{ name, options[] }],   // facets = 这张表的单选 / 多选字段
     items: [{ id, name, description, fields: [{ name, value }] }] }
   ```
4. 输出 `{ generatedAt, collections }` 到 `src/data/toolchain.json`；视图的显示名固定为 `AGENTS.md` / `Skills` / `MCP 服务`；条目按名称、ID 排序，保证输出稳定。
5. 校验：名称为空、单选的值不在选项里、筛选字段名是 URL 保留名、主字段不是文本，都报错。任何一步失败都以非零码退出，**先写临时文件再 rename**，不覆盖旧文件。不支持的字段类型跳过并打印警告。

注意：ndjson 每一行的单元格格式要先跑一次看实际输出再写解析代码，不要猜。已确认的格式：单选 / 多选是字符串数组；文本字段里的超链接导出成 `[文字](url)`（链接样式的字段和普通文本字段都可能出现）；附件是 `{ file_token, name, size }` 数组，用 `+record-download-attachment` 下载。

## 四、WebUI（国际主义平面设计风格）

**视觉**：12 栏网格，左对齐、右侧不齐；Helvetica Neue / Inter（用系统字体栈，不加载外部 CDN）；超大粗体标题配小号元信息；黑白加强调色 `#E30613`；用细线分隔区块，区块编号 01 / 02 / 03；不用圆角和阴影；数字用 `tabular-nums`。

**页面**
- 页头：站名、条目总数、同步时间，独占第一屏（`min-height: 100svh`，标题字号按宽高同时约束；竖屏时标题竖排两列）。导语和元信息放在标题右侧、与标题底边对齐（手机放在标题下方）；底部居中有向下箭头，点击平滑滚动到筛选区。第二屏（筛选 + 结果）至少一屏高。
- 筛选区：最上面是视图切换栏（`AGENTS.md` / `Skills` / `MCP 服务`，大号文字，选中的加红色下划线，标签后面是按当前搜索词算出的命中数，支持 ←/→ 切换）；下面一行是搜索框 + 当前视图的下拉（每个单选 / 多选字段一个，复选框多选），已选条件在下方列成可移除的标签。切换视图会清空筛选字段，保留搜索词。
  - 同一字段内是 OR，不同字段之间是 AND。
  - 下拉里每个选项显示「其他维度条件不变、只看本维度」时的命中数，命中为 0 的置灰。同一时间只展开一个下拉，点击外部或焦点移出时收起。
  - 另有关键词搜索（名称、描述）和「清除筛选」。
- 结果区：表格视图，列为 编号 / 名称 / 这张表的每个筛选字段各一列，可以切换成卡片网格视图；编号在每个视图内从 01 开始。
- 详情面板：在右侧展开，列出这张表的全部字段（名称、描述在标题下面），按飞书里的字段顺序，没有值的显示「—」；链接字段和其他字段一样列在里面，整段是网址的值可以点击，没有单独的按钮。「配置示例」「安装命令」用 `<pre>` 显示。

**交互**
- 筛选、搜索、视图、选中的条目都同步到 URL query，例如 `?type=mcp&领域=前端,数据&item=recxxx`（实际会被编码；`type` 是视图，缺省为 AGENTS.md，筛选参数名就是飞书字段名）。用 `history.replaceState` 更新 URL，打开或关闭详情面板用 `pushState`。
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
