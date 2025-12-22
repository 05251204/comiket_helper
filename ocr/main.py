try:
    from PIL import Image
except ImportError:
    import Image
import pytesseract

# 日本語の画像ファイル
FILENAME = './tst.jpg'

# デフォルト言語の英語で実行されるため意味なし
print(pytesseract.image_to_string(Image.open(FILENAME)))

