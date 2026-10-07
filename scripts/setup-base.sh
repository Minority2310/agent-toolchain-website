#!/usr/bin/env bash
# 一次性创建 Base「智能体工具链」及 3 张表，写入示例数据，并生成 toolchain.config.json。
# 用法：scripts/setup-base.sh [--dry-run]
set -euo pipefail

cd "$(dirname "$0")/.."
SEED=scripts/seed
DRY=()
[[ "${1:-}" == "--dry-run" ]] && DRY=(--dry-run)

GUIDE_TABLE=智能体指南收集表
SKILL_TABLE=智能体技能收集表
MCP_TABLE="智能体 MCP 服务收集表"

fields() { jq -c --arg t "$1" '.common + .[$t]' "$SEED/fields.json"; }
lark() { lark-cli base "$@" --as user ${DRY[@]+"${DRY[@]}"}; }
need() { [[ -n "$1" && "$1" != null ]] || { echo "无法解析 $2" >&2; exit 1; }; }

base_out=$(lark +base-create --name 智能体工具链 --time-zone Asia/Shanghai \
  --table-name "$GUIDE_TABLE" --fields "$(fields guide)")
if [[ ${#DRY[@]} -gt 0 ]]; then
  echo "$base_out"
  lark +table-create --base-token '<base_token>' --name "$SKILL_TABLE" --fields "$(fields skill)"
  lark +table-create --base-token '<base_token>' --name "$MCP_TABLE" --fields "$(fields mcp)"
  for t in guide skill mcp; do
    lark +record-batch-create --base-token '<base_token>' --table-id "<$t>" --json "@$SEED/$t.json"
  done
  exit 0
fi

base_token=$(jq -r '.data.base.base_token // .data.base_token // empty' <<<"$base_out")
[[ -n "$base_token" ]] || { echo "$base_out" >&2; echo "无法解析 base_token" >&2; exit 1; }
echo "base_token: $base_token"

lark +table-create --base-token "$base_token" --name "$SKILL_TABLE" --fields "$(fields skill)" >/dev/null
lark +table-create --base-token "$base_token" --name "$MCP_TABLE" --fields "$(fields mcp)" >/dev/null

tables=$(lark +table-list --base-token "$base_token")
table_id() { jq -r --arg n "$1" '[.. | objects | select(.name? == $n) | (.table_id // .id)][0] // empty' <<<"$tables"; }
guide_id=$(table_id "$GUIDE_TABLE"); need "$guide_id" "$GUIDE_TABLE"
skill_id=$(table_id "$SKILL_TABLE"); need "$skill_id" "$SKILL_TABLE"
mcp_id=$(table_id "$MCP_TABLE"); need "$mcp_id" "$MCP_TABLE"

for pair in "guide:$guide_id" "skill:$skill_id" "mcp:$mcp_id"; do
  lark +record-batch-create --base-token "$base_token" --table-id "${pair#*:}" --json "@$SEED/${pair%%:*}.json" \
    | jq -c '{ok, table: "'"${pair%%:*}"'"}'
done

jq -n --arg b "$base_token" --arg g "$guide_id" --arg s "$skill_id" --arg m "$mcp_id" \
  '{baseToken: $b, tables: {guide: $g, skill: $s, mcp: $m}}' > toolchain.config.json
cat toolchain.config.json
