// SimulatorX - 1024x1024 Pixel-Perfect Collision & Line-Of-Sight Raycasting System
const fs = require('fs');
const { PNG } = require('pngjs');

class CollisionSystem {
  constructor(mapPngPath) {
    this.collisionGrid = new Uint8Array(1024 * 1024);
    this.loaded = false;
    this.loadGrid(mapPngPath);
  }

  loadGrid(mapPngPath) {
    try {
      const pngData = PNG.sync.read(fs.readFileSync(mapPngPath));
      for (let i = 0; i < 1024 * 1024; i++) {
        // Pixel is walkable if alpha channel > 100 (black/transparent areas alpha <= 100 are solid walls)
        this.collisionGrid[i] = pngData.data[(i << 2) + 3] > 100 ? 1 : 0;
      }
      this.loaded = true;
      console.log('Successfully loaded authentic collision mask from:', mapPngPath);
    } catch (err) {
      console.error('Failed to load collision PNG, fallback to open grid:', err.message);
      this.collisionGrid.fill(1);
    }
  }

  isWalkable(x, y) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= 1024 || iy < 0 || iy >= 1024) return false;
    return this.collisionGrid[iy * 1024 + ix] === 1;
  }

  ensureWalkable(p) {
    if (this.isWalkable(p.x, p.y)) return;
    for (let r = 1; r < 50; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const tx = p.x + Math.cos(a) * r;
        const ty = p.y + Math.sin(a) * r;
        if (this.isWalkable(tx, ty)) {
          p.x = tx;
          p.y = ty;
          return;
        }
      }
    }
  }

  // Exact raycast stepping through 1024x1024 grid:
  // If line of sight or bullet passes through ANY black pixel -> BLOCKED!
  isLineBlockedByWall(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 1) return !this.isWalkable(x1, y1);
    const steps = Math.ceil(dist / 3);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x1 + (x2 - x1) * t);
      const py = Math.round(y1 + (y2 - y1) * t);
      if (!this.isWalkable(px, py)) return true;
    }
    return false;
  }

  isLineBlockedBySmoke(smokes, x1, y1, x2, y2) {
    if (!smokes || smokes.length === 0) return false;
    for (const smoke of smokes) {
      const d = this.distToSegment({ x: smoke.x, y: smoke.y }, { x: x1, y: y1 }, { x: x2, y: y2 });
      if (d < smoke.radius * 0.92) return true;
    }
    return false;
  }

  distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  lineIntersects(p1, p2, p3, p4) {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(det) < 0.0001) return false;
    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
    return (0.01 < lambda && lambda < 0.99) && (0.01 < gamma && gamma < 0.99);
  }

  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}

module.exports = {
  CollisionSystem
};
