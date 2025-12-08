// api.js - 通信処理
// データを取得 (GET)
export async function fetchSheetData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

// データの更新 (POST)
export function postUpdate(url, payload) {
  if (!url) return Promise.resolve(null);

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  }).then((res) => res.json());
}
