// tsp.js
import { distinct_space, calc_dist } from "./utils.js";

function runTspAlgorithm(nodes, startNode) {
  if (nodes.length === 0) return [];

  const workingNodes = [startNode, ...nodes].map((node, i) => ({
    ...node,
    __id: i,
  }));
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
      distMatrix[i][j] = calc_dist(
        ewsn1[0],
        label1,
        num1,
        ewsn2[0],
        label2,
        num2
      );
    }
  }

  let currentPath = [];
  let remaining = [...workingNodes];
  let currentNode = remaining.shift();
  currentPath.push(currentNode);

  while (remaining.length > 0) {
    let nearest = null,
      minDst = Infinity;
    for (const node of remaining) {
      const d = distMatrix[currentNode.__id][node.__id];
      if (d < minDst) {
        minDst = d;
        nearest = node;
      }
    }
    currentNode = nearest;
    currentPath.push(currentNode);
    remaining = remaining.filter((n) => n.__id !== currentNode.__id);
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < currentPath.length - 2; i++) {
      for (let j = i + 1; j < currentPath.length - 1; j++) {
        const d1 =
          distMatrix[currentPath[i - 1].__id][currentPath[i].__id] +
          distMatrix[currentPath[j].__id][currentPath[j + 1].__id];
        const d2 =
          distMatrix[currentPath[i - 1].__id][currentPath[j].__id] +
          distMatrix[currentPath[i].__id][currentPath[j + 1].__id];
        if (d2 < d1) {
          const reversed = currentPath.slice(i, j + 1).reverse();
          currentPath = currentPath
            .slice(0, i)
            .concat(reversed)
            .concat(currentPath.slice(j + 1));
          improved = true;
        }
      }
    }
  }

  return currentPath.slice(1).map((n) => {
    const { __id, ...rest } = n;
    return rest;
  });
}

export function solveTsp(nodes) {
  if (nodes.length < 2) return nodes;

  const startNode = nodes.find((n) => n.isStart);
  const targetNodes = nodes.filter((n) => !n.isStart);
  const isHighPriority = (p) => {
    if (!p) return false;
    const strP = String(p).toUpperCase();
    return ["S", "A", "5", "4", "HIGH", "高"].includes(strP);
  };

  const highGroup = targetNodes.filter((n) => isHighPriority(n.priority));
  const normalGroup = targetNodes.filter((n) => !isHighPriority(n.priority));

  if (highGroup.length === 0 || normalGroup.length === 0) {
    return [startNode, ...runTspAlgorithm(targetNodes, startNode)];
  }

  const highPath = runTspAlgorithm(highGroup, startNode);
  const lastHighNode = highPath[highPath.length - 1] || startNode;
  const normalPath = runTspAlgorithm(normalGroup, lastHighNode);

  return [startNode, ...highPath, ...normalPath];
}
