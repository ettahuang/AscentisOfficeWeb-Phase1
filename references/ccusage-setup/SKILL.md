---
name: ccusage-setup
description: |
  設定 Claude Code Usage 自動上傳功能。
  Use when: 首次設定 ccusage 上傳、修改 employee ID、
  更新 n8n endpoint URL、或檢查 ccusage 上傳狀態。
---

# CCUsage Setup

Configure automatic Claude Code usage data upload for team tracking.

## What This Does

Sets up a daily automatic upload of your Claude Code usage data (token counts, costs, model breakdowns) to the team's central database via n8n webhook.

- Data is uploaded once per day on SessionStart
- Upload is silent and non-blocking
- Config is stored at `~/.claude/ccusage-config.json`

## Setup Instructions

When the user invokes this skill, ask for the following information and write the config file:

1. **Employee ID** — the user's employee ID (format: `AT-0001`, e.g., "AT-0001")
2. **Endpoint URL** — the n8n webhook URL (default: "https://azeroth.n8n.poc.owgps.net/webhook/ccusage")

Then write `~/.claude/ccusage-config.json`:

```json
{
  "employeeId": "<user provided>",
  "endpointUrl": "<user provided>",
  "lastUploadDate": ""
}
```

## Verify Setup

After writing the config, verify:
1. Config file exists at `~/.claude/ccusage-config.json`
2. `npx ccusage -j` runs successfully
3. Display a summary: Employee ID, Endpoint URL, and total days of data available

## Reset Upload

If the user wants to force re-upload, set `lastUploadDate` to `""` in the config file.
