import { Config } from "./config.js";
import { TspSolver } from "./tsp-solver.js";

/**
 * UI管理クラス
 * DOM操作、表示更新を担当
 */
export class UIManager {
  constructor() {
    this.dataManager = null;
    this.onSetNextTarget = null; // コールバック
    this.currentCircle = null;   // モーダルで表示中の対象

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
      
      // Map Embed
      mapContainer: document.getElementById("target-map-container"),
      mapImageScrollContainer: document.getElementById("map-image-container"),
      mapImage: document.getElementById("target-map-image"),
      mapAreaName: document.getElementById("map-area-name"),
      mapLink: document.getElementById("target-map-link"),

      mapLinksContainer: document.getElementById("map-links-container"),
      toast: document.getElementById("toast"),

      // Counts
      cntE456: document.getElementById("count-e456"),
      cntE7: document.getElementById("count-e7"),
      cntW12: document.getElementById("count-w12"),
      cntS12: document.getElementById("count-s12"),
      // cntHoldは削除、エリア別に変更
      cntHoldE456: document.getElementById("count-hold-e456"),
      cntHoldE7: document.getElementById("count-hold-e7"),
      cntHoldW12: document.getElementById("count-hold-w12"),
      cntHoldS12: document.getElementById("count-hold-s12"),

      // PDF Modal
      pdfModal: document.getElementById("pdf-modal"),
      pdfImage: document.getElementById("pdf-modal-image"),
      btnClosePdf: document.getElementById("btn-close-pdf"),
      btnSetTarget: document.getElementById("btn-set-target"), // 追加

      // Gallery Modal
      galleryModal: document.getElementById("gallery-modal"),
      galleryGrid: document.getElementById("gallery-grid"),
      btnCloseGallery: document.getElementById("btn-close-gallery"),
    };

    this.toastTimer = null;
    this.customSelects = {}; // カスタムセレクトの制御インスタンス保持用
  }

  /**
   * 初期化処理
   */
  init(dataManager, onSetNextTarget) {
    this.dataManager = dataManager;
    this.onSetNextTarget = onSetNextTarget;

    // 設定読み込み
    this.els.gasUrl.value = dataManager.getGasUrl();

    // PDF閉じるボタン
    this.els.btnClosePdf.addEventListener("click", () => this.hidePdfModal());

    // 目的地設定ボタン
    if (this.els.btnSetTarget) {
      this.els.btnSetTarget.addEventListener("click", () => {
        if (this.onSetNextTarget && this.currentCircle) {
          this.onSetNextTarget(this.currentCircle);
          this.hidePdfModal();
          this.hideGalleryModal();
        }
      });
    }

    // ギャラリー閉じるボタン
    this.els.btnCloseGallery.addEventListener("click", () => this.hideGalleryModal());

    // カウントセルへのイベント登録
    const areaMap = {
      cntE456: "東456",
      cntE7: "東7",
      cntW12: "西12",
      cntS12: "南12",
    };

    Object.entries(areaMap).forEach(([key, areaName]) => {
      if (this.els[key]) {
        this.els[key].addEventListener("click", () => {
          // 件数が0でない場合のみ開く（スタイルはupdateCountsで制御）
          if (this.els[key].classList.contains("count-cell")) {
            this.showGallery(areaName, false);
          }
        });
      }
    });

    // 保留カウントセルへのイベント登録
    const holdAreaMap = {
      cntHoldE456: "東456",
      cntHoldE7: "東7",
      cntHoldW12: "西12",
      cntHoldS12: "南12",
    };

    Object.entries(holdAreaMap).forEach(([key, areaName]) => {
      if (this.els[key]) {
        this.els[key].addEventListener("click", (e) => {
          e.stopPropagation(); // 行クリックイベントへの伝播を防ぐ
          if (this.els[key].classList.contains("count-cell")) {
            this.showGallery(areaName, true);
          }
        });
      }
    });

    // セレクトボックス初期化 (EWSN) - カスタムセレクト生成前に実行
    this.els.locEwsn.innerHTML = "";
    Object.keys(Config.LABEL_OPTIONS).forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key;
      this.els.locEwsn.appendChild(opt);
    });

    // セレクトボックス初期化 (Number) - カスタムセレクト生成前に実行
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
      this.updateLabelOptions(true); // 変更時にラベル更新
    });
    this.customSelects.label = this.setupCustomSelect(this.els.locLabel);
    this.customSelects.number = this.setupCustomSelect(this.els.locNumber);

    // ラベル初期化 (カスタムセレクト生成後に実行してrenderをトリガー)
    this.updateLabelOptions(true);

    this.renderMapLinks(); // 地図リンクの生成
    this.updateCounts(dataManager);
    
    // 画像のズーム機能初期化
    // 1. モーダル画像
    this.setupZoom(document.getElementById("modal-image-container"), this.els.pdfImage);
    // 2. メイン画面の地図
    this.setupZoom(this.els.mapImageScrollContainer, this.els.mapImage);
  }

  /**
   * 画像のピンチズーム・パン機能を設定
   */
  setupZoom(container, img) {
    let scale = 1;
    let pointX = 0;
    let pointY = 0;
    let startX = 0;
    let startY = 0;
    let initialDist = 0;
    let initialScale = 1;

    // スタイル初期化
    container.style.overflow = "hidden";
    container.style.touchAction = "none";
    img.style.transformOrigin = "center center";
    img.style.transition = "transform 0.1s ease-out";

    // リセット機能の公開
    img.resetZoom = () => {
      scale = 1;
      pointX = 0;
      pointY = 0;
      img.style.transform = `translate(0px, 0px) scale(1)`;
    };

    // ブラウザ全体のズームを抑制する (iOS Safari対策)
    const preventDefault = (e) => {
      if (e.cancelable) e.preventDefault();
    };

    container.addEventListener("gesturestart", preventDefault);
    container.addEventListener("gesturechange", preventDefault);

    // タッチ開始
    container.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        // パン開始
        startX = e.touches[0].clientX - pointX;
        startY = e.touches[0].clientY - pointY;
        img.style.transition = "none";
      } else if (e.touches.length === 2) {
        // ズーム開始
        initialDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = scale;
        img.style.transition = "none";
      }
    }, { passive: false });

    // タッチ移動
    container.addEventListener("touchmove", (e) => {
      if (e.cancelable) e.preventDefault(); // スクロール阻止

      if (e.touches.length === 1) {
        // パン
        pointX = e.touches[0].clientX - startX;
        pointY = e.touches[0].clientY - startY;
      } else if (e.touches.length === 2) {
        // ズーム
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        // 距離の変化比率でスケール変更
        const zoomFactor = dist / initialDist;
        scale = initialScale * zoomFactor;

        // 制限
        scale = Math.max(0.8, Math.min(scale, 8));
      }

      img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    }, { passive: false });

    // タッチ終了
    container.addEventListener("touchend", (e) => {
        if (e.touches.length === 0) {
            img.style.transition = "transform 0.2s ease-out";
            // スケールが小さすぎる場合は戻す
            if (scale < 1) {
                scale = 1;
                pointX = 0;
                pointY = 0;
                img.style.transform = `translate(0px, 0px) scale(1)`;
            }
        }
    });
  }

  /**
   * 地図リンクボタンの生成
   */
  renderMapLinks() {
    if (!this.els.mapLinksContainer || !Config.MAP_LINKS) return;

    this.els.mapLinksContainer.innerHTML = "";
    Object.entries(Config.MAP_LINKS).forEach(([name, url]) => {
      const button = document.createElement("button");
      button.className = "map-link-btn";
      button.innerHTML = `<i class="fa-regular fa-map"></i> ${name}`;
      button.onclick = () => this.showPdfModal(url);
      this.els.mapLinksContainer.appendChild(button);
    });
  }

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
   * PDFモーダルを表示
   * @param {string|Object} source - 画像URL または サークルデータ
   */
  showPdfModal(source) {
    if (!this.els.pdfModal || !this.els.pdfImage) return;

    let url = "";
    this.currentCircle = null;

    if (typeof source === "string") {
        url = source;
        if (this.els.btnSetTarget) this.els.btnSetTarget.style.display = "none";
    } else if (source && typeof source === "object") {
        url = source.tweet;
        this.currentCircle = source;
        if (this.els.btnSetTarget) this.els.btnSetTarget.style.display = "block";
    }

    this.els.pdfModal.classList.remove("hidden");
    this.els.pdfImage.src = url;
    if (this.els.pdfImage.resetZoom) {
      this.els.pdfImage.resetZoom();
    }
  }

  /**
   * PDFモーダルを非表示
   */
  hidePdfModal() {
    this.els.pdfModal.classList.add("hidden");
    this.els.pdfImage.src = "";
    this.currentCircle = null;
  }

  /**
   * ギャラリーモーダルを表示
   */
  showGallery(areaKey, isHold = false) {
    if (!this.dataManager) return;

    let targets = [];
    if (isHold) {
      // 保留リストから
      targets = this.dataManager.wantToBuy.filter((c) => {
        if (!this.dataManager.holdList.includes(c.space)) return false;
        const [key] = TspSolver.parseSpace(c.space);
        return key === areaKey;
      });
    } else {
      // 未訪問リストから
      const unvisited = this.dataManager.getUnvisited();
      targets = unvisited.filter((c) => {
        const [key] = TspSolver.parseSpace(c.space);
        return key === areaKey;
      });
    }

    this.els.galleryGrid.innerHTML = "";

    if (targets.length === 0) {
      const msg = document.createElement("div");
      msg.textContent = "お品書き画像はありません";
      msg.style.color = "white";
      msg.style.padding = "1rem";
      msg.style.gridColumn = "1 / -1";
      this.els.galleryGrid.appendChild(msg);
    } else {
      targets.forEach((c) => {
        const item = document.createElement("div");
        item.className = "gallery-item";
        
        if (c.tweet) {
            const img = document.createElement("img");
            img.loading = "lazy";
            
            // 画像読み込み後にアスペクト比を判定してクラス付与
            img.onload = function() {
              if (this.naturalWidth > this.naturalHeight) {
                item.classList.add("wide");
              }
            };
            
            // src設定はonloadの後に行う (キャッシュ対策)
            img.src = c.tweet;
            item.appendChild(img);

            item.onclick = () => {
              this.showPdfModal(c); // オブジェクトを渡す
            };
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "no-image-placeholder";
            placeholder.innerHTML = '<i class="fa-regular fa-image"></i><span>No Image</span>';
            item.appendChild(placeholder);
            
            // 画像がない場合もモーダルを開けるようにする（目的地設定用）
            item.onclick = () => {
                this.showPdfModal(c);
            };
        }
        
        const name = document.createElement("div");
        name.className = "circle-name";
        name.textContent = c.space; 

        item.appendChild(name);

        this.els.galleryGrid.appendChild(item);
      });
    }

    this.els.galleryModal.classList.remove("hidden");
  }

  /**
   * ギャラリーモーダルを非表示
   */
  hideGalleryModal() {
    this.els.galleryModal.classList.add("hidden");
    this.els.galleryGrid.innerHTML = "";
  }

  /**
   * カスタムセレクトボックスのセットアップ
   */
  setupCustomSelect(nativeSelect, onChangeCallback) {
    // ラッパー作成
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-wrapper";
    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
    wrapper.appendChild(nativeSelect);

    // トリガー（表示部分）作成
    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    // 初期値設定
    const initialText =
      nativeSelect.options[nativeSelect.selectedIndex]?.textContent || "";
    trigger.textContent = initialText;
    wrapper.appendChild(trigger);

    // オプションリスト作成
    const optionsList = document.createElement("div");
    optionsList.className = "custom-options";
    wrapper.appendChild(optionsList);

    // オプション生成関数
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
          // ネイティブのchangeイベントを発火させる必要があればここで行うが、
          // callbackで処理するならそれで良い
          trigger.textContent = opt.textContent;
          optionsList.classList.remove("open");

          // 選択状態更新
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

    // トリガークリックイベント
    trigger.onclick = (e) => {
      e.stopPropagation();
      // 他の開いているセレクトを閉じる
      document.querySelectorAll(".custom-options.open").forEach((el) => {
        if (el !== optionsList) el.classList.remove("open");
      });
      optionsList.classList.toggle("open");
    };

    // 外側クリックで閉じる
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        optionsList.classList.remove("open");
      }
    });

    // 外部から値を更新した時のための再描画メソッド
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
    (Config.LABEL_OPTIONS[selected] || []).forEach((val) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      this.els.locLabel.appendChild(opt);
    });

    // カスタムセレクトの再描画
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
      return;
    }

    // 基本情報の表示
    this.els.heading.textContent = target.space;
    this.els.priority.textContent = target.priority || "Normal";
    this.els.subTargetSpace.textContent = nextTarget ? nextTarget.space : "---";

    const dist = TspSolver.calcDist(startSpace, target.space);
    this.els.dist.textContent = dist >= 10000 ? "別エリア" : `距離 ${dist}`;

    // Twitterリンクの優先表示 (アカウントリンク優先)
    if (target.account) {
      this.els.tweetLink.href = target.account;
      this.els.tweetLink.style.display = "block";
      this.els.tweetLink.innerHTML = `<i class="fa-brands fa-twitter"></i> @${target.account
        .split("/")
        .pop()}`;
      this.els.tweetLink.target = "_blank";
    } else {
      // アカウントがない場合はリンクを表示しない
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
      img.onclick = () => this.showPdfModal(target); // モーダルを使用
      this.els.tweetEmbed.appendChild(img);
    }

    // 地図の埋め込み表示更新
    const [hallGroup] = TspSolver.parseSpace(target.space);
    if (hallGroup && Config.MAP_LINKS[hallGroup]) {
      const url = Config.MAP_LINKS[hallGroup];
      
      // コンテナを表示
      const isHidden = this.els.mapContainer.classList.contains("hidden");
      if (isHidden) {
        this.els.mapContainer.classList.remove("hidden");
      }

      this.els.mapAreaName.textContent = hallGroup;
      
      // 同じURLならリロードしない (属性値で厳密に比較)
      if (this.els.mapImage.getAttribute("src") !== url) {
         this.els.mapImage.src = url;
      }
      this.els.mapLink.href = url;
    } else {
      this.els.mapContainer.classList.add("hidden");
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

    const updateCell = (el, count) => {
      if (!el) return;
      el.textContent = count;
      if (count > 0) {
        el.classList.add("count-cell");
      } else {
        el.classList.remove("count-cell");
      }
    };

    updateCell(this.els.cntE456, counts["東456"]);
    updateCell(this.els.cntE7, counts["東7"]);
    updateCell(this.els.cntW12, counts["西12"]);
    updateCell(this.els.cntS12, counts["南12"]);

    // 保留数のエリア別カウント
    const holdCounts = { 東456: 0, 東7: 0, 西12: 0, 南12: 0 };
    dm.holdList.forEach((space) => {
      const [key] = TspSolver.parseSpace(space);
      if (holdCounts[key] !== undefined) holdCounts[key]++;
    });

    updateCell(this.els.cntHoldE456, holdCounts["東456"]);
    updateCell(this.els.cntHoldE7, holdCounts["東7"]);
    updateCell(this.els.cntHoldW12, holdCounts["西12"]);
    updateCell(this.els.cntHoldS12, holdCounts["南12"]);
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
    this.updateLabelOptions(true); // カスタムセレクトも更新
    this.els.locLabel.value = label;

    // 番号を最も近い選択肢(10, 20...)に丸める
    const options = [10, 20, 30, 40, 50, 60];
    const closest = options.reduce((prev, curr) => {
      return Math.abs(curr - number) < Math.abs(prev - number) ? curr : prev;
    });
    this.els.locNumber.value = closest;

    // カスタムセレクトの表示を更新
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