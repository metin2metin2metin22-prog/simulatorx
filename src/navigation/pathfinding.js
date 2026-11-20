// SimulatorX - Breadth-First-Search (BFS) Graph Navigation Engine
function findPath(startKey, targetKey, nodes) {
  if (!nodes[startKey] || !nodes[targetKey]) return [targetKey];
  if (startKey === targetKey) return [targetKey];

  const queue = [[startKey]];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const curr = currentPath[currentPath.length - 1];

    const neighbors = (nodes[curr] && nodes[curr].neighbors) || [];
    for (const neighbor of neighbors) {
      if (neighbor === targetKey) {
        return currentPath.concat([neighbor]);
      }
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(currentPath.concat([neighbor]));
      }
    }
  }
  return [targetKey];
}

function getClosestNode(x, y, nodes) {
  let bestKey = 'ct_spawn';
  let minDist = Infinity;
  for (const [key, node] of Object.entries(nodes)) {
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < minDist) {
      minDist = d;
      bestKey = key;
    }
  }
  return bestKey;
}

module.exports = {
  findPath,
  getClosestNode
};
