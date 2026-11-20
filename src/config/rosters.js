// SimulatorX - Esports Team Owner / Manager Database: Tiered Player Pool, Market Prices & Perks
// Attributes (30 - 100 scale) directly dictate in-game hit probabilities, spray control, reaction time, and clutch panic.

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
  },
  raw_talent: {
    name: 'İşlenmemiş Elmas',
    icon: '💎',
    badge: 'RAW TALENT',
    desc: 'Genç akademi yeteneği; raunt içinde morali yüksekken anlık +15 aim patlaması yaşayabilir.',
    effect: 'Unpredictable burst of confidence and aim'
  },
  rookie_nervous: {
    name: 'Heyecanlı Çaylak',
    icon: '🐣',
    badge: 'ROOKIE',
    desc: 'Henüz tecrübesiz; büyük maçlarda ve kalabalık çatışmalarda spray kontrolünü kaybedebilir.',
    effect: 'Higher spray recoil penalty, lower clutch stability'
  }
};

// FULL PLAYER POOL CATEGORIZED BY TIERS
const PRO_PLAYER_POOL = [
  // ==========================================
  // TIER 4: AMATÖR & ÇAYLAKLAR (STARTER ROOKIES) - Aim: 38 - 56, Rating: 0.68 - 0.79
  // ==========================================
  {
    id: 'caner_noob',
    name: 'Caner (noobzaur)',
    teamName: 'Kulüp Akademisi',
    country: 'TR',
    role: 'AWPer',
    tag: 'Rookie AWP',
    rating: 0.73,
    tier: 'Çaylak',
    price: 7500,
    perk: 'rookie_nervous',
    skills: {
      aim: 42,
      reflex: 46,
      headshot: 40,
      gamesense: 44,
      clutch: 45,
      utility: 40,
      aggression: 55
    },
    desc: 'Takımın başlangıç keskin nişancısı; bazen kolay AWP vuruşlarını kaçırsa da öğrenmeye hevesli.'
  },
  {
    id: 'berk_rush',
    name: 'Berk (rushkid)',
    teamName: 'Kulüp Akademisi',
    country: 'TR',
    role: 'Entry Fragger',
    tag: 'Rookie Entry',
    rating: 0.78,
    tier: 'Çaylak',
    price: 11000,
    perk: 'aggressive_entry',
    skills: {
      aim: 52,
      reflex: 55,
      headshot: 48,
      gamesense: 38,
      clutch: 42,
      utility: 42,
      aggression: 80
    },
    desc: 'Korkusuzca site\'lara koşan çaylak girişçi; sprayi dağınık fakat ilk teması kurmaktan çekinmez.'
  },
  {
    id: 'efe_spray',
    name: 'Efe (crossmiss)',
    teamName: 'Kulüp Akademisi',
    country: 'TR',
    role: 'Lurker',
    tag: 'Rookie Rifler',
    rating: 0.74,
    tier: 'Çaylak',
    price: 8500,
    perk: 'rookie_nervous',
    skills: {
      aim: 46,
      reflex: 45,
      headshot: 42,
      gamesense: 45,
      clutch: 48,
      utility: 38,
      aggression: 50
    },
    desc: 'Harita arkalamayı seven genç oyuncu; panik anlarında tetiği bırakamayıp sprayi kaçırabilir.'
  },
  {
    id: 'murat_camper',
    name: 'Murat (camper)',
    teamName: 'Kulüp Akademisi',
    country: 'TR',
    role: 'Site Anchor',
    tag: 'Rookie Anchor',
    rating: 0.71,
    tier: 'Çaylak',
    price: 6500,
    perk: 'iron_anchor',
    skills: {
      aim: 40,
      reflex: 42,
      headshot: 38,
      gamesense: 52,
      clutch: 50,
      utility: 45,
      aggression: 45
    },
    desc: 'Bomba sahasında kutu arkasında pusuya yatan defans oyuncusu; sakin ama refleksleri zayıf.'
  },
  {
    id: 'tolga_strats',
    name: 'Tolga (strats)',
    teamName: 'Kulüp Akademisi',
    country: 'TR',
    role: 'In-Game Leader (IGL)',
    tag: 'Rookie IGL',
    rating: 0.70,
    tier: 'Çaylak',
    price: 6000,
    perk: 'tactical_mastermind',
    skills: {
      aim: 38,
      reflex: 40,
      headshot: 36,
      gamesense: 56,
      clutch: 46,
      utility: 52,
      aggression: 58
    },
    desc: 'Takımın taktik lideri; aimi zayıf kalsa da raunt başı sis ve flaş taktikleri çalıştırmayı sever.'
  },

  // RIVAL ACADEMY ROOKIES (T STARTING RIVALS)
  {
    id: 'sergei_cyka',
    name: 'Sergei (aimless)',
    teamName: 'Rival Academy',
    country: 'PL',
    role: 'AWPer',
    tag: 'Rookie AWP',
    rating: 0.74,
    tier: 'Çaylak',
    price: 8000,
    perk: 'rookie_nervous',
    skills: {
      aim: 44,
      reflex: 48,
      headshot: 42,
      gamesense: 45,
      clutch: 44,
      utility: 42,
      aggression: 52
    },
    desc: 'Rakip akademinin AWP oyuncusu; orta mesafede etkili fakat hızlı hedeflere karşı zorlanır.'
  },
  {
    id: 'marek_rush',
    name: 'Marek (b-rusher)',
    teamName: 'Rival Academy',
    country: 'CZ',
    role: 'Entry Fragger',
    tag: 'Rookie Entry',
    rating: 0.77,
    tier: 'Çaylak',
    price: 10500,
    perk: 'aggressive_entry',
    skills: {
      aim: 50,
      reflex: 54,
      headshot: 45,
      gamesense: 40,
      clutch: 40,
      utility: 40,
      aggression: 85
    },
    desc: 'B tüneline durmadan koşan agresif rakip oyuncu.'
  },
  {
    id: 'dmitri_spray',
    name: 'Dmitri (widepeek)',
    teamName: 'Rival Academy',
    country: 'UA',
    role: 'Lurker',
    tag: 'Rookie Lurker',
    rating: 0.73,
    tier: 'Çaylak',
    price: 7500,
    perk: 'rookie_nervous',
    skills: {
      aim: 45,
      reflex: 44,
      headshot: 40,
      gamesense: 48,
      clutch: 46,
      utility: 38,
      aggression: 50
    },
    desc: 'Geniş açılardan peek atan amatör tüfekçi.'
  },
  {
    id: 'ivan_corner',
    name: 'Ivan (baiter)',
    teamName: 'Rival Academy',
    country: 'BG',
    role: 'Site Anchor',
    tag: 'Rookie Anchor',
    rating: 0.72,
    tier: 'Çaylak',
    price: 7000,
    perk: 'iron_anchor',
    skills: {
      aim: 42,
      reflex: 43,
      headshot: 39,
      gamesense: 50,
      clutch: 50,
      utility: 44,
      aggression: 40
    },
    desc: 'Köşede arkadaşlarının düşmesini bekleyip takas almaya çalışan defans oyuncusu.'
  },
  {
    id: 'oleg_lead',
    name: 'Oleg (caller)',
    teamName: 'Rival Academy',
    country: 'RO',
    role: 'In-Game Leader (IGL)',
    tag: 'Rookie IGL',
    rating: 0.71,
    tier: 'Çaylak',
    price: 6500,
    perk: 'tactical_mastermind',
    skills: {
      aim: 40,
      reflex: 41,
      headshot: 38,
      gamesense: 54,
      clutch: 45,
      utility: 50,
      aggression: 55
    },
    desc: 'Amatör turnuvalarda takım kaptanlığı yapan tecrübesiz IGL.'
  },

  // ==========================================
  // TIER 3: GENÇ YETENEKLER (SCOUTED TALENTS / GEMS) - Aim: 65 - 78, Rating: 0.92 - 1.05
  // ==========================================
  {
    id: 'arda_flick',
    name: 'Arda (flickstar)',
    teamName: 'Genç Yetenek Havuzu',
    country: 'TR',
    role: 'AWPer',
    tag: 'Young Prospect',
    rating: 0.99,
    tier: 'Yetenek',
    price: 45000,
    perk: 'flick_king',
    skills: {
      aim: 72,
      reflex: 80,
      headshot: 68,
      gamesense: 70,
      clutch: 72,
      utility: 66,
      aggression: 76
    },
    desc: 'FACEIT seviyesinde parlayan 17 yaşındaki Türk AWP yeteneği; refleksleri çok yüksek.'
  },
  {
    id: 'mzinho',
    name: 'mzinho',
    teamName: 'The MongolZ',
    country: 'MN',
    role: 'Lurker',
    tag: 'Mongol Gem',
    rating: 1.04,
    tier: 'Yetenek',
    price: 75000,
    perk: 'raw_talent',
    skills: {
      aim: 78,
      reflex: 79,
      headshot: 76,
      gamesense: 74,
      clutch: 77,
      utility: 70,
      aggression: 80
    },
    desc: 'Moğolistan\'ın yükselen genç starı; akıcı spray kontrolü ve sürpriz açılardan yakalama kabiliyeti.'
  },
  {
    id: 'sl3nd',
    name: 'sl3nd',
    teamName: 'GamerLegion',
    country: 'HU',
    role: 'AWPer',
    tag: 'Scouted AWPer',
    rating: 1.02,
    tier: 'Yetenek',
    price: 68000,
    perk: 'flick_king',
    skills: {
      aim: 75,
      reflex: 81,
      headshot: 69,
      gamesense: 72,
      clutch: 75,
      utility: 68,
      aggression: 70
    },
    desc: 'Macar genç keskin nişancı; hızlı peekleri ve no-scope isabetiyle dikkat çekiyor.'
  },
  {
    id: 'r1nkle',
    name: 'r1nkle',
    teamName: 'Ninjas in Pyjamas',
    country: 'UA',
    role: 'AWPer',
    tag: 'Rising Sniper',
    rating: 1.05,
    tier: 'Yetenek',
    price: 85000,
    perk: 'ice_clutch',
    skills: {
      aim: 77,
      reflex: 82,
      headshot: 72,
      gamesense: 76,
      clutch: 80,
      utility: 72,
      aggression: 65
    },
    desc: 'Avrupa sahnesinde hızla yükselen yetenekli Ukraynalı AWPer; clutch anlarında çok soğukkanlı.'
  },
  {
    id: 'kyousuke',
    name: 'Kuzey (onetap)',
    teamName: 'Genç Yetenek Havuzu',
    country: 'TR',
    role: 'Entry Fragger',
    tag: 'Rifle Prospect',
    rating: 1.03,
    tier: 'Yetenek',
    price: 70000,
    perk: 'onetap_god',
    skills: {
      aim: 79,
      reflex: 78,
      headshot: 82,
      gamesense: 68,
      clutch: 70,
      utility: 65,
      aggression: 85
    },
    desc: 'Yüksek ilk mermi isabetine sahip genç Türk fragger; potansiyeli çok yüksek.'
  },

  // ==========================================
  // TIER 2: DENEYİMLİ PROFESYONELLER (SOLID PROS) - Aim: 82 - 93, Rating: 1.10 - 1.22
  // ==========================================
  {
    id: 'rain',
    name: 'rain',
    teamName: 'FaZe Clan',
    country: 'NO',
    role: 'Site Anchor',
    tag: 'Granite Anchor',
    rating: 1.17,
    tier: 'Profesyonel',
    price: 350000,
    perk: 'iron_anchor',
    skills: {
      aim: 91,
      reflex: 89,
      headshot: 90,
      gamesense: 93,
      clutch: 92,
      utility: 88,
      aggression: 84
    },
    desc: 'Bomba alanlarının yıkılmaz kalesi; Major MVP, paniksiz alan savunması ve spray ustalığı.'
  },
  {
    id: 'device',
    name: 'device',
    teamName: 'Astralis',
    country: 'DK',
    role: 'AWPer',
    tag: 'Mr. Consistency',
    rating: 1.22,
    tier: 'Profesyonel',
    price: 450000,
    perk: 'smoke_criminal',
    skills: {
      aim: 92,
      reflex: 91,
      headshot: 88,
      gamesense: 96,
      clutch: 94,
      utility: 93,
      aggression: 55
    },
    desc: 'Bay Tutarlılık; mükemmel crosshair yerleşimi, hatasız pozisyon alma ve 4 Major şampiyonluğu.'
  },
  {
    id: 'twistzz',
    name: 'Twistzz',
    teamName: 'Team Liquid',
    country: 'CA',
    role: 'In-Game Leader (IGL)',
    tag: 'The Magician',
    rating: 1.21,
    tier: 'Profesyonel',
    price: 420000,
    perk: 'tactical_mastermind',
    skills: {
      aim: 94,
      reflex: 92,
      headshot: 96,
      gamesense: 95,
      clutch: 93,
      utility: 94,
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
    rating: 1.08,
    tier: 'Profesyonel',
    price: 280000,
    perk: 'tactical_mastermind',
    skills: {
      aim: 82,
      reflex: 84,
      headshot: 80,
      gamesense: 99,
      clutch: 88,
      utility: 99,
      aggression: 86
    },
    desc: 'CS tarihinin en büyük saha içi lideri; raunt ortası dahi okumaları ve kusursuz stratejiler.'
  },
  {
    id: 'sh1ro',
    name: 'sh1ro',
    teamName: 'Team Spirit',
    country: 'RU',
    role: 'AWPer',
    tag: 'Ice Sniper',
    rating: 1.24,
    tier: 'Profesyonel',
    price: 520000,
    perk: 'ice_clutch',
    skills: {
      aim: 94,
      reflex: 93,
      headshot: 88,
      gamesense: 96,
      clutch: 96,
      utility: 91,
      aggression: 52
    },
    desc: 'Soğukkanlı keskin nişancı; düşük hata payı, disiplinli crosshair ve clutch güvenilirliği.'
  },
  {
    id: 'frozen',
    name: 'frozen',
    teamName: 'FaZe Clan',
    country: 'SK',
    role: 'Lurker',
    tag: 'Cold Blooded',
    rating: 1.21,
    tier: 'Profesyonel',
    price: 400000,
    perk: 'ice_clutch',
    skills: {
      aim: 93,
      reflex: 92,
      headshot: 92,
      gamesense: 94,
      clutch: 94,
      utility: 90,
      aggression: 74
    },
    desc: 'Mükemmel çok yönlü oyuncu; soğukkanlı çatışma yönetimi ve yüksek rating tutarlılığı.'
  },
  {
    id: 'flamez',
    name: 'flameZ',
    teamName: 'Team Vitality',
    country: 'IL',
    role: 'Entry Fragger',
    tag: 'The Spark',
    rating: 1.19,
    tier: 'Profesyonel',
    price: 360000,
    perk: 'aggressive_entry',
    skills: {
      aim: 92,
      reflex: 94,
      headshot: 91,
      gamesense: 89,
      clutch: 88,
      utility: 86,
      aggression: 92
    },
    desc: 'Patlayıcı giriş gücü; raunt başı ilk kanı alma yeteneği ve yüksek tempoda çatışma.'
  },

  // ==========================================
  // TIER 1: SÜPERSTARLAR & EFSANELER (WORLD-CLASS S+ TITANS) - Aim: 96 - 100, Rating: 1.25 - 1.35
  // ==========================================
  {
    id: 's1mple',
    name: 's1mple',
    teamName: 'Natus Vincere',
    country: 'UA',
    role: 'AWPer',
    tag: 'GOAT AWPer',
    rating: 1.33,
    tier: 'S+',
    price: 1500000,
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
    price: 1650000,
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
    id: 'niko',
    name: 'NiKo',
    teamName: 'G2 Esports',
    country: 'BA',
    role: 'Entry Fragger',
    tag: 'Rifle King',
    rating: 1.27,
    tier: 'S+',
    price: 1300000,
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
    price: 1600000,
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
    desc: 'Durdurulamaz genç süperstar; agresif peekleri, yüksek spray kontrolü ve acımasız baskısı.'
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
    price: 1400000,
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
    id: 'b1t',
    name: 'b1t',
    teamName: 'Natus Vincere',
    country: 'UA',
    role: 'Entry Fragger',
    tag: 'Headshot Machine',
    rating: 1.20,
    tier: 'S+',
    price: 950000,
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
    id: 'ropz',
    name: 'ropz',
    teamName: 'FaZe Clan',
    country: 'EE',
    role: 'Lurker',
    tag: 'Silent Ghost',
    rating: 1.26,
    tier: 'S+',
    price: 1200000,
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
  }
];

// DEFAULT STARTING LINEUPS - AUTHENTIC ROOKIE / STARTER TEAMS!
// Users start from grassroots with an amateur club and rookie players!
const DEFAULT_ROSTERS = {
  ct: [
    PRO_PLAYER_POOL.find(p => p.id === 'caner_noob'),
    PRO_PLAYER_POOL.find(p => p.id === 'berk_rush'),
    PRO_PLAYER_POOL.find(p => p.id === 'efe_spray'),
    PRO_PLAYER_POOL.find(p => p.id === 'murat_camper'),
    PRO_PLAYER_POOL.find(p => p.id === 'tolga_strats')
  ],
  t: [
    PRO_PLAYER_POOL.find(p => p.id === 'sergei_cyka'),
    PRO_PLAYER_POOL.find(p => p.id === 'marek_rush'),
    PRO_PLAYER_POOL.find(p => p.id === 'dmitri_spray'),
    PRO_PLAYER_POOL.find(p => p.id === 'ivan_corner'),
    PRO_PLAYER_POOL.find(p => p.id === 'oleg_lead')
  ]
};

// PRESET SQUADS (FOR TESTING & LEGENDARY EXHIBITIONS)
const ROSTER_PRESETS = {
  starter_grassroots: {
    name: '🌱 Başlangıç Çaylak Kadrosu',
    desc: 'Kulübün ilk kurulduğu günkü hevesli ama tecrübesiz akademi oyuncuları.',
    playerIds: ['caner_noob', 'berk_rush', 'efe_spray', 'murat_camper', 'tolga_strats']
  },
  young_scouts: {
    name: '💎 Genç Yetenekler (Scout Karması)',
    desc: 'Avrupa ve Asya\'dan keşfedilmiş geleceğin yıldız adayları.',
    playerIds: ['arda_flick', 'kyousuke', 'mzinho', 'sl3nd', 'r1nkle']
  },
  all_stars: {
    name: '⭐ CS:GO All-Star Dream Team',
    desc: 'Tarihin gelmiş geçmiş en yüksek reytingli 5 süperstarı bir arada.',
    playerIds: ['s1mple', 'zywoo', 'niko', 'donk', 'ropz']
  },
  faze_clan: {
    name: '🛡️ FaZe Clan Major Champions',
    desc: 'Karrigan liderliğindeki efsanevi FaZe Clan kadrosu.',
    playerIds: ['device', 'frozen', 'rain', 'ropz', 'karrigan']
  },
  navi_dynasty: {
    name: '🇺🇦 Natus Vincere Dynasty',
    desc: 'S1mple ve B1t\'in rekorlar kıran NaVi Major dönemi.',
    playerIds: ['s1mple', 'b1t', 'twistzz', 'donk', 'karrigan']
  }
};

function calculateTeamStats(roster) {
  if (!roster || roster.length === 0) return { rating: 0.70, aim: 45, reflex: 45, gamesense: 45, clutch: 45, utility: 45 };
  const len = roster.length;
  const rating = (roster.reduce((sum, p) => sum + (p.rating || 0.75), 0) / len).toFixed(2);
  const aim = Math.round(roster.reduce((sum, p) => sum + (p.skills?.aim || 45), 0) / len);
  const reflex = Math.round(roster.reduce((sum, p) => sum + (p.skills?.reflex || 45), 0) / len);
  const gamesense = Math.round(roster.reduce((sum, p) => sum + (p.skills?.gamesense || 45), 0) / len);
  const clutch = Math.round(roster.reduce((sum, p) => sum + (p.skills?.clutch || 45), 0) / len);
  const utility = Math.round(roster.reduce((sum, p) => sum + (p.skills?.utility || 45), 0) / len);
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
