// Main Game Client Controller for SimulatorX
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Elements
  const canvas = document.getElementById('radarCanvas');
  const radar = new RadarRenderer(canvas);
  const hud = new HUDManager();

  // Local State
  let localPlayerId = null;
  let localTeam = null; // 'ct', 't', or null (spec)
  let localSlot = 0;
  let playerName = `Player_${Math.floor(Math.random() * 899 + 100)}`;
  let serverStrats = null;
  let currentGameState = null;
  let audioInitialized = false;

  // Sound initialization on first user interaction
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

    // Process Events (Audio & Visual Triggers)
    if (state.events && state.events.length > 0) {
      state.events.forEach(evt => {
        handleGameEvent(evt);
      });
    }

    // Update Killfeed
    if (state.killfeed) {
      hud.updateKillfeed(state.killfeed);
    }

    // Update HUD
    hud.updateHUD(state, localPlayerId, localTeam);

    // If strategy updated on server
    if (localTeam && state.strats && state.strats[localTeam]) {
      // Re-highlight if needed
    }
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
    }
  }

  // 3. CONTINUOUS RADAR ANIMATION LOOP (60 FPS)
  function renderLoop() {
    radar.render(currentGameState, localPlayerId);
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  // 4. TEAM SELECTION
  const slotPickerWrap = document.getElementById('slotPickerWrap');

  document.getElementById('btnJoinCT').addEventListener('click', () => {
    initAudio();
    localTeam = 'ct';
    slotPickerWrap.style.display = 'block';
    selectSlot(0);
    hud.renderStrategies(serverStrats, 'ct', currentGameState ? currentGameState.strats.ct : 'standard_212');
  });

  document.getElementById('btnJoinT').addEventListener('click', () => {
    initAudio();
    localTeam = 't';
    slotPickerWrap.style.display = 'block';
    selectSlot(0);
    hud.renderStrategies(serverStrats, 't', currentGameState ? currentGameState.strats.t : 'rush_b');
  });

  document.getElementById('btnJoinSpec').addEventListener('click', () => {
    initAudio();
    localTeam = null;
    localPlayerId = null;
    slotPickerWrap.style.display = 'none';
    hud.renderStrategies(serverStrats, null, null);
    hud.addChatMessage('SİSTEM', 'İzleyici moduna geçildi.');
  });

  function selectSlot(slot) {
    localSlot = slot;
    if (localTeam) {
      localPlayerId = `${localTeam}_${slot}`;
      socket.emit('join_team', {
        team: localTeam,
        slot: localSlot,
        name: playerName
      });
      hud.addChatMessage('SİSTEM', `${localTeam.toUpperCase()} Takımı Slot ${slot + 1} olarak katıldınız!`, localTeam);
    }
  }

  window.onSlotSelected = (slot) => {
    selectSlot(slot);
  };

  // 5. STRATEGY CALLER
  window.onStrategySelect = (team, stratKey) => {
    socket.emit('set_strategy', { team, strategy: stratKey });
    hud.addChatMessage('TAKTİK', `${team.toUpperCase()} Takım Lideri stratejiyi değiştirdi: ${stratKey}`, team);
  };

  // 6. INTERACTIVE RADAR CLICK (Direct Player Movement / Waypoints)
  canvas.addEventListener('click', (e) => {
    initAudio();
    if (!localPlayerId || !currentGameState) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Send direct movement order
    socket.emit('order_move', { targetX: clickX, targetY: clickY });

    // Client-side ripple / waypoint marker
    radar.particles.push({
      x: clickX,
      y: clickY,
      text: '📍 MOVE',
      color: '#00ffcc',
      alpha: 1.0,
      dy: -1.0
    });
  });

  // 7. BUY MENU
  document.querySelectorAll('.buy-item').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      const weapon = btn.dataset.weapon;
      if (localPlayerId) {
        socket.emit('buy_weapon', { weaponKey: weapon });
      }
    });
  });

  socket.on('buy_success', ({ weaponKey, money }) => {
    hud.addChatMessage('SATIN ALMA', `${weaponKey.toUpperCase()} satın alındı. Kalan: $${money}`);
  });

  // 8. UTILITY BUTTONS
  document.getElementById('btnThrowFlash').addEventListener('click', () => {
    if (!localPlayerId || !currentGameState) return;
    const p = currentGameState.players[localPlayerId];
    if (p && p.alive) {
      socket.emit('throw_utility', {
        type: 'flash',
        targetX: p.x + Math.cos(p.angle) * 120,
        targetY: p.y + Math.sin(p.angle) * 120
      });
    }
  });

  document.getElementById('btnThrowSmoke').addEventListener('click', () => {
    if (!localPlayerId || !currentGameState) return;
    const p = currentGameState.players[localPlayerId];
    if (p && p.alive) {
      socket.emit('throw_utility', {
        type: 'smoke',
        targetX: p.x + Math.cos(p.angle) * 100,
        targetY: p.y + Math.sin(p.angle) * 100
      });
    }
  });

  // 9. HOTKEYS (TAB = Scoreboard, 1/2/3/4/5)
  const scoreboardModal = document.getElementById('scoreboardModal');

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'Tab') {
      e.preventDefault();
      scoreboardModal.style.display = scoreboardModal.style.display === 'none' ? 'flex' : 'none';
    } else if (e.key === 'f' || e.key === 'F') {
      document.getElementById('btnThrowFlash').click();
    } else if (e.key === 's' || e.key === 'S') {
      document.getElementById('btnThrowSmoke').click();
    }
  });

  document.getElementById('btnToggleScoreboard').addEventListener('click', () => {
    scoreboardModal.style.display = scoreboardModal.style.display === 'none' ? 'flex' : 'none';
  });

  document.getElementById('btnCloseScoreboard').addEventListener('click', () => {
    scoreboardModal.style.display = 'none';
  });

  // 10. SPEED CONTROLS
  document.querySelectorAll('.btn-speed').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.dataset.speed);
      socket.emit('set_speed', { speed });
    });
  });

  // 11. SOUND TOGGLE
  const btnSound = document.getElementById('btnSoundToggle');
  btnSound.addEventListener('click', () => {
    window.soundEngine.enabled = !window.soundEngine.enabled;
    btnSound.innerText = window.soundEngine.enabled ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
  });

  // 12. CHAT FORM
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
      socket.emit('send_chat', { text, sender: playerName });
      chatInput.value = '';
    }
  });

  socket.on('chat_message', ({ sender, text }) => {
    hud.addChatMessage(sender, text);
  });
});
