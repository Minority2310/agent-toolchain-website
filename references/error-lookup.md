# 报错速查

按报错信息或现象查原因和处理。先读过 [ops-basics.md](ops-basics.md) 的硬性规则。

## 同步（`vp run sync`）

| 现象                                       | 原因                                         | 处理                                 |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------ |
| `need_user_authorization`、`token_missing` | 飞书授权过期                                 | [feishu-auth.md](feishu-auth.md)     |
| `名称为空`                                 | 某条记录的第一个字段是空的                   | 让用户在飞书里补上名称，再同步       |
| `「xxx」的值「yyy」不在选项中`             | 记录用了字段里没有定义的选项                 | 让用户在飞书里补上这个选项或修正记录 |
| `主字段「xxx」不是文本字段`                | 第一个视图的第一个字段不是文本               | 让用户调整视图的字段顺序             |
| `筛选字段名「xxx」是保留名`                | 单选或多选字段叫 `type`、`q`、`view`、`item` | 让用户给字段改名                     |
| `附件「xxx」…超过 10 MB 的上限`            | 附件太大                                     | 让用户换小一点的文件，或拆分         |
| 输出 `警告：…类型，暂不支持，已跳过`       | 表里有不支持类型的字段                       | 告诉用户，这个字段不会出现在网站上   |

## 提交与推送

| 现象                                          | 原因                             | 处理                                                                                    |
| --------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| 线上缺附件，或附件是旧的                      | 提交时漏了 `public/files`        | `git add public/files` 后补提交、推送                                                   |
| `git push` 报 `Permission denied (publickey)` | 远程地址是 SSH，这台机器没有密钥 | `git remote set-url origin https://github.com/Minority2310/agent-toolchain-website.git` |
| `git push` 被拒绝（非快进）                   | 远程有新提交                     | `git pull --rebase origin main`，重新检查后再推送                                       |

## Cloudflare 构建与线上

| 现象                                     | 原因                                                            | 处理                                                   |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| 推送后没有 `Workers Builds` 检查         | Cloudflare 没有收到推送                                         | [deploy-troubleshooting.md](deploy-troubleshooting.md) |
| 构建报 Worker 名称不匹配                 | Cloudflare 里的名称和 `wrangler.jsonc` 的 `name` 不一致         | 两边都改成 `agent-toolchain-website`                   |
| 构建报 `EBADDEVENGINES`                  | 部署命令是默认的 `npx wrangler deploy`                          | 改成 `pnpm exec wrangler deploy`                       |
| 构建时 pnpm 版本不对、安装失败           | 没有设置构建变量 `PNPM_VERSION=12.8.1`                          | 让用户在 Settings → Build 里添加                       |
| 部署报路由所在的 zone 找不到             | `zone_name` 不是这个账号下的域名，或 API token 没有 Routes 权限 | `zone_name` 必须是 `minority2310.com`；检查 token 权限 |
| 页面空白，控制台里 JS、CSS 返回 404      | `base` 和 `outDir` 没有同时对应 `/toolchain/`                   | [advanced-changes.md](advanced-changes.md)             |
| 访问线上超时，或 `ERR_NAME_NOT_RESOLVED` | 子域名没有 DNS 记录，或没有开启代理                             | 让用户在 Cloudflare 里添加开启代理的记录               |
