function convertCharacters(original) {
  let converted = "";
  const pattern = /[Ａ-Ｚａ-ｚ０-９]/;
  for (let i = 0; i < original.length; i++) {
    if (pattern.test(original[i])) {
      const half = String.fromCharCode(original[i].charCodeAt(0) - 65248);
      converted += half;
    } else {
      converted += original[i];
    }
  }
  converted = converted.replace(/　/g, " ").replace(/．/g, ".");
  return converted;
}

// この関数は、Google Apps Scriptの「編集時」トリガー (onEdit) で使用することを想定しています。
// スプレッドシート上でセルが編集された際に自動的に発火し、スペース表記を整形します。
// Webアプリ (doGet/doPost) から直接呼び出されることはありません。
function autoUpdateDate() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const current = sheet.getActiveCell();
  const currentRow = current.getRow();
  const currentColumn = current.getColumn();
  if (currentRow >= 1 && currentColumn == 4) {
    const updateRange = sheet.getRange("D" + currentRow);
    const pattern = /[A-Za-zあ-んア-ンａ-ｚＡ-Ｚ]/;
    const pattern2 = /[0-9]/;
    const val = current.getValue();
    let ans = "";
    let tf1 = false;
    let tf2 = false;
    for (const c of val) {
      if (!tf1 && (c == "東" || c == "西" || c == "南" || c == "北")) {
        ans += c;
        tf1 = true;
        continue;
      }
      if (tf1 && !tf2 && pattern.test(c)) {
        ans += c;
        tf2 = true;
        continue;
      }
      if (tf2) {
        if (pattern2.test(c)) {
          ans += c;
        }
        if (c == "a" || c == "b") {
          ans += c;
          if (c == "b") break;
        }
      }
    }
    ans = convertCharacters(ans);
    updateRange.setValue(ans);
  }
}

// --- グローバル設定項目 ---
// デフォルトのシート名リスト。パラメータ指定がない場合に使用。
const DEFAULT_SHEET_NAMES = ["day1_1"];
// サークルのスペース情報が書かれている列のヘッダー名（完全一致）。
const SPACE_COLUMN_NAME = "space";
// 購入済みかどうかを記録する列のヘッダー名（完全一致）。
const STATUS_COLUMN_NAME = "soldout";
// 購入済みの印としてセルに書き込む文字。
const PURCHASED_STATUS_TEXT = "x";
// --- 設定項目ここまで ---

/**
 * WebページからのGETリクエストを処理するメイン関数。
 * アクションに応じてシート一覧取得、または指定シートのデータ取得を行う。
 * 
 * パラメータ:
 * - action: 'getSheets' の場合、全シート名を返す。
 * - sheets: カンマ区切りのシート名リスト（データ取得時）。指定がない場合はデフォルトを使用。
 * 
 * @param {object} e - Apps Scriptが受け取るイベントオブジェクト。
 * @returns {ContentService.TextOutput} - JSON形式のレスポンス。
 */
function doGet(e) {
  const action = e.parameter.action;

  // シート一覧の取得
  if (action === "getSheets") {
    const allSheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    const sheetNames = allSheets.map(s => s.getName());
    return ContentService.createTextOutput(
      JSON.stringify({ sheets: sheetNames })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // データ取得（デフォルト動作）
  let targetSheets = DEFAULT_SHEET_NAMES;
  if (e.parameter.sheets) {
    targetSheets = e.parameter.sheets.split(",").map(s => s.trim());
  }

  let combinedResult = []; // 複数のシートの結果を結合するための配列。

  // 設定されたシート名でループ処理。
  targetSheets.forEach((sheetName) => {
    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    // シートが見つからない場合はスキップ。
    if (!sheet) {
      console.warn(`Sheet "${sheetName}" not found. Skipping.`);
      return;
    }

    const data = sheet.getDataRange().getValues(); // シートの全データを二次元配列として取得。
    if (data.length === 0) return;

    // ヘッダー行（1行目）を取得し、小文字に変換・空白削除して整形。
    const headers = data
      .shift()
      .map((h) => String(h).toLowerCase().replace(/\s+/g, ""));

    // データ行をオブジェクトの配列に変換。
    const sheetResult = data
      .map((row) => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      })
      .filter(
        (row) =>
          // スペース列に値があり、かつ購入済みステータスでない行のみをフィルタリング。
          row[SPACE_COLUMN_NAME.toLowerCase()] &&
          row[STATUS_COLUMN_NAME.toLowerCase()] !== PURCHASED_STATUS_TEXT
      );

    // 現在のシートの結果を全体の結果に結合。
    combinedResult = combinedResult.concat(sheetResult);
  });

  // 最終的な結果をJSON形式で返す。
  return ContentService.createTextOutput(
    JSON.stringify({ wantToBuy: combinedResult })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * WebページからのPOSTリクエストを処理するメイン関数。
 * 指定されたスペースの購入ステータスを更新（または元に戻す）。
 * 
 * @param {object} e - Apps Scriptが受け取るイベントオブジェクト（POSTデータを含む）。
 * @returns {ContentService.TextOutput} - JSON形式の処理結果レスポンス。
 */
function doPost(e) {
  try {
    // POSTされたJSONデータをパース（解析）。
    const postData = JSON.parse(e.postData.contents);
    const undo = postData.undo || false; // undoフラグ（購入取り消しかどうか）。なければfalseになる。

    // 対象とするシート群。パラメータで指定があればそれを使うが、
    // 基本的には全シート探索で問題ない（同じスペース名が別シートにある確率は低い、あるいは運用でカバー）
    // バッチリセットなどは全シート対象が望ましい。
    // ここでは念の為、全シートを取得して検索対象とするか、パラメータがあればそれに従う形にするが、
    // 既存ロジックの「指定されたデフォルトリスト」を「スプレッドシート内の全シート」に変えるのが
    // 最も汎用的であるため、ここでは全シートを対象に探索するように変更する。
    // （運用上、特定のシートのみを対象にしたい場合はパラメータ渡しが必要だが、今回は簡略化のため全シート探索とする）
    
    const allSheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    const targetSheets = allSheets; // 全シート対象

    // --- バッチリセット処理 ---
    // postDataに 'spaces' というキーで配列が渡され、かつ undo=true の場合に動作。
    if (postData.spaces && Array.isArray(postData.spaces) && undo) {
      const spacesToReset = postData.spaces;
      let resetCount = 0;

      // 各シートを順番に検索。
      for (const sheet of targetSheets) {
        const data = sheet.getDataRange().getValues();
        if (data.length === 0) continue;

        const headers = data[0];
        const spaceColumnIndex = headers.indexOf(SPACE_COLUMN_NAME);
        const statusColumnIndex = headers.indexOf(STATUS_COLUMN_NAME);

        if (spaceColumnIndex === -1 || statusColumnIndex === -1) continue; // 必要な列がなければスキップ。

        // データ行をループして、リセット対象のスペースを探す。
        for (let i = 1; i < data.length; i++) {
          // リセット対象のスペース配列に、現在の行のスペースが含まれているかチェック。
          if (spacesToReset.includes(data[i][spaceColumnIndex])) {
            // 含まれていれば、ステータス列のセルを空にする。
            sheet.getRange(i + 1, statusColumnIndex + 1).setValue("");
            resetCount++;
          }
        }
      }
      // 処理結果を返す。
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "success",
          message: `Batch reset successful for ${resetCount} items.`,
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    // --- バッチリセット処理ここまで ---

    // --- 既存の単一更新処理 ---
    const spaceToUpdate = postData.space;
    // スペース番号が提供されていない場合はエラーを返す。
    if (!spaceToUpdate) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "No space provided" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    let foundAndUpdated = false;
    // 各シートを順番に検索。
    for (const sheet of targetSheets) {
      const data = sheet.getDataRange().getValues();
      if (data.length === 0) continue;
      
      const headers = data[0];
      // ヘッダー名から「space」列と「soldout」列のインデックス番号を取得。
      const spaceColumnIndex = headers.indexOf(SPACE_COLUMN_NAME);
      const statusColumnIndex = headers.indexOf(STATUS_COLUMN_NAME);

      // 必要な列が見つからない場合は、このシートをスキップして次のシートへ。
      if (spaceColumnIndex === -1 || statusColumnIndex === -1) {
        continue;
      }

      // データ行をループして、一致するスペースを探す。
      for (let i = 1; i < data.length; i++) {
        if (data[i][spaceColumnIndex] == spaceToUpdate) {
          // undoがtrueならステータスを空に、falseなら購入済みの印を書き込む。
          if (undo) {
            sheet.getRange(i + 1, statusColumnIndex + 1).setValue("");
          } else {
            sheet
              .getRange(i + 1, statusColumnIndex + 1)
              .setValue(PURCHASED_STATUS_TEXT);
          }
          foundAndUpdated = true;
          break; // 見つかったらループを抜ける (単一更新のため)
        }
      }
      if (foundAndUpdated) break; // シートが見つかったらシートのループも抜ける
    }

    if (foundAndUpdated) {
      // 成功レスポンスを返して処理を終了。
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "success",
          message: `Updated ${spaceToUpdate}, undo: ${undo}`,
        })
      ).setMimeType(ContentService.MimeType.JSON);
    } else {
      // 全てのシートを検索してもスペースが見つからなかった場合。
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "error",
          message: `Space "${spaceToUpdate}" not found in any of the specified sheets.`,
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    // その他の予期せぬエラーが発生した場合。
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}