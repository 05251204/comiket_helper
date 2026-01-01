/**
 * アプリケーション全体の定数設定
 */

// エリア定義（ここを変更することでC108以降や他イベントに対応可能）
const AREA_DEFINITIONS = [
  {
    id: "e456",
    name: "東456", // UI表示用
    prefixes: ["東"], // スペースの先頭文字
    labels: "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨ".split(""),
    mapFile: "./maps/C107Map_e456.jpg",
  },
  {
    id: "e7",
    name: "東7",
    prefixes: ["東"],
    labels: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    mapFile: "./maps/C107Map_e7.jpg",
  },
  {
    id: "w12",
    name: "西12",
    prefixes: ["西"],
    labels: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめ".split(""),
    mapFile: "./maps/C107Map_w12.jpg",
  },
  {
    id: "s12",
    name: "南12",
    prefixes: ["南"],
    labels: "abcdefghijklmnopqrstuvwxyz".split(""),
    mapFile: "./maps/C107Map_s12.jpg",
  },
];

export const Config = {
  // 新しいエリア定義
  AREAS: AREA_DEFINITIONS,

  // LocalStorageのキー
  STORAGE_KEYS: {
    PURCHASED: "purchasedList",
    HOLD: "holdList",
    HISTORY: "actionHistory",
    DATA: "comiketData",
    URL: "webAppURL",
    SYNC_QUEUE: "syncQueue",
    SELECTED_SHEETS: "selectedSheets",
  },
};
