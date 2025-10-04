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
  converted = converted.replace(/　/g, ' ').replace(/．/g, '.');
  return converted;
}

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
      if (!tf1 && (c == '東' || c == '西' || c == '南' || c == '北')) {
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
        if (c == 'a' || c == 'b') {
          ans += c;
          if (c == 'b') break;
        }
      }
    }
    ans = convertCharacters(ans);
    updateRange.setValue(ans);
  }
}

// --- グローバル設定項目 ---
// 読み書きの対象となるシート名のリスト。必要に応じて追加・変更してください。
const TARGET_SHEET_NAMES = ["day1_1"]; 
// サークルのスペース情報が書かれている列のヘッダー名（完全一致）。
const SPACE_COLUMN_NAME = "space";
// 購入済みかどうかを記録する列のヘッダー名（完全一致）。
const STATUS_COLUMN_NAME = "soldout";
// 購入済みの印としてセルに書き込む文字。
const PURCHASED_STATUS_TEXT = "x";
// --- 設定項目ここまで ---

/**
 * WebページからのGETリクエストを処理するメイン関数。
 * 複数のシートから「購入済みでない」サークル情報を取得し、JSON形式で返す。
 * @param {object} e - Apps Scriptが受け取るイベントオブジェクト。
 * @returns {ContentService.TextOutput} - wantToBuyキーを持つJSON形式のレスポンス。
 */
function doGet(e) {
  let combinedResult = []; // 複数のシートの結果を結合するための配列。

  // 設定されたシート名でループ処理。
  TARGET_SHEET_NAMES.forEach(sheetName => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    // シートが見つからない場合は警告を出してスキップ。
    if (!sheet) {
      console.warn(`Sheet "${sheetName}" not found. Skipping.`);
      return;
    }

    const data = sheet.getDataRange().getValues(); // シートの全データを二次元配列として取得。

    // ヘッダー行（1行目）を取得し、小文字に変換・空白削除して整形。
    const headers = data.shift().map(h => String(h).toLowerCase().replace(/\s+/g, ''));

    // データ行をオブジェクトの配列に変換。
    const sheetResult = data.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    }).filter(row => 
      // スペース列に値があり、かつ購入済みステータスでない行のみをフィルタリング。
      row[SPACE_COLUMN_NAME.toLowerCase()] && row[STATUS_COLUMN_NAME.toLowerCase()] !== PURCHASED_STATUS_TEXT
    );

    // 現在のシートの結果を全体の結果に結合。
    combinedResult = combinedResult.concat(sheetResult);
  });

  // 最終的な結果をJSON形式で返す。
  return ContentService.createTextOutput(JSON.stringify({ wantToBuy: combinedResult }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * WebページからのPOSTリクエストを処理するメイン関数。
 * 指定されたスペースの購入ステータスを更新（または元に戻す）。
 * @param {object} e - Apps Scriptが受け取るイベントオブジェクト（POSTデータを含む）。
 * @returns {ContentService.TextOutput} - JSON形式の処理結果レスポンス。
 */
function doPost(e) {
  try {
    // POSTされたJSONデータをパース（解析）。
    const postData = JSON.parse(e.postData.contents);
    const undo = postData.undo || false;   // undoフラグ（購入取り消しかどうか）。なければfalseになる。

    // --- バッチリセット処理 ---
    // postDataに 'spaces' というキーで配列が渡され、かつ undo=true の場合に動作。
    if (postData.spaces && Array.isArray(postData.spaces) && undo) {
      const spacesToReset = postData.spaces;
      let resetCount = 0;

      // 設定された各シートを順番に検索。
      for (const sheetName of TARGET_SHEET_NAMES) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (!sheet) continue; // シートが存在しない場合はスキップ。

        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const spaceColumnIndex = headers.indexOf(SPACE_COLUMN_NAME);
        const statusColumnIndex = headers.indexOf(STATUS_COLUMN_NAME);

        if (spaceColumnIndex === -1 || statusColumnIndex === -1) continue; // 必要な列がなければスキップ。

        // データ行をループして、リセット対象のスペースを探す。
        for (let i = 1; i < data.length; i++) {
          // リセット対象のスペース配列に、現在の行のスペースが含まれているかチェック。
          if (spacesToReset.includes(data[i][spaceColumnIndex])) {
            // 含まれていれば、ステータス列のセルを空にする。
            sheet.getRange(i + 1, statusColumnIndex + 1).setValue('');
            resetCount++;
          }
        }
      }
      // 処理結果を返す。
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `Batch reset successful for ${resetCount} items.` }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // --- バッチリセット処理ここまで ---

    // --- 既存の単一更新処理 ---
    const spaceToUpdate = postData.space;
    // スペース番号が提供されていない場合はエラーを返す。
    if (!spaceToUpdate) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No space provided" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 設定された各シートを順番に検索。
    for (const sheetName of TARGET_SHEET_NAMES) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      if (!sheet) continue; // シートが存在しない場合はスキップ。

      const data = sheet.getDataRange().getValues();
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
            sheet.getRange(i + 1, statusColumnIndex + 1).setValue('');
          } else {
            sheet.getRange(i + 1, statusColumnIndex + 1).setValue(PURCHASED_STATUS_TEXT);
          }
          // 成功レスポンスを返して処理を終了。
          return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `Updated ${spaceToUpdate} in ${sheetName}, undo: ${undo}` }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    // 全てのシートを検索してもスペースが見つからなかった場合。
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Space not found in any of the specified sheets" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // その他の予期せぬエラーが発生した場合。
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}