# Monthly Allocation — implementation notes & open questions

Shipped 2026-06-26 (autonomous session). The feature is live; these are decisions I
made without you and things worth a look in a later session.

## Autonomous decisions made
- **Rata-change prompt uses `window.prompt()`** (blocking, plain). Functional but not
  on-brand. A nicer inline panel prompt would be better — left as a follow-up.
- **Recommended split** = highest-rate debts *above the savings APY cutoff* first (to
  their balance), then Savings. It deliberately does NOT replicate the full simulator
  waterfall (starter buffer → EF tiers → goal). Simpler and matches "attack the
  expensive debt, then save." Revisit if you want EF-aware suggestions.
- **Rows reset after each Apply** (back to a fresh recommendation) so you can't
  accidentally double-apply the same overpayment. Overpaying again = enter new amounts.
- **Lifetime-cost context** is portfolio-wide (one line under the debts table: capital
  vs total-you'll-pay vs interest). No per-debt breakdown line.
- **Amortization guard** = `S.lastAmortizedMonth` (calendar month). No UI to "re-open"
  a month if you amortized by mistake — correction is manual balance overwrite. Could
  add an "undo this month" later if it bites.

## Verification status
- ✅ JS parses; amortization math validated in Node against `data/import.json`
  (one-month interest+principal split matches the engine).
- ✅ Fixed a real bug found in validation: a foreign-debt extra payment divided by
  `cadRate`; if the rate was missing/0 it wiped the balance to 0. Now guarded — Apply
  refuses a foreign-debt payment until the CAD→PLN rate is set.
- ⚠️ **Could NOT screenshot the populated panel** — this headless Chrome setup doesn't
  fire `load`/`setTimeout`, so seeded-state screenshots don't render. The empty-state
  panel and overall layout were confirmed unbroken. **Please eyeball the populated
  panel on the live site / phone** with your real data: allocation rows, the optional
  "int" field, the tally, Apply, and the rata prompt on a small overpayment.

## Edge cases worth a sanity check on real data
- An **interest-bearing debt with no minimum** (`min` blank/0) will *grow* each month on
  Apply (interest accrues, nothing paid). Correct behaviour, but if any of your debts
  legitimately have no monthly minimum, consider whether amortizing them is wanted, or
  add a guard/warning.
- **Foreign (CAD) debts**: extra-payment amounts are entered in PLN and converted to CAD
  via the live rate; amortization runs in CAD. Confirm the CAD balances move sensibly.
- **`savings` round-trip**: Apply mutates `S.savings`, then `renderAll`→`restoreInputs`
  writes it back into the input and `recalc` reads it. Watch that a big savings number
  formats/parses cleanly (commas).

## Possible follow-ups
- Replace the `window.prompt` rata flow with an inline panel control.
- Show the recommended split with a one-line "why" (rate saved).
- Let the "This Month" Log entries surface their `allocations` in the log table / AI prompt.
- Consider an "undo last applied month" affordance.
