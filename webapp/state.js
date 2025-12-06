export const state = {
  purchasedList: JSON.parse(localStorage.getItem("purchasedList")) || [],
  holdList: JSON.parse(localStorage.getItem("holdList")) || [],
  actionHistory: JSON.parse(localStorage.getItem("actionHistory")) || [],
  comiketData: { wantToBuy: [] },
  currentTarget: null,

  // データ保存用ヘルパー
  savePurchased() {
    localStorage.setItem("purchasedList", JSON.stringify(this.purchasedList));
  },
  saveHold() {
    localStorage.setItem("holdList", JSON.stringify(this.holdList));
  },
  saveHistory() {
    localStorage.setItem("actionHistory", JSON.stringify(this.actionHistory));
  },
  saveComiketData() {
    localStorage.setItem("comiketData", JSON.stringify(this.comiketData));
  },
};
