import cv2
import numpy as np

def detect_space_boxes(image_path, output_path):
    # 1. 画像の読み込み
    img = cv2.imread(image_path)
    if img is None:
        print("エラー: 画像が見つかりませんでした。")
        return
    
    output_img = img.copy() # 結果描画用の画像

    # 2. 前処理 (グレースケール化 -> 二値化)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 適応的閾値処理（Adaptive Thresholding）
    # 照明ムラがあっても線を綺麗に抽出しやすい方法です。
    # パラメータ(11, 2)は画像の線の太さやコントラストによって調整が必要な場合があります。
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 11, 2)

    # ノイズ除去（省略可ですが、あると精度が上がることがあります）
    # kernel = np.ones((2,2), np.uint8)
    # binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # 3. 輪郭の検出
    # RETR_LIST: すべての輪郭を取得
    # CHAIN_APPROX_SIMPLE: 輪郭の情報を圧縮して保持
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    print(f"検出された全輪郭数: {len(contours)}")

    candidates = []

    # 4. 候補の選定（一次フィルタリング）
    for cnt in contours:
        # 輪郭を直線で近似する
        # epsilonの値が大きいほど大雑把な近似になります。
        # 0.03だと強すぎて四角形として認識されない場合があるため、0.02に緩和します。
        epsilon = 0.02 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        # 条件A: 頂点数が4つ（四角形であること）
        if len(approx) == 4:
            # 外接矩形の情報を取得 (x, y, 幅, 高さ)
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / h # アスペクト比（横長度合い）
            area = cv2.contourArea(cnt) # 面積

            # --- フィルタリング条件の調整ポイント ---
            # 実際の画像の解像度に合わせて、ここの数値を調整する必要があります。
            
            # 条件B: 面積（サイズ）のフィルタリング
            # 極端に小さいゴミ(300以下)を除外します。
            # 上限は後で統計的に処理するためここでは緩くしておきます。
            if area > 300:
                
                # 条件C: アスペクト比（形状）のフィルタリング
                # 長方形（縦長・横長問わず）を対象とします。
                if 0.15 < aspect_ratio < 6.0:
                    
                    # 条件D: 矩形らしさ（Solidity）のチェック
                    # 輪郭の面積と外接矩形の面積の比率を確認し、中身が詰まった矩形か判定します。
                    rect_area = w * h
                    solidity = float(area) / rect_area
                    
                    # さらに条件を緩和: 0.5 -> 0.3
                    if solidity > 0.3:
                        
                        # 条件E: 幅と高さの絶対値でのフィルタリング
                        if w > 20 and h > 20:
                            candidates.append({
                                'approx': approx,
                                'area': area
                            })

    # 5. 動的な面積フィルタリング（外れ値の除外）
    detected_boxes = []
    if candidates:
        areas = [c['area'] for c in candidates]
        median_area = np.median(areas)
        print(f"面積の中央値: {median_area}")

        for c in candidates:
            area = c['area']
            # 「若干でも大きいもの」を除外するため、中央値の1.5倍を上限に設定
            if area < median_area * 1.5: 
                detected_boxes.append(c['approx'])
            else:
                pass # 少しでも大きい枠を除外

    print(f"条件を通過したボックス数: {len(detected_boxes)}")

    # 6. 結果の描画
    # 見つかった輪郭を緑色(0, 255, 0)、太さ2で描画
    cv2.drawContours(output_img, detected_boxes, -1, (0, 255, 0), 2)
    
    # 保存
    cv2.imwrite(output_path, output_img)
    print(f"結果を保存しました: {output_path}")

# --- 実行設定 ---
input_file = 'tst.jpg'      # 入力画像
output_file = 'result_detected_boxes.jpg' # 出力画像

detect_space_boxes(input_file, output_file)