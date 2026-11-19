const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { PNG } = require('pngjs');
const { DUST2_DATA } = require('./public/js/mapData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

// BFS Graph Pathfinding on Map Waypoints
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

// WEAPONS DATABASE
const WEAPONS = {
  ak47: { name: 'AK-47', type: 'rifle', damage: 36, hsMult: 4.0, fireRate: 0.11, accuracy: 0.90, maxRange: 420, cost: 2700, team: 't', silenced: false },
  m4a1: { name: 'M4A1-S', type: 'rifle', damage: 34, hsMult: 3.5, fireRate: 0.10, accuracy: 0.94, maxRange: 420, cost: 2900, team: 'ct', silenced: true },
  awp: { name: 'AWP', type: 'sniper', damage: 115, hsMult: 4.0, fireRate: 1.35, accuracy: 0.98, maxRange: 680, cost: 4750, team: 'both', silenced: false },
  galil: { name: 'Galil AR', type: 'rifle', damage: 30, hsMult: 3.5, fireRate: 0.10, accuracy: 0.85, maxRange: 380, cost: 1800, team: 't', silenced: false },
  famas: { name: 'FAMAS', type: 'rifle', damage: 30, hsMult: 3.5, fireRate: 0.10, accuracy: 0.86, maxRange: 380, cost: 2050, team: 'ct', silenced: false },
  deagle: { name: 'Desert Eagle', type: 'pistol', damage: 53, hsMult: 4.0, fireRate: 0.30, accuracy: 0.86, maxRange: 340, cost: 700, team: 'both', silenced: false },
  usp: { name: 'USP-S', type: 'pistol', damage: 26, hsMult: 3.8, fireRate: 0.18, accuracy: 0.91, maxRange: 280, cost: 200, team: 'ct', silenced: true },
  glock: { name: 'Glock-18', type: 'pistol', damage: 22, hsMult: 3.0, fireRate: 0.14, accuracy: 0.82, maxRange: 260, cost: 200, team: 't', silenced: false }
};

const ROSTERS = {
  ct: [
    { name: 's1mple', role: 'Sniper (AWP)' },
    { name: 'b1t', role: 'Entry Fragger' },
    { name: 'device', role: 'Second AWP / Rifler' },
    { name: 'rain', role: 'Site Anchor' },
    { name: 'Twistzz', role: 'In-Game Leader (IGL)' }
  ],
  t: [
    { name: 'ZywOo', role: 'Sniper (AWP)' },
    { name: 'NiKo', role: 'Entry Fragger' },
    { name: 'm0NESY', role: 'Second AWP / Star' },
    { name: 'electronic', role: 'In-Game Leader (IGL)' },
    { name: 'ropz', role: 'Lurker' }
  ]
};

const T_STRATS = ['rush_b', 'a_short_rush', 'long_a_execute', 'a_split', 'mid_to_b'];
const CT_STRATS = ['standard_212', 'aggressive_long', 'b_stack', 'cat_control', 'retake_defense'];

class PureCoachMatch {
  constructor(io) {
    this.io = io;
    this.mapData = DUST2_DATA;
    this.round = 1;
    this.maxRounds = 24;
    this.score = { ct: 0, t: 0 };
    this.phase = 'lobby'; // 'lobby', 'freeze', 'live', 'timeout', 'round_end', 'match_over'
    this.timer = 0;
    this.isPaused = false;
    this.simSpeed = 1.0;
    this.lossStreak = { ct: 0, t: 0 };
    this.tExecuteCalled = false;
    this.tTargetSite = 'B';

    // Coach accounts (User only has timeout authority)
    this.coaches = {
      ct: { name: 'B1ad3 (CT Koçu)', isHuman: false, socketId: null, timeoutsLeft: 2 },
      t: { name: 'zonic (T Koçu)', isHuman: false, socketId: null, timeoutsLeft: 2 }
    };

    // Current autonomous strategies picked by team IGLs
    this.activeStrategies = {
      ct: 'standard_212',
      t: 'rush_b'
    };

    this.timeoutState = {
      active: false,
      callingTeam: null,
      timer: 0
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
    this.radioMessages = [];

    this.players = {};
    this.connectedSockets = {};

    // Load authentic radar PNG and generate exact 1024x1024 pixel walkability grid
    // Every black/transparent pixel (alpha <= 100) is physically blocked!
    try {
      const mapPath = path.join(__dirname, 'public', 'assets', 'de_dust2.png');
      const pngData = PNG.sync.read(fs.readFileSync(mapPath));
      this.collisionGrid = new Uint8Array(1024 * 1024);
      for (let i = 0; i < 1024 * 1024; i++) {
        this.collisionGrid[i] = pngData.data[(i << 2) + 3] > 100 ? 1 : 0;
      }
      console.log('Successfully loaded de_dust2.png collision grid (1024x1024)');
    } catch (err) {
      console.error('Failed to load collision grid from PNG:', err);
      this.collisionGrid = new Uint8Array(1024 * 1024).fill(1);
    }

    this.initPlayers();
    this.lastTick = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 1000 / 30);
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

  isWalkable(x, y) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= 1024 || iy < 0 || iy >= 1024) return false;
    return this.collisionGrid[iy * 1024 + ix] === 1;
  }

  setPlayerPath(p, targetNodeKey) {
    if (!p || !p.alive) return;
    const startKey = getClosestNode(p.x, p.y, this.mapData.nodes);
    const path = findPath(startKey, targetNodeKey, this.mapData.nodes);
    p.path = path;
    p.pathIndex = 0;
    const startNode = this.mapData.nodes[startKey];
    if (startNode && Math.hypot(p.x - startNode.x, p.y - startNode.y) < 22 && path.length > 1) {
      p.pathIndex = 1;
    }
    p.holdTimer = 0;
    p.state = 'moving';
  }

  addRadioMessage(team, sender, text) {
    const msg = {
      team,
      sender,
      text,
      time: Date.now()
    };
    this.radioMessages.unshift(msg);
    if (this.radioMessages.length > 10) this.radioMessages.pop();
    this.events.push({ type: 'radio_call', ...msg });
  }

  initPlayers() {
    this.players = {};
    for (let i = 0; i < 5; i++) {
      const id = `ct_${i}`;
      const spawn = this.mapData.spawns.CT[i];
      const r = ROSTERS.ct[i];
      this.players[id] = {
        id,
        team: 'ct',
        slot: i,
        name: r.name,
        role: r.role,
        hp: 100,
        armor: 100,
        hasHelmet: false,
        hasKit: i % 2 === 0,
        hasBomb: false,
        weapon: 'usp',
        money: 800,
        morale: 80,
        tilt: 5,
        x: spawn.x,
        y: spawn.y,
        angle: Math.PI / 2,
        targetAngle: Math.PI / 2,
        alive: true,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        mvps: 0,
        ping: 12 + Math.floor(Math.random() * 8),
        state: 'idle',
        path: [],
        pathIndex: 0,
        lastShotTime: 0,
        targetEnemyId: null,
        flashDuration: 0,
        reactionTimer: 0,
        burstCount: 0,
        burstPauseTimer: 0,
        strafeTimer: 0,
        strafeDirection: 1,
        tradeTargetId: null,
        soundAlert: null,
        holdTimer: 0,
        sprintTimer: 0
      };
    }

    for (let i = 0; i < 5; i++) {
      const id = `t_${i}`;
      const spawn = this.mapData.spawns.T[i];
      const r = ROSTERS.t[i];
      this.players[id] = {
        id,
        team: 't',
        slot: i,
        name: r.name,
        role: r.role,
        hp: 100,
        armor: 100,
        hasHelmet: false,
        hasKit: false,
        hasBomb: i === 1,
        weapon: 'glock',
        money: 800,
        morale: 80,
        tilt: 5,
        x: spawn.x,
        y: spawn.y,
        angle: -Math.PI / 2,
        targetAngle: -Math.PI / 2,
        alive: true,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        mvps: 0,
        ping: 15 + Math.floor(Math.random() * 8),
        state: 'idle',
        path: [],
        pathIndex: 0,
        lastShotTime: 0,
        targetEnemyId: null,
        flashDuration: 0,
        reactionTimer: 0,
        burstCount: 0,
        burstPauseTimer: 0,
        strafeTimer: 0,
        strafeDirection: 1,
        tradeTargetId: null,
        soundAlert: null,
        holdTimer: 0,
        sprintTimer: 0
      };
    }
    this.bomb.carrierId = 't_1';
    this.assignStrategyPaths();
  }

  startMatch() {
    this.round = 1;
    this.score = { ct: 0, t: 0 };
    this.isPaused = false;
    this.coaches.ct.timeoutsLeft = 2;
    this.coaches.t.timeoutsLeft = 2;
    this.initPlayers();
    this.startRound();
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

    // C4 Bomb is ALWAYS assigned to a living Terrorist every single round!
    // Rotates between core pack riflers: t_1 (NiKo / Planter), t_2 (m0NESY), or t_3 (electronic)
    const eligibleSlots = [1, 2, 3];
    const carrierSlot = eligibleSlots[Math.floor(Math.random() * eligibleSlots.length)];
    this.bomb.carrierId = `t_${carrierSlot}`;
    this.bomb.carried = true;
    this.bomb.dropped = false;
    this.bomb.planted = false;
    this.bomb.timer = 40;
    this.bomb.site = null;
    this.bomb.planterId = null;
    this.bomb.plantProgress = 0;
    this.bomb.defusing = false;
    this.bomb.defuserId = null;
    this.bomb.defuseProgress = 0;
    this.clutchAnnounced = false;

    // AUTONOMOUS STRATEGY SELECTION BY IGLs
    if (this.round === 1 || this.round === 13) {
      this.activeStrategies.t = Math.random() < 0.5 ? 'rush_b' : 'a_short_rush';
      this.activeStrategies.ct = 'standard_212';
    } else {
      this.activeStrategies.t = T_STRATS[Math.floor(Math.random() * T_STRATS.length)];
      this.activeStrategies.ct = CT_STRATS[Math.floor(Math.random() * CT_STRATS.length)];
    }

    const tStrat = this.mapData.strategies.T[this.activeStrategies.t];
    this.tTargetSite = (tStrat && tStrat.targetSite) ? tStrat.targetSite : (this.activeStrategies.t === 'rush_b' || this.activeStrategies.t === 'mid_to_b' ? 'B' : 'A');
    this.tExecuteCalled = false;

    // Reset Players & Autonomous Pro CS:GO Buys
    Object.values(this.players).forEach(p => {
      p.alive = true;
      p.hp = 100;
      p.state = 'idle';
      p.flashDuration = 0;
      p.targetEnemyId = null;
      p.pathIndex = 0;
      p.reactionTimer = 0;
      p.burstCount = 0;
      p.burstPauseTimer = 0;
      p.tradeTargetId = null;
      p.soundAlert = null;
      p.holdTimer = 0;
      p.sprintTimer = 3.5;
      p.droppedBombSmoked = false;

      const spawnList = p.team === 'ct' ? this.mapData.spawns.CT : this.mapData.spawns.T;
      const spawn = spawnList[p.slot];
      p.x = spawn.x;
      p.y = spawn.y;
      if (!this.isWalkable(p.x, p.y)) {
        for (let r = 1; r < 40; r++) {
          let found = false;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (this.isWalkable(p.x + dx, p.y + dy)) {
                p.x += dx;
                p.y += dy;
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (found) break;
        }
      }
      p.angle = p.team === 'ct' ? Math.PI / 2 : -Math.PI / 2;
      p.targetAngle = p.angle;
      p.hasBomb = (p.id === this.bomb.carrierId);

      this.autonomousPlayerBuy(p);
    });

    // Sync bomb starting coordinates to carrier
    const initialCarrier = this.players[this.bomb.carrierId];
    if (initialCarrier) {
      this.bomb.x = initialCarrier.x;
      this.bomb.y = initialCarrier.y;
    }

    this.assignStrategyPaths();

    // Strategy radio announcements
    const ctStrat = this.mapData.strategies.CT[this.activeStrategies.ct];
    this.addRadioMessage('ct', 'Twistzz (IGL)', `Savunma planı: ${ctStrat ? ctStrat.name : 'Standart 2-1-2'}. Açıları tutun.`);
    this.addRadioMessage('t', 'electronic (IGL)', `Saldırı planı: ${tStrat ? tStrat.name : 'Rush B'}. Takım halinde toplu giriyoruz!`);
    if (initialCarrier) {
      this.addRadioMessage('t', initialCarrier.name, `Bomba bende! Takım beni korusun, ${this.tTargetSite} Site'a gidiyoruz.`);
    }
  }

  // Players buy completely on their own based on money & professional CS:GO meta
  autonomousPlayerBuy(p) {
    if (this.round === 1 || this.round === 13) {
      p.weapon = p.team === 'ct' ? 'usp' : 'glock';
      if (Math.random() < 0.35 && p.money >= 700) {
        p.weapon = 'deagle';
        p.money -= 700;
      }
      if (p.team === 'ct' && p.money >= 400 && Math.random() < 0.5) {
        p.hasKit = true;
        p.money -= 400;
      }
      return;
    }

    // Sniper role priority buy
    if (p.slot === 0 && p.money >= 4750) {
      p.weapon = 'awp';
      p.money -= 4750;
      p.armor = 100;
      p.hasHelmet = true;
      return;
    }

    // Full buy
    if (p.money >= 3700) {
      p.weapon = p.team === 'ct' ? 'm4a1' : 'ak47';
      p.money -= (p.team === 'ct' ? 2900 : 2700);
      p.armor = 100;
      p.hasHelmet = true;
      if (p.team === 'ct' && p.money >= 400) {
        p.hasKit = true;
        p.money -= 400;
      }
    } else if (p.money >= 1800 && Math.random() < 0.4) {
      // Occasional force buy
      p.weapon = p.team === 'ct' ? 'famas' : 'galil';
      p.money -= (p.team === 'ct' ? 2050 : 1800);
      p.armor = 100;
    } else {
      // Eco save
      p.weapon = p.team === 'ct' ? 'usp' : 'glock';
      if (p.money >= 1400 && Math.random() < 0.3) {
        p.weapon = 'deagle';
        p.money -= 700;
      }
    }
  }

  assignStrategyPaths() {
    const tStratKey = this.activeStrategies.t;
    const ctStratKey = this.activeStrategies.ct;

    const tStrat = this.mapData.strategies.T[tStratKey] || this.mapData.strategies.T.rush_b;
    const ctStrat = this.mapData.strategies.CT[ctStratKey] || this.mapData.strategies.CT.standard_212;

    tStrat.assignments.forEach(asg => {
      const p = this.players[`t_${asg.slot}`];
      if (p) {
        p.path = [...asg.path];
        p.pathIndex = 0;
        p.holdTimer = 0;
      }
    });

    // Ensure the designated bomb carrier always marches straight into the bombsite
    const carrier = this.players[this.bomb.carrierId];
    if (carrier) {
      const targetNode = this.tTargetSite === 'B' ? 'b_site' : 'a_site';
      if (!carrier.path || carrier.path.length === 0 || carrier.path[carrier.path.length - 1] !== targetNode) {
        carrier.path.push(targetNode);
      }
    }

    ctStrat.assignments.forEach(asg => {
      const p = this.players[`ct_${asg.slot}`];
      if (p) {
        p.path = [...asg.path];
        p.pathIndex = 0;
        p.holdTimer = 0;
      }
    });
  }

  tick() {
    const now = Date.now();
    const dt = ((now - this.lastTick) / 1000) * this.simSpeed;
    this.lastTick = now;

    this.events = [];

    if (this.phase === 'lobby' || this.isPaused) {
      this.broadcastState();
      return;
    }

    if (this.phase === 'timeout') {
      this.timeoutState.timer -= dt;
      if (this.timeoutState.timer <= 0) {
        this.phase = 'freeze';
        this.timer = 5;
        this.timeoutState.active = false;
        this.events.push({ type: 'timeout_end' });
      }
      this.broadcastState();
      return;
    }

    if (this.phase === 'freeze') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'live';
        this.timer = 100;
        this.events.push({ type: 'round_start' });
        this.addRadioMessage('ct', 'Twistzz (IGL)', 'Raund başladı! Pozisyonları koruyun.');
        this.addRadioMessage('t', 'electronic (IGL)', 'Çıkıyoruz! Plan doğrultusunda execute başlatın.');
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
        this.endRound('ct', 'Bölge korundu! Süre bitti.');
        return;
      }
    }

    // Update Smokes
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      this.smokes[i].remainingTime -= dt;
      if (this.smokes[i].remainingTime <= 0) {
        this.smokes.splice(i, 1);
      }
    }

    // Update Grenades
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

    // Update Players
    Object.values(this.players).forEach(p => {
      if (!p.alive) return;
      if (p.flashDuration > 0) p.flashDuration -= dt;
      this.updatePlayerAim(p, dt);
      if (p.state === 'planting' || p.state === 'defusing') return;
      this.updatePlayerMovement(p, dt);
    });

    // Resolve Combat with Line of Sight checks
    this.updateCombat(dt);

    // Terrorist Autonomous Grouped Tactics & Objective Executions
    this.updateTerroristTactics(dt);

    // Bomb Objectives
    this.updateBombObjectives(dt);

    // Check Clutch moments
    this.checkClutchSituation();

    // Check Alive Counts
    const ctAlive = Object.values(this.players).filter(p => p.team === 'ct' && p.alive).length;
    const tAlive = Object.values(this.players).filter(p => p.team === 't' && p.alive).length;

    if (tAlive === 0 && !this.bomb.planted) {
      this.endRound('ct', 'Counter-Terrorists tüm düşmanları etkisiz hale getirdi!');
    } else if (ctAlive === 0 && !this.bomb.planted) {
      this.endRound('t', 'Terrorists tüm savunmayı düşürdü!');
    } else if (tAlive === 0 && this.bomb.planted) {
      if (ctAlive === 0) {
        this.bombExploded();
      }
    }
  }

  updatePlayerAim(p, dt) {
    if (p.targetAngle === undefined) p.targetAngle = p.angle;
    let diff = this.normalizeAngle(p.targetAngle - p.angle);
    const flickSpeed = 16.0;
    const maxStep = flickSpeed * dt;

    if (Math.abs(diff) < maxStep) {
      p.angle = p.targetAngle;
    } else {
      p.angle += Math.sign(diff) * maxStep;
      p.angle = this.normalizeAngle(p.angle);
    }
  }

  updatePlayerMovement(p, dt) {
    this.ensureWalkable(p);
    if (p.sprintTimer > 0) p.sprintTimer -= dt;

    if (p.targetEnemyId) {
      const enemy = this.players[p.targetEnemyId];
      if (enemy && enemy.alive) {
        p.targetAngle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        p.strafeTimer -= dt;
        if (p.strafeTimer <= 0) {
          p.strafeDirection = -p.strafeDirection;
          p.strafeTimer = 0.24;
        }

        if (p.weapon !== 'awp' && p.burstPauseTimer > 0) {
          const perpAngle = p.angle + (Math.PI / 2) * p.strafeDirection;
          const strafeSpeed = 38;
          const sx = p.x + Math.cos(perpAngle) * strafeSpeed * dt;
          const sy = p.y + Math.sin(perpAngle) * strafeSpeed * dt;
          if (!this.isLineBlockedByWall(p.x, p.y, sx, sy)) {
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

    if (p.soundAlert && (Date.now() - p.soundAlert.time < 1200)) {
      p.targetAngle = Math.atan2(p.soundAlert.y - p.y, p.soundAlert.x - p.x);
    }

    if (!p.path || p.path.length === 0 || p.pathIndex >= p.path.length) {
      if (p.holdTimer > 0) {
        p.holdTimer -= dt;
        p.state = 'holding';
      } else {
        p.state = 'idle';
      }
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

    if (dist < 20) {
      p.pathIndex++;
      if (p.pathIndex >= p.path.length && p.team === 'ct' && !this.bomb.planted) {
        p.holdTimer = 16.0 + Math.random() * 8.0;
        p.state = 'holding';
      }
      this.tacticalBotUtility(p, targetNodeKey);
    } else {
      p.targetAngle = Math.atan2(dy, dx);
      p.angle = p.targetAngle;

      let baseSpeed = 75; // Pro realistic movement speed for 1:30+ min round duration
      if (p.weapon === 'awp') baseSpeed = 62;
      if (p.sprintTimer > 0) baseSpeed = 95;

      const nextX = p.x + Math.cos(p.angle) * baseSpeed * dt;
      const nextY = p.y + Math.sin(p.angle) * baseSpeed * dt;

      // STRICT PHYSICAL BARRIER: Bots CANNOT enter black areas!
      if (this.isWalkable(nextX, nextY)) {
        p.x = nextX;
        p.y = nextY;
      } else {
        // Wall sliding along corridor
        if (this.isWalkable(nextX, p.y)) {
          p.x = nextX;
        } else if (this.isWalkable(p.x, nextY)) {
          p.y = nextY;
        } else {
          // Advance to next waypoint if corner obstructs
          if (p.pathIndex < p.path.length - 1) {
            p.pathIndex++;
          }
        }
      }
      p.state = 'moving';
    }
  }

  tacticalBotUtility(p, nodeKey) {
    if (this.smokes.length + this.grenades.length > 7) return;

    if (p.team === 't') {
      if (nodeKey === 'long_doors_t' && Math.random() < 0.75) {
        this.throwGrenade(p, 'flash', 760, 700);
      } else if (nodeKey === 'long_doors_exit' && Math.random() < 0.7) {
        this.throwGrenade(p, 'flash', 870, 550);
      } else if (nodeKey === 'long_street' && Math.random() < 0.7) {
        this.throwSmoke(p, 830, 240); // Smoke Long Cross
      } else if (nodeKey === 'catwalk_stairs' && Math.random() < 0.75) {
        this.throwGrenade(p, 'flash', 800, 200); // Flash A Site
      } else if (nodeKey === 'a_short' && Math.random() < 0.7) {
        this.throwSmoke(p, 760, 200); // Smoke CT Elevator
      } else if (nodeKey === 'upper_tunnels_stairs' && Math.random() < 0.8) {
        this.throwGrenade(p, 'flash', 210, 260);
      } else if (nodeKey === 'upper_tunnels_north' && Math.random() < 0.75) {
        this.throwGrenade(p, 'flash', 180, 200); // Flash B Platform
      } else if (nodeKey === 'b_tunnels_exit' && Math.random() < 0.7) {
        this.throwSmoke(p, 310, 180); // Smoke B Doors
      } else if (nodeKey === 'top_mid' && Math.random() < 0.6) {
        this.throwSmoke(p, 490, 390); // Smoke Mid Doors
      }
    } else if (p.team === 'ct') {
      if (nodeKey === 'ct_elevator' && Math.random() < 0.55) {
        this.throwSmoke(p, 830, 240); // Smoke Long Cross
      } else if (nodeKey === 'ct_short_stairs' && Math.random() < 0.55) {
        this.throwGrenade(p, 'flash', 670, 370); // Flash Catwalk Stairs
      } else if (nodeKey === 'b_doors_outside' && Math.random() < 0.6) {
        this.throwSmoke(p, 150, 300); // Smoke Tunnels Exit
      } else if (nodeKey === 'b_doors' && Math.random() < 0.55) {
        this.throwGrenade(p, 'flash', 180, 260); // Flash Tunnels
      }
    }
  }

  lineIntersects(p1, p2, p3, p4) {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(det) < 0.0001) return false;
    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
    return (0.01 < lambda && lambda < 0.99) && (0.01 < gamma && gamma < 0.99);
  }

  // Exact 1024x1024 Radar Collision Raycast:
  // If line of sight or bullet passes through ANY black pixel -> BLOCKED!
  isLineBlockedByWall(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 1) return !this.isWalkable(x1, y1);
    const steps = Math.ceil(dist / 3);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x1 + (x2 - x1) * t);
      const py = Math.round(y1 + (y2 - y1) * t);
      if (!this.isWalkable(px, py)) return true; // Black pixel = solid wall!
    }
    return false;
  }

  isLineBlockedBySmoke(x1, y1, x2, y2) {
    for (const smoke of this.smokes) {
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

  canSeeEnemy(shooter, enemy) {
    const dist = Math.hypot(enemy.x - shooter.x, enemy.y - shooter.y);
    const weapon = WEAPONS[shooter.weapon] || WEAPONS.ak47;
    if (dist > weapon.maxRange) return false;

    const angleToEnemy = Math.atan2(enemy.y - shooter.y, enemy.x - shooter.x);
    const angleDiff = Math.abs(this.normalizeAngle(shooter.angle - angleToEnemy));
    if (dist > 48 && angleDiff > 0.72) return false;

    if (this.isLineBlockedBySmoke(shooter.x, shooter.y, enemy.x, enemy.y)) return false;
    if (this.isLineBlockedByWall(shooter.x, shooter.y, enemy.x, enemy.y)) return false;
    return true;
  }

  updateCombat(dt) {
    const players = Object.values(this.players).filter(p => p.alive);
    const now = Date.now();

    players.forEach(p => {
      if (p.burstPauseTimer > 0) p.burstPauseTimer -= dt;

      const enemies = players.filter(e => e.team !== p.team);
      let bestTarget = null;
      let closestDist = Infinity;

      if (p.tradeTargetId && this.players[p.tradeTargetId] && this.players[p.tradeTargetId].alive) {
        const tradeEnemy = this.players[p.tradeTargetId];
        if (this.canSeeEnemy(p, tradeEnemy)) {
          bestTarget = tradeEnemy;
          closestDist = Math.hypot(tradeEnemy.x - p.x, tradeEnemy.y - p.y);
        }
      }

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

      if (bestTarget) {
        if (p.targetEnemyId !== bestTarget.id) {
          p.targetEnemyId = bestTarget.id;
          let baseReaction = 0.20;
          if (p.tilt > 40) baseReaction += 0.08;
          p.reactionTimer = Math.max(0.12, baseReaction + (Math.random() * 0.06));
        }

        if (p.reactionTimer > 0) {
          p.reactionTimer -= dt;
          return;
        }

        if (p.flashDuration > 0.4) return;
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

    let burstAccuracy = 1.0;
    if (shooter.burstCount === 1) burstAccuracy = 0.96;
    else if (shooter.burstCount === 2) burstAccuracy = 0.88;
    else if (shooter.burstCount === 3) burstAccuracy = 0.74;
    else burstAccuracy = 0.42;

    const distFactor = Math.max(0.4, 1.0 - (dist / weapon.maxRange) * 0.45);
    const moraleBonus = (shooter.morale - 50) * 0.002;
    const movingPenalty = (shooter.state === 'moving' && weapon.type !== 'pistol') ? -0.16 : 0;
    const holdBonus = (shooter.state === 'holding') ? 0.06 : 0;
    const stationaryTargetBonus = (target.state === 'planting' || target.state === 'defusing') ? 0.12 : 0;

    let totalHitChance = (weapon.accuracy * distFactor * burstAccuracy) + moraleBonus + movingPenalty + holdBonus + stationaryTargetBonus;
    if (shooter.flashDuration > 0.3) {
      totalHitChance *= 0.25; // Blind panic-spray penalty
    }

    const isHit = Math.random() < totalHitChance;
    let isHeadshot = false;
    let damage = 0;

    if (isHit) {
      const baseHsChance = weapon.name === 'AWP' ? 0.15 : (shooter.burstCount === 1 ? 0.42 : 0.22);
      isHeadshot = Math.random() < baseHsChance;

      damage = weapon.damage * (isHeadshot ? weapon.hsMult : 1.0);
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

    if (weapon.type === 'rifle' && shooter.burstCount >= 3) {
      shooter.burstCount = 0;
      shooter.burstPauseTimer = 0.26;
    } else if (weapon.type === 'sniper') {
      shooter.burstPauseTimer = 1.35;
    }

    if (!weapon.silenced) {
      this.broadcastSoundAlert(shooter.x, shooter.y, 450);
    }

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
    victim.tilt = Math.min(100, victim.tilt + 18);
    victim.morale = Math.max(10, victim.morale - 12);

    killer.kills++;
    killer.morale = Math.min(100, killer.morale + 15);
    killer.tilt = Math.max(0, killer.tilt - 10);
    killer.money += (weapon.type === 'sniper' ? 100 : 300);

    Object.values(this.players).filter(p => p.team === victim.team && p.alive).forEach(mate => {
      const dist = Math.hypot(mate.x - victim.x, mate.y - victim.y);
      if (dist < 320) {
        mate.tradeTargetId = killer.id;
        mate.soundAlert = { x: killer.x, y: killer.y, time: Date.now() };
        mate.holdTimer = 0;
      }
    });

    // Determine zone of casualty
    let zone = 'Mid';
    const distA = Math.hypot(victim.x - this.mapData.sites.A.x, victim.y - this.mapData.sites.A.y);
    const distB = Math.hypot(victim.x - this.mapData.sites.B.x, victim.y - this.mapData.sites.B.y);
    if (distA <= 260 || (victim.x > 720 && victim.y < 340)) {
      zone = 'A Site';
    } else if (distB <= 240 || (victim.x < 330 && victim.y < 340)) {
      zone = 'B Site';
    } else if (victim.x > 700 && victim.y >= 340) {
      zone = 'Long A';
    } else {
      zone = 'Mid';
    }

    if (victim.team === 'ct') {
      this.addRadioMessage('ct', victim.name, `${victim.name} düştü! [${zone}] bölgesinde düşman var!`);

      // Dynamic rotation response if bomb is NOT yet planted
      if (!this.bomb.planted) {
        const aliveCTs = Object.values(this.players).filter(p => p.team === 'ct' && p.alive);

        if (zone === 'A Site' || zone === 'Long A') {
          // Mid CT rotates to A
          const midCT = aliveCTs.find(p => p.slot === 2);
          if (midCT) {
            this.setPlayerPath(midCT, 'a_short_site');
            this.addRadioMessage('ct', midCT.name, "A'ya desteğe geçiyorum!");
          }

          // If only 1 or 0 CTs left defending A, 1 B CT rotates through CT Spawn
          const ctAtA = aliveCTs.filter(p => p.x > 680 && p.y < 350).length;
          if (ctAtA <= 1) {
            const bCT = aliveCTs.find(p => p.x < 460);
            if (bCT) {
              this.setPlayerPath(bCT, 'a_site');
              this.addRadioMessage('ct', bCT.name, "B'den A'ya rotasyon yapıyorum, site'a tutunun!");
            }
          }

          // Terrorists exploit opening at A
          if (this.tTargetSite !== 'A') {
            this.tTargetSite = 'A';
            this.addRadioMessage('t', 'electronic (IGL)', "A savunması kırıldı! A Site açık, tüm takım A'ya yüklenin!");
            const aliveTs = Object.values(this.players).filter(p => p.team === 't' && p.alive);
            aliveTs.forEach(t => {
              if (!t.targetEnemyId) this.setPlayerPath(t, 'a_site');
            });
          }
        } else if (zone === 'B Site') {
          // Mid CT rotates to B
          const midCT = aliveCTs.find(p => p.slot === 2);
          if (midCT) {
            this.setPlayerPath(midCT, 'b_doors_outside');
            this.addRadioMessage('ct', midCT.name, "B'ye desteğe geliyorum!");
          }

          // If B is in danger, 1 A CT rotates to B
          const ctAtB = aliveCTs.filter(p => p.x < 400).length;
          if (ctAtB <= 1) {
            const aCT = aliveCTs.find(p => p.x > 650);
            if (aCT) {
              this.setPlayerPath(aCT, 'b_site');
              this.addRadioMessage('ct', aCT.name, "A'dan B'ye CT Spawn üzerinden intikal ediyorum!");
            }
          }

          // Terrorists exploit opening at B
          if (this.tTargetSite !== 'B') {
            this.tTargetSite = 'B';
            this.addRadioMessage('t', 'electronic (IGL)', "B savunması kırıldı! B Site açık, toplu hücum!");
            const aliveTs = Object.values(this.players).filter(p => p.team === 't' && p.alive);
            aliveTs.forEach(t => {
              if (!t.targetEnemyId) this.setPlayerPath(t, 'b_site');
            });
          }
        }
      }
    } else {
      // Terrorist killed
      const aliveTs = Object.values(this.players).filter(p => p.team === 't' && p.alive);
      aliveTs.forEach(mate => {
        mate.tradeTargetId = killer.id;
        mate.soundAlert = { x: killer.x, y: killer.y, time: Date.now() };
        mate.holdTimer = 0;
      });

      if (victim.hasBomb && !this.bomb.planted) {
        victim.hasBomb = false;
        this.bomb.dropped = true;
        this.bomb.carried = false;
        this.bomb.carrierId = null;
        this.bomb.x = victim.x;
        this.bomb.y = victim.y;
        this.events.push({ type: 'bomb_dropped', x: victim.x, y: victim.y });
        this.addRadioMessage('t', 'electronic (IGL)', "BOMBA DÜŞTÜ! C4'ü geri alın, site'a ilerleyin!");

        // Closest alive T retrieves bomb
        if (aliveTs.length > 0) {
          let closestT = aliveTs[0];
          let minDist = Infinity;
          for (const t of aliveTs) {
            const d = Math.hypot(t.x - victim.x, t.y - victim.y);
            if (d < minDist) {
              minDist = d;
              closestT = t;
            }
          }
          const bombNode = getClosestNode(victim.x, victim.y, this.mapData.nodes);
          this.setPlayerPath(closestT, bombNode);
        }
      }
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

  // Active Terrorist Team Execution & Group Cohesion AI:
  // Ensures Terrorists execute together onto A, B, or Short without idling
  updateTerroristTactics(dt) {
    if (this.bomb.planted) return; // In post-plant defense, handled in alertCTRetake

    const aliveTs = Object.values(this.players).filter(p => p.team === 't' && p.alive);
    if (aliveTs.length === 0) return;

    const targetNode = this.tTargetSite === 'B' ? 'b_site' : 'a_site';

    // 1. If Bomb is Dropped on the ground, closest T rushes to retrieve it
    if (this.bomb.dropped && !this.bomb.carried) {
      let closestT = null;
      let minDist = Infinity;
      for (const t of aliveTs) {
        const d = Math.hypot(t.x - this.bomb.x, t.y - this.bomb.y);
        if (d < minDist) {
          minDist = d;
          closestT = t;
        }
      }
      if (closestT && !closestT.targetEnemyId) {
        const bombNode = getClosestNode(this.bomb.x, this.bomb.y, this.mapData.nodes);
        if (!closestT.path || closestT.path.length === 0 || closestT.path[closestT.path.length - 1] !== bombNode) {
          this.setPlayerPath(closestT, bombNode);
        }
      }

      // If another T is nearby, throw protective smoke onto the dropped bomb
      if (aliveTs.length > 1 && this.smokes.length < 3) {
        const coverT = aliveTs.find(t => t.id !== (closestT && closestT.id));
        if (coverT && Math.hypot(coverT.x - this.bomb.x, coverT.y - this.bomb.y) < 280) {
          if (!coverT.droppedBombSmoked) {
            coverT.droppedBombSmoked = true;
            this.throwSmoke(coverT, this.bomb.x, this.bomb.y);
            this.addRadioMessage('t', coverT.name, "Düşen bombaya smoke attım, güvenle al!");
          }
        }
      }
    }

    // 2. Coordinated Team Execute Call after 10-12 seconds of round start:
    // IGL issues all-out push command and all alive Ts flood the bombsite together
    if (this.timer <= 88 && !this.tExecuteCalled) {
      this.tExecuteCalled = true;
      this.addRadioMessage('t', 'electronic (IGL)', `${this.tTargetSite} Site'a TOPLU GİRİYORUZ! Giriş yapın ve bombayı kurun!`);
      aliveTs.forEach(t => {
        if (!t.targetEnemyId) {
          this.setPlayerPath(t, targetNode);
        }
      });
    }

    // 3. Strict Anti-Idle Protection:
    // If any T has completed their path or sits idle before plant, direct them into the bombsite!
    aliveTs.forEach(t => {
      if (!t.targetEnemyId && (t.state === 'idle' || !t.path || t.pathIndex >= t.path.length)) {
        const sitePos = this.mapData.sites[this.tTargetSite];
        const distToSite = Math.hypot(t.x - sitePos.x, t.y - sitePos.y);
        if (distToSite > sitePos.radius + 15) {
          this.setPlayerPath(t, targetNode);
        }
      }
    });
  }

  checkClutchSituation() {
    if (this.clutchAnnounced || this.phase !== 'live') return;
    const aliveCTs = Object.values(this.players).filter(p => p.team === 'ct' && p.alive);
    const aliveTs = Object.values(this.players).filter(p => p.team === 't' && p.alive);

    if (aliveCTs.length === 1 && aliveTs.length >= 2) {
      this.clutchAnnounced = true;
      const clutcher = aliveCTs[0];
      clutcher.morale = Math.min(100, clutcher.morale + 10);
      this.addRadioMessage('ct', clutcher.name, `[CLUTCH] 1v${aliveTs.length} durumunda tek kaldım, sakin oynuyorum!`);
      this.events.push({ type: 'clutch', team: 'ct', player: clutcher.name, count: aliveTs.length });
    } else if (aliveTs.length === 1 && aliveCTs.length >= 2) {
      this.clutchAnnounced = true;
      const clutcher = aliveTs[0];
      clutcher.morale = Math.min(100, clutcher.morale + 10);
      this.addRadioMessage('t', clutcher.name, `[CLUTCH] 1v${aliveCTs.length} durumunda tek kaldım, site'a sızıyorum!`);
      this.events.push({ type: 'clutch', team: 't', player: clutcher.name, count: aliveCTs.length });
    }
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
          this.bomb.x = t.x;
          this.bomb.y = t.y;
          this.events.push({ type: 'bomb_pickup', playerId: t.id });
          const targetNode = this.tTargetSite === 'B' ? 'b_site' : 'a_site';
          this.addRadioMessage('t', 'electronic (IGL)', `Bombayı aldık! ${this.tTargetSite} Site'a topluca hücum ediyoruz!`);
          aliveTs.forEach(mate => {
            if (!mate.targetEnemyId) this.setPlayerPath(mate, targetNode);
          });
          break;
        }
      }
    }

    if (!this.bomb.planted && this.bomb.carrierId) {
      const carrier = this.players[this.bomb.carrierId];
      if (carrier && carrier.alive) {
        // Keep bomb coordinates synchronized with the carrier at all times
        this.bomb.x = carrier.x;
        this.bomb.y = carrier.y;

        const distA = Math.hypot(carrier.x - this.mapData.sites.A.x, carrier.y - this.mapData.sites.A.y);
        const distB = Math.hypot(carrier.x - this.mapData.sites.B.x, carrier.y - this.mapData.sites.B.y);
        const onSite = distA <= this.mapData.sites.A.radius ? 'A' : (distB <= this.mapData.sites.B.radius ? 'B' : null);

        if (onSite && !carrier.targetEnemyId) {
          carrier.state = 'planting';
          this.bomb.planterId = carrier.id;
          this.bomb.plantProgress += dt / 3.5;
          carrier.plantProgress = this.bomb.plantProgress;

          if (this.bomb.plantProgress >= 1.0) {
            this.bomb.planted = true;
            this.bomb.carried = false;
            this.bomb.dropped = false;
            this.bomb.site = onSite;
            this.bomb.x = carrier.x;
            this.bomb.y = carrier.y;
            carrier.hasBomb = false;
            carrier.state = 'idle';
            carrier.plantProgress = 0;
            this.events.push({ type: 'bomb_planted', site: onSite, x: this.bomb.x, y: this.bomb.y });

            Object.values(this.players).filter(p => p.team === 't').forEach(p => p.money += 800);
            this.alertCTRetake(onSite);
          }
        } else {
          if (carrier.state === 'planting') {
            carrier.state = 'idle';
            this.bomb.plantProgress = 0;
            carrier.plantProgress = 0;
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
        if (!activeDefuser.defusingAnnounced) {
          activeDefuser.defusingAnnounced = true;
          this.addRadioMessage('ct', activeDefuser.name, 'Bombayı çözüyorum! Açıları tutun, beni koruyun!');
        }
        activeDefuser.state = 'defusing';
        this.bomb.defusing = true;
        this.bomb.defuserId = activeDefuser.id;
        const defuseTime = activeDefuser.hasKit ? 5.0 : 10.0;
        this.bomb.defuseProgress = (this.bomb.defuseProgress || 0) + (dt / defuseTime);

        if (this.bomb.defuseProgress >= 1.0) {
          this.bomb.planted = false;
          activeDefuser.state = 'idle';
          activeDefuser.mvps++;
          activeDefuser.defusingAnnounced = false;
          this.endRound('ct', 'Counter-Terrorists bombayı imha etti!');
        }
      } else {
        if (this.bomb.defusing) {
          this.bomb.defusing = false;
          this.bomb.defuserId = null;
          this.bomb.defuseProgress = 0;
          Object.values(this.players).forEach(p => p.defusingAnnounced = false);
        }
      }
    }
  }

  alertCTRetake(site) {
    this.addRadioMessage('ct', 'Twistzz (IGL)', `Bomba ${site} bölgesine kuruldu! Tüm takım Retake intikaline geçiyor!`);

    const aliveCTs = Object.values(this.players).filter(p => p.team === 'ct' && p.alive);

    if (site === 'A') {
      aliveCTs.forEach((ct, idx) => {
        let targetNode = 'a_site';
        if (idx === 0) targetNode = 'ct_elevator';
        else if (idx === 1) targetNode = 'a_short_site';
        else if (idx === 2) targetNode = 'long_cross';
        else targetNode = 'a_site';

        this.setPlayerPath(ct, targetNode);
      });
    } else {
      aliveCTs.forEach((ct, idx) => {
        const targetNode = idx % 2 === 0 ? 'b_doors' : 'b_window';
        this.setPlayerPath(ct, targetNode);
      });
    }

    // Terrorist Post-Plant Positioning
    const aliveTs = Object.values(this.players).filter(p => p.team === 't' && p.alive);
    this.addRadioMessage('t', 'electronic (IGL)', 'Bomba kuruldu! Crossfire açın ve açıları koruyun!');

    if (site === 'A') {
      const aSpots = ['long_pit', 'goose', 'a_ramp', 'a_short', 'a_site'];
      aliveTs.forEach((t, idx) => {
        const spot = aSpots[idx % aSpots.length];
        this.setPlayerPath(t, spot);
      });
    } else {
      const bSpots = ['b_platform', 'b_car', 'b_window', 'upper_tunnels_choke', 'b_site'];
      aliveTs.forEach((t, idx) => {
        const spot = bSpots[idx % bSpots.length];
        this.setPlayerPath(t, spot);
      });
    }
  }

  bombExploded() {
    this.bomb.planted = false;
    this.events.push({ type: 'bomb_explode', x: this.bomb.x, y: this.bomb.y });
    this.endRound('t', 'Hedef imha edildi! Bomba patladı.');
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
        p.morale = Math.min(100, p.morale + 10);
      } else {
        const lossBonus = 1400 + this.lossStreak[p.team] * 500;
        p.money = Math.min(16000, p.money + lossBonus);
        p.morale = Math.max(10, p.morale - 8);
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
      isPaused: this.isPaused,
      score: this.score,
      coaches: this.coaches,
      activeStrategies: this.activeStrategies,
      timeoutState: this.timeoutState,
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
      radioMessages: this.radioMessages,
      events: this.events
    };

    this.io.emit('game_update', snapshot);
  }
}

const match = new PureCoachMatch(io);

io.on('connection', (socket) => {
  socket.emit('init_data', {
    mapData: match.mapData,
    weapons: WEAPONS,
    strats: match.mapData.strategies,
    rosters: ROSTERS
  });

  // START MATCH
  socket.on('start_match', () => {
    match.startMatch();
    io.emit('chat_message', { sender: 'HAKEM', text: 'MAÇ BAŞLATILDI! 1. Raund Hazırlık Aşaması.' });
  });

  // PAUSE / RESUME
  socket.on('toggle_pause', () => {
    match.isPaused = !match.isPaused;
    const txt = match.isPaused ? 'Maç DURAKLATILDI.' : 'Maç DEVAM EDİYOR.';
    io.emit('chat_message', { sender: 'HAKEM', text: txt });
  });

  // RESTART MATCH
  socket.on('restart_match', () => {
    match.phase = 'lobby';
    match.score = { ct: 0, t: 0 };
    match.round = 1;
    match.initPlayers();
    io.emit('chat_message', { sender: 'HAKEM', text: 'Maç sıfırlandı, lobiye dönüldü.' });
  });

  // BECOME COACH
  socket.on('join_coach', ({ team, coachName }) => {
    if (team === 'ct' || team === 't') {
      match.coaches[team].name = coachName || `${team.toUpperCase()} Koçu`;
      match.coaches[team].isHuman = true;
      match.coaches[team].socketId = socket.id;
      match.connectedSockets[socket.id] = { team, coachName };
      socket.emit('coach_joined_ack', { team, coachName });
      io.emit('chat_message', { sender: 'SİSTEM', text: `${coachName} artık ${team.toUpperCase()} Takımı Koçu!` });
    }
  });

  // THE ONLY IN-GAME POWER: TACTICAL TIMEOUT (MOLA AL)
  socket.on('call_timeout', ({ team }) => {
    if (team === 'ct' || team === 't') {
      if (match.coaches[team].timeoutsLeft > 0 && match.phase === 'freeze') {
        match.coaches[team].timeoutsLeft--;
        match.phase = 'timeout';
        match.timeoutState = {
          active: true,
          callingTeam: team,
          timer: 25
        };
        Object.values(match.players).filter(p => p.team === team).forEach(p => {
          p.tilt = 0;
          p.morale = Math.min(100, p.morale + 20);
        });
        io.emit('timeout_called', { team, coach: match.coaches[team].name });
        io.emit('chat_message', { sender: 'HAKEM', text: `${team.toUpperCase()} Takımı Koçu Taktiksel Mola aldı! (25s)` });
      }
    }
  });

  socket.on('send_chat', ({ text, sender }) => {
    io.emit('chat_message', { sender: sender || 'İzleyici', text, time: Date.now() });
  });

  socket.on('set_speed', ({ speed }) => {
    match.simSpeed = speed;
  });

  socket.on('disconnect', () => {
    const user = match.connectedSockets[socket.id];
    if (user && match.coaches[user.team]) {
      match.coaches[user.team].isHuman = false;
      match.coaches[user.team].socketId = null;
      delete match.connectedSockets[socket.id];
    }
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   CS:GO Pure Coach Simulator Running on Port ${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser`);
  console.log(`===============================================`);
});
