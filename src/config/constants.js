// SimulatorX - Global Configuration & Strategy Constants
const PORT = process.env.PORT || 3000;

// Autonomous IGL Strategy Identifiers
const T_STRATS = ['rush_b', 'a_short_rush', 'long_a_execute', 'a_split', 'mid_to_b', 'fake_a_to_b'];
const CT_STRATS = ['standard_212', 'aggressive_long', 'b_stack', 'cat_control', 'retake_defense'];

// Default AI Coaches for both sides
const DEFAULT_COACHES = {
  ct: { name: 'B1ad3 (CT Koçu)', isHuman: false, socketId: null, timeoutsLeft: 2 },
  t: { name: 'zonic (T Koçu)', isHuman: false, socketId: null, timeoutsLeft: 2 }
};

module.exports = {
  PORT,
  T_STRATS,
  CT_STRATS,
  DEFAULT_COACHES
};
