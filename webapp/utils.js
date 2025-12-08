// utils.js
import { labelOptions } from "./config.js";

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

export function calc_dist(ewsn1, label1, number1, ewsn2, label2, number2) {
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
