"""Browser smoke test. Run through webapp-testing's with_server.py helper."""
from pathlib import Path
from tempfile import TemporaryDirectory
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ["QUIZLET_TEST_BASE"]

with sync_playwright() as playwright:
    chrome = os.environ.get("QUIZLET_CHROME_PATH")
    default_chrome = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    if not chrome and default_chrome.exists():
        chrome = str(default_chrome)
    browser = playwright.chromium.launch(headless=True, **({"executable_path": chrome} if chrome else {}))
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        page.goto(BASE, wait_until="networkidle")
        expect(page.get_by_role("heading", name="A little progress every day.")).to_be_visible()
        page.once("dialog", lambda dialog: dialog.accept("Biology"))
        page.get_by_role("button", name="Create a deck", exact=True).click()
        expect(page.get_by_role("heading", name="Biology")).to_be_visible()
        page.get_by_role("button", name="Add a question").click()
        editors = page.locator(".tiptap")
        expect(editors).to_have_count(4)
        editors.nth(0).fill("What makes leaves green?")
        def formula_dialog(dialog):
            dialog.accept("x^2") if dialog.type == "prompt" else dialog.dismiss()
        page.on("dialog", formula_dialog)
        page.locator(".rich-editor").first.get_by_role("button", name="Add formula").click()
        page.remove_listener("dialog", formula_dialog)
        expect(page.locator(".formula-preview").first).to_be_visible()
        editors.nth(1).fill("Chlorophyll")
        editors.nth(2).fill("Oxygen")
        editors.nth(3).fill("Chlorophyll absorbs light.")
        page.get_by_role("button", name="Mark choice 1 correct").click()
        page.get_by_role("button", name="Save question").click()
        expect(page.get_by_role("heading", name="Biology")).to_be_visible()
        expect(page.get_by_text("What makes leaves green?")).to_be_visible()
        page.reload(wait_until="networkidle")
        expect(page.get_by_text("What makes leaves green?")).to_be_visible()
        page.get_by_role("button", name="Start practicing").click()
        page.get_by_role("button", name="Chlorophyll").click()
        page.get_by_role("button", name="Submit answer").click()
        expect(page.get_by_text("That’s correct!")).to_be_visible()
        page.locator(".play-card").get_by_role("button", name="Finish session", exact=True).click()
        expect(page.get_by_text("100%")).to_be_visible()
        expect(page.get_by_text("Chlorophyll absorbs light.")).to_be_visible()
        page.get_by_role("button", name="Back to deck").click()
        with TemporaryDirectory(prefix="quizlet-browser-") as temp:
            with page.expect_download() as download_info:
                page.get_by_role("link", name="Export").click()
            exported = Path(temp) / "deck.zip"
            download_info.value.save_as(exported)
            page.get_by_role("button", name="All decks").click()
            with page.expect_file_chooser() as chooser:
                page.get_by_role("button", name="Import QTI").click()
            chooser.value.set_files(str(exported))
            expect(page.get_by_role("heading", name="Biology")).to_be_visible()
            expect(page.get_by_text("What makes leaves green?")).to_be_visible()
        page.get_by_role("button", name="Add question", exact=True).click()
        editors = page.locator(".tiptap")
        expect(editors).to_have_count(4)
        editors.nth(0).fill("What do roots absorb?")
        editors.nth(1).fill("Water")
        editors.nth(2).fill("Sunlight")
        page.get_by_role("button", name="Mark choice 1 correct").click()
        page.get_by_role("button", name="Save question").click()
        expect(page.get_by_role("heading", name="Biology")).to_be_visible()
        page.get_by_role("button", name="Start practicing").click()
        page.get_by_role("button", name="Skip", exact=True).click()
        expect(page.get_by_text("What do roots absorb?")).to_be_visible()
        page.get_by_role("button", name="Save and exit").click()
        page.get_by_role("button", name="Resume session").click()
        expect(page.get_by_text("What do roots absorb?")).to_be_visible()
        page.once("dialog", lambda dialog: dialog.accept())
        page.get_by_role("button", name="Finish session", exact=True).click()
        expect(page.get_by_text("0%")).to_be_visible()
        page.set_viewport_size({"width": 390, "height": 844})
        expect(page.get_by_role("button", name="Open navigation")).to_be_visible()
        page.get_by_role("button", name="Open navigation").click()
        page.get_by_role("navigation").get_by_role("button", name="Study history").click()
        expect(page.get_by_role("heading", name="Study history")).to_be_visible()
        assert not errors, f"Browser errors: {errors}"
        print("Browser smoke test passed")
    except Exception:
        Path(".tools").mkdir(exist_ok=True)
        page.screenshot(path=".tools/browser-failure.png", full_page=True)
        print("Browser errors:", errors)
        raise
    finally:
        browser.close()
