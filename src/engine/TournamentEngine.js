// SimulatorX - Tournament & Cup Engine
// Manages timed registration cups, knockout brackets (Quarter/Semi/Final), and championships.

const { MASSIVE_TEAMS_CATALOG } = require('../config/massiveTeams');
const { replayManager } = require('./ReplayManager');

const TOURNAMENT_PRESETS = [
  {
    id: 'tourn_istanbul',
    name: 'İstanbul Şehir Kupası',
    badge: '🏙️',
    type: '8_team',
    size: 8,
    regDuration: 180, // 3 minutes
    matchDuration: 30, // 30s per knockout round
    reward: 50000,
    trophy: 'İstanbul Şehir Şampiyonu',
    tierPool: 'city',
    desc: 'İstanbul un en iddialı yerel kulüplerinin tek maç eleme usulü kapıştığı prestij kupası.'
  },
  {
    id: 'tourn_marmara',
    name: 'Marmara Bölge Kupası',
    badge: '🌊',
    type: '8_team',
    size: 8,
    regDuration: 210, // 3.5 minutes
    matchDuration: 35,
    reward: 100000,
    trophy: 'Marmara Bölge Şampiyonu',
    tierPool: 'regional',
    desc: 'Marmara bölgesinin dev takımlarının yarı-profesyonel zirve mücadelesi.'
  },
  {
    id: 'tourn_turkey',
    name: 'Türkiye Espor Federasyon Kupası',
    badge: '🇹🇷',
    type: '8_team',
    size: 8,
    regDuration: 240, // 4 minutes
    matchDuration: 40,
    reward: 250000,
    trophy: 'Türkiye Kupa Şampiyonu',
    tierPool: 'national',
    desc: 'Türkiye nin en iyi 8 profesyonel espor kulübünü bir araya getiren ulusal kupa.'
  },
  {
    id: 'tourn_world_major',
    name: 'CS:GO Dünya Major Şampiyonası',
    badge: '🌍',
    type: '8_team',
    size: 8,
    regDuration: 300, // 5 minutes
    matchDuration: 45,
    reward: 600000,
    trophy: 'Dünya Major Şampiyonu',
    tierPool: 'global',
    desc: 'Dünyanın en elit CS espor takımlarının kupa ve efsane unvanı için çarpıştığı Major turnuva.'
  }
];

class TournamentEngine {
  constructor(dbInstance) {
    this.db = dbInstance;
    this.tournaments = {};
    this.initTournaments();
    // Run 1Hz tick for registration countdown and bracket progression
    setInterval(() => this.tick(), 1000);
  }

  initTournaments() {
    TOURNAMENT_PRESETS.forEach(preset => {
      this.tournaments[preset.id] = this.createNewTournamentState(preset);
    });
  }

  createNewTournamentState(preset) {
    // Pick bot teams from matching pool
    const pool = MASSIVE_TEAMS_CATALOG[preset.tierPool] || MASSIVE_TEAMS_CATALOG.city;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    // Fill with bot teams initially (leaving slot for users)
    const initialBots = shuffled.slice(0, preset.size - 1).map(t => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      color: t.color,
      rating: t.rating || 1.0,
      roster: t.roster,
      isUser: false
    }));

    return {
      id: preset.id,
      name: preset.name,
      badge: preset.badge,
      type: preset.type,
      size: preset.size,
      reward: preset.reward,
      trophy: preset.trophy,
      desc: preset.desc,
      phase: 'REGISTRATION_OPEN', // 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED'
      regTimeRemaining: preset.regDuration,
      regDuration: preset.regDuration,
      matchDuration: preset.matchDuration,
      stageTimer: 0,
      currentRoundIndex: 0, // 0: Quarterfinals, 1: Semifinals, 2: Grand Final
      registeredTeams: initialBots,
      bracket: null,
      champion: null,
      lastWinnerCelebrationTime: 0
    };
  }

  registerUserClub(tournamentId, userClub) {
    const tourn = this.tournaments[tournamentId];
    if (!tourn) return { success: false, error: 'Turnuva bulunamadı.' };
    if (tourn.phase !== 'REGISTRATION_OPEN') {
      return { success: false, error: 'Kayıt süresi dolmuş veya turnuva devam ediyor.' };
    }
    const already = tourn.registeredTeams.find(t => t.id === userClub.id);
    if (already) {
      return { success: false, error: 'Kulübünüz bu turnuvaya zaten kayıtlı!' };
    }

    // Add user club
    tourn.registeredTeams.push({
      id: userClub.id,
      name: userClub.name,
      icon: userClub.icon || '🐺',
      color: userClub.color || '#00d2ff',
      rating: userClub.stats?.rating || 1.0,
      roster: userClub.roster,
      isUser: true,
      username: userClub.username
    });

    // Keep size bounded to preset size
    if (tourn.registeredTeams.length > tourn.size) {
      // Remove an early bot team
      const botIdx = tourn.registeredTeams.findIndex(t => !t.isUser);
      if (botIdx !== -1) tourn.registeredTeams.splice(botIdx, 1);
    }

    return { success: true, message: `${tourn.name} turnuvasına başarıyla kayıt olundu!` };
  }

  generateBracket(tourn) {
    const teams = [...tourn.registeredTeams].sort(() => Math.random() - 0.5);
    while (teams.length < tourn.size) {
      // pad if needed
      teams.push(teams[0]);
    }

    // 8-Team Bracket has 3 rounds:
    // Round 0: 4 Quarterfinals
    // Round 1: 2 Semifinals
    // Round 2: 1 Grand Final
    const round0 = [];
    for (let i = 0; i < 4; i++) {
      round0.push({
        id: `${tourn.id}_qf_${i + 1}`,
        name: `Çeyrek Final ${i + 1}`,
        homeTeam: teams[i * 2],
        awayTeam: teams[i * 2 + 1],
        score: null,
        winner: null,
        completed: false
      });
    }

    const round1 = [
      { id: `${tourn.id}_sf_1`, name: 'Yarı Final 1', homeTeam: null, awayTeam: null, score: null, winner: null, completed: false },
      { id: `${tourn.id}_sf_2`, name: 'Yarı Final 2', homeTeam: null, awayTeam: null, score: null, winner: null, completed: false }
    ];

    const round2 = [
      { id: `${tourn.id}_final`, name: '🏆 BÜYÜK FİNAL', homeTeam: null, awayTeam: null, score: null, winner: null, completed: false }
    ];

    return {
      rounds: [
        { name: 'Çeyrek Finaller', matches: round0 },
        { name: 'Yarı Finaller', matches: round1 },
        { name: 'Büyük Final', matches: round2 }
      ]
    };
  }

  simulateKnockoutMatch(m) {
    if (!m.homeTeam || !m.awayTeam) return;
    const homeRating = m.homeTeam.rating || 1.0;
    const awayRating = m.awayTeam.rating || 1.0;
    const diff = homeRating - awayRating;
    const homeWinProb = Math.max(0.20, Math.min(0.80, 0.50 + diff * 1.2));
    const homeWon = Math.random() < homeWinProb;

    let winnerScore = 13;
    let loserScore = 5 + Math.floor(Math.random() * 7);
    if (Math.random() < 0.20) {
      winnerScore = 16;
      loserScore = 14;
    }

    const homeScore = homeWon ? winnerScore : loserScore;
    const awayScore = homeWon ? loserScore : winnerScore;

    m.score = { homeScore, awayScore };
    m.winner = homeWon ? m.homeTeam : m.awayTeam;
    m.completed = true;

    // Save replay
    replayManager.createReplay({
      matchId: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      score: m.score,
      tierName: 'Kupa Eleme Maçı',
      weekName: m.name
    });
  }

  tick() {
    Object.values(this.tournaments).forEach(tourn => {
      if (tourn.phase === 'REGISTRATION_OPEN') {
        tourn.regTimeRemaining--;
        if (tourn.regTimeRemaining <= 0) {
          // Close registrations and generate bracket
          tourn.phase = 'IN_PROGRESS';
          tourn.currentRoundIndex = 0;
          tourn.stageTimer = tourn.matchDuration;
          tourn.bracket = this.generateBracket(tourn);
        }
      } else if (tourn.phase === 'IN_PROGRESS') {
        tourn.stageTimer--;
        if (tourn.stageTimer <= 0) {
          const curRound = tourn.bracket.rounds[tourn.currentRoundIndex];
          if (curRound) {
            // Simulate matches of current round
            curRound.matches.forEach(m => {
              if (!m.completed) {
                this.simulateKnockoutMatch(m);
              }
            });

            // Advance winners to next round
            if (tourn.currentRoundIndex === 0) {
              // Quarterfinals to Semifinals
              const qfMatches = curRound.matches;
              const sfMatches = tourn.bracket.rounds[1].matches;
              sfMatches[0].homeTeam = qfMatches[0].winner;
              sfMatches[0].awayTeam = qfMatches[1].winner;
              sfMatches[1].homeTeam = qfMatches[2].winner;
              sfMatches[1].awayTeam = qfMatches[3].winner;
              tourn.currentRoundIndex = 1;
              tourn.stageTimer = tourn.matchDuration;
            } else if (tourn.currentRoundIndex === 1) {
              // Semifinals to Final
              const sfMatches = curRound.matches;
              const finalMatch = tourn.bracket.rounds[2].matches[0];
              finalMatch.homeTeam = sfMatches[0].winner;
              finalMatch.awayTeam = sfMatches[1].winner;
              tourn.currentRoundIndex = 2;
              tourn.stageTimer = tourn.matchDuration;
            } else if (tourn.currentRoundIndex === 2) {
              // Grand Final Complete!
              const finalMatch = curRound.matches[0];
              tourn.champion = finalMatch.winner;
              tourn.phase = 'COMPLETED';
              tourn.stageTimer = 45; // 45s winner showcase

              // If champion is a human user, award budget and trophy in DB!
              if (tourn.champion && tourn.champion.isUser && tourn.champion.username && this.db) {
                const user = this.db.getUserRecordByUsername(tourn.champion.username);
                if (user) {
                  user.club.budget += tourn.reward;
                  user.club.stats.trophies += 1;
                  this.db.save();
                }
              }
            }
          }
        }
      } else if (tourn.phase === 'COMPLETED') {
        tourn.stageTimer--;
        if (tourn.stageTimer <= 0) {
          // Restart fresh tournament cycle
          const preset = TOURNAMENT_PRESETS.find(p => p.id === tourn.id);
          if (preset) {
            this.tournaments[tourn.id] = this.createNewTournamentState(preset);
          }
        }
      }
    });
  }

  getTournamentsList() {
    return Object.values(this.tournaments).map(t => ({
      id: t.id,
      name: t.name,
      badge: t.badge,
      type: t.type,
      size: t.size,
      reward: t.reward,
      trophy: t.trophy,
      desc: t.desc,
      phase: t.phase,
      regTimeRemaining: t.regTimeRemaining,
      regDuration: t.regDuration,
      stageTimer: t.stageTimer,
      currentRoundIndex: t.currentRoundIndex,
      registeredCount: t.registeredTeams.length,
      registeredTeams: t.registeredTeams.map(team => ({
        id: team.id,
        name: team.name,
        icon: team.icon,
        isUser: Boolean(team.isUser)
      })),
      champion: t.champion,
      bracket: t.bracket
    }));
  }
}

module.exports = {
  TournamentEngine,
  TOURNAMENT_PRESETS
};
