import { labelOptions } from "./config.js";
import { showFeedback, distinct_space, calc_dist } from "./utils.js";
import { fetchSheetData, postUpdate } from "./api.js";
import { state } from "./state.js";
import { solveTsp } from "./tsp.js";

// --- 初期化処理 ---
document.addEventListener("DOMContentLoaded", () => {
  const gasUrlInput = document.getElementById("gas-url-input");
  const savedUrl = localStorage.getItem("webAppURL");

  if (savedUrl) gasUrlInput.value = savedUrl;

  let debounceTimeout;
  gasUrlInput.addEventListener("input", () => {
    clearTimeout(debounceTimeout);
    localStorage.setItem("webAppURL", gasUrlInput.value);
    debounceTimeout = setTimeout(() => {
      if (gasUrlInput.value) loadDataAndInitialize();
    }, 500);
  });

  updateLabelOptions(); // 初期表示更新

  if (gasUrlInput.value) {
    loadDataAndInitialize();
  } else {
    document.getElementById("loading").textContent =
      "Google Apps ScriptのURLを入力してください。";
  }

  setupEventListeners();
});

// --- データ読み込み ---
async function loadDataAndInitialize(forceRefresh = false) {
  const webAppURL = document.getElementById("gas-url-input").value;
  if (!webAppURL) return;

  if (!forceRefresh) {
    const savedComiketData = localStorage.getItem("comiketData");
    if (savedComiketData) {
      try {
        state.comiketData = JSON.parse(savedComiketData);
        // データ構造のチェック
        if (!state.comiketData.wantToBuy) state.comiketData.wantToBuy = [];

        updateAllCounts();
        document.getElementById("loading").textContent =
          "ローカルデータから準備完了。";
        return;
      } catch (e) {
        console.error("Parse error", e);
      }
    }
  }

  document.getElementById("loading").textContent = "読み込み中...";
  try {
    const data = await fetchSheetData(webAppURL);
    state.comiketData.wantToBuy = data.wantToBuy || [];
    state.saveComiketData();
    updateAllCounts();
    document.getElementById("loading").textContent = "準備完了。";
  } catch (error) {
    console.error(error);
    document.getElementById("loading").textContent = "読み込み失敗";
  }
}

// --- イベントリスナー設定 ---
function setupEventListeners() {
  // UI操作無効化
  document
    .querySelectorAll("button")
    .forEach((b) => b.addEventListener("click", (e) => e.preventDefault()));
  document.addEventListener("submit", (e) => e.preventDefault());

  // リセットボタン系
  document
    .getElementById("hold-counter-container")
    .addEventListener("click", () => {
      if (state.holdList.length === 0) return;
      if (confirm(`${state.holdList.length}件の保留をリセットしますか？`)) {
        state.holdList = [];
        state.saveHold();
        state.actionHistory = state.actionHistory.filter(
          (a) => a.type !== "hold"
        );
        state.saveHistory();
        showFeedback("保留をリセットしました");
        updateAllCounts();
        updateNextTarget();
      }
    });

  // 各種ボタン
  document
    .getElementById("current-ewsn")
    .addEventListener("change", updateLabelOptions);
  document
    .getElementById("purchased-btn")
    .addEventListener("click", handlePurchase);
  document.getElementById("hold-btn").addEventListener("click", handleHold);
  document.getElementById("undo-btn").addEventListener("click", handleUndo);
  document
    .getElementById("reset-list-btn")
    .addEventListener("click", handleResetList);
  document
    .getElementById("refresh-data-btn")
    .addEventListener("click", () => loadDataAndInitialize(true));
  document
    .getElementById("search-button")
    .addEventListener("click", updateNextTarget);
}

// --- UI更新ヘルパー ---
function updateLabelOptions() {
  const hallSelect = document.getElementById("current-ewsn");
  const labelSelect = document.getElementById("current-label");
  const selectedHall = hallSelect.value;

  labelSelect.innerHTML = "";
  const options = labelOptions[selectedHall] || [];
  options.forEach((val) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val;
    labelSelect.appendChild(option);
  });
}

function updateAllCounts() {
  const unvisited = state.comiketData.wantToBuy.filter(
    (c) =>
      !state.purchasedList.includes(c.space) &&
      !state.holdList.includes(c.space)
  );

  const counts = { 東456: 0, 東7: 0, 西12: 0, 南12: 0 };
  unvisited.forEach((circle) => {
    const [ewsn, label] = distinct_space(circle.space);
    for (const key in labelOptions) {
      if (key.startsWith(ewsn) && labelOptions[key].includes(label)) {
        counts[key]++;
        break;
      }
    }
  });

  document.getElementById("count-E456").textContent = counts["東456"];
  document.getElementById("count-E7").textContent = counts["東7"];
  document.getElementById("count-W12").textContent = counts["西12"];
  document.getElementById("count-S12").textContent = counts["南12"];
  document.getElementById("count-hold").textContent = state.holdList.length;
}

// --- アクションハンドラ ---
function handlePurchase() {
  if (!state.currentTarget || !state.currentTarget.space) return;
  const space = state.currentTarget.space;
  const url = document.getElementById("gas-url-input").value;

  postUpdate(url, { space: space })
    .then((data) => console.log("Updated:", data))
    .catch((err) => console.error(err));

  state.purchasedList.push(space);
  state.savePurchased();

  state.actionHistory.push({ type: "purchase", space: space });
  state.saveHistory();

  showFeedback(`${space} を購入済にしました`);
  updateNextTarget();
}

function handleHold() {
  if (!state.currentTarget || !state.currentTarget.space) return;
  const space = state.currentTarget.space;

  state.holdList.push(space);
  state.saveHold();

  state.actionHistory.push({ type: "hold", space: space });
  state.saveHistory();

  showFeedback(`${space} を保留にしました`);
  updateNextTarget();
}

function handleUndo() {
  if (state.actionHistory.length === 0) {
    showFeedback("戻す操作がありません");
    return;
  }
  const lastAction = state.actionHistory.pop();
  state.saveHistory();

  if (lastAction.type === "purchase") {
    const idx = state.purchasedList.lastIndexOf(lastAction.space);
    if (idx > -1) {
      state.purchasedList.splice(idx, 1);
      state.savePurchased();

      const url = document.getElementById("gas-url-input").value;
      postUpdate(url, { space: lastAction.space, undo: true });
      showFeedback(`${lastAction.space} の購入を取り消しました`);
    }
  } else if (lastAction.type === "hold") {
    const idx = state.holdList.lastIndexOf(lastAction.space);
    if (idx > -1) {
      state.holdList.splice(idx, 1);
      state.saveHold();
      showFeedback(`${lastAction.space} の保留を取り消しました`);
    }
  }
  updateNextTarget();
}

function handleResetList() {
  if (state.purchasedList.length === 0) return;
  if (confirm("購入リストをリセットしますか？")) {
    const url = document.getElementById("gas-url-input").value;
    const items = [...state.purchasedList];

    if (items.length > 0) {
      postUpdate(url, { spaces: items, undo: true });
    }

    state.purchasedList = [];
    state.savePurchased();
    state.actionHistory = state.actionHistory.filter(
      (a) => a.type !== "purchase"
    );
    state.saveHistory();

    showFeedback("リセットしました");
    updateNextTarget();
  }
}

// --- メインロジック: 次の目的地検索 ---
function updateNextTarget() {
  const url = document.getElementById("gas-url-input").value;
  if (!url) return;

  updateAllCounts();

  const currentEWSN = document.getElementById("current-ewsn").value;
  const currentLabel = document.getElementById("current-label").value;
  const currentNumber = document.getElementById("current-number").value;

  document.getElementById("loading").textContent = "検索中...";
  document.getElementById("target-info").style.display = "block";

  // 未訪問リスト
  const remaining = state.comiketData.wantToBuy.filter(
    (c) =>
      !state.purchasedList.includes(c.space) &&
      !state.holdList.includes(c.space)
  );

  if (remaining.length === 0) {
    document.getElementById("loading").textContent = "完了";
    state.currentTarget = null;
    // UIクリア処理などをここに記述
    return;
  }

  // UIブロックを防ぐためsetTimeoutで実行
  setTimeout(() => {
    const startNode = {
      space: `${currentEWSN[0]}${currentLabel}${currentNumber}`,
      isStart: true,
    };
    const nodes = [startNode, ...remaining];
    const path = solveTsp(nodes);

    const nextCircle = path.length > 1 ? path[1] : null;

    if (!nextCircle) {
      state.currentTarget = null;
      document.getElementById("loading").textContent = "完了";
      return;
    }

    state.currentTarget = nextCircle;

    // 距離計算（表示用）
    const [h1, l1, n1] = distinct_space(startNode.space);
    const [h2, l2, n2] = distinct_space(nextCircle.space);
    const dist = calc_dist(
      h1[0],
      l1,
      parseFloat(n1),
      h2[0],
      l2,
      parseFloat(n2)
    );

    // UI反映
    document.getElementById("loading").textContent = "";
    document.getElementById("target-space-heading").textContent =
      nextCircle.space;
    document.getElementById("target-distance").textContent = dist;
    document.getElementById("target-priority").textContent =
      nextCircle.priority || "N/A";

    const userLink = document.getElementById("target-user");
    userLink.textContent = nextCircle.account
      ? nextCircle.account.split("/").pop()
      : "Link";
    userLink.href = nextCircle.account || "#";

    const tweetContainer = document.getElementById("target-tweet-container");
    tweetContainer.innerHTML = "";
    if (nextCircle.tweet) {
      const link = document.createElement("p");
      link.innerHTML = `<a href="${nextCircle.tweet}" target="_blank">Tweet Link</a>`;
      tweetContainer.appendChild(link);

      // Twitter Embedがあれば再実行
      if (window.twttr && window.twttr.widgets) {
        const id = nextCircle.tweet.match(/status\/(\d+)/);
        if (id && id[1]) {
          const div = document.createElement("div");
          tweetContainer.appendChild(div);
          window.twttr.widgets.createTweet(id[1], div, { theme: "light" });
        }
      }
    } else {
      tweetContainer.innerHTML =
        "<p style='color:#999;font-size:0.8em'>情報なし</p>";
    }
  }, 10);
}
