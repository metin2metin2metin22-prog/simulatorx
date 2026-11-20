// SimulatorX - CS:GO Esports Masters League Database & Bot Teams Configuration
const { PRO_PLAYER_POOL, calculateTeamStats } = require('./rosters');

const LEAGUE_BOT_TEAMS = [
  {
    id: 'eternal_fire',
    name: 'Eternal Fire',
    shortTag: 'EF',
    country: 'TR',
    icon: '🔥',
    color: '#e74c3c',
    coachName: 'Fabre',
    playerIds: ['xantares', 'woxic', 'wicadia', 'calyx', 'maj3r'],
    desc: 'Türk esporunun gururu; XANTARES ve woxic önderliğinde agresif ve durdurulamaz tempolu hücum.'
  },
  {
    id: 'faze_clan',
    name: 'FaZe Clan',
    shortTag: 'FAZE',
    country: 'EU',
    icon: '🛡️',
    color: '#e74c3c',
    coachName: 'NEO',
    playerIds: ['device', 'frozen', 'rain', 'ropz', 'karrigan'],
    desc: 'Major şampiyonu efsane; Karrigan taktik dehası ve ropz clutch ustalığı.'
  },
  {
    id: 'navi',
    name: 'Natus Vincere',
    shortTag: 'NAVI',
    country: 'UA',
    icon: '🇺🇦',
    color: '#f1c40f',
    coachName: 'B1ad3',
    playerIds: ['s1mple', 'b1t', 'twistzz', 'arda_flick', 'kyousuke'],
    desc: 'Sarı-siyahlı hanedanlık; s1mple ve b1t ikilisinin ölümcül mekanik üstünlüğü.'
  },
  {
    id: 'vitality',
    name: 'Team Vitality',
    shortTag: 'VIT',
    country: 'FR',
    icon: '🐝',
    color: '#f39c12',
    coachName: 'XTQZZZ',
    playerIds: ['zywoo', 'flamez', 'spinx', 'apex', 'mezii'],
    desc: 'Dünyanın en iyisi ZywOo ve Spinx\'in yönettiği taktiksel Fransız devi.'
  },
  {
    id: 'spirit',
    name: 'Team Spirit',
    shortTag: 'TS',
    country: 'RU',
    icon: '🐉',
    color: '#2ecc71',
    coachName: 'hally',
    playerIds: ['donk', 'sh1ro', 'chopper', 'magixx', 'zont1x'],
    desc: 'donk agresifliği ve sh1ro keskinliğiyle Major kazanan genç canavarlar.'
  },
  {
    id: 'g2_esports',
    name: 'G2 Esports',
    shortTag: 'G2',
    country: 'DE',
    icon: '⚔️',
    color: '#ecf0f1',
    coachName: 'TaZ',
    playerIds: ['m0nesy', 'niko', 'hunter', 'sl3nd', 'r1nkle'],
    desc: 'm0NESY ve NiKo ile dünyanın en yüksek saf firepower potansiyeline sahip samuraylar.'
  },
  {
    id: 'mouz',
    name: 'MOUZ',
    shortTag: 'MOUZ',
    country: 'DE',
    icon: '🐭',
    color: '#e67e22',
    coachName: 'sycrone',
    playerIds: ['torzsi', 'brollan', 'jimpphat', 'xertion', 'siuhy'],
    desc: 'siuhy liderliğinde kusursuz takım kimyası ve altyapı disiplini.'
  }
];

const DEFAULT_USER_CLUB = {
  id: 'user_club',
  name: 'Anadolu Wolves',
  shortTag: 'ANA',
  country: 'TR',
  icon: '🐺',
  color: '#00d2ff',
  coachName: 'Koç (Siz)',
  budget: 50000,
  playerIds: ['caner_noob', 'berk_rush', 'efe_spray', 'murat_camper', 'tolga_strats'],
  desc: 'Kulüp sahibi olarak sıfırdan kurduğunuz, akademi çaylaklarıyla ligde yükselmeyi hedefleyen takımınız.'
};

/**
 * 8-Takımlı Resmi 7 Haftalık Fikstür Şablonu (Tek Devre Lig)
 */
const LEAGUE_SCHEDULE = [
  {
    week: 1,
    name: 'Hafta 1: Açılış Mücadeleleri',
    matches: [
      { id: 'w1_m1', homeTeamId: 'user_club', awayTeamId: 'eternal_fire' },
      { id: 'w1_m2', homeTeamId: 'faze_clan', awayTeamId: 'navi' },
      { id: 'w1_m3', homeTeamId: 'vitality', awayTeamId: 'spirit' },
      { id: 'w1_m4', homeTeamId: 'g2_esports', awayTeamId: 'mouz' }
    ]
  },
  {
    week: 2,
    name: 'Hafta 2: Klasik Rekabet',
    matches: [
      { id: 'w2_m1', homeTeamId: 'user_club', awayTeamId: 'faze_clan' },
      { id: 'w2_m2', homeTeamId: 'eternal_fire', awayTeamId: 'vitality' },
      { id: 'w2_m3', homeTeamId: 'navi', awayTeamId: 'g2_esports' },
      { id: 'w2_m4', homeTeamId: 'spirit', awayTeamId: 'mouz' }
    ]
  },
  {
    week: 3,
    name: 'Hafta 3: Liderlik Savaşı',
    matches: [
      { id: 'w3_m1', homeTeamId: 'user_club', awayTeamId: 'navi' },
      { id: 'w3_m2', homeTeamId: 'eternal_fire', awayTeamId: 'faze_clan' },
      { id: 'w3_m3', homeTeamId: 'vitality', awayTeamId: 'mouz' },
      { id: 'w3_m4', homeTeamId: 'spirit', awayTeamId: 'g2_esports' }
    ]
  },
  {
    week: 4,
    name: 'Hafta 4: Kritik Viraj',
    matches: [
      { id: 'w4_m1', homeTeamId: 'user_club', awayTeamId: 'vitality' },
      { id: 'w4_m2', homeTeamId: 'eternal_fire', awayTeamId: 'navi' },
      { id: 'w4_m3', homeTeamId: 'faze_clan', awayTeamId: 'spirit' },
      { id: 'w4_m4', homeTeamId: 'g2_esports', awayTeamId: 'mouz' }
    ]
  },
  {
    week: 5,
    name: 'Hafta 5: Doğu Avrupa Derbisi',
    matches: [
      { id: 'w5_m1', homeTeamId: 'user_club', awayTeamId: 'spirit' },
      { id: 'w5_m2', homeTeamId: 'eternal_fire', awayTeamId: 'mouz' },
      { id: 'w5_m3', homeTeamId: 'faze_clan', awayTeamId: 'g2_esports' },
      { id: 'w5_m4', homeTeamId: 'navi', awayTeamId: 'vitality' }
    ]
  },
  {
    week: 6,
    name: 'Hafta 6: Samuray Randevusu',
    matches: [
      { id: 'w6_m1', homeTeamId: 'user_club', awayTeamId: 'g2_esports' },
      { id: 'w6_m2', homeTeamId: 'eternal_fire', awayTeamId: 'spirit' },
      { id: 'w6_m3', homeTeamId: 'faze_clan', awayTeamId: 'vitality' },
      { id: 'w6_m4', homeTeamId: 'navi', awayTeamId: 'mouz' }
    ]
  },
  {
    week: 7,
    name: 'Hafta 7: Şampiyonluk Final Haftası',
    matches: [
      { id: 'w7_m1', homeTeamId: 'user_club', awayTeamId: 'mouz' },
      { id: 'w7_m2', homeTeamId: 'eternal_fire', awayTeamId: 'g2_esports' },
      { id: 'w7_m3', homeTeamId: 'faze_clan', awayTeamId: 'navi' },
      { id: 'w7_m4', homeTeamId: 'vitality', awayTeamId: 'spirit' }
    ]
  }
];

function resolveTeamRoster(team) {
  if (!team || !team.playerIds) return [];
  return team.playerIds.map(id => PRO_PLAYER_POOL.find(p => p.id === id)).filter(Boolean);
}

module.exports = {
  LEAGUE_BOT_TEAMS,
  DEFAULT_USER_CLUB,
  LEAGUE_SCHEDULE,
  resolveTeamRoster
};
