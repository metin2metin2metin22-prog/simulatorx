const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const { PORT } = require('./src/config/constants');
const { PureCoachMatch } = require('./src/engine/MatchEngine');
const { GlobalScheduleEngine } = require('./src/engine/GlobalScheduleEngine');
const { TournamentEngine } = require('./src/engine/TournamentEngine');
const { replayManager } = require('./src/engine/ReplayManager');
const { db } = require('./src/storage/db');
const { registerSocketHandlers } = require('./src/network/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Initialize match engine, schedule engine, tournament engine, and attach socket handlers
const match = new PureCoachMatch(io);
const scheduleEngine = new GlobalScheduleEngine(db, match, io);
const tournamentEngine = new TournamentEngine(db);

registerSocketHandlers(io, match, scheduleEngine, tournamentEngine, replayManager);

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   CS:GO Pure Coach Simulator Running on Port ${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser`);
  console.log(`===============================================`);
});
