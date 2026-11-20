// SimulatorX - CS:GO Combat, Line-of-Sight & Ballistics Resolution System
// Pure Skill-Based Combat: Outcomed by Aim, Reflex, Game Sense, and Clutch attributes.
const { WEAPONS } = require('../config/weapons');
const { getClosestNode } = require('../navigation/pathfinding');

class CombatSystem {
  constructor(collisionSystem) {
    this.collision = collisionSystem;
  }

  isCoverPosition(x, y, match) {
    if (!match || !match.mapData || !match.mapData.nodes) return false;
    const COVER_KEYS = [
      'goose', 'b_car', 'b_platform', 'b_back_site', 'b_doors', 'b_window',
      'ct_elevator', 'a_ramp', 'long_car', 'long_pit', 'xbox', 'b_site', 'a_site', 'a_short_site'
    ];
    for (const key of COVER_KEYS) {
      const node = match.mapData.nodes[key];
      if (node && Math.hypot(node.x - x, node.y - y) <= 55) {
        return true;
      }
    }
    return false;
  }

  canSeeEnemy(shooter, enemy, smokes) {
    const dist = Math.hypot(enemy.x - shooter.x, enemy.y - shooter.y);
    const weapon = WEAPONS[shooter.weapon] || WEAPONS.ak47;
    if (dist > weapon.maxRange) return false;

    const angleToEnemy = Math.atan2(enemy.y - shooter.y, enemy.x - shooter.x);
    const angleDiff = Math.abs(this.collision.normalizeAngle(shooter.angle - angleToEnemy));

    // Realistic human visual cone (~94 degrees FOV). If point-blank (<28 units), allow peripheral up to 1.35 rad.
    // Under NO circumstances can a player see an enemy behind their back (angleDiff > 1.4) without turning!
    const maxFov = dist < 28 ? 1.35 : 0.82;
    if (angleDiff > maxFov) return false;

    // Point-blank contact (<36 units) inside smoke is visible
    if (dist > 36 && this.collision.isLineBlockedBySmoke(smokes, shooter.x, shooter.y, enemy.x, enemy.y)) return false;
    if (this.collision.isLineBlockedByWall(shooter.x, shooter.y, enemy.x, enemy.y)) return false;
    return true;
  }

  updateCombat(match, dt) {
    const players = Object.values(match.players).filter(p => p.alive);
    const now = Date.now();

    players.forEach(p => {
      if (!p.alive) return; // Dead player in current frame cannot act
      if (p.burstPauseTimer > 0) p.burstPauseTimer -= dt;

      // Smoke push tracking (First-out delay)
      const insideAnySmoke = (match.smokes || []).some(s => Math.hypot(p.x - s.x, p.y - s.y) <= s.radius);
      if (insideAnySmoke) {
        p.smokeExitTimer = 0.32;
      } else if (p.smokeExitTimer > 0) {
        p.smokeExitTimer -= dt;
      }

      const enemies = Object.values(match.players).filter(e => e.team !== p.team && e.alive);

      // Handle Reloading Logic
      if (p.isReloading) {
        // If ambushed point-blank (< 110 units) while reloading, cancel reload and draw backup pistol!
        const closeEnemy = enemies.find(e => Math.hypot(e.x - p.x, e.y - p.y) < 110 && this.canSeeEnemy(p, e, match.smokes));
        if (closeEnemy && (p.weapon === 'ak47' || p.weapon === 'm4a1' || p.weapon === 'm4a4' || p.weapon === 'awp')) {
          p.isReloading = false;
          p.weapon = p.team === 'ct' ? 'usp' : 'glock';
          p.ammo = 12;
          p.reserveAmmo = 24;
          match.addRadioMessage(p.team, p.name, "Şarjör değiştirirken yakalandım, acil tabancaya geçtim!");
        } else {
          p.reloadTimer -= dt;
          if (p.reloadTimer <= 0) {
            p.isReloading = false;
            const currentW = WEAPONS[p.weapon] || WEAPONS.ak47;
            const clip = currentW.clipSize || 30;
            const needed = clip - (p.ammo || 0);
            const reserve = p.reserveAmmo !== undefined ? p.reserveAmmo : 90;
            const added = Math.min(needed, reserve);
            p.ammo = (p.ammo || 0) + added;
            p.reserveAmmo = Math.max(0, reserve - added);
            match.events.push({ type: 'reload_end', playerId: p.id, weapon: p.weapon });
          }
          return; // Cannot shoot while reloading!
        }
      }

      // PRO CS:GO RULE: Players CANNOT shoot while actively defusing or planting!
      if (p.state === 'planting') {
        const visibleEnemy = enemies.find(e => this.canSeeEnemy(p, e, match.smokes));
        if (visibleEnemy && match.bomb.plantProgress < 0.65) {
          // Cancel plant to fight!
          p.state = 'idle';
          match.bomb.plantProgress = 0;
          p.plantProgress = 0;
          p.plantingAnnounced = false;
        } else {
          // Stick the plant, cannot shoot!
          return;
        }
      }

      if (p.state === 'defusing') {
        const visibleEnemy = enemies.find(e => this.canSeeEnemy(p, e, match.smokes));
        const isCriticalTime = match.bomb.timer <= (p.hasKit ? 5.2 : 10.2);
        if (visibleEnemy && !isCriticalTime && (match.bomb.defuseProgress || 0) < 0.70) {
          // Fake Defuse! Let go of defuse and turn to engage!
          p.state = 'idle';
          match.bomb.defusing = false;
          match.bomb.defuserId = null;
          match.bomb.defuseProgress = 0;
          p.defusingAnnounced = false;
          match.events.push({ type: 'fake_defuse', playerId: p.id, defuserName: p.name });
          match.addRadioMessage('ct', p.name, 'Fake defuse yaptım, çıkmasını bekliyorum!');
        } else {
          // Stick the defuse! Cannot shoot while defusing!
          return;
        }
      }

      let bestTarget = null;
      let closestDist = Infinity;

      // 1. Immediate Point-Blank Threat Priority (< 105 units):
      // Even if tradeTargetId is set elsewhere, a point-blank attacker takes top priority (fixes tunnel vision!)
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (d < 105 && this.canSeeEnemy(p, enemy, match.smokes)) {
          if (d < closestDist) {
            closestDist = d;
            bestTarget = enemy;
          }
        }
      }

      // 2. Trade target priority (avenging a teammate kill)
      if (!bestTarget && p.tradeTargetId && match.players[p.tradeTargetId] && match.players[p.tradeTargetId].alive) {
        const tradeEnemy = match.players[p.tradeTargetId];
        if (this.canSeeEnemy(p, tradeEnemy, match.smokes)) {
          bestTarget = tradeEnemy;
          closestDist = Math.hypot(tradeEnemy.x - p.x, tradeEnemy.y - p.y);
        }
      }

      // 3. Target stickiness: commit to ongoing duel to prevent crosshair dithering / twitching
      if (!bestTarget && p.targetEnemyId && match.players[p.targetEnemyId] && match.players[p.targetEnemyId].alive) {
        const currentTarget = match.players[p.targetEnemyId];
        if (this.canSeeEnemy(p, currentTarget, match.smokes)) {
          bestTarget = currentTarget;
          closestDist = Math.hypot(currentTarget.x - p.x, currentTarget.y - p.y);
        }
      }

      // 4. Scan visible enemies and lock nearest
      if (!bestTarget) {
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          if (this.canSeeEnemy(p, enemy, match.smokes)) {
            const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            if (dist < closestDist) {
              closestDist = dist;
              bestTarget = enemy;
            }
          }
        }
      }

      if (bestTarget && bestTarget.alive) {
        // Immediately face the spotted target
        p.targetAngle = Math.atan2(bestTarget.y - p.y, bestTarget.x - p.x);

        // AWP CLOSE-RANGE LOGIC:
        // If AWPer is engaged at point-blank range (< 105 units) with enemy closing in, switch to pistol!
        let activeWeaponKey = p.weapon;
        if (p.weapon === 'awp' && closestDist < 105) {
          activeWeaponKey = p.team === 'ct' ? 'usp' : 'glock';
        }

        const weapon = WEAPONS[activeWeaponKey] || WEAPONS.ak47;

        // Check Ammo & Reload
        if (p.ammo === undefined) p.ammo = weapon.clipSize || 30;
        if (p.reserveAmmo === undefined) p.reserveAmmo = weapon.maxReserve || 90;

        if (p.ammo <= 0) {
          if (p.reserveAmmo > 0) {
            p.isReloading = true;
            p.reloadTimer = weapon.reloadTime || 2.4;
            p.burstCount = 0;
            match.events.push({ type: 'reload_start', playerId: p.id, weapon: activeWeaponKey });
          } else {
            // Out of reserve ammo -> fallback to pistol
            p.weapon = p.team === 'ct' ? 'usp' : 'glock';
            p.ammo = 12;
            p.reserveAmmo = 24;
          }
          return;
        }

        if (p.targetEnemyId !== bestTarget.id) {
          p.targetEnemyId = bestTarget.id;

          // Card Skill-Driven Reaction Time (Normalized for 30 - 100 scale):
          // 100 reflex pro: ~0.10s (100ms) base; 40 reflex rookie: ~0.35s (350ms) base
          const reflex = Math.max(30, Math.min(100, (p.skills && p.skills.reflex) || 50));
          let baseReaction = 0.40 - ((reflex - 30) / 70) * 0.30 + (Math.random() * 0.03 - 0.015);

          // Card Signature Perks:
          if (p.perk === 'flick_king' && (p.weapon === 'awp')) {
            baseReaction *= 0.70; // 30% faster AWP sniper reaction!
          } else if (p.perk === 'aggressive_entry') {
            baseReaction *= 0.82; // Faster aggressive peek reaction!
          } else if (p.perk === 'rookie_nervous') {
            baseReaction *= 1.15; // Inexperienced rookie hesitates under pressure (+15%)
          } else if (p.perk === 'raw_talent' && Math.random() < 0.25) {
            baseReaction *= 0.80; // Sudden raw reflex spark!
          }

          // Team Mastermind Perk: If team has an active IGL with tactical_mastermind:
          const hasMastermind = Object.values(match.players).some(mate =>
            mate.team === p.team && mate.alive && mate.perk === 'tactical_mastermind'
          );
          if (hasMastermind) {
            baseReaction *= 0.92;
          }

          const isHoldingAngle = (p.state === 'holding' || this.isCoverPosition(p.x, p.y, match));
          if (isHoldingAngle) {
            baseReaction *= 0.70;
          }

          if (p.tradeTargetId === bestTarget.id) {
            baseReaction = Math.min(baseReaction, 0.08);
          }

          p.reactionTimer = Math.max(0.04, baseReaction);
        }

        if (p.reactionTimer > 0) {
          p.reactionTimer -= dt;
          return;
        }

        if (p.flashDuration > 0.4) return;
        if (p.burstPauseTimer > 0) return;

        if (now - (p.lastShotTime || 0) >= weapon.fireRate * 1000) {
          p.lastShotTime = now;
          p.ammo--; // Decrement ammo with each shot
          this.resolveProShot(match, p, bestTarget, weapon, closestDist);
        }
      } else {
        p.targetEnemyId = null;
        p.burstCount = 0;
        p.isCrouching = false;

        // TACTICAL RELOAD IN LULLS / COVER:
        // If not in active combat, ammo is low (<= 8 for rifles, <= 4 for pistols), and has reserve ammo:
        if (!p.isReloading && p.ammo !== undefined && p.reserveAmmo > 0) {
          const currentW = WEAPONS[p.weapon] || WEAPONS.ak47;
          const lowAmmoThreshold = (currentW.type === 'pistol' ? 4 : 8);
          if (p.ammo <= lowAmmoThreshold && Math.random() < 0.15) {
            p.isReloading = true;
            p.reloadTimer = currentW.reloadTime || 2.4;
            match.events.push({ type: 'reload_start', playerId: p.id, weapon: p.weapon });
          }
        }

        this.checkSmokeSpam(match, p, dt, now);
      }
    });
  }

  checkSmokeSpam(match, p, dt, now) {
    if (!p.soundAlert || now - p.soundAlert.time > 1400) return;
    if (p.isReloading || p.burstPauseTimer > 0) return;
    const dist = Math.hypot(p.soundAlert.x - p.x, p.soundAlert.y - p.y);
    const weapon = WEAPONS[p.weapon] || WEAPONS.ak47;
    if (dist > weapon.maxRange || dist < 35) return;

    // Check if line passes through smoke and is NOT blocked by a solid wall
    const blockedBySmoke = this.collision.isLineBlockedBySmoke(match.smokes, p.x, p.y, p.soundAlert.x, p.soundAlert.y);
    const blockedByWall = this.collision.isLineBlockedByWall(p.x, p.y, p.soundAlert.x, p.soundAlert.y);

    if (blockedBySmoke && !blockedByWall) {
      if (Math.random() < 0.35 && now - (p.lastShotTime || 0) >= weapon.fireRate * 1000 * 1.6) {
        p.lastShotTime = now;
        p.targetAngle = Math.atan2(p.soundAlert.y - p.y, p.soundAlert.x - p.x);
        p.angle = p.targetAngle;
        if (p.ammo !== undefined && p.ammo > 0) p.ammo--;

        const enemies = Object.values(match.players).filter(e => e.team !== p.team && e.alive);
        let hitEnemy = null;
        for (const e of enemies) {
          const dToLine = this.collision.distToSegment({ x: e.x, y: e.y }, { x: p.x, y: p.y }, { x: p.soundAlert.x, y: p.soundAlert.y });
          if (dToLine < 20) {
            hitEnemy = e;
            break;
          }
        }

        if (hitEnemy) {
          const dmg = Math.round(weapon.damage * 0.72);
          hitEnemy.hp = Math.max(0, hitEnemy.hp - dmg);
          p.damage += dmg;
          match.events.push({ type: 'hit', shooterId: p.id, targetId: hitEnemy.id, damage: dmg, isHeadshot: false });
          if (hitEnemy.hp <= 0 && hitEnemy.alive) {
            this.handleKill(match, p, hitEnemy, weapon, false, { isThroughSmoke: true });
          }
        }

        match.events.push({
          type: 'shoot',
          weapon: p.weapon,
          shooterId: p.id,
          fromX: p.x,
          fromY: p.y,
          toX: p.soundAlert.x + (Math.random() - 0.5) * 30,
          toY: p.soundAlert.y + (Math.random() - 0.5) * 30,
          isHit: !!hitEnemy,
          isHeadshot: false
        });
      }
    }
  }

  resolveProShot(match, shooter, target, weapon, dist) {
    shooter.burstCount = (shooter.burstCount || 0) + 1;

    let burstAccuracy = 1.0;
    if (shooter.burstCount === 1) burstAccuracy = 0.98;
    else if (shooter.burstCount === 2) burstAccuracy = 0.88;
    else if (shooter.burstCount === 3) burstAccuracy = 0.74;
    else burstAccuracy = 0.44;

    const distFactor = Math.max(0.4, 1.0 - (dist / weapon.maxRange) * 0.45);

    // Card Skill-Driven Combat Modifiers (Normalized for 30 - 100 scale):
    const aim = Math.max(30, Math.min(100, (shooter.skills && shooter.skills.aim) || 50));
    const gamesense = Math.max(30, Math.min(100, (shooter.skills && shooter.skills.gamesense) || 50));
    const clutch = Math.max(30, Math.min(100, (shooter.skills && shooter.skills.clutch) || 50));
    const headshotSkill = Math.max(30, Math.min(100, (shooter.skills && (shooter.skills.headshot || shooter.skills.aim)) || 45));
    const aggression = Math.max(30, Math.min(100, (shooter.skills && shooter.skills.aggression) || 50));

    // Base accuracy modifier centered at 65 (average):
    // Aim 100 -> +0.14 | Aim 65 -> 0.00 | Aim 40 -> -0.10 | Aim 30 -> -0.14
    const aimBonus = ((aim - 65) / 100) * 0.40;
    // Gamesense 100 -> +0.07 | Gamesense 65 -> 0.00 | Gamesense 40 -> -0.05
    const gamesenseBonus = ((gamesense - 65) / 100) * 0.20;

    // Recoil spray penalty based on aim & spray control:
    // High aim pros hold spray tightly; rookies with low aim lose control on continuous burst
    let sprayRecoilPenalty = 0;
    if (shooter.burstCount === 2) {
      sprayRecoilPenalty = ((100 - aim) / 100) * 0.14;
    } else if (shooter.burstCount >= 3) {
      sprayRecoilPenalty = ((100 - aim) / 100) * 0.28;
    }

    // Check for 1vX clutch situation
    const aliveAllies = Object.values(match.players).filter(p => p.team === shooter.team && p.alive).length;
    const aliveEnemies = Object.values(match.players).filter(p => p.team !== shooter.team && p.alive).length;
    const isClutching = (aliveAllies === 1 && aliveEnemies >= 1);
    
    let clutchBonus = 0;
    if (isClutching) {
      if (clutch >= 80) {
        // Cold-blooded clutch player (+0.05 to +0.18)
        clutchBonus = ((clutch - 80) / 20) * 0.18;
      } else if (clutch < 60) {
        // Inexperienced rookie choking under 1vX pressure (-0.05 to -0.14)
        clutchBonus = ((clutch - 60) / 30) * 0.14;
      }
    }

    // Card Signature Perks:
    let perkAccuracyBonus = 0;
    let perkHsBonus = 0;

    if (shooter.perk === 'onetap_god' && shooter.burstCount === 1) {
      perkHsBonus += 0.22; // Massive 1-tap headshot advantage
      perkAccuracyBonus += 0.10;
    }
    if (shooter.perk === 'ice_clutch' && isClutching) {
      perkAccuracyBonus += 0.22; // Ice in veins clutch mastery
      perkHsBonus += 0.16;
    }
    if (shooter.perk === 'flick_king' && weapon.type === 'sniper') {
      perkAccuracyBonus += 0.16; // Godly sniper flick accuracy
    }
    if (shooter.perk === 'smoke_criminal' && shooter.smokeExitTimer > 0) {
      perkAccuracyBonus += 0.20; // Eliminates smoke push disadvantage
    }
    if (shooter.perk === 'rookie_nervous') {
      sprayRecoilPenalty += 0.08;
      if (isClutching) clutchBonus -= 0.08;
    }
    if (shooter.perk === 'raw_talent' && Math.random() < 0.25) {
      // 25% chance of sudden raw mechanical flash of genius
      perkAccuracyBonus += 0.15;
      perkHsBonus += 0.10;
    }

    const movingPenalty = shooter.state === 'moving' 
      ? (weapon.type === 'sniper' ? -0.55 : (weapon.type === 'pistol' ? -0.06 : -0.25)) 
      : 0;
    const stationaryTargetBonus = (target.state === 'planting' || target.state === 'defusing') ? 0.12 : 0;

    // 1. SİPER ALMA & AÇI TUTMA AVANTAJI:
    // Savunma yapan oyuncu siperde veya sabit açı tutuyorsa ayakları yere sağlam basar, ilk mermisi çok isabetli olur (+12%)
    const shooterInCover = (shooter.state === 'holding' || this.isCoverPosition(shooter.x, shooter.y, match));
    const holdBonus = shooterInCover ? 0.12 : 0;

    // 2. TERÖRİST TOPLU HÜCUM AVANTAJI (Pack Rush & Crossfire Momentum):
    // Teröristler toplu giriş yapıyorsa (240px mesafede 1 veya daha fazla T yoldaşı varsa) güven ve baskı bonusu alır (+5% ila +12%)
    let tGroupBonus = 0;
    if (shooter.team === 't') {
      const nearbyTAllies = Object.values(match.players).filter(p =>
        p.team === 't' && p.alive && p.id !== shooter.id && Math.hypot(p.x - shooter.x, p.y - shooter.y) <= 240
      ).length;
      if (nearbyTAllies >= 1) {
        tGroupBonus = Math.min(0.12, nearbyTAllies * 0.05);
      }
    }

    // 3. ÇAPRAZ ATEŞ BASKISI:
    // Hedefteki savunmacıya aynı anda 2 veya daha fazla düşman birden yükleniyorsa, savunmacı çapraz ateş baskısı altında kalır (-9%)
    const attackersOnTarget = Object.values(match.players).filter(p =>
      p.alive && p.team === shooter.team && p.targetEnemyId === target.id
    ).length;
    const crossfirePenalty = attackersOnTarget >= 2 ? -0.09 : 0;

    // 4. SİPER ALMA SAVUNMASI (Hedefin Siperde Olması):
    // Siper arkasında bekleyen hedefin yalnızca kafası/omuzları görünür, koşan düşman için vurması çok daha zordur (-18%)
    const targetInCover = (target.state === 'holding' || this.isCoverPosition(target.x, target.y, match));
    const coverDefensePenalty = targetInCover ? -0.18 : 0;

    // 5. TRADE FRAG VURUŞU:
    // Vurulan arkadaşını intikam hedefi olarak vuran oyuncu ekstra isabet alır (+12%)
    const tradeBonus = (shooter.tradeTargetId === target.id) ? 0.12 : 0;

    // 6. PRO CROUCH SPRAY: In rifle bursts (burstCount >= 2), bot crouches to stabilize recoil (+12% accuracy bonus)
    if (weapon.type === 'rifle' && shooter.burstCount >= 2 && !shooter.isCrouching && Math.random() < 0.45) {
      shooter.isCrouching = true;
    }
    const crouchBonus = shooter.isCrouching ? 0.12 : 0;

    // 7. SMOKE PUSH DISADVANTAGE (CS:GO First-Out Blindness):
    const smokeExitShooterPenalty = (shooter.smokeExitTimer > 0) ? -0.18 : 0;
    const smokeExitTargetBonus = (target.smokeExitTimer > 0) ? 0.15 : 0;

    // 8. DEAGLE 1-TAP ECO AMBUSH MECHANIC:
    let deagleOneTapHsBonus = 0;
    if (weapon.name === 'Desert Eagle' && shooter.isDeagleEcoTrap && shooter.burstCount === 1 && shooterInCover && dist <= 480) {
      deagleOneTapHsBonus = 0.28;
    }

    // Crosshair alignment check: If shooter's angle has not settled onto target yet (<0.15 rad ~8 deg), apply flick penalty
    const angleToTarget = Math.atan2(target.y - shooter.y, target.x - shooter.x);
    const aimSettlingDiff = Math.abs(this.collision.normalizeAngle(shooter.angle - angleToTarget));
    const flickPenalty = aimSettlingDiff > 0.18 ? -0.20 : 0;

    let totalHitChance = (weapon.accuracy * distFactor * burstAccuracy)
      - sprayRecoilPenalty
      + aimBonus + gamesenseBonus + clutchBonus + perkAccuracyBonus + movingPenalty + holdBonus + tGroupBonus + crossfirePenalty + coverDefensePenalty + tradeBonus + stationaryTargetBonus + crouchBonus + smokeExitShooterPenalty + smokeExitTargetBonus + flickPenalty;

    if (shooter.flashDuration > 0.3) {
      totalHitChance *= 0.25; // Blind panic-spray penalty
    }

    // Ensure total hit chance stays in safe, realistic bounds (6% to 96%)
    totalHitChance = Math.max(0.06, Math.min(0.96, totalHitChance));

    const isHit = Math.random() < totalHitChance;
    let isHeadshot = false;
    let damage = 0;

    if (isHit) {
      // Headshot probability is determined by shooter's Headshot skill on a realistic power curve:
      // A 99-100 HS pro has ~55-65% HS rate on burst 1; a 40 HS rookie has ~9-12%.
      const coverHsBonus = (shooterInCover && shooter.burstCount === 1) ? 0.08 : 0;
      const crouchTargetHsPenalty = target.isCrouching ? -0.06 : 0;
      const hsSkillFactor = Math.pow(headshotSkill / 100, 1.8) * 0.48;
      
      let baseHsChance = 0;
      if (weapon.name === 'AWP') {
        baseHsChance = 0.12;
      } else if (shooter.burstCount === 1) {
        baseHsChance = 0.10 + hsSkillFactor + coverHsBonus + crouchTargetHsPenalty + deagleOneTapHsBonus + perkHsBonus;
      } else {
        baseHsChance = 0.05 + hsSkillFactor * 0.40 + crouchTargetHsPenalty;
      }
      isHeadshot = Math.random() < Math.max(0.04, Math.min(0.92, baseHsChance));

      if (isHeadshot) {
        let hsDamage = weapon.damage * weapon.hsMult;
        // CS:GO Desert Eagle Fatal 1-Tap Kill (even with helmet at close-medium range <= 450 units)
        if (weapon.name === 'Desert Eagle' && dist <= 480) {
          hsDamage = Math.max(105, hsDamage);
        } else if (target.hasHelmet && weapon.name !== 'AK-47' && weapon.name !== 'AWP') {
          hsDamage *= 0.72;
          target.armor = Math.max(0, target.armor - 18);
        }
        damage = hsDamage;
      } else {
        let bodyDamage = weapon.damage;
        if (target.armor > 0 && weapon.type !== 'sniper') {
          bodyDamage *= 0.72;
          target.armor = Math.max(0, target.armor - 12);
        }
        // SİPER HASAR EMİLİMİ:
        // Eğer hedef oyuncu siperdeyse (Goose, Car, Platform, Back Site, Ramp), kafa dışındaki gövde mermileri
        // kutu/engel kenarına çarpar ve %25 hasar emilimi sağlanır!
        if (targetInCover) {
          bodyDamage *= 0.75;
        }
        // Iron Anchor Perk: +20% extra damage reduction when holding site in cover!
        if (target.perk === 'iron_anchor' && targetInCover) {
          bodyDamage *= 0.80;
        }
        damage = bodyDamage;
      }

      // PRO REALISTIC WEAPON DISTANCE DAMAGE FALLOFF:
      // In CS:GO, pistols suffer heavy falloff at long distances (e.g. Long A), while rifles retain punch
      const distRatio = Math.min(1.0, dist / (weapon.maxRange || 600));
      const rangeFalloff = weapon.type === 'pistol' 
        ? Math.max(0.48, 1.0 - distRatio * 0.42)
        : Math.max(0.78, 1.0 - distRatio * 0.14);
      damage = Math.round(damage * rangeFalloff);

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
          const reflex = Math.max(30, Math.min(100, (target.skills && target.skills.reflex) || 50));
          target.reactionTimer = Math.max(0.06, 0.28 - ((reflex - 30) / 70) * 0.18);
        }
      }

      match.events.push({
        type: isHeadshot ? 'headshot' : 'hit',
        shooterId: shooter.id,
        targetId: target.id,
        damage,
        isHeadshot
      });

      if (target.hp <= 0 && target.alive) {
        const isBlind = (shooter.flashDuration > 0.3);
        const isThroughSmoke = this.collision.isLineBlockedBySmoke(match.smokes, shooter.x, shooter.y, target.x, target.y);
        const isNoScope = (weapon.name === 'AWP' && dist < 120);
        const isMidDoorsWb = (Math.abs(target.x - 500) < 55 && ((shooter.y < 430 && target.y > 430) || (shooter.y > 430 && target.y < 430)));
        const isBDoorsWb = (Math.abs(target.x - 310) < 45 && Math.abs(target.y - 180) < 45);
        const isWallbang = Boolean(isMidDoorsWb || isBDoorsWb);
        this.handleKill(match, shooter, target, weapon, isHeadshot, { isWallbang, isThroughSmoke, isNoScope, isBlind });
      }
    }

    if (weapon.type === 'rifle' && shooter.burstCount >= 3) {
      shooter.burstCount = 0;
      shooter.burstPauseTimer = 0.26;
    } else if (weapon.type === 'sniper') {
      shooter.burstPauseTimer = 1.35;
    } else if (weapon.type === 'pistol' && shooter.burstCount >= 2) {
      shooter.burstCount = 0;
      shooter.burstPauseTimer = 0.18;
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

  handleKill(match, killer, victim, weapon, isHeadshot, mods = {}) {
    if (!victim.alive) return; // Guard against multiple simultaneous kill resolutions
    victim.alive = false;
    victim.state = 'dead';
    victim.deaths++;

    // Immediately clear references so other bots stop targeting the dead player
    Object.values(match.players).forEach(p => {
      if (p.targetEnemyId === victim.id) p.targetEnemyId = null;
      if (p.tradeTargetId === victim.id) p.tradeTargetId = null;
    });

    killer.kills++;
    killer.money += (weapon.type === 'sniper' ? 100 : 300);

    // CS:GO WEAPON STEAL / UPGRADE MECHANIC:
    // If killer holds a pistol/deagle and victim drops a primary rifle or AWP, killer immediately grabs it!
    const victimW = victim.weapon;
    const isVictimRifleOrAwp = victimW === 'ak47' || victimW === 'm4a1' || victimW === 'm4a4' || victimW === 'awp';
    const isKillerOnPistol = killer.weapon === 'usp' || killer.weapon === 'glock' || killer.weapon === 'deagle';

    if (isKillerOnPistol && isVictimRifleOrAwp && killer.alive) {
      killer.weapon = victimW;
      killer.isDeagleEcoTrap = false;
      const wDef = WEAPONS[killer.weapon] || WEAPONS.ak47;
      killer.ammo = wDef.clipSize || 30;
      killer.reserveAmmo = wDef.maxReserve || 90;
      match.events.push({ type: 'weapon_steal', killerId: killer.id, weapon: victimW });
      match.addRadioMessage(killer.team, killer.name, `[SİLAH ÇALINDI] Yerdeki ${victimW.toUpperCase()}'ı aldım, raundu çevirebiliriz!`);
    }

    // CS:GO Defuse Kit Drop Mechanics
    if (victim.team === 'ct' && victim.hasKit) {
      victim.hasKit = false;
      match.droppedKits = match.droppedKits || [];
      match.droppedKits.push({
        id: Math.random().toString(36).substr(2, 9),
        x: victim.x,
        y: victim.y
      });
      match.events.push({ type: 'kit_dropped', x: victim.x, y: victim.y });
    }

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
          const midCT = aliveCTs.find(p => p.slot === 2 || (p.x >= 420 && p.x <= 640 && p.y >= 220));
          if (midCT && !midCT.targetEnemyId) {
            match.setPlayerPath(midCT, 'a_short_site');
            match.addRadioMessage('ct', midCT.name, "A'ya desteğe geçiyorum!");
          }

          // B CT rotates to A ONLY IF bomb is confirmed at A or ALL A+Mid defenders are eliminated
          const ctAtAAndMid = aliveCTs.filter(p => p.x > 460).length;
          const isBombAtA = match.ctBombIntel && match.ctBombIntel.spotted && match.ctBombIntel.site === 'A';

          if (isBombAtA || ctAtAAndMid === 0) {
            const bCT = aliveCTs.find(p => p.x < 460);
            if (bCT && !bCT.targetEnemyId) {
              match.setPlayerPath(bCT, 'goose'); // Goose anchor to create proper crossfire with a_site
              match.addRadioMessage('ct', bCT.name, "B'den A Goose'a rotasyon yapıyorum, tutunun!");
            }
          }

          // Terrorists exploit opening at A if target was A
          if (match.tTargetSite === 'A') {
            const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
            aliveTs.forEach(t => {
              if (!t.targetEnemyId && !t.isRetrievingBomb) match.setPlayerPath(t, 'a_site');
            });
          }
        } else if (zone === 'B Site') {
          // Mid CT rotates to B
          const midCT = aliveCTs.find(p => p.slot === 2 || (p.x >= 420 && p.x <= 640 && p.y >= 220));
          if (midCT && !midCT.targetEnemyId) {
            match.setPlayerPath(midCT, 'b_doors_outside');
            match.addRadioMessage('ct', midCT.name, "B'ye desteğe geliyorum!");
          }

          // A CT rotates to B ONLY IF bomb is confirmed at B or ALL B+Mid defenders are eliminated
          const ctAtBAndMid = aliveCTs.filter(p => p.x < 650).length;
          const isBombAtB = match.ctBombIntel && match.ctBombIntel.spotted && match.ctBombIntel.site === 'B';

          if (isBombAtB || ctAtBAndMid === 0) {
            const aCT = aliveCTs.find(p => p.x > 650);
            if (aCT && !aCT.targetEnemyId) {
              match.setPlayerPath(aCT, 'b_platform'); // Platform anchor to create crossfire with site/doors
              match.addRadioMessage('ct', aCT.name, "A'dan B Platform'a intikal ediyorum!");
            }
          }

          // Terrorists exploit opening at B if target was B
          if (match.tTargetSite === 'B') {
            const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
            aliveTs.forEach(t => {
              if (!t.targetEnemyId && !t.isRetrievingBomb) match.setPlayerPath(t, 'b_site');
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
        match.ensureWalkable(match.bomb); // Guarantee dropped bomb is at a walkable coordinate!
        match.events.push({ type: 'bomb_dropped', x: match.bomb.x, y: match.bomb.y });
        match.addRadioMessage('t', 'electronic (IGL)', "BOMBA DÜŞTÜ! C4'ü geri alın, site'a ilerleyin!");

        // CT killer announces dropped bomb to CT team
        const dropSite = zone === 'B Site' ? 'B' : (zone === 'Mid' ? 'Mid' : 'A');
        match.ctBombIntel = {
          spotted: true,
          site: dropSite,
          lastSpottedTime: Date.now(),
          x: match.bomb.x,
          y: match.bomb.y,
          spotterName: killer.name,
          isDropped: true
        };
        match.addRadioMessage('ct', killer.name, `BOMBA DÜŞTÜ! Taşıyıcıyı vurdum! Bomba [${zone}] bölgesinde yerde, burayı tutun!`);
        match.events.push({
          type: 'bomb_spotted',
          site: dropSite,
          x: match.bomb.x,
          y: match.bomb.y,
          spotter: killer.name,
          isDropped: true
        });

        // Nearby CT establishes a defensive hold angle watching the dropped bomb
        const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);
        const nearbyCT = aliveCTs.find(ct => !ct.targetEnemyId && Math.hypot(ct.x - match.bomb.x, ct.y - match.bomb.y) < 260);
        if (nearbyCT) {
          nearbyCT.holdTimer = 10.0;
          nearbyCT.state = 'holding';
          nearbyCT.targetAngle = Math.atan2(match.bomb.y - nearbyCT.y, match.bomb.x - nearbyCT.x);
        }

        // Closest alive T retrieves bomb immediately
        if (aliveTs.length > 0) {
          let closestT = aliveTs[0];
          let minDist = Infinity;
          for (const t of aliveTs) {
            const d = Math.hypot(t.x - match.bomb.x, t.y - match.bomb.y);
            if (d < minDist) {
              minDist = d;
              closestT = t;
            }
          }
          closestT.isRetrievingBomb = true;
          const bombNode = getClosestNode(match.bomb.x, match.bomb.y, match.mapData.nodes, match.collision);
          match.setPlayerPath(closestT, bombNode);
        }
      }
    }

    const killId = Math.random().toString(36).substr(2, 9);
    const weaponName = weapon ? (weapon.name || weapon.type || killer.weapon) : killer.weapon;

    match.killfeed.unshift({
      id: killId,
      killer: killer.name,
      victim: victim.name,
      assister: assister ? assister.name : null,
      weapon: weaponName,
      headshot: isHeadshot,
      isHeadshot,
      isWallbang: Boolean(mods.isWallbang),
      isThroughSmoke: Boolean(mods.isThroughSmoke),
      isNoScope: Boolean(mods.isNoScope),
      isBlind: Boolean(mods.isBlind),
      teamKiller: killer.team,
      teamVictim: victim.team,
      time: Date.now()
    });

    if (match.killfeed.length > 6) {
      match.killfeed.pop();
    }

    match.events.push({
      type: 'kill',
      id: killId,
      killer: killer.name,
      victim: victim.name,
      assister: assister ? assister.name : null,
      weapon: weaponName,
      headshot: isHeadshot,
      isHeadshot,
      isWallbang: Boolean(mods.isWallbang),
      isThroughSmoke: Boolean(mods.isThroughSmoke),
      isNoScope: Boolean(mods.isNoScope),
      isBlind: Boolean(mods.isBlind),
      teamKiller: killer.team,
      teamVictim: victim.team
    });
  }
}

module.exports = {
  CombatSystem
};
