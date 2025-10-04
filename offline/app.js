let purchasedList = JSON.parse(localStorage.getItem('purchasedList')) || [];
let currentTarget = null;

const labelOptions = {
    '東456': 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨ'.split(''),
    '東7': 'ABCDEFGHIJKLMNOPQRSTUVW'.split(''),
    '西12': 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめ'.split(''),
    '南12': 'abcdefghijklmnopqrst'.split('')
};

function updateLabelOptions() {
    const hallSelect = document.getElementById('current-ewsn');
    const labelSelect = document.getElementById('current-label');
    const selectedHall = hallSelect.value;
    labelSelect.innerHTML = '';
    const options = labelOptions[selectedHall] || [];
    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        labelSelect.appendChild(option);
    });
}
document.addEventListener('DOMContentLoaded', () => {
    updateLabelOptions();
    updateRemainingCounts();
});
document.getElementById('current-ewsn').addEventListener('change', updateLabelOptions);

function toHalfWidth(str) {
  if (!str) return '';
  return str.replace(/[！-～]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

function distinct_space(space){
  let ewsnChar = space[0];
  let labelChar = space[1];
  let numberPart = toHalfWidth(space.substring(2));
  let hallGroupKey = '';
  for (const key in labelOptions) {
      if (key.startsWith(ewsnChar) && labelOptions[key].includes(labelChar)) {
          hallGroupKey = key;
          break;
      }
  }
  let number = '';
  for (let i = 0; i < numberPart.length; i++) {
      const char = numberPart[i];
      if (char >= '0' && char <= '9') {
          number += char;
      } else {
          break;
      }
  }
  return [hallGroupKey, labelChar, number];
}

function updateNextTarget() {
    const currentewsn = (document.getElementById('current-ewsn').value);
    const currentlabel = (document.getElementById('current-label').value);
    const numberInput = document.getElementById('current-number').value;
    const currentnumber = parseFloat(toHalfWidth(numberInput));
    document.getElementById('loading').textContent = '検索中...';
    document.getElementById('target-info').style.display = 'none';

    const targetCircles = comiketData.wantToBuy.map(circle => {
        return {
            space: circle.space,
            user: circle.user,
            tweet: circle.tweet
        };
    }).filter(circle =>
        !purchasedList.includes(circle.space)
    );
    
    const nextCircle = calculateNextCircle(currentewsn, currentlabel, currentnumber,targetCircles);
    currentTarget = nextCircle;
    const targetInfoDiv = document.getElementById('target-info');
    if (nextCircle.message) { 
        document.getElementById('loading').textContent = nextCircle.message;
        document.querySelector('.target-details').style.display = 'none';
        document.getElementById('target-tweet-container').style.display = 'none';
        targetInfoDiv.style.display = 'block';
    } else { // 次の目的地が見つかった場合
        document.getElementById('loading').textContent = '';
        targetInfoDiv.style.display = 'block';
        document.querySelector('.target-details').style.display = 'block';
        document.getElementById('target-tweet-container').style.display = 'block';
        document.getElementById('target-space').textContent = nextCircle.space;
        document.getElementById('target-distance').textContent = nextCircle.distance;

        const userLink = document.getElementById('target-user');
        if(nextCircle.user) {
            userLink.textContent = nextCircle.user.split('/').pop(); // ユーザー名のみ表示
            userLink.href = nextCircle.user;
        } else {
            userLink.textContent = 'N/A';
            userLink.href = '#';
        }
        //ツイート埋め込み
        const tweetContainer = document.getElementById('target-tweet-container');
        tweetContainer.innerHTML = '';
        if (nextCircle.tweet && twttr && twttr.widgets) {
            const tweetIdMatch = nextCircle.tweet.match(/status\/(\d+)/);
            if (tweetIdMatch && tweetIdMatch[1]) {
                twttr.widgets.createTweet(
                    tweetIdMatch[1], // ツイートID
                    tweetContainer, // 埋め込む要素
                    { theme: 'light' }
                ).catch(err => {
                    console.error('Failed to embed tweet:', err);
                    tweetContainer.innerHTML = '<p>ツイートの埋め込みに失敗しました。</p>';
                });
            } else {
                tweetContainer.innerHTML = '<p><a href="' + nextCircle.tweet + '" target="_blank">お品書きツイートを見る</a></p>';
            }
        } else if (nextCircle.tweet) {
            tweetContainer.innerHTML = '<p><a href="' + nextCircle.tweet + '" target="_blank">お品書きツイートを見る</a></p>';
        } else {
            tweetContainer.innerHTML = '<p>お品書き情報なし</p>';
        }
    }
    updateRemainingCounts();
}

document.getElementById('purchased-btn').addEventListener('click', () => {
    if (currentTarget && currentTarget.space) {
        purchasedList.push(currentTarget.space);
        localStorage.setItem('purchasedList', JSON.stringify(purchasedList));
        const [ewsn, label, number] = distinct_space(currentTarget.space);
        document.getElementById('current-ewsn').value = ewsn;
        updateLabelOptions();
        document.getElementById('current-label').value = label;
        document.getElementById('current-number').value = number;
        updateNextTarget();
    }
});

function undoLastPurchase() {
    if (purchasedList.length > 0) {
        purchasedList.pop();
        localStorage.setItem('purchasedList', JSON.stringify(purchasedList));
        updateNextTarget();
    }
}

function resetPurchasedList() {
    if (confirm('購入リストを完全にリセットしますか？')) {
        purchasedList = [];
        localStorage.removeItem('purchasedList');
        updateNextTarget();
    }
}
document.getElementById('undo-btn').addEventListener('click', undoLastPurchase);
document.getElementById('reset-list-btn').addEventListener('click', resetPurchasedList);

function calc_dist(ewsn1, label1, number1, ewsn2, label2, number2) {
  if (number1 > 32) number1 = 64 - number1;
  if (number2 > 32) number2 = 64 - number2;
  if (ewsn1.charAt(0) !== ewsn2.charAt(0)) {
      return 1e9;
  }
  const labelDist = Math.abs(label1.charCodeAt(0) - label2.charCodeAt(0));
  const numberDist = Math.abs(number1 - number2);
  const dist = labelDist * 4 + numberDist;
  return dist;
}

function calculateNextCircle(currentewsn, currentlabel, currentnumber,targets) {
  if (targets.length === 0) {
    return { message: "完了" };
  }

  let nearestCircle = null;
  let minDistance = 5e9;

  targets.forEach(circle => {
    const [targetewsn, targetlabel, targetnumberStr] = distinct_space(circle.space);
    const targetnumber = parseFloat(targetnumberStr);
    const distance = calc_dist(currentewsn.charAt(0), currentlabel, currentnumber, targetewsn, targetlabel, targetnumber);
    if (distance < minDistance) {
      minDistance = distance;
      nearestCircle = circle;
    }
  });
  if (nearestCircle) {
    return { ...nearestCircle, distance: minDistance };
  }
}

function updateRemainingCounts() {
    const unvisitedCircles = comiketData.wantToBuy.filter(circle => 
        !purchasedList.includes(circle.space)
    );
    const counts = {
        '東456': 0,
        '東7': 0,
        '西12': 0,
        '南12': 0
    };
    unvisitedCircles.forEach(circle => {
        const [ewsn, label, _number] = distinct_space(circle.space);
        for (const groupKey in labelOptions) {
            if (groupKey.startsWith(ewsn) && labelOptions[groupKey].includes(label)) {
                counts[groupKey]++;
                break;
            }
        }
    });
    document.getElementById('count-E456').textContent = counts['東456'];
    document.getElementById('count-E7').textContent = counts['東7'];
    document.getElementById('count-W12').textContent = counts['西12'];
    document.getElementById('count-S12').textContent = counts['南12'];
}