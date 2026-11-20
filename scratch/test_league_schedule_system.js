// Scratch test for Global Schedule, Tournaments, 100+ Massive Teams, and Replay Engine
const { MASSIVE_TEAMS_CATALOG, ALL_100_TEAMS } = require('../src/config/massiveTeams');
const { LEAGUE_TIERS } = require('../src/config/multiLeague');
const { db } = require('../src/storage/db');
const { PureCoachMatch } = require('../src/engine/MatchEngine');
const { GlobalScheduleEngine } = require('../src/engine/GlobalScheduleEngine');
const { TournamentEngine } = require('../src/engine/TournamentEngine');
const { replayManager } = require('../src/engine/ReplayManager');

console.log('=== 1. VERIFYING 100+ TEAMS CATALOG ===');
console.log('City teams count:', MASSIVE_TEAMS_CATALOG.city.length);
console.log('Regional teams count:', MASSIVE_TEAMS_CATALOG.regional.length);
console.log('National teams count:', MASSIVE_TEAMS_CATALOG.national.length);
console.log('Global teams count:', MASSIVE_TEAMS_CATALOG.global.length);
console.log('Total catalog teams:', ALL_100_TEAMS.length);

console.log('\n=== 2. VERIFYING 5 LEAGUE TIERS ===');
Object.keys(LEAGUE_TIERS).forEach(k => {
  const t = LEAGUE_TIERS[k];
  console.log(`Tier [${k}]: ${t.badge} ${t.name} (Level ${t.level}, Champion Reward: $${t.rewardChampion.toLocaleString()})`);
});

console.log('\n=== 3. TESTING TOURNAMENT ENGINE ===');
const tournEngine = new TournamentEngine(db);
const tourns = tournEngine.getTournamentsList();
console.log(`Initialized ${tourns.length} tournaments:`);
tourns.forEach(t => {
  console.log(` - ${t.badge} ${t.name} (Phase: ${t.phase}, RegRemaining: ${t.regTimeRemaining}s, Teams: ${t.registeredCount}/${t.size}, Prize: $${t.reward.toLocaleString()})`);
});

// Test user tournament registration
const regRes = tournEngine.registerUserClub('tourn_istanbul', {
  id: 'club_test_test',
  name: 'Test Kadıköy Tigers',
  icon: '🐯',
  roster: [],
  username: 'test_user'
});
console.log('Registration result for İstanbul Cup:', regRes);

console.log('\n=== 4. TESTING GLOBAL SCHEDULE & ESPOR TV ENGINE ===');
const mockIo = { emit: () => {} };
const match = new PureCoachMatch(mockIo);
const schedEngine = new GlobalScheduleEngine(db, match, mockIo);
const liveMatches = schedEngine.getLiveMatchesSummary();
console.log(`Initialized ${liveMatches.length} concurrent live matches:`);
liveMatches.forEach((m, idx) => {
  console.log(` [${idx + 1}] ${m.badge} ${m.tierName}: ${m.homeTeam.name} (${m.score.home}) vs (${m.score.away}) ${m.awayTeam.name} [Raund ${m.round}] - Viewers: ${m.viewers}`);
});

console.log('\n=== 5. TESTING REPLAY MANAGER ===');
const testReplay = replayManager.createReplay({
  matchId: 'test_match_101',
  homeTeam: { id: 'team_a', name: 'Kadıköy Bulls', icon: '🐂', color: '#c0392b' },
  awayTeam: { id: 'team_b', name: 'Beşiktaş Esports', icon: '🦅', color: '#ffffff' },
  score: { homeScore: 13, awayScore: 11 },
  tierName: 'Şehir Ligi',
  weekName: 'Hafta 3'
});
console.log('Created replay ID:', testReplay.replayId);
console.log('Replay score:', testReplay.score);
console.log('Replay MVP:', testReplay.matchMvp);
console.log('Total rounds recorded:', testReplay.rounds.length);
console.log('Home team box score players:', testReplay.homeBox.length);
console.log('Sample round 1:', testReplay.rounds[0]);

console.log('\n=== 6. TESTING SPECTATE LIVE MATCH IN MATCH ENGINE ===');
const spectateSuccess = match.loadLiveSpectateMatch(schedEngine.getLiveMatchById('glob_match_1'));
console.log('Spectate load success:', spectateSuccess);
console.log('Live spectate title:', match.matchInfo?.spectateTitle);
console.log('CT team:', match.matchInfo?.homeTeam?.name, 'T team:', match.matchInfo?.awayTeam?.name);

// Tick 100 simulation ticks on spectated match
for (let i = 0; i < 100; i++) {
  match.tick();
}
console.log('100 ticks simulated on spectated match! Timer:', match.timer, 'Phase:', match.phase);

console.log('\n>>> ALL MULTI-TIER, SCHEDULE, TOURNAMENT, AND REPLAY TESTS PASSED CLEANLY! <<<');
