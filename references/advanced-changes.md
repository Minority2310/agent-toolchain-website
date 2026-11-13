# 不常见的变更：改路径或域名、新增第四张表

开始前先读 [ops-basics.md](ops-basics.md)。

## 在飞书里新增、改名、删除字段或选项

**不需要改代码**，按 [sync-and-publish.md](sync-and-publish.md) 同步即可。规则见 [feishu-conventions.md](feishu-conventions.md)。

## 改站点路径或域名

路径 `/toolchain/` 同时写在三处，**必须一起改**，否则页面空白（资源 404）：

| 位置                               | 内容                                             |
| ---------------------------------- | ------------------------------------------------ |
| `vite.config.ts` 的 `base`         | 页面引用资源时带的前缀，`/toolchain/`            |
| `vite.config.ts` 的 `build.outDir` | 构建产物目录，`dist/toolchain`                   |
| `wrangler.jsonc` 的 `routes`       | 两条：`<域名>/toolchain` 和 `<域名>/toolchain/*` |

改域名还要保证：域名托管在这个 Cloudflare 账号里；子域名有一条**已开启代理（橙色云朵）**的 DNS 记录（见 [first-time-setup.md](first-time-setup.md)）。

改完先本地验证，再更新 `index.html`、README 和这套文档里的地址：

```bash
vp build && vp exec wrangler deploy --dry-run
```

## 新增第四张飞书表（第四个视图）

在飞书里手动建表，**不要用 `scripts/setup-base.sh`**。然后改 3 处，其余代码按视图数据自动适配：

1. `src/types.ts` 的 `ItemType`：加上新类型。
2. `scripts/sync.ts` 的 `TYPES` 和 `TYPE_LABELS`：加上类型和显示名。
3. `toolchain.config.json` 的 `tables`：加上新表的 `table_id`。

新视图默认不是首选；要让它成为打开页面时的默认视图，改 `src/lib/filter.ts` 的 `DEFAULT_TYPE`。改完跑 `vp run sync` 和 `vp test`，并更新 [feishu-conventions.md](feishu-conventions.md) 里「三张表」的说法。
