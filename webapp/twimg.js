const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const fs = require('fs');


function find_twimg_link(targetUrl) {
  links = []
    (async () => {
      const userDataDir = './my_twitter_profile';
      if (!fs.existsSync(userDataDir)) {
        console.error('エラー: プロフィールフォルダが見つかりません。先に login_real.js でログインしてください。');
        return;
      }

      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        channel: 'chrome',
        viewport: null,
      });

      const page = await context.newPage();

      try {
        console.log(`アクセス中: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

        try {
          await page.waitForSelector('article', { timeout: 15000 });
        } catch (e) {
          console.error('エラー: ツイートの読み込みに失敗しました。URLを確認してください。');
          return;
        }

        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(2000);

        const content = await page.content();

        // Regex
        const looseRegex = /https?:(\\?\/){2}pbs\.twimg\.com\\?\/media\\?\/[a-zA-Z0-9?=&_\-%]+/g;
        const regexMatches = content.match(looseRegex) || [];
        const cleanRegexLinks = regexMatches.map(link => link.replace(/\\/g, '').split('&')[0]);

        const allLinks = [...new Set([...cleanRegexLinks])];
        console.log(`検出数: ${allLinks.length} 件`);
        for (link in allLinks) {
          console.log(allLinks[link]);
          link.push(allLinks[link]);
        }

      } catch (error) {
        console.error('エラー:', error);
      } finally {
        await context.close();
      }
    })();
  return links;
}

find_twimg_link("https://x.com/sports930/status/1996339485165171093")