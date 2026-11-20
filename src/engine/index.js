// SimulatorX - Engine Subsystems Index
// Centralized modular exports for simulation, physics, combat, tactics, and economy.

const { PureCoachMatch } = require('./MatchEngine');
const { CollisionSystem } = require('./CollisionSystem');
const { CombatSystem } = require('./CombatSystem');
const { BotTactics } = require('./BotTactics');
const { BombManager } = require('./BombManager');
const { EconomySystem } = require('./EconomySystem');
const { MovementSystem, PRE_AIM_DIRECTIONS } = require('./MovementSystem');

module.exports = {
  PureCoachMatch,
  CollisionSystem,
  CombatSystem,
  BotTactics,
  BombManager,
  EconomySystem,
  MovementSystem,
  PRE_AIM_DIRECTIONS
};
