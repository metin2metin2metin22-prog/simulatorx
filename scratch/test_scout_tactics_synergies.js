const path = require('path');
const { db, SCOUTING_PROGRAMS } = require('../src/storage/db');
const { backgroundMatchSimulator } = require('../src/engine/BackgroundMatchSimulator');
const { ALL_100_TEAMS } = require('../src/config/massiveTeams');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING SCOUTING, TACTICAL PLAYBOOK & SYNERGIES');
  console.log('====================================================');

  const testUser = 'scout_mgr_' + Date.now();
  const testClub = 'Thunderbirds ' + Date.now();
  console.log(`\n1. Creating manager: ${testUser} (${testClub})`);

  const reg = db.registerUser({
    username: testUser,
    password: 'password123',
    clubName: testClub,
    clubIcon: '⚡'
  });

  if (!reg.success) throw new Error('Registration failed');
  const user = reg.user;
  user.club.budget = 75000; // Provide adequate budget for wonderkid testing
  db.save();
  console.log(`✅ Registered! Budget: $${user.club.budget}, Roster size: ${user.club.roster.length}`);

  // Test 1: Scouting Mission
  console.log('\n2. Testing Youth Academy Scouting: Starting "wonderkid" mission...');
  const initialBudget = user.club.budget;
  const scoutStart = db.startScoutingMission(testUser, 'wonderkid');
  if (!scoutStart.success) throw new Error(`Scouting start failed: ${scoutStart.error}`);
  console.log(`✅ ${scoutStart.message}`);
  if (scoutStart.user.club.budget !== initialBudget - 6000) {
    throw new Error('Budget not deducted properly for wonderkid scouting');
  }

  // Fast forward scouting mission
  console.log('Fast-forwarding scouting mission timer...');
  const userRec = db.getUserRecordByUsername(testUser);
  userRec.club.scouting.endTime = Date.now() - 5000;
  db.save();

  console.log('Claiming scout report...');
  const claimRes = db.claimScoutingReport(testUser);
  if (!claimRes.success) throw new Error(`Claim scout report failed: ${claimRes.error}`);
  console.log(`✅ ${claimRes.message}`);
  console.log(`Discovered Candidates (${claimRes.candidates.length}):`);
  claimRes.candidates.forEach((c, idx) => {
    console.log(`  [${idx + 1}] ${c.name} (${c.age} yrs) - ${c.tier} • Role: ${c.role} • Potential: ${c.potentialStars} Stars • Price: $${c.price}`);
    console.log(`      AIM: ${c.skills.aim} | REF: ${c.skills.reflex} | Perk: ${c.perk}`);
    console.log(`      Note: "${c.scoutNote}"`);
  });

  if (claimRes.candidates.length !== 3 || !claimRes.candidates[0].skills.aim) {
    throw new Error('Scout candidates generation invalid');
  }

  // Test 2: Signing Scout Candidate into Slot 0
  const candidateToSign = claimRes.candidates[0];
  console.log(`\n3. Signing candidate ${candidateToSign.name} into Slot 1 (replacing ${user.club.roster[0].name})...`);
  const budgetBeforeSign = userRec.club.budget;

  const signRes = db.signScoutCandidate(testUser, candidateToSign.id, 0);
  if (!signRes.success) throw new Error(`Signing candidate failed: ${signRes.error}`);
  console.log(`✅ ${signRes.message}`);

  const userAfterSign = db.getUserRecordByUsername(testUser);
  console.log(`New Slot 1 Player: ${userAfterSign.club.roster[0].name} (Skills AIM: ${userAfterSign.club.roster[0].skills.aim})`);
  if (userAfterSign.club.roster[0].name !== candidateToSign.name) {
    throw new Error('Roster slot was not updated with signed candidate');
  }
  if (userAfterSign.club.budget !== budgetBeforeSign - candidateToSign.price) {
    throw new Error('Candidate price was not deducted properly from budget');
  }
  console.log(`✅ Candidate successfully signed and active in roster! Remaining candidates: ${userAfterSign.club.scoutCandidates.length}`);

  // Test 3: Tactical Playbook & Presets
  console.log('\n4. Testing Tactical Playbook Configuration...');
  const tacticsRes = db.updateTeamTactics(testUser, {
    tStrategy: 'rush_b',
    ctStrategy: 'passive_retake',
    ecoStrategy: 'aggressive_force',
    primaryAwperSlot: 1,
    iglSlot: 5
  });

  if (!tacticsRes.success) throw new Error(`Updating tactics failed: ${tacticsRes.error}`);
  console.log(`✅ ${tacticsRes.message} T-Strat: ${tacticsRes.tactics.tStrategy}, CT-Strat: ${tacticsRes.tactics.ctStrategy}`);

  // Test 4: Player Roles & Slot Swapping
  console.log('\n5. Testing Player Role Assignment & Slot Swapping...');
  const p2 = userAfterSign.club.roster[1];
  const roleRes = db.updatePlayerRole(testUser, p2.id, 'In-Game Leader (IGL)');
  if (!roleRes.success) throw new Error(`Update role failed: ${roleRes.error}`);
  console.log(`✅ ${roleRes.message}`);

  const slot0Before = userAfterSign.club.roster[0].name;
  const slot1Before = userAfterSign.club.roster[1].name;
  console.log(`Swapping Slot 1 (${slot0Before}) with Slot 2 (${slot1Before})...`);
  const swapRes = db.swapRosterSlots(testUser, 0, 1);
  if (!swapRes.success) throw new Error(`Swap slots failed: ${swapRes.error}`);
  console.log(`✅ ${swapRes.message}`);

  const userAfterSwap = db.getUserRecordByUsername(testUser);
  console.log(`Slot 1 is now: ${userAfterSwap.club.roster[0].name}, Slot 2 is now: ${userAfterSwap.club.roster[1].name}`);
  if (userAfterSwap.club.roster[0].name !== slot1Before || userAfterSwap.club.roster[1].name !== slot0Before) {
    throw new Error('Slot swap failed');
  }

  // Test 5: Scrim Simulation with Tactics, Form & Synergies
  console.log('\n6. Testing Background Simulation with Tactics, Role Synergies & Dynamic Form...');
  const scrimRes = db.startScrimMatch(testUser, {
    opponentId: 'glob_vitality',
    tacticalFocus: 'Rush B & Catwalk Split'
  });

  if (!scrimRes.success) throw new Error('Scrim match failed');
  console.log(`✅ Scrim finished! Score: ${scrimRes.scrimResult.score.homeScore} - ${scrimRes.scrimResult.score.awayScore}`);
  console.log('Player Forms after match:');
  const userFinal = db.getUserRecordByUsername(testUser);
  userFinal.club.roster.forEach(p => {
    console.log(`  - ${p.name.padEnd(25)} | Role: ${p.role.padEnd(20)} | Form: ${p.form || 'normal'}`);
  });

  console.log('\n====================================================');
  console.log('🎉 ALL SCOUTING, TACTICS & FORM TESTS PASSED 100%!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
