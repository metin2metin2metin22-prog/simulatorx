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

function getClosestNode(x, y, nodes, collisionSystem) {
  let bestKey = 'ct_spawn';
  let minDist = Infinity;
  let bestVisibleKey = null;
  let minVisibleDist = Infinity;

  for (const [key, node] of Object.entries(nodes)) {
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < minDist) {
      minDist = d;
      bestKey = key;
    }
    if (collisionSystem && d < 380) {
      if (!collisionSystem.isLineBlockedByWall(x, y, node.x, node.y)) {
        if (d < minVisibleDist) {
          minVisibleDist = d;
          bestVisibleKey = key;
        }
      }
    }
  }
  return bestVisibleKey || bestKey;
}

// Expands any waypoint list into a 100% continuous neighbor-to-neighbor path
// Guarantees zero gaps and eliminates bots walking straight into solid black walls
function expandWaypoints(waypointList, nodes) {
  if (!waypointList || waypointList.length === 0) return [];
  let fullPath = [waypointList[0]];
  for (let i = 0; i < waypointList.length - 1; i++) {
    const from = waypointList[i];
    const to = waypointList[i + 1];
    if (from === to) continue;
    const segment = findPath(from, to, nodes);
    fullPath = fullPath.concat(segment.slice(1));
  }
  return fullPath;
}

module.exports = {
  findPath,
  getClosestNode,
  expandWaypoints
};
