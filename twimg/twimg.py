import base64
import os
import re

from fastapi import FastAPI, HTTPException
from playwright.async_api import async_playwright

app = FastAPI()


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Twitter Scraper with auth.json"}


@app.get("/api/images")
async def get_images(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="URL required")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        if os.path.exists("auth.json"):
            print("Found auth.json, loading...")
            context = await browser.new_context(
                storage_state="auth.json",
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="ja-JP",
            )
        else:
            print("Warning: auth.json not found!")
            context = await browser.new_context(locale="ja-JP")
        page = await context.new_page()
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)

        try:
            print(f"Accessing: {url}")
            await page.goto(url, wait_until="commit", timeout=10000)
            try:
                await page.wait_for_selector("article", timeout=15000)
            except:
                print("Element wait timeout (Might be OK if content loaded)")

            await page.mouse.wheel(0, 1000)
            await page.wait_for_timeout(2000)

            # --- ここで状況証拠を保存 ---
            page_title = await page.title()

            # スクリーンショットをメモリ上に撮ってBase64にする
            screenshot_bytes = await page.screenshot(full_page=False)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")

            content = await page.content()
            pattern = (
                r"https?:(\\?\/){2}pbs\.twimg\.com\\?\/media\\?\/[a-zA-Z0-9?=&_\-%]+"
            )
            raw_matches = [m.group(0) for m in re.finditer(pattern, content)]
            clean_links = list(
                set([link.replace("\\", "").split("&")[0] for link in raw_matches])
            )

            return {
                "success": True,
                "count": len(clean_links),
                "title": page_title,  # 今のページタイトル
                "images": clean_links,
                "debug_screenshot": screenshot_b64,  # ★ここ画像データ
            }

        except Exception as e:
            print(f"Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            await browser.close()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
