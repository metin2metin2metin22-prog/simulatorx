// HUD and Coach Management UI for CS:GO Pure Coach Simulator
const STRAT_NAMES = {
  rush_b: "Rush B Don't Stop",
  a_short_rush: "Toplu Short / Catwalk Baskını",
  long_a_execute: "Long A Execute",
  a_split: "A Split (Short & Long)",
  mid_to_b: "Mid to B Split",
  default_pick: "Default (Harita Kontrolü)",
  standard_212: "Standart 2-1-2",
  aggressive_long: "Agresif Long Baskısı",
  b_stack: "B Stack Savunması",
  cat_control: "Catwalk / Mid Kontrolü",
  retake_defense: "Pasif Retake Düzeni"
};

class HUDManager {
  constructor() {
    this.ctCoachName = document.getElementById('ctCoachName');
    this.tCoachName = document.getElementById('tCoachName');
    this.ctAvatars = document.getElementById('ctAvatars');
    this.tAvatars = document.getElementById('tAvatars');
    this.scoreCT = document.getElementById('scoreCT');
    this.scoreT = document.getElementById('scoreT');
    this.roundLabel = document.getElementById('roundLabel');
    this.roundTimer = document.getElementById('roundTimer');
    this.phaseTag = document.getElementById('phaseTag');

    this.killfeedContainer = document.getElementById('killfeedContainer');
    this.bombAlertBanner = document.getElementById('bombAlertBanner');
    this.bombSiteText = document.getElementById('bombSiteText');
    this.bombCountdown = document.getElementById('bombCountdown');

    this.timeoutBanner = document.getElementById('timeoutBanner');
    this.timeoutSeconds = document.getElementById('timeoutSeconds');
    this.timeoutsLeftDisplay = document.getElementById('timeoutsLeftDisplay');

    this.lobbyStartOverlay = document.getElementById('lobbyStartOverlay');
    this.activeCoachRole = document.getElementById('activeCoachRole');
    this.ctStratDisplay = document.getElementById('ctStratDisplay');
    this.tStratDisplay = document.getElementById('tStratDisplay');
    this.rosterList = document.getElementById('rosterList');

    this.btnTabCT = document.getElementById('btnTabCT');
    this.btnTabT = document.getElementById('btnTabT');
    this.btnOpenCardsModal = document.getElementById('btnOpenCardsModal');
    this.btnTogglePlayerCards = document.getElementById('btnTogglePlayerCards');
    this.playerCardsModal = document.getElementById('playerCardsModal');
    this.btnCloseCardsModal = document.getElementById('btnCloseCardsModal');
    this.ctCardsDeck = document.getElementById('ctCardsDeck');
    this.tCardsDeck = document.getElementById('tCardsDeck');

    this.scoreboardModal = document.getElementById('scoreboardModal');
    this.ctTableBody = document.getElementById('ctTableBody');
    this.tTableBody = document.getElementById('tTableBody');
    this.sbScoreCT = document.getElementById('sbScoreCT');
    this.sbScoreT = document.getElementById('sbScoreT');
    this.sbCTCoach = document.getElementById('sbCTCoach');
    this.sbTCoach = document.getElementById('sbTCoach');

    this.roundEndOverlay = document.getElementById('roundEndOverlay');
    this.roundWinnerTag = document.getElementById('roundWinnerTag');
    this.roundReasonText = document.getElementById('roundReasonText');
    this.roundMvpName = document.getElementById('roundMvpName');

    this.chatMessages = document.getElementById('chatMessages');

    this.selectedRosterTeam = 'ct';
    this.cachedPlayers = null;

    this.initEventListeners();
  }

  initEventListeners() {
    if (this.btnTabCT) {
      this.btnTabCT.addEventListener('click', () => {
        this.selectedRosterTeam = 'ct';
        this.btnTabCT.classList.add('active');
        if (this.btnTabT) this.btnTabT.classList.remove('active');
        if (this.cachedPlayers) this.renderRoster(this.cachedPlayers);
      });
    }

    if (this.btnTabT) {
      this.btnTabT.addEventListener('click', () => {
        this.selectedRosterTeam = 't';
        this.btnTabT.classList.add('active');
        if (this.btnTabCT) this.btnTabCT.classList.remove('active');
        if (this.cachedPlayers) this.renderRoster(this.cachedPlayers);
      });
    }

    const openCards = () => {
      if (this.playerCardsModal) {
        this.playerCardsModal.style.display = 'flex';
        if (this.cachedPlayers) this.renderCardsModal(this.cachedPlayers);
      }
    };

    if (this.btnOpenCardsModal) this.btnOpenCardsModal.addEventListener('click', openCards);
    if (this.btnTogglePlayerCards) this.btnTogglePlayerCards.addEventListener('click', openCards);

    if (this.btnCloseCardsModal) {
      this.btnCloseCardsModal.addEventListener('click', () => {
        if (this.playerCardsModal) this.playerCardsModal.style.display = 'none';
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.playerCardsModal) this.playerCardsModal.style.display = 'none';
      }
    });
  }

  updateHUD(state, localTeam) {
    if (!state) return;
    this.cachedPlayers = state.players;

    // 1. Lobby Overlay & Round Info
    if (state.phase === 'lobby') {
      this.lobbyStartOverlay.style.display = 'flex';
      this.roundLabel.innerText = 'LOBİ (BEKLEMEDE)';
    } else {
      this.lobbyStartOverlay.style.display = 'none';
      this.roundLabel.innerText = `RAUND ${state.round} / 24`;
    }

    this.scoreCT.innerText = state.score.ct;
    this.scoreT.innerText = state.score.t;
    this.sbScoreCT.innerText = state.score.ct;
    this.sbScoreT.innerText = state.score.t;

    // 2. Coach Names & Timeouts Left
    if (state.coaches) {
      this.ctCoachName.innerText = state.coaches.ct.name;
      this.tCoachName.innerText = state.coaches.t.name;
      this.sbCTCoach.innerText = state.coaches.ct.name;
      this.sbTCoach.innerText = state.coaches.t.name;

      if (localTeam && state.coaches[localTeam]) {
        this.timeoutsLeftDisplay.innerText = state.coaches[localTeam].timeoutsLeft;
      }
    }

    // 3. Autonomous Team Strategies Display
    if (state.activeStrategies) {
      this.ctStratDisplay.innerText = STRAT_NAMES[state.activeStrategies.ct] || state.activeStrategies.ct;
      this.tStratDisplay.innerText = STRAT_NAMES[state.activeStrategies.t] || state.activeStrategies.t;
    }

    // 4. Round Timers & Phase Tag
    const totalSecs = Math.max(0, Math.ceil(state.timer));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    this.roundTimer.innerText = state.phase === 'lobby' ? '00:00' : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    let phaseName = 'CANLI';
    if (state.phase === 'lobby') phaseName = 'LOBİ';
    else if (state.phase === 'freeze') phaseName = 'HAZIRLIK (FREEZE)';
    else if (state.phase === 'timeout') phaseName = 'MOLA';
    else if (state.phase === 'round_end') phaseName = 'RAUND SONU';

    if (state.isPaused) phaseName = 'DURAKLATILDI';

    this.phaseTag.innerText = phaseName;
    this.phaseTag.className = `phase-tag ${state.phase}`;

    // 5. Timeout Banner
    if (state.timeoutState && state.timeoutState.active) {
      this.timeoutBanner.style.display = 'flex';
      this.timeoutSeconds.innerText = Math.ceil(state.timeoutState.timer);
    } else {
      this.timeoutBanner.style.display = 'none';
    }

    // 6. Bomb Alert Banner
    if (state.bomb && state.bomb.planted) {
      this.bombAlertBanner.style.display = 'flex';
      this.bombSiteText.innerText = `BÖLGE ${state.bomb.site}`;
      this.bombCountdown.innerText = Math.ceil(state.bomb.timer);
      this.roundTimer.classList.add('bomb-ticking');
      this.roundTimer.innerText = `${Math.ceil(state.bomb.timer)}s`;
    } else {
      this.bombAlertBanner.style.display = 'none';
      this.roundTimer.classList.remove('bomb-ticking');
    }

    // 7. Top Avatars
    this.renderAvatars(state.players);

    // 8. Roster Mini Player Cards
    this.renderRoster(state.players, localTeam);

    // 9. Full Scoreboard
    this.renderScoreboardTables(state.players);

    // 10. Update Deck Modal if open
    if (this.playerCardsModal && this.playerCardsModal.style.display === 'flex') {
      this.renderCardsModal(state.players);
    }
  }

  renderAvatars(players) {
    if (!players) return;
    const playerList = Object.values(players);

    const ctList = playerList.filter(p => p.team === 'ct').sort((a, b) => a.slot - b.slot);
    this.ctAvatars.innerHTML = ctList.map(p => `
      <div class="avatar-pill ${p.alive ? '' : 'dead'}" title="${p.name} (${p.role}) - Aim:${p.skills?.aim || 94} Reflex:${p.skills?.reflex || 94}">
        <span class="avatar-num">${p.name.slice(0, 6)}</span>
        <div class="avatar-hp-bar">
          <div class="avatar-hp-fill" style="width: ${Math.max(0, p.hp)}%; background: ${p.hp > 50 ? '#2ecc71' : (p.hp > 25 ? '#f1c40f' : '#e74c3c')}"></div>
        </div>
      </div>
    `).join('');

    const tList = playerList.filter(p => p.team === 't').sort((a, b) => a.slot - b.slot);
    this.tAvatars.innerHTML = tList.map(p => `
      <div class="avatar-pill ${p.alive ? '' : 'dead'} ${p.hasBomb ? 'has-bomb' : ''}" title="${p.name} (${p.role}) - Aim:${p.skills?.aim || 94} Reflex:${p.skills?.reflex || 94}">
        <span class="avatar-num">${p.hasBomb ? '💣 ' : ''}${p.name.slice(0, 6)}</span>
        <div class="avatar-hp-bar">
          <div class="avatar-hp-fill" style="width: ${Math.max(0, p.hp)}%; background: ${p.hp > 50 ? '#2ecc71' : (p.hp > 25 ? '#f1c40f' : '#e74c3c')}"></div>
        </div>
      </div>
    `).join('');
  }

  renderRoster(players) {
    if (!players || !this.rosterList) return;
    const teamToRender = this.selectedRosterTeam || 'ct';
    const roster = Object.values(players).filter(p => p.team === teamToRender).sort((a, b) => a.slot - b.slot);

    this.rosterList.innerHTML = roster.map(p => {
      const skills = p.skills || { aim: 94, reflex: 94, gamesense: 94, clutch: 94 };
      let stateTag = '';
      if (!p.alive) stateTag = '<span class="state-badge dead">☠️ ELENDİ</span>';
      else if (p.state === 'planting') stateTag = '<span class="state-badge planting">💣 KURUYOR</span>';
      else if (p.state === 'defusing') stateTag = '<span class="state-badge defusing">⚡ ÇÖZÜYOR</span>';
      else if (p.state === 'engaging') stateTag = '<span class="state-badge combat">💥 ÇATIŞMA</span>';

      return `
        <div class="player-mini-card ${p.alive ? '' : 'dead'} ${p.team}">
          <div class="pmc-head">
            <div class="pmc-avatar-circ ${p.team}">${p.name.slice(0, 2).toUpperCase()}</div>
            <div class="pmc-info">
              <div class="pmc-name-line">
                <span class="pmc-name">${p.name}</span>
                ${p.hasBomb ? '<span class="badge-item badge-c4">💣 C4</span>' : ''}
                ${p.hasKit ? '<span class="badge-item badge-kit">✂️ KİT</span>' : ''}
                ${stateTag}
              </div>
              <div class="pmc-role">${p.role || p.tag || 'Rifler'}</div>
            </div>
            <div class="pmc-rating-pill" title="HLTV Rating 2.0">★ ${(p.rating || 1.20).toFixed(2)}</div>
          </div>

          <!-- SKILLS 2x2 GRID -->
          <div class="pmc-skills-grid">
            <div class="skill-pill">
              <span class="sp-lbl">🎯 AIM</span>
              <span class="sp-val">${skills.aim}</span>
            </div>
            <div class="skill-pill">
              <span class="sp-lbl">⚡ RFLX</span>
              <span class="sp-val">${skills.reflex}</span>
            </div>
            <div class="skill-pill">
              <span class="sp-lbl">🧠 ZEKA</span>
              <span class="sp-val">${skills.gamesense}</span>
            </div>
            <div class="skill-pill">
              <span class="sp-lbl">🏆 CLUTCH</span>
              <span class="sp-val">${skills.clutch}</span>
            </div>
          </div>

          <!-- LIVE COMBAT & STATS BAR -->
          <div class="pmc-stats-bar">
            <div class="pmc-hp-track">
              <div class="pmc-hp-fill" style="width:${Math.max(0, p.hp)}%; background:${p.hp > 50 ? '#2ecc71' : (p.hp > 25 ? '#f1c40f' : '#e74c3c')}"></div>
            </div>
            <div class="pmc-stats-details">
              <span>HP: <strong>${Math.max(0, p.hp)}</strong></span>
              <span class="pmc-weapon">${(p.weapon || 'USP').toUpperCase()}</span>
              <span class="pmc-money">$${p.money}</span>
              <span class="pmc-kda">${p.kills}K / ${p.deaths}D</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderCardsModal(players) {
    if (!players || !this.ctCardsDeck || !this.tCardsDeck) return;
    const playerList = Object.values(players);

    const renderDeckCard = (p) => {
      const skills = p.skills || { aim: 94, reflex: 94, gamesense: 94, clutch: 94 };
      return `
        <div class="deck-player-card ${p.team}">
          <div class="dpc-header">
            <div class="dpc-avatar ${p.team}">${p.name.slice(0, 2).toUpperCase()}</div>
            <div class="dpc-meta">
              <div class="dpc-name">${p.name}</div>
              <div class="dpc-role">${p.role || p.tag}</div>
            </div>
            <div class="dpc-rating">★ ${(p.rating || 1.20).toFixed(2)}</div>
          </div>

          <div class="dpc-desc">${p.desc || 'Profesyonel CS:GO espor oyuncusu.'}</div>

          <!-- SKILL BARS -->
          <div class="dpc-bars">
            <div class="skill-bar-row">
              <div class="sbr-label"><span>🎯 AIM (İsabet)</span> <strong>${skills.aim}/100</strong></div>
              <div class="sbr-track"><div class="sbr-fill aim" style="width: ${skills.aim}%"></div></div>
            </div>
            <div class="skill-bar-row">
              <div class="sbr-label"><span>⚡ REFLEX (Tepki)</span> <strong>${skills.reflex}/100</strong></div>
              <div class="sbr-track"><div class="sbr-fill reflex" style="width: ${skills.reflex}%"></div></div>
            </div>
            <div class="skill-bar-row">
              <div class="sbr-label"><span>🧠 OYUN ZEKASI</span> <strong>${skills.gamesense}/100</strong></div>
              <div class="sbr-track"><div class="sbr-fill gamesense" style="width: ${skills.gamesense}%"></div></div>
            </div>
            <div class="skill-bar-row">
              <div class="sbr-label"><span>🏆 CLUTCH (1vX)</span> <strong>${skills.clutch}/100</strong></div>
              <div class="sbr-track"><div class="sbr-fill clutch" style="width: ${skills.clutch}%"></div></div>
            </div>
          </div>

          <!-- LIVE STATS FOOTER -->
          <div class="dpc-footer">
            <span>K/D: <strong>${p.kills}/${p.deaths}</strong></span>
            <span>Hasar: <strong>${p.damage || 0}</strong></span>
            <span>Bakiye: <strong style="color:#2ecc71">$${p.money}</strong></span>
            <span>Durum: <strong style="color:${p.alive ? '#2ecc71' : '#e74c3c'}">${p.alive ? 'CANLI' : 'ELENDİ'}</strong></span>
          </div>
        </div>
      `;
    };

    const ctList = playerList.filter(p => p.team === 'ct').sort((a, b) => a.slot - b.slot);
    const tList = playerList.filter(p => p.team === 't').sort((a, b) => a.slot - b.slot);

    this.ctCardsDeck.innerHTML = ctList.map(renderDeckCard).join('');
    this.tCardsDeck.innerHTML = tList.map(renderDeckCard).join('');
  }

  renderScoreboardTables(players) {
    if (!players) return;
    const playerList = Object.values(players);

    const ctList = playerList.filter(p => p.team === 'ct').sort((a, b) => b.kills - a.kills);
    const tList = playerList.filter(p => p.team === 't').sort((a, b) => b.kills - a.kills);

    const renderRow = (p) => `
      <tr style="opacity: ${p.alive ? '1' : '0.5'}">
        <td>${p.slot + 1}</td>
        <td><strong>${p.name}</strong> ${p.hasBomb ? '💣' : ''} ${p.hasKit ? '✂️' : ''}</td>
        <td style="color:#f1c40f">${p.role}</td>
        <td>${(p.weapon || '').toUpperCase()}</td>
        <td style="color:#2ecc71">$${p.money}</td>
        <td>${p.kills}</td>
        <td>${p.deaths}</td>
        <td>${p.damage || 0}</td>
        <td style="color:#f1c40f; font-weight:700;">★ ${(p.rating || 1.20).toFixed(2)}</td>
        <td style="color:#f1c40f">${p.mvps > 0 ? '★ ' + p.mvps : '-'}</td>
      </tr>
    `;

    this.ctTableBody.innerHTML = ctList.map(renderRow).join('');
    this.tTableBody.innerHTML = tList.map(renderRow).join('');
  }

  showRoundEndBanner(winner, reason, mvpName) {
    this.roundWinnerTag.innerText = winner === 'ct' ? 'COUNTER-TERRORISTS WIN' : 'TERRORISTS WIN';
    this.roundWinnerTag.style.color = winner === 'ct' ? '#1e90ff' : '#ff9f1a';
    this.roundReasonText.innerText = reason;
    this.roundMvpName.innerText = mvpName;
    this.roundEndOverlay.style.display = 'block';

    setTimeout(() => {
      this.roundEndOverlay.style.display = 'none';
    }, 4500);
  }

  updateKillfeed(feed) {
    this.killfeedContainer.innerHTML = feed.map(k => `
      <div class="kf-item">
        <span class="kf-killer ${k.teamKiller}">${k.killer}</span>
        <span class="kf-weapon">${k.weapon.toUpperCase()}</span>
        ${k.headshot ? '<span class="kf-hs">🎯</span>' : ''}
        <span class="kf-victim ${k.teamVictim}">${k.victim}</span>
      </div>
    `).join('');
  }

  addChatMessage(sender, text, team = '') {
    const d = new Date();
    const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
      <span class="chat-time">${timeStr}</span>
      <span class="chat-sender ${team}">${sender}:</span>
      <span class="chat-body">${text}</span>
    `;
    this.chatMessages.appendChild(div);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
}

window.HUDManager = HUDManager;
