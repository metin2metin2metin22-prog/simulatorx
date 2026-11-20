// SimulatorX - Socket.io Real-Time Networking & Event Dispatcher
const { WEAPONS } = require('../config/weapons');
const { ROSTERS } = require('../config/rosters');

function registerSocketHandlers(io, match) {
  io.on('connection', (socket) => {
    socket.emit('init_data', {
      mapData: match.mapData,
      weapons: WEAPONS,
      strats: match.mapData.strategies,
      rosters: ROSTERS
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
          Object.values(match.players).filter(p => p.team === team).forEach(p => {
            p.tilt = 0;
            p.morale = Math.min(100, p.morale + 20);
          });
          io.emit('timeout_called', { team, coach: match.coaches[team].name });
          io.emit('chat_message', { sender: 'HAKEM', text: `${team.toUpperCase()} Takımı Koçu Taktiksel Mola aldı! (25s)` });
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
