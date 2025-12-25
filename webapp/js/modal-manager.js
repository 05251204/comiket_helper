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

      galleryModal: document.getElementById("gallery-modal"),
      galleryGrid: document.getElementById("gallery-grid"),
      btnCloseGallery: document.getElementById("btn-close-gallery"),
    };

    this.init();
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

    if (this.els.modalImageContainer && this.els.pdfImage) {
      this.setupZoom(this.els.modalImageContainer, this.els.pdfImage);
    }
  }

  /**
   * PDF(画像)モーダルを表示
   * @param {string} url - 画像URL
   */
  showPdfModal(url) {
    if (!this.els.pdfModal || !this.els.pdfImage) return;
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
  }

  /**
   * ギャラリーモーダルを表示
   * @param {Array} targets - 表示対象のサークルリスト
   */
  showGallery(targets) {
    if (!this.els.galleryModal || !this.els.galleryGrid) return;

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
        
        const img = document.createElement("img");
        img.src = c.tweet;
        img.loading = "lazy";
        
        const name = document.createElement("div");
        name.className = "circle-name";
        name.textContent = c.space;

        item.appendChild(img);
        item.appendChild(name);

        item.onclick = () => {
          this.showPdfModal(c.tweet);
        };

        this.els.galleryGrid.appendChild(item);
      });
    }

    this.els.galleryModal.classList.remove("hidden");
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
