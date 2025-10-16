from playwright.sync_api import sync_playwright

url = "https://x.com/ikegpg/status/1978694394694758600"

with sync_playwright() as p:
    browser = p.firefox.launch(headless=True)
    page = browser.new_page()
    page.goto(url)
    page.wait_for_selector("img[src*='twimg.com']")
    imgs = page.locator("img[src*='twimg.com']").all()
    for img in imgs:
        print(img.get_attribute("src"))
