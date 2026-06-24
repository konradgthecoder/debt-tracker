# Debt Tracker

Personal finance tracker — debts, fixed costs, monthly snapshot, and AI-powered insights.

## Files

```
index.html              — open this in Chrome, no server needed
data/import.json        — full debt/costs dataset, re-import after edits here
skills/financial-advisor.md  — AI insights prompt, edit to tune advisor behaviour
```

## Usage

1. Open `index.html` in Chrome
2. Hit **↑ Import** and select `data/import.json` to load your data
3. Edit balances directly in the table as you make payments
4. Hit **📸 Snapshot now** monthly to log your progress
5. Scroll to **AI Insights**, paste your Anthropic API key, hit **✦ Analyze**

## Data persistence

Data is saved to `localStorage` in your browser.
Use **↓ Export** to back up to `data/import.json` and commit — that's your source of truth.

## Updating the AI advisor

Edit `skills/financial-advisor.md` to change how Claude analyses your finances.
The prompt is embedded in `index.html` — after editing the skill file, run:

```bash
./scripts/build.sh   # not yet implemented — copy prompt manually for now
```

## Stack

Pure HTML/CSS/JS, no build step, no dependencies.
AI: Anthropic claude-sonnet-4-6 via direct browser API call.
Exchange rate: open.er-api.com (CAD→PLN, auto-refreshed).
Economic context: World Bank API + NBP API (fetched on each analysis).
