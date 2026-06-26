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

For the current calendar month, against the real stored balances:

1. **Amortize each debt one month** (in the debt's native currency for foreign debts):
   - `interest = balance × rate ÷ 100 ÷ 12` (0 for 0%-interest debts).
   - `balance += interest; balance -= min(payment, balance)` (freed minimum from a cleared debt is NOT auto-redirected — matches the engine's existing rule).
2. **Apply extra allocations:** for each debt allocation, `balance -= amount` (foreign: convert the PLN amount to native via `cadRate`); clamp at 0. For each Savings allocation, `savings += amount`.
3. **Record the month:** write/update the Monthly Log entry for this month (reusing `snapshotDetail()`/`addLogRow`), augmented with the `allocations` made.
4. **Mark applied:** set `S.lastAppliedMonth = nowLabel()` so the panel locks for the month.
5. **Re-render** (`renderAll`/`recalc`) so balances, months-left, free cash, projection and chart update.

### Idempotency / corrections
- Amortization is one-way (not cleanly reversible). After applying, the panel shows `✓ Applied for <Month>` and the button is disabled until the next calendar month.
- Corrections are made by **overwriting balances manually** (balances stay editable everywhere). Re-applying the same month is blocked to avoid double-amortizing.

## Freed-up cash grows automatically

Adjust the free-cash / obligations math so a **debt at ≤ 0 balance no longer contributes its minimum** to monthly obligations. Then the month the credit card hits 0, the next month's "Free cash this month" rises by ~that minimum with no manual edit — the user's exact scenario. (Touches `recalc()`'s `totalMin`/obligations and `monthlyOutgoings()`.)

## Relationship to the long-term plan (unchanged)

- The Simulator (`Extra / mo`, strategy), savings goal, parallel toggle, and **lock plan** baseline are untouched — they remain the long-term *aim*.
- `drawChart()` already plots committed log snapshots as amber dots against the locked plan line; feeding it real monthly actions yields plan-vs-actual drift for free. No chart changes required.

## Data model changes

- `S.lastAppliedMonth` (string, e.g. `"June 2026"`) — guards idempotency; `normalizeState()` backfills to `''`.
- Log entry detail gains `allocations: [{ target, amount }]` (target = debt name or `"Savings"`). Backward compatible (older entries simply lack it).
- Transient panel state (free-cash override, in-progress allocation rows) held in a module-level JS object, not persisted until Apply.

## Edge cases

- **Foreign debts (CAD):** amortize in native currency; convert PLN allocation amounts to native via `cadRate`; display PLN equivalents as today.
- **0%-interest debts:** `interest = 0`, so `balance -= payment` (+ extra). Months-left already handled by `calcMonths`.
- **Over-allocation:** allowed; flagged amber. Apply still proceeds (the user may genuinely deploy savings).
- **No income set:** free cash is null; panel shows a prompt to enter income (consistent with the rest of the app) and disables Apply.
- **Cleared debt with a leftover minimum:** excluded from obligations once balance ≤ 0 (see "freed-up cash").

## Out of scope (YAGNI)

- Reversing/undoing an applied month (use manual balance overwrite).
- Modeling the "lower the monthly payment, keep the term" overpayment convention (the app models "shorten the term, keep payment"; users on the other convention reconcile the payment field manually).
- Auto-pulling the recommended split from the AI text; the recommendation comes from the existing deterministic optimizer.
- Per-savings-bucket targeting (single Savings total for now).

## Success criteria

- A user can take a recommendation, set "Car Loan 400 / Savings 500", click one button, and see the Car Loan balance drop by 400, savings rise by 500, the month recorded, and months-left/payoff update.
- The following month, the panel reflects the new balances and any freed-up minimum (higher free cash), with a fresh recommendation.
- Capital, total remaining, and total interest are all visible so the 272,770 vs 537,469 distinction is never confusing.
- Desktop and mobile layouts both accommodate the panel; no horizontal overflow on mobile.
