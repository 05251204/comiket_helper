/**
 * アプリケーション全体の定数設定
 */
export const Config = {
  // 東西南北ごとの識別子リスト
  LABEL_OPTIONS: {
    東456:
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨ".split(
        ""
      ),
    東7: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    西12: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめ".split(
      ""
    ),
    南12: "abcdefghijklmnopqrstuvwxyz".split(""),
  },
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
  MAP_LINKS: {
    東456: "./maps/C106Map_e456.jpg",
    東7: "./maps/C106Map_e7.jpg",
    西12: "./maps/C106Map_w12.jpg",
    南12: "./maps/C106Map_s12.jpg",
  },
};
