"""Story 01 acceptance checks, invoked by the isolated browser smoke test."""
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import expect


def check_item_limit(page, base):
    def api(path, method="GET", data=None):
        response = page.request.fetch(f"{base}/api{path}", method=method, **({"data": data} if data is not None else {}))
        assert response.ok, f"{method} {path}: {response.status} {response.text()}"
        return None if response.status == 204 else response.json()

    def doc(text):
        return {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]}

    deck = api("/decks", "POST", {"name": "Story 01 Item Limit"})
    other = api("/decks", "POST", {"name": "Story 01 separate settings"})
    deck_path = f"/decks/{deck['id']}"
    questions = []
    for index in range(10):
        yes, no = str(uuid4()), str(uuid4())
        question = {"id": str(uuid4()), "type": "single", "prompt": doc(f"Limit question {index+1}"),
                    "choices": [{"id": yes, "content": doc(f"Yes {index+1}")}, {"id": no, "content": doc(f"No {index+1}")}],
                    "correctChoiceIds": [yes], "explanation": doc(f"Explanation {index+1}")}
        api(f"{deck_path}/questions", "POST", question)
        questions.append(question)

    page.set_viewport_size({"width": 1280, "height": 900})

    def open_settings():
        page.goto(f"{base}{deck_path}", wait_until="networkidle")
        page.get_by_role("button", name="Settings", exact=True).click()
        expect(page.get_by_role("heading", name="Deck settings")).to_be_visible()

    def saved(response):
        return response.url == f"{base}/api{deck_path}" and response.request.method == "PATCH"

    def save_limit(value):
        field = page.get_by_label("Item Limit", exact=True)
        field.fill(value)
        with page.expect_response(saved) as response:
            field.press("Tab")
        assert response.value.ok
        expect(field).to_have_value(str(int(value or "0")))
        assert api(deck_path)["settings"]["itemLimit"] == int(value or "0")

    open_settings()
    # AC1, AC3, AC10: exact placement, helper text, numeric semantics and existing defaults.
    assert page.locator(".setting-row strong").all_text_contents() == [
        "Question order", "Choice order", "Item Limit", "Show correct answers", "Show points"]
    field = page.get_by_label("Item Limit", exact=True)
    expect(field).to_have_attribute("type", "number")
    expect(field).to_have_attribute("min", "0")
    expect(field).to_have_attribute("step", "1")
    expect(field).to_have_value("0")
    expect(page.get_by_text("0 = No limit (include all questions).", exact=True)).to_be_visible()
    expect(page.get_by_label("Question order")).to_have_value("arranged")
    expect(page.get_by_label("Choice order")).to_have_value("arranged")
    expect(page.get_by_label("Show correct answers")).to_be_checked()
    expect(page.get_by_label("Show points")).to_be_checked()

    # AC2: invalid input is explained and never persisted, including an incomplete exponent.
    for value in ["-1", "1.5", "1e22"]:
        field.fill(value)
        field.press("Tab")
        expect(field).to_have_attribute("aria-invalid", "true")
        expect(page.get_by_role("alert")).to_have_text("Enter a non-negative whole number.")
        assert api(deck_path)["settings"]["itemLimit"] == 0
    field.fill("")
    field.press("e")
    field.press("Tab")
    expect(page.get_by_role("alert")).to_have_text("Enter a non-negative whole number.")
    assert api(deck_path)["settings"]["itemLimit"] == 0
    save_limit("5")
    # AC3, AC7: blank saves as zero, saves are per deck and survive reopening/reloading.
    save_limit("")
    save_limit("4")
    assert api(f"/decks/{other['id']}")["settings"]["itemLimit"] == 0
    page.get_by_role("button", name="Close settings").click()
    page.get_by_role("button", name="Settings", exact=True).click()
    expect(field).to_have_value("4")
    open_settings()
    expect(field).to_have_value("4")

    # AC1, AC10: inspect the same settings row in both themes and on mobile.
    screenshots = Path(".tools/ui-review")
    screenshots.mkdir(parents=True, exist_ok=True)
    for theme in ["light", "dark"]:
        page.get_by_label("Theme").select_option(theme)
        page.screenshot(path=str(screenshots / f"item-limit-{theme}.png"), full_page=True, animations="disabled")
    page.set_viewport_size({"width": 390, "height": 844})
    expect(field).to_be_visible()
    bounds = field.bounding_box()
    assert bounds and bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= 390
    page.screenshot(path=str(screenshots / "item-limit-mobile-dark.png"), full_page=True, animations="disabled")
    page.set_viewport_size({"width": 1280, "height": 900})

    # AC4-AC6, AC8: boundary counts drive progress, points and question navigation.
    for limit, total in [(0, 10), (1, 1), (4, 4), (10, 10), (20, 10)]:
        open_settings()
        save_limit(str(limit))
        page.get_by_role("button", name="Start practicing").click()
        expect(page.get_by_text(f"Question 1 of {total}", exact=True)).to_be_visible()
        expect(page.locator(".points-pill")).to_have_text(f"0 / {total} points")
        expect(page.locator(".question-nav button")).to_have_count(total)
        session_id = page.url.rsplit("/", 1)[1]
        session = api(f"/sessions/{session_id}")
        assert [q["id"] for q in session["questions"]] == [q["id"] for q in questions[:total]]
        api(f"/sessions/{session_id}/abandon", "POST", {})

    # AC8, AC9: 3/4 = 75%, active snapshots survive changes, and future sessions use the new limit.
    open_settings()
    field.fill("4")
    # Clicking Start directly also commits the field before starting the session.
    page.get_by_role("button", name="Start practicing").click()
    expect(page.get_by_text("Question 1 of 4", exact=True)).to_be_visible()
    session_id = page.url.rsplit("/", 1)[1]
    for index in range(4):
        page.locator(".answer-option").filter(has_text=f"{'No' if index == 3 else 'Yes'} {index+1}").click()
        page.get_by_role("button", name="Submit answer").click()
        expect(page.locator(".feedback")).to_be_visible()
        if index < 3:
            page.get_by_role("button", name="Next question").click()
    expect(page.locator(".points-pill")).to_have_text("3 / 4 points")
    snapshot = api(f"/sessions/{session_id}")
    assert len(snapshot["responses"]) == 4
    page.get_by_role("button", name="Save and exit").click()
    page.get_by_role("button", name="Settings", exact=True).click()
    save_limit("2")
    page.get_by_role("button", name="Resume session").click()
    expect(page.get_by_text("Question 4 of 4", exact=True)).to_be_visible()
    assert api(f"/sessions/{session_id}") == snapshot
    page.locator(".play-card").get_by_role("button", name="Finish session", exact=True).click()
    expect(page.get_by_text("75%", exact=True)).to_be_visible()
    expect(page.locator(".review-card")).to_have_count(4)
    result = api(f"/results/{session_id}")
    page.screenshot(path=str(screenshots / "item-limit-result.png"), full_page=True, animations="disabled")

    # AC6, AC9, AC10: random subset and choice order persist on resume and in result review.
    open_settings()
    for label in ["Question order", "Choice order"]:
        with page.expect_response(saved):
            page.get_by_label(label).select_option("random")
    for label in ["Show correct answers", "Show points"]:
        with page.expect_response(saved):
            page.get_by_label(label).click()
        expect(page.get_by_label(label)).not_to_be_checked()
    assert api(f"/results/{session_id}") == result
    page.get_by_role("button", name="Start practicing").click()
    expect(page.get_by_text("Question 1 of 2", exact=True)).to_be_visible()
    expect(page.locator(".points-pill")).to_have_count(0)
    random_id = page.url.rsplit("/", 1)[1]
    random_session = api(f"/sessions/{random_id}")
    assert len({q["id"] for q in random_session["questions"]}) == 2
    choices = page.locator(".answer-option .rich-content").all_text_contents()
    page.locator(".answer-option").first.click()
    page.get_by_role("button", name="Submit answer").click()
    expect(page.get_by_text("Answer submitted", exact=True)).to_be_visible()
    expect(page.locator(".feedback")).to_have_count(0)
    page.get_by_role("button", name="Save and exit").click()
    page.get_by_role("button", name="Resume session").click()
    expect(page.get_by_text("Question 1 of 2", exact=True)).to_be_visible()
    assert page.locator(".answer-option .rich-content").all_text_contents() == choices
    assert api(f"/sessions/{random_id}")["questions"] == random_session["questions"]
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator(".finish-link").click()
    expect(page.locator(".review-card")).to_have_count(2)
    completed = api(f"/results/{random_id}")
    assert [[c["id"] for c in q["choices"]] for q in completed["questions"]] == [
        [c["id"] for c in q["choices"]] for q in random_session["questions"]]
    assert api(deck_path)["questions"] == questions
    print("Story 01 browser acceptance passed: AC1-AC10")
