# 飞书授权过期

**现象**：`vp run sync` 报 `need_user_authorization` 或 `token_missing`；`lark-cli auth status` 里 `status` 是 `missing`。

## 背景

访问令牌约 2 小时过期，`lark-cli` 会用刷新令牌自动续期，不用处理（状态显示 `needs_refresh` 是正常的）。刷新令牌有效期约 7 天，每次使用都会顺延；**超过 7 天没有同步**才会完全过期，这时必须用户重新授权。

> 这些期限是根据本机 `lark-cli auth status` 的输出推算的，不是飞书官方说明，以 `refreshExpiresAt` 为准。

## 流程

**这一步要用户在浏览器里完成，智能体不能代替，也不能在同一轮里阻塞等待。**

```bash
lark-cli auth login --domain base --no-wait --json > /tmp/auth.json
jq -r '.verification_url' /tmp/auth.json
jq -r '.device_code' /tmp/auth.json > /tmp/device_code.txt
lark-cli auth qrcode "$(jq -r '.verification_url' /tmp/auth.json)" --output .wrangler/auth-qr.png
```

1. 把授权链接和二维码图片（`.wrangler/auth-qr.png`）发给用户，**结束本轮**，请用户授权后回复。链接 10 分钟内有效，过期要重新执行上面的命令。
2. 用户回复已授权后，再执行：

```bash
lark-cli auth login --device-code "$(cat /tmp/device_code.txt)"
rm -f .wrangler/auth-qr.png /tmp/auth.json /tmp/device_code.txt
lark-cli auth status | jq -c '.identities.user | {status, tokenStatus}'
```

看到 `授权成功`，并且 `status` 是 `ready` 后，回到原来的任务。

## 其他

- 二维码放在被 git 忽略的 `.wrangler/` 里，授权完成后要删掉。
- 首次在新机器上使用时，还要先执行一次 `lark-cli config init --new`（也要在浏览器里确认）。
