// 購入済みサークルのリスト。ブラウザのlocalStorageから読み込むか、空の配列で初期化。
let purchasedList = JSON.parse(localStorage.getItem("purchasedList")) || [];
// 保留中サークルのリスト。localStorageから読み込むか、空の配列で初期化。
let holdList = JSON.parse(localStorage.getItem("holdList")) || [];
// ユーザー操作の履歴リスト。「購入」または「保留」の操作を記録する。
let actionHistory = JSON.parse(localStorage.getItem("actionHistory")) || [];

// 現在の次の目的地情報を保持する変数。
let currentTarget = null;
// スプレッドシートから取得したサークル全データ（未購入・未保留）を保持するオブジェクト。
let comiketData = { wantToBuy: [] };

// 各ホールの島（列）の識別子を定義したオブジェクト。
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

// --- ユーティリティ関数 ---

/**
 * 画面右上にフィードバックメッセージを数秒間表示する関数。
 * @param {string} message - 表示するメッセージ。
 */
let feedbackTimer;
function showFeedback(message) {
  const toast = document.getElementById("feedback-toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  // 前回のタイマーが残っていればクリアする。
  clearTimeout(feedbackTimer);
  // 3秒後にメッセージを非表示にするタイマーをセット。
  feedbackTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

/**
 * スプレッドシートからサークルリストを読み込む、またはローカルストレージから復元する関数。
 * @param {boolean} forceRefresh - trueの場合、ローカルストレージを無視して強制的にシートから再取得する。
 * @returns {Promise<number|undefined>} 読み込みに成功した場合、読み込んだアイテム数を返すPromise。
 */
async function loadDataAndInitialize(forceRefresh = false) {
  const webAppURL = document.getElementById("gas-url-input").value;
  if (!webAppURL) {
    document.getElementById("loading").textContent =
      "Google Apps ScriptのURLを入力してください。";
    return;
  }

  // 強制更新でない場合、まずローカルストレージからのデータ読み込みを試みる。
  if (!forceRefresh) {
    const savedComiketData = localStorage.getItem("comiketData");
    if (savedComiketData) {
      try {
        comiketData.wantToBuy = JSON.parse(savedComiketData).wantToBuy || [];
        updateAllCounts();
        document.getElementById("loading").textContent =
          "ローカルデータから準備完了。目的地を検索してください。";
        return;
      } catch (e) {
        console.error("Error parsing comiketData from localStorage:", e);
      }
    }
  }

  // スプレッドシートからデータを取得する。
  document.getElementById("loading").textContent =
    "シートからデータを読み込み中...";
  try {
    const response = await fetch(webAppURL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    comiketData.wantToBuy = data.wantToBuy || [];
    localStorage.setItem("comiketData", JSON.stringify(comiketData)); // 取得したデータをローカルストレージに保存。
    updateAllCounts();
    document.getElementById("loading").textContent =
      "準備完了。目的地を検索してください。";
    return comiketData.wantToBuy.length;
  } catch (error) {
    console.error("Error loading sheet data via Apps Script:", error);
    document.getElementById("loading").textContent =
      "データの読み込みに失敗しました。URLが正しいか確認してください。";
    throw error; // エラーを呼び出し元に伝える。
  }
}

// --- 初期化処理 ---

// HTMLドキュメントの読み込みが完了したときに実行されるイベントリスナー。
document.addEventListener("DOMContentLoaded", () => {
  const gasUrlInput = document.getElementById("gas-url-input");
  const savedUrl = localStorage.getItem("webAppURL");

  // 保存されたGASのURLがあれば入力欄に復元する。
  if (savedUrl) {
    gasUrlInput.value = savedUrl;
  }

  // URL入力が変更された際の処理（入力後少し待ってからデータ取得）。
  let debounceTimeout;
  gasUrlInput.addEventListener("input", () => {
    clearTimeout(debounceTimeout);
    localStorage.setItem("webAppURL", gasUrlInput.value);
    debounceTimeout = setTimeout(() => {
      if (gasUrlInput.value) {
        loadDataAndInitialize();
      }
    }, 500); // 500msの遅延実行。
  });

  // ページの初期化処理。
  updateLabelOptions();
  if (gasUrlInput.value) {
    loadDataAndInitialize();
  } else {
    document.getElementById("loading").textContent =
      "Google Apps ScriptのURLを入力してください。";
  }

  // 全てのボタンのデフォルトのクリック動作（フォーム送信など）を無効化。
  document.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
    });
  });

  // form要素のデフォルトの送信動作も無効化。
  document.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  // 「保留中」カウンターがクリックされたら、保留リストをリセットする。
  document
    .getElementById("hold-counter-container")
    .addEventListener("click", () => {
      if (holdList.length === 0) return;
      if (
        confirm(`${holdList.length}件の保留リストを完全にリセットしますか？`)
      ) {
        holdList = [];
        localStorage.removeItem("holdList");
        // 操作履歴からも'hold'タイプのものを削除。
        actionHistory = actionHistory.filter(
          (action) => action.type !== "hold"
        );
        localStorage.setItem("actionHistory", JSON.stringify(actionHistory));
        showFeedback("保留リストをリセットしました。");
        updateAllCounts();
        updateNextTarget();
      }
    });
});

// --- UIイベントハンドラ ---

// 「東西南北」の選択が変更されたら、識別子の選択肢を更新する。
document
  .getElementById("current-ewsn")
  .addEventListener("change", updateLabelOptions);

// 「購入済」ボタンの処理。
document.getElementById("purchased-btn").addEventListener("click", (event) => {
  if (!currentTarget || !currentTarget.space) return;
  const spaceToUpdate = currentTarget.space;

  // スプレッドシートに購入済み情報を非同期で送信。
  const webAppURL = document.getElementById("gas-url-input").value;
  if (webAppURL) {
    fetch(webAppURL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ space: spaceToUpdate }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "success")
          console.error("Background sheet update failed:", data.message);
        else
          console.log(
            `Background sheet update successful for ${spaceToUpdate}.`
          );
      })
      .catch((error) =>
        console.error("Background sheet update fetch failed:", error)
      );
  } else {
    console.warn("GAS URL is not provided. Skipping sheet update.");
  }

  // ローカルのリストと履歴を更新。
  purchasedList.push(spaceToUpdate);
  localStorage.setItem("purchasedList", JSON.stringify(purchasedList));
  actionHistory.push({ type: "purchase", space: spaceToUpdate });
  localStorage.setItem("actionHistory", JSON.stringify(actionHistory));

  showFeedback(`${spaceToUpdate} を購入済にしました。`);
  updateNextTarget(); // 次の目的地を更新。
});

// 「保留」ボタンの処理。
document.getElementById("hold-btn").addEventListener("click", (event) => {
  if (!currentTarget || !currentTarget.space) return;
  const spaceToHold = currentTarget.space;

  // ローカルの保留リストと履歴を更新（スプレッドシートには送らない）。
  holdList.push(spaceToHold);
  localStorage.setItem("holdList", JSON.stringify(holdList));
  actionHistory.push({ type: "hold", space: spaceToHold });
  localStorage.setItem("actionHistory", JSON.stringify(actionHistory));

  showFeedback(`${spaceToHold} を保留にしました。`);
  updateNextTarget(); // 次の目的地を更新。
});

// 「一つ前に戻す」ボタンの処理。
document.getElementById("undo-btn").addEventListener("click", (event) => {
  if (actionHistory.length === 0) {
    showFeedback("元に戻す操作がありません。");
    return;
  }

  // 履歴から最後の操作を取り出す。
  const lastAction = actionHistory.pop();
  localStorage.setItem("actionHistory", JSON.stringify(actionHistory));

  // 操作の種類に応じて処理を分岐。
  if (lastAction.type === "purchase") {
    const indexToRemove = purchasedList.lastIndexOf(lastAction.space);
    if (indexToRemove > -1) {
      purchasedList.splice(indexToRemove, 1); // 購入リストから削除。
      localStorage.setItem("purchasedList", JSON.stringify(purchasedList));

      // スプレッドシートにもundoを通知。
      const webAppURL = document.getElementById("gas-url-input").value;
      if (webAppURL) {
        fetch(webAppURL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ space: lastAction.space, undo: true }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.status !== "success")
              console.error("Undo sheet update failed:", data.message);
            else
              console.log(
                `Undo sheet update successful for ${lastAction.space}.`
              );
          })
          .catch((error) =>
            console.error("Undo sheet update fetch failed:", error)
          );
      }
      showFeedback(`${lastAction.space} の購入を取り消しました。`);
    }
  } else if (lastAction.type === "hold") {
    const indexToRemove = holdList.lastIndexOf(lastAction.space);
    if (indexToRemove > -1) {
      holdList.splice(indexToRemove, 1); // 保留リストから削除。
      localStorage.setItem("holdList", JSON.stringify(holdList));
      showFeedback(`${lastAction.space} の保留を取り消しました。`);
    }
  }

  updateNextTarget(); // 次の目的地を更新。
});

// 「購入リストをリセット」ボタンの処理。
document.getElementById("reset-list-btn").addEventListener("click", (event) => {
  if (purchasedList.length === 0) return;
  if (
    confirm(
      "購入リストを完全にリセットしますか？（スプレッドシートの情報もリセットされます）"
    )
  ) {
    const webAppURL = document.getElementById("gas-url-input").value;
    if (!webAppURL) {
      console.warn("GAS URL is not provided. Skipping sheet reset.");
      return;
    }

    // スプレッドシートに一括でリセットを通知。
    const itemsToReset = [...purchasedList];
    if (itemsToReset.length > 0) {
      fetch(webAppURL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ spaces: itemsToReset, undo: true }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status !== "success")
            console.error("Background sheet batch reset failed:", data.message);
          else console.log("Background sheet batch reset successful.");
        })
        .catch((error) =>
          console.error("Background sheet batch reset fetch failed:", error)
        );
    }

    // ローカルの購入リストと関連履歴をリセット。
    purchasedList = [];
    localStorage.removeItem("purchasedList");
    actionHistory = actionHistory.filter(
      (action) => action.type !== "purchase"
    );
    localStorage.setItem("actionHistory", JSON.stringify(actionHistory));
    showFeedback("購入リストをリセットしました。");
    updateNextTarget();
  }
});

// 「スプレッドシートから更新」ボタンの処理。
document
  .getElementById("refresh-data-btn")
  .addEventListener("click", (event) => {
    loadDataAndInitialize(true) // 強制更新フラグを立てて実行。
      .then((loadedCount) => {
        showFeedback(`${loadedCount} 件のデータをシートから読み込みました。`);
        updateNextTarget();
      })
      .catch((err) => {
        showFeedback("データの更新に失敗しました。");
      });
  });

// 「次の目的地を検索」ボタンの処理。
document.getElementById("search-button").addEventListener("click", (event) => {
  updateNextTarget();
});

// --- コアロジック ---

/**
 * 次の目的地を計算し、UIを更新するメイン関数。
 */
function updateNextTarget() {
  const webAppURL = document.getElementById("gas-url-input").value;
  if (!webAppURL) {
    document.getElementById("loading").textContent =
      "Google Apps ScriptのURLを入力してください。";
    return;
  }

  updateAllCounts(); // 各カウンターを更新。

  const currentEWSN = document.getElementById("current-ewsn").value;
  const currentLabel = document.getElementById("current-label").value;
  const currentNumberStr = document.getElementById("current-number").value;

  document.getElementById("loading").textContent = "最適ルートを検索中...";
  document.getElementById("target-info").style.display = "block";
  document.querySelector(".target-details").style.display = "none";
  document.getElementById("target-tweet-container").style.display = "none";

  // 未訪問のサークルリストを作成（購入済みと保留中を除く）。
  const remainingCircles = comiketData.wantToBuy.filter(
    (c) => !purchasedList.includes(c.space) && !holdList.includes(c.space)
  );

  if (remainingCircles.length === 0) {
    document.getElementById("loading").textContent = "完了";
    currentTarget = null;
    return;
  }

  // UI更新を挟むため、重い計算処理をsetTimeoutで少し遅らせる。
  setTimeout(() => {
    const startNode = {
      space: `${currentEWSN[0]}${currentLabel}${currentNumberStr}`,
      isStart: true,
    };
    const nodesForTsp = [startNode, ...remainingCircles];
    const optimalPath = solveTsp(nodesForTsp); // TSPソルバーで最適ルートを計算。

    const nextCircle = optimalPath.length > 1 ? optimalPath[1] : null;
    if (!nextCircle) {
      document.getElementById("loading").textContent = "完了";
      currentTarget = null;
      return;
    }

    currentTarget = nextCircle;
    const [startHall, startLabel, startNum] = distinct_space(startNode.space);
    const [nextHall, nextLabel, nextNum] = distinct_space(nextCircle.space);
    nextCircle.distance = calc_dist(
      startHall[0],
      startLabel,
      parseFloat(startNum),
      nextHall[0],
      nextLabel,
      parseFloat(nextNum)
    );

    // --- UIに計算結果を反映 ---
    document.getElementById("loading").textContent = "";
    document.querySelector(".target-details").style.display = "block";
    document.getElementById("target-tweet-container").style.display = "block";
    document.getElementById("target-space-heading").textContent =
      nextCircle.space;
    document.getElementById("target-distance").textContent =
      nextCircle.distance;
    const prioritySpan = document.getElementById("target-priority");
    if (nextCircle.priority) {
      prioritySpan.textContent = nextCircle.priority;
    } else {
      prioritySpan.textContent = "N/A";
    }
    const userLink = document.getElementById("target-user");
    if (nextCircle.account) {
      userLink.textContent = nextCircle.account.split("/").pop();
      userLink.href = nextCircle.account;
    } else {
      userLink.textContent = "N/A";
      userLink.href = "#";
    }
    const tweetContainer = document.getElementById("target-tweet-container");
    tweetContainer.innerHTML = ""; // Clear previous content
    if (nextCircle.tweet) {
      // Always provide a direct link as a fallback
      const link = document.createElement("p");
      link.innerHTML = `<a href="${nextCircle.tweet}" target="_blank">リンク</a>`;
      tweetContainer.appendChild(link);

      // Try to embed the tweet as well
      if (typeof twttr !== "undefined" && twttr.widgets) {
        const tweetIdMatch = nextCircle.tweet.match(/status\/(\d+)/);
        if (tweetIdMatch && tweetIdMatch[1]) {
          const embedContainer = document.createElement("div");
          tweetContainer.appendChild(embedContainer);
          twttr.widgets
            .createTweet(tweetIdMatch[1], embedContainer, { theme: "light" })
            .then((el) => {
              if (!el) {
                // Widget creation failed (e.g., for sensitive content), the link is already there.
                console.warn(
                  "Tweet widget creation failed, possibly sensitive content."
                );
              }
            })
            .catch((err) => {
              console.error("Failed to embed tweet:", err);
              // The link is already present, so no need for another error message in the UI.
            });
        }
      }
    } else {
      tweetContainer.innerHTML = "<p>お品書き情報なし</p>";
    }
  }, 10);
}

/**
 * 巡回セールスマン問題（TSP）を解く関数。
 * 2-opt法を用いたヒューリスティック解法。
 * @param {Array<object>} nodes - スタート地点と訪問先サークルのノード配列。
 * @returns {Array<object>} - 最適化された訪問順のノード配列。
 */
function solveTsp(nodes) {
  if (nodes.length < 2) return nodes;
  nodes.forEach((node, i) => (node.__id = i)); // 計算用に一時的なIDを付与。

  // 全ノード間の距離行列を事前に計算。
  const distMatrix = [];
  for (let i = 0; i < nodes.length; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) {
        distMatrix[i][j] = 0;
        continue;
      }
      const [ewsn1, label1, num1] = distinct_space(nodes[i].space);
      const [ewsn2, label2, num2] = distinct_space(nodes[j].space);
      distMatrix[i][j] = calc_dist(
        ewsn1[0],
        label1,
        parseFloat(num1),
        ewsn2[0],
        label2,
        parseFloat(num2)
      );
    }
  }

  // ステップ1: 最近傍探索法で初期ルートを生成。
  let currentPath = [];
  let remainingNodes = [...nodes];
  let currentNode =
    remainingNodes.find((n) => n.isStart) || remainingNodes.shift();
  currentPath.push(currentNode);
  remainingNodes = remainingNodes.filter((n) => n.__id !== currentNode.__id);

  while (remainingNodes.length > 0) {
    let nearestNode = null,
      minDistance = Infinity;
    for (const node of remainingNodes) {
      const distance = distMatrix[currentNode.__id][node.__id];
      if (distance < minDistance) {
        minDistance = distance;
        nearestNode = node;
      }
    }
    currentNode = nearestNode;
    currentPath.push(currentNode);
    remainingNodes = remainingNodes.filter((n) => n.__id !== currentNode.__id);
  }

  // ステップ2: 2-opt法でルートを改善。
  /*
    let improved = true;
    while (improved) {
        improved = false;
        for (let i = 1; i < currentPath.length - 2; i++) {
            for (let j = i + 1; j < currentPath.length - 1; j++) {
                // 2つの辺を入れ替える前と後の距離を比較。
                const d1 = distMatrix[currentPath[i - 1].__id][currentPath[i].__id] + distMatrix[currentPath[j].__id][currentPath[j + 1].__id];
                const d2 = distMatrix[currentPath[i - 1].__id][currentPath[j].__id] + distMatrix[currentPath[i].__id][currentPath[j + 1].__id];
                if (d2 < d1) {
                    // 入れ替えた方が短ければ、パスの一部を逆順にしてつなぎ替える。
                    const pathSegment = currentPath.slice(i, j + 1).reverse();
                    currentPath = currentPath.slice(0, i).concat(pathSegment).concat(currentPath.slice(j + 1));
                    improved = true;
                }
            }
        }
    }
    */
  nodes.forEach((node) => delete node.__id); // 一時的なIDを削除。
  return currentPath;
}

// --- その他のユーティリティ関数 ---

/**
 * 「東西南北」の選択に応じて、「識別子」のプルダウンメニューの選択肢を更新する。
 */
function updateLabelOptions() {
  const hallSelect = document.getElementById("current-ewsn");
  const labelSelect = document.getElementById("current-label");
  const selectedHall = hallSelect.value;
  labelSelect.innerHTML = "";
  const options = labelOptions[selectedHall] || [];
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    labelSelect.appendChild(option);
  });
}

/**
 * 全角英数字を半角に変換する。
 * @param {string} str - 変換元の文字列。
 * @returns {string} - 変換後の文字列。
 */
function toHalfWidth(str) {
  if (!str) return "";
  return str.replace(/[！-～]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
}

/**
 * スペース文字列（例: "東A01a"）を解析し、[ホールグループ, 識別子, 番号]の配列を返す。
 * @param {string} space - 解析するスペース文字列。
 * @returns {Array<string>} - [ホールグループ, 識別子, 番号] の配列。
 */
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

/**
 * 2つのスペース間の簡易的な距離を計算する。
 * @returns {number} - 計算された距離。
 */
function calc_dist(ewsn1, label1, number1, ewsn2, label2, number2) {
  if (number1 > 32) number1 = 64 - number1;
  if (number2 > 32) number2 = 64 - number2;
  if (ewsn1 !== ewsn2) return 1e9;
  const labelDist = Math.abs(label1.charCodeAt(0) - label2.charCodeAt(0));
  const numberDist = Math.abs(number1 - number2);
  return labelDist * 4 + numberDist;
}

/**
 * 各ホールの残りサークル数と保留中のサークル数を計算し、UIを更新する。
 */
function updateAllCounts() {
  const unvisitedCircles = comiketData.wantToBuy.filter(
    (c) => !purchasedList.includes(c.space) && !holdList.includes(c.space)
  );
  const counts = { 東456: 0, 東7: 0, 西12: 0, 南12: 0 };
  unvisitedCircles.forEach((circle) => {
    const [ewsn, label, _number] = distinct_space(circle.space);
    for (const groupKey in labelOptions) {
      if (groupKey.startsWith(ewsn) && labelOptions[groupKey].includes(label)) {
        counts[groupKey]++;
        break;
      }
    }
  });
  document.getElementById("count-E456").textContent = counts["東456"];
  document.getElementById("count-E7").textContent = counts["東7"];
  document.getElementById("count-W12").textContent = counts["西12"];
  document.getElementById("count-S12").textContent = counts["南12"];
  document.getElementById("count-hold").textContent = holdList.length;
}
