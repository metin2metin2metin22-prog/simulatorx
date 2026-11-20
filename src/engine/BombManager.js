// SimulatorX - CS:GO C4 Bomb System (Planting, Defusing, Dropping, Carrying, Detonation)

class BombManager {
  constructor(tacticsSystem) {
    this.tactics = tacticsSystem;
  }

  updateBombObjectives(match, dt) {
    // 1. Check if dropped bomb is picked up by an alive Terrorist
    if (match.bomb.dropped && !match.bomb.carried && !match.bomb.planted) {
      const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
      for (const t of aliveTs) {
        const dist = Math.hypot(t.x - match.bomb.x, t.y - match.bomb.y);
        if (dist <= 58) {
          match.bomb.dropped = false;
          match.bomb.carried = true;
          match.bomb.carrierId = t.id;
          t.hasBomb = true;
          t.isRetrievingBomb = false;
          match.bomb.x = t.x;
          match.bomb.y = t.y;
          match.events.push({ type: 'bomb_pickup', playerId: t.id });

          // HIGH-IQ OPPOSITE SITE ROTATION:
          // CTs committed to the dropped bomb location. Once Ts grab it under smoke,
          // the T IGL immediately calls a fast rotation to the OPPOSITE (now empty) site!
          const oldSite = match.tTargetSite || 'B';
          match.tTargetSite = (oldSite === 'A' ? 'B' : 'A');
          const targetNode = match.tTargetSite === 'B' ? 'b_site' : 'a_site';

          match.addRadioMessage('t', 'electronic (IGL)', `Bombayı duman altından aldık! CT'ler buraya yığıldı, diğer site bomboş! Hızlıca ${match.tTargetSite} Site'a koşuyoruz!`);
          
          aliveTs.forEach(mate => {
            mate.isRetrievingBomb = false;
            mate.holdTimer = 0;
            if (!mate.targetEnemyId) {
              match.setPlayerPath(mate, targetNode);
              mate.sprintTimer = 4.0; // Sprint rotation boost
            }
          });
          break;
        }
      }
    }

    // 2. Synchronize carried bomb position & check planting progress
    if (!match.bomb.planted && match.bomb.carrierId) {
      const carrier = match.players[match.bomb.carrierId];
      if (carrier && carrier.alive) {
        match.bomb.x = carrier.x;
        match.bomb.y = carrier.y;

        const distA = Math.hypot(carrier.x - match.mapData.sites.A.x, carrier.y - match.mapData.sites.A.y);
        const distB = Math.hypot(carrier.x - match.mapData.sites.B.x, carrier.y - match.mapData.sites.B.y);
        const onSite = distA <= match.mapData.sites.A.radius + 15 ? 'A' : (distB <= match.mapData.sites.B.radius + 15 ? 'B' : null);

        // Safe default planting coordinates behind cover (A Site behind box, B Site behind big box)
        const DEFAULT_PLANT_SPOTS = {
          A: { x: 825, y: 165 },
          B: { x: 215, y: 125 }
        };

        if (onSite) {
          const defSpot = DEFAULT_PLANT_SPOTS[onSite];
          const distToDefSpot = Math.hypot(carrier.x - defSpot.x, carrier.y - defSpot.y);
          if (distToDefSpot > 28 && !carrier.targetEnemyId && carrier.state !== 'planting') {
            const angleToSpot = Math.atan2(defSpot.y - carrier.y, defSpot.x - carrier.x);
            const step = 80 * dt;
            const nx = carrier.x + Math.cos(angleToSpot) * step;
            const ny = carrier.y + Math.sin(angleToSpot) * step;
            if (match.isWalkable(nx, ny)) {
              carrier.x = nx;
              carrier.y = ny;
            }
          }
        }

        const canPlant = onSite && (!carrier.targetEnemyId || (carrier.state === 'planting' && match.bomb.plantProgress >= 0.5));

        if (canPlant) {
          if (!carrier.plantingAnnounced) {
            carrier.plantingAnnounced = true;
            match.addRadioMessage('t', carrier.name, `Bombayı kuruyorum! Girişleri tutun, beni koruyun!`);
          }
          carrier.state = 'planting';
          match.bomb.planterId = carrier.id;
          match.bomb.plantProgress += dt / 3.5;
          carrier.plantProgress = match.bomb.plantProgress;

          if (match.bomb.plantProgress >= 1.0) {
            match.bomb.planted = true;
            match.bomb.carried = false;
            match.bomb.dropped = false;
            match.bomb.site = onSite;
            match.bomb.x = carrier.x;
            match.bomb.y = carrier.y;
            carrier.hasBomb = false;
            carrier.state = 'idle';
            carrier.plantProgress = 0;
            carrier.plantingAnnounced = false;
            match.events.push({ type: 'bomb_planted', site: onSite, x: match.bomb.x, y: match.bomb.y });

            Object.values(match.players).filter(p => p.team === 't').forEach(p => p.money += 800);
            this.tactics.alertCTRetake(match, onSite);
          }
        } else {
          if (carrier.state === 'planting') {
            carrier.state = 'idle';
            match.bomb.plantProgress = 0;
            carrier.plantProgress = 0;
            carrier.plantingAnnounced = false;
          }
        }
      }
    }

    // 3. Defusal logic
    if (match.bomb.planted) {
      const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);
      const aliveTs = Object.values(match.players).filter(p => p.team === 't' && p.alive);
      let activeDefuser = null;

      for (const ct of aliveCTs) {
        const dist = Math.hypot(ct.x - match.bomb.x, ct.y - match.bomb.y);
        const canDefuse = dist <= 56 && (aliveTs.length === 0 || !ct.targetEnemyId || ct.state === 'defusing');
        if (canDefuse) {
          activeDefuser = ct;
          break;
        }
      }

      if (activeDefuser) {
        if (!activeDefuser.defusingAnnounced) {
          activeDefuser.defusingAnnounced = true;
          match.addRadioMessage('ct', activeDefuser.name, 'Bombayı çözüyorum! Açıları tutun, beni koruyun!');
        }
        activeDefuser.state = 'defusing';
        match.bomb.defusing = true;
        match.bomb.defuserId = activeDefuser.id;
        const defuseTime = activeDefuser.hasKit ? 5.0 : 10.0;
        match.bomb.defuseProgress = (match.bomb.defuseProgress || 0) + (dt / defuseTime);

        if (match.bomb.defuseProgress >= 1.0) {
          match.bomb.planted = false;
          match.bomb.defusing = false;
          match.bomb.defuseProgress = 0;
          activeDefuser.state = 'idle';
          activeDefuser.mvps++;
          activeDefuser.defusingAnnounced = false;
          match.events.push({ type: 'bomb_defused', defuserName: activeDefuser.name });
          match.endRound('ct', `Bomba ${activeDefuser.name} tarafından imha edildi! Counter-Terrorists kazandı!`);
          return;
        }
      } else {
        if (match.bomb.defusing) {
          match.bomb.defusing = false;
          match.bomb.defuserId = null;
          match.bomb.defuseProgress = 0;
          Object.values(match.players).forEach(p => p.defusingAnnounced = false);
        }
      }
    }
  }

  bombExploded(match) {
    match.bomb.planted = false;
    match.events.push({ type: 'bomb_explode', x: match.bomb.x, y: match.bomb.y });
    match.endRound('t', 'Hedef imha edildi! Bomba patladı.');
  }
}

module.exports = {
  BombManager
};
