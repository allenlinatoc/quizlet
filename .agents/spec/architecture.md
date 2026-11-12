# Quizlet architecture

## Scope and runtime

Quizlet is a single-user local web application. The React and TypeScript SPA is built with Vite. A Node.js 24 Express server listens on loopback and serves both the built SPA and its JSON API. The default database is `data/quizlet.sqlite`; `QUIZLET_DATA_DIR` changes the data directory and `PORT` changes the port. Authentication, sharing and public hosting are outside the initial scope.

## Components and data

- The SPA handles deck management, accessible ordering controls, Tiptap question editing, practice, results and QTI transfers. KaTeX renders authored formulas.
- Server services validate requests, evaluate answers, control feedback visibility and handle QTI. Shared TypeScript types define decks, rich documents, questions and sessions.
- SQLite, accessed through `better-sqlite3`, stores each deck and immutable session snapshot as JSON records, and stores image blobs in a media table. Versioned migrations use SQLite's `user_version`; foreign keys, WAL and busy handling are enabled. Uploaded media is retained so completed snapshots remain readable.
- One active session per deck is enforced by a partial unique index. The server snapshots question content, ordering and settings, evaluates each locked response and persists progress. Results survive deck edits and deletion. Only completed results expose answer keys independently of feedback settings.
- A backup command uses SQLite's online backup API to copy the database, including media and results, consistently.
- Session snapshots retain a source-deck ID separately from the live deck reference. Legacy detached results are grouped without guessing identity. Choice order is selected independently of question order and stored in each session snapshot. Old JSON records and version-1 QTI metadata default missing choice-order settings to arranged.
- History filters and sort state are encoded in SPA URLs. The Light/Dark theme preference is stored in browser local storage and initialized before React renders; theme styles also cover PDF and Excel workflows.

## API

The `/api` JSON interface covers deck and question CRUD, complete question-order replacement, media upload/read, session start/read/navigation/response/complete/abandon, and completed result list/read/delete. Result deletion only removes a completed session; media remains available to other snapshots. QTI import accepts multipart uploads and export returns a ZIP. Errors use `{ error: { code, message } }`. The SPA uses history paths for deck, editor, session and result views; the server falls back to the SPA for non-API routes.

## QTI boundary

The adapter supports a bounded QTI 3 profile rather than the complete specification: a single flat test section or item collection, one choice interaction per item, identifier responses and `match_correct` scoring. It maps the supported rich content, local raster media, presentation MathML and one general explanation. Exports include a manifest-declared versioned Quizlet settings file. Existing-deck imports preserve settings unless explicitly told to apply imported settings. Invalid or unsupported packages fail before deck changes are committed.

The parser disables DTD/entity declarations, rejects archive traversal and external media references, and applies file, image and expansion limits. This profile has not been certified and does not claim general interoperability. See the README for the supported subset and restrictions.

## Excel question import

The library and deck views offer an Excel import dialog and a static workbook template. The server checks ZIP expansion and workbook limits, validates the `Questions` sheet and maps plain-text cells into the existing question model. Preview never changes a deck. Commit revalidates the workbook and appends questions or creates a deck in a transaction. A receipt stored in SQLite makes a retry with the same request ID repeat-safe; receipts persist with the database and backups. Excel parsing stays on the server.

## Verification and operations

`npm run typecheck`, `npm test` and `npm run build` cover type checking, API integration and production builds. The Python Playwright browser smoke test runs the built server against a temporary isolated database through the webapp-testing helper. The README documents setup, browser test prerequisites, backups and restore. Tests must never use the real database.


## PDF conversion

The PDF screen uses PDF.js for page previews, bookmarks and figure cropping. The server stores source PDFs, conversion state, drafts, usage and draft images in SQLite. A single in-process worker uses pdf-lib to prepare bounded page batches and answer-key pages. The OpenAI option sends those batches to a vision model with structured output. Adjacent pages provide context for questions spanning batch boundaries. Interrupted OpenAI requests are marked uncertain, estimated reservations count against the job budget, and retries require user confirmation. Cost limits are estimates, not provider-enforced spending caps.

The alternative text-extract-api adapter submits individual pages for OCR, persists task IDs and page text in SQLite, and submits page-labelled text to the configured Ollama model for question parsing. The service runs separately. Model output is validated before it becomes drafts; OCR task polling resumes from saved IDs. The service contract is covered by a simulated integration test but has not yet been verified against a live deployment. Local and OpenAI drafts share the same review, validation and QTI path.

Review uses the existing rich editor. Approved drafts are validated and exported as QTI, re-imported through the existing parser, and committed as decks and media in one SQLite transaction. PDF jobs and media participate in normal database backups. Model, API key and prices are configured server-side through environment variables documented in the README.
