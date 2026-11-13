# 推送后网站没更新：构建没触发、构建失败、线上没变

开始前先读 [ops-basics.md](ops-basics.md)。先判断是「没触发」还是「触发了但失败」：

```bash
gh api repos/Minority2310/agent-toolchain-website/commits/$(git rev-parse HEAD)/check-runs --jq '.total_count, (.check_runs[0] | "\(.status) \(.conclusion)")'
```

## 一、没触发（输出 `0` 和 `null null`，等 60 秒后仍然如此）

说明 Cloudflare 没有收到这次推送，问题在 Cloudflare 和 GitHub 的连接上，**不在仓库里**。这些要用户在控制台里确认，智能体看不到：

1. Cloudflare 的 Worker → Settings → Builds：Git 存储库显示 `Minority2310/agent-toolchain-website`，生产分支是 `main`，「Disable builds」是关闭的，构建命令和部署命令对得上（见 [first-time-setup.md](first-time-setup.md)）。
2. GitHub 的 <https://github.com/settings/installations> → Cloudflare Workers and Pages → Configure：对这个仓库有访问权限，没有被暂停。
3. 仍然不行：在 Settings → Builds 里断开再重新连接；还不行就删除 Worker，按 [first-time-setup.md](first-time-setup.md) 重建（构建变量要重新设置）。

重新连接后，推一个空提交验证（推送前遵守硬性规则）：

```bash
git commit --allow-empty -m "触发 Cloudflare 构建" && git push origin main
```

## 二、触发了但失败（`completed failure`）

1. 本地先复现，多数构建问题在这里就能暴露：

```bash
vp build && vp exec wrangler deploy --dry-run
```

预期以 `Total Upload: …` 结尾，没有 `ERROR`。

2. 本地正常，说明是云端设置问题。构建日志在 Cloudflare 控制台里，入口是检查里的链接，这个链接需要登录，智能体读不到，**请用户把日志贴出来**：

```bash
gh api repos/Minority2310/agent-toolchain-website/commits/$(git rev-parse HEAD)/check-runs --jq '.check_runs[0].details_url'
```

3. 对照 [error-lookup.md](error-lookup.md)。

## 三、构建成功但线上没变

- 缓存：加一个无关的查询参数访问，或者看 `.masthead-meta time` 的同步时间是不是新的。
- 数据没提交：`git show --stat HEAD` 里应该有 `src/data/toolchain.json`；附件缺失通常是漏了 `public/files`，补提交即可。

## 四、线上访问异常

- 超时或 `ERR_NAME_NOT_RESOLVED`：子域名没有 DNS 记录，或没有开启代理，见 [first-time-setup.md](first-time-setup.md) 的「域名和路径」。
- 页面空白、JS 和 CSS 返回 404：`base` 和 `outDir` 没有同时对应 `/toolchain/`，见 [advanced-changes.md](advanced-changes.md)。

出了问题要撤回已上线的内容，见 [rollback.md](rollback.md)。
