import { labelOptions } from "./config.js";

// フィードバック（トースト）表示用タイマー
let feedbackTimer;

export function showFeedback(message) {
  const toast = document.getElementById("feedback-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

export function toHalfWidth(str) {
  if (!str) return "";
  return str.replace(/[！-～]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
}

// スペース文字列を解析して [ホール, 識別子, 番号] を返す
export function distinct_space(space) {
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

// 距離計算
export function calc_dist(ewsn1, label1, number1, ewsn2, label2, number2) {
  // 簡易的な補正（32番以降を折り返しとして扱うロジック等）
  if (number1 > 32) number1 = 64 - number1;
  if (number2 > 32) number2 = 64 - number2;

  if (ewsn1 !== ewsn2) return 1e9; // ホールが違う場合は距離を無限大に

  const labelDist = Math.abs(label1.charCodeAt(0) - label2.charCodeAt(0));
  const numberDist = Math.abs(number1 - number2);
  return labelDist * 4 + numberDist;
}
