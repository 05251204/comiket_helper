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
    
        container.style.overflow = "hidden";
        container.style.touchAction = "none";
        img.style.transformOrigin = "center center";
        img.style.transition = "transform 0.1s ease-out";
    
        // 外部からリセットできるようにメソッドを追加
        img.resetZoom = () => {
          scale = 1;
          pointX = 0;
          pointY = 0;
          img.style.transform = `translate(0px, 0px) scale(1)`;
        };
    
        const preventDefault = (e) => {
          if (e.cancelable) e.preventDefault();
        };
    
        container.addEventListener("gesturestart", preventDefault);
        container.addEventListener("gesturechange", preventDefault);
    
        container.addEventListener("touchstart", (e) => {
          if (e.touches.length === 1) {
            startX = e.touches[0].clientX - pointX;
            startY = e.touches[0].clientY - pointY;
            img.style.transition = "none";
          } else if (e.touches.length === 2) {
            initialDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            initialScale = scale;
            img.style.transition = "none";
          }
        }, { passive: false });
    
        container.addEventListener("touchmove", (e) => {
          if (e.cancelable) e.preventDefault();
    
          if (e.touches.length === 1) {
            pointX = e.touches[0].clientX - startX;
            pointY = e.touches[0].clientY - startY;
          } else if (e.touches.length === 2) {
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            const zoomFactor = dist / initialDist;
            scale = initialScale * zoomFactor;
            scale = Math.max(0.8, Math.min(scale, 8));
          }
    
          img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        }, { passive: false });
    
        container.addEventListener("touchend", (e) => {
            if (e.touches.length === 0) {
                img.style.transition = "transform 0.2s ease-out";
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