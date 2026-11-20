const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const { PORT } = require('./src/config/constants');
const { PureCoachMatch } = require('./src/engine/MatchEngine');
const { registerSocketHandlers } = require('./src/network/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Initialize match engine and attach socket handlers
const match = new PureCoachMatch(io);
registerSocketHandlers(io, match);

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   CS:GO Pure Coach Simulator Running on Port ${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser`);
  console.log(`===============================================`);
});
