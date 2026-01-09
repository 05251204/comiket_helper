import { TspSolver } from "./tsp-solver.js";
import { Config } from "./config.js"; // マップ表示のために追加

/**
 * モーダル管理クラス
 * PDF（画像）モーダルおよびギャラリーモーダルの制御を担当
 */
export class ModalManager {
  constructor() {
    this.els = {
      pdfModal: document.getElementById("pdf-modal"),
      pdfImage: document.getElementById("pdf-modal-image"),
      btnClosePdf: document.getElementById("btn-close-pdf"),
      modalImageContainer: document.getElementById("modal-image-container"),
      btnSetTarget: document.getElementById("btn-set-target"),

      galleryModal: document.getElementById("gallery-modal"),
      galleryGrid: document.getElementById("gallery-grid"),
      btnCloseGallery: document.getElementById("btn-close-gallery"),

      // Sort buttons
      btnSortSpace: document.getElementById("btn-sort-space"),
      btnSortPriority: document.getElementById("btn-sort-priority"),
      
      // Gallery Map
      galleryMapContainer: document.getElementById("gallery-map-container"),
      galleryMapHeader: document.getElementById("gallery-map-header"),
      galleryMapImage: document.getElementById("gallery-map-image"),
      galleryMapScroll: document.getElementById("gallery-map-scroll"),

      // Undo button
      btnGalleryUndo: document.getElementById("btn-gallery-undo"),
    };

    this.onSetNextTarget = null;
    this.currentCircle = null;
    this.uiManager = null;
    this.dataManager = null;
    
    // Gallery state
    this.currentTargets = [];
    this.activePriorities = [10, 9, 8, 7]; // Default
    this.sortMode = 'priority'; // 'space' | 'priority'
    this.currentGalleryArea = null; // エリア保持用
    this.currentGalleryIsHold = false; // 保留リストかどうか

    // フィルタボタンへの参照は init で取得
  }

  /**
   * 目的地設定コールバックを登録
   */
  setOnSetNextTargetCallback(callback) {
    this.onSetNextTarget = callback;
  }

  /**
   * 初期化: イベントリスナーとズーム機能の設定
   */
  init(uiManager, dataManager) {
    this.uiManager = uiManager;
    this.dataManager = dataManager;

    if (this.els.btnClosePdf) {
      this.els.btnClosePdf.addEventListener("click", () => this.hidePdfModal());
    }
    if (this.els.btnCloseGallery) {
      this.els.btnCloseGallery.addEventListener("click", () => this.hideGalleryModal());
    }

    if (this.els.btnSetTarget) {
      this.els.btnSetTarget.addEventListener("click", () => {
        if (this.onSetNextTarget && this.currentCircle) {
          this.onSetNextTarget(this.currentCircle);
          this.hidePdfModal();
          this.hideGalleryModal(); // ギャラリーも閉じる
        }
      });
    }

    // ギャラリーUndo
    if (this.els.btnGalleryUndo) {
        this.els.btnGalleryUndo.onclick = () => this.handleGalleryUndo();
    }

    // ギャラリーフィルターボタン設定
    const filterBtns = document.querySelectorAll('#gallery-filter-controls .filter-btn');
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            const p = parseInt(btn.dataset.priority);
            this.togglePriorityFilter(p, btn);
        };
    });

    if (this.els.modalImageContainer && this.els.pdfImage) {
      this.setupZoom(this.els.modalImageContainer, this.els.pdfImage);
    }
    
    // ギャラリーマップのズーム
    if (this.els.galleryMapScroll && this.els.galleryMapImage) {
        this.setupZoom(this.els.galleryMapScroll, this.els.galleryMapImage);
    }

    // ギャラリーマップのリサイズ
    if (this.els.galleryMapContainer && this.els.galleryMapHeader) {
        this.setupResizableMap(this.els.galleryMapContainer, this.els.galleryMapHeader);
    }

    // Sort buttons events
    if (this.els.btnSortSpace) {
      this.els.btnSortSpace.addEventListener("click", () => this.changeSortMode('space'));
    }
    if (this.els.btnSortPriority) {
      this.els.btnSortPriority.addEventListener("click", () => this.changeSortMode('priority'));
    }
  }

    /**
     * ソートモードを変更して再描画
     */
    changeSortMode(mode) {
          if (this.sortMode === mode) return;
          this.sortMode = mode;
      
          // UI update
          if (mode === 'space') {
            if (this.els.btnSortSpace) this.els.btnSortSpace.classList.add('active');
            if (this.els.btnSortPriority) this.els.btnSortPriority.classList.remove('active');
          } else {
            if (this.els.btnSortSpace) this.els.btnSortSpace.classList.remove('active');
            if (this.els.btnSortPriority) this.els.btnSortPriority.classList.add('active');
          }
      
          this.renderGallery();
        }

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
       * ターゲットリストを現在のモードでソート
       */
      sortTargets(targets) {
        const sorted = [...targets];
        
        // Helper to get priority value
        const getPriorityVal = (p) => {
          // 数値の場合（10, 9, 8...）
          const num = parseFloat(p);
          if (!isNaN(num)) return num;
          return 0;
        };
    
        sorted.sort((a, b) => {
          if (this.sortMode === 'priority') {
            const pA = getPriorityVal(a.priority);
            const pB = getPriorityVal(b.priority);
            if (pA !== pB) return pB - pA; // Descending
          }
          
          // Secondary sort (or primary if mode is 'space'): Space order
          const [h1, l1, n1] = TspSolver.parseSpace(a.space);
          const [h2, l2, n2] = TspSolver.parseSpace(b.space);
    
          if (h1 !== h2) return h1.localeCompare(h2);
          if (l1 !== l2) return l1.localeCompare(l2);
          return n1 - n2;
        });
    
        return sorted;
      }
    
      /**
       * PDF(画像)モーダルを表示
       * @param {string|Object} source - 画像URL または サークルデータオブジェクト
       */
      showPdfModal(source) {
        if (!this.els.pdfModal || !this.els.pdfImage) return;
    
        let url = "";
        this.currentCircle = null;
    
        if (typeof source === "string") {
          // URL文字列の場合 (地図など)
          url = source;
          this.els.btnSetTarget.style.display = "none";
        } else if (source && typeof source === "object") {
          // サークルデータの場合
          url = source.tweet;
          this.currentCircle = source;
          this.els.btnSetTarget.style.display = "block";
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
        if (!this.els.pdfModal || !this.els.pdfImage) return;
        this.els.pdfModal.classList.add("hidden");
        this.els.pdfImage.src = "";
        this.currentCircle = null;
      }
    
      /**
       * ギャラリーモーダルを表示
       * @param {string} areaKey - エリアキー (例: "東456")
       * @param {boolean} isHold - 保留リストかどうか
       */
      showGallery(areaKey, isHold = false) {
        if (!this.els.galleryModal || !this.els.galleryGrid || !this.dataManager) return;
        
        this.currentGalleryArea = areaKey;
        this.currentGalleryIsHold = isHold;

        // データ取得
        let targets = [];
        if (isHold) {
          targets = this.dataManager.wantToBuy.filter((c) => {
            if (!this.dataManager.holdList.includes(c.space)) return false;
            const [key] = TspSolver.parseSpace(c.space);
            return key === areaKey;
          });
        } else {
          const unvisited = this.dataManager.getUnvisited();
          targets = unvisited.filter((c) => {
            const [key] = TspSolver.parseSpace(c.space);
            return key === areaKey;
          });
        }
        
        this.currentTargets = targets;

        // 地図表示処理
        if (this.els.galleryMapContainer && this.els.galleryMapImage) {
            if (Config.MAP_LINKS && Config.MAP_LINKS[areaKey]) {
            const url = Config.MAP_LINKS[areaKey];
            if (this.els.galleryMapImage.getAttribute("src") !== url) {
                this.els.galleryMapImage.src = url;
            }
            this.els.galleryMapContainer.classList.remove("hidden");
            if (this.els.galleryMapImage.resetZoom) {
                this.els.galleryMapImage.resetZoom();
            }
            } else {
            this.els.galleryMapContainer.classList.add("hidden");
            }
        }
    
        this.renderGallery();
        this.els.galleryModal.classList.remove("hidden");
      }
    
      /**
       * ギャラリーの中身を描画
       */
      renderGallery() {
        this.els.galleryGrid.innerHTML = "";
        
        // フィルタリング適用
        const filteredTargets = this.currentTargets.filter(c => {
          if (this.activePriorities.length === 0) return false;
          const p = Number(c.priority);
          const pVal = isNaN(p) ? 0 : p;
          return this.activePriorities.includes(pVal);
        });
    
        const targets = this.sortTargets(filteredTargets);
    
        if (targets.length === 0) {
          const msg = document.createElement("div");
          msg.textContent = "対象サークルはありません";
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
                img.onload = function() {
                  if (this.naturalWidth > this.naturalHeight) {
                    item.classList.add("wide");
                  }
                };
                img.src = c.tweet;
                item.appendChild(img);
    
                item.onclick = () => {
                  this.showPdfModal(c);
                };
            } else {
                const placeholder = document.createElement("div");
                placeholder.className = "no-image-placeholder";
                placeholder.innerHTML = '<i class="fa-regular fa-image"></i><span>No Image</span>';
                item.appendChild(placeholder);
                item.onclick = () => {
                    this.showPdfModal(c);
                };
            }
            
            // サークル情報
            const info = document.createElement("div");
            info.className = "circle-info";

            const name = document.createElement("div");
            name.className = "circle-name";
            // 優先度を表示
            const priorityVal = Number(c.priority);
            const prioritySpan = !isNaN(priorityVal) && priorityVal > 0 ? `<span class="gallery-priority"><i class="fa-solid fa-star"></i>${priorityVal}</span>` : "";
            name.innerHTML = `${c.space}${prioritySpan}`;
            info.appendChild(name);
            
            // Twitter Link
            if (c.account) {
                const twLink = document.createElement("a");
                twLink.href = c.account;
                twLink.target = "_blank";
                twLink.className = "gallery-twitter-link";
                twLink.innerHTML = '<i class="fa-brands fa-twitter"></i>';
                twLink.onclick = (e) => e.stopPropagation();
                info.appendChild(twLink);
            }

            // 購入ボタン
            const buyBtn = document.createElement("button");
            buyBtn.className = "gallery-btn-buy";
            buyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            buyBtn.onclick = (e) => {
                e.stopPropagation();
                this.handleGalleryPurchase(c);
            };
            info.appendChild(buyBtn);

            item.appendChild(info);
            
            // スワイプアクション
            this.setupSwipeAction(item, () => {
                this.handleGalleryPurchase(c);
            });
    
            this.els.galleryGrid.appendChild(item);
          });
        }
      }

      /**
       * ギャラリーからの購入処理
       */
      handleGalleryPurchase(circle) {
        if (!this.dataManager) return;
        
        const space = circle.space;
        this.dataManager.addPurchased(space);
        this.dataManager.syncUpdate(space);
        if (this.uiManager) this.uiManager.showToast(`${space} 購入完了`);
        
        // ギャラリーデータを更新（購入済みを除外）して再描画
        // 現在のリストから削除
        this.currentTargets = this.currentTargets.filter(c => c.space !== space);
        this.renderGallery();
        
        // メイン画面のカウントも更新
        if (this.uiManager) this.uiManager.updateCounts(this.dataManager);
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
          if (this.uiManager) this.uiManager.showToast(`${action.space} の操作を取り消しました`);
          
          // メイン画面のカウント更新
          if (this.uiManager) this.uiManager.updateCounts(this.dataManager);
    
          // ギャラリーの再描画（直前のエリア状態を復元）
          if (this.currentGalleryArea) {
              this.showGallery(this.currentGalleryArea, this.currentGalleryIsHold);
          }
        } else {
          if (this.uiManager) this.uiManager.showToast("履歴がありません");
        }
      }
    
      /**
       * ギャラリーモーダルを非表示
       */
      hideGalleryModal() {
        if (!this.els.galleryModal || !this.els.galleryGrid) return;
        this.els.galleryModal.classList.add("hidden");
        this.els.galleryGrid.innerHTML = "";
      }
    
      /**
       * 画像のピンチズーム・パン機能を設定 (Advanced)
       * アニメ公式サイトのような滑らかな操作感を実現
       */
      setupZoom(container, img) {
        let state = {
          scale: 1,
          pX: 0,
          pY: 0,
          x: 0,
          y: 0
        };

        // 設定値
        const MIN_SCALE = 1;
        const MAX_SCALE = 5;
        const FRICTION = 0.92; // 慣性の減衰率
        const BOUNCE_FRICTION = 0.8; // バウンド時の減衰率

        let isDragging = false;
        let startX = 0, startY = 0;
        let lastX = 0, lastY = 0;
        let vx = 0, vy = 0; // 速度
        let rafId = null;

        // ピンチ用
        let initialDistance = 0;
        let initialScale = 1;
        let pinchCenter = { x: 0, y: 0 };

        container.style.overflow = "hidden";
        container.style.touchAction = "none";
        img.style.transformOrigin = "0 0"; // 左上基準で計算するほうが制御しやすい
        img.style.willChange = "transform";
        
        const updateTransform = () => {
          img.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
        };

        // 外部からのリセット用
        img.resetZoom = () => {
          state = { scale: 1, pX: 0, pY: 0, x: 0, y: 0 };
          vx = 0; vy = 0;
          if (rafId) cancelAnimationFrame(rafId);
          updateTransform();
        };

        // 慣性アニメーションループ
        const animate = () => {
          if (isDragging) return;

          // 減衰
          vx *= FRICTION;
          vy *= FRICTION;

          state.x += vx;
          state.y += vy;

          // 境界チェック (Bouncing)
          const containerRect = container.getBoundingClientRect();
          // 現在の画像サイズ
          const w = containerRect.width * state.scale; // ※厳密にはimg.naturalWidth * scaleだが簡略化してコンテナ基準初期100%とする
          const h = containerRect.height * state.scale; // アスペクト比依存だが、ここではcontainerサイズを基準とする(初期fit)
          
          // 実際の画像サイズを取得して計算したほうが正確
          const imgRect = img.getBoundingClientRect();
          const curW = imgRect.width;
          const curH = imgRect.height;
          const winW = containerRect.width;
          const winH = containerRect.height;

          let bounced = false;

          // X軸の境界
          if (winW >= curW) {
            // 画像が画面より小さいときは中央へ戻る力
            const targetX = (winW - curW) / 2; // 中央配置したいが、ここでは簡易的に0(左上)またはセンタリング
             // 中央寄せロジックを入れると複雑になるため、
             // シンプルに「外枠を超えない」制限をかける
             if (state.x > 0) { state.x += (0 - state.x) * 0.2; vx *= BOUNCE_FRICTION; bounced = true; } 
             // 小さいときは左端基準ではなく中央基準にしたいが...
             // ここでは簡易実装として左端0制限だけにする
          } else {
            // 画像のほうが大きいとき
            if (state.x > 0) { 
                state.x += (0 - state.x) * 0.2; 
                vx *= BOUNCE_FRICTION; 
                bounced = true; 
            } else if (state.x < winW - curW) { 
                state.x += ((winW - curW) - state.x) * 0.2; 
                vx *= BOUNCE_FRICTION; 
                bounced = true; 
            }
          }

          // Y軸の境界
          if (winH >= curH) {
             if (state.y > 0) { state.y += (0 - state.y) * 0.2; vy *= BOUNCE_FRICTION; bounced = true; }
          } else {
            if (state.y > 0) {
                state.y += (0 - state.y) * 0.2; 
                vy *= BOUNCE_FRICTION; 
                bounced = true; 
            } else if (state.y < winH - curH) {
                state.y += ((winH - curH) - state.y) * 0.2; 
                vy *= BOUNCE_FRICTION; 
                bounced = true; 
            }
          }

          if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1 || bounced) {
            updateTransform();
            rafId = requestAnimationFrame(animate);
          }
        };


        const handleTouchStart = (e) => {
          if (rafId) cancelAnimationFrame(rafId);
          isDragging = true;

          if (e.touches.length === 1) {
            // シングルタッチ（パン）
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            lastX = startX;
            lastY = startY;
            vx = 0; vy = 0;
          } else if (e.touches.length === 2) {
            // マルチタッチ（ピンチ）
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            initialDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            initialScale = state.scale;
            
            // ピンチの中心点を計算
            pinchCenter = {
              x: (t1.clientX + t2.clientX) / 2,
              y: (t1.clientY + t2.clientY) / 2
            };
            
            // 現在の座標系における中心点（画像上の位置）を保持しておきたいが、
            // ここでは簡易的に移動量計算に使う
            startX = pinchCenter.x;
            startY = pinchCenter.y;
            lastX = startX;
            lastY = startY;
          }
        };

        const handleTouchMove = (e) => {
          if (e.cancelable) e.preventDefault(); // ブラウザスクロール阻止

          if (e.touches.length === 1) {
             const cx = e.touches[0].clientX;
             const cy = e.touches[0].clientY;
             
             const dx = cx - lastX;
             const dy = cy - lastY;
             
             state.x += dx;
             state.y += dy;
             
             vx = dx; // 速度を記録
             vy = dy;
             
             lastX = cx;
             lastY = cy;
             updateTransform();

          } else if (e.touches.length === 2) {
             const t1 = e.touches[0];
             const t2 = e.touches[1];
             const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
             
             // 中心点の移動（ピンチしながらドラッグも可能に）
             const currentCenter = {
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
             };
             
             const dx = currentCenter.x - lastX;
             const dy = currentCenter.y - lastY;
             state.x += dx;
             state.y += dy;
             lastX = currentCenter.x;
             lastY = currentCenter.y;

             if (initialDistance > 0) {
                 const newScale = initialScale * (currentDist / initialDistance);
                 
                 // 拡大縮小の中心を考慮して位置を補正
                 // scaleが変わると、同じ (0,0) でも見え方が変わるため、
                 // ピンチ中心位置が変わらないように state.x/y を補正する
                 
                 const containerRect = container.getBoundingClientRect();
                 // コンテナ内の相対座標
                 const relX = currentCenter.x - containerRect.left; 
                 const relY = currentCenter.y - containerRect.top;
                 
                 // 画像内での相対位置 (0~1)
                 // 現在の scale での画像左上(state.x, state.y) からのオフセット
                 const imgX = relX - state.x;
                 const imgY = relY - state.y;
                 
                 const scaleRatio = newScale / state.scale;
                 
                 // 拡大すると、カーソル位置(imgX)は scaleRatio倍 遠くになるので、
                 // その分だけ画像全体を左上にずらす（または右下にずらす）
                 state.x -= imgX * (scaleRatio - 1);
                 state.y -= imgY * (scaleRatio - 1);
                 
                 state.scale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
             }
             
             updateTransform();
          }
        };

        const handleTouchEnd = (e) => {
          if (e.touches.length === 0) {
             isDragging = false;
             // 慣性開始
             rafId = requestAnimationFrame(animate);
             
             // 縮小しすぎた場合のリセットアニメーションを含めるならここでscaleチェック
             if (state.scale < MIN_SCALE) {
                 // 簡易的に戻す（本来はアニメーションすべき）
                 // アニメーションループ内で処理しているので自然に戻るはず
                 state.scale = MIN_SCALE; // 即時戻しではなく、animate内で戻すロジックが必要だが、今回はanimateの境界チェックに任せるにはscale制御が足りないので、ここで補正
                 // 補正: スケールが1未満なら1に戻すアニメーションを入れたいところだが、
                 // 複雑になるためここではscaleのみ即時リセットし、位置はanimateに任せる
                 // state.scale = 1; 
                 // updateTransform();
             }
          } else if (e.touches.length === 1) {
             // 2本指から1本指になった瞬間、座標が飛ぶのを防ぐ
             lastX = e.touches[0].clientX;
             lastY = e.touches[0].clientY;
          }
        };

        container.addEventListener("touchstart", handleTouchStart, { passive: false });
        container.addEventListener("touchmove", handleTouchMove, { passive: false });
        container.addEventListener("touchend", handleTouchEnd);
        
        // PC (Mouse) support - basic
        // (省略: モバイルファーストのためタッチイベントのみ詳細実装)
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
          const deltaY = startY - clientY; 
          const newHeight = startHeight + deltaY;
          container.style.height = `${newHeight}px`;
        };

        const onEnd = () => {
          if (isResizing) {
            isResizing = false;
            container.classList.remove('resizing');
          }
        };

        header.addEventListener('touchstart', (e) => {
          e.preventDefault();
          if (e.touches.length === 1) {
            onStart(e.touches[0].clientY);
          }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
          if (isResizing && e.touches.length === 1) {
            onMove(e.touches[0].clientY);
          }
        }, { passive: false });

        document.addEventListener('touchend', onEnd);

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

          if (!isSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
            return; 
          }

          if (!isSwiping && Math.abs(deltaX) > 10) {
            isSwiping = true;
          }

          if (isSwiping) {
            if (e.cancelable) e.preventDefault();
            currentX = deltaX;
            element.style.transform = `translateX(${deltaX}px)`;
            
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
              const direction = currentX > 0 ? 1 : -1;
              element.style.transform = `translateX(${direction * 100}%)`;
              setTimeout(() => {
                 callback(); 
                 setTimeout(() => {
                     if (element.parentNode) element.style.transform = ''; 
                 }, 500);
              }, 50);
            } else {
              element.style.transform = '';
            }
          }
          isSwiping = false;
        });
      }
}