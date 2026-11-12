"""Run the browser smoke test against a production build and isolated database."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import secrets
import time
import urllib.request
import urllib.error
from tempfile import TemporaryDirectory

root = Path(__file__).resolve().parent.parent
helper = root / ".agents/skills/vendor/webapp-testing/scripts/with_server.py"
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
with TemporaryDirectory(prefix="quizlet-browser-db-") as temp:
    environment = os.environ.copy()
    token = secrets.token_hex(24)
    environment.update(PORT=str(port), QUIZLET_DATA_DIR=temp, QUIZLET_TEST_BASE=f"http://127.0.0.1:{port}", QUIZLET_TEST_SHUTDOWN_TOKEN=token)
    environment.update(OPENAI_API_KEY="test-only", OPENAI_PDF_MODEL="test-only", OPENAI_PDF_INPUT_PRICE_PER_MILLION="1", OPENAI_PDF_OUTPUT_PRICE_PER_MILLION="1")
    environment.update(TEXT_EXTRACT_API_URL="http://127.0.0.1:18001")
    command = [sys.executable, str(helper), "--server", "npm run start", "--port", str(port), "--", sys.executable, str(root / "tests/browser.py")]
    try:
        result = subprocess.run(command, cwd=root, env=environment, check=False).returncode
    finally:
        try:
            request = urllib.request.Request(f"http://127.0.0.1:{port}/api/test-shutdown", method="POST", headers={"Authorization": f"Bearer {token}"})
            urllib.request.urlopen(request, timeout=2).close()
        except (OSError, urllib.error.URLError):
            pass
        for _ in range(50):
            with socket.socket() as check:
                if check.connect_ex(("127.0.0.1", port)) != 0:
                    break
            time.sleep(0.1)
    raise SystemExit(result)
