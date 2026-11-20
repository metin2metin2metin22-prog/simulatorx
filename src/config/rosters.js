// SimulatorX - Professional Esports Player Rosters, Card Attributes & Manager Pool
// Every attribute mathematically dictates in-game probabilities, flick times, clutch resilience, and tactical IQ.

const PERK_DEFINITIONS = {
  flick_king: {
    name: 'Flick Kralı',
    icon: '⚡',
    badge: 'SNIPER FLICK',
    desc: 'AWP reaksiyon süresine %30 hızlanma, yakın mesafe noscope isabetine +%35 bonus ve 0ms flick gecikmesi.',
    effect: 'Sniper reaction 30% faster, noscope accuracy +35%'
  },
  onetap_god: {
    name: 'One-Tap Makinesi',
    icon: '🎯',
    badge: '1-TAP GOD',
    desc: 'İlk mermide kafa vuruşu şansına +%22 bonus; AK-47 ve Deagle ile ölümcül cerrahi giriş.',
    effect: 'First bullet headshot chance +22%, Deagle precision boost'
  },
  ice_clutch: {
    name: 'Buz Adam (Clutch)',
    icon: '❄️',
    badge: 'ICE IN VEINS',
    desc: '1vX clutch durumlarında sıfır panik; +%30 isabet bonusu ve +%15 kafa vuruşu avantajı.',
    effect: 'Clutch accuracy +30%, headshot +15% when 1vX alone'
  },
  smoke_criminal: {
    name: 'Duman Hayaleti',
    icon: '🌫️',
    badge: 'SMOKE GHOST',
    desc: 'Duman arkası ve içinden taramada +%40 isabet; duman içinden çıkışta görüş cezası yaşamaz.',
    effect: 'Smoke spam hit chance +40%, no smoke-exit vision delay'
  },
  iron_anchor: {
    name: 'Çelik Kale (Anchor)',
    icon: '🛡️',
    badge: 'IRON ANCHOR',
    desc: 'Bomba alanında siper tutarken gövde hasarına %20 emilim direnci; çapraz ateş baskısından etkilenmez.',
    effect: '20% damage reduction when holding site in cover'
  },
  tactical_mastermind: {
    name: 'Taktik Dehası (IGL)',
    icon: '🧠',
    badge: 'MASTERMIND',
    desc: 'Tüm takım arkadaşlarının reaksiyonunu hızlandırır (+%8), takım rotasyonlarını ve bomba etkilerini maksimize eder.',
    effect: 'Teamwide reaction speed +8%, extended flashbang durations'
  },
  aggressive_entry: {
    name: 'Vahşi Girişçi',
    icon: '🔥',
    badge: 'AGGRO ENTRY',
    desc: 'Köşelerden çıkarken peek hızı %18 daha yüksek; ilk kan (opening duel) kazanma oranı artırılmış.',
    effect: '18% faster peek speed, aggressive duel confidence'
  }
};

const PRO_PLAYER_POOL = [
  // --- AWPERS ---
  {
    id: 's1mple',
    name: 's1mple',
    teamName: 'Natus Vincere',
    country: 'UA',
    role: 'AWPer',
    tag: 'GOAT AWPer',
    rating: 1.33,
    tier: 'S+',
    perk: 'flick_king',
    skills: {
      aim: 99,
      reflex: 100,
      headshot: 94,
      gamesense: 98,
      clutch: 99,
      utility: 91,
      aggression: 92
    },
    desc: 'Tarihin en iyi CS oyuncusu; insanüstü AWP refleksleri ve akıl almaz flick shotlar.'
  },
  {
    id: 'zywoo',
    name: 'ZywOo',
    teamName: 'Team Vitality',
    country: 'FR',
    role: 'AWPer',
    tag: 'The Chosen One',
    rating: 1.35,
    tier: 'S+',
    perk: 'ice_clutch',
    skills: {
      aim: 98,
      reflex: 98,
      headshot: 95,
      gamesense: 100,
      clutch: 100,
      utility: 96,
      aggression: 78
    },
    desc: 'Seçilmiş kişi; kusursuz oyun zekası, pozisyon sezgisi ve yenilmez 1vX clutch canavarı.'
  },
  {
    id: 'm0nesy',
    name: 'm0NESY',
    teamName: 'G2 Esports',
    country: 'RU',
    role: 'AWPer',
    tag: 'Flash Child',
    rating: 1.29,
    tier: 'S+',
    perk: 'flick_king',
    skills: {
      aim: 97,
      reflex: 100,
      headshot: 93,
      gamesense: 96,
      clutch: 97,
      utility: 92,
      aggression: 94
    },
    desc: 'Işık hızında reaksiyon süresine sahip harika çocuk; agresif AWP peeki ve akrobasi vuruşları.'
  },
  {
    id: 'device',
    name: 'device',
    teamName: 'Astralis',
    country: 'DK',
    role: 'AWPer',
    tag: 'Mr. Consistency',
    rating: 1.22,
    tier: 'S',
    perk: 'smoke_criminal',
    skills: {
      aim: 95,
      reflex: 94,
      headshot: 91,
      gamesense: 98,
      clutch: 95,
      utility: 95,
      aggression: 55
    },
    desc: 'Bay Tutarlılık; mükemmel crosshair yerleşimi, hatasız pozisyon alma ve 4 Major şampiyonluğu.'
  },
  {
    id: 'sh1ro',
    name: 'sh1ro',
    teamName: 'Team Spirit',
    country: 'RU',
    role: 'AWPer',
    tag: 'Ice Sniper',
    rating: 1.24,
    tier: 'S',
    perk: 'ice_clutch',
    skills: {
      aim: 96,
      reflex: 95,
      headshot: 90,
      gamesense: 98,
      clutch: 98,
      utility: 93,
      aggression: 52
    },
    desc: 'Soğukkanlı keskin nişancı; düşük hata payı, disiplinli crosshair ve clutch güvenilirliği.'
  },
  {
    id: 'broky',
    name: 'broky',
    teamName: 'FaZe Clan',
    country: 'LV',
    role: 'AWPer',
    tag: 'Clutch King',
    rating: 1.20,
    tier: 'S',
    perk: 'ice_clutch',
    skills: {
      aim: 95,
      reflex: 96,
      headshot: 91,
      gamesense: 97,
      clutch: 99,
      utility: 91,
      aggression: 62
    },
    desc: '1vX durumlarında dünyanın en sakin AWPer\'ı; imkansız roundları çevirme uzmanı.'
  },

  // --- ENTRY FRAGGERS & STAR RIFLERS ---
  {
    id: 'niko',
    name: 'NiKo',
    teamName: 'G2 / Falcons',
    country: 'BA',
    role: 'Entry Fragger',
    tag: 'Rifle King',
    rating: 1.27,
    tier: 'S+',
    perk: 'onetap_god',
    skills: {
      aim: 100,
      reflex: 97,
      headshot: 99,
      gamesense: 95,
      clutch: 92,
      utility: 88,
      aggression: 95
    },
    desc: 'Tarihin en saf nişancısı; ölümcül AK-47 ve Deagle one-tap uzmanı.'
  },
  {
    id: 'donk',
    name: 'donk',
    teamName: 'Team Spirit',
    country: 'RU',
    role: 'Entry Fragger',
    tag: 'Wunderkind',
    rating: 1.34,
    tier: 'S+',
    perk: 'aggressive_entry',
    skills: {
      aim: 99,
      reflex: 99,
      headshot: 98,
      gamesense: 94,
      clutch: 91,
      utility: 84,
      aggression: 100
    },
    desc: 'Durdurulamaz genç yıldız; agresif peekleri, yüksek spray kontrolü ve acımasız baskısı.'
  },
  {
    id: 'b1t',
    name: 'b1t',
    teamName: 'Natus Vincere',
    country: 'UA',
    role: 'Entry Fragger',
    tag: 'Headshot Machine',
    rating: 1.20,
    tier: 'S',
    perk: 'onetap_god',
    skills: {
      aim: 97,
      reflex: 95,
      headshot: 100,
      gamesense: 93,
      clutch: 91,
      utility: 87,
      aggression: 84
    },
    desc: 'Kusursuz kafa vuruşu makinesi; temiz tek mermi ve cerrahi crosshair hassasiyeti.'
  },
  {
    id: 'flamez',
    name: 'flameZ',
    teamName: 'Team Vitality',
    country: 'IL',
    role: 'Entry Fragger',
    tag: 'The Spark',
    rating: 1.19,
    tier: 'S',
    perk: 'aggressive_entry',
    skills: {
      aim: 96,
      reflex: 97,
      headshot: 95,
      gamesense: 93,
      clutch: 92,
      utility: 90,
      aggression: 92
    },
    desc: 'Patlayıcı giriş gücü; raunt başı ilk kanı alma yeteneği ve yüksek tempoda çatışma.'
  },
  {
    id: 'elige',
    name: 'EliGE',
    teamName: 'Complexity',
    country: 'US',
    role: 'Entry Fragger',
    tag: 'Spray Machine',
    rating: 1.21,
    tier: 'S',
    perk: 'onetap_god',
    skills: {
      aim: 97,
      reflex: 95,
      headshot: 96,
      gamesense: 93,
      clutch: 90,
      utility: 86,
      aggression: 93
    },
    desc: 'Kuzey Amerika efsanesi; kusursuz spray transferleri ve yüksek duello kazanma oranı.'
  },

  // --- LURKERS & PRECISION RIFLERS ---
  {
    id: 'ropz',
    name: 'ropz',
    teamName: 'FaZe Clan',
    country: 'EE',
    role: 'Lurker',
    tag: 'Silent Ghost',
    rating: 1.26,
    tier: 'S+',
    perk: 'smoke_criminal',
    skills: {
      aim: 97,
      reflex: 95,
      headshot: 97,
      gamesense: 100,
      clutch: 99,
      utility: 97,
      aggression: 45
    },
    desc: 'Sessiz hayalet; kusursuz rotasyon okuma, zamanlama ve duman içi vuruş dehası.'
  },
  {
    id: 'frozen',
    name: 'frozen',
    teamName: 'FaZe Clan',
    country: 'SK',
    role: 'Lurker',
    tag: 'Cold Blooded',
    rating: 1.22,
    tier: 'S',
    perk: 'ice_clutch',
    skills: {
      aim: 96,
      reflex: 95,
      headshot: 95,
      gamesense: 96,
      clutch: 96,
      utility: 93,
      aggression: 74
    },
    desc: 'Mükemmel çok yönlü oyuncu; soğukkanlı çatışma yönetimi ve yüksek rating tutarlılığı.'
  },
  {
    id: 'spinx',
    name: 'Spinx',
    teamName: 'Team Vitality',
    country: 'IL',
    role: 'Lurker',
    tag: 'Precision Rifler',
    rating: 1.21,
    tier: 'S',
    perk: 'onetap_god',
    skills: {
      aim: 96,
      reflex: 94,
      headshot: 96,
      gamesense: 95,
      clutch: 94,
      utility: 90,
      aggression: 80
    },
    desc: 'Hassas çatışma kazanıcısı; harita kontrolü kurma ve dar açılardan seri frag çıkarma ustası.'
  },
  {
    id: 'blamef',
    name: 'blameF',
    teamName: 'Fnatic',
    country: 'DK',
    role: 'Lurker',
    tag: 'Heavy Lifter',
    rating: 1.19,
    tier: 'S',
    perk: 'ice_clutch',
    skills: {
      aim: 96,
      reflex: 93,
      headshot: 94,
      gamesense: 96,
      clutch: 95,
      utility: 91,
      aggression: 55
    },
    desc: 'Güçlü ve metodik; dar açılarda bekleyerek temiz takas ve geç raunt avantajı sağlar.'
  },

  // --- SITE ANCHORS & DEFENDERS ---
  {
    id: 'rain',
    name: 'rain',
    teamName: 'FaZe Clan',
    country: 'NO',
    role: 'Site Anchor',
    tag: 'Granite Anchor',
    rating: 1.17,
    tier: 'S',
    perk: 'iron_anchor',
    skills: {
      aim: 94,
      reflex: 93,
      headshot: 94,
      gamesense: 95,
      clutch: 96,
      utility: 92,
      aggression: 84
    },
    desc: 'Bomba alanlarının yıkılmaz kalesi; Major MVP, paniksiz alan savunması ve spray ustalığı.'
  },
  {
    id: 'perfecto',
    name: 'Perfecto',
    teamName: 'Free Agent',
    country: 'RU',
    role: 'Site Anchor',
    tag: 'Lord of Support',
    rating: 1.15,
    tier: 'S',
    perk: 'iron_anchor',
    skills: {
      aim: 93,
      reflex: 92,
      headshot: 90,
      gamesense: 98,
      clutch: 98,
      utility: 98,
      aggression: 46
    },
    desc: 'CS tarihinin en kusursuz support oyuncusu; clutch anlarında hatasız siper tutuşu.'
  },
  {
    id: 'magixx',
    name: 'magixx',
    teamName: 'Team Spirit',
    country: 'RU',
    role: 'Site Anchor',
    tag: 'Quiet Rock',
    rating: 1.12,
    tier: 'A',
    perk: 'iron_anchor',
    skills: {
      aim: 92,
      reflex: 91,
      headshot: 91,
      gamesense: 96,
      clutch: 94,
      utility: 94,
      aggression: 52
    },
    desc: 'Disiplin timsali; bomba sahasını tek başına tutabilen ve takımı için kendini feda eden anchor.'
  },

  // --- IN-GAME LEADERS (IGLs) ---
  {
    id: 'twistzz',
    name: 'Twistzz',
    teamName: 'Team Liquid',
    country: 'CA',
    role: 'In-Game Leader (IGL)',
    tag: 'The Magician',
    rating: 1.21,
    tier: 'S',
    perk: 'tactical_mastermind',
    skills: {
      aim: 96,
      reflex: 95,
      headshot: 98,
      gamesense: 97,
      clutch: 95,
      utility: 96,
      aggression: 76
    },
    desc: 'Kusursuz spray transferi, sakin kafa vuruşları ve yüksek taktiksel liderlik.'
  },
  {
    id: 'karrigan',
    name: 'karrigan',
    teamName: 'FaZe Clan',
    country: 'DK',
    role: 'In-Game Leader (IGL)',
    tag: 'Mastermind',
    rating: 1.10,
    tier: 'S',
    perk: 'tactical_mastermind',
    skills: {
      aim: 89,
      reflex: 89,
      headshot: 87,
      gamesense: 100,
      clutch: 93,
      utility: 100,
      aggression: 88
    },
    desc: 'CS tarihinin en büyük saha içi lideri; raunt ortası dahi okumaları ve kusursuz stratejiler.'
  },
  {
    id: 'apex',
    name: 'apEX',
    teamName: 'Team Vitality',
    country: 'FR',
    role: 'In-Game Leader (IGL)',
    tag: 'Fire Leader',
    rating: 1.12,
    tier: 'S',
    perk: 'tactical_mastermind',
    skills: {
      aim: 91,
      reflex: 92,
      headshot: 89,
      gamesense: 98,
      clutch: 90,
      utility: 98,
      aggression: 92
    },
    desc: 'Ateşli ve tutkulu kaptan; Major şampiyonu Vitality\'nin hücum ritmi ve enerji kaynağı.'
  },
  {
    id: 'electronic',
    name: 'electronic',
    teamName: 'Virtus.pro',
    country: 'RU',
    role: 'In-Game Leader (IGL)',
    tag: 'Aggro Leader',
    rating: 1.18,
    tier: 'S',
    perk: 'aggressive_entry',
    skills: {
      aim: 95,
      reflex: 94,
      headshot: 93,
      gamesense: 95,
      clutch: 92,
      utility: 91,
      aggression: 94
    },
    desc: 'Sert çatışma lideri; düşmanı ezen giriş baskısı ve takımı ateşleyen hücum kararları.'
  },
  {
    id: 'cadian',
    name: 'cadiaN',
    teamName: 'Astralis',
    country: 'DK',
    role: 'In-Game Leader (IGL)',
    tag: 'Passionate AWPer',
    rating: 1.16,
    tier: 'S',
    perk: 'tactical_mastermind',
    skills: {
      aim: 93,
      reflex: 94,
      headshot: 89,
      gamesense: 98,
      clutch: 99,
      utility: 97,
      aggression: 87
    },
    desc: 'Tutkulu AWP lideri; mucizevi 1v4 clutch\'lar ve takımı ayağa kaldıran liderlik alevi.'
  }
];

// DEFAULT STARTING LINEUPS
const DEFAULT_ROSTERS = {
  ct: [
    PRO_PLAYER_POOL.find(p => p.id === 's1mple'),
    PRO_PLAYER_POOL.find(p => p.id === 'b1t'),
    PRO_PLAYER_POOL.find(p => p.id === 'device'),
    PRO_PLAYER_POOL.find(p => p.id === 'rain'),
    PRO_PLAYER_POOL.find(p => p.id === 'twistzz')
  ],
  t: [
    PRO_PLAYER_POOL.find(p => p.id === 'zywoo'),
    PRO_PLAYER_POOL.find(p => p.id === 'niko'),
    PRO_PLAYER_POOL.find(p => p.id === 'm0nesy'),
    PRO_PLAYER_POOL.find(p => p.id === 'electronic'),
    PRO_PLAYER_POOL.find(p => p.id === 'ropz')
  ]
};

// PRESET SQUADS FOR QUICK SELECTION
const ROSTER_PRESETS = {
  all_stars: {
    name: '⭐ CS:GO All-Star Dream Team',
    desc: 'Tarihin gelmiş geçmiş en yüksek reytingli 5 süperstarı bir arada.',
    playerIds: ['s1mple', 'zywoo', 'niko', 'donk', 'ropz']
  },
  faze_clan: {
    name: '🛡️ FaZe Clan Major Champions',
    desc: 'Karrigan liderliğindeki efsanevi FaZe Clan kadrosu.',
    playerIds: ['broky', 'frozen', 'rain', 'ropz', 'karrigan']
  },
  vitality_gold: {
    name: '🐝 Team Vitality Golden Era',
    desc: 'ZywOo ve apEX önderliğinde Major kazanan Fransız-Uluslararası dev.',
    playerIds: ['zywoo', 'flamez', 'spinx', 'rain', 'apex']
  },
  spirit_titans: {
    name: '🐉 Team Spirit Major Titans',
    desc: 'Donk ve sh1ro ikilisinin durdurulamaz genç hücum gücü.',
    playerIds: ['sh1ro', 'donk', 'b1t', 'magixx', 'electronic']
  },
  navi_dynasty: {
    name: '🇺🇦 Natus Vincere Dynasty',
    desc: 'S1mple ve B1t\'in rekorlar kıran NaVi Major dönemi.',
    playerIds: ['s1mple', 'b1t', 'perfecto', 'electronic', 'twistzz']
  }
};

function calculateTeamStats(roster) {
  if (!roster || roster.length === 0) return { rating: 1.0, aim: 90, reflex: 90, gamesense: 90, clutch: 90, utility: 90 };
  const len = roster.length;
  const rating = (roster.reduce((sum, p) => sum + (p.rating || 1.15), 0) / len).toFixed(2);
  const aim = Math.round(roster.reduce((sum, p) => sum + (p.skills?.aim || 92), 0) / len);
  const reflex = Math.round(roster.reduce((sum, p) => sum + (p.skills?.reflex || 92), 0) / len);
  const gamesense = Math.round(roster.reduce((sum, p) => sum + (p.skills?.gamesense || 92), 0) / len);
  const clutch = Math.round(roster.reduce((sum, p) => sum + (p.skills?.clutch || 92), 0) / len);
  const utility = Math.round(roster.reduce((sum, p) => sum + (p.skills?.utility || 90), 0) / len);
  return { rating: Number(rating), aim, reflex, gamesense, clutch, utility };
}

module.exports = {
  ROSTERS: DEFAULT_ROSTERS,
  DEFAULT_ROSTERS,
  PRO_PLAYER_POOL,
  PERK_DEFINITIONS,
  ROSTER_PRESETS,
  calculateTeamStats
};
