# Business requirements

## Purpose

Quizlet helps users prepare for exams by practising questions organised into quiz decks. Users can maintain their question content, play a deck, and review their assessment results.

## Terminology

- **Quiz deck:** A collection of questions and settings used for practice.
- **Question:** An assessment item within a quiz deck, including the information needed to present and assess it.
- **Play session:** One attempt at answering the questions in a deck.
- **Assessment result:** The outcome shown to the user after a play session.

## Requirements

### Quiz decks and questions

1. Users can select a quiz deck to practise.
2. Users can rename a quiz deck.
3. Users can create, view, update and delete questions within a quiz deck.
4. Users can define the arranged order of questions in a deck.

### Deck settings

Users can configure each deck to:

1. Present questions in their arranged order or in a randomised order when played.
2. Show or hide the correct answer after each question.
3. Show or hide points during a play session.

### Playing and results

1. Users can start a play session for a selected deck and answer its questions in the configured order.
2. During the session, the app applies the deck's answer and points display settings.
3. After a play session, the app shows the user an assessment result.

### QTI interchange

1. Users can export a quiz deck in QTI format.
2. Users can import questions from a QTI file into a quiz deck.
3. The app informs the user when an import cannot be completed.

## First-release product decisions

- The app serves one person on their local computer with persistent storage and no accounts or sharing. Decks can be created, renamed and deleted. Completed results survive deck deletion; active sessions are abandoned.
- Questions support single-answer, multiple-answer and true/false choices. Prompts, choices and optional explanations support basic formatting, raster images and formulas. A question is worth one point; multiple-answer responses require an exact set match.
- Users can submit and lock an answer, skip and revisit unanswered questions, resume or abandon an attempt, and finish early after confirming that unanswered questions earn zero. A completed result includes score, percentage, counts and an individual answer review. Completed attempts appear in history.
- Decks default to arranged order, immediate answer feedback and running points. Random order is fixed for the duration of a session. Running points show points earned out of the total possible.
- Import and export support the documented QTI 3 choice-question subset. Import is all-or-nothing and reports errors. Import can create a deck or append to an existing one; existing settings remain unless explicitly replaced. Exports contain arranged order, media and Quizlet-specific settings metadata.
