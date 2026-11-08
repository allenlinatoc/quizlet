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

## Open product decisions

The following need agreement before detailed implementation and acceptance criteria are finalised:

- Can users create and delete decks, and does importing a QTI file create a new deck or add to an existing one?
- Which question types, answer formats, scoring rules and question details are supported?
- What does the assessment result include, and can users review individual answers or previous sessions?
- Can users skip questions, change answers, pause or abandon a session? When is a session considered complete?
- Are points awarded per question, and what exactly is shown when real-time points are enabled?
- Which QTI version and features must import and export support? How should unsupported content, partial imports and validation errors be handled?
- Are deck settings and question order included in QTI exports, where the chosen QTI profile permits them?
- Are accounts, shared decks, persistent storage or offline access required?
