import { distinct_space, calc_dist } from "./utils.js";

export function solveTsp(nodes) {
  if (nodes.length < 2) return nodes;

  // ID付与などの前処理は呼び出し元で行うか、ここで行ってコピーを返す
  // ここでは単純化のため、nodesは破壊的に変更せずコピーを使う想定
  const workingNodes = nodes.map((node, i) => ({ ...node, __id: i }));

  // 距離行列の計算
  const distMatrix = [];
  for (let i = 0; i < workingNodes.length; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < workingNodes.length; j++) {
      if (i === j) {
        distMatrix[i][j] = 0;
        continue;
      }
      const [ewsn1, label1, num1] = distinct_space(workingNodes[i].space);
      const [ewsn2, label2, num2] = distinct_space(workingNodes[j].space);

      // 数値変換のエラーハンドリングを含める
      const n1 = parseFloat(num1) || 0;
      const n2 = parseFloat(num2) || 0;

      distMatrix[i][j] = calc_dist(ewsn1[0], label1, n1, ewsn2[0], label2, n2);
    }
  }

  // ステップ1: 最近傍探索法
  let currentPath = [];
  let remainingNodes = [...workingNodes];

  // スタート地点を探す
  let currentNode =
    remainingNodes.find((n) => n.isStart) || remainingNodes.shift();
  currentPath.push(currentNode);
  remainingNodes = remainingNodes.filter((n) => n.__id !== currentNode.__id);

  while (remainingNodes.length > 0) {
    let nearestNode = null,
      minDistance = Infinity;
    for (const node of remainingNodes) {
      const distance = distMatrix[currentNode.__id][node.__id];
      if (distance < minDistance) {
        minDistance = distance;
        nearestNode = node;
      }
    }
    currentNode = nearestNode;
    currentPath.push(currentNode);
    remainingNodes = remainingNodes.filter((n) => n.__id !== currentNode.__id);
  }

  // ステップ2: 2-opt法 (有効化済み)
  let improved = true;
  while (improved) {
    improved = false;
    // スタート地点(0)は固定
    for (let i = 1; i < currentPath.length - 2; i++) {
      for (let j = i + 1; j < currentPath.length - 1; j++) {
        const d1 =
          distMatrix[currentPath[i - 1].__id][currentPath[i].__id] +
          distMatrix[currentPath[j].__id][currentPath[j + 1].__id];
        const d2 =
          distMatrix[currentPath[i - 1].__id][currentPath[j].__id] +
          distMatrix[currentPath[i].__id][currentPath[j + 1].__id];
        if (d2 < d1) {
          const pathSegment = currentPath.slice(i, j + 1).reverse();
          currentPath = currentPath
            .slice(0, i)
            .concat(pathSegment)
            .concat(currentPath.slice(j + 1));
          improved = true;
        }
      }
    }
  }

  // 計算用IDを削除して返す
  return currentPath.map((node) => {
    const { __id, ...rest } = node;
    return rest;
  });
}
