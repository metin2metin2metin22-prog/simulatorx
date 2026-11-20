// SimulatorX - Socket.io Real-Time Networking & Event Dispatcher
const { WEAPONS } = require('../config/weapons');
const { ROSTERS, DEFAULT_ROSTERS, PRO_PLAYER_POOL, PERK_DEFINITIONS, ROSTER_PRESETS, calculateTeamStats } = require('../config/rosters');

function registerSocketHandlers(io, match) {
  io.on('connection', (socket) => {
    socket.emit('init_data', {
      mapData: match.mapData,
      weapons: WEAPONS,
      strats: match.mapData.strategies,
      rosters: match.currentRosters || ROSTERS,
      playerPool: PRO_PLAYER_POOL,
      perks: PERK_DEFINITIONS,
      presets: ROSTER_PRESETS,
      league: match.league ? match.league.getLeagueData() : null,
      userClub: match.league ? match.league.userClub : null
    });

    // LEAGUE: PLAY NEXT MATCH
    socket.on('play_league_match', () => {
      const loaded = match.loadLeagueMatch();
      if (loaded) {
        io.emit('chat_message', {
          sender: 'LİG HAKEMİ',
          text: `🏆 ${match.matchInfo.weekName.toUpperCase()} BAŞLADI: ${match.matchInfo.userClub.name} vs ${match.matchInfo.opponent.name}!`
        });
      }
    });

    // LEAGUE: QUICK SIMULATE MATCH
    socket.on('quick_sim_league_match', () => {
      if (!match.league) return;
      const nextMatch = match.league.getUserNextMatch();
      if (!nextMatch) return;
      const userTeam = match.league.getTeamById(match.league.userClub.id);
      const opponentTeam = nextMatch.opponent;
      const sim = match.league.simulateBotMatch(userTeam, opponentTeam);
      
      const homeScore = nextMatch.isHome ? sim.homeScore : sim.awayScore;
      const awayScore = nextMatch.isHome ? sim.awayScore : sim.homeScore;
      match.league.advanceWeekWithUserResult(homeScore, awayScore);
      io.emit('league_data', match.league.getLeagueData());
      io.emit('chat_message', {
        sender: 'LİG HAKEMİ',
        text: `⚡ ${nextMatch.weekName} Simüle Edildi: ${userTeam.name} ${homeScore} : ${awayScore} ${opponentTeam.name}`
      });
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

    // BECOME COACH
    socket.on('join_coach', ({ team, coachName }) => {
      if (team === 'ct' || team === 't') {
        match.coaches[team].name = coachName || `${team.toUpperCase()} Koçu`;
        match.coaches[team].isHuman = true;
        match.coaches[team].socketId = socket.id;
        match.connectedSockets[socket.id] = { team, coachName };
        socket.emit('coach_joined_ack', { team, coachName });
        io.emit('chat_message', { sender: 'SİSTEM', text: `${coachName} artık ${team.toUpperCase()} Takımı Koçu!` });
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

    socket.on('set_speed', ({ speed }) => {
      match.simSpeed = speed;
    });

    socket.on('disconnect', () => {
      const user = match.connectedSockets[socket.id];
      if (user && match.coaches[user.team]) {
        match.coaches[user.team].isHuman = false;
        match.coaches[user.team].socketId = null;
        delete match.connectedSockets[socket.id];
      }
    });
  });
}

module.exports = {
  registerSocketHandlers
};
