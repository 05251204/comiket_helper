// --- Configuration ---
var DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbyi7TdTpUKfMBEsffuvji0AbcRfn3fVLRYg0tR2B00Lu5XGvLZ8P9PD0IMMxmHLCDZz/exec";
var gasUrl = DEFAULT_GAS_URL;

var STORAGE_KEY_URL = 'webAppURL';
var STORAGE_KEY_LAST_DATA = 'comiketDataPebble';

// --- Logic Ported from webapp ---

var LABEL_OPTIONS = {
  "東456": "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨ".split(""),
  "東7": "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "西12": "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめ".split(""),
  "南12": "abcdefghijklmnopqrstuvwxyz".split("")
};

function toHalfWidth(str) {
  if (!str) return "";
  return str.replace(/[！-～]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
  });
}

function parseSpace(space) {
  if (!space) return ["", "", 0];
  var ewsnChar = space[0];
  var labelChar = space[1];
  var numberPart = toHalfWidth(space.substring(2));

  var hallGroup = "";
  for (var key in LABEL_OPTIONS) {
    if (key.indexOf(ewsnChar) === 0 && LABEL_OPTIONS[key].indexOf(labelChar) !== -1) {
      hallGroup = key;
      break;
    }
  }

  var numStr = "";
  for (var i = 0; i < numberPart.length; i++) {
    if (numberPart[i] >= "0" && numberPart[i] <= "9") numStr += numberPart[i];
    else break;
  }
  return [hallGroup, labelChar, parseInt(numStr) || 0];
}

function calcDist(spaceA, spaceB) {
  var p1 = parseSpace(spaceA);
  var p2 = parseSpace(spaceB);
  var h1 = p1[0], l1 = p1[1], n1 = p1[2];
  var h2 = p2[0], l2 = p2[1], n2 = p2[2];

  if (h1 !== h2) return 10000;

  var num1 = n1 > 32 ? 64 - n1 : n1;
  var num2 = n2 > 32 ? 64 - n2 : n2;

  var labelDist = Math.abs(l1.charCodeAt(0) - l2.charCodeAt(0));
  var numDist = Math.abs(num1 - num2);

  return labelDist * 7 + numDist;
}

// --- Data Management ---

var cachedData = null;
var pendingPurchases = []; // 楽観的更新用の保留リスト
var lastSpace = "東1ア01a"; // 現在地 (グローバルで保持)

function fetchData(callback) {
  var url = localStorage.getItem(STORAGE_KEY_URL) || gasUrl;
  
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url + "?type=fetch", true);
  xhr.onload = function() {
    if (xhr.status === 200 || xhr.status === 302) {
      try {
        if (xhr.responseText.indexOf("<!DOCTYPE html>") !== -1) {
           console.log("HTML returned instead of JSON");
           return;
        }

        var data = JSON.parse(xhr.responseText);
        cachedData = data;
        localStorage.setItem(STORAGE_KEY_LAST_DATA, xhr.responseText);
        
        // pendingPurchases のクリーンアップ
        // サーバー側のリストから消えた（＝購入処理完了）ものはpendingから削除
        var serverList = data.wantToBuy || [];
        var newPending = [];
        for (var i = 0; i < pendingPurchases.length; i++) {
          var pendingSpace = pendingPurchases[i];
          var stillInServer = false;
          for (var j = 0; j < serverList.length; j++) {
            if (serverList[j].space === pendingSpace) {
              stillInServer = true;
              break;
            }
          }
          if (stillInServer) {
            newPending.push(pendingSpace);
          }
        }
        pendingPurchases = newPending;
        
        if (callback) callback(data);
      } catch (e) {
        console.log("Error parsing GAS response: " + e);
        Pebble.sendAppMessage({"KEY_NAME": "Parse Err", "KEY_STATS": e.toString().substring(0, 15)});
      }
    } else {
      console.log("HTTP Error: " + xhr.status);
      Pebble.sendAppMessage({"KEY_STATS": "HTTP Err: " + xhr.status});
    }
  };
  xhr.onerror = function() {
    console.log("Network Error");
    Pebble.sendAppMessage({"KEY_STATS": "Net Err (XHR)"});
  };
  xhr.send();
}

function updateCircleStatus(space, type, callback) {
  var url = localStorage.getItem(STORAGE_KEY_URL) || gasUrl;
  if (!url) return;

  var payload = {
    action: "update",
    space: space,
    type: type // "purchased" or "hold"
  };

  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  // Content-Typeを指定しない（デフォルトのtext/plainになることが多い）
  // GASは e.postData.contents を読むのでこれで通るはず
  
  xhr.onload = function() {
    console.log("Update Status: " + xhr.status);
    console.log("Update Response: " + xhr.responseText);

    if (xhr.status === 200 || xhr.status === 302) {
      if (callback) callback();
    } else {
      Pebble.sendAppMessage({"KEY_STATS": "Post Err: " + xhr.status});
    }
  };
  xhr.onerror = function() {
    console.log("Update Network Error");
    Pebble.sendAppMessage({"KEY_STATS": "Post Net Err"});
  };
  
  xhr.send(JSON.stringify(payload));
}

// --- App Logic ---

function updatePebble() {
  if (!cachedData || !cachedData.wantToBuy) {
    return;
  }

  var serverList = cachedData.wantToBuy || [];
  
  // 楽観的更新: pendingPurchases に含まれるものは除外する
  var unvisited = serverList.filter(function(item) {
    return pendingPurchases.indexOf(item.space) === -1;
  });
  
  if (unvisited.length === 0) {
    Pebble.sendAppMessage({
      "KEY_LOCATION": "Finished!",
      "KEY_NAME": "All circles visited",
      "KEY_STATS": "Remaining: 0"
    });
    return;
  }

  // lastSpace (現在地) を基準にソート
  unvisited.sort(function(a, b) {
    return calcDist(lastSpace, a.space) - calcDist(lastSpace, b.space);
  });

  var next = unvisited[0];
  var stats = "Rem: " + unvisited.length;

  setTimeout(function() {
      var name = next.account || next.name || next.space || "No Name";
      var space = next.space || "No Space";

      Pebble.sendAppMessage({
        "KEY_LOCATION": space,
        "KEY_NAME": name,
        "KEY_STATS": stats
      }, function(e) {
        console.log("Sent successfully");
      }, function(e) {
        console.log("Send failed: " + JSON.stringify(e));
      });
  }, 500);
}

// --- Events ---

Pebble.addEventListener('ready', function() {
  console.log("PebbleKit JS ready");
  
  Pebble.sendAppMessage({
    "KEY_STATS": "v1.1 JS Ready"
  });
  
  var savedUrl = localStorage.getItem(STORAGE_KEY_URL);
  if (savedUrl) gasUrl = savedUrl;

  setTimeout(function() {
      fetchData(function() {
        updatePebble();
      });
  }, 1000);
});

Pebble.addEventListener('appmessage', function(e) {
  var dict = e.payload;
  console.log("Received message from Pebble: " + JSON.stringify(dict));

  if (dict.KEY_ACTION === "bought") {
    if (!cachedData || !cachedData.wantToBuy) return;
    
    // 現在の未訪問リストを取得
    var serverList = cachedData.wantToBuy || [];
    var unvisited = serverList.filter(function(item) {
        return pendingPurchases.indexOf(item.space) === -1;
    });

    if (unvisited.length > 0) {
      // 現在地から一番近いものをターゲットとして特定
      unvisited.sort(function(a, b) { return calcDist(lastSpace, a.space) - calcDist(lastSpace, b.space); });
      var target = unvisited[0];

      // 1. 楽観的更新: pendingに追加
      pendingPurchases.push(target.space);
      lastSpace = target.space; // 現在地を更新
      
      // 2. 即座に画面更新 (次のターゲットを表示)
      updatePebble();

      // 3. 裏でGASへ更新リクエスト
      updateCircleStatus(target.space, "purchased", function() {
        // 4. 送信成功したら、少し待ってから再取得
        setTimeout(function() {
            fetchData(function() {
              updatePebble();
            });
        }, 3000);
      });
    }
  } else if (dict.KEY_ACTION === "set_loc") {
    // 現在地手動設定
    if (dict.KEY_LOCATION) {
      lastSpace = dict.KEY_LOCATION;
      console.log("Location manually set to: " + lastSpace);
      // 即座に再計算して更新
      updatePebble(); 
    }
  }
});

// 定期ポーリング (30秒)
setInterval(function() {
  fetchData(function() {
    updatePebble();
  });
}, 30000);