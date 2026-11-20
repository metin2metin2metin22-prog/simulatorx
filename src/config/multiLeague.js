// SimulatorX - Multi-Tier Esports League System Configuration
// Defines 3 progressive competitive tiers: Amatör Lig, Challenger Lig, and Pro Espor Ligi.

const { PRO_PLAYER_POOL } = require('./rosters');

// Predefined rosters for amateur and challenger bot teams
const AMATEUR_BOT_TEAMS = [
  {
    id: 'bot_kadikoy_bulls',
    name: 'Kadıköy Bulls',
    shortTag: 'BULLS',
    icon: '🐂',
    country: 'TR',
    color: '#c0392b',
    coachName: 'Alper "bull" Kara',
    rating: 0.94,
    roster: [
      { name: 'Oğuz "sniper" Demir', role: 'AWPer', rating: 0.95, skills: { aim: 58, reflex: 57, headshot: 54, gamesense: 56, clutch: 52, utility: 48, aggression: 60 }, perk: 'flick_king' },
      { name: 'Tolga "entry" Yıldız', role: 'Entry Fragger', rating: 0.94, skills: { aim: 60, reflex: 59, headshot: 58, gamesense: 52, clutch: 50, utility: 45, aggression: 82 }, perk: 'aggressive_entry' },
      { name: 'Kaan "star" Çelik', role: 'Rifler', rating: 0.93, skills: { aim: 56, reflex: 55, headshot: 53, gamesense: 54, clutch: 51, utility: 46, aggression: 65 }, perk: 'raw_talent' },
      { name: 'Sarp "anchor" Kaya', role: 'Site Anchor', rating: 0.94, skills: { aim: 54, reflex: 52, headshot: 50, gamesense: 58, clutch: 55, utility: 52, aggression: 45 }, perk: 'iron_anchor' },
      { name: 'Alper "igl" Çetin', role: 'In-Game Leader (IGL)', rating: 0.92, skills: { aim: 52, reflex: 50, headshot: 48, gamesense: 60, clutch: 54, utility: 54, aggression: 50 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_ege_thunder',
    name: 'Ege Thunder',
    shortTag: 'THUNDER',
    icon: '⚡',
    country: 'TR',
    color: '#f39c12',
    coachName: 'Barış "volt" Şen',
    rating: 0.95,
    roster: [
      { name: 'Efe "zeus" Doğan', role: 'AWPer', rating: 0.96, skills: { aim: 62, reflex: 60, headshot: 56, gamesense: 58, clutch: 54, utility: 50, aggression: 62 }, perk: 'flick_king' },
      { name: 'Burak "rush" Koç', role: 'Entry Fragger', rating: 0.95, skills: { aim: 61, reflex: 60, headshot: 59, gamesense: 54, clutch: 52, utility: 46, aggression: 84 }, perk: 'aggressive_entry' },
      { name: 'Yiğit "blade" Aksoy', role: 'Rifler', rating: 0.94, skills: { aim: 58, reflex: 56, headshot: 55, gamesense: 55, clutch: 53, utility: 48, aggression: 68 }, perk: 'raw_talent' },
      { name: 'Doruk "rock" Yavuz', role: 'Site Anchor', rating: 0.94, skills: { aim: 55, reflex: 53, headshot: 52, gamesense: 59, clutch: 56, utility: 53, aggression: 46 }, perk: 'iron_anchor' },
      { name: 'Mert "brain" Şahin', role: 'In-Game Leader (IGL)', rating: 0.93, skills: { aim: 54, reflex: 52, headshot: 50, gamesense: 62, clutch: 55, utility: 55, aggression: 52 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_karadeniz_firtina',
    name: 'Karadeniz Fırtınası',
    shortTag: 'FIRTINA',
    icon: '🌊',
    country: 'TR',
    color: '#2980b9',
    coachName: 'Emre "wave" Kurt',
    rating: 0.93,
    roster: [
      { name: 'Hakan "storm" Polat', role: 'AWPer', rating: 0.94, skills: { aim: 59, reflex: 58, headshot: 54, gamesense: 56, clutch: 53, utility: 49, aggression: 60 }, perk: 'flick_king' },
      { name: 'Ozan "flash" Aslan', role: 'Entry Fragger', rating: 0.93, skills: { aim: 58, reflex: 57, headshot: 56, gamesense: 52, clutch: 49, utility: 44, aggression: 80 }, perk: 'aggressive_entry' },
      { name: 'Berk "pulse" Öztürk', role: 'Rifler', rating: 0.93, skills: { aim: 56, reflex: 55, headshot: 53, gamesense: 54, clutch: 52, utility: 47, aggression: 66 }, perk: 'raw_talent' },
      { name: 'Umut "wall" Demir', role: 'Site Anchor', rating: 0.93, skills: { aim: 53, reflex: 51, headshot: 50, gamesense: 57, clutch: 54, utility: 51, aggression: 44 }, perk: 'iron_anchor' },
      { name: 'Deniz "chief" Kaya', role: 'In-Game Leader (IGL)', rating: 0.92, skills: { aim: 51, reflex: 50, headshot: 48, gamesense: 59, clutch: 53, utility: 53, aggression: 50 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_anadolu_genclik',
    name: 'Anadolu Gençlik',
    shortTag: 'ANG',
    icon: '🦅',
    country: 'TR',
    color: '#16a085',
    coachName: 'Murat "kartal" Yılmaz',
    rating: 0.92,
    roster: [
      { name: 'Cem "falcon" Çelik', role: 'AWPer', rating: 0.93, skills: { aim: 57, reflex: 56, headshot: 52, gamesense: 55, clutch: 51, utility: 47, aggression: 58 }, perk: 'flick_king' },
      { name: 'Tuna "strike" Şen', role: 'Entry Fragger', rating: 0.92, skills: { aim: 56, reflex: 55, headshot: 54, gamesense: 51, clutch: 48, utility: 43, aggression: 78 }, perk: 'aggressive_entry' },
      { name: 'Arda "razor" Yıldız', role: 'Rifler', rating: 0.92, skills: { aim: 55, reflex: 54, headshot: 52, gamesense: 53, clutch: 50, utility: 46, aggression: 64 }, perk: 'raw_talent' },
      { name: 'Kerem "shield" Çetin', role: 'Site Anchor', rating: 0.92, skills: { aim: 52, reflex: 50, headshot: 49, gamesense: 56, clutch: 53, utility: 50, aggression: 43 }, perk: 'iron_anchor' },
      { name: 'Can "master" Aksoy', role: 'In-Game Leader (IGL)', rating: 0.91, skills: { aim: 50, reflex: 49, headshot: 47, gamesense: 58, clutch: 52, utility: 52, aggression: 48 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_toros_kaplanlari',
    name: 'Toros Kaplanları',
    shortTag: 'TOROS',
    icon: '🐯',
    country: 'TR',
    color: '#d35400',
    coachName: 'Burak "kaplan" Doğan',
    rating: 0.96,
    roster: [
      { name: 'Sinan "tiger" Koç', role: 'AWPer', rating: 0.97, skills: { aim: 63, reflex: 61, headshot: 58, gamesense: 59, clutch: 56, utility: 51, aggression: 64 }, perk: 'flick_king' },
      { name: 'Görkem "claw" Aslan', role: 'Entry Fragger', rating: 0.96, skills: { aim: 63, reflex: 62, headshot: 60, gamesense: 55, clutch: 53, utility: 47, aggression: 86 }, perk: 'aggressive_entry' },
      { name: 'Selim "fang" Yavuz', role: 'Rifler', rating: 0.95, skills: { aim: 59, reflex: 58, headshot: 56, gamesense: 56, clutch: 54, utility: 49, aggression: 70 }, perk: 'raw_talent' },
      { name: 'Volkan "fort" Şahin', role: 'Site Anchor', rating: 0.95, skills: { aim: 56, reflex: 54, headshot: 53, gamesense: 60, clutch: 57, utility: 54, aggression: 48 }, perk: 'iron_anchor' },
      { name: 'Onur "tactician" Kurt', role: 'In-Game Leader (IGL)', rating: 0.94, skills: { aim: 55, reflex: 53, headshot: 51, gamesense: 63, clutch: 56, utility: 56, aggression: 53 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_bogazici_esports',
    name: 'Boğaziçi Esports',
    shortTag: 'BOGAZ',
    icon: '🏛️',
    country: 'TR',
    color: '#8e44ad',
    coachName: 'Selim "bosphorus" Polat',
    rating: 0.94,
    roster: [
      { name: 'Metin "hawk" Öztürk', role: 'AWPer', rating: 0.95, skills: { aim: 60, reflex: 59, headshot: 55, gamesense: 57, clutch: 53, utility: 49, aggression: 61 }, perk: 'flick_king' },
      { name: 'Batu "titan" Demir', role: 'Entry Fragger', rating: 0.94, skills: { aim: 59, reflex: 58, headshot: 57, gamesense: 53, clutch: 51, utility: 45, aggression: 81 }, perk: 'aggressive_entry' },
      { name: 'Kadir "snipe" Kaya', role: 'Rifler', rating: 0.93, skills: { aim: 57, reflex: 56, headshot: 54, gamesense: 55, clutch: 52, utility: 48, aggression: 67 }, perk: 'raw_talent' },
      { name: 'Enes "guard" Çelik', role: 'Site Anchor', rating: 0.94, skills: { aim: 54, reflex: 52, headshot: 51, gamesense: 58, clutch: 55, utility: 52, aggression: 45 }, perk: 'iron_anchor' },
      { name: 'Tarik "commander" Şen', role: 'In-Game Leader (IGL)', rating: 0.93, skills: { aim: 53, reflex: 51, headshot: 49, gamesense: 61, clutch: 55, utility: 54, aggression: 51 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_mezopotamya_stars',
    name: 'Mezopotamya Stars',
    shortTag: 'MEZO',
    icon: '🌟',
    country: 'TR',
    color: '#e67e22',
    coachName: 'Yusuf "star" Yıldız',
    rating: 0.93,
    roster: [
      { name: 'Ferhat "comet" Çetin', role: 'AWPer', rating: 0.94, skills: { aim: 58, reflex: 57, headshot: 53, gamesense: 56, clutch: 52, utility: 48, aggression: 59 }, perk: 'flick_king' },
      { name: 'Hamza "blaze" Aksoy', role: 'Entry Fragger', rating: 0.93, skills: { aim: 58, reflex: 57, headshot: 56, gamesense: 52, clutch: 50, utility: 44, aggression: 80 }, perk: 'aggressive_entry' },
      { name: 'Baran "spark" Doğan', role: 'Rifler', rating: 0.93, skills: { aim: 56, reflex: 55, headshot: 53, gamesense: 54, clutch: 51, utility: 47, aggression: 65 }, perk: 'raw_talent' },
      { name: 'İsmail "pillar" Koç', role: 'Site Anchor', rating: 0.93, skills: { aim: 53, reflex: 51, headshot: 50, gamesense: 57, clutch: 54, utility: 51, aggression: 44 }, perk: 'iron_anchor' },
      { name: 'Mahmut "leader" Aslan', role: 'In-Game Leader (IGL)', rating: 0.92, skills: { aim: 52, reflex: 50, headshot: 48, gamesense: 60, clutch: 54, utility: 53, aggression: 50 }, perk: 'tactical_mastermind' }
    ]
  }
];

// Tier 2: Challenger Division Teams
const CHALLENGER_BOT_TEAMS = [
  {
    id: 'bot_sangal',
    name: 'Sangal Esports',
    shortTag: 'SAN',
    icon: '🔴',
    country: 'TR',
    color: '#e74c3c',
    coachName: 'Jimmy "Klisba" O\'Hanlon',
    rating: 1.09,
    roster: [
      { name: 'Dawid "Sapec" Bober', role: 'AWPer', rating: 1.10, skills: { aim: 82, reflex: 80, headshot: 76, gamesense: 78, clutch: 74, utility: 70, aggression: 70 }, perk: 'flick_king' },
      { name: 'Yasin "xfl0ud" Koç', role: 'Entry Fragger', rating: 1.11, skills: { aim: 85, reflex: 84, headshot: 82, gamesense: 75, clutch: 72, utility: 68, aggression: 88 }, perk: 'aggressive_entry' },
      { name: 'Can "kyxsan" Kırım', role: 'Rifler', rating: 1.08, skills: { aim: 78, reflex: 77, headshot: 75, gamesense: 77, clutch: 75, utility: 72, aggression: 72 }, perk: 'raw_talent' },
      { name: 'Ilya "Ganginho" Smirnov', role: 'Site Anchor', rating: 1.08, skills: { aim: 76, reflex: 75, headshot: 73, gamesense: 82, clutch: 79, utility: 76, aggression: 55 }, perk: 'iron_anchor' },
      { name: 'Robin "ScrunK" Röpke', role: 'In-Game Leader (IGL)', rating: 1.06, skills: { aim: 74, reflex: 72, headshot: 70, gamesense: 85, clutch: 78, utility: 80, aggression: 60 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_bbl',
    name: 'BBL Esports',
    shortTag: 'BBL',
    icon: '🦁',
    country: 'TR',
    color: '#f1c40f',
    coachName: 'Vlad "Vlad" Karpenko',
    rating: 1.08,
    roster: [
      { name: 'Ömer "imoRR" Karataş', role: 'AWPer', rating: 1.11, skills: { aim: 84, reflex: 83, headshot: 80, gamesense: 77, clutch: 75, utility: 71, aggression: 76 }, perk: 'flick_king' },
      { name: 'Asil "skyye" Gökay', role: 'Entry Fragger', rating: 1.08, skills: { aim: 81, reflex: 80, headshot: 78, gamesense: 74, clutch: 71, utility: 67, aggression: 85 }, perk: 'aggressive_entry' },
      { name: 'Batuhan "russ" Karahan', role: 'Rifler', rating: 1.07, skills: { aim: 79, reflex: 78, headshot: 76, gamesense: 75, clutch: 73, utility: 70, aggression: 73 }, perk: 'raw_talent' },
      { name: 'Uğur "Ruxic" Güç', role: 'Site Anchor', rating: 1.07, skills: { aim: 76, reflex: 74, headshot: 72, gamesense: 81, clutch: 77, utility: 74, aggression: 54 }, perk: 'iron_anchor' },
      { name: 'Semih "Legro" Çakır', role: 'In-Game Leader (IGL)', rating: 1.06, skills: { aim: 73, reflex: 71, headshot: 69, gamesense: 84, clutch: 76, utility: 78, aggression: 58 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_fut',
    name: 'FUT Esports',
    shortTag: 'FUT',
    icon: '🐺',
    country: 'TR',
    color: '#e67e22',
    coachName: 'SunPayus "Coach" Alvarez',
    rating: 1.09,
    roster: [
      { name: 'Emir "qRaxs" Nesil', role: 'AWPer', rating: 1.10, skills: { aim: 83, reflex: 81, headshot: 77, gamesense: 78, clutch: 76, utility: 71, aggression: 72 }, perk: 'flick_king' },
      { name: 'Doğukan "qpert" Dural', role: 'Entry Fragger', rating: 1.09, skills: { aim: 82, reflex: 81, headshot: 80, gamesense: 75, clutch: 73, utility: 68, aggression: 87 }, perk: 'aggressive_entry' },
      { name: 'Ata "ATA KAPTAN" Tan', role: 'Rifler', rating: 1.08, skills: { aim: 80, reflex: 79, headshot: 77, gamesense: 76, clutch: 74, utility: 71, aggression: 74 }, perk: 'raw_talent' },
      { name: 'Eray "yetujey" Budak', role: 'Site Anchor', rating: 1.09, skills: { aim: 78, reflex: 76, headshot: 75, gamesense: 83, clutch: 79, utility: 76, aggression: 56 }, perk: 'iron_anchor' },
      { name: 'Furkan "MrFaliN" Yeğen', role: 'In-Game Leader (IGL)', rating: 1.07, skills: { aim: 75, reflex: 73, headshot: 71, gamesense: 86, clutch: 78, utility: 80, aggression: 60 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_aurora',
    name: 'Aurora Gaming',
    shortTag: 'AUR',
    icon: '❄️',
    country: 'EU',
    color: '#00d2ff',
    coachName: 'Brain "Brain" Morozov',
    rating: 1.08,
    roster: [
      { name: 'Denis "deko" Zhukov', role: 'AWPer', rating: 1.12, skills: { aim: 87, reflex: 85, headshot: 78, gamesense: 80, clutch: 78, utility: 72, aggression: 73 }, perk: 'flick_king' },
      { name: 'Evgeny "Norwi" Ermolin', role: 'Entry Fragger', rating: 1.08, skills: { aim: 81, reflex: 80, headshot: 79, gamesense: 74, clutch: 72, utility: 68, aggression: 86 }, perk: 'aggressive_entry' },
      { name: 'Aleksandr "KENSI" Gurkin', role: 'Rifler', rating: 1.08, skills: { aim: 80, reflex: 79, headshot: 77, gamesense: 76, clutch: 74, utility: 71, aggression: 75 }, perk: 'raw_talent' },
      { name: 'Viktor "Lack1" Boldyrev', role: 'Site Anchor', rating: 1.06, skills: { aim: 75, reflex: 74, headshot: 72, gamesense: 81, clutch: 76, utility: 74, aggression: 53 }, perk: 'iron_anchor' },
      { name: 'Ivan "SELLTER" Drobyshev', role: 'In-Game Leader (IGL)', rating: 1.05, skills: { aim: 73, reflex: 71, headshot: 69, gamesense: 83, clutch: 75, utility: 77, aggression: 58 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_apeks',
    name: 'Apeks',
    shortTag: 'APEKS',
    icon: '🦍',
    country: 'NO',
    color: '#e67e22',
    coachName: 'Torbjørn "MithR" Nyborg',
    rating: 1.07,
    roster: [
      { name: 'Tim "nawwk" Jonasson', role: 'AWPer', rating: 1.10, skills: { aim: 83, reflex: 82, headshot: 77, gamesense: 79, clutch: 76, utility: 72, aggression: 71 }, perk: 'flick_king' },
      { name: 'Joakim "jkaem" Myrbostad', role: 'Entry Fragger', rating: 1.10, skills: { aim: 84, reflex: 83, headshot: 82, gamesense: 76, clutch: 73, utility: 69, aggression: 89 }, perk: 'aggressive_entry' },
      { name: 'Justinas "jL" Lekavicius', role: 'Rifler', rating: 1.08, skills: { aim: 81, reflex: 80, headshot: 78, gamesense: 76, clutch: 74, utility: 72, aggression: 76 }, perk: 'raw_talent' },
      { name: 'Martin "STYKO" Styk', role: 'Site Anchor', rating: 1.06, skills: { aim: 75, reflex: 74, headshot: 73, gamesense: 82, clutch: 78, utility: 78, aggression: 52 }, perk: 'iron_anchor' },
      { name: 'Damjan "kyxsan" Stoilkovski', role: 'In-Game Leader (IGL)', rating: 1.06, skills: { aim: 74, reflex: 72, headshot: 70, gamesense: 85, clutch: 77, utility: 80, aggression: 59 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_big_academy',
    name: 'BIG Academy',
    shortTag: 'BIG.A',
    icon: '🇩🇪',
    country: 'DE',
    color: '#34495e',
    coachName: 'Tugay "TuGuX" Keskin',
    rating: 1.06,
    roster: [
      { name: 'Marcel "hyped" Köhn', role: 'AWPer', rating: 1.08, skills: { aim: 80, reflex: 79, headshot: 75, gamesense: 77, clutch: 74, utility: 70, aggression: 70 }, perk: 'flick_king' },
      { name: 'David "prosus" Hesse', role: 'Entry Fragger', rating: 1.07, skills: { aim: 80, reflex: 79, headshot: 77, gamesense: 74, clutch: 71, utility: 67, aggression: 85 }, perk: 'aggressive_entry' },
      { name: 'Elias "s1n" Stein', role: 'Rifler', rating: 1.06, skills: { aim: 78, reflex: 77, headshot: 75, gamesense: 75, clutch: 73, utility: 71, aggression: 72 }, perk: 'raw_talent' },
      { name: 'Tom "skyye" Hagedorn', role: 'Site Anchor', rating: 1.05, skills: { aim: 74, reflex: 73, headshot: 71, gamesense: 80, clutch: 75, utility: 73, aggression: 53 }, perk: 'iron_anchor' },
      { name: 'Luca "pr1metapz" Voigt', role: 'In-Game Leader (IGL)', rating: 1.04, skills: { aim: 72, reflex: 70, headshot: 68, gamesense: 82, clutch: 74, utility: 76, aggression: 57 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_endpoint',
    name: 'Team Endpoint',
    shortTag: 'END',
    icon: '⚔️',
    country: 'UK',
    color: '#27ae60',
    coachName: 'Allan "Allan" Hender',
    rating: 1.05,
    roster: [
      { name: 'Miłosz "mhL" Knasiak', role: 'AWPer', rating: 1.08, skills: { aim: 81, reflex: 80, headshot: 76, gamesense: 77, clutch: 74, utility: 70, aggression: 71 }, perk: 'flick_king' },
      { name: 'Kia "Surreal" Man', role: 'Entry Fragger', rating: 1.06, skills: { aim: 78, reflex: 77, headshot: 76, gamesense: 73, clutch: 70, utility: 66, aggression: 84 }, perk: 'aggressive_entry' },
      { name: 'Joey "CRUC1AL" Steusel', role: 'Rifler', rating: 1.05, skills: { aim: 77, reflex: 76, headshot: 74, gamesense: 74, clutch: 72, utility: 70, aggression: 71 }, perk: 'raw_talent' },
      { name: 'Thomas "Thomas" Utting', role: 'Site Anchor', rating: 1.05, skills: { aim: 74, reflex: 73, headshot: 71, gamesense: 80, clutch: 75, utility: 74, aggression: 53 }, perk: 'iron_anchor' },
      { name: 'Max "MiGHTYMAX" Heath', role: 'In-Game Leader (IGL)', rating: 1.04, skills: { aim: 72, reflex: 70, headshot: 68, gamesense: 82, clutch: 74, utility: 76, aggression: 57 }, perk: 'tactical_mastermind' }
    ]
  }
];

// Tier 1: Pro Espor Süper Ligi (Pro Champions League)
const PRO_BOT_TEAMS = [
  {
    id: 'eternal_fire',
    name: 'Eternal Fire',
    shortTag: 'EF',
    icon: '🔥',
    country: 'TR',
    color: '#e74c3c',
    coachName: 'Sezgin "Fabre" Kalaycı',
    rating: 1.22,
    playerIds: ['xantares', 'woxic', 'wicadia', 'calyx', 'maj3r']
  },
  {
    id: 'faze_clan',
    name: 'FaZe Clan',
    shortTag: 'FaZe',
    icon: '🛡️',
    country: 'EU',
    color: '#e74c3c',
    coachName: 'Filip "NEO" Kubski',
    rating: 1.25,
    playerIds: ['karrigan', 'rain', 'broky', 'frozen', 'ropz']
  },
  {
    id: 'navi',
    name: 'Natus Vincere',
    shortTag: 'NAVI',
    icon: '🇺🇦',
    country: 'UA',
    color: '#f1c40f',
    coachName: 'Andrey "B1ad3" Gorodenskiy',
    rating: 1.26,
    playerIds: ['aleksib', 'im', 'b1t', 's1mple', 'w0nderful']
  },
  {
    id: 'vitality',
    name: 'Team Vitality',
    shortTag: 'VIT',
    icon: '🐝',
    country: 'FR',
    color: '#f39c12',
    coachName: 'Rémy "XTQZZZ" Quoniam',
    rating: 1.28,
    playerIds: ['zywoo', 'apex', 'spinx', 'flamez', 'mezii']
  },
  {
    id: 'spirit',
    name: 'Team Spirit',
    shortTag: 'SPIRIT',
    icon: '🐉',
    country: 'CIS',
    color: '#2ecc71',
    coachName: 'Sergey "hally" Shavaev',
    rating: 1.27,
    playerIds: ['chopper', 'donk', 'sh1ro', 'magixx', 'zont1x']
  },
  {
    id: 'g2_esports',
    name: 'G2 Esports',
    shortTag: 'G2',
    icon: '⚔️',
    country: 'EU',
    color: '#ffffff',
    coachName: 'Wiktor "TaZ" Wojtas',
    rating: 1.24,
    playerIds: ['snax', 'niko', 'm0nesy', 'hunter', 'malbsmd']
  },
  {
    id: 'mouz',
    name: 'MOUZ',
    shortTag: 'MOUZ',
    icon: '🐭',
    country: 'EU',
    color: '#e74c3c',
    coachName: 'Dennis "sycrone" Nielsen',
    rating: 1.23,
    playerIds: ['siuhy', 'torzsi', 'xertion', 'jimpphat', 'brollan']
  }
];

const LEAGUE_TIERS = {
  amateur: {
    id: 'amateur',
    name: 'Amatör Çaylak Ligi (Tier 3)',
    shortName: 'Amatör Lig',
    badge: '🌱',
    desc: 'Espor kariyerine yeni başlayan genç ve amatör kulüplerin mücadele ettiği başlangıç ligi.',
    rewardChampion: 40000,
    botTeams: AMATEUR_BOT_TEAMS
  },
  challenger: {
    id: 'challenger',
    name: 'Challenger Yarı-Pro Ligi (Tier 2)',
    shortName: 'Challenger Lig',
    badge: '⚡',
    desc: 'Amatör ligden yükselen hırslı kulüplerin ve profesyonel akademi takımlarının yer aldığı rekabetçi lig.',
    rewardChampion: 75000,
    botTeams: CHALLENGER_BOT_TEAMS
  },
  pro: {
    id: 'pro',
    name: 'Pro Espor Süper Ligi (Tier 1)',
    shortName: 'Pro Lig',
    badge: '🏆',
    desc: 'Dünyanın en iyi CS:GO espor devlerinin kupa için çarpıştığı en üst seviye şampiyonlar ligi.',
    rewardChampion: 150000,
    botTeams: PRO_BOT_TEAMS
  }
};

module.exports = {
  LEAGUE_TIERS,
  AMATEUR_BOT_TEAMS,
  CHALLENGER_BOT_TEAMS,
  PRO_BOT_TEAMS
};
