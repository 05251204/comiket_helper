import { Config } from "./config.js";
import { TspSolver } from "./tsp-solver.js";

/**
 * UI管理クラス
 * DOM操作、表示更新を担当
 */
export class UIManager {
  constructor() {
    this.els = {
      gasUrl: document.getElementById("gas-url"),
      settingsArea: document.getElementById("settings-area"),
      locEwsn: document.getElementById("loc-ewsn"),
      locLabel: document.getElementById("loc-label"),
      locNumber: document.getElementById("loc-number"),
      targetSection: document.getElementById("target-content"),
      targetEmpty: document.getElementById("target-empty"),
      targetLoading: document.getElementById("target-loading"),
      heading: document.getElementById("target-space-heading"),
      dist: document.getElementById("target-dist"),
      priority: document.getElementById("target-priority"),
      tweetLink: document.getElementById("target-tweet-link"),
      tweetEmbed: document.getElementById("tweet-embed-container"),
      toast: document.getElementById("toast"),

      // Counts
      cntE456: document.getElementById("count-e456"),
      cntE7: document.getElementById("count-e7"),
      cntW12: document.getElementById("count-w12"),
      cntS12: document.getElementById("count-s12"),
      cntHold: document.getElementById("count-hold"),
    };

    this.toastTimer = null;
  }

  /**
   * 初期化処理
   */
  init(dataManager) {
    // 設定読み込み
    this.els.gasUrl.value = dataManager.getGasUrl();

    // セレクトボックス初期化
    this.els.locEwsn.innerHTML = "";
    Object.keys(Config.LABEL_OPTIONS).forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key;
      this.els.locEwsn.appendChild(opt);
    });

    this.els.locEwsn.addEventListener("change", () =>
      this.updateLabelOptions()
    );
    this.updateLabelOptions();

    this.updateCounts(dataManager);
  }

  /**
   * 現在地のプルダウン更新
   */
  updateLabelOptions() {
    const selected = this.els.locEwsn.value;
    this.els.locLabel.innerHTML = "";
    (Config.LABEL_OPTIONS[selected] || []).forEach((val) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      this.els.locLabel.appendChild(opt);
    });
  }

  /**
   * 次の目的地の表示更新
   */
  showTarget(target, startSpace) {
    this.els.targetLoading.classList.add("hidden");
    this.els.targetEmpty.classList.add("hidden");
    this.els.targetSection.classList.remove("hidden");

    if (!target) {
      // 全完了時の表示
      this.els.heading.textContent = "COMPLETE!";
      this.els.dist.textContent = "-";
      this.els.priority.textContent = "-";
      this.els.tweetEmbed.innerHTML = "";
      return;
    }

    // 基本情報の表示
    this.els.heading.textContent = target.space;
    this.els.priority.textContent = target.priority || "Normal";

    const dist = TspSolver.calcDist(startSpace, target.space);
    this.els.dist.textContent = dist >= 10000 ? "別エリア" : `距離 ${dist}`;

    // Twitterリンクの生成
    if (target.tweet) {
      this.els.tweetLink.href = target.tweet;
      this.els.tweetLink.style.display = "block";
      this.els.tweetLink.innerHTML = `<i class="fa-brands fa-twitter"></i> お品書き / Twitter`;
    } else if (target.account) {
      this.els.tweetLink.href = target.account;
      this.els.tweetLink.style.display = "block";
      this.els.tweetLink.innerHTML = `<i class="fa-brands fa-twitter"></i> @${target.account
        .split("/")
        .pop()}`;
    } else {
      this.els.tweetLink.style.display = "none";
    }

    // ツイート埋め込み (簡易実装)
    this.els.tweetEmbed.innerHTML = "";
    if (target.tweet && window.twttr) {
      const match = target.tweet.match(/status\/(\d+)/);
      if (match) {
        twttr.widgets.createTweet(match[1], this.els.tweetEmbed, {
          theme: "light",
        });
      }
    }
  }

  /**
   * 残り件数の更新
   */
  updateCounts(dm) {
    const unvisited = dm.getUnvisited();
    const counts = { 東456: 0, 東7: 0, 西12: 0, 南12: 0 };

    unvisited.forEach((c) => {
      const [key] = TspSolver.parseSpace(c.space);
      if (counts[key] !== undefined) counts[key]++;
    });

    this.els.cntE456.textContent = counts["東456"];
    this.els.cntE7.textContent = counts["東7"];
    this.els.cntW12.textContent = counts["西12"];
    this.els.cntS12.textContent = counts["南12"];
    this.els.cntHold.textContent = dm.holdList.length;
  }

  /**
   * 設定画面の開閉
   */
  toggleSettings() {
    this.els.settingsArea.classList.toggle("show");
  }

  /**
   * 通知トーストの表示
   */
  showToast(msg, type = "info") {
    this.els.toast.textContent = msg;
    this.els.toast.className = `show ${type}`; // reset class

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.els.toast.classList.remove("show");
    }, 3000);
  }

  /**
   * 現在地表示を更新
   */
  updateCurrentLocation(space) {
    const [ewsn, label, number] = TspSolver.parseSpace(space);
    this.els.locEwsn.value = ewsn;
    this.updateLabelOptions(); // ラベルオプションを再描画
    this.els.locLabel.value = label;
    this.els.locNumber.value = number;
  }

  /**
   * ロード画面の表示
   */
  showLoading() {
    this.els.targetLoading.classList.remove("hidden");
  }
}
