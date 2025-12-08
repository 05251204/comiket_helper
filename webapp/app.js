/**
 * Comi-Navi C106 - All-in-One Version
 * 統合版スクリプト：これにより読み込み順序の問題を解決します。
 */

// ==========================================
// 1. 設定・データ定義 (Config & State)
// ==========================================

const labelOptions = {
  東456:
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨ".split(
      ""
    ),
  東7: "ABCDEFGHIJKLMNOPQRSTUVW".split(""),
  西12: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめ".split(
    ""
  ),
  南12: "abcdefghijklmnopqrst".split(""),
};

// アプリの状態
const state = {
  purchasedList: JSON.parse(localStorage.getItem("purchasedList")) || [],
  holdList: JSON.parse(localStorage.getItem("holdList")) || [],
  actionHistory: JSON.parse(localStorage.getItem("actionHistory")) || [],
  currentTarget: null,
  comiketData: { wantToBuy: [] },

  save() {
    localStorage.setItem("purchasedList", JSON.stringify(this.purchasedList));
    localStorage.setItem("holdList", JSON.stringify(this.holdList));
    localStorage.setItem("actionHistory", JSON.stringify(this.actionHistory));
    localStorage.setItem("comiketData", JSON.stringify(this.comiketData));
  },
};

let feedbackTimer;

// ==========================================
// 2. ユーティリティ (Utils)
// ==========================================

function showFeedback(message) {
  const toast = document.getElementById("feedback-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function toHalfWidth(str) {
  if (!str) return "";
  return str.replace(/[！-～]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
}

function distinct_space(space) {
  if (!space) return ["", "", ""];
  let ewsnChar = space[0];
  let labelChar = space[1];
  let numberPart = toHalfWidth(space.substring(2));
  let hallGroupKey = "";

  for (const key in labelOptions) {
    if (key.startsWith(ewsnChar) && labelOptions[key].includes(labelChar)) {
      hallGroupKey = key;
      break;
    }
  }

  let number = "";
  for (let i = 0; i < numberPart.length; i++) {
    const char = numberPart[i];
    if (char >= "0" && char <= "9") number += char;
    else break;
  }
  return [hallGroupKey, labelChar, number];
}

function calc_dist(ewsn1, label1, number1, ewsn2, label2, number2) {
  let n1 = parseFloat(number1) || 0;
  let n2 = parseFloat(number2) || 0;

  if (n1 > 32) n1 = 64 - n1;
  if (n2 > 32) n2 = 64 - n2;

  if (ewsn1[0] !== ewsn2[0]) return 10000;
  let hallPenalty = ewsn1 !== ewsn2 ? 1000 : 0;

  const labelDist = Math.abs(label1.charCodeAt(0) - label2.charCodeAt(0));
  const numberDist = Math.abs(n1 - n2);

  return labelDist * 20 + numberDist + hallPenalty;
}

// ==========================================
// 3. API通信 (API)
// ==========================================

async function fetchSheetData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

function postUpdate(url, payload) {
  if (!url) return Promise.resolve(null);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .catch((e) => console.warn(e));
}

// ==========================================
// 4. TSPアルゴリズム (Logic)
// ==========================================

function runTspAlgorithm(nodes, startNode) {
  if (nodes.length === 0) return [];

  const workingNodes = [startNode, ...nodes].map((node, i) => ({
    ...node,
    __id: i,
  }));
  const distMatrix = [];

  for (let i = 0; i < workingNodes.length; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < workingNodes.length; j++) {
      if (i === j) {
        distMatrix[i][j] = 0;
        continue;
      }
      const [ewsn1, label1, num1] = distinct_space(workingNodes[i].space);
      const [ewsn2, label2, num2] = distinct_space(workingNodes[j].space);
      distMatrix[i][j] = calc_dist(
        ewsn1[0],
        label1,
        num1,
        ewsn2[0],
        label2,
        num2
      );
    }
  }

  let currentPath = [];
  let remaining = [...workingNodes];
  let currentNode = remaining.shift();
  currentPath.push(currentNode);

  while (remaining.length > 0) {
    let nearest = null,
      minDst = Infinity;
    for (const node of remaining) {
      const d = distMatrix[currentNode.__id][node.__id];
      if (d < minDst) {
        minDst = d;
        nearest = node;
      }
    }
    currentNode = nearest;
    currentPath.push(currentNode);
    remaining = remaining.filter((n) => n.__id !== currentNode.__id);
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < currentPath.length - 2; i++) {
      for (let j = i + 1; j < currentPath.length - 1; j++) {
        const d1 =
          distMatrix[currentPath[i - 1].__id][currentPath[i].__id] +
          distMatrix[currentPath[j].__id][currentPath[j + 1].__id];
        const d2 =
          distMatrix[currentPath[i - 1].__id][currentPath[j].__id] +
          distMatrix[currentPath[i].__id][currentPath[j + 1].__id];
        if (d2 < d1) {
          const reversed = currentPath.slice(i, j + 1).reverse();
          currentPath = currentPath
            .slice(0, i)
            .concat(reversed)
            .concat(currentPath.slice(j + 1));
          improved = true;
        }
      }
    }
  }

  return currentPath.slice(1).map((n) => {
    const { __id, ...rest } = n;
    return rest;
  });
}

function solveTsp(nodes) {
  if (nodes.length < 2) return nodes;

  const startNode = nodes.find((n) => n.isStart);
  const targetNodes = nodes.filter((n) => !n.isStart);
  const isHighPriority = (p) => {
    if (!p) return false;
    const strP = String(p).toUpperCase();
    return ["S", "A", "5", "4", "HIGH", "高"].includes(strP);
  };

  const highGroup = targetNodes.filter((n) => isHighPriority(n.priority));
  const normalGroup = targetNodes.filter((n) => !isHighPriority(n.priority));

  if (highGroup.length === 0 || normalGroup.length === 0) {
    return [startNode, ...runTspAlgorithm(targetNodes, startNode)];
  }

  const highPath = runTspAlgorithm(highGroup, startNode);
  const lastHighNode = highPath[highPath.length - 1] || startNode;
  const normalPath = runTspAlgorithm(normalGroup, lastHighNode);

  return [startNode, ...highPath, ...normalPath];
}

// ==========================================
// 5. Canvas マップ描画
// ==========================================

function drawRadar(targetNode) {
  const canvas = document.getElementById("map-radar");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#001100";
  ctx.fillRect(0, 0, w, h);

  // グリッド線
  ctx.strokeStyle = "#004400";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (!targetNode) return;

  const [ewsn, label, numStr] = distinct_space(targetNode.space);
  let x = w / 2;
  let y = h / 2;
  let areaName = ewsn;

  if (ewsn.includes("東456")) {
    x = w * 0.3;
    y = h * 0.5;
  } else if (ewsn.includes("東7")) {
    x = w * 0.8;
    y = h * 0.3;
  } else if (ewsn.includes("西")) {
    x = w * 0.2;
    y = h * 0.8;
  } else if (ewsn.includes("南")) {
    x = w * 0.5;
    y = h * 0.8;
  }

  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 255, 0, 0.6)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffff00";
  ctx.fill();

  ctx.fillStyle = "#00ff00";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.fillText(targetNode.space, x, y - 12);

  ctx.fillStyle = "#00cc00";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.fillText("RADAR: " + areaName, 5, 15);
}

// ==========================================
// 6. メイン処理 & イベントハンドラ (Main)
// ==========================================

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  console.log("App Initializing...");

  const gasUrlInput = document.getElementById("gas-url-input");
  const savedUrl = localStorage.getItem("webAppURL");
  if (savedUrl && gasUrlInput) gasUrlInput.value = savedUrl;

  if (gasUrlInput) {
    let debounceTimeout;
    gasUrlInput.addEventListener("input", () => {
      clearTimeout(debounceTimeout);
      localStorage.setItem("webAppURL", gasUrlInput.value);
      debounceTimeout = setTimeout(() => {
        if (gasUrlInput.value) loadDataAndInitialize();
      }, 500);
    });
  }

  // ★重要: 初期化時に識別子プルダウンを生成する
  setupEventListeners();
  updateLabelOptions();

  if (gasUrlInput && gasUrlInput.value) {
    loadDataAndInitialize();
  }
});

function setupEventListeners() {
  const ewsnSelect = document.getElementById("current-ewsn");
  if (ewsnSelect) {
    ewsnSelect.addEventListener("change", updateLabelOptions);
  }

  document
    .querySelectorAll("button")
    .forEach((b) => b.addEventListener("click", (e) => e.preventDefault()));

  const refreshBtn = document.getElementById("refresh-data-btn");
  if (refreshBtn)
    refreshBtn.addEventListener("click", () => loadDataAndInitialize(true));

  const searchBtn = document.getElementById("search-button");
  if (searchBtn) searchBtn.addEventListener("click", updateNextTarget);

  const buyBtn = document.getElementById("purchased-btn");
  if (buyBtn) buyBtn.addEventListener("click", () => handleAction("purchase"));

  const holdBtn = document.getElementById("hold-btn");
  if (holdBtn) holdBtn.addEventListener("click", () => handleAction("hold"));

  const undoBtn = document.getElementById("undo-btn");
  if (undoBtn) undoBtn.addEventListener("click", handleUndo);

  const resetBtn = document.getElementById("reset-list-btn");
  if (resetBtn) resetBtn.addEventListener("click", handleReset);

  const holdCounter = document.getElementById("hold-counter-container");
  if (holdCounter) holdCounter.addEventListener("click", handleHoldClear);
}

// UI更新
function updateLabelOptions() {
  const hallSelect = document.getElementById("current-ewsn");
  const labelSelect = document.getElementById("current-label");

  if (!hallSelect || !labelSelect) return;

  const selectedHall = hallSelect.value;

  // 一旦クリア
  labelSelect.innerHTML = "";

  // 選択肢生成
  const options = labelOptions[selectedHall] || [];
  if (options.length === 0) {
    const op = document.createElement("option");
    op.text = "---";
    labelSelect.add(op);
  } else {
    options.forEach((val) => {
      const option = document.createElement("option");
      option.value = val;
      option.textContent = val;
      labelSelect.appendChild(option);
    });
  }
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

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt("count-E456", counts["東456"]);
  setTxt("count-E7", counts["東7"]);
  setTxt("count-W12", counts["西12"]);
  setTxt("count-S12", counts["南12"]);
  setTxt("count-hold", state.holdList.length);
}

// データ処理
async function loadDataAndInitialize(forceRefresh = false) {
  const webAppURL = document.getElementById("gas-url-input").value;
  if (!webAppURL) return;

  const loadingEl = document.getElementById("loading");

  if (!forceRefresh) {
    const saved = localStorage.getItem("comiketData");
    if (saved) {
      try {
        state.comiketData = JSON.parse(saved);
        if (!state.comiketData.wantToBuy) state.comiketData.wantToBuy = [];
        updateAllCounts();
        if (loadingEl) loadingEl.textContent = "Ready (Cache)";
        return;
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (loadingEl) loadingEl.textContent = "Updating...";
  try {
    const data = await fetchSheetData(webAppURL);
    state.comiketData.wantToBuy = data.wantToBuy || [];
    state.save();
    updateAllCounts();
    if (loadingEl) loadingEl.textContent = "Ready";
  } catch (error) {
    console.error(error);
    if (loadingEl) loadingEl.textContent = "Error: Check URL";
  }
}

// アクション
function handleAction(type) {
  if (!state.currentTarget) return;
  const space = state.currentTarget.space;
  const url = document.getElementById("gas-url-input").value;

  if (type === "purchase") {
    postUpdate(url, { space: space });
    state.purchasedList.push(space);
    showFeedback("購入済！ 次へ");
  } else {
    state.holdList.push(space);
    showFeedback("保留しました");
  }

  state.actionHistory.push({ type: type, space: space });
  state.save();
  updateNextTarget();
}

function handleUndo() {
  if (state.actionHistory.length === 0) return;
  const last = state.actionHistory.pop();
  const url = document.getElementById("gas-url-input").value;

  if (last.type === "purchase") {
    const idx = state.purchasedList.lastIndexOf(last.space);
    if (idx > -1) state.purchasedList.splice(idx, 1);
    postUpdate(url, { space: last.space, undo: true });
    showFeedback("購入取消");
  } else {
    const idx = state.holdList.lastIndexOf(last.space);
    if (idx > -1) state.holdList.splice(idx, 1);
    showFeedback("保留取消");
  }
  state.save();
  updateNextTarget();
}

function handleReset() {
  if (!confirm("リストを初期化しますか？")) return;
  const url = document.getElementById("gas-url-input").value;

  if (state.purchasedList.length > 0) {
    postUpdate(url, { spaces: [...state.purchasedList], undo: true });
  }

  state.purchasedList = [];
  state.actionHistory = state.actionHistory.filter(
    (a) => a.type !== "purchase"
  );
  state.save();
  showFeedback("リセット完了");
  updateNextTarget();
}

function handleHoldClear() {
  if (state.holdList.length === 0) return;
  if (confirm("保留リストを空にしますか？")) {
    state.holdList = [];
    state.save();
    showFeedback("保留クリア");
    updateNextTarget();
  }
}

// メインロジック
function updateNextTarget() {
  const url = document.getElementById("gas-url-input").value;
  if (!url) {
    showFeedback("URLを入力してください");
    return;
  }

  updateAllCounts();

  const currentEWSN = document.getElementById("current-ewsn").value;
  const currentLabel = document.getElementById("current-label").value;
  const currentNumber = document.getElementById("current-number").value;

  if (!currentLabel) {
    showFeedback("現在地を設定してください");
    return;
  }

  const loadingEl = document.getElementById("loading");
  if (loadingEl) loadingEl.textContent = "Searching...";
  document.getElementById("target-info").style.display = "block";

  const remaining = state.comiketData.wantToBuy.filter(
    (c) =>
      !state.purchasedList.includes(c.space) &&
      !state.holdList.includes(c.space)
  );

  if (remaining.length === 0) {
    if (loadingEl) loadingEl.textContent = "MISSION COMPLETE";
    state.currentTarget = null;
    document.getElementById("target-space-heading").textContent = "ALL DONE";
    document.getElementById("target-tweet-container").innerHTML = "";
    drawRadar(null);
    return;
  }

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
      return;
    }

    state.currentTarget = nextCircle;
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

    drawRadar(nextCircle);

    if (loadingEl) loadingEl.textContent = "";
    document.getElementById("target-space-heading").textContent =
      nextCircle.space;
    document.getElementById("target-distance").textContent = dist;
    document.getElementById("target-priority").textContent =
      nextCircle.priority || "-";

    let accountId = "";
    if (nextCircle.account) {
      const parts = nextCircle.account.split("/");
      accountId = parts[parts.length - 1].replace("@", "").split("?")[0];
    }
    const userLink = document.getElementById("target-user");
    userLink.textContent = accountId ? `@${accountId}` : "Link";
    userLink.href = nextCircle.account || "#";

    const tweetContainer = document.getElementById("target-tweet-container");
    tweetContainer.innerHTML = "";

    if (nextCircle.tweet) {
      const btn = document.createElement("a");
      btn.href = nextCircle.tweet;
      btn.target = "_blank";
      btn.className = "tweet-link-btn";
      btn.textContent = "📄 お品書き/ツイートを開く";
      tweetContainer.appendChild(btn);

      if (window.twttr && window.twttr.widgets) {
        const idMatch = nextCircle.tweet.match(/status\/(\d+)/);
        if (idMatch && idMatch[1]) {
          const div = document.createElement("div");
          tweetContainer.appendChild(div);
          const notice = document.createElement("p");
          notice.style.fontSize = "0.7em";
          notice.style.textAlign = "center";
          notice.style.color = "#666";
          notice.textContent = "※表示されない場合は上のボタンを使用";
          tweetContainer.appendChild(notice);
          window.twttr.widgets.createTweet(idMatch[1], div, { theme: "light" });
        }
      }
    } else {
      tweetContainer.innerHTML =
        "<p style='text-align:center;font-size:0.8rem;color:#666'>ツイート登録なし</p>";
    }

    if (accountId) {
      const searchBtn = document.createElement("button");
      searchBtn.className = "action-btn";
      searchBtn.style.marginTop = "8px";
      searchBtn.style.backgroundColor = "#55acee";
      searchBtn.style.color = "#fff";
      searchBtn.style.border = "2px solid #fff";
      searchBtn.style.outline = "2px solid #000";
      searchBtn.style.width = "100%";
      searchBtn.textContent = "🔍 「完売」で検索";
      searchBtn.onclick = () => {
        const query = `from:${accountId} (完売 OR 売り切れ OR 配布終了 OR 切)`;
        const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(
          query
        )}&f=live`;
        window.open(searchUrl, "_blank");
      };
      tweetContainer.appendChild(searchBtn);
    }
  }, 10);
}
