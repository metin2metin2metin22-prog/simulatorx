// SimulatorX - Main Architecture Export Index
// Provides unified access to all engine subsystems, configurations, and network handlers.

const engine = require('./engine');
const constants = require('./config/constants');
const rosters = require('./config/rosters');
const weapons = require('./config/weapons');
const pathfinding = require('./navigation/pathfinding');
const { registerSocketHandlers } = require('./network/socketHandler');

module.exports = {
  ...engine,
  constants,
  rosters,
  weapons,
  pathfinding,
  registerSocketHandlers
};
