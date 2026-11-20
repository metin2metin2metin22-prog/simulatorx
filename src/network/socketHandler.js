// SimulatorX - Socket.io Real-Time Networking & Event Dispatcher
const { WEAPONS } = require('../config/weapons');
const { ROSTERS, DEFAULT_ROSTERS, PRO_PLAYER_POOL, PERK_DEFINITIONS, ROSTER_PRESETS, calculateTeamStats } = require('../config/rosters');
const { db, TRAINING_DRILLS } = require('../storage/db');
const { LEAGUE_TIERS } = require('../config/multiLeague');
const { ALL_100_TEAMS } = require('../config/massiveTeams');

function registerSocketHandlers(io, match, scheduleEngine, tournamentEngine, replayManager) {
  io.on('connection', (socket) => {
    match.connectedSockets[socket.id] = { connectedAt: Date.now() };
    const onlineCount = Object.keys(match.connectedSockets).length;

    socket.emit('init_data', {
      mapData: match.mapData,
      weapons: WEAPONS,
      strats: match.mapData.strategies,
      rosters: match.currentRosters || ROSTERS,
      playerPool: PRO_PLAYER_POOL,
      perks: PERK_DEFINITIONS,
      presets: ROSTER_PRESETS,
      leagueTiers: LEAGUE_TIERS,
      trainingDrills: TRAINING_DRILLS,
      scrimTeams: ALL_100_TEAMS.map(t => ({ id: t.id, name: t.name, icon: t.icon, tier: t.tier, rating: t.rating })),
      league: match.league ? match.league.getLeagueData() : null,
      userClub: match.league ? match.league.userClub : null,
      coaches: match.coaches,
      onlineCount
    });

    io.emit('online_count', onlineCount);

    // --- AUTHENTICATION & PROFILE SYSTEM ---
    socket.on('auth_register', (data, callback) => {
      const res = db.registerUser(data);
      if (res.success) {
        socket.username = res.user.username;
        socket.emit('auth_success', res);
      }
      if (typeof callback === 'function') callback(res);
    });

    socket.on('auth_login', (data, callback) => {
      const res = db.loginUser(data);
      if (res.success) {
        socket.username = res.user.username;
        socket.emit('auth_success', res);
      }
      if (typeof callback === 'function') callback(res);
    });

    socket.on('auth_token_login', ({ token }, callback) => {
      const user = db.getUserByToken(token);
      if (user) {
        socket.username = user.username;
        socket.emit('auth_success', { success: true, token, user });
        if (typeof callback === 'function') callback({ success: true, user });
      } else {
        if (typeof callback === 'function') callback({ success: false });
      }
    });

    socket.on('update_user_profile', (data, callback) => {
      const userToUse = data.username || socket.username;
      if (!userToUse) return;
      const updatedUser = db.updateUserClub(userToUse, data);
      if (updatedUser) {
        socket.emit('user_updated', updatedUser);
        if (typeof callback === 'function') callback({ success: true, user: updatedUser });
      }
    });

    socket.on('save_user_roster', ({ username, roster }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse) return;
      const updatedUser = db.updateUserClub(userToUse, { roster });
      if (updatedUser) {
        socket.emit('user_updated', updatedUser);
        if (typeof callback === 'function') callback({ success: true, user: updatedUser });
      }
    });

    socket.on('reset_user_season', ({ username }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse) return;
      const updatedUser = db.resetUserSeason(userToUse);
      if (updatedUser) {
        socket.emit('user_updated', updatedUser);
        if (typeof callback === 'function') callback({ success: true, user: updatedUser });
      }
    });

    socket.on('get_tier_overview', ({ tierKey }, callback) => {
      const overview = db.getTierOverview(tierKey);
      if (typeof callback === 'function') callback(overview);
    });

    // --- SCHEDULE & TIMETABLE EVENTS ---
    socket.on('get_user_schedule', ({ username }, callback) => {
      const userToUse = username || socket.username;
      if (!scheduleEngine) return;
      const sched = scheduleEngine.getUserSchedule(userToUse);
      if (typeof callback === 'function') callback(sched);
    });

    // --- LIVE BOT MATCHES (ESPOR TV) ---
    socket.on('get_live_matches', (callback) => {
      if (!scheduleEngine) return;
      const list = scheduleEngine.getLiveMatchesSummary();
      if (typeof callback === 'function') callback(list);
    });

    socket.on('spectate_live_match', ({ matchId }, callback) => {
      if (!scheduleEngine) return;
      const liveMatch = scheduleEngine.getLiveMatchById(matchId);
      if (!liveMatch) {
        if (typeof callback === 'function') callback({ success: false, error: 'Maç bulunamadı!' });
        return;
      }

      // Load into visual match engine so radar displays it in real time
      match.loadLiveSpectateMatch(liveMatch);

      io.emit('chat_message', {
        sender: 'ESPOR TV',
        text: `📡 Canlı Yayın Başladı: ${liveMatch.homeTeam.name} vs ${liveMatch.awayTeam.name} (${liveMatch.tierName})`
      });

      if (typeof callback === 'function') callback({ success: true, matchInfo: match.matchInfo });
    });

    // --- TOURNAMENT EVENTS ---
    socket.on('get_tournaments', (callback) => {
      if (!tournamentEngine) return;
      const tournaments = tournamentEngine.getTournamentsList();
      if (typeof callback === 'function') callback(tournaments);
    });

    socket.on('register_tournament', ({ tournamentId, username }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse || !tournamentEngine) return;
      const user = db.getUserRecordByUsername(userToUse);
      if (!user) {
        if (typeof callback === 'function') callback({ success: false, error: 'Kullanıcı bulunamadı.' });
        return;
      }
      const res = tournamentEngine.registerUserClub(tournamentId, {
        id: user.club.id,
        name: user.club.name,
        icon: user.club.icon,
        color: user.club.color,
        stats: user.club.stats,
        roster: user.club.roster,
        username: userToUse
      });
      if (typeof callback === 'function') callback(res);
    });

    // --- REPLAY SYSTEM ---
    socket.on('get_match_replay', ({ replayId }, callback) => {
      if (!replayManager) return;
      const rep = replayManager.getReplay(replayId);
      if (typeof callback === 'function') callback(rep);
    });

    socket.on('get_user_replays', ({ username }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse || !replayManager) return;
      const user = db.getUserRecordByUsername(userToUse);
      if (!user) return;
      const replays = replayManager.getReplaysForUser(user.club.id);
      if (typeof callback === 'function') callback(replays);
    });

    // --- CALENDAR & DAILY MATCH LIMIT (MAX 2 PER DAY) ---
    socket.on('advance_season_day', ({ username }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse) return;
      const updatedUser = db.advanceToNextDay(userToUse);
      if (updatedUser) {
        socket.emit('user_updated', updatedUser);
        io.emit('chat_message', {
          sender: 'LİG YÖNETİMİ',
          text: `🌅 ${updatedUser.club.name} yeni güne başladı! (Gün ${updatedUser.leagueData.seasonDay} - 2 Yeni Lig Maçı Hazır)`
        });
        if (typeof callback === 'function') callback({ success: true, user: updatedUser });
      }
    });

    // --- PLAYER TRAINING FACILITY ---
    socket.on('start_player_training', ({ username, playerId, drillKey }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse) return;
      const res = db.startPlayerTraining(userToUse, playerId, drillKey);
      if (res && res.success && res.user) {
        socket.emit('user_updated', res.user);
      }
      if (typeof callback === 'function') callback(res);
    });

    socket.on('claim_player_training', ({ username, playerId }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse) return;
      const res = db.claimPlayerTraining(userToUse, playerId);
      if (res && res.success && res.user) {
        socket.emit('user_updated', res.user);
        io.emit('chat_message', {
          sender: 'ANTRENÖR',
          text: `💪 ${res.player.name} özel kampını tamamladı ve yeteneklerini geliştirdi!`
        });
      }
      if (typeof callback === 'function') callback(res);
    });

    // --- HAZIRLIK & SCRIM MAÇLARI ---
    socket.on('start_scrim_match', ({ username, opponentId, tacticalFocus, liveArena }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse) return;

      if (liveArena) {
        const opponent = ALL_100_TEAMS.find(t => t.id === opponentId) || ALL_100_TEAMS[0];
        const userRecord = db.getUserRecordByUsername(userToUse);
        if (!userRecord) return;

        const scrimMatchInfo = {
          matchId: `scrim_${Date.now()}`,
          week: 0,
          weekName: `Hazırlık Maçı • ${tacticalFocus || 'Taktik Denemesi'}`,
          isHome: true,
          userClub: userRecord.club,
          opponent,
          isScrim: true
        };
        match.loadUserMatch(scrimMatchInfo, userToUse);
        io.emit('chat_message', {
          sender: 'ANTRENÖR',
          text: `🥊 HAZIRLIK MAÇI ARENASI AÇILDI: ${userRecord.club.name} vs ${opponent.name} (${tacticalFocus || 'Taktik Denemesi'})`
        });
        if (typeof callback === 'function') callback({ success: true, isLive: true });
      } else {
        const res = db.startScrimMatch(userToUse, { opponentId, tacticalFocus });
        if (res && res.success) {
          socket.emit('user_updated', res.user);
          if (typeof callback === 'function') callback(res);
        }
      }
    });

    // --- LEAGUE MATCH START (Live Real-Time Simulation) ---
    socket.on('start_league_match', ({ username }, callback) => {
      const userToUse = username || socket.username;
      if (!userToUse) return;
      const nextMatch = db.getUserNextMatch(userToUse);
      if (!nextMatch) {
        if (typeof callback === 'function') callback({ success: false, error: 'Sıradaki maç bulunamadı!' });
        return;
      }
      const loaded = match.loadUserMatch(nextMatch, userToUse);
      if (loaded) {
        io.emit('chat_message', {
          sender: 'LİG HAKEMİ',
          text: `🏆 CANLI MAÇ BAŞLADI: ${nextMatch.userClub.name} vs ${nextMatch.opponent.name} (${nextMatch.weekName})`
        });
        if (typeof callback === 'function') callback({ success: true, matchInfo: match.matchInfo });
      }
    });

    // LEAGUE: UPDATE USER CLUB
    socket.on('update_user_club', (clubData) => {
      if (!match.league) return;
      match.league.updateUserClub(clubData);
      if (clubData.roster && match.matchInfo && match.matchInfo.isLeagueMatch) {
        if (match.userSide === 'ct') match.currentRosters.ct = JSON.parse(JSON.stringify(clubData.roster));
        else match.currentRosters.t = JSON.parse(JSON.stringify(clubData.roster));
        match.setTeamRoster(match.userSide, clubData.roster);
      }
      io.emit('league_data', match.league.getLeagueData());
      io.emit('chat_message', {
        sender: 'KULÜP BAŞKANI',
        text: `👔 Kulüp ve kadro güncellendi: ${match.league.userClub.name}`
      });
    });

    // LEAGUE: RESET SEASON
    socket.on('reset_league_season', () => {
      if (!match.league) return;
      match.league.resetSeason();
      match.loadLeagueMatch();
      io.emit('league_data', match.league.getLeagueData());
      io.emit('chat_message', {
        sender: 'LİG BAŞKANI',
        text: `🏆 YENİ SEZON BAŞLADI! Tüm puanlar sıfırlandı, 1. Hafta maçları hazır.`
      });
    });

    // START MATCH
    socket.on('start_match', () => {
      match.startMatch();
      io.emit('chat_message', { sender: 'HAKEM', text: 'MAÇ BAŞLATILDI! 1. Raund Hazırlık Aşaması.' });
    });

    // PAUSE / RESUME
    socket.on('toggle_pause', () => {
      match.isPaused = !match.isPaused;
      const txt = match.isPaused ? 'Maç DURAKLATILDI.' : 'Maç DEVAM EDİYOR.';
      io.emit('chat_message', { sender: 'HAKEM', text: txt });
    });

    // RESTART MATCH
    socket.on('restart_match', () => {
      match.phase = 'lobby';
      match.score = { ct: 0, t: 0 };
      match.round = 1;
      match.initPlayers();
      io.emit('chat_message', { sender: 'HAKEM', text: 'Maç sıfırlandı, lobiye dönüldü.' });
    });

    // BECOME COACH / CLAIM TEAM (Multiplayer Online)
    socket.on('join_coach', ({ team, coachName }) => {
      if (team === 'ct' || team === 't') {
        match.coaches[team].name = coachName || `${team.toUpperCase()} Sahibi / Koçu`;
        match.coaches[team].isHuman = true;
        match.coaches[team].socketId = socket.id;
        match.connectedSockets[socket.id] = { team, coachName: match.coaches[team].name };
        socket.emit('coach_joined_ack', { team, coachName: match.coaches[team].name });
        io.emit('coaches_updated', match.coaches);
        io.emit('chat_message', { 
          sender: 'LİG YÖNETİMİ', 
          text: `🟢 ${match.coaches[team].name} (${team.toUpperCase()}) çevrimiçi oldu ve takımının yönetimini devraldı!` 
        });
      }
    });

    // THE ONLY IN-GAME POWER: TACTICAL TIMEOUT (MOLA AL)
    socket.on('call_timeout', ({ team }) => {
      if (team === 'ct' || team === 't') {
        if (match.coaches[team].timeoutsLeft > 0 && match.phase === 'freeze') {
          match.coaches[team].timeoutsLeft--;
          match.phase = 'timeout';
          match.timeoutState = {
            active: true,
            callingTeam: team,
            timer: 25
          };
          io.emit('timeout_called', { team, coach: match.coaches[team].name });
          io.emit('chat_message', { sender: 'HAKEM', text: `${team.toUpperCase()} Takımı Koçu Taktiksel Mola aldı! (25s)` });
        }
      }
    });

    // MANAGER / CLUB OWNER: UPDATE TEAM ROSTER
    socket.on('update_team_roster', ({ team, roster }) => {
      if (team === 'ct' || team === 't') {
        const updated = match.setTeamRoster(team, roster);
        io.emit('roster_updated', { team, roster: updated });
        io.emit('chat_message', {
          sender: 'KULÜP BAŞKANI',
          text: `${team.toUpperCase()} Takım Kadrosu güncellendi! Yeni transferler oyuna dahil oldu.`
        });
      }
    });

    // MANAGER: LOAD ROSTER PRESET
    socket.on('load_roster_preset', ({ team, presetKey }) => {
      const preset = ROSTER_PRESETS[presetKey];
      if (preset && (team === 'ct' || team === 't')) {
        const squad = preset.playerIds.map(id => PRO_PLAYER_POOL.find(p => p.id === id)).filter(Boolean);
        if (squad.length === 5) {
          const updated = match.setTeamRoster(team, squad);
          io.emit('roster_updated', { team, roster: updated });
          io.emit('chat_message', {
            sender: 'KULÜP BAŞKANI',
            text: `${team.toUpperCase()} Takımı "${preset.name}" kadrosuna geçirildi!`
          });
        }
      }
    });

    socket.on('send_chat', ({ text, sender }) => {
      io.emit('chat_message', { sender: sender || 'İzleyici', text, time: Date.now() });
    });

    // Real-Time Online Disconnect Handler
    socket.on('disconnect', () => {
      const user = match.connectedSockets[socket.id];
      if (user && user.team && match.coaches[user.team]) {
        match.coaches[user.team].isHuman = false;
        match.coaches[user.team].socketId = null;
        io.emit('coaches_updated', match.coaches);
        io.emit('chat_message', { 
          sender: 'LİG YÖNETİMİ', 
          text: `⚪ ${user.coachName || user.team.toUpperCase()} ayrıldı. Takım otonom moda geçti.` 
        });
      }
      delete match.connectedSockets[socket.id];
      io.emit('online_count', Object.keys(match.connectedSockets).length);
    });
  });
}

module.exports = {
  registerSocketHandlers
};
