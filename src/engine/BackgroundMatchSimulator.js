// SimulatorX - Authentic Background Match Simulation Engine
// Simulates rounds using the genuine 30-100 player skill curves, perks, weapon statistics,
// CS:GO economy (pistol, eco, force, full buy), site executes, and opening duels.

const { WEAPONS } = require('../config/weapons');

class BackgroundMatchSimulator {
  constructor() {
    this.mapSites = ['A', 'B'];
  }

  /**
   * Simulates a full competitive match (MR12: first to 13 wins)
   * between teamA and teamB using their authentic 5-man rosters.
   */
  simulateFullMatch(teamA, teamB, options = {}) {
    const rosters = {
      ct: JSON.parse(JSON.stringify(teamA.roster || [])),
      t: JSON.parse(JSON.stringify(teamB.roster || []))
    };

    // Pad rosters if needed
    ['ct', 't'].forEach(side => {
      while (rosters[side].length < 5) {
        rosters[side].push({
          id: `${side}_filler_${rosters[side].length}`,
          name: `Oyuncu ${rosters[side].length + 1}`,
          role: 'Rifler',
          skills: { aim: 60, reflex: 60, headshot: 55, gamesense: 60, clutch: 55, utility: 50, aggression: 50 },
          perk: 'raw_talent'
        });
      }
    });

    // Player match stats
    const stats = {};
    [...rosters.ct, ...rosters.t].forEach(p => {
      stats[p.id || p.name] = {
        id: p.id || p.name,
        name: p.name,
        teamSide: rosters.ct.includes(p) ? 'teamA' : 'teamB',
        role: p.role || 'Rifler',
        perk: p.perk || 'raw_talent',
        skills: p.skills || { aim: 65, reflex: 65, headshot: 60, gamesense: 65, clutch: 60, utility: 55 },
        kills: 0,
        deaths: 0,
        assists: 0,
        headshots: 0,
        damage: 0,
        mvps: 0
      };
    });

    // Economy state
    const economy = {
      ct: { money: [800, 800, 800, 800, 800], lossStreak: 0 },
      t: { money: [800, 800, 800, 800, 800], lossStreak: 0 }
    };

    const score = { teamA: 0, teamB: 0 };
    const roundsHistory = [];
    let currentHalf = 1;
    let roundNum = 1;

    // Team A starts CT, Team B starts T
    let currentCTTeam = teamA;
    let currentTTeam = teamB;
    let currentCTRoster = rosters.ct;
    let currentTRoster = rosters.t;

    const maxRounds = 24;

    while (score.teamA < 13 && score.teamB < 13 && roundNum <= maxRounds) {
      // Half time swap at round 13
      if (roundNum === 13 && currentHalf === 1) {
        currentHalf = 2;
        // Swap sides
        const tempTeam = currentCTTeam;
        currentCTTeam = currentTTeam;
        currentTTeam = tempTeam;

        const tempRoster = currentCTRoster;
        currentCTRoster = currentTRoster;
        currentTRoster = tempRoster;

        economy.ct = { money: [800, 800, 800, 800, 800], lossStreak: 0 };
        economy.t = { money: [800, 800, 800, 800, 800], lossStreak: 0 };
      }

      const roundResult = this.simulateRound({
        roundNum,
        ctTeam: currentCTTeam,
        tTeam: currentTTeam,
        ctRoster: currentCTRoster,
        tRoster: currentTRoster,
        economy,
        stats
      });

      roundsHistory.push(roundResult);

      if (roundResult.winnerSide === 'ct') {
        if (currentCTTeam === teamA) score.teamA++;
        else score.teamB++;
      } else {
        if (currentTTeam === teamA) score.teamA++;
        else score.teamB++;
      }

      roundNum++;
    }

    // Overtime if 12-12
    if (score.teamA === 12 && score.teamB === 12) {
      // Overtime MR3
      if (Math.random() < 0.5) score.teamA = 16, score.teamB = 14;
      else score.teamA = 14, score.teamB = 16;
    }

    const teamAWon = score.teamA > score.teamB;
    const winnerTeam = teamAWon ? teamA : teamB;

    // Compute player box score (HLTV rating & ADR)
    const totalRounds = roundsHistory.length;
    const computeBox = (teamObj) => {
      const pStats = Object.values(stats).filter(s => s.teamSide === (teamObj === teamA ? 'teamA' : 'teamB'));
      return pStats.map(p => {
        const adr = Number((p.damage / Math.max(1, totalRounds)).toFixed(1));
        const hsPercent = Math.round((p.headshots / Math.max(1, p.kills)) * 100);
        // HLTV 2.0 Formula Approximation
        const killFactor = (p.kills / totalRounds) / 0.679;
        const survivalFactor = ((totalRounds - p.deaths) / totalRounds) / 0.317;
        const damageFactor = (adr / 80);
        const rating = Number(Math.max(0.40, Math.min(2.40, (killFactor * 0.45 + survivalFactor * 0.25 + damageFactor * 0.30))).toFixed(2));

        return {
          id: p.id,
          name: p.name,
          role: p.role,
          perk: p.perk,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          headshots: p.headshots,
          hsPercent,
          damage: p.damage,
          adr,
          rating,
          mvps: p.mvps
        };
      }).sort((a, b) => b.rating - a.rating);
    };

    const teamABox = computeBox(teamA);
    const teamBBox = computeBox(teamB);
    const matchMvp = teamAWon ? teamABox[0] : teamBBox[0];

    return {
      homeTeam: teamA,
      awayTeam: teamB,
      score: { homeScore: score.teamA, awayScore: score.teamB },
      winner: winnerTeam,
      totalRounds,
      rounds: roundsHistory,
      homeBox: teamABox,
      awayBox: teamBBox,
      matchMvp: {
        name: matchMvp.name,
        team: winnerTeam.name,
        kills: matchMvp.kills,
        deaths: matchMvp.deaths,
        rating: matchMvp.rating
      }
    };
  }

  /**
   * Simulates an authentic single round with weapons, skill duels, and objectives
   */
  simulateRound({ roundNum, ctTeam, tTeam, ctRoster, tRoster, economy, stats }) {
    // 1. Economy Phase: Determine weapons bought
    const ctBuys = this.resolveTeamBuy(ctRoster, economy.ct, 'ct');
    const tBuys = this.resolveTeamBuy(tRoster, economy.t, 't');

    // 2. Tactical Plan
    const targetSite = Math.random() < 0.52 ? 'A' : 'B';
    const tStrat = targetSite === 'A' ? 'Long A / Short A Split' : 'Rush B & Mid Split';

    // Alive lists for the round
    let ctAlive = ctRoster.map((p, idx) => ({ ...p, buy: ctBuys[idx], hp: 100 }));
    let tAlive = tRoster.map((p, idx) => ({ ...p, buy: tBuys[idx], hp: 100 }));

    const roundKills = [];
    let bombPlanted = false;
    let roundMvpPlayer = null;

    // 3. Opening Duel (e.g. Mid Doors AWP or Long A duel)
    const ctOpener = ctAlive[Math.floor(Math.random() * ctAlive.length)];
    const tOpener = tAlive[Math.floor(Math.random() * tAlive.length)];

    const openerResult = this.resolveDuel(ctOpener, tOpener, ctOpener.buy.weapon, tOpener.buy.weapon, { isOpening: true });
    if (openerResult.winner === ctOpener) {
      tOpener.hp = 0;
      tAlive = tAlive.filter(p => p !== tOpener);
      this.recordKill(stats, ctOpener, tOpener, openerResult.isHS, openerResult.damage, ctOpener.buy.weapon);
      roundKills.push({ killer: ctOpener.name, victim: tOpener.name, weapon: ctOpener.buy.weapon.name, isHS: openerResult.isHS, type: 'First Blood (Açılış Vuruşu)' });
      roundMvpPlayer = ctOpener;
    } else {
      ctOpener.hp = 0;
      ctAlive = ctAlive.filter(p => p !== ctOpener);
      this.recordKill(stats, tOpener, ctOpener, openerResult.isHS, openerResult.damage, tOpener.buy.weapon);
      roundKills.push({ killer: tOpener.name, victim: ctOpener.name, weapon: tOpener.buy.weapon.name, isHS: openerResult.isHS, type: 'First Blood (Açılış Vuruşu)' });
      roundMvpPlayer = tOpener;
    }

    // 4. Site Execute Phase: Ts assault targetSite
    const ctDefenders = ctAlive.slice(0, Math.min(ctAlive.length, 2 + Math.floor(Math.random() * 2)));
    for (const defender of ctDefenders) {
      if (tAlive.length === 0 || ctAlive.length === 0) break;
      const attacker = tAlive[Math.floor(Math.random() * tAlive.length)];
      const duel = this.resolveDuel(attacker, defender, attacker.buy.weapon, defender.buy.weapon, { isExecute: true });

      if (duel.winner === attacker) {
        defender.hp = 0;
        ctAlive = ctAlive.filter(p => p !== defender);
        this.recordKill(stats, attacker, defender, duel.isHS, duel.damage, attacker.buy.weapon);
        roundKills.push({ killer: attacker.name, victim: defender.name, weapon: attacker.buy.weapon.name, isHS: duel.isHS, type: 'Site Giriş Vuruşu' });
        roundMvpPlayer = attacker;
      } else {
        attacker.hp = 0;
        tAlive = tAlive.filter(p => p !== attacker);
        this.recordKill(stats, defender, attacker, duel.isHS, duel.damage, defender.buy.weapon);
        roundKills.push({ killer: defender.name, victim: attacker.name, weapon: defender.buy.weapon.name, isHS: duel.isHS, type: 'Site Savunması' });
        roundMvpPlayer = defender;
      }
    }

    // If Ts still alive, plant C4
    if (tAlive.length > 0) {
      bombPlanted = true;
    }

    // 5. Retake / Post-Plant Phase
    while (ctAlive.length > 0 && tAlive.length > 0) {
      const ctP = ctAlive[0];
      const tP = tAlive[0];
      const duel = this.resolveDuel(ctP, tP, ctP.buy.weapon, tP.buy.weapon, { isPostPlant: true, bombPlanted });

      if (duel.winner === ctP) {
        tP.hp = 0;
        tAlive.shift();
        this.recordKill(stats, ctP, tP, duel.isHS, duel.damage, ctP.buy.weapon);
        roundKills.push({ killer: ctP.name, victim: tP.name, weapon: ctP.buy.weapon.name, isHS: duel.isHS, type: 'Retake Çatışması' });
        roundMvpPlayer = ctP;
      } else {
        ctP.hp = 0;
        ctAlive.shift();
        this.recordKill(stats, tP, ctP, duel.isHS, duel.damage, tP.buy.weapon);
        roundKills.push({ killer: tP.name, victim: ctP.name, weapon: tP.buy.weapon.name, isHS: duel.isHS, type: 'Post-Plant Savunması' });
        roundMvpPlayer = tP;
      }
    }

    // Determine round winner
    let winnerSide = 'ct';
    let winType = 'elimination';
    let highlight = '';

    if (tAlive.length > 0) {
      winnerSide = 't';
      winType = bombPlanted ? 'explosion' : 'elimination';
      highlight = `${tTeam.name} ${targetSite} bölgesini organize execute ile düşürdü ve raundu kazandı.`;
    } else {
      winnerSide = 'ct';
      winType = bombPlanted ? 'defuse' : 'elimination';
      highlight = bombPlanted 
        ? `${ctTeam.name} bombayı başarıyla imha ederek raundu kurtardı.`
        : `${ctTeam.name} tüm rakipleri etkisiz hale getirerek bölgeyi savundu.`;
    }

    // Update MVP mvps count
    if (roundMvpPlayer && stats[roundMvpPlayer.id || roundMvpPlayer.name]) {
      stats[roundMvpPlayer.id || roundMvpPlayer.name].mvps++;
    }

    // Update Economy rewards
    const ctWin = winnerSide === 'ct';
    this.updateEconomy(economy.ct, ctWin, bombPlanted && !ctWin);
    this.updateEconomy(economy.t, !ctWin, bombPlanted && !ctWin);

    return {
      roundNum,
      winnerSide,
      winType,
      winningTeamName: ctWin ? ctTeam.name : tTeam.name,
      winningTeamIcon: ctWin ? ctTeam.icon : tTeam.icon,
      mvp: roundMvpPlayer ? roundMvpPlayer.name : 'Takım Oyunu',
      highlight,
      kills: roundKills
    };
  }

  /**
   * Resolves a 1v1 duel based on player stats and weapons
   */
  resolveDuel(p1, p2, w1, w2, context = {}) {
    w1 = w1 || WEAPONS.m4a1 || { accuracy: 0.85, damage: 33, hsMult: 4, type: 'rifle' };
    w2 = w2 || WEAPONS.ak47 || { accuracy: 0.82, damage: 36, hsMult: 4, type: 'rifle' };

    const s1 = p1.skills || { aim: 65, reflex: 65, headshot: 60, gamesense: 65, clutch: 60 };
    const s2 = p2.skills || { aim: 65, reflex: 65, headshot: 60, gamesense: 65, clutch: 60 };

    // Aim & Reflex power score
    let score1 = (s1.aim * 0.40) + (s1.reflex * 0.35) + (s1.gamesense * 0.25);
    let score2 = (s2.aim * 0.40) + (s2.reflex * 0.35) + (s2.gamesense * 0.25);

    // Perk bonuses
    if (p1.perk === 'onetap_god') score1 += 8;
    if (p2.perk === 'onetap_god') score2 += 8;
    if (p1.perk === 'flick_king' && w1.type === 'sniper') score1 += 12;
    if (p2.perk === 'flick_king' && w2.type === 'sniper') score2 += 12;
    if (context.isOpening && p1.perk === 'aggressive_entry') score1 += 10;
    if (context.isOpening && p2.perk === 'aggressive_entry') score2 += 10;
    if (context.isPostPlant && p1.perk === 'clutch_minister') score1 += 10;
    if (context.isPostPlant && p2.perk === 'clutch_minister') score2 += 10;

    // Weapon accuracy factor
    score1 *= (w1.accuracy || 0.80);
    score2 *= (w2.accuracy || 0.80);

    const prob1 = score1 / (score1 + score2 || 1);
    const p1Wins = Math.random() < prob1;
    const winner = p1Wins ? p1 : p2;
    const winnerWeapon = p1Wins ? w1 : w2;
    const winnerSkills = p1Wins ? s1 : s2;

    const hsChance = Math.min(0.85, (winnerSkills.headshot || 50) / 100);
    const isHS = Math.random() < hsChance || winnerWeapon.type === 'sniper';
    const damage = isHS ? (winnerWeapon.damage * (winnerWeapon.hsMult || 4)) : 100;

    return { winner, isHS, damage };
  }

  recordKill(stats, killer, victim, isHS, damage, weapon) {
    const kStat = stats[killer.id || killer.name];
    const vStat = stats[victim.id || victim.name];

    if (kStat) {
      kStat.kills++;
      if (isHS) kStat.headshots++;
      kStat.damage += Math.min(100, damage);
    }
    if (vStat) {
      vStat.deaths++;
    }
  }

  resolveTeamBuy(roster, teamEco, teamSide) {
    const avgMoney = teamEco.money.reduce((a, b) => a + b, 0) / 5;
    return roster.map((p, idx) => {
      let weapon = teamSide === 'ct' ? WEAPONS.usp : WEAPONS.glock;
      let armor = false;

      if (avgMoney >= 4200) {
        // Full Buy: Rifles / AWP
        if (p.role === 'AWPer' && teamEco.money[idx] >= 4750) {
          weapon = WEAPONS.awp;
          teamEco.money[idx] -= 4750;
        } else {
          weapon = teamSide === 'ct' ? (WEAPONS.m4a1 || WEAPONS.ak47) : WEAPONS.ak47;
          teamEco.money[idx] -= (teamSide === 'ct' ? 3100 : 2700);
        }
        armor = true;
      } else if (avgMoney >= 2500) {
        // Force Buy: Galil/Famas/Deagle
        weapon = teamSide === 'ct' ? WEAPONS.famas : WEAPONS.galil;
        teamEco.money[idx] -= 2050;
        armor = true;
      } else {
        // Eco: Deagle / P250
        if (teamEco.money[idx] >= 700 && Math.random() < 0.6) {
          weapon = WEAPONS.deagle;
          teamEco.money[idx] -= 700;
        }
      }

      return { weapon, armor };
    });
  }

  updateEconomy(teamEco, won, bombPlanted) {
    if (won) {
      teamEco.lossStreak = 0;
      teamEco.money = teamEco.money.map(m => Math.min(16000, m + 3250));
    } else {
      teamEco.lossStreak = Math.min(4, teamEco.lossStreak + 1);
      const lossBonus = 1400 + (teamEco.lossStreak * 500);
      const bombBonus = bombPlanted ? 800 : 0;
      teamEco.money = teamEco.money.map(m => Math.min(16000, m + lossBonus + bombBonus));
    }
  }
}

const backgroundMatchSimulator = new BackgroundMatchSimulator();

module.exports = {
  BackgroundMatchSimulator,
  backgroundMatchSimulator
};
