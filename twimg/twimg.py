import base64
import os
import re

from fastapi import FastAPI, HTTPException
from playwright.async_api import async_playwright

app = FastAPI()


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Twitter Scraper with auth.json"}


import base64
import os
import re
import sys
import asyncio
import json

from fastapi import FastAPI, HTTPException
from playwright.async_api import async_playwright

app = FastAPI()


async def scrape_twitter(url: str, scroll_count: int = 5):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        
        # 認証情報の読み込みロジック
        storage_state = None
        if os.path.exists("auth.json"):
            print("Found auth.json, loading...")
            storage_state = "auth.json"
        elif os.environ.get("TWITTER_AUTH_JSON"):
            print("Found TWITTER_AUTH_JSON env var, loading...")
            try:
                # 環境変数が生JSONかBase64か判別してロード
                env_val = os.environ["TWITTER_AUTH_JSON"]
                try:
                    storage_state = json.loads(env_val)
                except json.JSONDecodeError:
                    # JSONでなければBase64とみなしてデコード
                    decoded = base64.b64decode(env_val).decode("utf-8")
                    storage_state = json.loads(decoded)
            except Exception as e:
                print(f"Failed to load auth from env: {e}")

        if storage_state:
            context = await browser.new_context(
                storage_state=storage_state,
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

            tweets_data = []
            seen_tweet_sigs = set()

            for i in range(scroll_count):
                print(f"Scrolling {i+1}/{scroll_count}...")
                
                # --- ツイート抽出処理 (スクロールごとに実行) ---
                articles = await page.locator('article[data-testid="tweet"]').all()
                for article in articles:
                    try:
                        # User Name
                        user_name_locator = article.locator('[data-testid="User-Name"]')
                        user_info = await user_name_locator.inner_text() if await user_name_locator.count() > 0 else "(No User)"
                        
                        # Text
                        text_locator = article.locator('[data-testid="tweetText"]')
                        text = await text_locator.inner_text() if await text_locator.count() > 0 else "(No Text)"
                        
                        # Timestamp
                        time_locator = article.locator('time')
                        timestamp = await time_locator.get_attribute("datetime") if await time_locator.count() > 0 else "(No Time)"

                        # 重複チェック用の署名を作成
                        sig = f"{user_info}_{timestamp}_{text}"
                        
                        if sig not in seen_tweet_sigs:
                            seen_tweet_sigs.add(sig)
                            tweets_data.append({
                                "user_info": user_info.replace("\n", " "),
                                "text": text,
                                "timestamp": timestamp
                            })
                    except Exception as e:
                        # 要素が取得中に消えることもあるので無視して次へ
                        continue

                await page.mouse.wheel(0, 2000)
                await page.wait_for_timeout(2000)

            print(f"Total unique tweets collected: {len(tweets_data)}")

            # --- ここで状況証拠を保存 ---
            page_title = await page.title()

            # スクリーンショットをメモリ上に撮ってBase64にする
            screenshot_bytes = await page.screenshot(full_page=False)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")

            return {
                "success": True,
                "title": page_title,
                "debug_screenshot": screenshot_b64,
                "tweets": tweets_data
            }

        except Exception as e:
            print(f"Error: {e}")
            raise e
        finally:
            await browser.close()


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Twitter Scraper with auth.json"}


@app.get("/api/images")
async def get_images(url: str, scroll_count: int = 5):
    if not url:
        raise HTTPException(status_code=400, detail="URL required")
    
    try:
        return await scrape_twitter(url, scroll_count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        url = sys.argv[1]
        print(f"Running in CLI mode for URL: {url}")
        try:
            result = asyncio.run(scrape_twitter(url))
            print(f"Success! Title: {result['title']}")
            
            # CLI実行時はBase64画像を保存してみる（デバッグ用）
            with open("debug_screenshot.png", "wb") as f:
                f.write(base64.b64decode(result['debug_screenshot']))
            print("Screenshot saved to debug_screenshot.png")

            # ツイートを保存
            if "tweets" in result:
                with open("tweets.txt", "w", encoding="utf-8") as f:
                    for tweet in result["tweets"]:
                        f.write(f"User: {tweet['user_info']}\n")
                        f.write(f"Time: {tweet['timestamp']}\n")
                        f.write(f"Text: {tweet['text']}\n")
                        f.write("-" * 20 + "\n")
                print(f"Saved {len(result['tweets'])} tweets to tweets.txt")

        except Exception as e:
            print(f"Failed: {e}")
    else:
        import uvicorn

        port = int(os.getenv("PORT", 8080))
        uvicorn.run(app, host="0.0.0.0", port=port)
