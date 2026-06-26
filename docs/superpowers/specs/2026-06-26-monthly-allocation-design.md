# Monthly Allocation — "This Month" action

**Date:** 2026-06-26
**Status:** Approved design, pending implementation plan

## Problem

The AI advisor recommends a *split* (e.g. "overpay 400 to debt, 500 to savings"), but the app only exposes a single long-term **Extra / mo** lump that the waterfall auto-allocates, plus a savings goal and a parallel toggle. There is no clear way to:

1. act on a recommended split,
2. reflect a concrete **this-month** decision in the data, and
3. let the freed-up cash from cleared debts grow the next month's budget.

The user's mental model: **the long-term plan is just an aim; each month is a one-off decision** against whatever free cash is actually available that month (income varies; cleared debts free up their minimum). Example: once the credit card is cleared, ~1,000 PLN/mo frees up, so the next month a larger allocation becomes possible.

## Solution overview

Add a **"This Month" allocation panel** at the top of the Snapshot section that lets the user see this month's available free cash, see a recommended split, set/adjust per-target allocations, and **Apply & record** — which amortizes the month, applies the chosen extra payments, adds to savings, and writes the month's log entry. The long-term Simulator / locked plan is unchanged and remains the "aim"; the projection chart already plots committed months as amber dots against the plan line, so real monthly actions render naturally as plan-vs-actual drift.

## Core model (the dilemma, resolved)

- The app tracks **capital (principal)** for each debt — the real outstanding balance. (272,770 for the mortgage, not the 537,469 sum-of-all-future-payments.)
- An **extra payment reduces capital 1:1** (overpayment / nadpłata goes fully to principal). Exact, no proprietary math.
- **Months-left and payoff date are already derived** from capital + rate + monthly payment via `calcMonths()`. So an overpayment automatically shortens the term while keeping the monthly payment fixed — matching the user's convention ("reduce the number of monthly rates").
- The **minimum's monthly capital paydown is standard amortization**, not proprietary: `interest = capital × rate ÷ 12`, `principal = payment − interest`, `capital -= principal`. The app performs this on Apply. Day-count conventions cause only minor drift, reconciled manually.
- **Interest is shown, never silently distorted.** The "Interest /mo" column stays informational. Three context figures are surfaced so capital is never mistaken for total cost: **capital**, **total remaining payments** (≈ payment × months-left), and **total interest** (total remaining − capital).

## The panel

Location: a card at the **top of the Snapshot section**, headed `This month — <Month YYYY>` (current real calendar month via the existing `nowLabel()`).

Contents:
- **Free cash this month** — editable amount, defaults to computed free cash (income − minimums − costs). Editable because income varies month to month.
- **Recommended split** — a chip derived from the existing optimizer/waterfall run against this month's free cash (highest-rate debt above the APY cutoff first, up to its balance, then savings). Clicking **use** pre-fills the allocation rows.
- **Allocation rows** — each `[target ▼] [amount] [×]`, where target is any active debt **or** "Savings". "+ add allocation" adds rows. The user's example = two rows: *Car Loan 400*, *Savings 500*.
- **Running tally** — `Allocated X / Y free · Z left`, turning amber if allocations exceed free cash (allowed, just flagged).
- **`✓ Apply & record this month`** button.

## What "Apply & record" does

Two distinct events, against the real stored balances. **They are decoupled** — the monthly rata advances the loans once a month; overpayments can be recorded any number of times.

**1. Monthly amortization — runs at most once per calendar month.**
Only if `S.lastAmortizedMonth !== nowLabel()`. For each debt (in native currency for foreign debts):
- `interest = balance × rate ÷ 100 ÷ 12` (0 for 0%-interest debts).
- `balance += interest; balance -= min(payment, balance)` (freed minimum from a cleared debt is NOT auto-redirected — matches the engine's existing rule).
- Then set `S.lastAmortizedMonth = nowLabel()`.
If the month was already amortized, this step is **skipped** — recording a second action in the same month must not advance the loans again.

**2. Apply extra payments — every time Apply is pressed.**
For each debt allocation, `balance -= (amount − interestPaid)`; for each Savings allocation, `savings += amount`. Foreign debt amounts convert from PLN via `cadRate`. Clamp balances at 0. `interestPaid` defaults to 0 (so by default the full cash reduces principal).

**3. Record the month:** write/update the Monthly Log entry for this month (reusing `snapshotDetail()`/`addLogRow`), with the cumulative `allocations`.

**4. Re-render** (`renderAll`/`recalc`) so balances, months-left, free cash, projection and chart update.

### The allocation amount = cash paid (with an optional interest split)
The number the user enters is **the cash they actually pay**, which always reduces free cash for the month by that full figure. By default, that same amount reduces the balance (simple path: cash paid = principal reduction).

Polish loans accrue interest **daily from the last payment**, so an overpayment really pays a few days' interest first and only the remainder hits principal. To make this exact when the user has the bank's breakdown, each debt allocation row offers an **optional "interest paid" field** (advanced, hidden by default, defaults to 0):
- Free cash is reduced by the **full cash paid** (`amount`) — it's real money out.
- The balance is reduced by **`amount − interestPaid`** — only the principal portion.

So: leave it blank and the full payment reduces principal (good-enough estimate, reconcile later if needed); fill it in from the bank's overpayment confirmation and the balance is exact with no later reconciliation. Either way one "cash paid" number drives free cash; the app never guesses the daily split itself.

### Overpayment convention: term vs rata
By default an overpayment **shortens the term** and keeps the monthly payment fixed — `calcMonths()` recomputes a nearer payoff automatically. But some banks instead **keep the term and lower the rata**. To support both: after an overpayment is applied to an interest-bearing debt whose **principal reduction is smaller than that debt's current monthly payment** (the signal that the bank likely lowered the rata rather than dropping a whole month), the app **prompts for the new monthly payment** — "Did <debt>'s monthly payment change? Enter the new rata, or keep the current one." If the user enters a value, the debt's `min` (payment) is updated and months-left/payoff recompute from it; if they keep it, the term simply shortens as before. Optional and dismissable — no prompt for 0%-interest debts.

### Idempotency / corrections
- **Amortization** is guarded to once per calendar month via `lastAmortizedMonth`. Pressing Apply again the same month re-applies only the new extra payments — it does not re-amortize.
- **Overpayments** are intentionally repeatable within a month (you may overpay more than once). The Log entry accumulates them.
- Corrections (including the daily-interest sliver) are made by **overwriting balances manually** — balances stay editable everywhere; the bank is always the source of truth.

## Freed-up cash grows automatically

Adjust the free-cash / obligations math so a **debt at ≤ 0 balance no longer contributes its minimum** to monthly obligations. Then the month the credit card hits 0, the next month's "Free cash this month" rises by ~that minimum with no manual edit — the user's exact scenario. (Touches `recalc()`'s `totalMin`/obligations and `monthlyOutgoings()`.)

## Relationship to the long-term plan (unchanged)

- The Simulator (`Extra / mo`, strategy), savings goal, parallel toggle, and **lock plan** baseline are untouched — they remain the long-term *aim*.
- `drawChart()` already plots committed log snapshots as amber dots against the locked plan line; feeding it real monthly actions yields plan-vs-actual drift for free. No chart changes required.

## Data model changes

- `S.lastAmortizedMonth` (string, e.g. `"June 2026"`) — ensures the monthly rata advances the loans at most once per calendar month; `normalizeState()` backfills to `''`.
- Log entry detail gains `allocations: [{ target, amount, interestPaid? }]` (target = debt name or `"Savings"`; `interestPaid` optional, defaults 0, debt rows only). Backward compatible (older entries simply lack it).
- Transient panel state (free-cash override, in-progress allocation rows) held in a module-level JS object, not persisted until Apply.

## Edge cases

- **Foreign debts (CAD):** amortize in native currency; convert PLN allocation amounts to native via `cadRate`; display PLN equivalents as today.
- **0%-interest debts:** `interest = 0`, so `balance -= payment` (+ extra). Months-left already handled by `calcMonths`.
- **Over-allocation:** allowed; flagged amber. Apply still proceeds (the user may genuinely deploy savings).
- **No income set:** free cash is null; panel shows a prompt to enter income (consistent with the rest of the app) and disables Apply.
- **Cleared debt with a leftover minimum:** excluded from obligations once balance ≤ 0 (see "freed-up cash").

## Out of scope (YAGNI)

- *Computing* the daily-interest portion of an overpayment. The app never derives it — the user optionally enters it from the bank's breakdown (the advanced "interest paid" field); left blank, the full cash reduces principal.
- Reversing/undoing the monthly amortization (use manual balance overwrite).
- Auto-pulling the recommended split from the AI text; the recommendation comes from the existing deterministic optimizer.
- Per-savings-bucket targeting (single Savings total for now).

## Success criteria

- A user can take a recommendation, set "Car Loan 400 / Savings 500", click one button, and see the Car Loan balance drop by 400, savings rise by 500, the month recorded, and months-left/payoff update.
- The following month, the panel reflects the new balances and any freed-up minimum (higher free cash), with a fresh recommendation.
- Capital, total remaining, and total interest are all visible so the 272,770 vs 537,469 distinction is never confusing.
- Desktop and mobile layouts both accommodate the panel; no horizontal overflow on mobile.
