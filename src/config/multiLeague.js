// SimulatorX - Multi-Tier Esports League System Configuration
// Defines 5 competitive tiers: Amatör, Şehir, Bölge, Ülke Süper Ligi, and Dünya Şampiyonlar Ligi.

const { PRO_PLAYER_POOL } = require('./rosters');
const { MASSIVE_TEAMS_CATALOG } = require('./massiveTeams');

// Predefined rosters for amateur starter bot teams
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
    rating: 0.95,
    roster: [
      { name: 'Tuna "bridge" Kaya', role: 'AWPer', rating: 0.96, skills: { aim: 61, reflex: 59, headshot: 56, gamesense: 58, clutch: 54, utility: 50, aggression: 61 }, perk: 'flick_king' },
      { name: 'Cem "stream" Şen', role: 'Entry Fragger', rating: 0.95, skills: { aim: 61, reflex: 60, headshot: 58, gamesense: 53, clutch: 51, utility: 45, aggression: 82 }, perk: 'aggressive_entry' },
      { name: 'Hakan "current" Yıldız', role: 'Rifler', rating: 0.94, skills: { aim: 57, reflex: 56, headshot: 54, gamesense: 55, clutch: 52, utility: 48, aggression: 67 }, perk: 'raw_talent' },
      { name: 'Sarp "gate" Çelik', role: 'Site Anchor', rating: 0.94, skills: { aim: 55, reflex: 53, headshot: 51, gamesense: 59, clutch: 55, utility: 53, aggression: 45 }, perk: 'iron_anchor' },
      { name: 'Ozan "captain" Demir', role: 'In-Game Leader (IGL)', rating: 0.93, skills: { aim: 53, reflex: 51, headshot: 49, gamesense: 61, clutch: 55, utility: 55, aggression: 51 }, perk: 'tactical_mastermind' }
    ]
  },
  {
    id: 'bot_bursa_uludag',
    name: 'Bursa Uludağ',
    shortTag: 'ULUDAĞ',
    icon: '🐻',
    country: 'TR',
    color: '#34495e',
    coachName: 'Kemal "peak" Dağ',
    rating: 0.94,
    roster: [
      { name: 'Alp "snow" Er', role: 'AWPer', rating: 0.95, skills: { aim: 60, reflex: 58, headshot: 55, gamesense: 57, clutch: 53, utility: 49, aggression: 60 }, perk: 'flick_king' },
      { name: 'Baran "frost" Akın', role: 'Entry Fragger', rating: 0.94, skills: { aim: 59, reflex: 58, headshot: 57, gamesense: 53, clutch: 50, utility: 44, aggression: 81 }, perk: 'aggressive_entry' },
      { name: 'Kaan "bear" Kurt', role: 'Rifler', rating: 0.93, skills: { aim: 56, reflex: 55, headshot: 53, gamesense: 54, clutch: 52, utility: 47, aggression: 66 }, perk: 'raw_talent' },
      { name: 'Mert "glacier" Polat', role: 'Site Anchor', rating: 0.93, skills: { aim: 54, reflex: 52, headshot: 50, gamesense: 58, clutch: 54, utility: 52, aggression: 45 }, perk: 'iron_anchor' },
      { name: 'Zafer "scout" Yılmaz', role: 'In-Game Leader (IGL)', rating: 0.92, skills: { aim: 52, reflex: 50, headshot: 48, gamesense: 60, clutch: 54, utility: 54, aggression: 50 }, perk: 'tactical_mastermind' }
    ]
  }
];

// 5 Hierarchical League Tiers
const LEAGUE_TIERS = {
  amateur: {
    id: 'amateur',
    name: 'Amatör Çaylak Ligi',
    shortName: 'Amatör Lig',
    badge: '🌱',
    level: 5,
    desc: 'Espor kariyerine yeni başlayan genç ve amatör kulüplerin mücadele ettiği başlangıç ligi.',
    rewardChampion: 40000,
    nextTier: 'city',
    botTeams: AMATEUR_BOT_TEAMS
  },
  city: {
    id: 'city',
    name: 'Şehir Espor Ligi',
    shortName: 'Şehir Ligi',
    badge: '🏙️',
    level: 4,
    desc: 'İstanbul, Ankara, İzmir ve 40 ilden yerel espor kulüplerinin kıyasıya yarıştığı şehir ligi.',
    rewardChampion: 75000,
    nextTier: 'regional',
    botTeams: MASSIVE_TEAMS_CATALOG.city.slice(0, 7)
  },
  regional: {
    id: 'regional',
    name: 'Bölge Şampiyonlar Ligi',
    shortName: 'Bölge Ligi',
    badge: '🌊',
    level: 3,
    desc: 'Marmara, Ege, Akdeniz, Karadeniz ve Anadolu bölgelerinin en prestijli yarı-profesyonel devleri.',
    rewardChampion: 125000,
    nextTier: 'national',
    botTeams: MASSIVE_TEAMS_CATALOG.regional.slice(0, 7)
  },
  national: {
    id: 'national',
    name: 'Ülke Espor Süper Ligi',
    shortName: 'Süper Lig',
    badge: '🇹🇷',
    level: 2,
    desc: 'Sangal, BBL, FUT, Fire Flux ve Türkiye nin en büyük 20 profesyonel espor kulübü.',
    rewardChampion: 250000,
    nextTier: 'global',
    botTeams: MASSIVE_TEAMS_CATALOG.national.slice(0, 7)
  },
  global: {
    id: 'global',
    name: 'Dünya Pro Şampiyonlar Ligi',
    shortName: 'Dünya Ligi',
    badge: '🌍',
    level: 1,
    desc: 'Team Vitality, Team Spirit, NAVI, FaZe, G2, Eternal Fire ve dünyanın en efsanevi espor kulüpleri.',
    rewardChampion: 600000,
    nextTier: null,
    botTeams: MASSIVE_TEAMS_CATALOG.global.slice(0, 7)
  }
};

module.exports = {
  LEAGUE_TIERS,
  AMATEUR_BOT_TEAMS
};
