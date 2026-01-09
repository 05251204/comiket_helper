/**
 * シート一覧レンダラー
 * スプレッドシートのシート選択リストの描画を担当
 */
export class SheetListRenderer {
  /**
   * @param {HTMLElement} container - リストを描画するコンテナ要素
   */
  constructor(container) {
    this.container = container;
  }

  /**
   * シート一覧チェックボックスリストの描画
   * @param {string[]} sheets - シート名の配列
   * @param {string[]} selectedSheets - 選択済みシート名の配列
   * @param {Function} onChangeCallback - 変更時のコールバック
   */
  render(sheets, selectedSheets, onChangeCallback) {
    this.container.innerHTML = "";

    if (!sheets || sheets.length === 0) {
      this.container.textContent = "シートが見つかりません";
      return;
    }

    sheets.forEach((sheetName) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "sheet-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `sheet-${sheetName}`;
      checkbox.value = sheetName;
      checkbox.checked = selectedSheets.includes(sheetName);

      const label = document.createElement("label");
      label.htmlFor = `sheet-${sheetName}`;
      label.textContent = sheetName;

      // チェックボックス変更イベント
      checkbox.addEventListener("change", () => {
        if (onChangeCallback) onChangeCallback();
      });

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      this.container.appendChild(itemDiv);
    });
  }

  /**
   * 選択されているシート名の配列を取得
   * @returns {string[]} 選択されたシート名の配列
   */
  getSelectedSheets() {
    const checked = [];
    this.container.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      checked.push(cb.value);
    });
    return checked;
  }
}
