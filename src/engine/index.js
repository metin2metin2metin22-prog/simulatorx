// SimulatorX - Engine Subsystems Index
// Centralized modular exports for simulation, physics, combat, tactics, and economy.

const { PureCoachMatch } = require('./MatchEngine');
const { CollisionSystem } = require('./CollisionSystem');
const { CombatSystem } = require('./CombatSystem');
const { BotTactics } = require('./BotTactics');
const { BombManager } = require('./BombManager');
const { EconomySystem } = require('./EconomySystem');
const { MovementSystem, PRE_AIM_DIRECTIONS } = require('./MovementSystem');
const { LeagueManager } = require('./LeagueManager');

module.exports = {
  PureCoachMatch,
  CollisionSystem,
  CombatSystem,
  BotTactics,
  BombManager,
  EconomySystem,
  MovementSystem,
  LeagueManager,
  PRE_AIM_DIRECTIONS
};
