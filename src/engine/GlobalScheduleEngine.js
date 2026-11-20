// SimulatorX - Global Schedule & Live Esports TV Engine
// Manages real-time wall-clock match timetable, 100+ bot ongoing live matches, and match replay transitions.

const { MASSIVE_TEAMS_CATALOG, ALL_100_TEAMS } = require('../config/massiveTeams');
const { replayManager } = require('./ReplayManager');

class GlobalScheduleEngine {
  constructor(dbInstance, matchInstance, io) {
    this.db = dbInstance;
    this.matchEngine = matchInstance;
    this.io = io;

    // Cycle duration: 180 seconds (3 minutes) per match fixture cycle
    this.cycleDuration = 180;
    this.cycleStartTime = Date.now();
    this.cycleEndTime = this.cycleStartTime + (this.cycleDuration * 1000);

    // Active Live Matches pool across all tiers (Espor TV)
    this.liveMatches = [];
    this.spectatorChannels = {}; // socketId -> matchId

    this.initLiveMatches();

    // 1-second global schedule ticker
    setInterval(() => this.tick(), 1000);
  }

  /**
   * Initializes 6 concurrent live matches across City, Regional, National, and Global tiers
   */
  initLiveMatches() {
    this.liveMatches = [
      this.generateLiveMatch('city_match_1', 'city', 'Şehir Ligi', '🏙️'),
      this.generateLiveMatch('city_match_2', 'city', 'Şehir Ligi', '🏙️'),
      this.generateLiveMatch('reg_match_1', 'regional', 'Bölge Ligi', '🌊'),
      this.generateLiveMatch('reg_match_2', 'regional', 'Bölge Ligi', '🌊'),
      this.generateLiveMatch('nat_match_1', 'national', 'Ülke Süper Ligi', '🇹🇷'),
      this.generateLiveMatch('glob_match_1', 'global', 'Dünya Şampiyonlar Ligi', '🌍')
    ];
  }

  generateLiveMatch(id, tierKey, tierName, badge) {
    const pool = MASSIVE_TEAMS_CATALOG[tierKey] || MASSIVE_TEAMS_CATALOG.city;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const homeTeam = shuffled[0];
    const awayTeam = shuffled[1];

    const targetWins = 13;
    const initialRound = 1 + Math.floor(Math.random() * 8); // Start mid-game for immediate excitement
    const homeInitial = Math.min(initialRound - 1, Math.floor(Math.random() * initialRound));
    const awayInitial = initialRound - 1 - homeInitial;

    return {
      id,
      tierKey,
      tierName,
      badge,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        shortTag: homeTeam.shortTag,
        icon: homeTeam.icon,
        color: homeTeam.color,
        coachName: homeTeam.coachName,
        rating: homeTeam.rating,
        roster: homeTeam.roster
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        shortTag: awayTeam.shortTag,
        icon: awayTeam.icon,
        color: awayTeam.color,
        coachName: awayTeam.coachName,
        rating: awayTeam.rating,
        roster: awayTeam.roster
      },
      score: {
        home: homeInitial,
        away: awayInitial
      },
      round: initialRound,
      targetWins,
      phase: 'live', // 'freeze', 'live', 'bomb_planted', 'round_end'
      roundTimer: 75,
      status: 'CANLI',
      latestAction: `${homeTeam.name} ve ${awayTeam.name} ${initialRound}. raunt için taktik hazırlığında.`,
      viewers: 25 + Math.floor(Math.random() * 180),
      spectatingSocketIds: new Set()
    };
  }

  /**
   * Evaluates user's scheduled next match timing
   */
  getUserSchedule(username) {
    if (!username) return null;
    const user = this.db.getUserRecordByUsername(username);
    if (!user) return null;

    const nextMatch = this.db.getUserNextMatch(username);
    if (!nextMatch) return null;

    const now = Date.now();
    // Compute scheduled match time based on global cycle
    let timeRemaining = Math.max(0, Math.floor((this.cycleEndTime - now) / 1000));
    const cycleProgress = 1 - (timeRemaining / this.cycleDuration);

    const isMatchLive = (timeRemaining <= 90 && timeRemaining > 0); // Active in second half of cycle
    const isCompleted = nextMatch.completed;

    const scheduledDate = new Date(this.cycleEndTime);
    const timeFormatted = scheduledDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let status = 'SCHEDULED'; // 'SCHEDULED', 'LIVE', 'COMPLETED'
    if (isCompleted) {
      status = 'COMPLETED';
    } else if (isMatchLive) {
      status = 'LIVE';
    } else {
      status = 'SCHEDULED';
    }

    return {
      matchId: nextMatch.matchId,
      week: nextMatch.week,
      weekName: nextMatch.weekName,
      isHome: nextMatch.isHome,
      userClub: nextMatch.userClub,
      opponent: nextMatch.opponent,
      status,
      completed: isCompleted,
      score: nextMatch.score,
      scheduledTime: timeFormatted,
      countdownSeconds: timeRemaining,
      cycleProgress,
      canWatchLive: status === 'LIVE' || (!isCompleted && timeRemaining < 120),
      replayId: nextMatch.completed ? `rep_${nextMatch.matchId}` : null
    };
  }

  /**
   * Main 1-second Engine Ticker
   */
  tick() {
    const now = Date.now();

    // Check Cycle Roll
    if (now >= this.cycleEndTime) {
      this.cycleStartTime = now;
      this.cycleEndTime = now + (this.cycleDuration * 1000);

      // Auto-simulate pending user matches that reached the end of cycle
      this.autoResolvePendingUserMatches();
    }

    // Tick all live ongoing bot matches
    this.tickLiveMatches();
  }

  tickLiveMatches() {
    const ACTION_TEMPLATES = [
      '{h} ekibi Mid kontrolünü ele geçiriyor.',
      '{a} hızlı B baskını (Rush B) deniyor!',
      'Kritik AWP düellosu: Uzun (Long A) temizlendi.',
      'Duman perdesi atıldı: AWP görüşü kesildi.',
      'C4 B Alanına kuruldu! Geri sayım başladı: 40s',
      'CT savunması geriden retake pozisyonuna geçti.',
      '1v1 Gergin raunt sonu mücadelesi!',
      '{h} koçu telsizden taktiksel hatırlatma yaptı.',
      'Mükemmel flashbang kör etmesiyle 2 oyuncu düşürüldü.'
    ];

    this.liveMatches.forEach(m => {
      m.roundTimer--;
      if (m.roundTimer % 12 === 0) {
        // Update live commentary line
        const tmpl = ACTION_TEMPLATES[Math.floor(Math.random() * ACTION_TEMPLATES.length)];
        m.latestAction = tmpl.replace('{h}', m.homeTeam.name).replace('{a}', m.awayTeam.name);
      }

      // Round concludes
      if (m.roundTimer <= 0) {
        const homeDiff = (m.homeTeam.rating || 1.0) - (m.awayTeam.rating || 1.0);
        const homeWinProb = Math.max(0.25, Math.min(0.75, 0.50 + homeDiff * 0.9));
        const homeWon = Math.random() < homeWinProb;

        if (homeWon) m.score.home++;
        else m.score.away++;

        m.round++;
        m.roundTimer = 45; // Reset round duration

        // Check Match Finish (First to 13 wins)
        if (m.score.home >= m.targetWins || m.score.away >= m.targetWins) {
          // Save replay
          replayManager.createReplay({
            matchId: m.id,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            score: { homeScore: m.score.home, awayScore: m.score.away },
            tierName: m.tierName,
            weekName: `${m.round}. Raund Sonu`
          });

          // Smoothly generate next scheduled matchup for this slot
          Object.assign(m, this.generateLiveMatch(m.id, m.tierKey, m.tierName, m.badge));
        }
      }
    });

    // Broadcast live match ticker update to connected clients
    if (this.io) {
      this.io.emit('live_matches_tick', this.getLiveMatchesSummary());
    }
  }

  /**
   * If a user was offline or did not click start, automatically resolve match cleanly on schedule
   */
  autoResolvePendingUserMatches() {
    if (!this.db || !this.db.data || !this.db.data.users) return;

    Object.keys(this.db.data.users).forEach(username => {
      const nextMatch = this.db.getUserNextMatch(username);
      if (nextMatch && !nextMatch.completed) {
        const homeRating = nextMatch.isHome ? nextMatch.userClub.stats.rating : nextMatch.opponent.stats.rating;
        const awayRating = nextMatch.isHome ? nextMatch.opponent.stats.rating : nextMatch.userClub.stats.rating;
        const sim = this.db.simulateBotMatch(homeRating, awayRating);

        this.db.recordUserMatchResult(username, sim.homeScore, sim.awayScore);

        // Save match replay
        replayManager.createReplay({
          matchId: nextMatch.matchId,
          homeTeam: nextMatch.isHome ? nextMatch.userClub : nextMatch.opponent,
          awayTeam: nextMatch.isHome ? nextMatch.opponent : nextMatch.userClub,
          score: sim,
          tierName: 'Fikstür Ligi',
          weekName: nextMatch.weekName
        });
      }
    });
  }

  getLiveMatchesSummary() {
    return this.liveMatches.map(m => ({
      id: m.id,
      tierKey: m.tierKey,
      tierName: m.tierName,
      badge: m.badge,
      homeTeam: {
        id: m.homeTeam.id,
        name: m.homeTeam.name,
        shortTag: m.homeTeam.shortTag,
        icon: m.homeTeam.icon,
        color: m.homeTeam.color
      },
      awayTeam: {
        id: m.awayTeam.id,
        name: m.awayTeam.name,
        shortTag: m.awayTeam.shortTag,
        icon: m.awayTeam.icon,
        color: m.awayTeam.color
      },
      score: m.score,
      round: m.round,
      roundTimer: m.roundTimer,
      status: m.status,
      latestAction: m.latestAction,
      viewers: m.viewers
    }));
  }

  getLiveMatchById(matchId) {
    return this.liveMatches.find(m => m.id === matchId) || null;
  }
}

module.exports = {
  GlobalScheduleEngine
};
