// SimulatorX - CS:GO Economy & Autonomous Equipment Purchasing System
// Manages team funds, loss bonuses, weapon drops, force/eco rounds, and armor/utility priorities.

const { WEAPONS } = require('../config/weapons');

class EconomySystem {
  constructor() {
    this.LOSS_BONUSES = [1400, 1900, 2400, 2900, 3400]; // Consecutive round loss bonus tiers
  }

  /**
   * Calculates round loss compensation based on consecutive loss streak
   * @param {number} lossStreak 
   * @returns {number}
   */
  calculateLossBonus(lossStreak) {
    const tier = Math.min(Math.max(0, lossStreak), this.LOSS_BONUSES.length - 1);
    return this.LOSS_BONUSES[tier];
  }

  /**
   * Evaluates team funds and executes authentic CS:GO buy logic
   * @param {Object} match - The active match instance
   * @param {string} team - 'ct' or 't'
   */
  executeAutonomousBuy(match, team) {
    const teamPlayers = Object.values(match.players).filter(p => p.team === team);

    // 1. CS:GO PISTOL ROUND META: Round 1 & Round 13 (Starting halves, max $800)
    if (match.round === 1 || match.round === 13) {
      this.executePistolRoundBuy(match, team, teamPlayers);
      return;
    }

    // 2. EVALUATE TEAM AVERAGE ECONOMY
    const avgMoney = teamPlayers.reduce((sum, p) => sum + p.money, 0) / teamPlayers.length;
    let teamStrat = 'full_buy';
    if (avgMoney < 2200) {
      teamStrat = 'eco';
    } else if (avgMoney < 3600) {
      teamStrat = 'force_buy';
    } else {
      teamStrat = 'full_buy';
    }

    // 3. TEAMMATE WEAPON DROPS
    this.handleTeammateDrops(match, team, teamPlayers, teamStrat);

    // 4. INDIVIDUAL WEAPON & GEAR PURCHASES
    this.executeRifleBuy(match, team, teamPlayers, teamStrat);

    // 5. IGL RADIO ANNOUNCEMENT
    this.announceBuyStrategy(match, team, teamPlayers, teamStrat);
  }

  /**
   * Pistol round buy (Kevlar vs Utility/Deagle split)
   */
  executePistolRoundBuy(match, team, teamPlayers) {
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
      match.addRadioMessage('ct', igl.name, "TABANCA RAUNDU: 3 kişi yelek aldı, 2 kişi flaş ve sisle girişleri tutuyor!");
    } else {
      match.addRadioMessage('t', igl.name, "TABANCA RAUNDU: Yelekli oyuncular önden çıkacak, arkadan flaş ve sisle açıyoruz!");
    }
  }

  /**
   * Weapon drop sharing between rich donors and broke receivers
   */
  handleTeammateDrops(match, team, teamPlayers, teamStrat) {
    if (teamStrat !== 'full_buy' && teamStrat !== 'force_buy') return;

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
        match.addRadioMessage(team, donor.name, `${receiver.name}, sana ${team === 'ct' ? 'M4A1-S' : 'AK-47'} drop attım!`);
      }
    }
  }

  /**
   * Individual weapon & armor buys according to strategy
   */
  executeRifleBuy(match, team, teamPlayers, teamStrat) {
    teamPlayers.forEach(p => {
      const hasRifleOrAwp = p.weapon === 'ak47' || p.weapon === 'm4a1' || p.weapon === 'm4a4' || p.weapon === 'awp';

      if (teamStrat === 'full_buy') {
        if (p.slot === 0 && (p.money >= 4750 || p.weapon === 'awp')) {
          if (p.weapon !== 'awp' && p.money >= 4750) {
            p.weapon = 'awp';
            p.money -= 4750;
          }
          this.buyArmor(p, 1000);
        } else {
          if (!hasRifleOrAwp && p.money >= (team === 'ct' ? 2900 : 2700)) {
            p.weapon = team === 'ct' ? 'm4a1' : 'ak47';
            p.money -= (team === 'ct' ? 2900 : 2700);
          }
          this.buyArmor(p, 1000);
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
        this.buyArmor(p, 650);
      } else {
        // ECO BUY: Players with high aim or onetap perk buy Deagles for 1-tap ambush
        p.isDeagleEcoTrap = false;
        if (!hasRifleOrAwp) {
          p.weapon = team === 'ct' ? 'usp' : 'glock';
          const deagleWorthy = (p.perk === 'onetap_god' || p.slot === 0 || (p.skills && p.skills.aim >= 70));
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
  }

  /**
   * Helper to buy armor/helmet safely
   */
  buyArmor(p, maxCost) {
    if (p.armor >= 50 && !p.hasHelmet && p.money >= 350) {
      p.hasHelmet = true;
      p.money -= 350;
    } else if (p.armor < 50 && maxCost >= 1000 && p.money >= 1000) {
      p.armor = 100;
      p.hasHelmet = true;
      p.money -= 1000;
    } else if (p.armor < 50 && p.money >= 650) {
      p.armor = 100;
      p.hasHelmet = false;
      p.money -= 650;
    }
  }

  /**
   * IGL radio callout
   */
  announceBuyStrategy(match, team, teamPlayers, teamStrat) {
    const igl = teamPlayers.find(p => p.slot === 0 || p.slot === 1) || teamPlayers[0];
    if (teamStrat === 'eco') {
      const hasDeagles = teamPlayers.some(p => p.weapon === 'deagle' && p.isDeagleEcoTrap);
      if (hasDeagles) {
        match.addRadioMessage(team, igl.name, "ECO RAUND: Deagle tuzağı kurduk, dar açıda bekliyoruz! Tek mermiyle silah çalacağız!");
      } else {
        match.addRadioMessage(team, igl.name, "ECO RAUND! Para biriktiriyoruz, sonraki raunt tam alım yapacağız.");
      }
    } else if (teamStrat === 'force_buy') {
      match.addRadioMessage(team, igl.name, 'FORCE BUY! Kırılma raundu, elimizdeki parayla yükleneceğiz!');
    } else {
      match.addRadioMessage(team, igl.name, 'FULL BUY! Ekipmanlar tam, execute için hazır olun.');
    }
  }
}

module.exports = { EconomySystem };
