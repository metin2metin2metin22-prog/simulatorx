// SimulatorX - Starter & Prospect Player Generator
// Generates authentic rookie and amateur CS players with distinct stats, perks, and roles.

const FIRST_NAMES = [
  'Kerem', 'Arda', 'Eren', 'Can', 'Efe', 'Berk', 'Ozan', 'Mert', 'Emre', 'Tolga',
  'Kaan', 'Doruk', 'Yiğit', 'Bilal', 'Burak', 'Sarp', 'Baran', 'Umut', 'Deniz', 'Görkem',
  'Lukas', 'Mateo', 'Jonas', 'Oliver', 'Filip', 'Jan', 'Tarik', 'Adam', 'Viktor', 'Emil'
];

const NICKNAMES = [
  'krm', 'ardx', 'v0rtex', 'aimer', 'blitz', 'shadow', 'reaper', 'neo', 'blade', 'flash',
  'apex', 'phantom', 'bullet', 'hunter', 'toxic', 'strike', 'beast', 'hawk', 'razor', 'titan',
  'clutch', 'snipe', 'demon', 'frost', 'zero', 'storm', 'rage', 'viper', 'nova', 'pulse'
];

const SURNAMES = [
  'Demir', 'Kaya', 'Çelik', 'Şen', 'Yıldız', 'Çetin', 'Aksoy', 'Doğan', 'Koç', 'Aslan',
  'Yavuz', 'Şahin', 'Kurt', 'Polat', 'Öztürk', 'Novak', 'Silva', 'Lind', 'Kowalski', 'Larsen'
];

const ROLES = [
  'AWPer',
  'Entry Fragger',
  'Rifler (Star)',
  'Site Anchor',
  'In-Game Leader (IGL)'
];

const ROLE_PERKS = {
  'AWPer': ['flick_king', 'raw_talent', 'ice_clutch'],
  'Entry Fragger': ['aggressive_entry', 'onetap_god', 'raw_talent'],
  'Rifler (Star)': ['raw_talent', 'onetap_god', 'rookie_nervous'],
  'Site Anchor': ['iron_anchor', 'smoke_criminal', 'rookie_nervous'],
  'In-Game Leader (IGL)': ['tactical_mastermind', 'ice_clutch', 'raw_talent']
};

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates an authentic starter 5-man roster for a newly registered club
 */
function generateStarterRoster(clubName = 'Kulübüm') {
  const usedNicks = new Set();
  const roster = [];

  for (let slot = 0; slot < 5; slot++) {
    let nick = getRandomItem(NICKNAMES);
    while (usedNicks.has(nick)) {
      nick = getRandomItem(NICKNAMES);
    }
    usedNicks.add(nick);

    const fName = getRandomItem(FIRST_NAMES);
    const sName = getRandomItem(SURNAMES);
    const fullName = `${fName} "${nick}" ${sName}`;
    const role = ROLES[slot];
    const eligiblePerks = ROLE_PERKS[role] || ['raw_talent', 'rookie_nervous'];
    const perk = getRandomItem(eligiblePerks);

    // Amateur / Grassroots balanced stats (40 to 65 range)
    const base = getRandomInt(44, 58);
    const aim = Math.max(38, Math.min(68, base + (role === 'Entry Fragger' || role === 'AWPer' ? getRandomInt(4, 9) : getRandomInt(-4, 4))));
    const reflex = Math.max(38, Math.min(68, base + (role === 'AWPer' || role === 'Entry Fragger' ? getRandomInt(3, 8) : getRandomInt(-3, 4))));
    const headshot = Math.max(35, Math.min(66, base + (role === 'Entry Fragger' ? getRandomInt(4, 8) : getRandomInt(-5, 3))));
    const gamesense = Math.max(38, Math.min(68, base + (role === 'In-Game Leader (IGL)' || role === 'Site Anchor' ? getRandomInt(4, 8) : getRandomInt(-4, 3))));
    const clutch = Math.max(35, Math.min(65, base + (role === 'In-Game Leader (IGL)' ? getRandomInt(3, 7) : getRandomInt(-4, 4))));
    const utility = Math.max(35, Math.min(62, base + (role === 'In-Game Leader (IGL)' || role === 'Site Anchor' ? getRandomInt(3, 7) : getRandomInt(-5, 2))));
    const aggression = role === 'Entry Fragger' ? getRandomInt(75, 90) : (role === 'Site Anchor' ? getRandomInt(35, 55) : getRandomInt(50, 75));

    const avgSkill = (aim + reflex + headshot + gamesense + clutch) / 5;
    const rating = Number((0.72 + (avgSkill - 40) * 0.012).toFixed(2));
    const price = Math.round(2500 + Math.pow(avgSkill / 10, 3) * 30);

    roster.push({
      id: `p_${Date.now()}_${slot}_${Math.random().toString(36).substr(2, 5)}`,
      name: fullName,
      country: 'TR',
      age: getRandomInt(16, 22),
      role,
      tag: 'Çaylak',
      teamName: clubName,
      rating,
      tier: 'Amatör Çaylak',
      form: 'normal',
      price,
      perk,
      skills: {
        aim,
        reflex,
        headshot,
        gamesense,
        clutch,
        utility,
        aggression
      },
      desc: `${clubName} akademisinden yetişmiş, gelişime açık amatör oyuncu.`
    });
  }

  return roster;
}

const SCOUT_NOTES = {
  local: [
    '⚡ Müthiş ham refleksleri var, doğru kamplarla ligin en iyi rifler\'ı olabilir.',
    '🎯 Crosshair yerleşimi çok temiz, 1-tap potansiyeli yüksek bir akademi cevheri.',
    '🧠 Yerel LAN turnuvalarında tek başına maç taşıdı. Takım oyununa açık.',
    '🛡️ Bomba kurma alanlarını savunmada çok inatçı, soğukkanlı bir anchor adayı.'
  ],
  challenger: [
    '🔥 FPL-Challenger liginde ilk sıralarda. Açılış düellolarında korkusuz ve keskin.',
    '⚡ AWP ile dar açılardan kaçırmayan reaksiyon süresine sahip agresif keskin nişancı.',
    '👑 1vX clutch anlarında nabzı yükselmeyen, raund kurtaran soğukkanlı bir bitirici.',
    '🎯 Spray kontrolü kusursuza yakın, profesyonel takımların radarına girmiş yetenek.'
  ],
  wonderkid: [
    '🌟 Geleceğin s1mple veya donk\'u olarak gösteriliyor! Sınır tanımayan saf yetenek.',
    '💣 Tek kurşunla kafa vuruşu makinesi; sahada rakip savunmaları tek başına çökertiyor.',
    '👑 Büyük finallerde MVP seçilmiş, doğuştan oyun okuma ve clutch dehası.',
    '⚡ Dünyanın en hızlı reaksiyon sürelerinden birine sahip AWP harikası.'
  ]
};

/**
 * Generates 3 prospect candidate cards when a scout mission finishes
 */
function generateScoutedProspects(scoutTier = 'local', clubName = 'Kulübüm') {
  const count = 3;
  const candidates = [];
  const usedNicks = new Set();

  for (let i = 0; i < count; i++) {
    let nick = getRandomItem(NICKNAMES);
    while (usedNicks.has(nick)) {
      nick = getRandomItem(NICKNAMES);
    }
    usedNicks.add(nick);

    const fName = getRandomItem(FIRST_NAMES);
    const sName = getRandomItem(SURNAMES);
    const fullName = `${fName} "${nick}" ${sName}`;
    const role = getRandomItem(ROLES);

    let baseMin = 44, baseMax = 58, ageMin = 15, ageMax = 18;
    let potentialStars = 3;
    let tierName = 'Yerel Akademi';
    let perkPool = ['raw_talent', 'rookie_nervous'];
    let priceBase = 2000;

    if (scoutTier === 'challenger') {
      baseMin = 62;
      baseMax = 76;
      ageMin = 16;
      ageMax = 20;
      potentialStars = 4;
      tierName = 'FPL Challenger';
      perkPool = ['raw_talent', 'aggressive_entry', 'iron_anchor', 'flick_king'];
      priceBase = 7500;
    } else if (scoutTier === 'wonderkid') {
      baseMin = 76;
      baseMax = 88;
      ageMin = 16;
      ageMax = 19;
      potentialStars = 5;
      tierName = 'Global Wonderkid';
      perkPool = ['onetap_god', 'flick_king', 'clutch_minister', 'tactical_mastermind'];
      priceBase = 22000;
    }

    const base = getRandomInt(baseMin, baseMax);
    const aim = Math.min(96, Math.max(38, base + getRandomInt(-2, 6)));
    const reflex = Math.min(96, Math.max(38, base + getRandomInt(-2, 6)));
    const headshot = Math.min(94, Math.max(35, base + getRandomInt(-3, 5)));
    const gamesense = Math.min(94, Math.max(38, base + getRandomInt(-3, 5)));
    const clutch = Math.min(94, Math.max(35, base + getRandomInt(-3, 5)));
    const utility = Math.min(90, Math.max(35, base + getRandomInt(-4, 4)));
    const aggression = getRandomInt(50, 85);

    const avgSkill = (aim + reflex + headshot + gamesense + clutch) / 5;
    const rating = Number((0.72 + (avgSkill - 40) * 0.012).toFixed(2));
    const price = Math.round(priceBase + (avgSkill - baseMin) * (scoutTier === 'wonderkid' ? 800 : (scoutTier === 'challenger' ? 300 : 80)));
    const perk = getRandomItem(perkPool);
    const scoutNote = getRandomItem(SCOUT_NOTES[scoutTier] || SCOUT_NOTES.local);

    candidates.push({
      id: `scout_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      name: fullName,
      country: getRandomItem(['TR', 'TR', 'TR', 'DE', 'SE', 'DK', 'PL']),
      age: getRandomInt(ageMin, ageMax),
      role,
      tag: 'Scout Adayı',
      teamName: 'Serbest Yetenek',
      rating,
      tier: tierName,
      potentialStars,
      form: 'normal',
      price,
      perk,
      scoutNote,
      skills: {
        aim,
        reflex,
        headshot,
        gamesense,
        clutch,
        utility,
        aggression
      },
      desc: scoutNote
    });
  }

  return candidates;
}

module.exports = {
  generateStarterRoster,
  generateScoutedProspects
};
