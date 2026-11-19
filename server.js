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
  ak47: { name: 'AK-47', type: 'rifle', damage: 36, hsMult: 4.0, fireRate: 0.1, accuracy: 0.88, range: 450, cost: 2700, team: 't' },
  m4a1: { name: 'M4A1-S', type: 'rifle', damage: 33, hsMult: 3.5, fireRate: 0.09, accuracy: 0.92, range: 450, cost: 2900, team: 'ct' },
  awp: { name: 'AWP', type: 'sniper', damage: 115, hsMult: 4.0, fireRate: 1.25, accuracy: 0.98, range: 750, cost: 4750, team: 'both' },
  deagle: { name: 'Desert Eagle', type: 'pistol', damage: 53, hsMult: 4.0, fireRate: 0.28, accuracy: 0.84, range: 380, cost: 700, team: 'both' },
  usp: { name: 'USP-S', type: 'pistol', damage: 26, hsMult: 3.8, fireRate: 0.18, accuracy: 0.90, range: 300, cost: 200, team: 'ct' },
  glock: { name: 'Glock-18', type: 'pistol', damage: 22, hsMult: 3.0, fireRate: 0.14, accuracy: 0.82, range: 280, cost: 200, team: 't' }
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
        manualOrder: false
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
        hasBomb: i === 1, // slot 1 starts with bomb
        weapon: 'glock',
        money: 800,
        x: spawn.x,
        y: spawn.y,
        angle: -Math.PI / 2, // facing north
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
        manualOrder: false
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

    // Reset players for round
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

      // Spawns
      const spawnList = p.team === 'ct' ? this.mapData.spawns.CT : this.mapData.spawns.T;
      const spawn = spawnList[p.slot];
      p.x = spawn.x;
      p.y = spawn.y;
      p.targetX = spawn.x;
      p.targetY = spawn.y;
      p.angle = p.team === 'ct' ? Math.PI / 2 : -Math.PI / 2;

      p.hasBomb = (p.id === this.bomb.carrierId);

      // AI weapon purchase logic based on economy
      if (p.isBot) {
        this.botBuy(p);
      }
    });

    // Assign tactical paths based on team strategies
    this.assignStrategyPaths();
  }

  botBuy(p) {
    if (this.round === 1 || this.round === 13) {
      // Pistol round
      p.weapon = p.team === 'ct' ? 'usp' : 'glock';
      if (Math.random() < 0.3 && p.money >= 700) {
        p.weapon = 'deagle';
        p.money -= 700;
      }
      if (p.team === 'ct' && p.money >= 400 && Math.random() < 0.5) {
        p.hasKit = true;
        p.money -= 400;
      }
      return;
    }

    // Full buy or eco
    if (p.money >= 4750 && Math.random() < 0.4 && p.slot === 2) {
      // Sniper role
      p.weapon = 'awp';
      p.money -= 4750;
      p.armor = 100;
      p.hasHelmet = true;
    } else if (p.money >= 3700) {
      // Full rifle buy
      p.weapon = p.team === 'ct' ? 'm4a1' : 'ak47';
      p.money -= (p.team === 'ct' ? 2900 : 2700);
      p.armor = 100;
      p.hasHelmet = true;
      if (p.team === 'ct' && p.money >= 400) {
        p.hasKit = true;
        p.money -= 400;
      }
    } else if (p.money >= 1500) {
      // Force buy deagle
      p.weapon = 'deagle';
      p.money -= 700;
    }
  }

  assignStrategyPaths() {
    const tStratKey = this.strats.t;
    const ctStratKey = this.strats.ct;

    const tStrat = this.mapData.strategies.T[tStratKey] || this.mapData.strategies.T.rush_b;
    const ctStrat = this.mapData.strategies.CT[ctStratKey] || this.mapData.strategies.CT.standard_212;

    // T assignments
    tStrat.assignments.forEach(asg => {
      const p = this.players[`t_${asg.slot}`];
      if (p && !p.manualOrder) {
        p.path = [...asg.path];
        p.pathIndex = 0;
      }
    });

    // CT assignments
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

    // Phase timers
    if (this.phase === 'freeze') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'live';
        this.timer = 115; // 1:55 round time
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

    // Broadcast snapshot to clients (every 2nd tick ~ 15hz snapshot)
    this.broadcastState();
  }

  updateLiveRound(dt) {
    // 1. Countdown round / bomb timer
    if (this.bomb.planted) {
      this.bomb.timer -= dt;
      // Audio beep pulses
      const beepInterval = Math.max(0.2, (this.bomb.timer / 40) * 1.0);
      if (!this.lastBombBeep || Date.now() - this.lastBombBeep > beepInterval * 1000) {
        this.lastBombBeep = Date.now();
        const urgency = Math.min(5, Math.floor((40 - this.bomb.timer) / 8) + 1);
        this.events.push({ type: 'bomb_beep', urgency });
      }

      if (this.bomb.timer <= 0) {
        // Bomb detonated! Ts win
        this.bombExploded();
        return;
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        // Time expired! CTs win
        this.endRound('ct', 'Target protected! Time ran out.');
        return;
      }
    }

    // 2. Update Smokes
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      this.smokes[i].remainingTime -= dt;
      if (this.smokes[i].remainingTime <= 0) {
        this.smokes.splice(i, 1);
      }
    }

    // 3. Update Grenades / Flashes
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      if (!g.detonated) {
        g.timer -= dt;
        // Fly towards target
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

    // 4. Update Players (Movement, Navigation, Flash recovery)
    Object.values(this.players).forEach(p => {
      if (!p.alive) return;

      if (p.flashDuration > 0) {
        p.flashDuration -= dt;
      }

      // If planting or defusing, stay still
      if (p.state === 'planting' || p.state === 'defusing') {
        return;
      }

      // Move along path or towards targetX, targetY
      this.updatePlayerMovement(p, dt);
    });

    // 5. Combat & Line of Sight Checks
    this.updateCombat(dt);

    // 6. Bomb Carrier Plant Check & CT Defuse Check
    this.updateBombObjectives(dt);

    // 7. Check Alive Counts
    const ctAlive = Object.values(this.players).filter(p => p.team === 'ct' && p.alive).length;
    const tAlive = Object.values(this.players).filter(p => p.team === 't' && p.alive).length;

    if (tAlive === 0 && !this.bomb.planted) {
      this.endRound('ct', 'Counter-Terrorists eliminated all enemies!');
    } else if (ctAlive === 0 && !this.bomb.planted) {
      this.endRound('t', 'Terrorists eliminated all enemies!');
    } else if (tAlive === 0 && this.bomb.planted) {
      // CTs still must defuse! Ts are dead but bomb is ticking!
      // If no CTs left to defuse:
      if (ctAlive === 0) {
        this.bombExploded();
      }
    }
  }

  updatePlayerMovement(p, dt) {
    if (p.targetEnemyId) {
      // When engaging enemy, slow down / strafe
      return;
    }

    if (p.manualOrder) {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        p.angle = Math.atan2(dy, dx);
        const speed = 135;
        p.x += Math.cos(p.angle) * speed * dt;
        p.y += Math.sin(p.angle) * speed * dt;
        p.state = 'moving';
      } else {
        p.state = 'idle';
      }
      return;
    }

    // Waypoint following
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
      // Chance to throw utility when approaching choke points
      if (p.isBot && Math.random() < 0.15) {
        this.botUtilityThrow(p, targetNodeKey);
      }
    } else {
      p.angle = Math.atan2(dy, dx);
      let speed = 125;
      if (p.weapon === 'awp') speed = 100;
      if (p.weapon === 'usp' || p.weapon === 'glock') speed = 140;

      p.x += Math.cos(p.angle) * speed * dt;
      p.y += Math.sin(p.angle) * speed * dt;
      p.state = 'moving';
    }
  }

  botUtilityThrow(p, nodeKey) {
    if (this.smokes.length + this.grenades.length > 8) return;

    if (nodeKey === 'upper_tunnels_stairs' || nodeKey === 'long_doors_ct') {
      // Throw flashbang
      this.throwGrenade(p, 'flash', p.x + Math.cos(p.angle) * 120, p.y + Math.sin(p.angle) * 120);
    } else if (nodeKey === 'long_cross' || nodeKey === 'mid_doors_t') {
      // Throw smoke
      this.throwSmoke(p, p.x + Math.cos(p.angle) * 80, p.y + Math.sin(p.angle) * 80);
    }
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
      radius: 44,
      duration: 18,
      remainingTime: 18
    });
    this.events.push({ type: 'smoke_pop', x: targetX, y: targetY });
  }

  detonateGrenade(g) {
    if (g.type === 'flash') {
      this.events.push({ type: 'flash_pop', x: g.x, y: g.y });
      // Blind nearby players with direct view
      Object.values(this.players).forEach(p => {
        if (!p.alive) return;
        const dist = Math.hypot(p.x - g.x, p.y - g.y);
        if (dist < 260) {
          // Check if facing the flash
          const angleToFlash = Math.atan2(g.y - p.y, g.x - p.x);
          const angleDiff = Math.abs(this.normalizeAngle(p.angle - angleToFlash));
          if (angleDiff < Math.PI / 2) {
            p.flashDuration = Math.min(3.5, 4.0 * (1 - dist / 260));
          } else {
            p.flashDuration = 1.0; // half-flashed
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

  updateCombat(dt) {
    const players = Object.values(this.players).filter(p => p.alive);
    const now = Date.now();

    players.forEach(p => {
      // Find enemies in line of sight
      const enemies = players.filter(e => e.team !== p.team);
      let bestTarget = null;
      let closestDist = Infinity;

      for (const enemy of enemies) {
        const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        const weapon = WEAPONS[p.weapon] || WEAPONS.ak47;

        if (dist > weapon.range) continue;

        // Check FOV cone (approx 90 deg) unless very close
        const angleToEnemy = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        const angleDiff = Math.abs(this.normalizeAngle(p.angle - angleToEnemy));

        if (dist > 70 && angleDiff > 1.1) continue;

        // Check if blocked by smoke
        if (this.isLineBlockedBySmoke(p.x, p.y, enemy.x, enemy.y)) continue;

        if (dist < closestDist) {
          closestDist = dist;
          bestTarget = enemy;
        }
      }

      p.targetEnemyId = bestTarget ? bestTarget.id : null;

      if (bestTarget) {
        // Face the enemy
        p.angle = Math.atan2(bestTarget.y - p.y, bestTarget.x - p.x);

        // Flashed players can't aim accurately or shoot effectively
        if (p.flashDuration > 0.5) return;

        const weapon = WEAPONS[p.weapon] || WEAPONS.ak47;
        if (now - (p.lastShotTime || 0) >= weapon.fireRate * 1000) {
          p.lastShotTime = now;
          this.resolveShot(p, bestTarget, weapon, closestDist);
        }
      }
    });
  }

  isLineBlockedBySmoke(x1, y1, x2, y2) {
    for (const smoke of this.smokes) {
      // Point-to-segment distance to smoke center
      const d = this.distToSegment({ x: smoke.x, y: smoke.y }, { x: x1, y: y1 }, { x: x2, y: y2 });
      if (d < smoke.radius * 0.9) {
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

  resolveShot(shooter, target, weapon, dist) {
    // Distance accuracy decay
    const accuracyFactor = weapon.accuracy * (1 - (dist / weapon.range) * 0.35);
    const isHit = Math.random() < accuracyFactor;

    let isHeadshot = false;
    let damage = 0;

    if (isHit) {
      const hsChance = weapon.name === 'AWP' ? 0.2 : 0.28;
      isHeadshot = Math.random() < hsChance;
      damage = weapon.damage * (isHeadshot ? weapon.hsMult : 1.0);

      // Armor reduction for non-headshot or non-AWP
      if (target.armor > 0 && !isHeadshot && weapon.type !== 'sniper') {
        damage = damage * 0.75;
        target.armor = Math.max(0, target.armor - 10);
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

    // Bullet tracer event
    this.events.push({
      type: 'shoot',
      weapon: shooter.weapon,
      shooterId: shooter.id,
      fromX: shooter.x,
      fromY: shooter.y,
      toX: isHit ? target.x : target.x + (Math.random() - 0.5) * 60,
      toY: isHit ? target.y : target.y + (Math.random() - 0.5) * 60,
      isHit,
      isHeadshot
    });
  }

  handleKill(killer, victim, weapon, isHeadshot) {
    victim.alive = false;
    victim.state = 'dead';
    victim.deaths++;
    killer.kills++;
    killer.money += (weapon.type === 'sniper' ? 100 : 300);

    // If victim had bomb, drop it!
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

  updateBombObjectives(dt) {
    // 1. Check if dropped bomb is picked up by another alive T
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

    // 2. Planting logic
    if (!this.bomb.planted && this.bomb.carrierId) {
      const carrier = this.players[this.bomb.carrierId];
      if (carrier && carrier.alive) {
        // Check if on Site A or B
        const distA = Math.hypot(carrier.x - this.mapData.sites.A.x, carrier.y - this.mapData.sites.A.y);
        const distB = Math.hypot(carrier.x - this.mapData.sites.B.x, carrier.y - this.mapData.sites.B.y);
        const onSite = distA <= this.mapData.sites.A.radius ? 'A' : (distB <= this.mapData.sites.B.radius ? 'B' : null);

        if (onSite && !carrier.targetEnemyId) {
          carrier.state = 'planting';
          this.bomb.planterId = carrier.id;
          this.bomb.plantProgress += dt / 3.5; // 3.5 seconds to plant

          if (this.bomb.plantProgress >= 1.0) {
            // Plant complete!
            this.bomb.planted = true;
            this.bomb.site = onSite;
            this.bomb.x = carrier.x;
            this.bomb.y = carrier.y;
            carrier.hasBomb = false;
            carrier.state = 'idle';
            this.events.push({ type: 'bomb_planted', site: onSite, x: this.bomb.x, y: this.bomb.y });

            // Ts rewarded
            Object.values(this.players).filter(p => p.team === 't').forEach(p => p.money += 800);

            // CT retake redirect
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

    // 3. Defusing logic
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
          // Defused! CT wins!
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
    // Reroute alive CTs directly towards the planted bombsite
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
    this.timer = 5.5; // post round duration
    this.score[winner]++;

    // MVP selection
    const aliveWinners = Object.values(this.players).filter(p => p.team === winner && p.alive);
    const mvp = (aliveWinners.length > 0 ? aliveWinners[0] : Object.values(this.players).filter(p => p.team === winner)[0]);
    if (mvp) mvp.mvps++;

    // Economy updates
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

    // Halftime switch at round 12
    if (this.round === 13) {
      this.swapTeams();
    }

    // Match victory condition (First to 13 wins)
    if (this.score.ct >= 13 || this.score.t >= 13) {
      this.phase = 'match_over';
      const winner = this.score.ct >= 13 ? 'Counter-Terrorists' : 'Terrorists';
      this.events.push({ type: 'match_over', winner });
      return;
    }

    this.startRound();
  }

  swapTeams() {
    // CT <-> T swap
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

// MATCH INSTANCE
const match = new GameMatch(io);

// SOCKET CONNECTION HANDLER
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Send initial data
  socket.emit('init_data', {
    mapData: match.mapData,
    weapons: WEAPONS,
    strats: match.mapData.strategies
  });

  // Player chooses team and slot
  socket.on('join_team', ({ team, slot, name }) => {
    const playerId = `${team}_${slot}`;
    const player = match.players[playerId];
    if (player) {
      player.name = name || (team === 'ct' ? 'CT Operative' : 'T Fighter');
      player.isBot = false;
      player.socketId = socket.id;
      match.connectedSockets[socket.id] = { playerId, team, slot };
      socket.emit('joined_ack', { playerId, team, slot });
      console.log(`[Player] ${name} joined as ${playerId}`);
    }
  });

  // Call team strategy
  socket.on('set_strategy', ({ team, strategy }) => {
    if (team === 'ct' || team === 't') {
      match.strats[team] = strategy;
      match.assignStrategyPaths();
      io.emit('strategy_changed', { team, strategy });
    }
  });

  // Interactive move order
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

  // Buy weapon
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

  // Throw utility
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

  // Chat message
  socket.on('send_chat', ({ text, sender }) => {
    io.emit('chat_message', { sender: sender || 'Player', text, time: Date.now() });
  });

  // Speed toggle (admin/host)
  socket.on('set_speed', ({ speed }) => {
    match.simSpeed = speed;
  });

  // Restart match
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
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   CS:GO SimulatorX Server Running on Port ${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser`);
  console.log(`===============================================`);
});
