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
        if (dist < 32) {
          match.bomb.dropped = false;
          match.bomb.carried = true;
          match.bomb.carrierId = t.id;
          t.hasBomb = true;
          match.bomb.x = t.x;
          match.bomb.y = t.y;
          match.events.push({ type: 'bomb_pickup', playerId: t.id });
          const targetNode = match.tTargetSite === 'B' ? 'b_site' : 'a_site';
          match.addRadioMessage('t', 'electronic (IGL)', `Bombayı aldık! ${match.tTargetSite} Site'a topluca hücum ediyoruz!`);
          aliveTs.forEach(mate => {
            if (!mate.targetEnemyId) match.setPlayerPath(mate, targetNode);
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
        const onSite = distA <= match.mapData.sites.A.radius ? 'A' : (distB <= match.mapData.sites.B.radius ? 'B' : null);

        if (onSite && !carrier.targetEnemyId) {
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
            match.events.push({ type: 'bomb_planted', site: onSite, x: match.bomb.x, y: match.bomb.y });

            Object.values(match.players).filter(p => p.team === 't').forEach(p => p.money += 800);
            this.tactics.alertCTRetake(match, onSite);
          }
        } else {
          if (carrier.state === 'planting') {
            carrier.state = 'idle';
            match.bomb.plantProgress = 0;
            carrier.plantProgress = 0;
          }
        }
      }
    }

    // 3. Defusal logic
    if (match.bomb.planted) {
      const aliveCTs = Object.values(match.players).filter(p => p.team === 'ct' && p.alive);
      let activeDefuser = null;

      for (const ct of aliveCTs) {
        const dist = Math.hypot(ct.x - match.bomb.x, ct.y - match.bomb.y);
        if (dist <= 48 && !ct.targetEnemyId) {
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
          activeDefuser.state = 'idle';
          activeDefuser.mvps++;
          activeDefuser.defusingAnnounced = false;
          match.events.push({ type: 'bomb_defused', defuserName: activeDefuser.name });
          match.endRound('ct', 'Counter-Terrorists bombayı imha etti!');
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
