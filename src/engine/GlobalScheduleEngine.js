// SimulatorX - Global Schedule & Live Esports TV Engine
// Manages real-time wall-clock match timetable, authentic background round simulation,
// daily match quotas (max 2 official matches per day), and match replay transitions.

const { MASSIVE_TEAMS_CATALOG, ALL_100_TEAMS } = require('../config/massiveTeams');
const { replayManager } = require('./ReplayManager');
const { backgroundMatchSimulator } = require('./BackgroundMatchSimulator');

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
    const initialRound = 1 + Math.floor(Math.random() * 6);
    const homeInitial = Math.min(initialRound - 1, Math.floor(Math.random() * initialRound));
    const awayInitial = initialRound - 1 - homeInitial;

    // Initialize round economy and stats
    const economy = {
      ct: { money: [3200, 3200, 3200, 3200, 3200], lossStreak: 0 },
      t: { money: [3200, 3200, 3200, 3200, 3200], lossStreak: 0 }
    };
    const stats = {};

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
      phase: 'live',
      roundTimer: 35,
      status: 'CANLI',
      latestAction: `${homeTeam.name} ve ${awayTeam.name} ${initialRound}. raunt için taktik hazırlığında.`,
      viewers: 25 + Math.floor(Math.random() * 180),
      spectatingSocketIds: new Set(),
      economy,
      stats,
      roundsHistory: []
    };
  }

  /**
   * Evaluates user's scheduled next match timing and daily match limits
   */
  getUserSchedule(username) {
    if (!username) return null;
    const user = this.db.getUserRecordByUsername(username);
    if (!user) return null;

    const nextMatch = this.db.getUserNextMatch(username);
    if (!nextMatch) return null;

    const now = Date.now();
    let timeRemaining = Math.max(0, Math.floor((this.cycleEndTime - now) / 1000));
    const cycleProgress = 1 - (timeRemaining / this.cycleDuration);

    const isMatchLive = (timeRemaining <= 90 && timeRemaining > 0);
    const isCompleted = nextMatch.completed;

    const scheduledDate = new Date(this.cycleEndTime);
    const timeFormatted = scheduledDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let status = 'SCHEDULED'; // 'SCHEDULED', 'LIVE', 'COMPLETED', 'DAILY_LIMIT_REACHED'
    if (nextMatch.isDailyQuotaCompleted) {
      status = 'DAILY_LIMIT_REACHED';
    } else if (isCompleted) {
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
      day: nextMatch.day,
      session: nextMatch.session,
      seasonDay: nextMatch.seasonDay,
      matchesPlayedToday: nextMatch.matchesPlayedToday,
      maxDailyMatches: nextMatch.maxDailyMatches,
      isDailyQuotaCompleted: nextMatch.isDailyQuotaCompleted,
      isHome: nextMatch.isHome,
      userClub: nextMatch.userClub,
      opponent: nextMatch.opponent,
      status,
      completed: isCompleted,
      score: nextMatch.score,
      scheduledTime: timeFormatted,
      countdownSeconds: timeRemaining,
      cycleProgress,
      canWatchLive: (status === 'LIVE') && !nextMatch.isDailyQuotaCompleted,
      replayId: nextMatch.completed ? (nextMatch.replayId || `rep_${nextMatch.matchId}`) : null
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

    // Tick all live ongoing bot matches using authentic BackgroundMatchSimulator
    this.tickLiveMatches();
  }

  tickLiveMatches() {
    this.liveMatches.forEach(m => {
      m.roundTimer--;

      // Mid-round commentary updates
      if (m.roundTimer === 18) {
        m.latestAction = `${m.homeTeam.name} ve ${m.awayTeam.name} arasında kritik site düelloları yaşanıyor!`;
      }

      // Round concludes: Run authentic simulation round!
      if (m.roundTimer <= 0) {
        // Authentically simulate the round using player skills, weapons, and tactics
        const simRound = backgroundMatchSimulator.simulateRound({
          roundNum: m.round,
          ctTeam: m.homeTeam,
          tTeam: m.awayTeam,
          ctRoster: m.homeTeam.roster,
          tRoster: m.awayTeam.roster,
          economy: m.economy,
          stats: m.stats
        });

        if (simRound.winnerSide === 'ct') {
          m.score.home++;
        } else {
          m.score.away++;
        }

        m.roundsHistory.push(simRound);
        m.latestAction = `${simRound.winningTeamIcon} ${simRound.highlight} (MVP: ${simRound.mvp})`;
        m.round++;
        m.roundTimer = 35; // 35-second snappy round cycles

        // Check Match Finish (First to 13 wins)
        if (m.score.home >= m.targetWins || m.score.away >= m.targetWins) {
          // Save real replay
          replayManager.createReplay({
            matchId: m.id,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            score: { homeScore: m.score.home, awayScore: m.score.away },
            tierName: m.tierName,
            weekName: `${m.round}. Raund Sonu`
          });

          // Smoothly generate next scheduled matchup for this slot from the 106 bot teams catalog
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
   * using authentic background simulation.
   */
  autoResolvePendingUserMatches() {
    if (!this.db || !this.db.data || !this.db.data.users) return;

    Object.keys(this.db.data.users).forEach(username => {
      const nextMatch = this.db.getUserNextMatch(username);
      if (nextMatch && !nextMatch.completed && !nextMatch.isDailyQuotaCompleted) {
        const homeTeam = nextMatch.isHome ? nextMatch.userClub : nextMatch.opponent;
        const awayTeam = nextMatch.isHome ? nextMatch.opponent : nextMatch.userClub;

        // Run authentic simulation
        const sim = backgroundMatchSimulator.simulateFullMatch(homeTeam, awayTeam);
        const homeScore = nextMatch.isHome ? sim.score.homeScore : sim.score.awayScore;
        const awayScore = nextMatch.isHome ? sim.score.awayScore : sim.score.homeScore;

        this.db.recordUserMatchResult(username, homeScore, awayScore);
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
