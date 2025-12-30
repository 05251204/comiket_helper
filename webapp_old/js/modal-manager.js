import { TspSolver } from "./tsp-solver.js";

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
      btnSetTarget: document.getElementById("btn-set-target"), // 新しいボタン

      galleryModal: document.getElementById("gallery-modal"),
      galleryGrid: document.getElementById("gallery-grid"),
      btnCloseGallery: document.getElementById("btn-close-gallery"),

      // Sort buttons
      btnSortSpace: document.getElementById("btn-sort-space"),
      btnSortPriority: document.getElementById("btn-sort-priority"),
    };

    this.onSetNextTarget = null;
    this.currentCircle = null;
    
    // Gallery state
    this.currentTargets = [];
    this.sortMode = 'space'; // 'space' | 'priority'

    this.init();
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
  init() {
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

    if (this.els.modalImageContainer && this.els.pdfImage) {
      this.setupZoom(this.els.modalImageContainer, this.els.pdfImage);
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
      this.els.btnSortSpace.classList.add('active');
      this.els.btnSortPriority.classList.remove('active');
    } else {
      this.els.btnSortSpace.classList.remove('active');
      this.els.btnSortPriority.classList.add('active');
    }

    this.renderGallery();
  }

  /**
   * ターゲットリストを現在のモードでソート
   */
  sortTargets(targets) {
    const sorted = [...targets];
    
    // Helper to get priority value (High > Normal > Low > others)
    const getPriorityVal = (p) => {
      const val = (p || "").toLowerCase();
      if (val === "high") return 3;
      if (val === "normal") return 2;
      if (val === "low") return 1;
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

      if (h1 !== h2) return h1.localeCompare(h2); // Should be same area usually, but just in case
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
   * @param {Array} targets - 表示対象のサークルリスト
   */
  showGallery(targets) {
    if (!this.els.galleryModal || !this.els.galleryGrid) return;
    
    this.currentTargets = targets || [];
    // Reset sort mode to default or keep previous? Keeping previous is usually better UX.
    // Ensure UI matches state (e.g. if page reloaded)
    if (this.sortMode === 'space') {
       this.els.btnSortSpace.classList.add('active');
       this.els.btnSortPriority.classList.remove('active');
    } else {
       this.els.btnSortSpace.classList.remove('active');
       this.els.btnSortPriority.classList.add('active');
    }

    this.renderGallery();
    this.els.galleryModal.classList.remove("hidden");
  }

  /**
   * ギャラリーの中身を描画
   */
  renderGallery() {
    this.els.galleryGrid.innerHTML = "";
    const targets = this.sortTargets(this.currentTargets);

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
              // オブジェクトごと渡す
              this.showPdfModal(c);
            };
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "no-image-placeholder";
            placeholder.innerHTML = '<i class="fa-regular fa-image"></i><span>No Image</span>';
            item.appendChild(placeholder);
        }
        
        const name = document.createElement("div");
        name.className = "circle-name";
        name.textContent = c.space;

        item.appendChild(name);

        this.els.galleryGrid.appendChild(item);
      });
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
   * @param {HTMLElement} container 
   * @param {HTMLImageElement} img 
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
}
