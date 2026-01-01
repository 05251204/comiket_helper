import { Config } from "./config.js";
import { TspSolver } from "./tsp-solver.js";
import { StatsRenderer } from "./stats-renderer.js";
import { ModalManager } from "./modal-manager.js";
import { MapRenderer } from "./map-renderer.js";

/**
 * UI管理クラス
 * DOM操作、表示更新を担当
 */
export class UIManager {
  constructor() {
    this.dataManager = null;
    this.onSetNextTarget = null; // コールバック
    this.statsRenderer = new StatsRenderer(this);
    this.modalManager = new ModalManager();
    // MapRenderer は初期化時に作成（UIManagerの参照が必要なため、ここでは渡せるがinitで渡すほうが安全）
    // あるいは this を渡す。
    this.mapRenderer = new MapRenderer(this);

    this.els = {
      gasUrl: document.getElementById("gas-url"),
      settingsArea: document.getElementById("settings-area"),
      // Sheet Selection
      btnFetchSheets: document.getElementById("btn-fetch-sheets"),
      sheetListContainer: document.getElementById("sheet-list-container"),
      
      locEwsn: document.getElementById("loc-ewsn"),
      locLabel: document.getElementById("loc-label"),
      locNumber: document.getElementById("loc-number"),
      targetSection: document.getElementById("target-content"),
      targetEmpty: document.getElementById("target-empty"),
      targetLoading: document.getElementById("target-loading"),
      heading: document.getElementById("target-space-heading"),
      dist: document.getElementById("target-dist"),
      priority: document.getElementById("target-priority"),
      subTargetSpace: document.getElementById("sub-target-space"),
      tweetLink: document.getElementById("target-tweet-link"),
      tweetEmbed: document.getElementById("tweet-embed-container"),
      
      toast: document.getElementById("toast"),

      // Counts
      cntE456: document.getElementById("count-e456"),
      cntE7: document.getElementById("count-e7"),
      cntW12: document.getElementById("count-w12"),
      cntS12: document.getElementById("count-s12"),
      cntHoldE456: document.getElementById("count-hold-e456"),
      cntHoldE7: document.getElementById("count-hold-e7"),
      cntHoldW12: document.getElementById("count-hold-w12"),
      cntHoldS12: document.getElementById("count-hold-s12"),
    };

    this.toastTimer = null;
    this.customSelects = {}; 
  }

  /**
   * 初期化処理
   */
  init(dataManager, onSetNextTarget) {
    this.dataManager = dataManager;
    this.onSetNextTarget = onSetNextTarget;

    // サブマネージャーの初期化
    this.modalManager.setOnSetNextTargetCallback(onSetNextTarget);
    this.modalManager.init(this, dataManager);
    
    // MapRenderer はコンストラクタで生成済みだが、initが必要なら呼ぶ
    // 現状の MapRenderer.js は init() を持っているが、単純に renderMapLinks を呼ぶだけ。
    // UIManager側で呼ぶ必要はないかもしれないが、明確にするため呼んでおく
    if (this.mapRenderer.init) {
        this.mapRenderer.init();
    }

    // 設定読み込み
    this.els.gasUrl.value = dataManager.getGasUrl();

    // 統計情報の初期化
    this.statsRenderer.init();

    // セレクトボックス初期化 (EWSN) - Config.AREASを使用
    this.els.locEwsn.innerHTML = "";
    if (Config.AREAS) {
      Config.AREAS.forEach((area) => {
        const opt = document.createElement("option");
        opt.value = area.name; // area.idではなくnameを使う（既存ロジック互換のため）
        opt.textContent = area.name;
        this.els.locEwsn.appendChild(opt);
      });
    }

    // セレクトボックス初期化 (Number)
    this.els.locNumber.innerHTML = "";
    const numOptions = [10, 20, 30, 40, 50, 60];
    numOptions.forEach((num) => {
      const opt = document.createElement("option");
      opt.value = num;
      opt.textContent = num;
      this.els.locNumber.appendChild(opt);
    });

    // カスタムセレクトの適用
    this.customSelects.ewsn = this.setupCustomSelect(this.els.locEwsn, () => {
      this.updateLabelOptions(true); 
    });
    this.customSelects.label = this.setupCustomSelect(this.els.locLabel);
    this.customSelects.number = this.setupCustomSelect(this.els.locNumber);

    // ラベル初期化
    this.updateLabelOptions(true);

    this.updateCounts(dataManager);
  }

  // --- Modal Delegate Methods ---

  showPdfModal(source) {
      this.modalManager.showPdfModal(source);
  }

  showGallery(areaKey, isHold = false) {
      this.modalManager.showGallery(areaKey, isHold);
  }

  // --- Map Delegate Methods ---
  
  // 地図リンク生成はMapRendererが担当 (DOM要素を持っているので自動で行われるはずだが、
  // MapRendererのinitでrenderMapLinksが呼ばれる)

  /**
   * シート一覧チェックボックスリストの描画
   */
  renderSheetList(sheets, selectedSheets, onChangeCallback) {
    const container = this.els.sheetListContainer;
    container.innerHTML = "";

    if (!sheets || sheets.length === 0) {
      container.textContent = "シートが見つかりません";
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
        onChangeCallback();
      });

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      container.appendChild(itemDiv);
    });
  }

  /**
   * 選択されているシート名の配列を取得
   */
  getSelectedSheetsFromUI() {
    const container = this.els.sheetListContainer;
    const checked = [];
    container.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      checked.push(cb.value);
    });
    return checked;
  }

  /**
   * カスタムセレクトボックスのセットアップ
   */
  setupCustomSelect(nativeSelect, onChangeCallback) {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-wrapper";
    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
    wrapper.appendChild(nativeSelect);

    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    const initialText =
      nativeSelect.options[nativeSelect.selectedIndex]?.textContent || "";
    trigger.textContent = initialText;
    wrapper.appendChild(trigger);

    const optionsList = document.createElement("div");
    optionsList.className = "custom-options";
    wrapper.appendChild(optionsList);

    const renderOptions = () => {
      optionsList.innerHTML = "";
      Array.from(nativeSelect.options).forEach((opt) => {
        const optionDiv = document.createElement("div");
        optionDiv.className =
          "custom-option" + (opt.selected ? " selected" : "");
        optionDiv.textContent = opt.textContent;
        optionDiv.dataset.value = opt.value;
        optionDiv.onclick = (e) => {
          e.stopPropagation();
          nativeSelect.value = opt.value;
          trigger.textContent = opt.textContent;
          optionsList.classList.remove("open");

          Array.from(optionsList.children).forEach((el) =>
            el.classList.remove("selected")
          );
          optionDiv.classList.add("selected");

          if (onChangeCallback) onChangeCallback();
        };
        optionsList.appendChild(optionDiv);
      });
    };
    renderOptions();

    trigger.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll(".custom-options.open").forEach((el) => {
        if (el !== optionsList) el.classList.remove("open");
      });
      optionsList.classList.toggle("open");
    };

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        optionsList.classList.remove("open");
      }
    });

    return {
      render: () => {
        renderOptions();
        const selected = nativeSelect.options[nativeSelect.selectedIndex];
        if (selected) trigger.textContent = selected.textContent;
      },
      updateTrigger: () => {
        const selected = nativeSelect.options[nativeSelect.selectedIndex];
        if (selected) trigger.textContent = selected.textContent;
      },
    };
  }

  /**
   * 現在地のプルダウン更新
   */
  updateLabelOptions(updateCustom = false) {
    const selected = this.els.locEwsn.value;
    this.els.locLabel.innerHTML = "";
    
    // Config.AREASから該当エリアを検索
    let labels = [];
    if (Config.AREAS) {
      const area = Config.AREAS.find(a => a.name === selected);
      if (area) {
        labels = area.labels;
      }
    }

    labels.forEach((val) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      this.els.locLabel.appendChild(opt);
    });

    if (updateCustom && this.customSelects.label) {
      this.customSelects.label.render();
    }
  }

  /**
   * 次の目的地の表示更新
   */
  showTarget(target, startSpace, nextTarget) {
    this.els.targetLoading.classList.add("hidden");
    this.els.targetEmpty.classList.add("hidden");
    this.els.targetSection.classList.remove("hidden");

    if (!target) {
      // 全完了時の表示
      this.els.heading.textContent = "COMPLETE!";
      this.els.dist.textContent = "-";
      this.els.priority.textContent = "-";
      this.els.subTargetSpace.textContent = "---";
      this.els.tweetEmbed.innerHTML = "";
      // 地図非表示
      if (this.mapRenderer) this.mapRenderer.updateMap(""); // 空文字を送って隠す
      return;
    }

    // 基本情報の表示
    this.els.heading.textContent = target.space;
    this.els.priority.textContent = target.priority || "Normal";
    this.els.subTargetSpace.textContent = nextTarget ? nextTarget.space : "---";

    const dist = TspSolver.calcDist(startSpace, target.space);
    this.els.dist.textContent = dist >= 10000 ? "別エリア" : `距離 ${dist}`;

    // Twitterリンク
    if (target.account) {
      this.els.tweetLink.href = target.account;
      this.els.tweetLink.style.display = "block";
      this.els.tweetLink.innerHTML = `<i class="fa-brands fa-twitter"></i> @${target.account
        .split("/")
        .pop()}`;
      this.els.tweetLink.target = "_blank";
    } else {
      this.els.tweetLink.style.display = "none";
    }

    // お品書き画像表示
    this.els.tweetEmbed.innerHTML = "";
    if (target.tweet) {
      const img = document.createElement("img");
      img.src = target.tweet;
      img.alt = "お品書き";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.borderRadius = "8px";
      img.style.cursor = "pointer";
      img.onclick = () => this.modalManager.showPdfModal(target); // ModalManagerへ委譲
      this.els.tweetEmbed.appendChild(img);
    }

    // 地図の埋め込み表示更新 (MapRendererへ委譲)
    if (this.mapRenderer) {
        this.mapRenderer.updateMap(target.space);
    }
  }

  /**
   * 残り件数の更新
   */
  updateCounts(dm) {
    if (this.statsRenderer) {
      this.statsRenderer.updateCounts(dm);
    }
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
    this.els.toast.className = `show ${type}`; 

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
    this.updateLabelOptions(true); 
    this.els.locLabel.value = label;

    // 番号を最も近い選択肢(10, 20...)に丸める
    const options = [10, 20, 30, 40, 50, 60];
    const closest = options.reduce((prev, curr) => {
      return Math.abs(curr - number) < Math.abs(prev - number) ? curr : prev;
    });
    this.els.locNumber.value = closest;

    if (this.customSelects.ewsn) this.customSelects.ewsn.updateTrigger();
    if (this.customSelects.label) this.customSelects.label.updateTrigger();
    if (this.customSelects.number) this.customSelects.number.updateTrigger();
  }

  /**
   * ロード画面の表示
   */
  showLoading() {
    this.els.targetLoading.classList.remove("hidden");
  }
}
