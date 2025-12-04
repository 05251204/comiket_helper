const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

(async () => {
  // ユーザーデータを保存するフォルダを指定
  const userDataDir = './my_twitter_profile';

  console.log('本物のChromeを起動します...');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,       // 画面を表示
    channel: 'chrome',
    viewport: null,        // ウィンドウサイズを固定しない
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await context.newPage();

  console.log('Twitterログイン画面へ移動します。');
  console.log('ユーザー名とパスワードでログインを試みてください。');

  await page.goto('https://twitter.com/i/flow/login');

  try {
    await page.waitForURL('**/home', { timeout: 0 });
    console.log('🎉 ログイン成功！');

    const storageState = await context.storageState({ path: 'auth.json' });
    console.log('ログイン情報を保存しました。');

  } catch (e) {
    console.log('タイムアウト、またはウィンドウが閉じられました。');
  }

  console.log('5秒後にブラウザを閉じます...');
  await page.waitForTimeout(5000);
  await context.close();
})();