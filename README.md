# Quizlet

A personal study app for building decks, practicing choice questions and reviewing past results. It runs a local Node.js server and keeps decks, sessions and uploaded images in SQLite.

## Run on Windows

Install Node.js 24 and double-click `start-quizlet.bat`. It installs dependencies, builds the app, and opens it in your browser. Keep the launcher window open while using the app; press Ctrl+C to stop the server.

Alternatively, open PowerShell in this directory and run:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

Open <http://127.0.0.1:3001>. Stop the server with Ctrl+C. For development, run `npm.cmd run dev` and open the Vite URL printed in the terminal. The server listens on loopback only; do not expose it to a network without adding authentication.

Data is stored in `data/quizlet.sqlite` by default, including uploaded images. Set `QUIZLET_DATA_DIR` before starting the server to select a different data directory. Set `PORT` to change the server port. The default data directory and build outputs are ignored by Git.

## Practice

Create a deck and add single-answer, multiple-answer or true/false questions. Question prompts, choices and optional explanations support basic formatting, PNG/JPEG/WebP images and LaTeX formulas. Mark the correct choices, and use the arrow controls or drag a question to arrange the deck.

Each question is worth one point. Multiple-answer questions require the entire correct set. You can skip questions and return to them, resume an unfinished attempt, or finish early after confirming that unanswered questions earn zero points. The deck settings control question order, immediate answer feedback and running points. Completed sessions retain a snapshot for later review, even after the source deck is edited or deleted.

## Create decks from PDFs

Choose **Create from PDF** in the sidebar. Upload a PDF, choose pages or bookmark-based sections, and choose whether to extract existing questions or generate questions from study material. You can provide separate answer-key pages and create one deck or a deck per section. Review the drafts, source pages and suggested figures before creating decks or downloading QTI packages.

Choose **OpenAI** or **Local extraction service** in conversion settings. For OpenAI, selected pages, including their text and page images, are sent to the OpenAI API. Copy `.env.example` to `.env` in the project directory, then fill in the API key, a vision-capable model that supports Responses API structured outputs, and its current input and output prices in US dollars per million tokens. The launcher and npm commands load `.env` automatically. Existing environment variables take precedence. Restart the server after changing the file.

The `.env` file is ignored by Git; keep your API key private. The job budget defaults to US$5 and can be changed. Costs and per-batch reservations are estimates based on the configured prices and page count; actual API charges can exceed the budget. Check the provider's current prices and account limits. If a request is interrupted or fails, its estimated reservation remains counted against the job budget, and retrying requires confirmation because it may have been billed.

### Local PDF extraction service

The alternative uses [text-extract-api](https://github.com/CatchTheTornado/text-extract-api) and an Ollama model; it does not require OpenAI credentials. Install and start Docker Desktop with WSL 2, and install Git. In `vendor/text-extract-api`, run `start.bat` to download the pinned service source if needed, build and start the API, worker, Redis and Ollama, and pull `llama3.1`. The first run downloads substantial dependencies and model data. Use `stop.bat` to stop the containers; downloaded models are retained. The wrapper publishes the API on `127.0.0.1:8000` and keeps Redis and Ollama on its internal Docker network. It uses the CPU-oriented configuration; processing may be slow and requires adequate RAM and disk space. The integration and wrapper have not yet been verified against a live deployment.

Set `TEXT_EXTRACT_API_URL=http://127.0.0.1:8000` in `.env` and restart Quizlet. Optional strategy, OCR language, parsing model, polling and timeout settings are shown in `.env.example`; the initial defaults are `easyocr`, `en` and `llama3.1`. Evaluate the selected model against representative PDFs. Quizlet sends selected pages individually for OCR, then sends page-labelled text to the configured model to build drafts. The extraction service is marked configured when its URL and settings are present; this does not confirm that it is running or has the necessary models.

The wrapper installs `llama3.1` automatically. If `TEXT_EXTRACT_OLLAMA_MODEL` is changed, install the matching model in the wrapper's Ollama container with `docker compose -p quizlet-text-extract -f vendor/text-extract-api/compose.yaml exec ollama ollama pull MODEL_NAME`. To troubleshoot, run `docker compose -p quizlet-text-extract -f vendor/text-extract-api/compose.yaml logs` from the Quizlet directory.

Use a trusted service bound to loopback, and keep Redis and Ollama inaccessible from the network. Review the upstream deployment's authentication and storage configuration before using a remote host; a remote service receives the PDF content. Quizlet requests OCR with caching and storage disabled, but service logs and its own infrastructure may retain data. The local path has no OpenAI token charges; it uses the configured infrastructure and its resources. A paused OCR task can continue at the service, and retrying interrupted work can repeat computation. Deleting a Quizlet job removes its local checkpoints but does not cancel or clear data held by the service.

PDF jobs, source PDFs and draft figures are stored in the SQLite database and included in backups. Deleting a job removes its source and drafts; figures in published decks remain. PDFs are limited to 250 MiB and 2,000 pages, with up to 20 separate answer-key pages. Password-protected or damaged files cannot be processed. Review source references, answer keys, formulas and images: extraction and generated answers can be inaccurate.

## QTI import and export

The app supports a **subset of QTI 3 ZIP packages**: a single flat assessment section or an item collection, with choice interactions, explicit correct choices and `match_correct` scoring. Text, supported formatting, packaged PNG/JPEG/WebP images, supported presentation MathML and one general explanation are supported. Exports include arranged question order and a versioned `quizlet-settings.json` file with the deck settings. Other applications may ignore that file. This implementation has not been certified by 1EdTech.

Importing from the library creates a deck. Importing into a deck appends questions and keeps its settings unless **Apply settings from imported Quizlet packages** is selected. Import is transactional: an invalid or unsupported package reports an error without changing the destination. Unsupported examples include QTI 2.x, custom scoring, multiple sections, choice shuffling, conditional feedback and other interaction types. Media paths must be local to the package; external URLs and XML entity declarations are rejected.

Images are limited to 10 MiB and 25 megapixels. QTI packages are limited to 50 MiB compressed, 250 MiB expanded, 5,000 entries and 1,000 questions. Not all QTI content or formatting produced by other applications is supported; check an exported deck in the destination application before relying on interoperability.

## Backup and restore

Create a consistent SQLite backup, including images and results, while the app is running or stopped:

```powershell
npm.cmd run backup -- C:/Backups/quizlet-backup.sqlite
```

Choose a new filename in an existing directory; the command refuses to overwrite an existing file. To restore, stop the server, move the existing data directory aside, create a fresh data directory, and copy the backup into it as `quizlet.sqlite`. Start the app and verify the decks and history. Keep backups in a separate location from the original database.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
python -m pip install playwright
python -m playwright install chromium
npm.cmd run test:browser
```

Browser tests use the repository's `webapp-testing` helper, start the production build on an available local port and use a temporary database. They use Chrome at its normal Windows installation path if available, or Playwright's installed Chromium; set `QUIZLET_CHROME_PATH` to use a different Chromium executable. Failure screenshots are saved to `.tools/browser-failure.png`. The local portable interpreter installed during development can also run the test with `.tools/python/python.exe tests/run_browser.py`.
