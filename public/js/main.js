// CS:GO Pure Coach Simulator - Client Controller
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const canvas = document.getElementById('radarCanvas');
  const radar = new RadarRenderer(canvas);
  const hud = new HUDManager();

  let localTeam = null; // 'ct', 't', or null
  let coachName = 'Koç';
  let currentGameState = null;
  let audioInitialized = false;

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

    if (state.events && state.events.length > 0) {
      state.events.forEach(evt => handleGameEvent(evt));
    }

    if (state.killfeed) {
      hud.updateKillfeed(state.killfeed);
    }

    hud.updateHUD(state, localTeam);
  });

  function handleGameEvent(evt) {
    switch (evt.type) {
      case 'shoot':
        radar.addTracer(evt.fromX, evt.fromY, evt.toX, evt.toY, evt.weapon, evt.isHit, evt.isHeadshot);
        window.soundEngine.playShoot(evt.weapon);
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
      case 'bomb_beep':
        window.soundEngine.playBombBeep(evt.urgency || 1);
        break;
      case 'bomb_planted':
        window.soundEngine.playBombPlanted();
        hud.addChatMessage('SİSTEM', `Bomba ${evt.site} bölgesine kuruldu!`, 't');
        break;
      case 'bomb_spotted':
        window.soundEngine.playBombSpotted(evt.site);
        radar.addPing(evt.x, evt.y, evt.isDropped ? 'BOMBA YERDE!' : `BOMBA ${evt.site}!`, 'danger');
        hud.showTacticalBanner(
          evt.isDropped ? '⚠️ BOMBA YERDE TESPİT EDİLDİ!' : `⚠️ BOMBA ${evt.site} BÖLGESİNDE!`,
          `${evt.spotter}: '${evt.isDropped ? 'Bomba yerde! Burayı tutun!' : 'Taşıyıcı burada, desteğe gelin!'}' -> CT intikali başladı!`,
          evt.site
        );
        break;
      case 'rush_detected':
        window.soundEngine.playBombSpotted(evt.site);
        radar.addPing(evt.site === 'B' ? 215 : 819, evt.site === 'B' ? 123 : 164, `RUSH ${evt.site}!`, 'warning');
        hud.showTacticalBanner(
          `⚡ ${evt.site} BÖLGESİNE RUSH BASKINI!`,
          `${evt.spotter}: 'En az ${evt.count || 2} kişi basıyor, acil yardım!'`,
          evt.site
        );
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
        hud.showTacticalBanner('✂️ BOMBA İMHA EDİLDİ!', `${evt.defuserName || 'CT'} bombayı başarıyla imha etti! CT raundu kazandı!`, 'a');
        break;
      case 'bomb_explode':
        window.soundEngine.playBombExplosion();
        break;
      case 'round_win':
        window.soundEngine.playRoundWin(evt.winner);
        hud.showRoundEndBanner(evt.winner, evt.reason, evt.mvpName);
        hud.addChatMessage('MAÇ', `${evt.winner.toUpperCase()} RAUNDU KAZANDI: ${evt.reason}`, evt.winner);
        break;
      case 'round_start':
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

  // 2. RADAR RENDER LOOP (60 FPS)
  function renderLoop() {
    radar.render(currentGameState, null);
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

  // 4. BECOME COACH
  document.getElementById('btnCoachCT').addEventListener('click', () => {
    initAudio();
    localTeam = 'ct';
    coachName = prompt("CT Takımı Koçu İsminiz:", "B1ad3") || "B1ad3";
    socket.emit('join_coach', { team: 'ct', coachName });
    document.getElementById('activeCoachRole').innerText = `CT Koçu (${coachName})`;
  });

  document.getElementById('btnCoachT').addEventListener('click', () => {
    initAudio();
    localTeam = 't';
    coachName = prompt("T Takımı Koçu İsminiz:", "zonic") || "zonic";
    socket.emit('join_coach', { team: 't', coachName });
    document.getElementById('activeCoachRole').innerText = `T Koçu (${coachName})`;
  });

  document.getElementById('btnCoachSpec').addEventListener('click', () => {
    initAudio();
    localTeam = null;
    document.getElementById('activeCoachRole').innerText = 'İzleyici';
  });

  // 5. THE ONLY IN-GAME INTERVENTION: TACTICAL TIMEOUT (MOLA AL)
  document.getElementById('btnCallTimeout').addEventListener('click', () => {
    initAudio();
    if (!localTeam) {
      alert("Lütfen önce bir takımın koçu olun (CT veya T)!");
      return;
    }
    socket.emit('call_timeout', { team: localTeam });
  });

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

  // 7. SIMULATION SPEED
  document.querySelectorAll('.btn-speed').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.dataset.speed);
      socket.emit('set_speed', { speed });
    });
  });

  // 8. SOUND TOGGLE
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
