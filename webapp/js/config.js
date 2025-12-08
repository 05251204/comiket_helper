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
    東7: "ABCDEFGHIJKLMNOPQRSTUVW".split(""),
    西12: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめ".split(
      ""
    ),
    南12: "abcdefghijklmnopqrst".split(""),
  },
  // LocalStorageのキー
  STORAGE_KEYS: {
    PURCHASED: "purchasedList",
    HOLD: "holdList",
    HISTORY: "actionHistory",
    DATA: "comiketData",
    URL: "webAppURL",
  },
};
