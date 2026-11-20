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

  determineSiteZone(x, y) {
    if (x < 380 || (x < 420 && y < 350)) {
      return 'B';
    } else if (x > 700 || (x >= 530 && y < 460)) {
      return 'A';
    } else {
      return 'Mid';
    }
  }

  // Pre-Plant Tactical Communication & Dynamic CT Rotations:
  // Active every tick before bomb is planted. When bomb carrier or multiple Ts are spotted,
  // CTs actively shout over radio ("BOMBA B'DE / A'DA! Acil desteğe gelin!") and rotate!
  updateCTPrePlantTactics(match, dt) {
    if (match.bomb.planted || match.phase !== 'live') return;

    if (!match.ctBombIntel) {
      match.ctBombIntel = { spotted: false, site: null, lastSpottedTime: 0, x: 0, y: 0, spotterName: null, isDropped: false };
    }
    if (!match.ctRushIntel) {
      match.ctRushIntel = { detected: false, site: null, lastCallTime: 0, count: 0 };
    }

    const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);
    const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
    if (aliveCTs.length === 0 || aliveTs.length === 0) return;

    const now = Date.now();

    // 1. Check if ANY CT sees the Bomb Carrier
    if (!match.bomb.dropped && match.bomb.carrierId) {
      const carrier = match.players[match.bomb.carrierId];
      if (carrier && carrier.alive) {
        let spotterCT = null;
        for (const ct of aliveCTs) {
          if (match.combat && match.combat.canSeeEnemy(ct, carrier, match.smokes)) {
            spotterCT = ct;
            break;
          }
        }

        if (spotterCT) {
          const zone = this.determineSiteZone(carrier.x, carrier.y);
          const isFreshSpot = !match.ctBombIntel.spotted || match.ctBombIntel.site !== zone || (now - match.ctBombIntel.lastSpottedTime > 9000);

          if (isFreshSpot) {
            match.ctBombIntel = {
              spotted: true,
              site: zone,
              lastSpottedTime: now,
              x: carrier.x,
              y: carrier.y,
              spotterName: spotterCT.name,
              isDropped: false
            };

            // Authentic Pro CS:GO Turkish Radio Callouts
            if (zone === 'B') {
              match.addRadioMessage('ct', spotterCT.name, "BOMBA B'DE! Taşıyıcıyı gördüm, B Site'a acil desteğe gelin!");
            } else if (zone === 'A') {
              match.addRadioMessage('ct', spotterCT.name, "BOMBA A'DA! Long ve Short'tan A'ya yükleniyorlar, desteğe gelin!");
            } else {
              match.addRadioMessage('ct', spotterCT.name, "BOMBA MID'DE! Taşıyıcı Mid'den geçiyor, dikkat edin!");
            }

            match.events.push({
              type: 'bomb_spotted',
              site: zone,
              x: carrier.x,
              y: carrier.y,
              spotter: spotterCT.name,
              carrier: carrier.name,
              isDropped: false
            });

            this.executeCTPrePlantRotation(match, zone, spotterCT);
          }
        }
      }
    }

    // 2. Check if ANY CT sees the Dropped Bomb on the ground
    if (match.bomb.dropped && !match.bomb.carried && !match.bomb.planted) {
      for (const ct of aliveCTs) {
        const dist = Math.hypot(ct.x - match.bomb.x, ct.y - match.bomb.y);
        if (dist < 480 && !this.collision.isLineBlockedByWall(ct.x, ct.y, match.bomb.x, match.bomb.y)) {
          const zone = this.determineSiteZone(match.bomb.x, match.bomb.y);
          const isFreshDropSpot = !match.ctBombIntel.isDropped || (now - match.ctBombIntel.lastSpottedTime > 9000);

          if (isFreshDropSpot) {
            match.ctBombIntel = {
              spotted: true,
              site: zone,
              lastSpottedTime: now,
              x: match.bomb.x,
              y: match.bomb.y,
              spotterName: ct.name,
              isDropped: true
            };

            match.addRadioMessage('ct', ct.name, `BOMBA DÜŞTÜ! Bomba [${zone}] bölgesinde yerde! Bombayı tutun, almalarına izin vermeyin!`);
            match.events.push({
              type: 'bomb_spotted',
              site: zone,
              x: match.bomb.x,
              y: match.bomb.y,
              spotter: ct.name,
              isDropped: true
            });

            // Reposition CTs to guard the dropped bomb
            const bombNode = getClosestNode(match.bomb.x, match.bomb.y, match.mapData.nodes);
            aliveCTs.forEach(mate => {
              if (!mate.targetEnemyId) {
                const d = Math.hypot(mate.x - match.bomb.x, mate.y - match.bomb.y);
                if (d > 160) {
                  match.setPlayerPath(mate, bombNode);
                }
              }
            });
          }
          break;
        }
      }
    }

    // 3. Multi-Enemy Push / Rush Detection (Even if carrier is behind)
    if (!match.ctBombIntel.spotted || (now - match.ctBombIntel.lastSpottedTime > 12000)) {
      aliveCTs.forEach(ct => {
        let seenEnemies = 0;
        aliveTs.forEach(t => {
          if (match.combat && match.combat.canSeeEnemy(ct, t, match.smokes)) {
            seenEnemies++;
          }
        });

        if (seenEnemies >= 2 && (now - match.ctRushIntel.lastCallTime > 10000)) {
          const ctZone = this.determineSiteZone(ct.x, ct.y);
          if (ctZone === 'B' || ctZone === 'A') {
            match.ctRushIntel = {
              detected: true,
              site: ctZone,
              lastCallTime: now,
              count: seenEnemies
            };

            if (ctZone === 'B') {
              match.addRadioMessage('ct', ct.name, `B'YE RUSH GELİYOR! En az ${seenEnemies} kişi var, acil destek lazım!`);
            } else {
              match.addRadioMessage('ct', ct.name, `A'YA RUSH GELİYOR! Long ve Short basıyorlar, desteğe gelin!`);
            }

            match.events.push({
              type: 'rush_detected',
              site: ctZone,
              spotter: ct.name,
              count: seenEnemies
            });

            this.executeCTPrePlantRotation(match, ctZone, ct);
          }
        }
      });
    }
  }

  // Coordinated Pre-Plant Rotation Execution
  executeCTPrePlantRotation(match, targetZone, spotter) {
    const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);
    if (aliveCTs.length <= 1) return;

    if (targetZone === 'B') {
      // 1. Mid CT rotates to B immediately
      const midCT = aliveCTs.find(p => (p.slot === 2 || (p.x >= 420 && p.x <= 640 && p.y >= 220)) && p.id !== spotter.id);
      if (midCT && !midCT.targetEnemyId) {
        match.setPlayerPath(midCT, 'b_doors_outside');
        match.addRadioMessage('ct', midCT.name, "B'ye desteğe koşuyorum, dayanın!");
      }

      // 2. A CTs: If 2 alive at A, 1 rotates through CT Spawn to B, leaving 1 anchor
      const aCTs = aliveCTs.filter(p => p.x > 640 && p.id !== spotter.id);
      if (aCTs.length >= 2) {
        aCTs.sort((a, b) => Math.hypot(a.x - 635, a.y - 215) - Math.hypot(b.x - 635, b.y - 215));
        const rotatingA = aCTs[0];
        if (!rotatingA.targetEnemyId) {
          match.setPlayerPath(rotatingA, 'b_doors_outside');
          match.addRadioMessage('ct', rotatingA.name, "A'dan B'ye CT Spawn üzerinden intikal ediyorum!");
        }
      }
    } else if (targetZone === 'A') {
      // 1. Mid CT rotates to A immediately
      const midCT = aliveCTs.find(p => (p.slot === 2 || (p.x >= 420 && p.x <= 640 && p.y >= 220)) && p.id !== spotter.id);
      if (midCT && !midCT.targetEnemyId) {
        match.setPlayerPath(midCT, 'a_short_site');
        match.addRadioMessage('ct', midCT.name, "A'ya desteğe koşuyorum, tutunun!");
      }

      // 2. B CTs: If 2 alive at B, 1 rotates through CT Ramp -> CT Spawn to A, leaving 1 B anchor
      const bCTs = aliveCTs.filter(p => p.x < 420 && p.id !== spotter.id);
      if (bCTs.length >= 2) {
        bCTs.sort((a, b) => Math.hypot(a.x - 350, a.y - 240) - Math.hypot(b.x - 350, b.y - 240));
        const rotatingB = bCTs[0];
        if (!rotatingB.targetEnemyId) {
          match.setPlayerPath(rotatingB, 'a_site');
          match.addRadioMessage('ct', rotatingB.name, "B'den A'ya rotasyon yapıyorum, geldim!");
        }
      }
    }
  }

  // Active Retake & Defuse Guidance: Runs every tick while the bomb is planted
  updateRetakeAndPostPlantTactics(match, dt) {
    if (!match.bomb.planted) return;

    const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);
    const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
    if (aliveCTs.length === 0) return;

    const bombNode = getClosestNode(match.bomb.x, match.bomb.y, match.mapData.nodes);

    // 1. Identify the Primary Defuser (already defusing, or closest CT / one with kit)
    let bestDefuser = aliveCTs.find(ct => ct.state === 'defusing');
    if (!bestDefuser) {
      let minDist = Infinity;
      aliveCTs.forEach(ct => {
        let d = Math.hypot(ct.x - match.bomb.x, ct.y - match.bomb.y);
        if (ct.hasKit) d -= 60; // Kit priority
        if (d < minDist) {
          minDist = d;
          bestDefuser = ct;
        }
      });
    }

    // 2. Defuser physical steering straight onto bomb coordinates
    if (bestDefuser && bestDefuser.state !== 'defusing') {
      const distToBomb = Math.hypot(bestDefuser.x - match.bomb.x, bestDefuser.y - match.bomb.y);
      if (distToBomb <= 95) {
        // Direct physical steering straight onto planted bomb coordinates
        const angleToBomb = Math.atan2(match.bomb.y - bestDefuser.y, match.bomb.x - bestDefuser.x);
        bestDefuser.targetAngle = angleToBomb;
        bestDefuser.angle = angleToBomb;
        const step = 85 * dt;
        const nx = bestDefuser.x + Math.cos(angleToBomb) * step;
        const ny = bestDefuser.y + Math.sin(angleToBomb) * step;
        if (match.isWalkable(nx, ny)) {
          bestDefuser.x = nx;
          bestDefuser.y = ny;
        } else if (match.isWalkable(nx, bestDefuser.y)) {
          bestDefuser.x = nx;
        } else if (match.isWalkable(bestDefuser.x, ny)) {
          bestDefuser.y = ny;
        }
      } else if (!bestDefuser.path || bestDefuser.pathIndex >= bestDefuser.path.length || bestDefuser.path[bestDefuser.path.length - 1] !== bombNode) {
        match.setPlayerPath(bestDefuser, bombNode);
      }
    }

    // 3. Supporting CTs Movement (Swarm and Defend)
    aliveCTs.forEach(ct => {
      if (bestDefuser && ct.id === bestDefuser.id) return;
      if (ct.targetEnemyId) return;

      const distToBomb = Math.hypot(ct.x - match.bomb.x, ct.y - match.bomb.y);

      if (aliveTs.length === 0) {
        // All Ts dead -> swarm right to the bomb
        if (distToBomb > 50 && (!ct.path || ct.pathIndex >= ct.path.length || ct.path[ct.path.length - 1] !== bombNode)) {
          match.setPlayerPath(ct, bombNode);
        }
      } else {
        // Ts alive -> establish defensive hold around the bombsite
        if (ct.state === 'idle' || !ct.path || ct.pathIndex >= ct.path.length) {
          const siteKey = (match.bomb.site === 'B' || match.bomb.site === 'A') ? match.bomb.site : (match.bomb.x < 500 ? 'B' : 'A');
          const siteData = match.mapData.sites[siteKey] || match.mapData.sites.A;
          const siteNode = siteKey === 'B' ? 'b_site' : 'a_site';
          const dSite = Math.hypot(ct.x - siteData.x, ct.y - siteData.y);
          if (dSite > 65) {
            match.setPlayerPath(ct, siteNode);
          }
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
      if (nearestT && minTDist < 420 && !nearestT.targetEnemyId) {
        nearestT.holdTimer = 0;
        nearestT.targetAngle = Math.atan2(match.bomb.y - nearestT.y, match.bomb.x - nearestT.x);
        if (minTDist > 55 && (!nearestT.path || nearestT.pathIndex >= nearestT.path.length)) {
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
      const aSpots = ['a_site', 'goose', 'a_ramp', 'ct_elevator', 'a_short_site'];
      aliveTs.forEach((t, idx) => {
        const spot = aSpots[idx % aSpots.length];
        match.setPlayerPath(t, spot);
      });
    } else {
      const bSpots = ['b_platform', 'b_site', 'b_back_site', 'b_car', 'b_cross_hall'];
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
