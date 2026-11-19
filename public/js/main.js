// CS:GO Team Manager & Coach Simulator - Client Controller
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const canvas = document.getElementById('radarCanvas');
  const radar = new RadarRenderer(canvas);
  const hud = new HUDManager();

  // Local Coach State
  let localTeam = null; // 'ct', 't', or null (spec)
  let coachName = 'Menajer';
  let serverStrats = null;
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

  // 1. RECEIVE INITIAL DATA
  socket.on('init_data', (data) => {
    serverStrats = data.strats;
    hud.renderStrategies(serverStrats, localTeam, null);
  });

  // 2. RECEIVE AUTHORITATIVE GAME UPDATE
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
        hud.addChatMessage('MAÇ', `Raund başladı! Koç talimatları devrede.`, 'system');
        break;
      case 'timeout_end':
        hud.addChatMessage('HAKEM', `Taktiksel mola sona erdi! Maç devam ediyor.`, 'system');
        break;
    }
  }

  // 3. CONTINUOUS RADAR RENDERING (60 FPS)
  function renderLoop() {
    radar.render(currentGameState, null);
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  // 4. BECOME COACH
  document.getElementById('btnCoachCT').addEventListener('click', () => {
    initAudio();
    localTeam = 'ct';
    coachName = prompt("CT Takımı Baş Koçu İsminiz:", "B1ad3") || "B1ad3";
    socket.emit('join_coach', { team: 'ct', coachName });
    document.getElementById('activeCoachRole').innerText = `CT Baş Koçu (${coachName})`;
    hud.renderStrategies(serverStrats, 'ct', currentGameState ? currentGameState.coachDirectives.ct.strategy : 'standard_212');
  });

  document.getElementById('btnCoachT').addEventListener('click', () => {
    initAudio();
    localTeam = 't';
    coachName = prompt("T Takımı Baş Koçu İsminiz:", "zonic") || "zonic";
    socket.emit('join_coach', { team: 't', coachName });
    document.getElementById('activeCoachRole').innerText = `T Baş Koçu (${coachName})`;
    hud.renderStrategies(serverStrats, 't', currentGameState ? currentGameState.coachDirectives.t.strategy : 'rush_b');
  });

  document.getElementById('btnCoachSpec').addEventListener('click', () => {
    initAudio();
    localTeam = null;
    document.getElementById('activeCoachRole').innerText = 'Gözlemci / Analist';
    hud.renderStrategies(serverStrats, null, null);
  });

  // 5. COACH DIRECTIVES: PACING (Aggressive / Passive / High Risk / Default)
  document.querySelectorAll('.directive-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      if (!localTeam) {
        alert("Lütfen önce bir takımın koçu olun (CT veya T)!");
        return;
      }
      document.querySelectorAll('.directive-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pacing = btn.dataset.pacing;
      socket.emit('set_coach_pacing', { team: localTeam, pacing });
    });
  });

  // 6. COACH DIRECTIVES: ECONOMY (Auto / Full Buy / Force Buy / Eco)
  document.querySelectorAll('.eco-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      if (!localTeam) {
        alert("Lütfen önce bir takımın koçu olun (CT veya T)!");
        return;
      }
      document.querySelectorAll('.eco-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const economyCall = btn.dataset.eco;
      socket.emit('set_coach_economy', { team: localTeam, economyCall });
    });
  });

  // 7. COACH DIRECTIVES: STRATEGY
  window.onStrategySelect = (team, stratKey) => {
    socket.emit('set_coach_strategy', { team, strategy: stratKey });
  };

  // 8. TACTICAL TIMEOUT (Mola Al)
  document.getElementById('btnCallTimeout').addEventListener('click', () => {
    initAudio();
    if (!localTeam) {
      alert("Lütfen önce bir takımın koçu olun (CT veya T)!");
      return;
    }
    socket.emit('call_timeout', { team: localTeam });
  });

  // 9. COACH CHEER & MOTIVATION
  document.getElementById('btnMotivate').addEventListener('click', () => {
    initAudio();
    if (!localTeam) return;
    socket.emit('coach_cheer', { team: localTeam, speechType: 'motivate' });
  });

  document.getElementById('btnCalm').addEventListener('click', () => {
    initAudio();
    if (!localTeam) return;
    socket.emit('coach_cheer', { team: localTeam, speechType: 'calm' });
  });

  // 10. SCOREBOARD TOGGLE
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

  // 11. SPEED CONTROLS
  document.querySelectorAll('.btn-speed').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.dataset.speed);
      socket.emit('set_speed', { speed });
    });
  });

  // 12. SOUND TOGGLE
  const btnSound = document.getElementById('btnSoundToggle');
  btnSound.addEventListener('click', () => {
    window.soundEngine.enabled = !window.soundEngine.enabled;
    btnSound.innerText = window.soundEngine.enabled ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
  });

  // 13. CHAT FORM
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
      socket.emit('send_chat', { text, sender: `${coachName} (${localTeam ? localTeam.toUpperCase() : 'Gözlemci'})` });
      chatInput.value = '';
    }
  });

  socket.on('chat_message', ({ sender, text, team }) => {
    hud.addChatMessage(sender, text, team);
  });
});
