# 修改页面代码或文案并发布

**触发**：改样式、交互、文案、组件，不涉及飞书数据。**不需要同步**。

开始前先读 [ops-basics.md](ops-basics.md)。

## 步骤

1. 跑 [ops-basics.md](ops-basics.md) 里的「状态自检」。改代码。
2. `vp check && vp test && vp build`。只有 `vp check` 报格式问题时，用 `vp check --fix` 自动整理再重新检查。
3. 界面有改动时，本地预览并在浏览器里验证（见下）。
4. 提交（只加改动的文件）、推送、等构建、线上验证：同 [sync-and-publish.md](sync-and-publish.md) 的第 6～9 步。

## 本地预览

```bash
vp build && vp preview --port 4319 --strictPort
```

- 站点在 `/toolchain/` 路径下，要打开 `http://localhost:4319/toolchain/`，直接打开根路径是 404。
- 4317、4173 等端口可能被用户占用，所以换一个端口并加 `--strictPort`。用完用 `pkill -f "preview --port 4319"` 结束。
- 界面改动至少看两种宽度：桌面 1440×900，手机 390×844。`ego-browser` 里用 `page.cdp("Emulation.setDeviceMetricsOverride", …)` 切换。
- `ego-browser` 的截图偶尔会超时，读 DOM（`page.evaluate`）更稳定。任务做完要 `await task.finish({ keep: [] })` 关闭浏览器任务。

## 页面描述有三处，要保持同一句话

- 首屏：`src/components/Header.tsx`
- 页面描述：`index.html` 的 `<meta name="description">`
- 项目介绍：`README.md` 开头

## 完成标准

同 [sync-and-publish.md](sync-and-publish.md)，并且没有未提交的文件。
