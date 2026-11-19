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
      case 'bomb_defused':
        window.soundEngine.playBombDefused();
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
    btnSound.innerText = window.soundEngine.enabled ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
  });

  socket.on('chat_message', ({ sender, text, team }) => {
    hud.addChatMessage(sender, text, team);
  });
});
