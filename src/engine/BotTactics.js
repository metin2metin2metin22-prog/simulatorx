// SimulatorX - CS:GO Tactical Decision Engine, Coordinated Executions & Utility AI
const { getClosestNode } = require('../navigation/pathfinding');

class BotTactics {
  constructor(collisionSystem) {
    this.collision = collisionSystem;
  }

  // Active Terrorist Team Execution & Group Cohesion AI:
  // Ensures Terrorists execute together onto A, B, or Short without idling
  updateTerroristTactics(match, dt) {
    if (match.bomb.planted) return; // In post-plant defense, handled in alertCTRetake

    const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
    if (aliveTs.length === 0) return;

    const targetNode = match.tTargetSite === 'B' ? 'b_site' : 'a_site';

    // 1. If Bomb is Dropped on the ground, closest T rushes to retrieve it
    if (match.bomb.dropped && !match.bomb.carried) {
      let closestT = null;
      let minDist = Infinity;
      for (const t of aliveTs) {
        const d = Math.hypot(t.x - match.bomb.x, t.y - match.bomb.y);
        if (d < minDist) {
          minDist = d;
          closestT = t;
        }
      }
      if (closestT && !closestT.targetEnemyId) {
        const distToDroppedBomb = Math.hypot(closestT.x - match.bomb.x, closestT.y - match.bomb.y);
        if (distToDroppedBomb <= 80) {
          // Direct steering straight onto dropped bomb
          const angleToBomb = Math.atan2(match.bomb.y - closestT.y, match.bomb.x - closestT.x);
          closestT.targetAngle = angleToBomb;
          closestT.angle = angleToBomb;
          const step = 85 * dt;
          const nx = closestT.x + Math.cos(angleToBomb) * step;
          const ny = closestT.y + Math.sin(angleToBomb) * step;
          if (match.isWalkable(nx, ny)) {
            closestT.x = nx;
            closestT.y = ny;
          }
        } else {
          const bombNode = getClosestNode(match.bomb.x, match.bomb.y, match.mapData.nodes);
          if (!closestT.path || closestT.path.length === 0 || closestT.path[closestT.path.length - 1] !== bombNode) {
            match.setPlayerPath(closestT, bombNode);
          }
        }
      }

      // If another T is nearby, throw protective smoke onto the dropped bomb
      if (aliveTs.length > 1 && match.smokes.length < 3) {
        const coverT = aliveTs.find(t => t.id !== (closestT && closestT.id));
        if (coverT && Math.hypot(coverT.x - match.bomb.x, coverT.y - match.bomb.y) < 280) {
          if (!coverT.droppedBombSmoked) {
            coverT.droppedBombSmoked = true;
            this.throwSmoke(match, coverT, match.bomb.x, match.bomb.y);
            match.addRadioMessage('t', coverT.name, "Düşen bombaya smoke attım, güvenle al!");
          }
        }
      }
    }

    // 2. Coordinated Team Execute Call after 10-12 seconds of round start:
    // IGL issues all-out push command and all alive Ts flood the bombsite together
    if (match.timer <= 88 && !match.tExecuteCalled) {
      match.tExecuteCalled = true;
      match.addRadioMessage('t', 'electronic (IGL)', `${match.tTargetSite} Site'a TOPLU GİRİYORUZ! Giriş yapın ve bombayı kurun!`);
      aliveTs.forEach(t => {
        if (!t.targetEnemyId) {
          match.setPlayerPath(t, targetNode);
        }
      });
    }

    // 3. Strict Anti-Idle Protection:
    // If any T has completed their path or sits idle before plant, direct them into the bombsite!
    aliveTs.forEach(t => {
      if (!t.targetEnemyId && (t.state === 'idle' || !t.path || t.pathIndex >= t.path.length)) {
        const sitePos = match.mapData.sites[match.tTargetSite];
        const distToSite = Math.hypot(t.x - sitePos.x, t.y - sitePos.y);
        if (distToSite > sitePos.radius + 15) {
          match.setPlayerPath(t, targetNode);
        }
      }
    });
  }

  // Active Retake & Defuse Guidance: Runs every tick while the bomb is planted
  updateRetakeAndPostPlantTactics(match, dt) {
    if (!match.bomb.planted) return;

    const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);
    const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
    if (aliveCTs.length === 0) return;

    const bombNode = getClosestNode(match.bomb.x, match.bomb.y, match.mapData.nodes);

    // 1. If all Ts are dead, ALL CTs swarm the bomb immediately
    if (aliveTs.length === 0) {
      aliveCTs.forEach(ct => {
        if (!ct.targetEnemyId && ct.state !== 'defusing') {
          const distToBomb = Math.hypot(ct.x - match.bomb.x, ct.y - match.bomb.y);
          if (distToBomb > 35 && (!ct.path || ct.pathIndex >= ct.path.length || ct.path[ct.path.length - 1] !== bombNode)) {
            match.setPlayerPath(ct, bombNode);
          }
        }
      });
      return;
    }

    // 2. Identify the Primary Defuser (closest CT or one with kit)
    let bestDefuser = null;
    let minDist = Infinity;
    aliveCTs.forEach(ct => {
      let d = Math.hypot(ct.x - match.bomb.x, ct.y - match.bomb.y);
      if (ct.hasKit) d -= 60; // Kit priority
      if (d < minDist) {
        minDist = d;
        bestDefuser = ct;
      }
    });

    if (bestDefuser && !bestDefuser.targetEnemyId && bestDefuser.state !== 'defusing') {
      const distToBomb = Math.hypot(bestDefuser.x - match.bomb.x, bestDefuser.y - match.bomb.y);
      if (distToBomb <= 75 && distToBomb > 25) {
        // Direct steering onto planted bomb coordinates to begin defuse
        const angleToBomb = Math.atan2(match.bomb.y - bestDefuser.y, match.bomb.x - bestDefuser.x);
        bestDefuser.targetAngle = angleToBomb;
        bestDefuser.angle = angleToBomb;
        const step = 80 * dt;
        const nx = bestDefuser.x + Math.cos(angleToBomb) * step;
        const ny = bestDefuser.y + Math.sin(angleToBomb) * step;
        if (match.isWalkable(nx, ny)) {
          bestDefuser.x = nx;
          bestDefuser.y = ny;
        }
      } else if (distToBomb > 40 && (!bestDefuser.path || bestDefuser.pathIndex >= bestDefuser.path.length || bestDefuser.path[bestDefuser.path.length - 1] !== bombNode)) {
        match.setPlayerPath(bestDefuser, bombNode);
      }
    }

    // 3. Supporting CTs push onto site to cover
    aliveCTs.forEach(ct => {
      if (bestDefuser && ct.id === bestDefuser.id) return;
      if (!ct.targetEnemyId && (ct.state === 'idle' || !ct.path || ct.pathIndex >= ct.path.length)) {
        const siteNode = match.bomb.site === 'B' ? 'b_site' : 'a_site';
        const dSite = Math.hypot(ct.x - match.mapData.sites[match.bomb.site].x, ct.y - match.mapData.sites[match.bomb.site].y);
        if (dSite > 60) {
          match.setPlayerPath(ct, siteNode);
        }
      }
    });

    // 4. Terrorist Post-Plant Peeking: If CT is defusing, nearest T peeks bomb
    if (match.bomb.defusing && aliveTs.length > 0) {
      let nearestT = null;
      let minTDist = Infinity;
      aliveTs.forEach(t => {
        const d = Math.hypot(t.x - match.bomb.x, t.y - match.bomb.y);
        if (d < minTDist) {
          minTDist = d;
          nearestT = t;
        }
      });
      if (nearestT && minTDist < 380 && !nearestT.targetEnemyId) {
        nearestT.holdTimer = 0;
        nearestT.targetAngle = Math.atan2(match.bomb.y - nearestT.y, match.bomb.x - nearestT.x);
        if (minTDist > 60 && (!nearestT.path || nearestT.pathIndex >= nearestT.path.length)) {
          match.setPlayerPath(nearestT, bombNode);
        }
      }
    }
  }

  tacticalBotUtility(match, p, nodeKey) {
    if (match.smokes.length + match.grenades.length > 7) return;

    if (p.team === 't') {
      if (nodeKey === 'long_doors_t' && Math.random() < 0.75) {
        this.throwGrenade(match, p, 'flash', 760, 700);
      } else if (nodeKey === 'long_doors_exit' && Math.random() < 0.7) {
        this.throwGrenade(match, p, 'flash', 870, 550);
      } else if (nodeKey === 'long_street' && Math.random() < 0.7) {
        this.throwSmoke(match, p, 830, 240); // Smoke Long Cross
      } else if (nodeKey === 'catwalk_stairs' && Math.random() < 0.75) {
        this.throwGrenade(match, p, 'flash', 800, 200); // Flash A Site
      } else if (nodeKey === 'a_short' && Math.random() < 0.7) {
        this.throwSmoke(match, p, 760, 200); // Smoke CT Elevator
      } else if (nodeKey === 'upper_tunnels_stairs' && Math.random() < 0.8) {
        this.throwGrenade(match, p, 'flash', 210, 260);
      } else if (nodeKey === 'upper_tunnels_north' && Math.random() < 0.75) {
        this.throwGrenade(match, p, 'flash', 180, 200); // Flash B Platform
      } else if (nodeKey === 'b_tunnels_exit' && Math.random() < 0.7) {
        this.throwSmoke(match, p, 310, 180); // Smoke B Doors
      } else if (nodeKey === 'top_mid' && Math.random() < 0.6) {
        this.throwSmoke(match, p, 490, 390); // Smoke Mid Doors
      }
    } else if (p.team === 'ct') {
      if (nodeKey === 'ct_elevator' && Math.random() < 0.55) {
        this.throwSmoke(match, p, 830, 240); // Smoke Long Cross
      } else if (nodeKey === 'ct_short_stairs' && Math.random() < 0.55) {
        this.throwGrenade(match, p, 'flash', 670, 370); // Flash Catwalk Stairs
      } else if (nodeKey === 'b_doors_outside' && Math.random() < 0.6) {
        this.throwSmoke(match, p, 150, 300); // Smoke Tunnels Exit
      } else if (nodeKey === 'b_doors' && Math.random() < 0.55) {
        this.throwGrenade(match, p, 'flash', 180, 260); // Flash Tunnels
      }
    }
  }

  throwGrenade(match, player, type, targetX, targetY) {
    match.grenades.push({
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

  throwSmoke(match, player, targetX, targetY) {
    match.smokes.push({
      id: Math.random().toString(36).substr(2, 9),
      x: targetX,
      y: targetY,
      radius: 46,
      duration: 18,
      remainingTime: 18
    });
    match.events.push({ type: 'smoke_pop', x: targetX, y: targetY });
  }

  detonateGrenade(match, g) {
    if (g.type === 'flash') {
      match.events.push({ type: 'flash_pop', x: g.x, y: g.y });
      const thrower = match.players[g.throwerId];

      Object.values(match.players).forEach(p => {
        if (!p.alive) return;
        const dist = Math.hypot(p.x - g.x, p.y - g.y);
        if (dist < 260) {
          if (this.collision.isLineBlockedByWall(p.x, p.y, g.x, g.y)) return;
          const angleToFlash = Math.atan2(g.y - p.y, g.x - p.x);
          const angleDiff = Math.abs(this.collision.normalizeAngle(p.angle - angleToFlash));
          const isFacingFlash = (angleDiff < Math.PI / 2);
          const isTeammate = thrower && thrower.team === p.team;

          if (isFacingFlash) {
            const rawDuration = Math.min(3.5, 4.0 * (1 - dist / 260));
            p.flashDuration = isTeammate ? Math.min(1.2, rawDuration * 0.45) : rawDuration;
          } else {
            p.flashDuration = isTeammate ? 0.2 : 0.8;
          }
        }
      });
    } else if (g.type === 'he') {
      match.events.push({ type: 'he_pop', x: g.x, y: g.y });
      const thrower = match.players[g.throwerId];

      Object.values(match.players).forEach(p => {
        if (!p.alive) return;
        const dist = Math.hypot(p.x - g.x, p.y - g.y);
        if (dist < 180) {
          if (this.collision.isLineBlockedByWall(p.x, p.y, g.x, g.y)) return;
          const dmgRatio = 1 - (dist / 180);
          let blastDamage = Math.round(55 * dmgRatio);
          if (p.armor > 0) blastDamage = Math.round(blastDamage * 0.65);
          p.hp = Math.max(0, p.hp - blastDamage);
          if (thrower) thrower.damage += blastDamage;

          if (p.hp <= 0 && thrower) {
            match.combat.handleKill(match, thrower, p, { name: 'HE Grenade', type: 'grenade' }, false);
          }
        }
      });
    }
  }

  alertCTRetake(match, site) {
    match.addRadioMessage('ct', 'Twistzz (IGL)', `Bomba ${site} bölgesine kuruldu! Tüm takım Retake intikaline geçiyor!`);

    const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);

    if (site === 'A') {
      aliveCTs.forEach((ct, idx) => {
        let targetNode = 'a_site';
        if (idx === 0) targetNode = 'ct_elevator';
        else if (idx === 1) targetNode = 'a_short_site';
        else if (idx === 2) targetNode = 'long_cross';
        else targetNode = 'a_site';

        match.setPlayerPath(ct, targetNode);
      });
    } else {
      aliveCTs.forEach((ct, idx) => {
        const targetNode = idx % 2 === 0 ? 'b_doors' : 'b_window';
        match.setPlayerPath(ct, targetNode);
      });
    }

    // Terrorist Post-Plant Positioning
    const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
    match.addRadioMessage('t', 'electronic (IGL)', 'Bomba kuruldu! Crossfire açın ve açıları koruyun!');

    if (site === 'A') {
      const aSpots = ['long_pit', 'goose', 'a_ramp', 'a_short', 'a_site'];
      aliveTs.forEach((t, idx) => {
        const spot = aSpots[idx % aSpots.length];
        match.setPlayerPath(t, spot);
      });
    } else {
      const bSpots = ['b_platform', 'b_car', 'b_window', 'b_doors', 'b_site'];
      aliveTs.forEach((t, idx) => {
        const spot = bSpots[idx % bSpots.length];
        match.setPlayerPath(t, spot);
      });
    }
  }

  checkClutchSituation(match) {
    if (match.clutchAnnounced || match.phase !== 'live') return;
    const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);
    const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);

    if (aliveCTs.length === 1 && aliveTs.length >= 2) {
      match.clutchAnnounced = true;
      const clutcher = aliveCTs[0];
      match.addRadioMessage('ct', clutcher.name, `[CLUTCH] 1v${aliveTs.length} durumunda tek kaldım, sakin oynuyorum!`);
      match.events.push({ type: 'clutch', team: 'ct', player: clutcher.name, count: aliveTs.length });
    } else if (aliveTs.length === 1 && aliveCTs.length >= 2) {
      match.clutchAnnounced = true;
      const clutcher = aliveTs[0];
      match.addRadioMessage('t', clutcher.name, `[CLUTCH] 1v${aliveCTs.length} durumunda tek kaldım, site'a sızıyorum!`);
      match.events.push({ type: 'clutch', team: 't', player: clutcher.name, count: aliveCTs.length });
    }
  }
}

module.exports = {
  BotTactics
};
