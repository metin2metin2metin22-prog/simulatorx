// CS:GO Pure Coach Simulator - Client Controller
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const canvas = document.getElementById('radarCanvas');
  const radar = new RadarRenderer(canvas);
  const hud = new HUDManager();
  const rosterManager = new RosterManager();
  rosterManager.init(socket);
  window.rosterManager = rosterManager;

  const dashboardUI = new DashboardUI();
  dashboardUI.init(socket);
  window.dashboardUI = dashboardUI;

  const leagueUI = new LeagueUI();
  leagueUI.init(socket);
  window.leagueUI = leagueUI;

  const btnOpenLeagueSide = document.getElementById('btnOpenLeagueModalSide');
  if (btnOpenLeagueSide) {
    btnOpenLeagueSide.addEventListener('click', () => {
      leagueUI.openModal();
    });
  }

  let localTeam = null; // 'ct', 't', or null
  let coachName = 'Koç';
  let currentGameState = null;
  let audioInitialized = false;
  let firstStateReceived = false;

  const initAudio = () => {
    if (!audioInitialized) {
      window.soundEngine.init();
      audioInitialized = true;
    }
  };
  window.addEventListener('click', initAudio, { once: true });
  window.addEventListener('keydown', initAudio, { once: true });

  // 1. GAME STATE UPDATES FROM SERVER
  socket.on('game_update', (state) => {
    currentGameState = state;

    if (!firstStateReceived) {
      firstStateReceived = true;
      if (state.killfeed) {
        hud.updateKillfeed(state.killfeed);
      }
    }

    if (state.events && state.events.length > 0) {
      state.events.forEach(evt => handleGameEvent(evt));
    }

    hud.updateHUD(state, localTeam);
  });

  function handleGameEvent(evt) {
    switch (evt.type) {
      case 'shoot':
        radar.addTracer(evt.fromX, evt.fromY, evt.toX, evt.toY, evt.weapon, evt.isHit, evt.isHeadshot);
        window.soundEngine.playShoot(evt.weapon);
        break;
      case 'fake_shots':
        window.soundEngine.playShoot('ak47');
        if (radar && radar.addPing) {
          radar.addPing(evt.x, evt.y, 'Ateş!', 'warning');
        }
        break;
      case 'weapon_steal':
        hud.addChatMessage('SİLAH', `Silah ele geçirildi: ${evt.weapon.toUpperCase()}`, 'system');
        break;
      case 'headshot':
        window.soundEngine.playHeadshot();
        break;
      case 'flash_pop':
        window.soundEngine.playFlashbang();
        break;
      case 'smoke_pop':
        window.soundEngine.playSmoke();
        break;
      case 'molotov_pop':
        window.soundEngine.playMolotov();
        break;
      case 'fire_extinguished':
        window.soundEngine.playExtinguish();
        break;
      case 'he_pop':
        window.soundEngine.playHE();
        break;
      case 'bomb_beep':
        window.soundEngine.playBombBeep(evt.urgency || 1);
        break;
      case 'bomb_planted':
        window.soundEngine.playBombPlanted();
        hud.addChatMessage('SİSTEM', `Bomba ${evt.site} bölgesine kuruldu!`, 't');
        break;
      case 'bomb_spotted':
        window.soundEngine.playBombSpotted(evt.site);
        radar.addPing(evt.x, evt.y, '', 'danger');
        break;
      case 'rush_detected':
        window.soundEngine.playBombSpotted(evt.site);
        radar.addPing(evt.site === 'B' ? 215 : 819, evt.site === 'B' ? 123 : 164, '', 'warning');
        break;
      case 'bomb_dropped':
        window.soundEngine.playBombDropped();
        hud.addChatMessage('C4', 'BOMBA YERE DÜŞTÜ!', 't');
        break;
      case 'bomb_pickup':
        window.soundEngine.playBombPickup();
        hud.addChatMessage('C4', 'Bomba geri alındı!', 't');
        break;
      case 'bomb_defused':
        window.soundEngine.playBombDefused();
        hud.addChatMessage('C4', `Bomba ${evt.defuserName || 'CT'} tarafından imha edildi!`, 'ct');
        break;
      case 'fake_defuse':
        hud.addChatMessage('CT', `${evt.defuserName || 'CT'} Fake Defuse yaptı!`, 'ct');
        break;
      case 'kit_pickup':
        hud.addChatMessage('CT', `İmha kiti yerden alındı!`, 'ct');
        break;
      case 'footstep':
        if (radar && radar.addFootstep) {
          radar.addFootstep(evt.x, evt.y, evt.team);
        }
        if (window.soundEngine && window.soundEngine.playFootstep) {
          window.soundEngine.playFootstep();
        }
        break;
      case 'reload_start':
        if (window.soundEngine && window.soundEngine.playReload) {
          window.soundEngine.playReload();
        }
        break;
      case 'kill':
        hud.addKillfeedItem(evt);
        if (evt.isHeadshot) {
          window.soundEngine.playHeadshot();
        }
        break;
      case 'bomb_explode':
        window.soundEngine.playBombExplosion();
        break;
      case 'round_win':
        window.soundEngine.playRoundWin(evt.winner);
        hud.showRoundEndBanner(evt.winner, evt.reason, evt.mvpName);
        hud.addChatMessage('MAÇ', `${evt.winner.toUpperCase()} RAUNDU KAZANDI: ${evt.reason}`, evt.winner);
        break;
      case 'round_freeze':
      case 'round_start':
        hud.clearKillfeed();
        hud.addChatMessage('MAÇ', `Raund başladı!`, 'system');
        break;
      case 'radio_message':
      case 'radio_call':
        window.soundEngine.playRadioSquelch();
        hud.addChatMessage(evt.sender, evt.text, evt.team);
        break;
      case 'clutch':
        hud.addChatMessage('CLUTCH', `⭐ ${evt.player} (${evt.team.toUpperCase()}) 1v${evt.count} durumunda!`, evt.team);
        break;
      case 'halftime':
        hud.addChatMessage('HAKEM', 'DEVRE ARASI! Takımlar taraf değiştirdi.', 'system');
        break;
      case 'match_over':
        hud.showMatchOverModal(evt.winner, currentGameState);
        window.soundEngine.playRoundWin(evt.winner === 'Counter-Terrorists' ? 'ct' : 't');
        hud.addChatMessage('HAKEM', `🏆 MAÇ TAMAMLANDI! ŞAMPİYON: ${evt.winner}`, 'system');
        break;
      case 'timeout_end':
        hud.addChatMessage('HAKEM', `Taktiksel mola sona erdi!`, 'system');
        break;
    }
  }

  // 2. RADAR RENDER LOOP (60 FPS when in live simulation)
  function renderLoop() {
    if (window.dashboardUI && window.dashboardUI.activeScreen === 'simulation') {
      radar.render(currentGameState, null);
    }
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  // 3. MATCH START CONTROLS
  const startMatch = () => {
    initAudio();
    socket.emit('start_match');
  };
  document.getElementById('btnStartMatch').addEventListener('click', startMatch);
  document.getElementById('btnOverlayStart').addEventListener('click', startMatch);

  document.getElementById('btnPauseMatch').addEventListener('click', () => {
    initAudio();
    socket.emit('toggle_pause');
  });

  document.getElementById('btnResetMatch').addEventListener('click', () => {
    initAudio();
    socket.emit('restart_match');
  });

  // 4. MULTIPLAYER ONLINE: CLAIM CT OR T TEAM
  const btnClaimCT = document.getElementById('btnClaimCT');
  const btnClaimT = document.getElementById('btnClaimT');
  const myClaimedSideTag = document.getElementById('myClaimedSideTag');
  const activeCoachRole = document.getElementById('activeCoachRole');

  if (btnClaimCT) {
    btnClaimCT.addEventListener('click', () => {
      initAudio();
      const defaultName = window.rosterManager?.userClub?.name || "🐺 Anadolu Wolves";
      coachName = prompt("CT Takımını Yöneten İsim / Kulüp Adı:", defaultName) || "CT Sahibi";
      localTeam = 'ct';
      socket.emit('join_coach', { team: 'ct', coachName });
      if (myClaimedSideTag) myClaimedSideTag.innerText = `🛡️ CT (${coachName})`;
      if (activeCoachRole) activeCoachRole.innerText = `🛡️ CT Sahibi & Koçu (${coachName})`;
      btnClaimCT.classList.add('active');
      if (btnClaimT) btnClaimT.classList.remove('active');
    });
  }

  if (btnClaimT) {
    btnClaimT.addEventListener('click', () => {
      initAudio();
      const defaultName = "💣 Rakip Espor Kulübü";
      coachName = prompt("T Takımını Yöneten İsim / Kulüp Adı:", defaultName) || "T Sahibi";
      localTeam = 't';
      socket.emit('join_coach', { team: 't', coachName });
      if (myClaimedSideTag) myClaimedSideTag.innerText = `💣 T (${coachName})`;
      if (activeCoachRole) activeCoachRole.innerText = `💣 T Sahibi & Koçu (${coachName})`;
      btnClaimT.classList.add('active');
      if (btnClaimCT) btnClaimCT.classList.remove('active');
    });
  }

  // ONLINE COACHES & SPECTATORS SYNC
  function updateCoachesUI(coaches) {
    if (!coaches) return;
    const ctNameEl = document.getElementById('ctCoachName');
    const tNameEl = document.getElementById('tCoachName');

    if (ctNameEl && coaches.ct) {
      ctNameEl.innerHTML = coaches.ct.isHuman
        ? `<strong style="color:#00d2ff;">${coaches.ct.name}</strong> <small style="color:#2ecc71;">(🟢 Çevrimiçi)</small>`
        : `${coaches.ct.name} <small style="color:#8b9bb4;">(AI)</small>`;
    }
    if (tNameEl && coaches.t) {
      tNameEl.innerHTML = coaches.t.isHuman
        ? `<strong style="color:#e74c3c;">${coaches.t.name}</strong> <small style="color:#2ecc71;">(🟢 Çevrimiçi)</small>`
        : `${coaches.t.name} <small style="color:#8b9bb4;">(AI)</small>`;
    }
  }

  socket.on('init_data', (data) => {
    if (data.coaches) updateCoachesUI(data.coaches);
    if (data.onlineCount) {
      const el = document.getElementById('onlineUsersCountDisplay');
      if (el) el.innerText = data.onlineCount;
    }
  });

  socket.on('coaches_updated', (coaches) => {
    updateCoachesUI(coaches);
  });

  socket.on('online_count', (count) => {
    const el = document.getElementById('onlineUsersCountDisplay');
    if (el) el.innerText = count;
  });

  // 5. THE ONLY IN-GAME INTERVENTION: TACTICAL TIMEOUT (MOLA AL)
  const btnTimeout = document.getElementById('btnCallTimeout');
  if (btnTimeout) {
    btnTimeout.addEventListener('click', () => {
      initAudio();
      let userTeam = localTeam;
      if (currentGameState && currentGameState.matchInfo) {
        const isSwapped = currentGameState.round >= 13;
        userTeam = isSwapped 
          ? (currentGameState.matchInfo.userSide === 'ct' ? 't' : 'ct')
          : currentGameState.matchInfo.userSide;
      }
      socket.emit('call_timeout', { team: userTeam || 'ct' });
    });
  }

  // 6. SCOREBOARD MODAL (TAB)
  const scoreboardModal = document.getElementById('scoreboardModal');
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Tab') {
      e.preventDefault();
      scoreboardModal.style.display = scoreboardModal.style.display === 'none' ? 'flex' : 'none';
    }
  });

  document.getElementById('btnToggleScoreboard').addEventListener('click', () => {
    scoreboardModal.style.display = scoreboardModal.style.display === 'none' ? 'flex' : 'none';
  });
  document.getElementById('btnCloseScoreboard').addEventListener('click', () => {
    scoreboardModal.style.display = 'none';
  });

  // 7. SOUND TOGGLE
  const btnSound = document.getElementById('btnSoundToggle');
  btnSound.addEventListener('click', () => {
    window.soundEngine.enabled = !window.soundEngine.enabled;
    window.soundEngine.speechEnabled = window.soundEngine.enabled;
    btnSound.innerText = window.soundEngine.enabled ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
  });

  // 9. CHAT MESSAGE SENDING
  const chatInput = document.getElementById('chatInput');
  const btnSendChat = document.getElementById('btnSendChat');
  const sendChat = () => {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (text) {
      const sender = localTeam ? `${coachName} (${localTeam.toUpperCase()} Koçu)` : 'İzleyici';
      socket.emit('send_chat', { text, sender });
      chatInput.value = '';
    }
  };
  if (btnSendChat) btnSendChat.addEventListener('click', sendChat);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }

  // 10. RESTART FROM MATCH OVER MODAL
  const btnRestartFromOver = document.getElementById('btnRestartFromOver');
  if (btnRestartFromOver) {
    btnRestartFromOver.addEventListener('click', () => {
      const mo = document.getElementById('matchOverModal');
      if (mo) mo.style.display = 'none';
      socket.emit('restart_match');
    });
  }

  socket.on('chat_message', ({ sender, text, team }) => {
    hud.addChatMessage(sender, text, team);
  });
});
