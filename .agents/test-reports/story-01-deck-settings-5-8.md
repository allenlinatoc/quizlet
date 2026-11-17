# Story no. 01 - Deck settings (5-8): test report

**Result:** Passed the automated acceptance checks for AC1-AC10.

**Specifications:** [Requirements, Deck settings 5-8](../spec/requirements.md#deck-settings) and [Story no. 01 acceptance criteria](../spec/acs_per_req.md).

## Acceptance coverage

| Criterion | Verification | Result |
| --- | --- | --- |
| AC1 | Numeric field appears between Choice order and Show correct answers, with exact helper text. Desktop Light/Dark and mobile Dark screenshots reviewed. | Pass |
| AC2 | Valid non-negative integers and limits above the deck count accepted. Negative, fractional, nonnumeric and unsafe values rejected without saving. Browser checks include an incomplete exponent. | Pass |
| AC3 | New and legacy decks default to zero; clearing a saved limit saves and displays zero. Legacy session reads do not rewrite stored snapshots. | Pass |
| AC4 | Zero includes all 10 questions in the test deck. | Pass |
| AC5 | Limits 1, 4, 10 and 20 on a 10-question deck select 1, 4, 10 and 10 distinct questions; stored questions stay unchanged. | Pass |
| AC6 | Arranged order selects the first questions; random order selects unique deck questions. Question and choice order persist on resume and in completed review. | Pass |
| AC7 | Values persist after reopening and page reload; another deck remains unchanged. QTI settings round-trip, and legacy metadata defaults to zero. | Pass |
| AC8 | Progress, navigation, running points and review use the selected count. Three correct answers out of four show 3/4 and 75%. Exact-set multiple-answer scoring and unanswered-question confirmation remain intact. | Pass |
| AC9 | Changing the limit leaves active questions, cursor, answers and totals unchanged; subsequent sessions use the new limit. Completed results remain unchanged. | Pass |
| AC10 | Original defaults and independent question order, choice order, feedback and points work with the limit. Saving one setting preserves other settings; legacy requests preserve a saved limit. Existing browser smoke workflows pass. | Pass |

## Validation commands

- `npm run typecheck`: passed.
- `npm test`: 33 passed, 1 skipped across three test files; includes 13 new Story 01 API cases. The skipped existing test needs an optional external QTI example package.
- `npm run build`: passed. Vite reported its bundle-size advisory.
- `.tools/python/python.exe tests/run_browser.py`: passed, including the existing smoke workflows and the Story 01 browser suite in `tests/item_limit_browser.py`.
- `git diff --check`: passed.

## Evidence and scope

- API checks are in `server/app.test.ts`, under `Story 01 - Deck settings (5-8)`.
- Browser checks are in `tests/item_limit_browser.py`, invoked by `tests/browser.py`.
- Screenshots are in the ignored `.tools/ui-review/` directory: `item-limit-light.png`, `item-limit-dark.png`, `item-limit-mobile-dark.png` and `item-limit-result.png`.
- All tests use temporary isolated databases. No project dependencies, environment files, launcher settings or architecture were changed. Python and Playwright used for testing reside in the ignored `.tools/` directory.
- The existing requirements and acceptance-criteria documents were used as specifications and were not edited during implementation. Requirements sign-off remains subject to the confirmation rule in `AGENTS.md`.
