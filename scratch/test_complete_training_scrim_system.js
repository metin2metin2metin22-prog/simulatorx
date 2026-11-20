const path = require('path');
const { db, TRAINING_DRILLS } = require('../src/storage/db');
const { backgroundMatchSimulator } = require('../src/engine/BackgroundMatchSimulator');
const { replayManager } = require('../src/engine/ReplayManager');
const { GlobalScheduleEngine } = require('../src/engine/GlobalScheduleEngine');
const { ALL_100_TEAMS } = require('../src/config/massiveTeams');
const { AMATEUR_BOT_TEAMS } = require('../src/config/multiLeague');

const globalScheduleEngine = new GlobalScheduleEngine(db);

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING FULL SYSTEM INTEGRATION TESTS');
  console.log('====================================================');

  // Test User
  const testUsername = 'manager_' + Date.now();
  const testClubName = 'Vipers Esports ' + Date.now();
  console.log(`\n1. Creating test user: ${testUsername} with club: ${testClubName}`);

  const regRes = db.registerUser({
    username: testUsername,
    password: 'password123',
    clubName: testClubName,
    clubIcon: '🐍',
    clubColor: '#00d2ff'
  });

  if (!regRes.success) {
    throw new Error(`Failed to register test user: ${regRes.error}`);
  }
  const user = regRes.user;
  console.log(`✅ User registered! Club: ${user.club.name}, Budget: $${user.club.budget}, Roster: ${user.club.roster.length} players`);

  // Verify Player Skills (Baseline)
  const player1 = user.club.roster[0];
  const initialAim = player1.skills.aim;
  const initialHeadshot = player1.skills.headshot || player1.skills.aim;
  const initialBudget = user.club.budget;
  console.log(`Player 1 (${player1.name}): Initial Aim=${initialAim}, HS=${initialHeadshot}, Initial Budget=$${initialBudget}`);

  // Test 1: Training System
  console.log('\n2. Testing Training Facility: Starting "aim_headshot" drill...');
  const trainRes = db.startPlayerTraining(testUsername, player1.id, 'aim_headshot');
  if (!trainRes.success) {
    throw new Error(`Failed to start training: ${trainRes.error}`);
  }
  console.log(`✅ Training started! ${trainRes.message}, New Budget=$${trainRes.user.club.budget}`);
  if (trainRes.user.club.budget !== initialBudget - 1500) {
    throw new Error(`Budget not deducted properly: expected ${initialBudget - 1500}, got ${trainRes.user.club.budget}`);
  }

  // Fast-forward training time in memory for test
  console.log('Fast-forwarding training completion timestamp...');
  const userRec = db.getUserRecordByUsername(testUsername);
  userRec.club.training[player1.id].endTime = Date.now() - 5000; // 5 seconds ago
  db.save();

  console.log('Claiming completed training...');
  const claimRes = db.claimPlayerTraining(testUsername, player1.id);
  if (!claimRes.success) {
    throw new Error(`Failed to claim training: ${claimRes.error}`);
  }
  console.log(`✅ Training claimed! Message: ${claimRes.message}`);

  const trainedPlayer = claimRes.user.club.roster.find(p => p.id === player1.id);
  console.log(`Player 1 New Skills: Aim=${trainedPlayer.skills.aim} (was ${initialAim}), HS=${trainedPlayer.skills.headshot} (was ${initialHeadshot})`);
  if (trainedPlayer.skills.aim <= initialAim || trainedPlayer.skills.headshot <= initialHeadshot) {
    throw new Error('Skill gains were not applied to player!');
  }
  console.log('✅ Player training verified with permanent stat gain!');

  // Test 2: Authentic Background Simulator
  console.log('\n3. Testing Authentic Background Match Simulator...');
  const botTeam1 = AMATEUR_BOT_TEAMS[0];
  const botTeam2 = AMATEUR_BOT_TEAMS[1];
  console.log(`Simulating match: ${botTeam1.name} vs ${botTeam2.name}`);

  const simResult = backgroundMatchSimulator.simulateFullMatch(botTeam1, botTeam2, {
    mapName: 'de_dust2',
    isPlayoff: false
  });

  console.log(`✅ Simulation finished! Final Score: ${simResult.homeTeam.name} ${simResult.score.homeScore} - ${simResult.score.awayScore} ${simResult.awayTeam.name}`);
  console.log(`Winner: ${simResult.winner.name}, Overtime: ${simResult.overtime}, Rounds played: ${simResult.rounds.length}`);
  console.log(`Box Score Home (${simResult.homeBox.length} players):`);
  simResult.homeBox.forEach(p => {
    console.log(`  - ${p.name.padEnd(20)} | K/D: ${p.kills}/${p.deaths} (${p.assists}A) | HS%: ${p.hsPercent}% | ADR: ${p.adr} | HLTV Rating: ${p.rating}`);
  });
  if (!simResult.homeBox[0].rating || simResult.rounds.length < 13) {
    throw new Error('Background simulation generated invalid score or ratings');
  }

  // Test 3: League Schedule & 2 Daily Matches Quota
  console.log('\n4. Testing Daily 2-Match Quota & Season Day Progression...');
  let sched = globalScheduleEngine.getUserSchedule(testUsername);
  console.log(`Initial Schedule: Day ${sched.seasonDay}, Played Today: ${sched.matchesPlayedToday}/${sched.maxDailyMatches}, Daily Quota Done: ${sched.isDailyQuotaCompleted}, Status: ${sched.status}`);

  if (sched.matchesPlayedToday !== 0 || sched.isDailyQuotaCompleted) {
    throw new Error('Initial schedule state unexpected');
  }

  // Record Match 1
  console.log('Recording Match 1 for user (13 - 7 win)...');
  db.recordUserMatchResult(testUsername, 13, 7);

  sched = globalScheduleEngine.getUserSchedule(testUsername);
  console.log(`After Match 1: Played Today: ${sched.matchesPlayedToday}/${sched.maxDailyMatches}, Quota Done: ${sched.isDailyQuotaCompleted}`);
  if (sched.matchesPlayedToday !== 1 || sched.isDailyQuotaCompleted) {
    throw new Error('Match 1 quota check failed');
  }

  // Record Match 2
  console.log('Recording Match 2 for user (10 - 13 loss)...');
  db.recordUserMatchResult(testUsername, 10, 13);

  sched = globalScheduleEngine.getUserSchedule(testUsername);
  console.log(`After Match 2: Played Today: ${sched.matchesPlayedToday}/${sched.maxDailyMatches}, Quota Done: ${sched.isDailyQuotaCompleted}, Status: ${sched.status}`);
  if (sched.matchesPlayedToday !== 2 || !sched.isDailyQuotaCompleted || sched.status !== 'DAILY_LIMIT_REACHED') {
    throw new Error('Match 2 daily quota limit was not triggered');
  }
  console.log('✅ Daily limit reached successfully! Status correctly set to DAILY_LIMIT_REACHED');

  // Advance Season Day
  console.log('Advancing to Next Season Day...');
  const advRes = db.advanceToNextDay(testUsername);
  if (!advRes) {
    throw new Error('Failed to advance day');
  }
  console.log(`✅ Day advanced! Current Day: ${advRes.leagueData.seasonDay}`);

  sched = globalScheduleEngine.getUserSchedule(testUsername);
  console.log(`New Day Schedule: Day ${sched.seasonDay}, Played Today: ${sched.matchesPlayedToday}/${sched.maxDailyMatches}, Quota Done: ${sched.isDailyQuotaCompleted}`);
  if (sched.seasonDay !== 2 || sched.matchesPlayedToday !== 0 || sched.isDailyQuotaCompleted) {
    throw new Error('Schedule did not reset properly for the new day');
  }
  console.log('✅ Daily quota reset and Day 2 opened successfully!');

  // Test 4: Scrim Match Simulation
  console.log('\n5. Testing Scrim / Friendly Match Feature...');
  const scrimRes = db.startScrimMatch(testUsername, {
    opponentId: 'glob_eternal_fire',
    tacticalFocus: 'Rush B & Split Test'
  });

  if (!scrimRes || !scrimRes.success) {
    throw new Error(`Failed to run scrim match: ${scrimRes?.error}`);
  }
  console.log(`✅ Scrim Match completed! Score: ${scrimRes.scrimResult.score.homeScore} - ${scrimRes.scrimResult.score.awayScore}`);
  console.log(`Scrim Replay ID: ${scrimRes.replayId}`);
  const replay = replayManager.getReplay(scrimRes.replayId);
  if (!replay) {
    throw new Error('Scrim replay was not properly archived');
  }
  console.log(`✅ Scrim replay verified in db! Title: ${replay.tierName}, Teams: ${replay.homeTeam.name} vs ${replay.awayTeam.name}`);

  const userAfterScrim = db.getUserRecordByUsername(testUsername);
  console.log(`Total Scrims Recorded for Club: ${userAfterScrim.club.stats.scrimsPlayed}`);
  if (!userAfterScrim.club.stats.scrimsPlayed || userAfterScrim.club.stats.scrimsPlayed < 1) {
    throw new Error('Club scrimsPlayed stat not incremented');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
