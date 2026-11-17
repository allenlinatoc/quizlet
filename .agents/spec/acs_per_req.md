# Acceptance criteria per requirement

## Story no. 01 - Deck settings (5-8)

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

| Example input | Expected outcome |
| --- | --- |
| `0` | Accepted; no limit. |
| `1` or `5` | Accepted; positive whole number. |
| `20` for a deck with 10 questions | Accepted; the session count is capped as specified in AC5. |
| `-1` | Validation error; cannot save. |
| `1.5` | Validation error; cannot save. |
| `abc` | Validation error; cannot save. |

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
| --- | --- | --- |
| 10 | 1 | 1 |
| 10 | 4 | 4 |
| 10 | 10 | 10 |
| 10 | 20 | 10 |

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
