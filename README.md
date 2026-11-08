# Quizlet

A personal study app for building decks, practicing choice questions and reviewing past results. It runs a local Node.js server and keeps decks, sessions and uploaded images in SQLite.

## Run on Windows

Install Node.js 24, open PowerShell in this directory, and run:

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
