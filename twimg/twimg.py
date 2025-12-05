import os
import json
import re
from fastapi import FastAPI, HTTPException
from playwright.async_api import async_playwright

app = FastAPI()

@app.get("/api/images")
async def get_images(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="URL required")

    cookies = []
    env_cookies = os.getenv("TWITTER_COOKIES")
    # 1. まず環境変数(Cloud Run用)を確認
    if env_cookies:
        try:
            data = json.loads(env_cookies)
            if isinstance(data, dict) and "cookies" in data:
                cookies = data["cookies"]
            elif isinstance(data, list):
                cookies = data
            print("Loaded cookies from Environment Variable.")
        except json.JSONDecodeError:
            print("Error: Env Cookie JSON parse error")
    elif os.path.exists("auth.json"):
        try:
            with open("auth.json", "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "cookies" in data:
                    cookies = data["cookies"]
                elif isinstance(data, list):
                    cookies = data
            print("Loaded cookies from local auth.json file.")
        except Exception as e:
            print(f"Error loading auth.json: {e}")

    async with async_playwright() as p:
        # ブラウザ起動
        browser = await p.chromium.launch(
            channel="chrome",
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        # コンテキスト作成 (UserAgent設定)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='ja-JP'
        )

        # Cookie設定
        if cookies:
            await context.add_cookies(cookies)

        page = await context.new_page()

        try:
            print(f"Accessing: {url}")
            # ページ移動
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)

            # ツイート表示待機
            try:
                await page.wait_for_selector('article', timeout=8000)
            except:
                print("Element wait timeout")

            # スクロール
            await page.mouse.wheel(0, 1000)
            await page.wait_for_timeout(1000)

            # --- 画像抽出 ---
            content = await page.content()

            pattern = r"https?:(\\?\/){2}pbs\.twimg\.com\\?\/media\\?\/[a-zA-Z0-9?=&_\-%]+"
            regex_matches = re.findall(pattern, content)
            
            # クリーニング処理 (バックスラッシュ除去 & '&'でカット)
            clean_regex_links = []
            # re.findallの結果がタプルになる場合があるので調整が必要だが、
            # シンプルに文字列マッチ全体を取得するには finditerを使うか、単純化する
            # ここではシンプルに再取得
            raw_matches = [m.group(0) for m in re.finditer(pattern, content)]
            
            clean_regex_links = [
                link.replace('\\', '').split('&')[0] for link in raw_matches
            ]
            

            # 重複排除 (setを使う)
            unique_links = list(set(clean_regex_links))

            return {
                "success": True,
                "count": len(unique_links),
                "images": unique_links
            }

        except Exception as e:
            print(f"Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            await browser.close()

# ローカル実行用
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)))