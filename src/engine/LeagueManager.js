// SimulatorX - Esports League Manager Engine
// Manages league table, fixtures, bot-vs-bot simulation, user club progression and standings.

const { LEAGUE_BOT_TEAMS, DEFAULT_USER_CLUB, LEAGUE_SCHEDULE, resolveTeamRoster } = require('../config/league');
const { calculateTeamStats } = require('../config/rosters');

class LeagueManager {
  constructor() {
    this.season = 1;
    this.currentWeek = 1;
    this.isSeasonFinished = false;
    this.champion = null;

    // 1. Initialize User Club
    this.userClub = {
      ...DEFAULT_USER_CLUB,
      roster: resolveTeamRoster(DEFAULT_USER_CLUB)
    };

    // 2. Initialize Bot Teams with resolved rosters
    this.botTeams = LEAGUE_BOT_TEAMS.map(team => {
      const roster = resolveTeamRoster(team);
      const stats = calculateTeamStats(roster);
      return {
        ...team,
        roster,
        stats
      };
    });

    // 3. Initialize Standings Table (8 Teams)
    this.standings = [];
    this.initStandings();

    // 4. Initialize Schedule with match states
    this.fixtures = JSON.parse(JSON.stringify(LEAGUE_SCHEDULE));
  }

  initStandings() {
    const allTeams = [
      {
        id: this.userClub.id,
        name: this.userClub.name,
        shortTag: this.userClub.shortTag,
        icon: this.userClub.icon,
        color: this.userClub.color,
        isUser: true,
        stats: calculateTeamStats(this.userClub.roster)
      },
      ...this.botTeams.map(t => ({
        id: t.id,
        name: t.name,
        shortTag: t.shortTag,
        icon: t.icon,
        color: t.color,
        isUser: false,
        stats: t.stats
      }))
    ];

    this.standings = allTeams.map(team => ({
      teamId: team.id,
      name: team.name,
      shortTag: team.shortTag,
      icon: team.icon,
      color: team.color,
      isUser: Boolean(team.isUser),
      rating: team.stats.rating || 1.0,
      played: 0,
      won: 0,
      lost: 0,
      roundsWon: 0,
      roundsLost: 0,
      roundDiff: 0,
      points: 0
    }));

    this.sortStandings();
  }

  sortStandings() {
    this.standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
      if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
      return a.name.localeCompare(b.name);
    });
  }

  getTeamById(id) {
    if (id === this.userClub.id) {
      return {
        ...this.userClub,
        stats: calculateTeamStats(this.userClub.roster)
      };
    }
    return this.botTeams.find(t => t.id === id);
  }

  /**
   * Retrieves the current scheduled match for the user club
   */
  getUserNextMatch() {
    if (this.currentWeek > this.fixtures.length) return null;
    const weekSchedule = this.fixtures.find(w => w.week === this.currentWeek);
    if (!weekSchedule) return null;

    const userMatch = weekSchedule.matches.find(m => m.homeTeamId === this.userClub.id || m.awayTeamId === this.userClub.id);
    if (!userMatch) return null;

    const isHome = (userMatch.homeTeamId === this.userClub.id);
    const opponentId = isHome ? userMatch.awayTeamId : userMatch.homeTeamId;
    const opponent = this.getTeamById(opponentId);

    return {
      matchId: userMatch.id,
      week: this.currentWeek,
      weekName: weekSchedule.name,
      isHome,
      userClub: {
        id: this.userClub.id,
        name: this.userClub.name,
        icon: this.userClub.icon,
        roster: this.userClub.roster,
        stats: calculateTeamStats(this.userClub.roster)
      },
      opponent: {
        id: opponent.id,
        name: opponent.name,
        shortTag: opponent.shortTag,
        icon: opponent.icon,
        country: opponent.country,
        color: opponent.color,
        coachName: opponent.coachName,
        roster: opponent.roster,
        stats: opponent.stats,
        desc: opponent.desc
      },
      completed: Boolean(userMatch.completed),
      score: userMatch.score || null
    };
  }

  /**
   * Updates user club name, icon, or starting roster
   */
  updateUserClub(data) {
    if (data.name) this.userClub.name = data.name.trim();
    if (data.icon) this.userClub.icon = data.icon.trim();
    if (data.budget !== undefined) this.userClub.budget = data.budget;
    if (data.roster && Array.isArray(data.roster) && data.roster.length === 5) {
      this.userClub.roster = JSON.parse(JSON.stringify(data.roster));
    }

    // Sync user entry in standings
    const userStanding = this.standings.find(s => s.teamId === this.userClub.id);
    if (userStanding) {
      userStanding.name = this.userClub.name;
      userStanding.icon = this.userClub.icon;
      userStanding.rating = calculateTeamStats(this.userClub.roster).rating;
    }
    this.sortStandings();
  }

  /**
   * Simulates a bot-vs-bot CS match realistically based on team rating differences
   */
  simulateBotMatch(homeTeam, awayTeam) {
    const homeRating = homeTeam.stats?.rating || 1.10;
    const awayRating = awayTeam.stats?.rating || 1.10;
    const diff = homeRating - awayRating; // e.g. +0.15 favors home

    // Base win probability: 50% + diff * 120%
    const homeWinProb = Math.max(0.20, Math.min(0.80, 0.50 + diff * 1.2));
    const homeWon = Math.random() < homeWinProb;

    let winnerScore = 13;
    // Loser score between 4 and 11 based on closeness
    let loserScore = 4 + Math.floor(Math.random() * 8);

    // Occasional Overtime (16-14 or 16-13)
    if (Math.abs(diff) < 0.05 && Math.random() < 0.22) {
      winnerScore = 16;
      loserScore = 13 + Math.floor(Math.random() * 2);
    }

    const homeScore = homeWon ? winnerScore : loserScore;
    const awayScore = homeWon ? loserScore : winnerScore;

    return {
      homeScore,
      awayScore,
      winnerId: homeWon ? homeTeam.id : awayTeam.id,
      loserId: homeWon ? awayTeam.id : homeTeam.id
    };
  }

  /**
   * Records match outcome and updates league standings
   */
  recordMatch(matchId, homeTeamId, awayTeamId, homeScore, awayScore) {
    const homeStanding = this.standings.find(s => s.teamId === homeTeamId);
    const awayStanding = this.standings.find(s => s.teamId === awayTeamId);
    if (!homeStanding || !awayStanding) return;

    homeStanding.played += 1;
    awayStanding.played += 1;
    homeStanding.roundsWon += homeScore;
    homeStanding.roundsLost += awayScore;
    awayStanding.roundsWon += awayScore;
    awayStanding.roundsLost += homeScore;

    homeStanding.roundDiff = homeStanding.roundsWon - homeStanding.roundsLost;
    awayStanding.roundDiff = awayStanding.roundsWon - awayStanding.roundsLost;

    if (homeScore > awayScore) {
      homeStanding.won += 1;
      homeStanding.points += 3;
      awayStanding.lost += 1;
    } else {
      awayStanding.won += 1;
      awayStanding.points += 3;
      homeStanding.lost += 1;
    }

    // Update fixture match entry
    for (const week of this.fixtures) {
      const m = week.matches.find(item => item.id === matchId);
      if (m) {
        m.completed = true;
        m.score = { homeScore, awayScore };
        break;
      }
    }
  }

  /**
   * Completes the current week: records the user match, simulates remaining bot matches,
   * advances to the next week, and checks for championship.
   */
  advanceWeekWithUserResult(homeScore, awayScore) {
    const userMatchInfo = this.getUserNextMatch();
    if (!userMatchInfo) return;

    const weekSchedule = this.fixtures.find(w => w.week === this.currentWeek);
    if (!weekSchedule) return;

    // 1. Record User Club's Match
    const userMatch = weekSchedule.matches.find(m => m.id === userMatchInfo.matchId);
    if (userMatch && !userMatch.completed) {
      this.recordMatch(userMatch.id, userMatch.homeTeamId, userMatch.awayTeamId, homeScore, awayScore);
    }

    // 2. Simulate Remaining 3 Bot Matches of this week
    weekSchedule.matches.forEach(m => {
      if (!m.completed) {
        const home = this.getTeamById(m.homeTeamId);
        const away = this.getTeamById(m.awayTeamId);
        if (home && away) {
          const sim = this.simulateBotMatch(home, away);
          this.recordMatch(m.id, m.homeTeamId, m.awayTeamId, sim.homeScore, sim.awayScore);
        }
      }
    });

    // 3. Re-sort Standings Table
    this.sortStandings();

    // 4. Advance Week
    if (this.currentWeek < this.fixtures.length) {
      this.currentWeek += 1;
    } else {
      this.isSeasonFinished = true;
      this.champion = this.standings[0];
      // Reward user if champion or top 3!
      if (this.champion.teamId === this.userClub.id) {
        this.userClub.budget += 100000; // $100k Championship prize!
      } else if (this.standings.findIndex(s => s.teamId === this.userClub.id) < 3) {
        this.userClub.budget += 50000; // $50k Podium prize!
      }
    }
  }

  /**
   * Resets season for a new league championship run
   */
  resetSeason() {
    this.season += 1;
    this.currentWeek = 1;
    this.isSeasonFinished = false;
    this.champion = null;
    this.fixtures = JSON.parse(JSON.stringify(LEAGUE_SCHEDULE));
    this.initStandings();
  }

  /**
   * Broadcast payload
   */
  getLeagueData() {
    return {
      season: this.season,
      currentWeek: this.currentWeek,
      totalWeeks: this.fixtures.length,
      isSeasonFinished: this.isSeasonFinished,
      champion: this.champion,
      userClub: {
        id: this.userClub.id,
        name: this.userClub.name,
        shortTag: this.userClub.shortTag,
        icon: this.userClub.icon,
        color: this.userClub.color,
        budget: this.userClub.budget,
        roster: this.userClub.roster,
        stats: calculateTeamStats(this.userClub.roster)
      },
      standings: this.standings,
      fixtures: this.fixtures,
      nextMatch: this.getUserNextMatch()
    };
  }
}

module.exports = { LeagueManager };
