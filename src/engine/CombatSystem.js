// SimulatorX - CS:GO Combat, Line-of-Sight & Ballistics Resolution System
// Pure Skill-Based Combat: Outcomed by Aim, Reflex, Game Sense, and Clutch attributes.
const { WEAPONS } = require('../config/weapons');
const { getClosestNode } = require('../navigation/pathfinding');

class CombatSystem {
  constructor(collisionSystem) {
    this.collision = collisionSystem;
  }

  canSeeEnemy(shooter, enemy, smokes) {
    const dist = Math.hypot(enemy.x - shooter.x, enemy.y - shooter.y);
    const weapon = WEAPONS[shooter.weapon] || WEAPONS.ak47;
    if (dist > weapon.maxRange) return false;

    const angleToEnemy = Math.atan2(enemy.y - shooter.y, enemy.x - shooter.x);
    const angleDiff = Math.abs(this.collision.normalizeAngle(shooter.angle - angleToEnemy));
    if (dist > 48 && angleDiff > 0.72) return false;

    // In CS:GO, point-blank contact (<40 units) inside smoke is visible
    if (dist > 40 && this.collision.isLineBlockedBySmoke(smokes, shooter.x, shooter.y, enemy.x, enemy.y)) return false;
    if (this.collision.isLineBlockedByWall(shooter.x, shooter.y, enemy.x, enemy.y)) return false;
    return true;
  }

  updateCombat(match, dt) {
    const players = Object.values(match.players).filter(p => p.alive);
    const now = Date.now();

    players.forEach(p => {
      if (p.burstPauseTimer > 0) p.burstPauseTimer -= dt;

      const enemies = players.filter(e => e.team !== p.team);
      let bestTarget = null;
      let closestDist = Infinity;

      if (p.tradeTargetId && match.players[p.tradeTargetId] && match.players[p.tradeTargetId].alive) {
        const tradeEnemy = match.players[p.tradeTargetId];
        if (this.canSeeEnemy(p, tradeEnemy, match.smokes)) {
          bestTarget = tradeEnemy;
          closestDist = Math.hypot(tradeEnemy.x - p.x, tradeEnemy.y - p.y);
        }
      }

      if (!bestTarget) {
        for (const enemy of enemies) {
          if (this.canSeeEnemy(p, enemy, match.smokes)) {
            const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            if (dist < closestDist) {
              closestDist = dist;
              bestTarget = enemy;
            }
          }
        }
      }

      if (bestTarget) {
        // Immediately face the spotted target
        p.targetAngle = Math.atan2(bestTarget.y - p.y, bestTarget.x - p.x);

        if (p.targetEnemyId !== bestTarget.id) {
          p.targetEnemyId = bestTarget.id;

          // Pure Skill-Based Reaction Time:
          // Player's Reflex attribute directly dictates reaction latency (e.g. 100 reflex -> ~130ms; 90 reflex -> ~200ms)
          const reflex = (p.skills && p.skills.reflex) || 94;
          const baseReaction = 0.27 - (reflex / 100) * 0.14 + (Math.random() * 0.02);
          p.reactionTimer = Math.max(0.10, baseReaction);
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
          this.resolveProShot(match, p, bestTarget, weapon, closestDist);
        }
      } else {
        p.targetEnemyId = null;
        p.burstCount = 0;
      }
    });
  }

  resolveProShot(match, shooter, target, weapon, dist) {
    shooter.burstCount = (shooter.burstCount || 0) + 1;

    let burstAccuracy = 1.0;
    if (shooter.burstCount === 1) burstAccuracy = 0.96;
    else if (shooter.burstCount === 2) burstAccuracy = 0.88;
    else if (shooter.burstCount === 3) burstAccuracy = 0.74;
    else burstAccuracy = 0.42;

    const distFactor = Math.max(0.4, 1.0 - (dist / weapon.maxRange) * 0.45);

    // Skill-based modifiers:
    const aim = (shooter.skills && shooter.skills.aim) || 94;
    const gamesense = (shooter.skills && shooter.skills.gamesense) || 94;
    const clutch = (shooter.skills && shooter.skills.clutch) || 94;

    const aimBonus = (aim - 90) * 0.015;
    const gamesenseBonus = (gamesense - 90) * 0.008;

    // Check for 1vX clutch situation
    const aliveAllies = Object.values(match.players).filter(p => p.team === shooter.team && p.alive).length;
    const aliveEnemies = Object.values(match.players).filter(p => p.team !== shooter.team && p.alive).length;
    const isClutching = (aliveAllies === 1 && aliveEnemies >= 1);
    const clutchBonus = isClutching ? ((clutch - 90) * 0.012) : 0;

    const movingPenalty = (shooter.state === 'moving' && weapon.type !== 'pistol') ? -0.16 : 0;
    const holdBonus = (shooter.state === 'holding') ? 0.06 : 0;
    const stationaryTargetBonus = (target.state === 'planting' || target.state === 'defusing') ? 0.12 : 0;

    // Crosshair alignment check: If shooter's angle has not settled onto target yet (<0.15 rad ~8 deg), apply flick penalty
    const angleToTarget = Math.atan2(target.y - shooter.y, target.x - shooter.x);
    const aimSettlingDiff = Math.abs(this.collision.normalizeAngle(shooter.angle - angleToTarget));
    const flickPenalty = aimSettlingDiff > 0.18 ? -0.22 : 0;

    let totalHitChance = (weapon.accuracy * distFactor * burstAccuracy)
      + aimBonus + gamesenseBonus + clutchBonus + movingPenalty + holdBonus + stationaryTargetBonus + flickPenalty;

    if (shooter.flashDuration > 0.3) {
      totalHitChance *= 0.25; // Blind panic-spray penalty
    }

    const isHit = Math.random() < totalHitChance;
    let isHeadshot = false;
    let damage = 0;

    if (isHit) {
      // Headshot probability is determined by shooter's Aim skill (e.g. NiKo 99, b1t 97)
      const hsSkillFactor = (aim / 100) * 0.30;
      const baseHsChance = weapon.name === 'AWP' ? 0.12 : (shooter.burstCount === 1 ? (0.25 + hsSkillFactor) : (0.12 + hsSkillFactor * 0.5));
      isHeadshot = Math.random() < baseHsChance;

      damage = weapon.damage * (isHeadshot ? weapon.hsMult : 1.0);
      if (target.armor > 0 && !isHeadshot && weapon.type !== 'sniper') {
        damage = damage * 0.72;
        target.armor = Math.max(0, target.armor - 12);
      }

      damage = Math.round(damage);
      target.hp = Math.max(0, target.hp - damage);
      shooter.damage += damage;

      // Track damage history for assists
      target.damageHistory = target.damageHistory || {};
      target.damageHistory[shooter.id] = (target.damageHistory[shooter.id] || 0) + damage;

      // PRO AI REACTION: Victim flinches, breaks idle/hold, and immediately returns fire towards the shooter!
      if (target.alive && target.hp > 0) {
        target.holdTimer = 0;
        target.targetAngle = Math.atan2(shooter.y - target.y, shooter.x - target.x);
        target.soundAlert = { x: shooter.x, y: shooter.y, time: Date.now() };

        if (!target.targetEnemyId || target.targetEnemyId !== shooter.id) {
          target.targetEnemyId = shooter.id;
          const reflex = (target.skills && target.skills.reflex) || 94;
          target.reactionTimer = Math.max(0.08, 0.20 - (reflex / 100) * 0.11);
        }
      }

      match.events.push({
        type: isHeadshot ? 'headshot' : 'hit',
        shooterId: shooter.id,
        targetId: target.id,
        damage,
        isHeadshot
      });

      if (target.hp <= 0) {
        this.handleKill(match, shooter, target, weapon, isHeadshot);
      }
    }

    if (weapon.type === 'rifle' && shooter.burstCount >= 3) {
      shooter.burstCount = 0;
      shooter.burstPauseTimer = 0.26;
    } else if (weapon.type === 'sniper') {
      shooter.burstPauseTimer = 1.35;
    }

    if (!weapon.silenced) {
      this.broadcastSoundAlert(match, shooter.x, shooter.y, 450);
    }

    match.events.push({
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

  broadcastSoundAlert(match, x, y, radius) {
    const now = Date.now();
    Object.values(match.players).forEach(p => {
      if (!p.alive || p.targetEnemyId) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius) {
        p.soundAlert = { x, y, time: now };
      }
    });
  }

  handleKill(match, killer, victim, weapon, isHeadshot) {
    victim.alive = false;
    victim.state = 'dead';
    victim.deaths++;

    killer.kills++;
    killer.money += (weapon.type === 'sniper' ? 100 : 300);

    // Official CS:GO Assist System: Teammate dealing >= 41 damage gets assist
    let assister = null;
    if (victim.damageHistory) {
      for (const [shooterId, dmg] of Object.entries(victim.damageHistory)) {
        if (shooterId !== killer.id && dmg >= 41) {
          const potAssister = match.players[shooterId];
          if (potAssister && potAssister.team === killer.team) {
            potAssister.assists = (potAssister.assists || 0) + 1;
            assister = potAssister;
            break;
          }
        }
      }
    }

    Object.values(match.players).filter(p => p.team === victim.team && p.alive).forEach(mate => {
      const dist = Math.hypot(mate.x - victim.x, mate.y - victim.y);
      if (dist < 320) {
        mate.tradeTargetId = killer.id;
        mate.soundAlert = { x: killer.x, y: killer.y, time: Date.now() };
        mate.holdTimer = 0;
      }
    });

    // Determine zone of casualty
    let zone = 'Mid';
    const distA = Math.hypot(victim.x - match.mapData.sites.A.x, victim.y - match.mapData.sites.A.y);
    const distB = Math.hypot(victim.x - match.mapData.sites.B.x, victim.y - match.mapData.sites.B.y);
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
      match.addRadioMessage('ct', victim.name, `${victim.name} düştü! [${zone}] bölgesinde düşman var!`);

      // Dynamic rotation response if bomb is NOT yet planted
      if (!match.bomb.planted) {
        const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);

        if (zone === 'A Site' || zone === 'Long A') {
          // Mid CT rotates to A
          const midCT = aliveCTs.find(p => p.slot === 2);
          if (midCT) {
            match.setPlayerPath(midCT, 'a_short_site');
            match.addRadioMessage('ct', midCT.name, "A'ya desteğe geçiyorum!");
          }

          // If only 1 or 0 CTs left defending A, 1 B CT rotates through CT Spawn
          const ctAtA = aliveCTs.filter(p => p.x > 680 && p.y < 350).length;
          if (ctAtA <= 1) {
            const bCT = aliveCTs.find(p => p.x < 460);
            if (bCT) {
              match.setPlayerPath(bCT, 'a_site');
              match.addRadioMessage('ct', bCT.name, "B'den A'ya rotasyon yapıyorum, site'a tutunun!");
            }
          }

          // Terrorists exploit opening at A
          if (match.tTargetSite !== 'A') {
            match.tTargetSite = 'A';
            match.addRadioMessage('t', 'electronic (IGL)', "A savunması kırıldı! A Site açık, tüm takım A'ya yüklenin!");
            const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
            aliveTs.forEach(t => {
              if (!t.targetEnemyId) match.setPlayerPath(t, 'a_site');
            });
          }
        } else if (zone === 'B Site') {
          // Mid CT rotates to B
          const midCT = aliveCTs.find(p => p.slot === 2);
          if (midCT) {
            match.setPlayerPath(midCT, 'b_doors_outside');
            match.addRadioMessage('ct', midCT.name, "B'ye desteğe geliyorum!");
          }

          // If B is in danger, 1 A CT rotates to B
          const ctAtB = aliveCTs.filter(p => p.x < 400).length;
          if (ctAtB <= 1) {
            const aCT = aliveCTs.find(p => p.x > 650);
            if (aCT) {
              match.setPlayerPath(aCT, 'b_site');
              match.addRadioMessage('ct', aCT.name, "A'dan B'ye CT Spawn üzerinden intikal ediyorum!");
            }
          }

          // Terrorists exploit opening at B
          if (match.tTargetSite !== 'B') {
            match.tTargetSite = 'B';
            match.addRadioMessage('t', 'electronic (IGL)', "B savunması kırıldı! B Site açık, toplu hücum!");
            const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
            aliveTs.forEach(t => {
              if (!t.targetEnemyId) match.setPlayerPath(t, 'b_site');
            });
          }
        }
      }
    } else {
      // Terrorist killed
      const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
      aliveTs.forEach(mate => {
        mate.tradeTargetId = killer.id;
        mate.soundAlert = { x: killer.x, y: killer.y, time: Date.now() };
        mate.holdTimer = 0;
      });

      if (victim.hasBomb && !match.bomb.planted) {
        victim.hasBomb = false;
        match.bomb.dropped = true;
        match.bomb.carried = false;
        match.bomb.carrierId = null;
        match.bomb.x = victim.x;
        match.bomb.y = victim.y;
        match.events.push({ type: 'bomb_dropped', x: victim.x, y: victim.y });
        match.addRadioMessage('t', 'electronic (IGL)', "BOMBA DÜŞTÜ! C4'ü geri alın, site'a ilerleyin!");

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
          const bombNode = getClosestNode(victim.x, victim.y, match.mapData.nodes);
          match.setPlayerPath(closestT, bombNode);
        }
      }
    }

    match.killfeed.unshift({
      killer: killer.name,
      victim: victim.name,
      assister: assister ? assister.name : null,
      weapon: killer.weapon,
      headshot: isHeadshot,
      teamKiller: killer.team,
      teamVictim: victim.team,
      time: Date.now()
    });

    if (match.killfeed.length > 6) {
      match.killfeed.pop();
    }

    match.events.push({
      type: 'kill',
      killerName: killer.name,
      victimName: victim.name,
      weapon: killer.weapon,
      isHeadshot
    });
  }
}

module.exports = {
  CombatSystem
};
