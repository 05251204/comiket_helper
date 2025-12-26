import cv2
import numpy as np

def is_slanted(approx, threshold=10):
    """
    矩形が斜めかどうかを判定する関数
    :param approx: 頂点座標 (4点)
    :param threshold: 許容する傾き (度)
    :return: True if slanted, False otherwise
    """
    rect = cv2.minAreaRect(approx)
    angle = rect[-1]
    
    # 角度を正規化 (0-90度)
    angle = abs(angle) % 90
    
    if angle > 45:
        deviation = 90 - angle
    else:
        deviation = angle
        
    return deviation > threshold

def detect_space_boxes(image_path, output_path):
    # 1. 画像の読み込み
    img = cv2.imread(image_path)
    if img is None:
        print("エラー: 画像が見つかりませんでした。")
        return
    
    height, width = img.shape[:2]
    output_img = img.copy() # 結果描画用の画像

    # 2. 前処理 (グレースケール化 -> 二値化)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 適応的閾値処理
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 11, 2)

    # 3. 輪郭の検出
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    print(f"検出された全輪郭数: {len(contours)}")

    candidates = []

    # 4. 候補の選定（一次フィルタリング）
    for cnt in contours:
        epsilon = 0.02 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        # 条件A: 頂点数が4つ（四角形であること）
        if len(approx) == 4:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / h 
            area = cv2.contourArea(cnt)
            
            # ボックスの中心Y座標を計算
            center_y = y + h / 2

            # 条件B: 面積（サイズ）のフィルタリング
            if area > 300:
                # 条件C: アスペクト比
                if 0.15 < aspect_ratio < 6.0:
                    rect_area = w * h
                    solidity = float(area) / rect_area
                    
                    # 条件D: Solidity
                    if solidity > 0.3:
                        # 条件E: 絶対サイズ
                        if w > 20 and h > 20:
                            
                            # 条件F: 斜め判定
                            if is_slanted(approx, threshold=10):
                                continue # 斜めの場合はスキップ

                            # ここではまだ下部の除外は行わない（分布を見るため）

                            candidates.append({
                                'approx': approx,
                                'area': area,
                                'center_y': center_y
                            })

    # 5. 位置によるフィルタリング (下位1%の除外)
    # 検出されたボックスの中で、Y座標が極端に大きい（下にある）ものを除外
    valid_candidates = []
    if candidates:
        y_coords = [c['center_y'] for c in candidates]
        # Y座標の99パーセンタイル（下位1%の境界線）を計算
        # これより下（数値が大きい）にあるボックスは除外
        bottom_limit = np.percentile(y_coords, 99)
        
        print(f"Y座標のカットライン (下位1%): {bottom_limit:.1f}")
        
        for c in candidates:
            if c['center_y'] <= bottom_limit:
                valid_candidates.append(c)
            else:
                pass # 最下部のゴミを除外

    # 6. 動的な面積フィルタリング（外れ値の除外）
    detected_boxes = []
    if valid_candidates:
        areas = [c['area'] for c in valid_candidates]
        median_area = np.median(areas)
        print(f"面積の中央値: {median_area}")

        for c in valid_candidates:
            area = c['area']
            if area < median_area * 1.5: 
                detected_boxes.append(c['approx'])

    print(f"条件を通過したボックス数: {len(detected_boxes)}")

    # 7. 結果の描画
    cv2.drawContours(output_img, detected_boxes, -1, (0, 255, 0), 2)
    
    # 保存
    cv2.imwrite(output_path, output_img)
    print(f"結果を保存しました: {output_path}")

# --- 実行設定 ---
input_file = 'tst.jpg'      # 入力画像
output_file = 'result_detected_boxes.jpg' # 出力画像

detect_space_boxes(input_file, output_file)