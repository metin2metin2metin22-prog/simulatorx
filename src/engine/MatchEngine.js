// SimulatorX - Core Match Simulation Engine & State Machine
const path = require('path');
const { DUST2_DATA } = require('../../public/js/mapData');
const { WEAPONS } = require('../config/weapons');
const { ROSTERS, DEFAULT_ROSTERS, PRO_PLAYER_POOL, PERK_DEFINITIONS, ROSTER_PRESETS, calculateTeamStats } = require('../config/rosters');
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

    // Manager / Club Owner Custom Squads & Rosters
    this.currentRosters = {
      ct: JSON.parse(JSON.stringify(DEFAULT_ROSTERS.ct)),
      t: JSON.parse(JSON.stringify(DEFAULT_ROSTERS.t))
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
    this.fires = [];
    this.bMollyStage = 0;
    this.bMolly1Time = 0;
    this.midToBCrossSmoked = false;
    this.fakeAExecuted = false;
    this.fakeBHitCalled = false;
    this.killfeed = [];
    this.events = [];
    this.radioMessages = [];
    this.droppedKits = [];

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
    const fullPath = findPath(currentNodeKey, targetNodeKey, this.mapData.nodes);
    player.path = fullPath;
    player.pathIndex = 0;

    // Pro CS:GO Path Smoothing: If player already has a clear line of sight to the 2nd node
    // and is already past or near the 1st node, start at index 1 to prevent 180-degree backwards turning!
    if (fullPath.length > 1) {
      const node0 = this.mapData.nodes[fullPath[0]];
      const node1 = this.mapData.nodes[fullPath[1]];
      if (node0 && node1 && !this.collision.isLineBlockedByWall(player.x, player.y, node1.x, node1.y)) {
        const d01 = Math.hypot(node1.x - node0.x, node1.y - node0.y);
        const dP1 = Math.hypot(node1.x - player.x, node1.y - player.y);
        if (dP1 <= d01 + 25) {
          player.pathIndex = 1;
        }
      }
    }

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

  setTeamRoster(team, newRoster) {
    if (!newRoster || !Array.isArray(newRoster) || newRoster.length < 5) return this.currentRosters[team];
    this.currentRosters[team] = newRoster.slice(0, 5).map(p => ({
      id: p.id || Math.random().toString(36).substr(2, 9),
      name: p.name,
      role: p.role,
      tag: p.tag || p.role,
      desc: p.desc || '',
      rating: Number(p.rating) || 1.15,
      tier: p.tier || 'S',
      perk: p.perk || 'onetap_god',
      skills: {
        aim: p.skills?.aim || 94,
        reflex: p.skills?.reflex || 94,
        headshot: p.skills?.headshot || p.skills?.aim || 90,
        gamesense: p.skills?.gamesense || 94,
        clutch: p.skills?.clutch || 94,
        utility: p.skills?.utility || 90,
        aggression: p.skills?.aggression || 75
      }
    }));

    // Immediately propagate to live player objects
    for (let i = 0; i < 5; i++) {
      const pId = `${team}_${i}`;
      const player = this.players[pId];
      const pro = this.currentRosters[team][i];
      if (player && pro) {
        player.name = pro.name;
        player.role = pro.role;
        player.tag = pro.tag;
        player.desc = pro.desc;
        player.rating = pro.rating;
        player.tier = pro.tier;
        player.perk = pro.perk;
        player.skills = { ...pro.skills };
      }
    }

    this.events.push({ type: 'roster_changed', team });
    return this.currentRosters[team];
  }

  initPlayers() {
    this.players = {};

    // Spawn 5 CTs
    for (let i = 0; i < 5; i++) {
      const pId = `ct_${i}`;
      const spawn = this.mapData.spawns.CT[i];
      const pro = (this.currentRosters.ct && this.currentRosters.ct[i]) || DEFAULT_ROSTERS.ct[i];
      this.players[pId] = {
        id: pId,
        slot: i,
        name: pro.name,
        role: pro.role,
        tag: pro.tag,
        desc: pro.desc,
        rating: pro.rating,
        tier: pro.tier || 'S',
        perk: pro.perk || 'onetap_god',
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
      const pro = (this.currentRosters.t && this.currentRosters.t[i]) || DEFAULT_ROSTERS.t[i];
      this.players[pId] = {
        id: pId,
        slot: i,
        name: pro.name,
        role: pro.role,
        tag: pro.tag,
        desc: pro.desc,
        rating: pro.rating,
        tier: pro.tier || 'S',
        perk: pro.perk || 'onetap_god',
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
    this.killfeed = [];
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
    this.fires = [];
    this.bMollyStage = 0;
    this.bMolly1Time = 0;
    this.midToBCrossSmoked = false;
    this.fakeAExecuted = false;
    this.fakeBHitCalled = false;
    this.ctMidCrossCalled = false;
    this.droppedKits = []; // Clear dropped kits for fresh round
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

    // Reset Players & Authentic Pro CS:GO Saving / Economy
    Object.values(this.players).forEach(p => {
      const wasAlive = p.alive; // Player survived the round!
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
      p.damageHistory = {};
      p.isReloading = false;
      p.reloadTimer = 0;
      p.footstepTimer = 0;

      const spawnList = p.team === 'ct' ? this.mapData.spawns.CT : this.mapData.spawns.T;
      const spawn = spawnList[p.slot % spawnList.length];
      p.x = spawn.x;
      p.y = spawn.y;
      this.ensureWalkable(p);

      p.angle = p.team === 'ct' ? Math.PI / 2 : -Math.PI / 2;
      p.targetAngle = p.angle;
      p.hasBomb = (p.id === this.bomb.carrierId);

      // PRO CS:GO WEAPON SAVING MECHANIC:
      // If player died last round or it's pistol round, reset equipment.
      // If player SURVIVED, they KEEP their weapon, armor, and defuse kit for free!
      if (!wasAlive || this.round === 1 || this.round === 13) {
        p.armor = 0;
        p.hasHelmet = false;
        p.hasKit = false;
        p.weapon = p.team === 'ct' ? 'usp' : 'glock';
      }
    });

    // TEAM-COORDINATED BUYING & WEAPON DROPS
    this.executeTeamAutonomousBuy('ct');
    this.executeTeamAutonomousBuy('t');

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

  executeTeamAutonomousBuy(team) {
    const teamPlayers = Object.values(this.players).filter(p => p.team === team);

    // CS:GO PISTOL ROUND META: Round 1 & Round 13 (Starting halves, max $800)
    if (this.round === 1 || this.round === 13) {
      teamPlayers.forEach((p, idx) => {
        p.weapon = team === 'ct' ? 'usp' : 'glock';
        p.armor = 0;
        p.hasHelmet = false;
        p.hasKit = false;
        p.isDeagleEcoTrap = false;

        // 3 Players Buy Kevlar Armor ($650): Slots 0, 1, 2
        if (idx <= 2 && p.money >= 650) {
          p.armor = 100;
          p.hasHelmet = false;
          p.money -= 650;
        } else {
          // 2 Players (IGL & Support) Buy Utility & Kits ($600-$700): Slots 3, 4
          if (team === 'ct') {
            if (idx === 3 && p.money >= 600) {
              p.hasKit = true;
              p.money -= 600; // Kit ($400) + Flash ($200)
            } else if (p.money >= 500) {
              p.money -= 500; // Smoke ($300) + Flash ($200)
            }
          } else {
            if (idx === 3 && p.money >= 700) {
              p.weapon = 'deagle'; // Firepower upgrade
              p.money -= 700;
            } else if (p.money >= 500) {
              p.money -= 500; // Smoke ($300) + Flash ($200)
            }
          }
        }
        const w = WEAPONS[p.weapon] || WEAPONS.ak47;
        p.ammo = w.clipSize || 30;
        p.reserveAmmo = w.maxReserve || 90;
      });

      const igl = teamPlayers.find(p => p.slot === 0 || p.slot === 1) || teamPlayers[0];
      if (team === 'ct') {
        this.addRadioMessage('ct', igl.name, "TABANCA RAUNDU: 3 kişi yelek aldı, 2 kişi flaş ve sisle girişleri tutuyor!");
      } else {
        this.addRadioMessage('t', igl.name, "TABANCA RAUNDU: Yelekli oyuncular önden çıkacak, arkadan flaş ve sisle açıyoruz!");
      }
      return;
    }

    const avgMoney = teamPlayers.reduce((sum, p) => sum + p.money, 0) / teamPlayers.length;
    let teamStrat = 'full_buy';
    if (avgMoney < 2200) {
      teamStrat = 'eco';
    } else if (avgMoney < 3600) {
      teamStrat = 'force_buy';
    } else {
      teamStrat = 'full_buy';
    }

    // Weapon Drops between teammates:
    // If a rich player has > $5500 and a teammate who died has < $2700 during a buy round:
    if (teamStrat === 'full_buy' || teamStrat === 'force_buy') {
      const rich = teamPlayers.filter(p => p.money >= 5500).sort((a, b) => b.money - a.money);
      const poor = teamPlayers.filter(p => p.money < 2700 && (p.weapon === 'usp' || p.weapon === 'glock')).sort((a, b) => a.money - b.money);

      for (let i = 0; i < Math.min(rich.length, poor.length); i++) {
        const donor = rich[i];
        const receiver = poor[i];
        const rifleKey = team === 'ct' ? 'm4a1' : 'ak47';
        const cost = team === 'ct' ? 2900 : 2700;
        if (donor.money - cost >= 2400) {
          donor.money -= cost;
          receiver.weapon = rifleKey;
          this.addRadioMessage(team, donor.name, `${receiver.name}, sana ${team === 'ct' ? 'M4A1-S' : 'AK-47'} drop attım!`);
        }
      }
    }

    // Individual buys according to team strategy
    teamPlayers.forEach(p => {
      const hasRifleOrAwp = p.weapon === 'ak47' || p.weapon === 'm4a1' || p.weapon === 'm4a4' || p.weapon === 'awp';

      if (teamStrat === 'full_buy') {
        if (p.slot === 0 && (p.money >= 4750 || p.weapon === 'awp')) {
          if (p.weapon !== 'awp' && p.money >= 4750) {
            p.weapon = 'awp';
            p.money -= 4750;
          }
          if (p.armor >= 50 && !p.hasHelmet && p.money >= 350) {
            p.hasHelmet = true;
            p.money -= 350;
          } else if (p.armor < 50 && p.money >= 1000) {
            p.armor = 100;
            p.hasHelmet = true;
            p.money -= 1000;
          } else if (p.armor < 50 && p.money >= 650) {
            p.armor = 100;
            p.hasHelmet = false;
            p.money -= 650;
          }
        } else {
          if (!hasRifleOrAwp && p.money >= (team === 'ct' ? 2900 : 2700)) {
            p.weapon = team === 'ct' ? 'm4a1' : 'ak47';
            p.money -= (team === 'ct' ? 2900 : 2700);
          }
          if (p.armor >= 50 && !p.hasHelmet && p.money >= 350) {
            p.hasHelmet = true;
            p.money -= 350;
          } else if (p.armor < 50 && p.money >= 1000) {
            p.armor = 100;
            p.hasHelmet = true;
            p.money -= 1000;
          } else if (p.armor < 50 && p.money >= 650) {
            p.armor = 100;
            p.hasHelmet = false;
            p.money -= 650;
          }
        }
        if (team === 'ct' && !p.hasKit && p.money >= 400) {
          p.hasKit = true;
          p.money -= 400;
        }
      } else if (teamStrat === 'force_buy') {
        if (!hasRifleOrAwp) {
          if (p.money >= (team === 'ct' ? 2050 : 1800)) {
            p.weapon = team === 'ct' ? 'famas' : 'galil';
            p.money -= (team === 'ct' ? 2050 : 1800);
          } else if (p.money >= 700) {
            p.weapon = 'deagle';
            p.money -= 700;
          }
        }
        if (p.armor >= 50 && !p.hasHelmet && p.money >= 350) {
          p.hasHelmet = true;
          p.money -= 350;
        } else if (p.armor < 50 && p.money >= 650) {
          p.armor = 100;
          p.hasHelmet = false;
          p.money -= 650;
        }
      } else {
        // ECO BUY: 2 players with high aim skill buy Deagles and set up the 1-tap ambush!
        p.isDeagleEcoTrap = false;
        if (!hasRifleOrAwp) {
          p.weapon = team === 'ct' ? 'usp' : 'glock';
          const deagleWorthy = (p.slot === 0 || p.slot === 1 || (p.skills && p.skills.aim >= 95));
          if (deagleWorthy && p.money >= 1700 && Math.random() < 0.85) {
            p.weapon = 'deagle';
            p.money -= 700;
            p.isDeagleEcoTrap = true;
          }
        }
      }

      const w = WEAPONS[p.weapon] || WEAPONS.ak47;
      p.ammo = w.clipSize || 30;
      p.reserveAmmo = w.maxReserve || 90;
    });

    const igl = teamPlayers.find(p => p.slot === 0 || p.slot === 1) || teamPlayers[0];
    if (teamStrat === 'eco') {
      const hasDeagles = teamPlayers.some(p => p.weapon === 'deagle' && p.isDeagleEcoTrap);
      if (hasDeagles) {
        this.addRadioMessage(team, igl.name, "ECO RAUND: Deagle tuzağı kurduk, dar açıda bekliyoruz! Tek mermiyle silah çalacağız!");
      } else {
        this.addRadioMessage(team, igl.name, "ECO RAUND! Para biriktiriyoruz, sonraki raunt tam alım yapacağız.");
      }
    } else if (teamStrat === 'force_buy') {
      this.addRadioMessage(team, igl.name, 'FORCE BUY! Kırılma raundu, elimizdeki parayla yükleneceğiz!');
    } else {
      this.addRadioMessage(team, igl.name, 'FULL BUY! Ekipmanlar tam, execute için hazır olun.');
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
        p.state = 'moving';
      }
    });

    // Bomb Carrier Strategy Assignment:
    // Carrier stays grouped with the team behind the entry fragger (slot 0) along the strategy's primary assault path,
    // NEVER taking a solo shortest-path BFS suicide charge through Mid!
    const carrier = this.players[this.bomb.carrierId];
    if (carrier) {
      const mainAsg = tStrat.assignments.find(a => a.slot === carrier.slot) || tStrat.assignments[1] || tStrat.assignments[0];
      if (mainAsg && mainAsg.path) {
        carrier.path = expandWaypoints(mainAsg.path, this.mapData.nodes);
        carrier.pathIndex = 0;
        carrier.holdTimer = 0;
        carrier.state = 'moving';
      }
    }

    ctStrat.assignments.forEach(asg => {
      const p = ctPlayers[asg.slot];
      if (p) {
        p.path = expandWaypoints(asg.path, this.mapData.nodes);
        p.pathIndex = 0;
        p.holdTimer = 0;
        p.state = 'moving';
      }
    });

    // CS:GO DEAGLE ECO TRAP PATHING:
    // Players equipped with Deagles for 1-tap ambush take close tight-corner setups!
    [...tPlayers, ...ctPlayers].forEach(p => {
      if (p.isDeagleEcoTrap && p.id !== this.bomb.carrierId) {
        const ambushSpot = p.team === 'ct'
          ? (p.slot % 2 === 0 ? 'b_car' : 'long_pit')
          : (p.slot % 2 === 0 ? 'lower_tunnels' : 'outside_long');
        const startNode = getClosestNode(p.x, p.y, this.mapData.nodes, this.collision);
        if (startNode && ambushSpot) {
          p.path = findPath(startNode, ambushSpot, this.mapData.nodes);
          p.pathIndex = 0;
          p.holdTimer = 0;
          p.state = 'moving';
        }
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

    // Update Dropped Defuse Kits Pickup
    if (this.droppedKits && this.droppedKits.length > 0) {
      const aliveCTs = Object.values(this.players).filter(p => p.team === 'ct' && p.alive && !p.hasKit);
      for (let i = this.droppedKits.length - 1; i >= 0; i--) {
        const kit = this.droppedKits[i];
        for (const ct of aliveCTs) {
          if (Math.hypot(ct.x - kit.x, ct.y - kit.y) <= 36) {
            ct.hasKit = true;
            this.droppedKits.splice(i, 1);
            this.events.push({ type: 'kit_pickup', playerId: ct.id, x: kit.x, y: kit.y });
            this.addRadioMessage('ct', ct.name, 'Yerdeki imha kitini aldım!');
            break;
          }
        }
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

    // Update Fires (Molotovs / Incendiaries) & Smoke Extinguishing
    this.fires = this.fires || [];
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const fire = this.fires[i];
      fire.remainingTime -= dt;

      // INSTANT SMOKE EXTINGUISH: If an ENEMY smoke covers the fire pool, fire is snuffed out!
      // Teammates never extinguish their own molotovs!
      const extinguishingSmoke = this.smokes.find(s => 
        (!s.team || !fire.team || s.team !== fire.team) &&
        Math.hypot(s.x - fire.x, s.y - fire.y) <= (s.radius + fire.radius * 0.45)
      );
      if (extinguishingSmoke || fire.remainingTime <= 0) {
        if (extinguishingSmoke) {
          this.events.push({ type: 'fire_extinguished', x: fire.x, y: fire.y });
        }
        this.fires.splice(i, 1);
        continue;
      }

      // Burn tick damage to players inside the fire pool
      Object.values(this.players).forEach(p => {
        if (!p.alive) return;
        const d = Math.hypot(p.x - fire.x, p.y - fire.y);
        if (d <= (fire.radius || 46)) {
          const burnDmg = Math.round(22 * dt);
          if (burnDmg > 0) {
            p.hp = Math.max(0, p.hp - burnDmg);
            p.burnSlow = 0.58; // Burning slows down sprint/run speed
            const thrower = this.players[fire.throwerId];
            if (thrower) thrower.damage += burnDmg;
            if (p.hp <= 0 && p.alive) {
              p.alive = false;
              this.combat.handleKill(this, thrower || p, p, { name: 'Molotov', type: 'grenade' }, false);
            }
          }
        }
      });
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

    // Check Clutch & Dynamic Hunt / Save moments
    this.tactics.updateClutchAndSaveTactics(this, dt);

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
      p.baseHoldAngle = p.targetAngle;
    }
  }

  applyTeammateSeparation(p, dt) {
    p.queueSlowdown = 1.0;
    const teammates = Object.values(this.players).filter(other => other.team === p.team && other.id !== p.id && other.alive);
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
        if (this.isWalkable(nx, ny) && !this.collision.isLineBlockedByWall(p.x, p.y, nx, ny)) {
          p.x = nx;
          p.y = ny;
        } else if (this.isWalkable(nx, p.y) && !this.collision.isLineBlockedByWall(p.x, p.y, nx, p.y)) {
          p.x = nx;
        } else if (this.isWalkable(p.x, ny) && !this.collision.isLineBlockedByWall(p.x, p.y, p.x, ny)) {
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
    // If the next waypoint along the path is already in direct clear line of sight,
    // round the corner smoothly without getting hung up on the intermediate node!
    if (!isFinalNode && p.pathIndex < p.path.length - 1) {
      const nextNodeKey = p.path[p.pathIndex + 1];
      const nextNode = this.mapData.nodes[nextNodeKey];
      if (nextNode && !this.collision.isLineBlockedByWall(p.x, p.y, nextNode.x, nextNode.y)) {
        const distToNext = Math.hypot(nextNode.x - p.x, nextNode.y - p.y);
        if (dist < 42 || distToNext < dist) {
          p.pathIndex++;
          this.tactics.tacticalBotUtility(this, p, targetNodeKey);
          return;
        }
      }
    }

    if (dist < arrivalRadius) {
      p.pathIndex++;
      if (p.pathIndex >= p.path.length) {
        if (this.bomb.dropped && !this.bomb.planted) {
          // If bomb is dropped on ground, keep crosshairs trained onto dropped bomb!
          p.holdTimer = 22.0;
          p.state = 'holding';
          p.targetAngle = Math.atan2(this.bomb.y - p.y, this.bomb.x - p.x);
          p.baseHoldAngle = p.targetAngle;
        } else if (p.team === 'ct' && !this.bomb.planted) {
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
      // PRO MOVEMENT VECTOR DECOUPLING:
      // Movement is guided 100% by the waypoint path (moveAngle).
      // Head/crosshair facing (p.targetAngle) tracks sounds/aim independently!
      // This completely ELIMINATES bots turning into walls when they hear a footstep or gunshot.
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

      // Flashdown retreat
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
        Object.values(this.players).forEach(other => {
          if (!other.alive || other.team === p.team) return;
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d <= 340 && !this.collision.isLineBlockedByWall(other.x, other.y, p.x, p.y)) {
            other.soundAlert = { x: p.x, y: p.y, time: now, isFootstep: true };
            if (!other.targetEnemyId && other.state === 'holding') {
              other.targetAngle = Math.atan2(p.y - other.y, p.x - other.x);
            }
          }
        });
        this.events.push({ type: 'footstep', x: p.x, y: p.y, team: p.team });
      }

      const stepDist = baseSpeed * dt;
      const nextX = p.x + Math.cos(moveAngle) * stepDist;
      const nextY = p.y + Math.sin(moveAngle) * stepDist;

      // STRICT PHYSICAL BARRIER with Intelligent Corner Deflection:
      if (this.isWalkable(nextX, nextY)) {
        p.x = nextX;
        p.y = nextY;
      } else {
        // Wall sliding along corridor axis with line-of-sight checks
        if (this.isWalkable(nextX, p.y) && !this.collision.isLineBlockedByWall(p.x, p.y, nextX, p.y)) {
          p.x = nextX;
        } else if (this.isWalkable(p.x, nextY) && !this.collision.isLineBlockedByWall(p.x, p.y, p.x, nextY)) {
          p.y = nextY;
        } else {
          // Attempt angle deflections (+30 deg, -30 deg, +60 deg, -60 deg, +85 deg, -85 deg)
          let deflected = false;
          for (const angleOffset of [0.52, -0.52, 1.05, -1.05, 1.48, -1.48]) {
            const defAngle = moveAngle + angleOffset;
            const defX = p.x + Math.cos(defAngle) * stepDist;
            const defY = p.y + Math.sin(defAngle) * stepDist;
            if (this.isWalkable(defX, defY) && !this.collision.isLineBlockedByWall(p.x, p.y, defX, defY)) {
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
              // Bot reached destination vicinity but was nudged against wall corner: complete path cleanly!
              p.pathIndex = p.path.length;
              p.holdTimer = 16.0;
              p.state = 'holding';
              this.ensureWalkable(p);
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

    // CS:GO / CS2 MR12 Overtime & Match Win Rules
    if (this.score.ct === 12 && this.score.t === 12 && !this.overtimeAnnounced) {
      this.overtimeAnnounced = true;
      this.addRadioMessage('ct', 'HAKEM', 'UZATMALAR BAŞLADI (OVERTIME)! İlk 16 puana ulaşan kazanır.');
      this.events.push({ type: 'overtime_start' });
      // Authentic CS overtime starting budget ($10,000 each)
      Object.values(this.players).forEach(p => {
        p.money = 10000;
      });
    }

    const winTarget = (this.score.ct >= 12 && this.score.t >= 12) ? 16 : 13;
    const isOvertime = this.score.ct >= 12 && this.score.t >= 12;

    let matchWinner = null;
    if (isOvertime) {
      if (this.score.ct >= 16 && this.score.ct - this.score.t >= 2) matchWinner = 'Counter-Terrorists';
      else if (this.score.t >= 16 && this.score.t - this.score.ct >= 2) matchWinner = 'Terrorists';
      else if (this.score.ct === 15 && this.score.t === 15) matchWinner = 'Beraberlik (Draw)';
    } else {
      if (this.score.ct >= 13) matchWinner = 'Counter-Terrorists';
      else if (this.score.t >= 13) matchWinner = 'Terrorists';
    }

    if (matchWinner) {
      this.phase = 'match_over';
      this.events.push({ type: 'match_over', winner: matchWinner });
      return;
    }

    this.startRound();
  }

  swapTeams() {
    const tempScore = this.score.ct;
    this.score.ct = this.score.t;
    this.score.t = tempScore;

    // Reset loss streaks for clean 2nd half start
    this.lossStreak = { ct: 0, t: 0 };

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
      currentRosters: this.currentRosters,
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
      fires: this.fires || [],
      killfeed: this.killfeed,
      radioMessages: this.radioMessages,
      droppedKits: this.droppedKits || [],
      events: this.events
    };

    this.io.emit('game_update', snapshot);
  }
}

module.exports = {
  PureCoachMatch
};
