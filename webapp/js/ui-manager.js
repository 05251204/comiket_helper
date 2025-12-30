import { Config } from "./config.js";
import { TspSolver } from "./tsp-solver.js";
import { StatsRenderer } from "./stats-renderer.js";

/**
 * UI管理クラス
 * DOM操作、表示更新を担当
 */
export class UIManager {
  constructor() {
    this.dataManager = null;
    this.onSetNextTarget = null; // コールバック
    this.currentCircle = null;   // モーダルで表示中の対象
    this.statsRenderer = new StatsRenderer(this);

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
      
      // Gallery Map
      galleryMapContainer: document.getElementById("gallery-map-container"),
      galleryMapHeader: document.getElementById("gallery-map-header"), // 追加
      galleryMapImage: document.getElementById("gallery-map-image"),
      galleryMapScroll: document.getElementById("gallery-map-scroll"),
      
      // Undo button
      btnGalleryUndo: document.getElementById("btn-gallery-undo"),
    };

    this.toastTimer = null;
    this.customSelects = {}; // カスタムセレクトの制御インスタンス保持用
    
    // Gallery state
    this.galleryTargets = [];
    this.currentGalleryArea = null;
    this.currentGalleryIsHold = false;
    this.activePriorities = [10, 9, 8, 7]; // Default all active
  }

  /**
   * 初期化処理
   */
  init(dataManager, onSetNextTarget) {
    this.dataManager = dataManager;
    this.onSetNextTarget = onSetNextTarget;

    // 要素の再取得（安全のため）
    this.els.btnGalleryUndo = document.getElementById("btn-gallery-undo");

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
    
    // ギャラリーフィルターボタン設定
    const filterBtns = document.querySelectorAll('#gallery-filter-controls .filter-btn');
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            const p = parseInt(btn.dataset.priority);
            this.togglePriorityFilter(p, btn);
        };
    });
    
    // ギャラリーUndoボタン
    if (this.els.btnGalleryUndo) {
      this.els.btnGalleryUndo.onclick = () => this.handleGalleryUndo();
    }

    // 統計情報の初期化
    this.statsRenderer.init();

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
    // 3. ギャラリー画面の地図
    if (this.els.galleryMapScroll && this.els.galleryMapImage) {
      this.setupZoom(this.els.galleryMapScroll, this.els.galleryMapImage);
    }
    
    // ギャラリー地図のリサイズ機能初期化
    if (this.els.galleryMapContainer && this.els.galleryMapHeader) {
      this.setupResizableMap(this.els.galleryMapContainer, this.els.galleryMapHeader);
    }
  }

  // (setupResizableMap, setupZoom methods...)

  // (renderMapLinks, renderSheetList, getSelectedSheetsFromUI, showPdfModal, hidePdfModal methods...)

  /**
   * 優先度フィルターの切り替え
   */
  togglePriorityFilter(priority, btnElement) {
    if (this.activePriorities.includes(priority)) {
      this.activePriorities = this.activePriorities.filter(p => p !== priority);
      btnElement.classList.remove('active');
    } else {
      this.activePriorities.push(priority);
      btnElement.classList.add('active');
    }
    this.renderGallery();
  }

  /**
   * ターゲットリストをフィルタリング＆ソート（常にスペース順）
   */
  sortTargets(targets) {
    // 1. Filter
    const filtered = targets.filter(c => {
      // 優先度を数値化
      const pVal = Number(c.priority);
      const priority = isNaN(pVal) ? 0 : pVal;
      // 選択された優先度に含まれるかチェック
      return this.activePriorities.includes(priority);
    });

    // 2. Sort by Space
    const sorted = filtered.sort((a, b) => {
      const [h1, l1, n1] = TspSolver.parseSpace(a.space);
      const [h2, l2, n2] = TspSolver.parseSpace(b.space);

      if (h1 !== h2) return h1.localeCompare(h2);
      if (l1 !== l2) return l1.localeCompare(l2);
      return n1 - n2;
    });

    return sorted;
  }

  /**
   * ギャラリー地図のリサイズ機能を設定
   */
  setupResizableMap(container, header) {
    let startY = 0;
    let startHeight = 0;
    let isResizing = false;

    const onStart = (clientY) => {
      isResizing = true;
      startY = clientY;
      startHeight = container.getBoundingClientRect().height;
      container.classList.add('resizing');
    };

    const onMove = (clientY) => {
      if (!isResizing) return;
      const deltaY = startY - clientY; // 上に動かすとdeltaはプラス
      const newHeight = startHeight + deltaY;
      
      // CSSのmin/max-heightに従うのでここでは値をセットするだけで良いが、
      // 念の為範囲制限してもよい
      container.style.height = `${newHeight}px`;
    };

    const onEnd = () => {
      if (isResizing) {
        isResizing = false;
        container.classList.remove('resizing');
      }
    };

    // Touch events
    header.addEventListener('touchstart', (e) => {
      e.preventDefault(); // スクロール防止
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientY);
      }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (isResizing && e.touches.length === 1) {
        // e.preventDefault(); // 必要なら
        onMove(e.touches[0].clientY);
      }
    }, { passive: false });

    document.addEventListener('touchend', onEnd);

    // Mouse events (for desktop testing)
    header.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientY);
    });

    document.addEventListener('mousemove', (e) => {
      if (isResizing) {
        e.preventDefault();
        onMove(e.clientY);
      }
    });

    document.addEventListener('mouseup', onEnd);
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
   * ギャラリーのソートモードを変更
   */
  changeGallerySort(mode) {
    if (this.gallerySortMode === mode) return;
    this.gallerySortMode = mode;
    this.renderGallery();
  }

  /**
   * ターゲットリストを現在のモードでソート
   */
  sortTargets(targets) {
    // 1. Filter
    const filtered = targets.filter(c => {
      // 優先度を数値化
      const pVal = Number(c.priority);
      const priority = isNaN(pVal) ? 0 : pVal;
      // 選択された優先度に含まれるかチェック
      return this.activePriorities.includes(priority);
    });

    const sorted = [...filtered];
    
    // Helper to get priority value (Integers, larger is higher)
    const getPriorityVal = (p) => {
      // 数値としてパースしてみる
      const val = Number(p);
      // 数値であればそれを返す。そうでなければ（空文字や文字列など）0を返す
      return isNaN(val) ? 0 : val;
    };

    sorted.sort((a, b) => {
      if (this.gallerySortMode === 'priority') {
        const pA = getPriorityVal(a.priority);
        const pB = getPriorityVal(b.priority);
        if (pA !== pB) return pB - pA; // Descending (大きい順)
      }
      
      // Secondary sort (or primary if mode is 'space'): Space order
      const [h1, l1, n1] = TspSolver.parseSpace(a.space);
      const [h2, l2, n2] = TspSolver.parseSpace(b.space);

      // 通常は同じエリアだが、念のため
      if (h1 !== h2) return h1.localeCompare(h2);
      if (l1 !== l2) return l1.localeCompare(l2);
      return n1 - n2;
    });

    return sorted;
  }

  /**
   * ギャラリーモーダルを表示
   */
  showGallery(areaKey, isHold = false) {
    if (!this.dataManager) return;

    // 状態を保存
    this.currentGalleryArea = areaKey;
    this.currentGalleryIsHold = isHold;

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
    
    // 地図表示処理
    if (this.els.galleryMapContainer && this.els.galleryMapImage) {
      if (Config.MAP_LINKS && Config.MAP_LINKS[areaKey]) {
        const url = Config.MAP_LINKS[areaKey];
        // 同じURLならリロードしない
        if (this.els.galleryMapImage.getAttribute("src") !== url) {
          this.els.galleryMapImage.src = url;
        }
        this.els.galleryMapContainer.classList.remove("hidden");
        // ズームリセット
        if (this.els.galleryMapImage.resetZoom) {
          this.els.galleryMapImage.resetZoom();
        }
      } else {
        this.els.galleryMapContainer.classList.add("hidden");
      }
    }
    
    this.galleryTargets = targets;
    this.renderGallery();
    this.els.galleryModal.classList.remove("hidden");
  }

  /**
   * ギャラリーの描画（ソート適用）
   */
  renderGallery() {
    // ボタンの状態更新
    if (this.els.btnSortSpace && this.els.btnSortPriority) {
      if (this.gallerySortMode === 'space') {
        this.els.btnSortSpace.classList.add('active');
        this.els.btnSortPriority.classList.remove('active');
      } else {
        this.els.btnSortSpace.classList.remove('active');
        this.els.btnSortPriority.classList.add('active');
      }
    }

    const targets = this.sortTargets(this.galleryTargets);
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
        
        // サークル情報コンテナ
        const info = document.createElement("div");
        info.className = "circle-info";

        const name = document.createElement("div");
        name.className = "circle-name";
        // 優先度を表示に追加 (例: "東A01a [5]")
        const priorityVal = Number(c.priority);
        const prioritySpan = !isNaN(priorityVal) && priorityVal > 0 ? `<span class="gallery-priority"><i class="fa-solid fa-star"></i>${priorityVal}</span>` : "";
        name.innerHTML = `${c.space}${prioritySpan}`; 
        info.appendChild(name);

        // Twitterリンク
        if (c.account) {
            const twLink = document.createElement("a");
            twLink.href = c.account;
            twLink.target = "_blank";
            twLink.className = "gallery-twitter-link";
            twLink.innerHTML = '<i class="fa-brands fa-twitter"></i>';
            twLink.onclick = (e) => e.stopPropagation(); // モーダル表示を防ぐ
            info.appendChild(twLink);
        }

        // 購入ボタン
        const buyBtn = document.createElement("button");
        buyBtn.className = "gallery-btn-buy";
        buyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        buyBtn.onclick = (e) => {
            e.stopPropagation(); // 画像クリック（拡大）を防ぐ
            this.handleGalleryPurchase(c);
        };
        info.appendChild(buyBtn);

        item.appendChild(info);

        // スワイプアクションの設定
        this.setupSwipeAction(item, () => {
            this.handleGalleryPurchase(c);
        });

        this.els.galleryGrid.appendChild(item);
      });
    }
  }

  /**
   * スワイプアクションの設定
   */
  setupSwipeAction(element, callback) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isSwiping = false;
    const threshold = 100; // アクション発火閾値

    element.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = 0;
      isSwiping = false;
      element.style.transition = 'none';
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const deltaX = x - startX;
      const deltaY = y - startY;

      // 縦スクロール判定
      if (!isSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
        return; 
      }

      // 横スワイプ開始
      if (!isSwiping && Math.abs(deltaX) > 10) {
        isSwiping = true;
      }

      if (isSwiping) {
        if (e.cancelable) e.preventDefault();
        currentX = deltaX;
        element.style.transform = `translateX(${deltaX}px)`;
        
        // 視覚的フィードバック
        if (Math.abs(deltaX) > threshold) {
            element.style.opacity = '0.6';
        } else {
            element.style.opacity = '1';
        }
      }
    }, { passive: false });

    element.addEventListener('touchend', () => {
      element.style.transition = 'transform 0.3s ease-out, opacity 0.3s';
      element.style.opacity = '1';

      if (isSwiping) {
        if (Math.abs(currentX) > threshold) {
          // スワイプ成功 -> 画面外へ飛ばしてから処理
          const direction = currentX > 0 ? 1 : -1;
          element.style.transform = `translateX(${direction * 100}%)`;
          setTimeout(() => {
             callback(); 
             // もしキャンセルされた場合に戻す処理が必要なら、ここでgalleryTargetsの状態を見る
             setTimeout(() => {
                 if (element.parentNode) element.style.transform = ''; // まだ存在してれば戻す
             }, 500);
          }, 50);
        } else {
          element.style.transform = '';
        }
      }
      isSwiping = false;
    });
  }

  /**
   * ギャラリーからの購入処理
   */
  handleGalleryPurchase(circle) {
    if (!this.dataManager) return;
    
    const space = circle.space;
    // 確認ダイアログなしで即座に実行
    this.dataManager.addPurchased(space);
    this.dataManager.syncUpdate(space);
    this.showToast(`${space} 購入完了`);
    
    // ギャラリーデータを更新（購入済みを除外）して再描画
    this.galleryTargets = this.galleryTargets.filter(c => c.space !== space);
    this.renderGallery();
    
    // メイン画面のカウントも更新
    this.updateCounts(this.dataManager);
  }

  /**
   * ギャラリー内でのUndo操作
   */
  handleGalleryUndo() {
    if (!this.dataManager) return;

    const action = this.dataManager.undoLastAction();
    if (action) {
      if (action.type === "purchase") {
        this.dataManager.syncUpdate(action.space, true); // Undo送信
      }
      this.showToast(`${action.space} の操作を取り消しました`);
      
      // メイン画面のカウント更新
      this.updateCounts(this.dataManager);

      // ギャラリーの再描画（直前のエリア状態を復元）
      if (this.currentGalleryArea) {
          this.showGallery(this.currentGalleryArea, this.currentGalleryIsHold);
      }
    } else {
      this.showToast("履歴がありません");
    }
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