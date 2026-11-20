// SimulatorX - Persistent Database Engine & Multi-Tier League Manager
// Manages user accounts, authentication, persistent starter rosters, and tiered leagues.

const fs = require('fs');
const path = require('path');
const { generateStarterRoster } = require('../utils/playerGenerator');
const { LEAGUE_TIERS, AMATEUR_BOT_TEAMS } = require('../config/multiLeague');
const { calculateTeamStats, PRO_PLAYER_POOL } = require('../config/rosters');
const { MASSIVE_TEAMS_CATALOG, ALL_100_TEAMS } = require('../config/massiveTeams');
const { backgroundMatchSimulator } = require('../engine/BackgroundMatchSimulator');
const { replayManager } = require('../engine/ReplayManager');

const DB_PATH = path.join(__dirname, '../../data/database.json');

const TRAINING_DRILLS = {
  aim_headshot: {
    id: 'aim_headshot',
    name: '🎯 Aim & Headshot Özel Kampı',
    desc: 'Nişangah hakimiyeti, spray kontrolü ve 1-tap kafa vuruşu refleks antrenmanı.',
    targetStat: 'aim',
    secondaryStat: 'headshot',
    cost: 1500,
    durationMinutes: 10,
    gains: { aim: 2, headshot: 2 }
  },
  reflex_reaction: {
    id: 'reflex_reaction',
    name: '⚡ Reaksiyon & Refleks Reaktörü',
    desc: 'Açılış düellolarında düşmanı ilk gören ve tetiğe ilk basan olma antrenmanı.',
    targetStat: 'reflex',
    secondaryStat: null,
    cost: 1500,
    durationMinutes: 10,
    gains: { reflex: 3 }
  },
  demo_tactics: {
    id: 'demo_tactics',
    name: '🧠 Taktik Demo & Oyun Okuma Analizi',
    desc: 'Harita kontrolü, rotasyon zamanlamaları ve rakip ekoyu analiz etme eğitimi.',
    targetStat: 'gamesense',
    secondaryStat: null,
    cost: 1200,
    durationMinutes: 10,
    gains: { gamesense: 3 }
  },
  clutch_mastery: {
    id: 'clutch_mastery',
    name: '🔥 1vX Clutch & Soğukkanlılık Kampı',
    desc: 'Zaman kısıtlı gergin pozisyonlarda ve bomba alanında tek başına raunt çevirme tecrübesi.',
    targetStat: 'clutch',
    secondaryStat: null,
    cost: 2000,
    durationMinutes: 15,
    gains: { clutch: 3 }
  },
  utility_lineups: {
    id: 'utility_lineups',
    name: '💨 Sis & Flaş Bomba Lineup Kampı',
    desc: 'Kör etmeyen flaşlar, Mid to B perdeleme sisleri ve molotof yayılışlarını ezberleme.',
    targetStat: 'utility',
    secondaryStat: null,
    cost: 1000,
    durationMinutes: 8,
    gains: { utility: 4 }
  }
};

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
   * Generates a 14-match double round-robin schedule for 8 teams across 7 days (2 matches per day max)
   */
  generateFixtures(userTeamId, botTeams) {
    const allTeamIds = [userTeamId, ...botTeams.map(t => t.id)];
    // Standard 8-team 7-round pairing table
    const basePairings = [
      [[0, 1], [2, 3], [4, 5], [6, 7]],
      [[0, 2], [1, 4], [3, 6], [5, 7]],
      [[0, 3], [1, 2], [4, 7], [5, 6]],
      [[0, 4], [1, 3], [2, 5], [6, 7]],
      [[0, 5], [1, 7], [2, 6], [3, 4]],
      [[0, 6], [1, 5], [2, 7], [3, 4]],
      [[0, 7], [1, 6], [2, 4], [3, 5]]
    ];

    const sessionNames = ['1. Seans (Öğle Maçı)', '2. Seans (Akşam Maçı)'];

    // 14 Rounds (Double Round Robin: Leg 1 and Leg 2 reversed)
    const allRounds = [];
    for (let r = 0; r < 14; r++) {
      const isLeg2 = r >= 7;
      const baseIdx = r % 7;
      const pairs = basePairings[baseIdx];
      const day = Math.floor(r / 2) + 1; // Days 1 to 7
      const session = (r % 2) + 1; // Session 1 or Session 2

      allRounds.push({
        week: r + 1,
        day,
        session,
        name: `Gün ${day} • ${sessionNames[session - 1]} (${r + 1}. Fikstür)`,
        matches: pairs.map((pair, mIdx) => ({
          id: `w${r + 1}_m${mIdx + 1}`,
          homeTeamId: isLeg2 ? allTeamIds[pair[1]] : allTeamIds[pair[0]],
          awayTeamId: isLeg2 ? allTeamIds[pair[0]] : allTeamIds[pair[1]],
          completed: false,
          score: null,
          replayId: null
        }))
      });
    }

    return allRounds;
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
      seasonDay: 1,
      matchesPlayedToday: 0,
      maxDailyMatches: 2,
      isDailyQuotaCompleted: false,
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
      training: {},
      stats: {
        played: 0,
        won: 0,
        lost: 0,
        trophies: 0,
        scrimsPlayed: 0
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

    const matchesPlayedToday = league.matchesPlayedToday || 0;
    const maxDailyMatches = league.maxDailyMatches || 2;
    const isDailyQuotaCompleted = Boolean(matchesPlayedToday >= maxDailyMatches);

    return {
      matchId: userMatch.id,
      week: league.currentWeek,
      weekName: weekSchedule.name,
      day: weekSchedule.day || Math.floor((league.currentWeek - 1) / 2) + 1,
      session: weekSchedule.session || ((league.currentWeek - 1) % 2) + 1,
      seasonDay: league.seasonDay || 1,
      matchesPlayedToday,
      maxDailyMatches,
      isDailyQuotaCompleted,
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
      score: userMatch.score || null,
      replayId: userMatch.replayId || null
    };
  }

  /**
   * Simulates a bot-vs-bot match realistically using authentic BackgroundMatchSimulator
   */
  simulateBotMatch(homeTeam, awayTeam) {
    if (!homeTeam || !awayTeam) return { homeScore: 13, awayScore: 7 };
    const sim = backgroundMatchSimulator.simulateFullMatch(homeTeam, awayTeam);
    return sim.score;
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

      const rep = replayManager.createReplay({
        matchId: userMatch.id,
        homeTeam: nextMatch.isHome ? nextMatch.userClub : nextMatch.opponent,
        awayTeam: nextMatch.isHome ? nextMatch.opponent : nextMatch.userClub,
        score: { homeScore, awayScore },
        tierName: league.tierName,
        weekName: weekSchedule.name
      });
      userMatch.replayId = rep.replayId;

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

    // 2. Simulate remaining bot matches of this week using real simulation engine
    weekSchedule.matches.forEach(m => {
      if (!m.completed) {
        const homeBot = league.botTeams.find(t => t.id === m.homeTeamId);
        const awayBot = league.botTeams.find(t => t.id === m.awayTeamId);
        
        let simScore = { homeScore: 13, awayScore: 9 };
        if (homeBot && awayBot) {
          const sim = backgroundMatchSimulator.simulateFullMatch(homeBot, awayBot);
          simScore = sim.score;
          const rep = replayManager.createReplay({
            matchId: m.id,
            homeTeam: homeBot,
            awayTeam: awayBot,
            score: simScore,
            tierName: league.tierName,
            weekName: weekSchedule.name
          });
          m.replayId = rep.replayId;
        }

        m.completed = true;
        m.score = simScore;

        const homeStanding = league.standings.find(s => s.teamId === m.homeTeamId);
        const awayStanding = league.standings.find(s => s.teamId === m.awayTeamId);
        if (homeStanding && awayStanding) {
          homeStanding.played += 1;
          awayStanding.played += 1;
          homeStanding.roundsWon += simScore.homeScore;
          homeStanding.roundsLost += simScore.awayScore;
          awayStanding.roundsWon += simScore.awayScore;
          awayStanding.roundsLost += simScore.homeScore;
          homeStanding.roundDiff = homeStanding.roundsWon - homeStanding.roundsLost;
          awayStanding.roundDiff = awayStanding.roundsWon - awayStanding.roundsLost;

          if (simScore.homeScore > simScore.awayScore) {
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

    // 3. Daily Match Counter (Max 2 matches per day)
    league.matchesPlayedToday = (league.matchesPlayedToday || 0) + 1;
    if (league.matchesPlayedToday >= (league.maxDailyMatches || 2)) {
      league.isDailyQuotaCompleted = true;
    }

    // 4. Sort standings
    league.standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
      if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
      return a.name.localeCompare(b.name);
    });

    // 5. Advance week or finish season
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
          user.leagueData = this.initTierLeague(user.club, 'global');
        }
      }
    }

    this.save();
    return this.sanitizeUser(user);
  }

  /**
   * Advances calendar to the next day, resetting the 2-match daily limit
   */
  advanceToNextDay(username) {
    const user = this.getUserRecordByUsername(username);
    if (!user) return null;

    const league = user.leagueData;
    league.seasonDay = Math.min(7, (league.seasonDay || 1) + 1);
    league.matchesPlayedToday = 0;
    league.isDailyQuotaCompleted = false;

    // Check completed player trainings
    if (user.club.training) {
      const now = Date.now();
      Object.keys(user.club.training).forEach(pId => {
        const tr = user.club.training[pId];
        if (now >= tr.endTime) {
          tr.isReady = true;
        }
      });
    }

    this.save();
    return this.sanitizeUser(user);
  }

  /**
   * Starts targeted training for a specific player
   */
  startPlayerTraining(username, playerId, drillKey) {
    const user = this.getUserRecordByUsername(username);
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

    const drill = TRAINING_DRILLS[drillKey];
    if (!drill) return { success: false, error: 'Geçersiz antrenman programı.' };

    const player = user.club.roster.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu kadroda bulunamadı.' };

    user.club.training = user.club.training || {};
    if (user.club.training[playerId]) {
      return { success: false, error: `${player.name} zaten aktif bir antrenmanda!` };
    }

    if ((user.club.budget || 0) < drill.cost) {
      return { success: false, error: `Yetersiz bütçe! Bu kamp için $${drill.cost.toLocaleString()} gereklidir.` };
    }

    // Deduct budget
    user.club.budget -= drill.cost;

    const now = Date.now();
    const durationMs = drill.durationMinutes * 60 * 1000;
    user.club.training[playerId] = {
      drillKey,
      drillName: drill.name,
      targetStat: drill.targetStat,
      secondaryStat: drill.secondaryStat,
      cost: drill.cost,
      startTime: now,
      endTime: now + durationMs,
      durationMinutes: drill.durationMinutes,
      gains: drill.gains,
      isReady: false
    };

    this.save();
    return {
      success: true,
      user: this.sanitizeUser(user),
      message: `${player.name} "${drill.name}" kampına başladı! (${drill.durationMinutes} dk)`
    };
  }

  /**
   * Claims completed training gains and permanently boosts player skills
   */
  claimPlayerTraining(username, playerId) {
    const user = this.getUserRecordByUsername(username);
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

    user.club.training = user.club.training || {};
    const tr = user.club.training[playerId];
    if (!tr) return { success: false, error: 'Bu oyuncu için aktif antrenman bulunamadı.' };

    const now = Date.now();
    if (now < tr.endTime && !tr.isReady) {
      const remainingSec = Math.ceil((tr.endTime - now) / 1000);
      return { success: false, error: `Antrenman henüz bitmedi! Kalan süre: ${Math.floor(remainingSec / 60)}dk ${remainingSec % 60}s` };
    }

    const player = user.club.roster.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu kadroda bulunamadı.' };

    // Apply stat gains
    player.skills = player.skills || { aim: 60, reflex: 60, headshot: 55, gamesense: 60, clutch: 55, utility: 50 };
    Object.keys(tr.gains).forEach(stat => {
      const gain = tr.gains[stat];
      player.skills[stat] = Math.min(99, (player.skills[stat] || 50) + gain);
    });

    // Recalculate player rating
    const sk = player.skills;
    player.rating = Number((((sk.aim * 0.25) + (sk.reflex * 0.25) + ((sk.headshot || sk.aim) * 0.15) + (sk.gamesense * 0.20) + (sk.clutch * 0.15)) / 65).toFixed(2));

    delete user.club.training[playerId];
    this.save();

    return {
      success: true,
      user: this.sanitizeUser(user),
      player,
      gains: tr.gains,
      message: `🎉 Tebrikler! ${player.name} antrenmanı tamamladı ve yeteneklerini geliştirdi!`
    };
  }

  /**
   * Simulates an authentic Hazırlık / Antrenman Maçı (Scrim)
   */
  startScrimMatch(username, { opponentId, tacticalFocus }) {
    const user = this.getUserRecordByUsername(username);
    if (!user) return null;

    const opponent = ALL_100_TEAMS.find(t => t.id === opponentId) || ALL_100_TEAMS[0];
    const userTeam = {
      id: user.club.id,
      name: user.club.name,
      icon: user.club.icon,
      color: user.club.color,
      roster: user.club.roster
    };

    const sim = backgroundMatchSimulator.simulateFullMatch(userTeam, opponent, { tacticalFocus });

    user.club.stats.scrimsPlayed = (user.club.stats.scrimsPlayed || 0) + 1;

    const rep = replayManager.createReplay({
      matchId: `scrim_${Date.now()}`,
      homeTeam: userTeam,
      awayTeam: opponent,
      score: sim.score,
      tierName: 'Hazırlık / Scrim Maçı',
      weekName: tacticalFocus || 'Özel Taktiksel Hazırlık'
    });

    this.save();

    return {
      success: true,
      user: this.sanitizeUser(user),
      scrimResult: sim,
      replayId: rep.replayId,
      tacticalFocus: tacticalFocus || 'Standart Taktik'
    };
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
  db,
  TRAINING_DRILLS
};
