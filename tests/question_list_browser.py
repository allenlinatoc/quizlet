"""Story 02 layout and question-management acceptance checks."""
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import expect


def check_question_list(page, base):
    def api(path, method="GET", data=None):
        response = page.request.fetch(f"{base}/api{path}", method=method, **({"data": data} if data is not None else {}))
        assert response.ok, f"{method} {path}: {response.status} {response.text()}"
        return None if response.status == 204 else response.json()

    def doc(text):
        return {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]}

    deck = api("/decks", "POST", {"name": "Story 02 question rows"})
    path = f"/decks/{deck['id']}"
    prompts = ["Short question?", "A long question with a readable preview and all its original content preserved. " * 12,
               "Unbroken" * 100,
               "A medium-length question that should wrap to two lines on a wide display while keeping its type and details directly below the complete preview."]
    for index in range(100):
        choices = [{"id": str(uuid4()), "content": doc(answer)} for answer in ["Yes", "No"]]
        api(f"{path}/questions", "POST", {
            "id": str(uuid4()), "type": ["single", "multiple", "boolean"][index % 3],
            "prompt": doc(prompts[index] if index < len(prompts) else f"Question {index+1}"),
            "choices": choices, "correctChoiceIds": [choices[0]["id"]], "explanation": doc("A saved explanation.")})
    settings = {"order": "arranged", "choiceOrder": "random", "itemLimit": 2, "showAnswers": True, "showPoints": True}
    deck = api(path, "PATCH", {"settings": settings})
    completed = api(f"{path}/sessions", "POST", {})
    completed = api(f"/sessions/{completed['id']}/complete", "POST", {"confirmUnanswered": True})
    active = api(f"{path}/sessions", "POST", {})

    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{base}{path}", wait_until="networkidle")
    rows = page.locator(".question-row")
    expect(rows).to_have_count(100)
    screenshots = Path(".tools/ui-review")
    screenshots.mkdir(parents=True, exist_ok=True)

    # AC1-AC5: measure actual rendered bounds at every width, for all 100 rows.
    def check_geometry(target_page=page):
        return target_page.evaluate("""() => {
            const rect = el => { const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
            const assert = (ok,message) => {if(!ok)throw new Error(message)};
            const rows=[...document.querySelectorAll('.question-row')];
            const reference=rows[0].querySelector('.edit-link').getBoundingClientRect();
            const numberX=rows[0].querySelector('.question-number').getBoundingClientRect().x;
            const controlsX=rows[0].querySelector('.reorder').getBoundingClientRect().x;
            assert(document.documentElement.scrollWidth<=innerWidth+1,'Page has horizontal overflow');
            const measurements=rows.map((row,i)=>{
                const r=rect(row), leading=rect(row.children[0]), preview=rect(row.querySelector('.question-preview'));
                const title=row.querySelector('.question-preview strong'), t=rect(title);
                const details=rect(row.querySelector('.question-preview small'));
                const action=row.querySelector('.edit-link'), a=rect(action), actions=rect(row.children[2]);
                const line=parseFloat(getComputedStyle(title).lineHeight);
                assert(row.children.length===3,`Row ${i+1}: three sections`);
                assert(Math.abs(a.right-reference.right)<1,`Row ${i+1}: Edit alignment`);
                assert(Math.abs(rect(row.querySelector('.question-number')).x-numberX)<1,`Row ${i+1}: number alignment`);
                assert(Math.abs(rect(row.querySelector('.reorder')).x-controlsX)<1,`Row ${i+1}: control alignment`);
                assert(leading.right<=preview.x+1 && preview.right<=actions.x+1,`Row ${i+1}: sections overlap`);
                assert(a.width>0 && getComputedStyle(action).display!=='none',`Row ${i+1}: hidden Edit`);
                assert(r.x>=-1 && r.right<=innerWidth+1 && actions.right<=r.right+1,`Row ${i+1}: row/actions overflow`);
                assert(preview.width>0 && title.scrollWidth<=title.clientWidth+1,`Row ${i+1}: text overflow`);
                assert(t.height<=2*line+1,`Row ${i+1}: more than two preview lines`);
                assert(details.y>=t.bottom-1 && details.bottom<=r.bottom+1,`Row ${i+1}: clipped/misaligned details`);
                assert(t.x>=preview.x && t.right<=preview.right+1,`Row ${i+1}: preview outside center`);
                assert(actions.x-preview.right<=17,`Row ${i+1}: excessive empty gap before actions`);
                if(i)assert(r.y>=rect(rows[i-1]).bottom,`Row ${i+1}: overlapping rows`);
                return {height:r.height,titleHeight:t.height,line,scrollHeight:title.scrollHeight,clientHeight:title.clientHeight};
            });
            assert(measurements[1].titleHeight>measurements[0].titleHeight,'Long preview does not wrap');
            assert(measurements[1].scrollHeight>measurements[1].clientHeight,'Long preview is not truncated');
            assert(measurements[1].height>measurements[0].height,'Row does not expand for two-line preview');
            return measurements;
        }""")

    theme_styles = {}
    for theme in ["light", "dark"]:
        page.get_by_label("Theme").select_option(theme)
        for width in [1280, 768, 640, 375]:
            page.set_viewport_size({"width": width, "height": 900})
            # Finish responsive sidebar transitions before capturing layout evidence.
            page.screenshot(path=str(screenshots / f"question-list-{theme}-{width}.png"), animations="disabled")
            measurements = check_geometry()
            if width == 1280:
                medium = measurements[3]
                assert abs(medium["titleHeight"] - 2 * medium["line"]) < 1
                assert medium["scrollHeight"] <= medium["clientHeight"] + 1
        theme_styles[theme] = rows.first.evaluate("""row => ({
            background:getComputedStyle(row).backgroundColor,
            radius:getComputedStyle(row).borderRadius,
            font:getComputedStyle(row.querySelector('strong')).fontSize,
            editColor:getComputedStyle(row.querySelector('.edit-link')).color
        })""")
    assert theme_styles["light"]["background"] == "rgb(255, 255, 255)"
    assert theme_styles["dark"]["background"] == "rgb(37, 38, 56)"
    assert all(style["radius"] == "11px" and style["font"] == "13px" for style in theme_styles.values())

    # A 1280px display at 200% zoom has a 640px effective layout at 2x scale.
    # Emulate those metrics in an isolated context without changing browser preferences.
    zoom_context = page.context.browser.new_context(viewport={"width": 640, "height": 450}, device_scale_factor=2)
    try:
        zoom_page = zoom_context.new_page()
        zoom_page.goto(f"{base}{path}", wait_until="networkidle")
        assert zoom_page.evaluate("({width:innerWidth, scale:devicePixelRatio})") == {"width": 640, "scale": 2}
        check_geometry(zoom_page)
        zoom_page.screenshot(path=str(screenshots / "question-list-200-percent-equivalent.png"), animations="disabled")
    finally:
        zoom_context.close()

    # AC8: viewing and resizing never mutates the deck, settings or snapshots.
    assert api(path) == deck
    assert api(f"/sessions/{active['id']}") == active
    assert api(f"/results/{completed['id']}") == completed
    page.get_by_role("button", name="Settings", exact=True).click()
    expect(page.get_by_label("Item Limit", exact=True)).to_have_value("2")
    expect(page.get_by_label("Choice order")).to_have_value("random")
    expect(page.get_by_label("Show correct answers")).to_be_checked()
    expect(page.get_by_label("Show points")).to_be_checked()
    page.get_by_role("button", name="Close settings").click()

    # AC6: reorder controls and drag/drop act on the intended rows and persist.
    page.set_viewport_size({"width": 1280, "height": 900})
    expect(page.get_by_label("Move question 1 up", exact=True)).to_be_disabled()
    expect(page.get_by_label("Move question 100 down", exact=True)).to_be_disabled()
    def order_response(response):
        return response.url == f"{base}/api{path}/order" and response.request.method == "PUT"
    with page.expect_response(order_response):
        page.get_by_label("Move question 1 down", exact=True).click()
    expected_ids = [q["id"] for q in deck["questions"]]
    expected_ids[0], expected_ids[1] = expected_ids[1], expected_ids[0]
    expect(rows.first.locator(".question-preview strong")).to_have_text(prompts[1])
    with page.expect_response(order_response):
        rows.nth(0).locator(".reorder").drag_to(rows.nth(2).locator(".reorder"))
    moved = expected_ids.pop(0)
    expected_ids.insert(2, moved)
    page.reload(wait_until="networkidle")
    assert [q["id"] for q in api(path)["questions"]] == expected_ids
    assert rows.locator(".question-number").all_text_contents() == [str(i).zfill(2) for i in range(1, 101)]

    # The truncated preview opens the correct full question; save and delete keep their existing flows.
    target = rows.filter(has=page.locator(".question-preview strong", has_text=prompts[1]))
    target.get_by_role("button", name="Edit", exact=True).click()
    expect(page).to_have_url(f"{base}{path}/questions/{deck['questions'][1]['id']}")
    editor = page.locator(".tiptap").first
    expect(editor).to_have_text(prompts[1].strip())
    editor.fill("Updated full question content")
    page.get_by_role("button", name="Save question").click()
    expect(rows).to_have_count(100)
    edited = rows.filter(has=page.locator(".question-preview strong", has_text="Updated full question content"))
    expect(edited).to_have_count(1)
    page.once("dialog", lambda dialog: dialog.dismiss())
    edited.get_by_label("Delete question", exact=True).click()
    expect(rows).to_have_count(100)
    page.once("dialog", lambda dialog: dialog.accept())
    edited.get_by_label("Delete question", exact=True).click()
    expect(rows).to_have_count(99)
    page.reload(wait_until="networkidle")
    expect(rows).to_have_count(99)
    saved = api(path)
    assert [q["id"] for q in saved["questions"]] == [id for id in expected_ids if id != deck["questions"][1]["id"]]
    assert saved["settings"] == settings
    assert api(f"/sessions/{active['id']}") == active
    assert api(f"/results/{completed['id']}") == completed

    # AC8: the existing session still resumes, scores and completes with its original two-question snapshot.
    page.get_by_role("button", name="Resume session").click()
    expect(page.get_by_text("Question 1 of 2", exact=True)).to_be_visible()
    page.locator(".answer-option").filter(has_text="Yes").click()
    page.get_by_role("button", name="Submit answer").click()
    expect(page.locator(".points-pill")).to_have_text("1 / 2 points")
    page.get_by_role("button", name="Save and exit").click()
    page.get_by_role("button", name="Resume session").click()
    expect(page.locator(".points-pill")).to_have_text("1 / 2 points")
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator(".finish-link").click()
    expect(page.get_by_text("50%", exact=True)).to_be_visible()
    expect(page.locator(".review-card")).to_have_count(2)
    print("Story 02 browser acceptance passed: AC1-AC8 (375/640/768/1280px, Light/Dark, 100 rows)")
