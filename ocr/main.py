import cv2
import numpy as np

def paint_using_template_matching(map_image_path, template_image_path, output_path):
    # 1. 画像の読み込み
    img_rgb = cv2.imread(map_image_path)
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)
    
    template = cv2.imread(template_image_path, 0) # テンプレートもグレースケールで読み込み
    if template is None:
        print("エラー: テンプレート画像が見つかりません。")
        return

    # テンプレートのサイズを取得 (高さ, 幅)
    h, w = template.shape

    print(f"テンプレートマッチングを開始します... ({template_image_path})")

    # 2. テンプレートマッチング実行
    # TM_CCOEFF_NORMED は明るさの変動に強く、0.0〜1.0のスコアが出ます
    res = cv2.matchTemplate(img_gray, template, cv2.TM_CCOEFF_NORMED)

    # 3. 閾値（しきい値）の設定
    # 「どれくらい似ていれば正解とするか」
    # 同じ画像をコピーしているなら 0.8 〜 0.9 などの高い値でOKです
    threshold = 0.75
    
    # 閾値以上の場所（座標）をすべて取得
    loc = np.where(res >= threshold)
    
    # 検出数をカウント
    count = 0
    
    # zip(*loc[::-1]) は (x, y) 座標のリストを作ります
    # 重複検出を避けるためのマスク（一度塗った場所は塗らない）
    mask = np.zeros(img_gray.shape, dtype=np.uint8)

    for pt in zip(*loc[::-1]):
        # 既に検出済みの場所（近傍）ならスキップする処理
        # (ピクセル単位でズレて重複検出することがあるため)
        if mask[pt[1] + h//2, pt[0] + w//2] == 0:
            
            # 赤く塗りつぶす (BGRで指定: 青0, 緑0, 赤255)
            # 四角形で塗りつぶし
            cv2.rectangle(img_rgb, pt, (pt[0] + w, pt[1] + h), (0, 0, 255), -1)
            
            # マスクにも書き込んで重複防止
            # 少し広めにマスクして、同じ文字の微細なズレを除外
            cv2.rectangle(mask, pt, (pt[0] + w, pt[1] + h), 255, -1)
            
            count += 1

    print(f"完了: {count} 箇所見つかりました。")
    
    # 4. 保存
    cv2.imwrite(output_path, img_rgb)
    print(f"保存先: {output_path}")

# --- 実行設定 ---
map_file = 'tst.jpg'       # 全体地図
template_file = 'tst_11.jpg'   # ★ここ重要: 自分で切り抜いた「11」の画像
output_file = 'result_template_match.jpg'

paint_using_template_matching(map_file, template_file, output_file)