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
  // 東西南北ごとの地図のpdfリンク
  MAP_LINKS: {
    東456: "https://www.comiket.co.jp/info-a/C106/C106Map_e456_B4.pdf",
    東7: "https://www.comiket.co.jp/info-a/C106/C106Map_e7_B4.pdf",
    西12: "https://www.comiket.co.jp/info-a/C106/C106Map_w12_B4.pdf",
    南12: "https://www.comiket.co.jp/info-a/C106/C106Map_s12_B4.pdf",
  },
};
