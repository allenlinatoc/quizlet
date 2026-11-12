# Business requirements

## Purpose

Quizlet helps a person prepare for exams by maintaining quiz decks, practising questions, and reviewing results on their local computer.

## Terminology

- **Quiz deck:** A named collection of questions and practice settings.
- **Question:** A choice-based assessment item, its correct answer and an optional explanation.
- **Play session:** One attempt at the questions in a deck.
- **Assessment result:** The recorded outcome and answer review of a completed session.

## Product scope and storage

1. The app serves one person locally, without accounts or sharing, and stores decks, sessions, results and uploaded images persistently in SQLite.
2. The server listens on the local loopback interface. The data directory and server port can be configured.
3. Users can create a consistent database backup while the app is running or stopped and restore it with the app stopped.
4. On Windows, users can launch the app with the supplied launcher after installing Node.js 24. The launcher installs dependencies, builds the app and starts the local server.

## Quiz decks and questions

1. Users can create, select, view, rename and delete decks. The library shows deck and question counts and identifies decks with a session in progress.
2. Users can create, view, edit and delete questions, and arrange their order using the available reorder controls.
3. Questions support single-answer, multiple-answer and true/false choices. Prompts, choices and optional explanations support basic formatting, images and formulas.
4. Images support PNG, JPEG and WebP, up to 10 MiB and 25 megapixels. Users can enter LaTeX formulas and describe uploaded images for accessibility.
5. Deleting a deck abandons its active sessions but preserves completed results and their question snapshots.

## Deck settings

1. Each deck can present questions in arranged or random order; random order remains fixed for the session.
2. Each deck can show or hide answer feedback after submission and independently show or hide running points.
3. Each deck can keep answer choices in their original order or randomise them independently for each new session. The selected order remains fixed throughout that session and its result review.
4. New and existing decks default to arranged question and choice order, answer feedback and running points. Running points show points earned out of the total possible.

## Playing and results

1. Users can start a session for a deck, submit and lock answers, skip questions and return to unanswered questions.
2. Users can save and exit, resume or abandon an unfinished attempt, or start over.
3. Users can finish with unanswered questions after confirming that those questions earn zero points.
4. Each question is worth one point. A multiple-answer response earns its point only when the entire correct set is selected.
5. A completed session shows the score, percentage, counts and individual answer review. Completed sessions appear in study history and remain available after the source deck is changed or deleted.
6. Users can filter study history by deck, completion period and score, sort results, open the related quiz deck when available, and delete an individual completed result after confirmation. Filter selections are reflected in the URL.
7. A result links to its quiz deck when available and to study history filtered to its source deck. Results whose deck was deleted remain reviewable; older results without a recoverable deck identity are grouped together.

## Themes

1. Users can switch between Light and Dark themes throughout the app. Light is the default; the selected theme is saved in the browser and restored on later visits.

## QTI interchange

1. Users can export a deck to a QTI 3 ZIP package, including arranged question order, supported media and Quizlet-specific settings metadata.
2. Users can import a supported QTI package as a new deck or append its questions to an existing deck. Existing deck settings remain unless the user chooses to apply imported Quizlet settings.
3. Import and export support a subset of QTI 3: a single flat assessment section or item collection, choice interactions, explicit correct choices and `match_correct` scoring, with supported text formatting, images, presentation MathML and one general explanation. Import also supports a subset of QTI 1.2: one flat assessment section containing single-answer choice questions with explicit supported scoring, plain text and local images. Export remains QTI 3. The implementation is not certified by 1EdTech.
4. Import is all-or-nothing and reports errors without changing the destination. Unsupported content, external media URLs and XML entity declarations are rejected.
5. Packages are limited to 50 MiB compressed, 250 MiB expanded, 5,000 entries and 1,000 questions. Image limits also apply to imported media.

## Excel question import

1. Users can download an Excel template and import questions from an `.xlsx` workbook into a new deck or append them to an existing deck. Each populated row on the `Questions` sheet represents one question, and imported rows retain their order.
2. The template supports single-answer, multiple-answer and true/false questions, two to six text choices, correct-answer letters and an optional explanation. Excel import supports plain text; users can add formatting, formulas and images later in the question editor.
3. Before import, users can preview the questions and see row-level validation errors. An invalid workbook is rejected without changing any deck; correcting errors and uploading again is required.
4. Imports accept up to 1,000 questions and a 10 MiB workbook. Existing deck settings and session snapshots are preserved, and retrying the same import request does not create duplicate questions or decks.


## PDF-to-deck conversion

1. Users can upload a PDF of up to 250 MiB and 2,000 pages, select page ranges or suggested bookmark sections, and optionally identify up to 20 answer-key pages.
2. Users can extract existing choice questions or generate questions from selected study material. Generation supports a target count and difficulty. Users can produce one combined deck or separate decks by section.
3. Selected PDF pages are sent to the configured OpenAI service for processing. The user can inspect a cost estimate and set a job budget; costs and budget reservations are estimates and actual charges may exceed them.
4. Conversion jobs and drafts persist locally. Users can pause and resume processing and delete jobs. An interrupted request requires explicit confirmation before retry because it may have been billed.
5. Users review and edit questions, source pages, answers, explanations, formulas and relevant figure crops before publication. Flagged questions must be marked reviewed, and invalid or unanswered questions must be corrected or excluded.
6. Approved drafts produce QTI packages and playable decks through the existing QTI validation and import path. Repeated publication does not create duplicate decks. Published figures remain after the source job is deleted.
