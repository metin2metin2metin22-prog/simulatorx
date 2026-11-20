// SimulatorX - Bot Movement, Path Following, Aiming & Physics System
// Manages smooth waypoint navigation, corner peeking, defensive hold angles, and anti-clustering separation.

const { findPath, getClosestNode } = require('../navigation/pathfinding');

// Authentic pre-aim directions for standard CS:GO defensive positions
const PRE_AIM_DIRECTIONS = {
  // B Site & Tunnels
  'b_site': { x: 150, y: 300 }, // Aim towards B Tunnels Exit
  'b_back_site': { x: 278, y: 200 }, // Aim towards B Doors
  'b_platform': { x: 150, y: 300 }, // Aim towards B Tunnels Exit
  'b_car': { x: 150, y: 300 }, // Aim towards B Tunnels Exit
  'b_doors': { x: 380, y: 240 }, // Aim towards CT Ramp
  'b_window': { x: 340, y: 240 }, // Aim towards CT Ramp
  'b_doors_outside': { x: 278, y: 200 }, // Aim towards B Doors
  // A Site & Long & Short
  'goose': { x: 800, y: 220 }, // Aim towards A Short / Ramp
  'a_site': { x: 740, y: 240 }, // Aim towards A Short
  'a_ramp': { x: 860, y: 320 }, // Aim down Long A
  'long_pit': { x: 850, y: 450 }, // Aim towards Long Corner
  'a_short_site': { x: 720, y: 240 }, // Aim towards Catwalk / Short
  'ct_elevator': { x: 830, y: 240 }, // Aim towards Long Cross
  'ct_mid': { x: 490, y: 390 }, // Aim towards Mid Doors
  'top_mid': { x: 490, y: 390 } // Aim towards Mid Doors
};

class MovementSystem {
  constructor(collisionSystem, mapData) {
    this.collision = collisionSystem;
    this.mapData = mapData;
  }

  /**
   * Smoothly rotates player crosshair toward targetAngle with realistic flick speeds
   */
  updatePlayerAim(p, dt) {
    if (p.targetAngle === undefined) p.targetAngle = p.angle;
    const diff = this.collision.normalizeAngle(p.targetAngle - p.angle);
    const flickSpeed = 16.0;
    const maxStep = flickSpeed * dt;

    if (Math.abs(diff) < maxStep) {
      p.angle = p.targetAngle;
    } else {
      p.angle += Math.sign(diff) * maxStep;
      p.angle = this.collision.normalizeAngle(p.angle);
    }
  }

  /**
   * Sets defensive pre-aim orientation when holding a bomb site or angle
   */
  setDefensiveHoldAngle(p, nodeKey) {
    const targetAim = PRE_AIM_DIRECTIONS[nodeKey];
    if (targetAim) {
      p.targetAngle = Math.atan2(targetAim.y - p.y, targetAim.x - p.x);
      p.baseHoldAngle = p.targetAngle;
    }
  }

  /**
   * Prevents teammates from stacking directly on top of each other in tight choke points
   */
  applyTeammateSeparation(match, p, dt) {
    p.queueSlowdown = 1.0;
    const teammates = Object.values(match.players).filter(other => other.team === p.team && other.id !== p.id && other.alive);
    for (const other of teammates) {
      const dx = p.x - other.x;
      const dy = p.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 28) {
        // If moving in corridor along path: check if teammate is ahead towards target waypoint
        if (p.path && p.pathIndex < p.path.length && other.path) {
          const targetKey = p.path[p.pathIndex];
          const node = this.mapData.nodes[targetKey];
          if (node) {
            const myDistToNode = Math.hypot(node.x - p.x, node.y - p.y);
            const otherDistToNode = Math.hypot(node.x - other.x, node.y - other.y);
            // If teammate is ahead closer to node, trailing bot yields speed and queues cleanly behind
            if (otherDistToNode < myDistToNode) {
              p.queueSlowdown = Math.min(p.queueSlowdown, 0.65);
            }
          }
        }

        // Gentle separation push ONLY if not pushing through or into walls
        const pushForce = Math.min(16, (28 - d) * 10 * dt);
        const angle = Math.atan2(dy, dx);
        const nx = p.x + Math.cos(angle) * pushForce;
        const ny = p.y + Math.sin(angle) * pushForce;
        if (this.collision.isWalkable(nx, ny) && !this.collision.isLineBlockedByWall(p.x, p.y, nx, ny)) {
          p.x = nx;
          p.y = ny;
        } else if (this.collision.isWalkable(nx, p.y) && !this.collision.isLineBlockedByWall(p.x, p.y, nx, p.y)) {
          p.x = nx;
        } else if (this.collision.isWalkable(p.x, ny) && !this.collision.isLineBlockedByWall(p.x, p.y, p.x, ny)) {
          p.y = ny;
        }
      }
    }
  }

  /**
   * Main movement update loop for a single bot
   */
  updatePlayerMovement(match, p, dt) {
    this.collision.ensureWalkable(p);
    this.applyTeammateSeparation(match, p, dt);
    if (p.sprintTimer > 0) p.sprintTimer -= dt;

    // 1. ENGAGING ENEMY IN DIRECT COMBAT (Strafing & Counter-Strafing)
    if (p.targetEnemyId) {
      const enemy = match.players[p.targetEnemyId];
      if (enemy && enemy.alive) {
        p.targetAngle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        p.strafeTimer -= dt;
        if (p.strafeTimer <= 0) {
          p.strafeDirection = -p.strafeDirection;
          p.strafeTimer = 0.24;
        }
        if (p.burstPauseTimer > 0) {
          const perpAngle = p.angle + (Math.PI / 2) * p.strafeDirection;
          const strafeSpeed = p.weapon === 'awp' ? 44 : 38;
          const sx = p.x + Math.cos(perpAngle) * strafeSpeed * dt;
          const sy = p.y + Math.sin(perpAngle) * strafeSpeed * dt;
          if (this.collision.isWalkable(sx, sy) && !this.collision.isLineBlockedByWall(p.x, p.y, sx, sy)) {
            p.x = sx;
            p.y = sy;
          }
        }
        p.state = 'engaging';
        return;
      } else {
        p.targetEnemyId = null;
      }
    }

    // 2. AUDIO INTEL ORIENTATION (Footsteps, gunshots)
    const hasFreshSoundAlert = p.soundAlert && (Date.now() - p.soundAlert.time < 900);
    if (hasFreshSoundAlert) {
      p.targetAngle = Math.atan2(p.soundAlert.y - p.y, p.soundAlert.x - p.x);
    }

    // 3. IDLE OR DEFENSIVE HOLDING STATE
    if (!p.path || p.path.length === 0 || p.pathIndex >= p.path.length) {
      if (p.holdTimer > 0) {
        p.holdTimer -= dt;
        p.state = 'holding';

        // Pro Micro-Glance & Angle Jiggle:
        // Periodically adjust stance and glance slightly to scan the choke angle
        p.glanceTimer = (p.glanceTimer || 0) + dt;
        if (p.glanceTimer >= 4.5) {
          p.glanceTimer = 0;
          if (p.baseHoldAngle === undefined) p.baseHoldAngle = p.targetAngle || p.angle;
          const glanceOffset = (Math.random() - 0.5) * 0.28;
          p.targetAngle = p.baseHoldAngle + glanceOffset;
        }
      } else {
        p.state = 'idle';
      }
      return;
    }

    // 4. ACTIVE WAYPOINT NAVIGATION
    const targetNodeKey = p.path[p.pathIndex];
    const targetNode = this.mapData.nodes[targetNodeKey];
    if (!targetNode) {
      p.pathIndex++;
      return;
    }

    const dx = targetNode.x - p.x;
    const dy = targetNode.y - p.y;
    const dist = Math.hypot(dx, dy);

    const isFinalNode = (p.pathIndex >= p.path.length - 1);
    const arrivalRadius = isFinalNode ? 28 : 20;

    // CS:GO WAYPOINT LOOKAHEAD (String Pulling & Smooth Corner Cutting):
    if (!isFinalNode && p.pathIndex < p.path.length - 1) {
      const nextNodeKey = p.path[p.pathIndex + 1];
      const nextNode = this.mapData.nodes[nextNodeKey];
      if (nextNode && !this.collision.isLineBlockedByWall(p.x, p.y, nextNode.x, nextNode.y)) {
        const distToNext = Math.hypot(nextNode.x - p.x, nextNode.y - p.y);
        if (dist < 42 || distToNext < dist) {
          p.pathIndex++;
          match.tactics.tacticalBotUtility(match, p, targetNodeKey);
          return;
        }
      }
    }

    if (dist < arrivalRadius) {
      p.pathIndex++;
      if (p.pathIndex >= p.path.length) {
        if (match.bomb.dropped && !match.bomb.planted) {
          p.holdTimer = 22.0;
          p.state = 'holding';
          p.targetAngle = Math.atan2(match.bomb.y - p.y, match.bomb.x - p.x);
          p.baseHoldAngle = p.targetAngle;
        } else if (p.team === 'ct' && !match.bomb.planted) {
          p.holdTimer = 16.0 + Math.random() * 8.0;
          p.state = 'holding';
          this.setDefensiveHoldAngle(p, targetNodeKey);
        } else if (p.team === 't' && match.bomb.planted) {
          p.holdTimer = 25.0;
          p.state = 'holding';
          this.setDefensiveHoldAngle(p, targetNodeKey);
        }
      }
      match.tactics.tacticalBotUtility(match, p, targetNodeKey);
    } else {
      // Vector decoupling: Move angle tracks waypoint, head angle tracks aim/sounds
      const moveAngle = Math.atan2(dy, dx);
      if (!hasFreshSoundAlert) {
        p.targetAngle = moveAngle;
      }

      let baseSpeed = 75; // Pro realistic movement speed
      if (p.weapon === 'awp') baseSpeed = 62;
      else if (p.weapon === 'usp' || p.weapon === 'glock' || p.weapon === 'deagle') baseSpeed = 82;
      if (p.sprintTimer > 0) baseSpeed = 95;

      // Apply corridor queuing slowdown
      if (p.queueSlowdown && p.queueSlowdown < 1.0) {
        baseSpeed *= p.queueSlowdown;
      }

      // Apply fire burn slow
      if (p.burnSlow && p.burnSlow < 1.0) {
        baseSpeed *= p.burnSlow;
        p.burnSlow = 1.0;
      }

      // Flashbang retreat slow
      if (p.flashDuration > 1.0) {
        baseSpeed = 35;
      } else if (p.flashDuration > 0.4) {
        baseSpeed *= 0.45;
      }

      // Footstep generation
      p.footstepTimer = (p.footstepTimer || 0) + dt;
      if (baseSpeed >= 60 && p.footstepTimer >= 0.38) {
        p.footstepTimer = 0;
        const now = Date.now();
        Object.values(match.players).forEach(other => {
          if (!other.alive || other.team === p.team) return;
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d <= 340 && !this.collision.isLineBlockedByWall(other.x, other.y, p.x, p.y)) {
            other.soundAlert = { x: p.x, y: p.y, time: now, isFootstep: true };
            if (!other.targetEnemyId && other.state === 'holding') {
              other.targetAngle = Math.atan2(p.y - other.y, p.x - other.x);
            }
          }
        });
        match.events.push({ type: 'footstep', x: p.x, y: p.y, team: p.team });
      }

      const stepDist = baseSpeed * dt;
      const nextX = p.x + Math.cos(moveAngle) * stepDist;
      const nextY = p.y + Math.sin(moveAngle) * stepDist;

      // STRICT PHYSICAL BARRIER with Intelligent Corner Deflection:
      if (this.collision.isWalkable(nextX, nextY)) {
        p.x = nextX;
        p.y = nextY;
      } else {
        // Wall sliding along corridor axis with line-of-sight checks
        if (this.collision.isWalkable(nextX, p.y) && !this.collision.isLineBlockedByWall(p.x, p.y, nextX, p.y)) {
          p.x = nextX;
        } else if (this.collision.isWalkable(p.x, nextY) && !this.collision.isLineBlockedByWall(p.x, p.y, p.x, nextY)) {
          p.y = nextY;
        } else {
          // Attempt angle deflections (+30 deg, -30 deg, +60 deg, -60 deg, +85 deg, -85 deg)
          let deflected = false;
          for (const angleOffset of [0.52, -0.52, 1.05, -1.05, 1.48, -1.48]) {
            const defAngle = moveAngle + angleOffset;
            const defX = p.x + Math.cos(defAngle) * stepDist;
            const defY = p.y + Math.sin(defAngle) * stepDist;
            if (this.collision.isWalkable(defX, defY) && !this.collision.isLineBlockedByWall(p.x, p.y, defX, defY)) {
              p.x = defX;
              p.y = defY;
              deflected = true;
              break;
            }
          }
        }
      }

      // Pro Anti-Stuck Re-Path Watchdog:
      if (p.lastPosX !== undefined) {
        const moved = Math.hypot(p.x - p.lastPosX, p.y - p.lastPosY);
        if (moved < 1.2) {
          p.stuckTimer = (p.stuckTimer || 0) + dt;
          if (p.stuckTimer > 0.55) {
            p.stuckTimer = 0;
            // Clean dynamic re-pathing to destination from current closest node
            const startNode = getClosestNode(p.x, p.y, this.mapData.nodes, this.collision);
            const finalNode = p.path[p.path.length - 1];
            if (startNode && finalNode && startNode !== finalNode) {
              p.path = findPath(startNode, finalNode, this.mapData.nodes);
              p.pathIndex = 0;
            } else if (p.pathIndex < p.path.length - 1) {
              p.pathIndex++;
            } else {
              p.pathIndex = p.path.length;
              p.holdTimer = 16.0;
              p.state = 'holding';
              this.collision.ensureWalkable(p);
            }
          }
        } else {
          p.stuckTimer = 0;
        }
      }
      p.lastPosX = p.x;
      p.lastPosY = p.y;
      p.state = 'moving';
    }
  }
}

module.exports = { MovementSystem, PRE_AIM_DIRECTIONS };
