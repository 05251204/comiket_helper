import cv2
import pytesseract

# Tesseractのパス設定（Macでbrew installした場合の一般的なパス）
# コマンドで `which tesseract` を打って出てくるパスを指定してください
pytesseract.pytesseract.tesseract_cmd = r'/usr/local/bin/tesseract' 
# Apple Silicon(M1/M2)の場合はこちらの場合が多いです:
# pytesseract.pytesseract.tesseract_cmd = r'/opt/homebrew/bin/tesseract'

def ocr_map_tesseract(image_path):
    # 1. 画像の読み込み
    img = cv2.imread(image_path)
    
    # 2. 前処理 (グレースケール化 -> 二値化)
    # 地図のような細かい画像は、コントラストを上げると認識率が上がります
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 閾値を調整して文字をくっきりさせる (Otsuの二値化)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # デバッグ用に前処理後の画像を保存して確認しても良いです
    # cv2.imwrite('processed_debug.jpg', binary)

    # 3. OCR実行
    # lang='jpn' で日本語を指定
    # --psm 6 は「単一の均一なテキストブロック」として扱う設定（表形式に比較的強い）
    config = '--psm 6'
    text = pytesseract.image_to_string(binary, lang='jpn', config=config)
    
    return text

# 実行
file_path = 'tst.jpg' # ファイル名を適切に変更してください
result = ocr_map_tesseract(file_path)
print("--- Tesseract Result ---")
print(result)