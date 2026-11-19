// HUD and UI Management for CS:GO Simulator
class HUDManager {
  constructor() {
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

    this.playerHpText = document.getElementById('playerHpText');
    this.playerHpFill = document.getElementById('playerHpFill');
    this.playerArmorText = document.getElementById('playerArmorText');
    this.playerArmorFill = document.getElementById('playerArmorFill');
    this.playerWeaponDisplay = document.getElementById('playerWeaponDisplay');
    this.playerRoleBadge = document.getElementById('playerRoleBadge');
    this.playerNameDisplay = document.getElementById('playerNameDisplay');
    this.playerMoneyDisplay = document.getElementById('playerMoneyDisplay');

    this.stratList = document.getElementById('stratList');
    this.myTeamBadge = document.getElementById('myTeamBadge');
    this.slotPickerWrap = document.getElementById('slotPickerWrap');
    this.slotButtons = document.getElementById('slotButtons');

    this.scoreboardModal = document.getElementById('scoreboardModal');
    this.ctTableBody = document.getElementById('ctTableBody');
    this.tTableBody = document.getElementById('tTableBody');
    this.sbScoreCT = document.getElementById('sbScoreCT');
    this.sbScoreT = document.getElementById('sbScoreT');

    this.roundEndOverlay = document.getElementById('roundEndOverlay');
    this.roundWinnerTag = document.getElementById('roundWinnerTag');
    this.roundReasonText = document.getElementById('roundReasonText');
    this.roundMvpName = document.getElementById('roundMvpName');

    this.chatMessages = document.getElementById('chatMessages');

    this.cachedStrategies = null;
    this.initSlotButtons();
  }

  initSlotButtons() {
    this.slotButtons.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const btn = document.createElement('button');
      btn.className = 'btn-slot';
      btn.dataset.slot = i;
      btn.innerText = `Slot ${i + 1}`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-slot').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.onSlotSelected) {
          window.onSlotSelected(i);
        }
      });
      this.slotButtons.appendChild(btn);
    }
  }

  updateHUD(state, localPlayerId, localTeam) {
    if (!state) return;

    // 1. Scores & Round Info
    this.scoreCT.innerText = state.score.ct;
    this.scoreT.innerText = state.score.t;
    this.sbScoreCT.innerText = state.score.ct;
    this.sbScoreT.innerText = state.score.t;

    this.roundLabel.innerText = `RAUND ${state.round} / 24`;

    // Timer formatting
    const totalSecs = Math.max(0, Math.ceil(state.timer));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    this.roundTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Phase tag
    this.phaseTag.innerText = state.phase.toUpperCase();
    this.phaseTag.className = `phase-tag ${state.phase}`;

    // 2. Bomb Alert Banner
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

    // 3. Top Avatars
    this.renderAvatars(state.players);

    // 4. Local Player Dashboard
    this.renderLocalPlayerDashboard(state.players, localPlayerId, localTeam);

    // 5. Scoreboard Data
    this.renderScoreboardTables(state.players);
  }

  renderAvatars(players) {
    if (!players) return;
    const playerList = Object.values(players);

    // CT Avatars (0 to 4)
    const ctList = playerList.filter(p => p.team === 'ct').sort((a, b) => a.slot - b.slot);
    this.ctAvatars.innerHTML = ctList.map(p => `
      <div class="avatar-pill ${p.alive ? '' : 'dead'}">
        <span class="avatar-num">${p.slot + 1}. ${p.name.slice(0, 7)}</span>
        <div class="avatar-hp-bar">
          <div class="avatar-hp-fill" style="width: ${Math.max(0, p.hp)}%; background: ${p.hp > 50 ? '#2ecc71' : (p.hp > 25 ? '#f1c40f' : '#e74c3c')}"></div>
        </div>
      </div>
    `).join('');

    // T Avatars (0 to 4)
    const tList = playerList.filter(p => p.team === 't').sort((a, b) => a.slot - b.slot);
    this.tAvatars.innerHTML = tList.map(p => `
      <div class="avatar-pill ${p.alive ? '' : 'dead'}">
        <span class="avatar-num">${p.slot + 1}. ${p.name.slice(0, 7)}</span>
        <div class="avatar-hp-bar">
          <div class="avatar-hp-fill" style="width: ${Math.max(0, p.hp)}%; background: ${p.hp > 50 ? '#2ecc71' : (p.hp > 25 ? '#f1c40f' : '#e74c3c')}"></div>
        </div>
      </div>
    `).join('');
  }

  renderLocalPlayerDashboard(players, localPlayerId, localTeam) {
    if (!players || !localPlayerId || !players[localPlayerId]) {
      this.playerRoleBadge.innerText = 'SPECTATOR';
      this.playerRoleBadge.className = 'p-role-badge';
      this.playerNameDisplay.innerText = 'Serbest İzleyici Modu';
      this.playerHpText.innerText = '- / -';
      this.playerHpFill.style.width = '100%';
      this.playerArmorText.innerText = '- / -';
      this.playerArmorFill.style.width = '100%';
      this.playerWeaponDisplay.innerText = 'Kamera Serbest';
      this.playerMoneyDisplay.innerText = '$---';
      return;
    }

    const p = players[localPlayerId];
    this.playerRoleBadge.innerText = p.team.toUpperCase();
    this.playerRoleBadge.className = `p-role-badge ${p.team}`;
    this.playerNameDisplay.innerText = `${p.name} (Slot ${p.slot + 1})`;

    this.playerHpText.innerText = `${Math.max(0, p.hp)} / 100`;
    this.playerHpFill.style.width = `${Math.max(0, p.hp)}%`;

    this.playerArmorText.innerText = `${Math.max(0, p.armor)} / 100`;
    this.playerArmorFill.style.width = `${Math.max(0, p.armor)}%`;

    this.playerWeaponDisplay.innerText = (p.weapon || 'usp').toUpperCase();
    this.playerMoneyDisplay.innerText = `$${p.money}`;
  }

  renderScoreboardTables(players) {
    if (!players) return;
    const playerList = Object.values(players);

    const ctList = playerList.filter(p => p.team === 'ct').sort((a, b) => b.kills - a.kills);
    const tList = playerList.filter(p => p.team === 't').sort((a, b) => b.kills - a.kills);

    const renderRow = (p) => `
      <tr style="opacity: ${p.alive ? '1' : '0.5'}">
        <td>${p.slot + 1}</td>
        <td><strong>${p.name}</strong> ${p.isBot ? '' : '👤'} ${p.hasBomb ? '💣' : ''} ${p.hasKit ? '✂️' : ''}</td>
        <td>${(p.weapon || '').toUpperCase()}</td>
        <td style="color:#2ecc71">$${p.money}</td>
        <td>${p.kills}</td>
        <td>${p.deaths}</td>
        <td>${p.assists}</td>
        <td style="color:#f1c40f">${p.mvps > 0 ? '★ ' + p.mvps : '-'}</td>
        <td style="color:#95a5a6">${p.ping}ms</td>
      </tr>
    `;

    this.ctTableBody.innerHTML = ctList.map(renderRow).join('');
    this.tTableBody.innerHTML = tList.map(renderRow).join('');
  }

  renderStrategies(strategies, team, activeStratKey) {
    this.cachedStrategies = strategies;
    this.stratList.innerHTML = '';

    if (!team || team === 'spec') {
      this.myTeamBadge.innerText = 'SPECTATOR';
      this.myTeamBadge.className = 'badge';
      this.stratList.innerHTML = '<div style="font-size:11px;color:#95a5a6;padding:8px;">Takım stratejisi seçmek için CT veya T takımına katılın.</div>';
      return;
    }

    const teamKey = team.toUpperCase();
    this.myTeamBadge.innerText = teamKey;
    this.myTeamBadge.className = `badge ${team}`;

    const teamStrats = strategies[teamKey];
    if (!teamStrats) return;

    Object.entries(teamStrats).forEach(([key, s]) => {
      const card = document.createElement('div');
      card.className = `strat-card ${key === activeStratKey ? 'active' : ''}`;
      card.innerHTML = `
        <div class="strat-name">${s.name}</div>
        <div class="strat-desc">${s.description}</div>
      `;
      card.addEventListener('click', () => {
        document.querySelectorAll('.strat-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (window.onStrategySelect) {
          window.onStrategySelect(team, key);
        }
      });
      this.stratList.appendChild(card);
    });
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
