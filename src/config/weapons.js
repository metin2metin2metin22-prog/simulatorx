// SimulatorX - CS:GO Weapons Database & Ballistic Parameters
const WEAPONS = {
  ak47: {
    name: 'AK-47',
    type: 'rifle',
    damage: 36,
    hsMult: 4.0,
    fireRate: 0.11,
    accuracy: 0.90,
    maxRange: 420,
    cost: 2700,
    team: 't',
    silenced: false
  },
  m4a1: {
    name: 'M4A1-S',
    type: 'rifle',
    damage: 34,
    hsMult: 3.5,
    fireRate: 0.10,
    accuracy: 0.94,
    maxRange: 420,
    cost: 2900,
    team: 'ct',
    silenced: true
  },
  awp: {
    name: 'AWP',
    type: 'sniper',
    damage: 115,
    hsMult: 4.0,
    fireRate: 1.35,
    accuracy: 0.98,
    maxRange: 680,
    cost: 4750,
    team: 'both',
    silenced: false
  },
  galil: {
    name: 'Galil AR',
    type: 'rifle',
    damage: 30,
    hsMult: 3.5,
    fireRate: 0.10,
    accuracy: 0.85,
    maxRange: 380,
    cost: 1800,
    team: 't',
    silenced: false
  },
  famas: {
    name: 'FAMAS',
    type: 'rifle',
    damage: 30,
    hsMult: 3.5,
    fireRate: 0.10,
    accuracy: 0.86,
    maxRange: 380,
    cost: 2050,
    team: 'ct',
    silenced: false
  },
  deagle: {
    name: 'Desert Eagle',
    type: 'pistol',
    damage: 53,
    hsMult: 4.0,
    fireRate: 0.30,
    accuracy: 0.86,
    maxRange: 340,
    cost: 700,
    team: 'both',
    silenced: false
  },
  usp: {
    name: 'USP-S',
    type: 'pistol',
    damage: 26,
    hsMult: 3.8,
    fireRate: 0.18,
    accuracy: 0.91,
    maxRange: 280,
    cost: 200,
    team: 'ct',
    silenced: true
  },
  glock: {
    name: 'Glock-18',
    type: 'pistol',
    damage: 22,
    hsMult: 3.0,
    fireRate: 0.14,
    accuracy: 0.82,
    maxRange: 260,
    cost: 200,
    team: 't',
    silenced: false
  }
};

module.exports = {
  WEAPONS
};
