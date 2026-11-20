// SimulatorX - Persistent Database Engine & Multi-Tier League Manager
// Manages user accounts, authentication, persistent starter rosters, and tiered leagues.

const fs = require('fs');
const path = require('path');
const { generateStarterRoster } = require('../utils/playerGenerator');
const { LEAGUE_TIERS, AMATEUR_BOT_TEAMS } = require('../config/multiLeague');
const { calculateTeamStats, PRO_PLAYER_POOL } = require('../config/rosters');
const { MASSIVE_TEAMS_CATALOG } = require('../config/massiveTeams');

const DB_PATH = path.join(__dirname, '../../data/database.json');

class Database {
  constructor() {
    this.data = {
      users: {},
      sessions: {}
    };
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(raw);
        if (!this.data.users) this.data.users = {};
        if (!this.data.sessions) this.data.sessions = {};
      } else {
        this.save();
      }
    } catch (err) {
      console.error('[DB] Failed to load database, initializing fresh store:', err.message);
      this.data = { users: {}, sessions: {} };
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[DB] Failed to save database:', err.message);
    }
  }

  /**
   * Helper: Resolves roster for bot teams (handles playerIds or embedded rosters)
   */
  resolveBotRoster(team) {
    if (team.roster && Array.isArray(team.roster)) return team.roster;
    if (team.playerIds && Array.isArray(team.playerIds)) {
      return team.playerIds.map(id => PRO_PLAYER_POOL.find(p => p.id === id)).filter(Boolean);
    }
    return [];
  }

  /**
   * Generates a 7-week round-robin schedule for 8 teams
   */
  generateFixtures(userTeamId, botTeams) {
    const allTeamIds = [userTeamId, ...botTeams.map(t => t.id)];
    // Standard 8-team 7-week pairing table
    const pairings = [
      // Week 1
      [[0, 1], [2, 3], [4, 5], [6, 7]],
      // Week 2
      [[0, 2], [1, 4], [3, 6], [5, 7]],
      // Week 3
      [[0, 3], [1, 2], [4, 7], [5, 6]],
      // Week 4
      [[0, 4], [1, 3], [2, 5], [6, 7]],
      // Week 5
      [[0, 5], [1, 7], [2, 6], [3, 4]],
      // Week 6
      [[0, 6], [1, 5], [2, 7], [3, 4]],
      // Week 7
      [[0, 7], [1, 6], [2, 4], [3, 5]]
    ];

    const weekTitles = [
      'Hafta 1: Açılış Mücadeleleri',
      'Hafta 2: Klasik Rekabet',
      'Hafta 3: Liderlik Savaşı',
      'Hafta 4: Kritik Viraj',
      'Hafta 5: Zirve Mücadelesi',
      'Hafta 6: Playoff Randevusu',
      'Hafta 7: Şampiyonluk Final Haftası'
    ];

    return pairings.map((weekPairs, wIdx) => ({
      week: wIdx + 1,
      name: weekTitles[wIdx] || `Hafta ${wIdx + 1}`,
      matches: weekPairs.map((pair, mIdx) => ({
        id: `w${wIdx + 1}_m${mIdx + 1}`,
        homeTeamId: allTeamIds[pair[0]],
        awayTeamId: allTeamIds[pair[1]],
        completed: false,
        score: null
      }))
    }));
  }

  /**
   * Initializes league standings for a user in a specific tier
   */
  initTierLeague(userClub, tierKey = 'amateur') {
    const tierConfig = LEAGUE_TIERS[tierKey] || LEAGUE_TIERS.amateur;
    const botTeams = tierConfig.botTeams.map(b => ({
      ...b,
      roster: this.resolveBotRoster(b),
      stats: calculateTeamStats(this.resolveBotRoster(b))
    }));

    const standings = [
      {
        teamId: userClub.id,
        name: userClub.name,
        shortTag: userClub.name.slice(0, 3).toUpperCase(),
        icon: userClub.icon || '🐺',
        color: userClub.color || '#00d2ff',
        isUser: true,
        rating: calculateTeamStats(userClub.roster).rating,
        played: 0,
        won: 0,
        lost: 0,
        roundsWon: 0,
        roundsLost: 0,
        roundDiff: 0,
        points: 0
      },
      ...botTeams.map(t => ({
        teamId: t.id,
        name: t.name,
        shortTag: t.shortTag || t.name.slice(0, 3).toUpperCase(),
        icon: t.icon,
        color: t.color,
        isUser: false,
        rating: t.rating || 1.0,
        played: 0,
        won: 0,
        lost: 0,
        roundsWon: 0,
        roundsLost: 0,
        roundDiff: 0,
        points: 0
      }))
    ];

    const fixtures = this.generateFixtures(userClub.id, botTeams);

    return {
      tierKey,
      tierName: tierConfig.name,
      tierBadge: tierConfig.badge,
      season: 1,
      currentWeek: 1,
      isSeasonFinished: false,
      champion: null,
      standings,
      fixtures,
      botTeams
    };
  }

  /**
   * User Registration
   */
  registerUser({ username, password, clubName, clubIcon = '🐺', clubColor = '#00d2ff' }) {
    if (!username || username.trim().length < 3) {
      return { success: false, error: 'Kullanıcı adı en az 3 karakter olmalıdır.' };
    }
    if (!password || password.length < 4) {
      return { success: false, error: 'Şifre en az 4 karakter olmalıdır.' };
    }
    if (!clubName || clubName.trim().length < 3) {
      return { success: false, error: 'Takım adı en az 3 karakter olmalıdır.' };
    }

    const key = username.trim().toLowerCase();
    if (this.data.users[key]) {
      return { success: false, error: 'Bu kullanıcı adı zaten alınmış.' };
    }

    const cleanClubName = clubName.trim();
    const cleanUsername = username.trim();
    const clubId = `club_${key}`;

    // 1. Generate 5 authentic amateur starter players
    const starterRoster = generateStarterRoster(cleanClubName);

    // 2. Initialize Club Object
    const club = {
      id: clubId,
      name: cleanClubName,
      shortTag: cleanClubName.slice(0, 3).toUpperCase(),
      icon: clubIcon,
      color: clubColor,
      budget: 25000,
      tier: 'amateur',
      roster: starterRoster,
      stats: {
        played: 0,
        won: 0,
        lost: 0,
        trophies: 0
      }
    };

    // 3. Initialize Starting Tier League (Amatör Çaylak Ligi)
    const leagueData = this.initTierLeague(club, 'amateur');

    const token = `tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const userRecord = {
      id: `usr_${Date.now()}`,
      username: cleanUsername,
      password,
      createdAt: Date.now(),
      token,
      club,
      leagueData
    };

    this.data.users[key] = userRecord;
    this.data.sessions[token] = key;
    this.save();

    return {
      success: true,
      token,
      user: this.sanitizeUser(userRecord)
    };
  }

  /**
   * User Login
   */
  loginUser({ username, password }) {
    if (!username || !password) {
      return { success: false, error: 'Kullanıcı adı ve şifre gereklidir.' };
    }

    const key = username.trim().toLowerCase();
    const userRecord = this.data.users[key];
    if (!userRecord || userRecord.password !== password) {
      return { success: false, error: 'Kullanıcı adı veya şifre hatalı!' };
    }

    const token = `tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    userRecord.token = token;
    this.data.sessions[token] = key;
    this.save();

    return {
      success: true,
      token,
      user: this.sanitizeUser(userRecord)
    };
  }

  getUserByToken(token) {
    if (!token) return null;
    const usernameKey = this.data.sessions[token];
    if (!usernameKey) return null;
    const user = this.data.users[usernameKey];
    return user ? this.sanitizeUser(user) : null;
  }

  getUserRecordByUsername(username) {
    if (!username) return null;
    return this.data.users[username.toLowerCase()] || null;
  }

  sanitizeUser(userRecord) {
    return {
      id: userRecord.id,
      username: userRecord.username,
      club: userRecord.club,
      leagueData: userRecord.leagueData
    };
  }

  /**
   * Updates user club name, icon, budget, or 5-man roster
   */
  updateUserClub(username, { name, icon, color, budget, roster }) {
    const user = this.getUserRecordByUsername(username);
    if (!user) return false;

    if (name) user.club.name = name.trim();
    if (icon) user.club.icon = icon.trim();
    if (color) user.club.color = color.trim();
    if (budget !== undefined) user.club.budget = budget;
    if (roster && Array.isArray(roster) && roster.length === 5) {
      user.club.roster = JSON.parse(JSON.stringify(roster));
    }

    // Sync standing entry in user's league
    const userStanding = user.leagueData.standings.find(s => s.teamId === user.club.id);
    if (userStanding) {
      userStanding.name = user.club.name;
      userStanding.icon = user.club.icon;
      userStanding.rating = calculateTeamStats(user.club.roster).rating;
    }

    this.save();
    return this.sanitizeUser(user);
  }

  /**
   * Gets scheduled next match for the user's club in their current league
   */
  getUserNextMatch(username) {
    const user = this.getUserRecordByUsername(username);
    if (!user) return null;

    const league = user.leagueData;
    if (league.currentWeek > league.fixtures.length) return null;
    const weekSchedule = league.fixtures.find(w => w.week === league.currentWeek);
    if (!weekSchedule) return null;

    const userMatch = weekSchedule.matches.find(m => m.homeTeamId === user.club.id || m.awayTeamId === user.club.id);
    if (!userMatch) return null;

    const isHome = (userMatch.homeTeamId === user.club.id);
    const opponentId = isHome ? userMatch.awayTeamId : userMatch.homeTeamId;

    // Find opponent team info
    const opponent = league.botTeams.find(t => t.id === opponentId) || {
      id: opponentId,
      name: 'Rakip Takım',
      icon: '🛡️',
      stats: { rating: 1.0 },
      roster: []
    };

    return {
      matchId: userMatch.id,
      week: league.currentWeek,
      weekName: weekSchedule.name,
      isHome,
      userClub: {
        id: user.club.id,
        name: user.club.name,
        icon: user.club.icon,
        roster: user.club.roster,
        stats: calculateTeamStats(user.club.roster)
      },
      opponent: {
        id: opponent.id,
        name: opponent.name,
        shortTag: opponent.shortTag || 'BOT',
        icon: opponent.icon,
        color: opponent.color,
        coachName: opponent.coachName || 'Bot Koç',
        roster: opponent.roster,
        stats: opponent.stats || { rating: opponent.rating || 1.0 }
      },
      completed: Boolean(userMatch.completed),
      score: userMatch.score || null
    };
  }

  /**
   * Simulates a bot-vs-bot match realistically
   */
  simulateBotMatch(homeRating = 1.0, awayRating = 1.0) {
    const diff = homeRating - awayRating;
    const homeWinProb = Math.max(0.20, Math.min(0.80, 0.50 + diff * 1.2));
    const homeWon = Math.random() < homeWinProb;
    let winnerScore = 13;
    let loserScore = 4 + Math.floor(Math.random() * 8);

    if (Math.abs(diff) < 0.05 && Math.random() < 0.20) {
      winnerScore = 16;
      loserScore = 13 + Math.floor(Math.random() * 2);
    }

    return {
      homeScore: homeWon ? winnerScore : loserScore,
      awayScore: homeWon ? loserScore : winnerScore
    };
  }

  /**
   * Records match result, updates standings, advances week, and checks championship
   */
  recordUserMatchResult(username, homeScore, awayScore) {
    const user = this.getUserRecordByUsername(username);
    if (!user) return null;

    const league = user.leagueData;
    const nextMatch = this.getUserNextMatch(username);
    if (!nextMatch) return null;

    const weekSchedule = league.fixtures.find(w => w.week === league.currentWeek);
    if (!weekSchedule) return null;

    // 1. Record User Match
    const userMatch = weekSchedule.matches.find(m => m.id === nextMatch.matchId);
    if (userMatch && !userMatch.completed) {
      userMatch.completed = true;
      userMatch.score = { homeScore, awayScore };

      const homeStanding = league.standings.find(s => s.teamId === userMatch.homeTeamId);
      const awayStanding = league.standings.find(s => s.teamId === userMatch.awayTeamId);

      if (homeStanding && awayStanding) {
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
      }

      // Update club stats
      user.club.stats.played += 1;
      const userWon = nextMatch.isHome ? (homeScore > awayScore) : (awayScore > homeScore);
      if (userWon) user.club.stats.won += 1;
      else user.club.stats.lost += 1;
    }

    // 2. Simulate remaining bot matches of this week
    weekSchedule.matches.forEach(m => {
      if (!m.completed) {
        const homeBot = league.botTeams.find(t => t.id === m.homeTeamId);
        const awayBot = league.botTeams.find(t => t.id === m.awayTeamId);
        const homeRating = homeBot?.stats?.rating || homeBot?.rating || 1.0;
        const awayRating = awayBot?.stats?.rating || awayBot?.rating || 1.0;
        const sim = this.simulateBotMatch(homeRating, awayRating);

        m.completed = true;
        m.score = sim;

        const homeStanding = league.standings.find(s => s.teamId === m.homeTeamId);
        const awayStanding = league.standings.find(s => s.teamId === m.awayTeamId);
        if (homeStanding && awayStanding) {
          homeStanding.played += 1;
          awayStanding.played += 1;
          homeStanding.roundsWon += sim.homeScore;
          homeStanding.roundsLost += sim.awayScore;
          awayStanding.roundsWon += sim.awayScore;
          awayStanding.roundsLost += sim.homeScore;
          homeStanding.roundDiff = homeStanding.roundsWon - homeStanding.roundsLost;
          awayStanding.roundDiff = awayStanding.roundsWon - awayStanding.roundsLost;

          if (sim.homeScore > sim.awayScore) {
            homeStanding.won += 1;
            homeStanding.points += 3;
            awayStanding.lost += 1;
          } else {
            awayStanding.won += 1;
            awayStanding.points += 3;
            homeStanding.lost += 1;
          }
        }
      }
    });

    // 3. Sort standings
    league.standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
      if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
      return a.name.localeCompare(b.name);
    });

    // 4. Advance week or finish season
    if (league.currentWeek < league.fixtures.length) {
      league.currentWeek += 1;
    } else {
      league.isSeasonFinished = true;
      league.champion = league.standings[0];
      const tierConfig = LEAGUE_TIERS[league.tierKey] || LEAGUE_TIERS.amateur;

      // Prize & Promotion
      if (league.champion && league.champion.teamId === user.club.id) {
        user.club.stats.trophies += 1;
        user.club.budget += (tierConfig.rewardChampion || 40000);

        // Promotion to next tier
        if (league.tierKey === 'amateur') {
          user.club.tier = 'city';
          user.leagueData = this.initTierLeague(user.club, 'city');
        } else if (league.tierKey === 'city') {
          user.club.tier = 'regional';
          user.leagueData = this.initTierLeague(user.club, 'regional');
        } else if (league.tierKey === 'regional') {
          user.club.tier = 'national';
          user.leagueData = this.initTierLeague(user.club, 'national');
        } else if (league.tierKey === 'national') {
          user.club.tier = 'global';
          user.leagueData = this.initTierLeague(user.club, 'global');
        } else if (league.tierKey === 'global') {
          // Legend status: stay in global and celebrate
          user.leagueData = this.initTierLeague(user.club, 'global');
        }
      }
    }

    this.save();
    return this.sanitizeUser(user);
  }

  /**
   * Resets season for current tier
   */
  resetUserSeason(username) {
    const user = this.getUserRecordByUsername(username);
    if (!user) return null;
    user.leagueData = this.initTierLeague(user.club, user.club.tier || 'amateur');
    this.save();
    return this.sanitizeUser(user);
  }

  /**
   * Returns overview data for any tier (amateur, challenger, pro)
   */
  getTierOverview(tierKey = 'amateur') {
    const tierConfig = LEAGUE_TIERS[tierKey] || LEAGUE_TIERS.amateur;
    const botTeams = tierConfig.botTeams.map(b => ({
      ...b,
      roster: this.resolveBotRoster(b),
      stats: calculateTeamStats(this.resolveBotRoster(b))
    }));

    return {
      tierKey,
      name: tierConfig.name,
      badge: tierConfig.badge,
      desc: tierConfig.desc,
      rewardChampion: tierConfig.rewardChampion,
      teams: botTeams
    };
  }
}

// Singleton database instance
const db = new Database();

module.exports = {
  db
};
