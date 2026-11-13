# 同步飞书数据并发布

**触发**：用户说「飞书数据更新了」「同步一下」，或者新增、修改了飞书里的字段、记录、附件。

开始前先读 [ops-basics.md](ops-basics.md)（硬性规则和状态自检）。

## 1. 前置检查

跑 [ops-basics.md](ops-basics.md) 里的「状态自检」，确认飞书授权可用、工作区干净。授权有问题见 [feishu-auth.md](feishu-auth.md)。保存同步前的版本，用来对比：

```bash
git show HEAD:src/data/toolchain.json > /tmp/before.json
```

## 2. 同步

```bash
vp run sync
```

预期输出类似 `已同步 25 条（AGENTS.md 2，Skills 20，MCP 服务 3）、2 个附件 → …`。

- 命令以非零状态退出：失败时旧文件保持不变，对照 [error-lookup.md](error-lookup.md) 处理。
- 输出里有 `警告：…`：有字段类型不被支持而被跳过，要把警告原文告诉用户。

## 3. 判断有没有实质变化

每次同步都会更新 `generatedAt`，所以不能只看 `git status`。

```bash
diff <(jq 'del(.generatedAt)' /tmp/before.json) <(jq 'del(.generatedAt)' src/data/toolchain.json) > /dev/null && echo "没有实质变化" || echo "有实质变化"
git status --short public/files
```

- 两者都没有变化：**不要提交**。执行 `git checkout -- src/data/toolchain.json public/files` 还原，告诉用户「飞书数据没有变化」。用户明确要求刷新页面上的「同步时间」时除外。
- 有变化：继续。

## 4. 看清变化，并检查是否敏感

下面两段都要执行，把结果概括后告诉用户。

```bash
J=src/data/toolchain.json
cnt() { jq -r '.collections[] | "\(.label) \(.items|length)"' "$1" | paste -sd' ' -; }
echo "条目数: $(cnt /tmp/before.json)  →  $(cnt $J)"
d() { diff <(jq -r "$1" /tmp/before.json) <(jq -r "$1" $J) | grep '^[<>]' | sed 's/^</  删除:/; s/^>/  新增:/'; }
echo "字段:"; d '.collections[] | .label as $l | ([.items[].fields[].name] | unique[] | "\($l)/\(.)")'
echo "筛选选项:"; d '.collections[] | .label as $l | .facets[] | .name as $n | .options[] | "\($l)/\($n)/\(.)"'
echo "条目:"; d '.collections[] | .label as $l | .items[] | "\($l)/\(.name)"'
echo "内容被修改的条目:"; jq -n -r --slurpfile a /tmp/before.json --slurpfile b $J '[($a[0].collections[].items[]) as $x | ($b[0].collections[].items[] | select(.id==$x.id)) as $y | select($x != $y) | $y.name] | if length==0 then "  无" else map("  " + .) | join("\n") end'
echo "附件:"; git status --short public/files | sed 's/^/  /'
```

新增字段会让每个条目都出现在「内容被修改的条目」里，这是正常的。

```bash
hits=$(git diff -U0 -- src/data/toolchain.json | grep '^+' | grep -v '^+++' | grep -i -E 'key|token|secret|password|密码|密钥|令牌|sk-|ghp_|gho_|@[a-z0-9.-]+\.[a-z]+|1[3-9][0-9]{9}|/Users/'); if [ -z "$hits" ]; then echo "没有命中"; else echo "$hits" | cut -c1-110; fi
```

命中要**逐条判断**：认证方式里的选项「API Key」、描述里的「安全」之类是正常内容；真实的密钥、令牌、手机号、邮箱、本机路径则**不能发布**，停下来告诉用户，让他在飞书里删掉后重新同步。附件要另外打开看一眼内容。

## 5. 检查

```bash
vp check && vp test && vp build
```

## 6. 提交

数据单独一个提交，标题概括变化，正文列出新增、删除、改名。

```bash
git add src/data/toolchain.json public/files
git commit -m "同步工具链数据：Skills 新增 xxx" -m "正文：条目数、字段、选项、附件的具体变化"
```

## 7. 推送

遵守 [ops-basics.md](ops-basics.md) 的硬性规则 2、3：

```bash
git fetch origin main && git status -sb
git push origin main
```

## 8. 等 Cloudflare 构建

```bash
SHA=$(git rev-parse HEAD)
for i in $(seq 1 20); do sleep 15; r=$(gh api repos/Minority2310/agent-toolchain-website/commits/$SHA/check-runs --jq '.check_runs[0] | "\(.status) \(.conclusion)"'); echo "$((i*15))s $r"; case "$r" in completed*) break;; esac; done
```

| 输出                | 含义                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `null null`         | 还没有检查。**超过 60 秒仍是这个值，说明没有触发构建**，见 [deploy-troubleshooting.md](deploy-troubleshooting.md) |
| `in_progress null`  | 构建中                                                                                                            |
| `completed success` | 成功，通常不到 1 分钟（实测 15～45 秒）                                                                           |
| `completed failure` | 失败，见 [deploy-troubleshooting.md](deploy-troubleshooting.md)                                                   |

## 9. 线上验证

先用命令查，再用浏览器看一眼。

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://agent.minority2310.com/toolchain/
curl -s https://agent.minority2310.com/toolchain/ | grep -o 'assets/index-[^"]*\.js' | head -1 | xargs -I{} curl -s https://agent.minority2310.com/toolchain/{} | grep -c "新增条目的名称"
```

第一条应返回 `200`；第二条把引号里换成这次新增或改名后的内容，新增应 `≥ 1`，删除应是 `0`。

浏览器验证用 `ego-browser`，打开 <https://agent.minority2310.com/toolchain/>，页面里可以读这些元素：

| 选择器                | 内容                                        |
| --------------------- | ------------------------------------------- |
| `.masthead-count`     | 条目总数                                    |
| `.masthead-meta time` | 同步时间                                    |
| `.type-tab`           | 三个视图的标签，文字里带数量                |
| `.result-count`       | 当前视图的结果数                            |
| `aside.detail`        | 详情面板（网址带 `&item=<记录 ID>` 时打开） |

## 完成标准

`completed success`；线上返回 200；总数和变化摘要一致；已向用户汇报新增、删除、改名了什么、有没有警告。

飞书字段怎么对应到页面，见 [feishu-conventions.md](feishu-conventions.md)。
