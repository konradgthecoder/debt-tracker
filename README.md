# Debt Tracker

Personal finance tracker — debts, fixed costs, monthly snapshot, and AI-powered insights.

## Files

```
index.html              — open this in a browser, no server needed
data/import.sample.json — example dataset to import (placeholder numbers)
data/import.json        — your real data (git-ignored, never published)
skills/financial-advisor.md  — AI insights prompt, edit to tune advisor behaviour
```

> **Privacy:** your real financial data lives only in your browser's `localStorage`
> and in a git-ignored `data/import.json`. It is never committed or published.

## Usage

1. Open `index.html` in Chrome
2. Hit **↑ Import** and select your data file (start from `data/import.sample.json`)
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
