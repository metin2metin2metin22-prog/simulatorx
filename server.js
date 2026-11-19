const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { DUST2_DATA } = require('./public/js/mapData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// WEAPONS DATABASE
const WEAPONS = {
  ak47: { name: 'AK-47', type: 'rifle', damage: 36, hsMult: 4.0, fireRate: 0.11, accuracy: 0.90, maxRange: 420, cost: 2700, team: 't', silenced: false },
  m4a1: { name: 'M4A1-S', type: 'rifle', damage: 34, hsMult: 3.5, fireRate: 0.10, accuracy: 0.94, maxRange: 420, cost: 2900, team: 'ct', silenced: true },
  awp: { name: 'AWP', type: 'sniper', damage: 115, hsMult: 4.0, fireRate: 1.35, accuracy: 0.98, maxRange: 680, cost: 4750, team: 'both', silenced: false },
  deagle: { name: 'Desert Eagle', type: 'pistol', damage: 53, hsMult: 4.0, fireRate: 0.30, accuracy: 0.86, maxRange: 340, cost: 700, team: 'both', silenced: false },
  usp: { name: 'USP-S', type: 'pistol', damage: 26, hsMult: 3.8, fireRate: 0.18, accuracy: 0.91, maxRange: 280, cost: 200, team: 'ct', silenced: true },
  glock: { name: 'Glock-18', type: 'pistol', damage: 22, hsMult: 3.0, fireRate: 0.14, accuracy: 0.82, maxRange: 260, cost: 200, team: 't', silenced: false }
};

const BOT_NAMES = {
  ct: ['s1mple', 'device', 'b1t', 'rain', 'Twistzz'],
  t: ['ZywOo', 'NiKo', 'm0NESY', 'electronic', 'ropz']
};

class GameMatch {
  constructor(io) {
    this.io = io;
    this.mapData = DUST2_DATA;
    this.round = 1;
    this.maxRounds = 24;
    this.score = { ct: 0, t: 0 };
    this.phase = 'freeze'; // freeze, live, round_end, match_over
    this.timer = 10; // seconds
    this.simSpeed = 1.0;
    this.lossStreak = { ct: 0, t: 0 };

    this.strats = {
      ct: 'standard_212',
      t: 'rush_b'
    };

    this.bomb = {
      planted: false,
      dropped: false,
      carried: true,
      carrierId: null,
      x: 0,
      y: 0,
      site: null,
      timer: 40,
      planterId: null,
      plantProgress: 0,
      defusing: false,
      defuserId: null,
      defuseProgress: 0
    };

    this.smokes = [];
    this.grenades = [];
    this.killfeed = [];
    this.events = [];
    this.chat = [];

    this.players = {};
    this.connectedSockets = {}; // socketId -> { playerId, team, slot }

    this.initPlayers();
    this.startRound();
    this.lastTick = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 1000 / 30); // 30 ticks/sec
  }

  initPlayers() {
    this.players = {};
    // 5 CTs
    for (let i = 0; i < 5; i++) {
      const id = `ct_${i}`;
      const spawn = this.mapData.spawns.CT[i];
      this.players[id] = {
        id,
        team: 'ct',
        slot: i,
        name: BOT_NAMES.ct[i],
        isBot: true,
        socketId: null,
        hp: 100,
        armor: 100,
        hasHelmet: false,
        hasKit: i % 2 === 0,
        hasBomb: false,
        weapon: 'usp',
        money: 800,
        x: spawn.x,
        y: spawn.y,
        angle: Math.PI / 2, // facing south
        targetAngle: Math.PI / 2,
        alive: true,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        mvps: 0,
        ping: 15,
        state: 'idle',
        targetX: spawn.x,
        targetY: spawn.y,
        path: [],
        pathIndex: 0,
        lastShotTime: 0,
        targetEnemyId: null,
        flashDuration: 0,
        manualOrder: false,

        // PRO HUMAN AI PROPERTIES
        reactionTimer: 0,
        burstCount: 0,
        burstPauseTimer: 0,
        strafeTimer: 0,
        strafeDirection: 1,
        isHoldingAngle: true,
        tradeTargetId: null,
        soundAlert: null,
        isCounterStrafing: false,
        peekingCorner: false
      };
    }

    // 5 Ts
    for (let i = 0; i < 5; i++) {
      const id = `t_${i}`;
      const spawn = this.mapData.spawns.T[i];
      this.players[id] = {
        id,
        team: 't',
        slot: i,
        name: BOT_NAMES.t[i],
        isBot: true,
        socketId: null,
        hp: 100,
        armor: 100,
        hasHelmet: false,
        hasKit: false,
        hasBomb: i === 1,
        weapon: 'glock',
        money: 800,
        x: spawn.x,
        y: spawn.y,
        angle: -Math.PI / 2, // facing north
        targetAngle: -Math.PI / 2,
        alive: true,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        mvps: 0,
        ping: 18,
        state: 'idle',
        targetX: spawn.x,
        targetY: spawn.y,
        path: [],
        pathIndex: 0,
        lastShotTime: 0,
        targetEnemyId: null,
        flashDuration: 0,
        manualOrder: false,

        // PRO HUMAN AI PROPERTIES
        reactionTimer: 0,
        burstCount: 0,
        burstPauseTimer: 0,
        strafeTimer: 0,
        strafeDirection: 1,
        isHoldingAngle: false,
        tradeTargetId: null,
        soundAlert: null,
        isCounterStrafing: false,
        peekingCorner: false
      };
    }
    this.bomb.carrierId = 't_1';
  }

  startRound() {
    this.phase = 'freeze';
    this.timer = 10;
    this.smokes = [];
    this.grenades = [];
    this.events.push({ type: 'round_freeze', round: this.round });

    // Reset Bomb
    this.bomb.planted = false;
    this.bomb.dropped = false;
    this.bomb.carried = true;
    this.bomb.timer = 40;
    this.bomb.site = null;
    this.bomb.planterId = null;
    this.bomb.plantProgress = 0;
    this.bomb.defusing = false;
    this.bomb.defuserId = null;
    this.bomb.defuseProgress = 0;

    const tSlots = [0, 1, 2, 3, 4];
    const bombCarrierSlot = tSlots[Math.floor(Math.random() * tSlots.length)];
    this.bomb.carrierId = `t_${bombCarrierSlot}`;

    Object.values(this.players).forEach(p => {
      p.alive = true;
      p.hp = 100;
      p.state = 'idle';
      p.flashDuration = 0;
      p.targetEnemyId = null;
      p.pathIndex = 0;
      p.manualOrder = false;
      p.reactionTimer = 0;
      p.burstCount = 0;
      p.burstPauseTimer = 0;
      p.tradeTargetId = null;
      p.soundAlert = null;
      p.isCounterStrafing = false;

      const spawnList = p.team === 'ct' ? this.mapData.spawns.CT : this.mapData.spawns.T;
      const spawn = spawnList[p.slot];
      p.x = spawn.x;
      p.y = spawn.y;
      p.targetX = spawn.x;
      p.targetY = spawn.y;
      p.angle = p.team === 'ct' ? Math.PI / 2 : -Math.PI / 2;
      p.targetAngle = p.angle;

      p.hasBomb = (p.id === this.bomb.carrierId);

      if (p.isBot) {
        this.botBuy(p);
      }
    });

    this.assignStrategyPaths();
  }

  botBuy(p) {
    if (this.round === 1 || this.round === 13) {
      p.weapon = p.team === 'ct' ? 'usp' : 'glock';
      if (Math.random() < 0.25 && p.money >= 700) {
        p.weapon = 'deagle';
        p.money -= 700;
      }
      if (p.team === 'ct' && p.money >= 400 && Math.random() < 0.5) {
        p.hasKit = true;
        p.money -= 400;
      }
      return;
    }

    if (p.money >= 4750 && p.slot === 2) {
      p.weapon = 'awp';
      p.money -= 4750;
      p.armor = 100;
      p.hasHelmet = true;
    } else if (p.money >= 3700) {
      p.weapon = p.team === 'ct' ? 'm4a1' : 'ak47';
      p.money -= (p.team === 'ct' ? 2900 : 2700);
      p.armor = 100;
      p.hasHelmet = true;
      if (p.team === 'ct' && p.money >= 400) {
        p.hasKit = true;
        p.money -= 400;
      }
    } else if (p.money >= 1500) {
      p.weapon = 'deagle';
      p.money -= 700;
    }
  }

  assignStrategyPaths() {
    const tStratKey = this.strats.t;
    const ctStratKey = this.strats.ct;

    const tStrat = this.mapData.strategies.T[tStratKey] || this.mapData.strategies.T.rush_b;
    const ctStrat = this.mapData.strategies.CT[ctStratKey] || this.mapData.strategies.CT.standard_212;

    tStrat.assignments.forEach(asg => {
      const p = this.players[`t_${asg.slot}`];
      if (p && !p.manualOrder) {
        p.path = [...asg.path];
        p.pathIndex = 0;
      }
    });

    ctStrat.assignments.forEach(asg => {
      const p = this.players[`ct_${asg.slot}`];
      if (p && !p.manualOrder) {
        p.path = [...asg.path];
        p.pathIndex = 0;
      }
    });
  }

  tick() {
    const now = Date.now();
    const dt = ((now - this.lastTick) / 1000) * this.simSpeed;
    this.lastTick = now;

    this.events = [];

    if (this.phase === 'freeze') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'live';
        this.timer = 115;
        this.events.push({ type: 'round_start' });
      }
    } else if (this.phase === 'live') {
      this.updateLiveRound(dt);
    } else if (this.phase === 'round_end') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.nextRound();
      }
    }

    this.broadcastState();
  }

  updateLiveRound(dt) {
    // 1. Bomb & Round Timers
    if (this.bomb.planted) {
      this.bomb.timer -= dt;
      const beepInterval = Math.max(0.2, (this.bomb.timer / 40) * 1.0);
      if (!this.lastBombBeep || Date.now() - this.lastBombBeep > beepInterval * 1000) {
        this.lastBombBeep = Date.now();
        const urgency = Math.min(5, Math.floor((40 - this.bomb.timer) / 8) + 1);
        this.events.push({ type: 'bomb_beep', urgency });
      }

      if (this.bomb.timer <= 0) {
        this.bombExploded();
        return;
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.endRound('ct', 'Target protected! Time ran out.');
        return;
      }
    }

    // 2. Smokes Update
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      this.smokes[i].remainingTime -= dt;
      if (this.smokes[i].remainingTime <= 0) {
        this.smokes.splice(i, 1);
      }
    }

    // 3. Grenades & Flashes Update
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      if (!g.detonated) {
        g.timer -= dt;
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        g.x += dx * 6 * dt;
        g.y += dy * 6 * dt;

        if (g.timer <= 0) {
          g.detonated = true;
          g.detonateProgress = 0;
          this.detonateGrenade(g);
        }
      } else {
        g.detonateProgress += dt * 2.5;
        if (g.detonateProgress >= 1.0) {
          this.grenades.splice(i, 1);
        }
      }
    }

    // 4. Update Players (Aim smoothing, Counter-strafing, Movement)
    Object.values(this.players).forEach(p => {
      if (!p.alive) return;

      if (p.flashDuration > 0) {
        p.flashDuration -= dt;
      }

      // Smooth aim rotation towards targetAngle
      this.updatePlayerAim(p, dt);

      if (p.state === 'planting' || p.state === 'defusing') {
        return;
      }

      this.updatePlayerMovement(p, dt);
    });

    // 5. PRO TIER COMBAT & LINE OF SIGHT RESOLUTION
    this.updateCombat(dt);

    // 6. Bomb Carrier & Defuse Checks
    this.updateBombObjectives(dt);

    // 7. Win Condition Checks
    const ctAlive = Object.values(this.players).filter(p => p.team === 'ct' && p.alive).length;
    const tAlive = Object.values(this.players).filter(p => p.team === 't' && p.alive).length;

    if (tAlive === 0 && !this.bomb.planted) {
      this.endRound('ct', 'Counter-Terrorists eliminated all enemies!');
    } else if (ctAlive === 0 && !this.bomb.planted) {
      this.endRound('t', 'Terrorists eliminated all enemies!');
    } else if (tAlive === 0 && this.bomb.planted) {
      if (ctAlive === 0) {
        this.bombExploded();
      }
    }
  }

  updatePlayerAim(p, dt) {
    if (p.targetAngle === undefined) p.targetAngle = p.angle;

    // Smooth angular interpolation (Human aim tracking flick)
    let diff = this.normalizeAngle(p.targetAngle - p.angle);
    const flickSpeed = 16.0; // radians per second
    const maxStep = flickSpeed * dt;

    if (Math.abs(diff) < maxStep) {
      p.angle = p.targetAngle;
    } else {
      p.angle += Math.sign(diff) * maxStep;
      p.angle = this.normalizeAngle(p.angle);
    }
  }

  updatePlayerMovement(p, dt) {
    // If engaging enemy, execute Counter-Strafing and Micro-Strafing!
    if (p.targetEnemyId) {
      const enemy = this.players[p.targetEnemyId];
      if (enemy && enemy.alive) {
        // Face enemy smoothly
        p.targetAngle = Math.atan2(enemy.y - p.y, enemy.x - p.x);

        // Counter-Strafe: Stop to maintain 100% rifle accuracy!
        p.isCounterStrafing = true;

        // Micro-strafe between bursts (ADAD jiggle)
        p.strafeTimer -= dt;
        if (p.strafeTimer <= 0) {
          p.strafeDirection = -p.strafeDirection;
          p.strafeTimer = 0.22;
        }

        // Only micro-move if not scoped AWP
        if (p.weapon !== 'awp' && p.burstPauseTimer > 0) {
          const perpAngle = p.angle + (Math.PI / 2) * p.strafeDirection;
          const strafeSpeed = 45;
          const nextX = p.x + Math.cos(perpAngle) * strafeSpeed * dt;
          const nextY = p.y + Math.sin(perpAngle) * strafeSpeed * dt;
          if (!this.isLineBlockedByWall(p.x, p.y, nextX, nextY)) {
            p.x = nextX;
            p.y = nextY;
          }
        }
        p.state = 'engaging';
        return;
      } else {
        p.targetEnemyId = null;
        p.isCounterStrafing = false;
      }
    }

    // React to acoustic sound alert if no direct visual target
    if (p.soundAlert && (Date.now() - p.soundAlert.time < 1200)) {
      p.targetAngle = Math.atan2(p.soundAlert.y - p.y, p.soundAlert.x - p.x);
    }

    // Manual click orders
    if (p.manualOrder) {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        p.targetAngle = Math.atan2(dy, dx);
        const speed = 135;
        const nextX = p.x + Math.cos(p.angle) * speed * dt;
        const nextY = p.y + Math.sin(p.angle) * speed * dt;
        if (!this.isLineBlockedByWall(p.x, p.y, nextX, nextY)) {
          p.x = nextX;
          p.y = nextY;
          p.state = 'moving';
        }
      } else {
        p.state = 'idle';
      }
      return;
    }

    // Waypoint Navigation
    if (!p.path || p.path.length === 0 || p.pathIndex >= p.path.length) {
      p.state = 'idle';
      return;
    }

    const targetNodeKey = p.path[p.pathIndex];
    const targetNode = this.mapData.nodes[targetNodeKey];
    if (!targetNode) {
      p.pathIndex++;
      return;
    }

    const dx = targetNode.x - p.x;
    const dy = targetNode.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 18) {
      p.pathIndex++;
      // Smart utility throw when approaching key choke points
      if (p.isBot) {
        this.tacticalBotUtility(p, targetNodeKey);
      }
    } else {
      // Look towards destination with pre-aiming on corners
      p.targetAngle = Math.atan2(dy, dx);
      let speed = 130;
      if (p.weapon === 'awp') speed = 105;
      if (p.weapon === 'usp' || p.weapon === 'glock') speed = 145;

      const nextX = p.x + Math.cos(p.angle) * speed * dt;
      const nextY = p.y + Math.sin(p.angle) * speed * dt;

      // Obstacle avoidance against walls
      if (!this.isLineBlockedByWall(p.x, p.y, nextX, nextY)) {
        p.x = nextX;
        p.y = nextY;
        p.state = 'moving';
      } else {
        // Slide along wall if direct path grazed a corner
        p.pathIndex++;
      }
    }
  }

  tacticalBotUtility(p, nodeKey) {
    if (this.smokes.length + this.grenades.length > 7) return;

    // T executes
    if (p.team === 't') {
      if (nodeKey === 'long_doors_t' && Math.random() < 0.8) {
        // Flash over Long doors!
        this.throwGrenade(p, 'flash', 760, 700);
      } else if (nodeKey === 'long_street' && Math.random() < 0.7) {
        // Smoke CT Cross!
        this.throwSmoke(p, 830, 240);
      } else if (nodeKey === 'upper_tunnels_stairs' && Math.random() < 0.8) {
        // Flash out of B Tunnels!
        this.throwGrenade(p, 'flash', 210, 260);
      } else if (nodeKey === 'b_tunnels_exit' && Math.random() < 0.6) {
        // Smoke B Doors!
        this.throwSmoke(p, 320, 200);
      } else if (nodeKey === 'top_mid' && Math.random() < 0.6) {
        // Smoke Xbox!
        this.throwSmoke(p, 530, 520);
      }
    }
    // CT defenses
    else if (p.team === 'ct') {
      if (nodeKey === 'long_cross' && Math.random() < 0.5) {
        // Counter-smoke Long corner
        this.throwSmoke(p, 880, 640);
      } else if (nodeKey === 'b_doors' && Math.random() < 0.5) {
        // Counter-flash tunnels
        this.throwGrenade(p, 'flash', 210, 330);
      }
    }
  }

  // 2D Line Segment Intersection Algorithm
  lineIntersects(p1, p2, p3, p4) {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(det) < 0.0001) return false;
    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
    return (0.01 < lambda && lambda < 0.99) && (0.01 < gamma && gamma < 0.99);
  }

  isLineBlockedByWall(x1, y1, x2, y2) {
    if (!this.mapData.walls) return false;
    const p1 = { x: x1, y: y1 };
    const p2 = { x: x2, y: y2 };

    for (const w of this.mapData.walls) {
      if (this.lineIntersects(p1, p2, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) {
        return true;
      }
    }
    return false;
  }

  isLineBlockedBySmoke(x1, y1, x2, y2) {
    for (const smoke of this.smokes) {
      const d = this.distToSegment({ x: smoke.x, y: smoke.y }, { x: x1, y: y1 }, { x: x2, y: y2 });
      if (d < smoke.radius * 0.92) {
        return true;
      }
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

  // CAN SHOOTER SEE ENEMY? (Real Human Field of View, Sightline & Walls)
  canSeeEnemy(shooter, enemy) {
    const dist = Math.hypot(enemy.x - shooter.x, enemy.y - shooter.y);
    const weapon = WEAPONS[shooter.weapon] || WEAPONS.ak47;

    // 1. Strict weapon sight distance
    if (dist > weapon.maxRange) return false;

    // 2. Field of View Cone (approx 75° cone in front of eye)
    const angleToEnemy = Math.atan2(enemy.y - shooter.y, enemy.x - shooter.x);
    const angleDiff = Math.abs(this.normalizeAngle(shooter.angle - angleToEnemy));

    // Unless extremely close (audible footsteps ~45px), must be inside FOV!
    if (dist > 48 && angleDiff > 0.72) return false;

    // 3. Smoke occlusion
    if (this.isLineBlockedBySmoke(shooter.x, shooter.y, enemy.x, enemy.y)) return false;

    // 4. SOLID WALL OCCLUSION (CRITICAL: NEVER SHOOT THROUGH BUILDINGS!)
    if (this.isLineBlockedByWall(shooter.x, shooter.y, enemy.x, enemy.y)) return false;

    return true;
  }

  updateCombat(dt) {
    const players = Object.values(this.players).filter(p => p.alive);
    const now = Date.now();

    players.forEach(p => {
      // Manage burst cooldown
      if (p.burstPauseTimer > 0) {
        p.burstPauseTimer -= dt;
      }

      // Check current enemies with valid line of sight
      const enemies = players.filter(e => e.team !== p.team);
      let bestTarget = null;
      let closestDist = Infinity;

      // Priority 1: Trade Target (revenge kill if teammate was just killed)
      if (p.tradeTargetId && this.players[p.tradeTargetId] && this.players[p.tradeTargetId].alive) {
        const tradeEnemy = this.players[p.tradeTargetId];
        if (this.canSeeEnemy(p, tradeEnemy)) {
          bestTarget = tradeEnemy;
          closestDist = Math.hypot(tradeEnemy.x - p.x, tradeEnemy.y - p.y);
        }
      }

      // Priority 2: Closest visible enemy
      if (!bestTarget) {
        for (const enemy of enemies) {
          if (this.canSeeEnemy(p, enemy)) {
            const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            if (dist < closestDist) {
              closestDist = dist;
              bestTarget = enemy;
            }
          }
        }
      }

      // If target acquired
      if (bestTarget) {
        // If this is a newly spotted enemy, apply human reaction delay!
        if (p.targetEnemyId !== bestTarget.id) {
          p.targetEnemyId = bestTarget.id;
          // Pro player reaction time: 180ms - 260ms
          const holdingBonus = p.isHoldingAngle ? 0.08 : 0;
          p.reactionTimer = Math.max(0.14, 0.22 - holdingBonus + (Math.random() * 0.06));
        }

        // Decrement reaction timer
        if (p.reactionTimer > 0) {
          p.reactionTimer -= dt;
          return; // Still reacting! Not shooting yet.
        }

        // Blinded players cannot aim or shoot accurately
        if (p.flashDuration > 0.4) return;

        // Recoil burst reset check
        if (p.burstPauseTimer > 0) return;

        const weapon = WEAPONS[p.weapon] || WEAPONS.ak47;
        if (now - (p.lastShotTime || 0) >= weapon.fireRate * 1000) {
          p.lastShotTime = now;
          this.resolveProShot(p, bestTarget, weapon, closestDist);
        }
      } else {
        p.targetEnemyId = null;
        p.burstCount = 0;
      }
    });
  }

  resolveProShot(shooter, target, weapon, dist) {
    shooter.burstCount = (shooter.burstCount || 0) + 1;

    // Movement Inaccuracy penalty (running and shooting is heavily penalized in CS)
    const movePenalty = shooter.isCounterStrafing ? 1.0 : 0.45;

    // Burst spray accuracy decay (first bullet is pinpoint, 4th bullet has recoil climb)
    let burstAccuracy = 1.0;
    if (shooter.burstCount === 1) {
      burstAccuracy = 0.96;
    } else if (shooter.burstCount === 2) {
      burstAccuracy = 0.88;
    } else if (shooter.burstCount === 3) {
      burstAccuracy = 0.74;
    } else {
      burstAccuracy = 0.42; // Heavy spray penalty
    }

    // Distance falloff
    const distFactor = Math.max(0.4, 1.0 - (dist / weapon.maxRange) * 0.45);
    const totalHitChance = weapon.accuracy * distFactor * burstAccuracy * movePenalty;

    const isHit = Math.random() < totalHitChance;
    let isHeadshot = false;
    let damage = 0;

    if (isHit) {
      // Headshot calculation
      const baseHsChance = weapon.name === 'AWP' ? 0.15 : (shooter.burstCount === 1 ? 0.42 : 0.22);
      isHeadshot = Math.random() < baseHsChance;

      damage = weapon.damage * (isHeadshot ? weapon.hsMult : 1.0);

      // Armor reduction
      if (target.armor > 0 && !isHeadshot && weapon.type !== 'sniper') {
        damage = damage * 0.72;
        target.armor = Math.max(0, target.armor - 12);
      }

      damage = Math.round(damage);
      target.hp = Math.max(0, target.hp - damage);
      shooter.damage += damage;

      this.events.push({
        type: isHeadshot ? 'headshot' : 'hit',
        shooterId: shooter.id,
        targetId: target.id,
        damage,
        isHeadshot
      });

      if (target.hp <= 0) {
        this.handleKill(shooter, target, weapon, isHeadshot);
      }
    }

    // Burst Control: After 3 bullets with rifle, pause 0.26s for recoil reset!
    if (weapon.type === 'rifle' && shooter.burstCount >= 3) {
      shooter.burstCount = 0;
      shooter.burstPauseTimer = 0.26;
    } else if (weapon.type === 'sniper') {
      shooter.burstPauseTimer = 1.35;
    }

    // Acoustic Sound Ping: Unsilenced shots alert nearby enemies!
    if (!weapon.silenced) {
      this.broadcastSoundAlert(shooter.x, shooter.y, 450);
    }

    // Visual bullet tracer
    this.events.push({
      type: 'shoot',
      weapon: shooter.weapon,
      shooterId: shooter.id,
      fromX: shooter.x,
      fromY: shooter.y,
      toX: isHit ? target.x : target.x + (Math.random() - 0.5) * 45,
      toY: isHit ? target.y : target.y + (Math.random() - 0.5) * 45,
      isHit,
      isHeadshot
    });
  }

  broadcastSoundAlert(x, y, radius) {
    const now = Date.now();
    Object.values(this.players).forEach(p => {
      if (!p.alive || p.targetEnemyId) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius) {
        p.soundAlert = { x, y, time: now };
      }
    });
  }

  handleKill(killer, victim, weapon, isHeadshot) {
    victim.alive = false;
    victim.state = 'dead';
    victim.deaths++;
    killer.kills++;
    killer.money += (weapon.type === 'sniper' ? 100 : 300);

    // Callout & Trade Frag Logic: Alert victim's teammates within 280px!
    Object.values(this.players).filter(p => p.team === victim.team && p.alive).forEach(mate => {
      const dist = Math.hypot(mate.x - victim.x, mate.y - victim.y);
      if (dist < 300) {
        mate.tradeTargetId = killer.id;
        mate.soundAlert = { x: killer.x, y: killer.y, time: Date.now() };
      }
    });

    if (victim.hasBomb && !this.bomb.planted) {
      victim.hasBomb = false;
      this.bomb.dropped = true;
      this.bomb.carried = false;
      this.bomb.carrierId = null;
      this.bomb.x = victim.x;
      this.bomb.y = victim.y;
      this.events.push({ type: 'bomb_dropped', x: victim.x, y: victim.y });
    }

    this.killfeed.unshift({
      killer: killer.name,
      victim: victim.name,
      weapon: killer.weapon,
      headshot: isHeadshot,
      teamKiller: killer.team,
      teamVictim: victim.team,
      time: Date.now()
    });

    if (this.killfeed.length > 6) {
      this.killfeed.pop();
    }

    this.events.push({
      type: 'kill',
      killerName: killer.name,
      victimName: victim.name,
      weapon: killer.weapon,
      isHeadshot
    });
  }

  throwGrenade(player, type, targetX, targetY) {
    this.grenades.push({
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: player.x,
      y: player.y,
      targetX,
      targetY,
      timer: 0.8,
      detonated: false,
      detonateProgress: 0,
      throwerId: player.id
    });
  }

  throwSmoke(player, targetX, targetY) {
    this.smokes.push({
      id: Math.random().toString(36).substr(2, 9),
      x: targetX,
      y: targetY,
      radius: 46,
      duration: 18,
      remainingTime: 18
    });
    this.events.push({ type: 'smoke_pop', x: targetX, y: targetY });
  }

  detonateGrenade(g) {
    if (g.type === 'flash') {
      this.events.push({ type: 'flash_pop', x: g.x, y: g.y });
      Object.values(this.players).forEach(p => {
        if (!p.alive) return;
        const dist = Math.hypot(p.x - g.x, p.y - g.y);
        if (dist < 260) {
          // Check if wall blocks the flashbang shockwave
          if (this.isLineBlockedByWall(p.x, p.y, g.x, g.y)) return;

          const angleToFlash = Math.atan2(g.y - p.y, g.x - p.x);
          const angleDiff = Math.abs(this.normalizeAngle(p.angle - angleToFlash));
          if (angleDiff < Math.PI / 2) {
            p.flashDuration = Math.min(3.5, 4.0 * (1 - dist / 260));
          } else {
            p.flashDuration = 1.0;
          }
        }
      });
    }
  }

  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  updateBombObjectives(dt) {
    if (this.bomb.dropped && !this.bomb.carried && !this.bomb.planted) {
      const aliveTs = Object.values(this.players).filter(p => p.team === 't' && p.alive);
      for (const t of aliveTs) {
        const dist = Math.hypot(t.x - this.bomb.x, t.y - this.bomb.y);
        if (dist < 32) {
          this.bomb.dropped = false;
          this.bomb.carried = true;
          this.bomb.carrierId = t.id;
          t.hasBomb = true;
          this.events.push({ type: 'bomb_pickup', playerId: t.id });
          break;
        }
      }
    }

    if (!this.bomb.planted && this.bomb.carrierId) {
      const carrier = this.players[this.bomb.carrierId];
      if (carrier && carrier.alive) {
        const distA = Math.hypot(carrier.x - this.mapData.sites.A.x, carrier.y - this.mapData.sites.A.y);
        const distB = Math.hypot(carrier.x - this.mapData.sites.B.x, carrier.y - this.mapData.sites.B.y);
        const onSite = distA <= this.mapData.sites.A.radius ? 'A' : (distB <= this.mapData.sites.B.radius ? 'B' : null);

        if (onSite && !carrier.targetEnemyId) {
          carrier.state = 'planting';
          this.bomb.planterId = carrier.id;
          this.bomb.plantProgress += dt / 3.5;

          if (this.bomb.plantProgress >= 1.0) {
            this.bomb.planted = true;
            this.bomb.site = onSite;
            this.bomb.x = carrier.x;
            this.bomb.y = carrier.y;
            carrier.hasBomb = false;
            carrier.state = 'idle';
            this.events.push({ type: 'bomb_planted', site: onSite, x: this.bomb.x, y: this.bomb.y });

            Object.values(this.players).filter(p => p.team === 't').forEach(p => p.money += 800);
            this.alertCTRetake(onSite);
          }
        } else {
          if (carrier.state === 'planting') {
            carrier.state = 'idle';
            this.bomb.plantProgress = 0;
          }
        }
      }
    }

    if (this.bomb.planted) {
      const aliveCTs = Object.values(this.players).filter(p => p.team === 'ct' && p.alive);
      let activeDefuser = null;

      for (const ct of aliveCTs) {
        const dist = Math.hypot(ct.x - this.bomb.x, ct.y - this.bomb.y);
        if (dist <= 36 && !ct.targetEnemyId) {
          activeDefuser = ct;
          break;
        }
      }

      if (activeDefuser) {
        activeDefuser.state = 'defusing';
        this.bomb.defusing = true;
        this.bomb.defuserId = activeDefuser.id;
        const defuseTime = activeDefuser.hasKit ? 5.0 : 10.0;
        this.bomb.defuseProgress = (this.bomb.defuseProgress || 0) + (dt / defuseTime);

        if (this.bomb.defuseProgress >= 1.0) {
          this.bomb.planted = false;
          activeDefuser.state = 'idle';
          activeDefuser.mvps++;
          this.endRound('ct', 'Counter-Terrorists defused the bomb!');
        }
      } else {
        if (this.bomb.defusing) {
          this.bomb.defusing = false;
          this.bomb.defuserId = null;
          this.bomb.defuseProgress = 0;
        }
      }
    }
  }

  alertCTRetake(site) {
    const targetNode = site === 'A' ? 'a_site' : 'b_site';
    Object.values(this.players).filter(p => p.team === 'ct' && p.alive && !p.manualOrder).forEach(p => {
      p.path = [targetNode];
      p.pathIndex = 0;
    });
  }

  bombExploded() {
    this.bomb.planted = false;
    this.events.push({ type: 'bomb_explode', x: this.bomb.x, y: this.bomb.y });
    this.endRound('t', 'Target destroyed! Bomb exploded.');
  }

  endRound(winner, reason) {
    this.phase = 'round_end';
    this.timer = 5.5;
    this.score[winner]++;

    const aliveWinners = Object.values(this.players).filter(p => p.team === winner && p.alive);
    const mvp = (aliveWinners.length > 0 ? aliveWinners[0] : Object.values(this.players).filter(p => p.team === winner)[0]);
    if (mvp) mvp.mvps++;

    if (winner === 'ct') {
      this.lossStreak.ct = 0;
      this.lossStreak.t = Math.min(4, this.lossStreak.t + 1);
    } else {
      this.lossStreak.t = 0;
      this.lossStreak.ct = Math.min(4, this.lossStreak.ct + 1);
    }

    Object.values(this.players).forEach(p => {
      if (p.team === winner) {
        p.money = Math.min(16000, p.money + 3250);
      } else {
        const lossBonus = 1400 + this.lossStreak[p.team] * 500;
        p.money = Math.min(16000, p.money + lossBonus);
      }
    });

    this.events.push({
      type: 'round_win',
      winner,
      reason,
      mvpName: mvp ? mvp.name : 'Unknown'
    });
  }

  nextRound() {
    this.round++;
    if (this.round === 13) {
      this.swapTeams();
    }
    if (this.score.ct >= 13 || this.score.t >= 13) {
      this.phase = 'match_over';
      const winner = this.score.ct >= 13 ? 'Counter-Terrorists' : 'Terrorists';
      this.events.push({ type: 'match_over', winner });
      return;
    }
    this.startRound();
  }

  swapTeams() {
    const tempScore = this.score.ct;
    this.score.ct = this.score.t;
    this.score.t = tempScore;

    Object.values(this.players).forEach(p => {
      p.team = p.team === 'ct' ? 't' : 'ct';
      p.money = 800;
      p.weapon = p.team === 'ct' ? 'usp' : 'glock';
    });

    this.events.push({ type: 'halftime' });
  }

  broadcastState() {
    const snapshot = {
      round: this.round,
      phase: this.phase,
      timer: this.timer,
      score: this.score,
      strats: this.strats,
      bomb: {
        planted: this.bomb.planted,
        dropped: this.bomb.dropped,
        carried: this.bomb.carried,
        carrierId: this.bomb.carrierId,
        x: this.bomb.x,
        y: this.bomb.y,
        site: this.bomb.site,
        timer: this.bomb.timer,
        defusing: this.bomb.defusing,
        defuseProgress: this.bomb.defuseProgress
      },
      players: this.players,
      smokes: this.smokes,
      grenades: this.grenades,
      killfeed: this.killfeed,
      events: this.events
    };

    this.io.emit('game_update', snapshot);
  }
}

const match = new GameMatch(io);

io.on('connection', (socket) => {
  socket.emit('init_data', {
    mapData: match.mapData,
    weapons: WEAPONS,
    strats: match.mapData.strategies
  });

  socket.on('join_team', ({ team, slot, name }) => {
    const playerId = `${team}_${slot}`;
    const player = match.players[playerId];
    if (player) {
      player.name = name || (team === 'ct' ? 'CT Operative' : 'T Fighter');
      player.isBot = false;
      player.socketId = socket.id;
      match.connectedSockets[socket.id] = { playerId, team, slot };
      socket.emit('joined_ack', { playerId, team, slot });
    }
  });

  socket.on('set_strategy', ({ team, strategy }) => {
    if (team === 'ct' || team === 't') {
      match.strats[team] = strategy;
      match.assignStrategyPaths();
      io.emit('strategy_changed', { team, strategy });
    }
  });

  socket.on('order_move', ({ targetX, targetY }) => {
    const user = match.connectedSockets[socket.id];
    if (user && match.players[user.playerId]) {
      const p = match.players[user.playerId];
      if (p.alive) {
        p.manualOrder = true;
        p.targetX = targetX;
        p.targetY = targetY;
        p.state = 'moving';
      }
    }
  });

  socket.on('buy_weapon', ({ weaponKey }) => {
    const user = match.connectedSockets[socket.id];
    if (user && match.phase === 'freeze') {
      const p = match.players[user.playerId];
      const w = WEAPONS[weaponKey];
      if (p && w && p.money >= w.cost) {
        p.money -= w.cost;
        p.weapon = weaponKey;
        socket.emit('buy_success', { weaponKey, money: p.money });
      }
    }
  });

  socket.on('throw_utility', ({ type, targetX, targetY }) => {
    const user = match.connectedSockets[socket.id];
    if (user && match.players[user.playerId]) {
      const p = match.players[user.playerId];
      if (p.alive && match.phase === 'live') {
        if (type === 'flash') match.throwGrenade(p, 'flash', targetX, targetY);
        if (type === 'smoke') match.throwSmoke(p, targetX, targetY);
      }
    }
  });

  socket.on('send_chat', ({ text, sender }) => {
    io.emit('chat_message', { sender: sender || 'Player', text, time: Date.now() });
  });

  socket.on('set_speed', ({ speed }) => {
    match.simSpeed = speed;
  });

  socket.on('restart_match', () => {
    match.round = 1;
    match.score = { ct: 0, t: 0 };
    match.initPlayers();
    match.startRound();
  });

  socket.on('disconnect', () => {
    const user = match.connectedSockets[socket.id];
    if (user && match.players[user.playerId]) {
      match.players[user.playerId].isBot = true;
      match.players[user.playerId].socketId = null;
      delete match.connectedSockets[socket.id];
    }
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   CS:GO SimulatorX Server Running on Port ${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser`);
  console.log(`===============================================`);
});
