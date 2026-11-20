// SimulatorX - Core Match Simulation Engine & State Machine
const path = require('path');
const { DUST2_DATA } = require('../../public/js/mapData');
const { WEAPONS } = require('../config/weapons');
const { ROSTERS } = require('../config/rosters');
const { T_STRATS, CT_STRATS, DEFAULT_COACHES } = require('../config/constants');
const { findPath, getClosestNode, expandWaypoints } = require('../navigation/pathfinding');
const { CollisionSystem } = require('./CollisionSystem');
const { CombatSystem } = require('./CombatSystem');
const { BotTactics } = require('./BotTactics');
const { BombManager } = require('./BombManager');

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
    this.clutchAnnounced = false;
    this.ctBombIntel = { spotted: false, site: null, lastSpottedTime: 0, x: 0, y: 0, spotterName: null, isDropped: false };
    this.ctRushIntel = { detected: false, site: null, lastCallTime: 0, count: 0 };

    // Coaches & Timeouts
    this.coaches = JSON.parse(JSON.stringify(DEFAULT_COACHES));
    this.connectedSockets = {};

    this.timeoutState = {
      active: false,
      callingTeam: null,
      timer: 0
    };

    this.activeStrategies = {
      t: 'rush_b',
      ct: 'standard_212'
    };

    // Subsystems
    const mapPngPath = path.join(__dirname, '../../public/assets/de_dust2.png');
    this.collision = new CollisionSystem(mapPngPath);
    this.combat = new CombatSystem(this.collision);
    this.tactics = new BotTactics(this.collision);
    this.bombManager = new BombManager(this.tactics);

    // C4 Bomb State
    this.bomb = {
      x: 0,
      y: 0,
      carried: true,
      carrierId: 't_1',
      dropped: false,
      planted: false,
      site: null,
      timer: 40,
      plantProgress: 0,
      planterId: null,
      defusing: false,
      defuserId: null,
      defuseProgress: 0
    };

    this.players = {};
    this.smokes = [];
    this.grenades = [];
    this.killfeed = [];
    this.events = [];
    this.radioMessages = [];

    this.initPlayers();
    this.lastTick = Date.now();
    setInterval(() => this.tick(), 1000 / 30);
  }

  isWalkable(x, y) {
    return this.collision.isWalkable(x, y);
  }

  ensureWalkable(p) {
    this.collision.ensureWalkable(p);
  }

  setPlayerPath(player, targetNodeKey) {
    const currentNodeKey = getClosestNode(player.x, player.y, this.mapData.nodes, this.collision);
    player.path = findPath(currentNodeKey, targetNodeKey, this.mapData.nodes);
    player.pathIndex = 0;
    player.holdTimer = 0;
    player.state = 'moving';
  }

  addRadioMessage(team, sender, text) {
    const msg = {
      id: Math.random().toString(36).substr(2, 9),
      team,
      sender,
      text,
      time: Date.now()
    };
    this.radioMessages.unshift(msg);
    if (this.radioMessages.length > 8) {
      this.radioMessages.pop();
    }
    this.events.push({ type: 'radio_message', ...msg });
  }

  initPlayers() {
    this.players = {};

    // Spawn 5 CTs
    for (let i = 0; i < 5; i++) {
      const pId = `ct_${i}`;
      const spawn = this.mapData.spawns.CT[i];
      const pro = ROSTERS.ct[i];
      this.players[pId] = {
        id: pId,
        slot: i,
        name: pro.name,
        role: pro.role,
        tag: pro.tag,
        desc: pro.desc,
        rating: pro.rating,
        skills: { ...pro.skills },
        team: 'ct',
        x: spawn.x,
        y: spawn.y,
        angle: Math.PI / 2,
        targetAngle: Math.PI / 2,
        hp: 100,
        armor: 100,
        hasHelmet: true,
        hasKit: (i === 1 || i === 3),
        weapon: i === 0 ? 'awp' : (i === 4 ? 'famas' : 'm4a1'),
        money: 800,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        damageHistory: {},
        mvps: 0,
        alive: true,
        state: 'idle',
        hasBomb: false,
        flashDuration: 0,
        targetEnemyId: null,
        path: [],
        pathIndex: 0,
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

    // Spawn 5 Ts
    for (let i = 0; i < 5; i++) {
      const pId = `t_${i}`;
      const spawn = this.mapData.spawns.T[i];
      const pro = ROSTERS.t[i];
      this.players[pId] = {
        id: pId,
        slot: i,
        name: pro.name,
        role: pro.role,
        tag: pro.tag,
        desc: pro.desc,
        rating: pro.rating,
        skills: { ...pro.skills },
        team: 't',
        x: spawn.x,
        y: spawn.y,
        angle: -Math.PI / 2,
        targetAngle: -Math.PI / 2,
        hp: 100,
        armor: 100,
        hasHelmet: true,
        hasKit: false,
        weapon: i === 0 ? 'awp' : (i === 4 ? 'galil' : 'ak47'),
        money: 800,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        damageHistory: {},
        mvps: 0,
        alive: true,
        state: 'idle',
        hasBomb: (i === 1),
        flashDuration: 0,
        targetEnemyId: null,
        path: [],
        pathIndex: 0,
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
    this.timer = 2.5; // Fast, snappy freeze buy time (2.5s instead of 10s)
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
    // Dynamically finds actual players playing on T team (handles halftime swaps cleanly)
    const tPlayers = Object.values(this.players).filter(p => p.team === 't').sort((a, b) => a.slot - b.slot);
    const eligibleIndices = [1, 2, 3];
    const carrierIdx = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
    const chosenCarrier = tPlayers[carrierIdx] || tPlayers[0];

    this.bomb.carrierId = chosenCarrier ? chosenCarrier.id : 't_1';
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
    this.ctBombIntel = { spotted: false, site: null, lastSpottedTime: 0, x: 0, y: 0, spotterName: null, isDropped: false };
    this.ctRushIntel = { detected: false, site: null, lastCallTime: 0, count: 0 };

    // Autonomous strategy selection by IGLs
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
      p.hasKit = false;
      p.armor = 0;
      p.hasHelmet = false;
      p.damageHistory = {};

      const spawnList = p.team === 'ct' ? this.mapData.spawns.CT : this.mapData.spawns.T;
      const spawn = spawnList[p.slot % spawnList.length];
      p.x = spawn.x;
      p.y = spawn.y;
      this.ensureWalkable(p);

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

  autonomousPlayerBuy(p) {
    if (this.round === 1 || this.round === 13) {
      p.weapon = p.team === 'ct' ? 'usp' : 'glock';
      if (Math.random() < 0.35 && p.money >= 700) {
        p.weapon = 'deagle';
        p.money -= 700;
      } else if (p.team === 'ct' && p.money >= 400 && Math.random() < 0.45) {
        p.hasKit = true;
        p.money -= 400;
      } else if (p.money >= 650 && Math.random() < 0.65) {
        // Kevlar vest buy in pistol round
        p.armor = 100;
        p.hasHelmet = false;
        p.money -= 650;
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
    } else if (p.money >= 2400) {
      // Force buy
      p.weapon = p.team === 'ct' ? 'famas' : 'galil';
      p.money -= (p.team === 'ct' ? 2050 : 1800);
      p.armor = 100;
      p.hasHelmet = false;
    } else {
      // Eco save
      p.weapon = p.team === 'ct' ? 'usp' : 'glock';
      p.armor = 0;
      p.hasHelmet = false;
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

    const tPlayers = Object.values(this.players).filter(p => p.team === 't').sort((a, b) => a.slot - b.slot);
    const ctPlayers = Object.values(this.players).filter(p => p.team === 'ct').sort((a, b) => a.slot - b.slot);

    tStrat.assignments.forEach(asg => {
      const p = tPlayers[asg.slot];
      if (p) {
        p.path = expandWaypoints(asg.path, this.mapData.nodes);
        p.pathIndex = 0;
        p.holdTimer = 0;
      }
    });

    // Ensure the designated bomb carrier always marches straight into the bombsite
    const carrier = this.players[this.bomb.carrierId];
    if (carrier) {
      const targetNode = this.tTargetSite === 'B' ? 'b_site' : 'a_site';
      if (!carrier.path || carrier.path.length === 0 || carrier.path[carrier.path.length - 1] !== targetNode) {
        const startNode = (carrier.path && carrier.path.length > 0) ? carrier.path[0] : getClosestNode(carrier.x, carrier.y, this.mapData.nodes, this.collision);
        carrier.path = findPath(startNode, targetNode, this.mapData.nodes);
        carrier.pathIndex = 0;
        carrier.state = 'moving';
      }
    }

    ctStrat.assignments.forEach(asg => {
      const p = ctPlayers[asg.slot];
      if (p) {
        p.path = expandWaypoints(asg.path, this.mapData.nodes);
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
        this.timer = 2.5;
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
        this.bombManager.bombExploded(this);
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
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        g.x += dx * 6 * dt;
        g.y += dy * 6 * dt;
        g.timer -= dt;
        if (g.timer <= 0) {
          g.detonated = true;
          g.detonateProgress = 0;
          this.tactics.detonateGrenade(this, g);
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
    this.combat.updateCombat(this, dt);

    // Terrorist Autonomous Grouped Tactics & Objective Executions
    this.tactics.updateTerroristTactics(this, dt);

    // Counter-Terrorist Dynamic Pre-Plant Tactical Communication & Rotations
    if (!this.bomb.planted) {
      this.tactics.updateCTPrePlantTactics(this, dt);
    }

    // Bomb Objectives
    this.bombManager.updateBombObjectives(this, dt);

    // Retake & Post-Plant Tactics
    this.tactics.updateRetakeAndPostPlantTactics(this, dt);

    // Check Clutch moments
    this.tactics.checkClutchSituation(this);

    // Check Alive Counts & Instant Round Termination (NO UNNECESSARY WAITING!)
    const ctAlive = Object.values(this.players).filter(p => p.team === 'ct' && p.alive).length;
    const tAlive = Object.values(this.players).filter(p => p.team === 't' && p.alive).length;

    // 1. If ALL CTs are dead, T WINS IMMEDIATELY! Never wait for bomb or round timer!
    if (ctAlive === 0) {
      this.endRound('t', 'Counter-Terrorist takımının tamamı etkisiz hale getirildi! Terrorists kazandı.');
      return;
    }

    // 2. If ALL Ts are dead:
    if (tAlive === 0) {
      if (!this.bomb.planted) {
        // Bomb is not planted -> CT wins immediately!
        this.endRound('ct', 'Counter-Terrorists tüm düşmanları etkisiz hale getirdi!');
        return;
      }
      // If bomb IS planted, CTs still have to defuse before bomb.timer reaches 0!
      // In updateRetakeAndPostPlantTactics, CTs immediately swarm and defuse.
    }
  }

  updatePlayerAim(p, dt) {
    if (p.targetAngle === undefined) p.targetAngle = p.angle;
    let diff = this.collision.normalizeAngle(p.targetAngle - p.angle);
    const flickSpeed = 16.0;
    const maxStep = flickSpeed * dt;

    if (Math.abs(diff) < maxStep) {
      p.angle = p.targetAngle;
    } else {
      p.angle += Math.sign(diff) * maxStep;
      p.angle = this.collision.normalizeAngle(p.angle);
    }
  }

  setDefensiveHoldAngle(p, nodeKey) {
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

    const targetAim = PRE_AIM_DIRECTIONS[nodeKey];
    if (targetAim) {
      p.targetAngle = Math.atan2(targetAim.y - p.y, targetAim.x - p.x);
      p.angle = p.targetAngle;
    }
  }

  applyTeammateSeparation(p, dt) {
    const teammates = Object.values(this.players).filter(other => other.team === p.team && other.id !== p.id && other.alive);
    for (const other of teammates) {
      const dx = p.x - other.x;
      const dy = p.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 26) {
        const pushForce = (26 - d) * 16 * dt;
        const angle = Math.atan2(dy, dx);
        const nx = p.x + Math.cos(angle) * pushForce;
        const ny = p.y + Math.sin(angle) * pushForce;
        if (this.isWalkable(nx, ny)) {
          p.x = nx;
          p.y = ny;
        } else if (this.isWalkable(nx, p.y)) {
          p.x = nx;
        } else if (this.isWalkable(p.x, ny)) {
          p.y = ny;
        }
      }
    }
  }

  updatePlayerMovement(p, dt) {
    this.ensureWalkable(p);
    this.applyTeammateSeparation(p, dt);
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

        if (p.burstPauseTimer > 0) {
          const perpAngle = p.angle + (Math.PI / 2) * p.strafeDirection;
          const strafeSpeed = p.weapon === 'awp' ? 44 : 38;
          const sx = p.x + Math.cos(perpAngle) * strafeSpeed * dt;
          const sy = p.y + Math.sin(perpAngle) * strafeSpeed * dt;
          if (this.isWalkable(sx, sy) && !this.collision.isLineBlockedByWall(p.x, p.y, sx, sy)) {
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

    const hasFreshSoundAlert = p.soundAlert && (Date.now() - p.soundAlert.time < 900);
    if (hasFreshSoundAlert) {
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

    const isFinalNode = (p.pathIndex >= p.path.length - 1);
    const arrivalRadius = isFinalNode ? 28 : 20;

    if (dist < arrivalRadius) {
      p.pathIndex++;
      if (p.pathIndex >= p.path.length) {
        if (p.team === 'ct' && !this.bomb.planted) {
          p.holdTimer = 16.0 + Math.random() * 8.0;
          p.state = 'holding';
          this.setDefensiveHoldAngle(p, targetNodeKey);
        } else if (p.team === 't' && this.bomb.planted) {
          p.holdTimer = 25.0;
          p.state = 'holding';
          this.setDefensiveHoldAngle(p, targetNodeKey);
        }
      }
      this.tactics.tacticalBotUtility(this, p, targetNodeKey);
    } else {
      if (!hasFreshSoundAlert) {
        p.targetAngle = Math.atan2(dy, dx);
      }
      p.angle = p.targetAngle;

      let baseSpeed = 75; // Pro realistic movement speed for 1:30+ min round duration
      if (p.weapon === 'awp') baseSpeed = 62;
      else if (p.weapon === 'usp' || p.weapon === 'glock' || p.weapon === 'deagle') baseSpeed = 82;
      if (p.sprintTimer > 0) baseSpeed = 95;
      if (p.flashDuration > 0.4) baseSpeed *= 0.45;

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

      // Anti-stuck watchdog: detects if player hasn't moved more than 2px while trying to move
      if (p.lastPosX !== undefined) {
        const moved = Math.hypot(p.x - p.lastPosX, p.y - p.lastPosY);
        if (moved < 1.0) {
          p.stuckTimer = (p.stuckTimer || 0) + dt;
          if (p.stuckTimer > 1.2) {
            p.stuckTimer = 0;
            if (p.pathIndex < p.path.length - 1) {
              p.pathIndex++;
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

  endRound(winner, reason) {
    this.phase = 'round_end';
    this.timer = 2.8; // Snappy 2.8s round end banner (no waiting)
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
      p.hasKit = false;
      p.damageHistory = {};
    });

    this.events.push({ type: 'halftime' });
    this.addRadioMessage('ct', 'Twistzz', 'DEVRE ARASI! Takımlar taraf değiştirdi.');
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

module.exports = {
  PureCoachMatch
};
