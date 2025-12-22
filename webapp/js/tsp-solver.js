import { Config } from "./config.js";

/**
 * 経路計算ロジッククラス
 */
export class TspSolver {
  /**
   * 全角数字等を半角に変換
   */
  static toHalfWidth(str) {
    if (!str) return "";
    return str.replace(/[！-～]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    );
  }

  /**
   * スペース文字列を解析
   * @returns {[string, string, number]} [ホール群, 識別子, 番号]
   */
  static parseSpace(space) {
    if (!space) return ["", "", 0];
    const ewsnChar = space[0];
    const labelChar = space[1];
    const numberPart = this.toHalfWidth(space.substring(2));

    let hallGroup = "";
    // Configの定義を使ってホール判定
    for (const [key, chars] of Object.entries(Config.LABEL_OPTIONS)) {
      if (key.startsWith(ewsnChar) && chars.includes(labelChar)) {
        hallGroup = key;
        break;
      }
    }

    let numStr = "";
    for (let i = 0; i < numberPart.length; i++) {
      if (numberPart[i] >= "0" && numberPart[i] <= "9") numStr += numberPart[i];
      else break;
    }
    return [hallGroup, labelChar, parseInt(numStr) || 0];
  }

  /**
   * 2点間のコスト（距離）を計算
   */
  static calcDist(spaceA, spaceB) {
    const [h1, l1, n1] = this.parseSpace(spaceA);
    const [h2, l2, n2] = this.parseSpace(spaceB);

    // 異なるホール間の移動コストは非常に大きくする（同じホールを優先して回るため）
    if (h1 !== h2) return 10000;

    // コミケの島配置ロジック（簡易版：32で折り返し）
    const num1 = n1 > 32 ? 64 - n1 : n1;
    const num2 = n2 > 32 ? 64 - n2 : n2;

    const labelDist = Math.abs(l1.charCodeAt(0) - l2.charCodeAt(0));
    const numDist = Math.abs(num1 - num2);

    // 縦移動(label)のコストを重めに見積もる
    return labelDist * 10 + numDist;
  }

  /**
   * TSPを解く（Nearest Neighbor法）
   * @param {string} startSpace 開始地点のスペース名
   * @param {Array} candidates 候補リスト
   */
  static solve(startSpace, candidates) {
    if (candidates.length === 0) return [];

    const nodes = [{ space: startSpace, isStart: true }, ...candidates];

    // 簡易的なNearest Neighbor法（モバイルでの速度優先）
    const path = [nodes[0]];
    const visited = new Set([0]);

    let currentIdx = 0;

    while (path.length < nodes.length) {
      let minDist = Infinity;
      let nextIdx = -1;

      for (let i = 1; i < nodes.length; i++) {
        if (visited.has(i)) continue;

        const d = this.calcDist(nodes[currentIdx].space, nodes[i].space);
        if (d < minDist) {
          minDist = d;
          nextIdx = i;
        }
      }

      if (nextIdx !== -1) {
        path.push(nodes[nextIdx]);
        visited.add(nextIdx);
        currentIdx = nextIdx;
      } else {
        break;
      }
    }

    return path; // [StartNode, FirstTarget, SecondTarget...]
  }
}
