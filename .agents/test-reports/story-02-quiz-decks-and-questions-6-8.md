# Story no. 02 - Quiz decks and questions (6-8): test report

**Result:** AC1-AC8 passed the browser acceptance checks.

**Specifications:** [Quiz decks and questions, items 6-8](../spec/requirements.md#quiz-decks-and-questions) and [Story no. 02](../spec/acs_per_req.md#story-no-02---quiz-decks-and-questions-6-8).

## Implementation

- Question rows now use three sections: reorder controls and number, question preview/details, and Edit/Delete actions.
- Previews wrap to a maximum of two lines with an ellipsis when truncated. Unbroken text wraps within the available width; details remain beneath their question. Row height grows with visible content.
- Edit remains visible on mobile. Existing colors, fonts, card styling, controls and event handlers are preserved.
- Product changes are confined to row markup in `src/main.tsx` and question-list styles in `src/styles.css`. No server, storage, settings, dependency or configuration changes were needed.

## Acceptance evidence

| Criterion | Verification | Result |
| --- | --- | --- |
| AC1 | Measured three sections, number alignment and reorder-control alignment across 100 rows, including one-, two- and three-digit question numbers. | Pass |
| AC2 | All Edit actions share the same right edge, remain visible at every tested width, and stay within their rows. | Pass |
| AC3 | Short text fits; a medium preview occupies exactly two lines without truncation at desktop width. Long text and long unbroken text are constrained to two lines without horizontal overflow. Ellipses reviewed in screenshots; full long text verified in the editor. | Pass |
| AC4 | Details appear below the corresponding preview; longer rows expand without clipping or overlapping adjacent rows. Single-answer, multiple-answer and true/false details included. | Pass |
| AC5 | All 100 rows measured at 375, 640, 768 and 1280 CSS pixels in Light and Dark themes. No page/row overflow, overlapping sections, inaccessible Edit controls or excessive gaps before actions. | Pass |
| AC6 | Reorder buttons, first/last boundary controls, native drag-and-drop, persisted order/numbering, opening the intended long question, saving, and cancelling/confirming deletion all verified. Existing smoke workflows verify creation and supported rich content. | Pass |
| AC7 | Desktop Light and mobile Dark screenshots reviewed. Existing theme backgrounds, preview font size and row radius checked. | Pass |
| AC8 | Deck/settings and active/completed snapshots compared before and after viewing/resizing. Settings and snapshots remain intact after question management. Existing session resumes, submits, saves/exits, resumes again, and completes at 1/2 (50%) with its original review. Story 01 and existing smoke workflows also pass. | Pass |

The zoom check emulates a 1280-pixel display at 200% using a 640-CSS-pixel viewport and 2x device scale in an isolated browser context. This verifies the equivalent layout metrics; it does not change or automate the browser's zoom preference.

## Validation

- `npm run build`: passed, including TypeScript checking. Vite retains its bundle-size advisory.
- `npm test`: 33 passed, 1 skipped across three test files. The skipped existing test requires an optional external QTI example fixture.
- `.tools/python/python.exe tests/run_browser.py`: passed the existing smoke test, Story 01 AC1-AC10 and Story 02 AC1-AC8, including the zoom-equivalent context.
- `git diff --check`: passed.

Browser coverage is in `tests/question_list_browser.py`, invoked by `tests/browser.py`. Screenshots are saved under the ignored `.tools/ui-review/` directory as `question-list-{light|dark}-{width}.png` and `question-list-200-percent-equivalent.png`.

All tests use temporary isolated databases. Existing requirements and acceptance-criteria edits were preserved; neither document was edited during implementation. Requirements sign-off awaits the confirmation required by `AGENTS.md`.
