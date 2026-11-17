# Acceptance criteria per requirement

===========================================================================================================

## Story no. 01 - Deck settings (5-8)

===========================================================================================================

**Feature:** Item Limit for new play sessions.

**Story:** As a person practising a quiz deck, I want to limit the number of questions in a new play session so that I can practise a smaller set without changing the deck.

**Source of truth:** [Business requirements - Deck settings](requirements.md#deck-settings), items **5-8**. Existing question and choice ordering, answer feedback and running points follow items **1-4**. Scoring and result review follow [Playing and results](requirements.md#playing-and-results), items **3-5**.

The story number and AC1-AC10 identifiers are retained. These criteria describe expected behaviour, not implementation or test completion.

### AC1: Field placement, label and helper text

**Source:** Deck settings, item 5.

- **Given** a deck's **Deck settings** dialog is open,
- **Then** a numeric field labeled **Item Limit** appears immediately below **Choice order** and above **Show correct answers**.
- **And** its helper description reads exactly **0 = No limit (include all questions).**
- **And** the field uses the existing settings row layout, typography, spacing, colors and dividers.

### AC2: Input validation

**Source:** Deck settings, item 6.

- **Given** the user is editing **Item Limit**,
- **When** the user enters a non-negative whole number and saves the settings,
- **Then** the value is accepted, including values greater than the deck's question count.
- **When** the user enters a negative, fractional or nonnumeric value,
- **Then** a validation error is shown and the invalid value cannot be saved.

| Example input                     | Expected outcome                                           |
| --------------------------------- | ---------------------------------------------------------- |
| `0`                               | Accepted; no limit.                                        |
| `1` or `5`                        | Accepted; positive whole number.                           |
| `20` for a deck with 10 questions | Accepted; the session count is capped as specified in AC5. |
| `-1`                              | Validation error; cannot save.                             |
| `1.5`                             | Validation error; cannot save.                             |
| `abc`                             | Validation error; cannot save.                             |

### AC3: Default and blank values

**Source:** Deck settings, item 6.

- **Given** a new deck or an existing deck without a saved Item Limit,
- **When** its settings are opened,
- **Then** **Item Limit** displays **0**.
- **Given** the user clears the field,
- **When** the settings are saved,
- **Then** the blank value is saved as **0** and reopening the settings displays **0**.

### AC4: No-limit session

**Source:** Deck settings, item 7.

- **Given** a deck with questions and a saved Item Limit of **0**,
- **When** a new play session starts,
- **Then** the session includes every question in the deck exactly once, using the configured question order.

### AC5: Positive limit and available question count

**Source:** Deck settings, item 7.

- **Given** a deck containing **T** questions and a saved positive Item Limit of **N**,
- **When** a new play session starts,
- **Then** it includes exactly **min(N, T)** distinct questions.
- **And** applying the limit does not delete, modify or reorder the stored deck questions.

| Deck question count | Item Limit | Session question count |
| ------------------- | ---------- | ---------------------- |
| 10                  | 1          | 1                      |
| 10                  | 4          | 4                      |
| 10                  | 10         | 10                     |
| 10                  | 20         | 10                     |

### AC6: Question selection and fixed ordering

**Source:** Deck settings, items 1, 3 and 7.

- **Given** a positive Item Limit of **N**, a deck containing **T** questions and **Arranged** question order,
- **When** a new session starts,
- **Then** it selects the first **min(N, T)** questions in saved deck order and presents them in that order.
- **Given** the same limit and **Random** question order,
- **When** a new session starts,
- **Then** it selects **min(N, T)** unique questions in randomized order.
- **And** the selected questions and their question order stay fixed throughout the session, including after saving, exiting and resuming.
- **And** choice order follows its independent setting and stays fixed throughout the session and its completed result review.

### AC7: Per-deck persistence

**Source:** Deck settings, item 6.

- **Given** the user saves a valid Item Limit for a deck,
- **When** the user closes and reopens that deck's settings,
- **Then** the saved value is displayed.
- **And** saving the limit for one deck does not change the saved Item Limit for another deck.

### AC8: Progress, scoring and completed results

**Source:** Deck settings, items 4 and 8; Playing and results, items 3-5.

- **Given** a session includes **K** questions after applying Item Limit,
- **Then** session progress and question totals use **K**, and the maximum possible score is **K** points.
- **And** when running points are enabled, they show points earned out of **K**.
- **And** each selected question remains worth one point; a multiple-answer response earns that point only when the entire correct set is selected. Unanswered questions earn zero points when the user confirms completion.
- **When** the session is completed,
- **Then** its score, percentage, counts and individual answer review reflect only the selected **K** questions.

**Example:** A 10-question deck with Item Limit **4** produces a four-question session. Three correct answers and one incorrect answer produce **3/4**, **75%**, and four questions in the completed answer review.

### AC9: Changes apply only to new sessions

**Source:** Deck settings, item 8.

- **Given** a deck has an active session or completed results,
- **When** the user saves a different Item Limit,
- **Then** newly started sessions use the updated limit.
- **And** existing active sessions, including sessions resumed after the change, keep their selected questions, order, totals and recorded answers.
- **And** completed results and their question snapshots remain unchanged.

### AC10: Existing settings and behaviour

**Source:** Deck settings, items 1-5 and 8.

- **Given** the Item Limit field is available,
- **Then** the other settings retain their existing layout, labels, controls, saved values and behaviour.
- **And** question order, choice order, answer feedback and running points continue to work independently with both unlimited and limited sessions.
- **And** new and existing decks without saved settings retain the specified defaults: arranged question and choice order, answer feedback enabled and running points enabled.

===========================================================================================================

## Story no. 02 - Quiz decks and questions (6-8)

===========================================================================================================

**Feature:** Consistent, responsive question-list rows.

**Story:** As a person managing a quiz deck, I want readable question previews and consistently positioned controls so that I can find, reorder and edit questions at different browser widths.

**Source of truth:** [Business requirements - Quiz decks and questions](requirements.md#quiz-decks-and-questions), items **6-8**. Existing question-management behaviour follows items **1-4**. Deck settings and quiz-playing behaviour remain governed by their existing requirements.

The story number and original AC1-AC6 identifiers are retained; AC7-AC8 cover design preservation and scope boundaries. Criterion identifiers are scoped to this story. These criteria describe expected behaviour, not implementation or test completion.

### AC1: Three-section structure and left-side alignment

**Source:** Quiz decks and questions, item 6.

- **Given** a deck's question list contains rows with different text lengths and question numbers,
- **When** the list is displayed,
- **Then** every row has three sections: left for the drag handle, reorder controls and question number; center for question text and question type/details; and right for the **Edit** action.
- **And** question numbers and reorder controls remain consistently aligned across rows, including rows with two-line previews.

### AC2: Consistent Edit alignment

**Source:** Quiz decks and questions, items 6-7.

- **Given** consecutive rows have short and long question previews,
- **When** the question list is displayed or resized,
- **Then** all **Edit** actions stay aligned in the same right-hand column within the list.
- **And** each Edit action remains visible and usable, without being displaced by the question text or pushed outside its row.

### AC3: Wrapping and two-line truncation

**Source:** Quiz decks and questions, item 7.

- **Given** question text exceeds the available width of the center section,
- **When** its preview is rendered,
- **Then** the text wraps within that section without overlapping the Edit action or other controls.
- **And** the preview displays at most **two lines**, with an ellipsis when additional text is truncated.
- **And** text that fits within two lines is displayed without unnecessary truncation.
- **And** truncating the preview does not alter the stored question text or the full content available in the editor.

### AC4: Details alignment and row height

**Source:** Quiz decks and questions, items 6-7.

- **Given** questions have different preview lengths and question types/details,
- **When** their rows are displayed,
- **Then** each question's type/details appear beneath its own preview in the center section.
- **And** each row can expand vertically to accommodate the visible preview and details without clipping or overlapping adjacent rows.
- **And** vertical expansion preserves the two-line limit on the question-text preview and the left/right alignment defined in AC1-AC2.

### AC5: Responsive layout without overflow or excessive whitespace

**Source:** Quiz decks and questions, item 8.

- **Given** the list contains short previews, long previews and long unbroken text,
- **When** the browser width changes, including when browser zoom reduces the available layout width,
- **Then** the list adapts without causing horizontal overflow or requiring horizontal scrolling to reach row content or actions.
- **And** previews, details and controls remain within their rows without overlapping.
- **And** the center section uses the available space without excessive blank gaps between the question content and the Edit column.
- **And** the three-section structure and right-aligned Edit actions remain usable at the tested widths.

### AC6: Existing question-management functionality

**Source:** Quiz decks and questions, items 6 and 8; existing behaviour in items 1-4.

- **Given** a deck uses the updated question-list layout,
- **When** the user reorders questions using the drag handle or existing reorder controls,
- **Then** the intended order and displayed question numbers update correctly, and the saved order is retained when the deck is reopened.
- **When** the user selects a row's Edit action,
- **Then** the editor opens the corresponding question with its full content, and existing save behaviour continues to work.
- **When** the user deletes a question through the existing control and confirmation flow,
- **Then** the intended question is removed using the existing behaviour, and the remaining rows remain usable.
- **And** existing question creation, selection and supported content continue to work; no existing control or action is removed by the layout change.

### AC7: Existing visual design

**Source:** Quiz decks and questions, item 6.

- **Given** the question list is viewed in the application's existing Light or Dark theme,
- **When** the updated layout is compared with the existing design,
- **Then** it preserves the application's colors, typography, control styling and overall visual design while applying the required row structure, wrapping and alignment.
- **And** the change does not introduce a new theme or redesign unrelated parts of the page.

### AC8: Deck settings and quiz-playing experience remain unchanged

**Source:** Quiz decks and questions, item 8.

- **Given** a deck has saved settings, questions, an active session or completed results,
- **When** its question list is displayed or the browser is resized,
- **Then** the layout change does not modify stored questions, their order, Deck settings or session/result data.
- **And** the existing Deck settings controls and saved values, including Item Limit, retain their behaviour.
- **And** starting, playing, saving, resuming and completing a quiz continue to follow the existing settings, ordering, feedback, scoring and review behaviour.

### Suggested verification cases

These examples guide testing; they do not define new viewport limits or design breakpoints.

| Case                                                        | Expected checks                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Short, one-line question                                    | All three sections align; details sit beneath the preview; Edit remains at the right. |
| Question that wraps to exactly two lines                    | Both lines display; details remain visible; the row accommodates the content.         |
| Question longer than two lines                              | Only two preview lines display, with an ellipsis; the editor retains the full text.   |
| Long unbroken text                                          | Preview stays within its section; no overlap or horizontal overflow.                  |
| Mixed question types and one-, two- and three-digit numbers | Left controls/numbers, center details and right Edit actions remain aligned.          |
| Representative widths such as 375, 768 and 1280 CSS pixels  | No horizontal overflow, excessive blank gaps or inaccessible actions.                 |
| Browser zoom, for example 200%                              | Apply the responsive checks to the resulting layout width.                            |
| Light and Dark themes                                       | Existing colors, typography and control styling are preserved.                        |
| Reorder, edit, save, delete and reopen                      | Existing functionality persists and acts on the intended question.                    |
| Deck settings and active/completed sessions                 | Existing configuration, data and quiz behaviour are preserved.                        |
