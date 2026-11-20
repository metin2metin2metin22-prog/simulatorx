// SimulatorX - Main Dashboard & Authentication Controller
// Manages Auth Screen, Club Dashboard Hub, Multi-Tier Leagues, Squad Cards, and Match Transitions.

class DashboardUI {
  constructor() {
    this.socket = null;
    this.currentUser = null;
    this.token = localStorage.getItem('simulatorx_token') || null;
    this.activeScreen = 'auth'; // 'auth' | 'dashboard' | 'simulation'
    this.activeTab = 'match'; // 'squad' | 'match' | 'leagues' | 'market'
    this.selectedTier = 'amateur';
    this.tierOverviewCache = {};
    this.playerPool = [];
    this.perks = {};
    this.isMatchActive = false;
  }

  init(socket) {
    this.socket = socket;
    this.bindDOM();
    this.bindSocketEvents();

    // Auto-login with saved session token if available
    if (this.token) {
      this.socket.emit('auth_token_login', { token: this.token }, (res) => {
        if (res && res.success) {
          this.onAuthSuccess(res.user, this.token);
        } else {
          localStorage.removeItem('simulatorx_token');
          this.token = null;
          this.showScreen('auth');
        }
      });
    } else {
      this.showScreen('auth');
    }
  }

  showScreen(screenName) {
    this.activeScreen = screenName;
    const viewAuth = document.getElementById('viewAuth');
    const viewDashboard = document.getElementById('viewDashboard');
    const viewSimulation = document.getElementById('viewSimulation');

    if (viewAuth) viewAuth.style.display = (screenName === 'auth') ? 'flex' : 'none';
    if (viewDashboard) viewDashboard.style.display = (screenName === 'dashboard') ? 'block' : 'none';
    if (viewSimulation) viewSimulation.style.display = (screenName === 'simulation') ? 'flex' : 'none';

    if (screenName === 'dashboard') {
      this.renderAllDashboard();
    }
  }

  bindDOM() {
    // 1. Auth Form Switching
    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    const formLogin = document.getElementById('authFormLogin');
    const formRegister = document.getElementById('authFormRegister');

    if (tabLogin && tabRegister && formLogin && formRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
        this.clearAuthError();
      });
      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formLogin.style.display = 'none';
        formRegister.style.display = 'block';
        this.clearAuthError();
      });
    }

    // Icon Selector in Register Form
    const iconGrid = document.getElementById('regIconSelector');
    if (iconGrid) {
      iconGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.reg-icon-item');
        if (item) {
          iconGrid.querySelectorAll('.reg-icon-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          const previewIcon = document.getElementById('regSelectedIconBadge');
          if (previewIcon) previewIcon.innerText = item.getAttribute('data-icon');
        }
      });
    }

    // Auth Submit Buttons
    const btnSubmitLogin = document.getElementById('btnSubmitLogin');
    if (btnSubmitLogin) {
      btnSubmitLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    const btnSubmitRegister = document.getElementById('btnSubmitRegister');
    if (btnSubmitRegister) {
      btnSubmitRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleRegister();
      });
    }

    // Logout Button
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.handleLogout());
    }

    // Dashboard Navigation Tabs
    const dashNav = document.getElementById('dashNavTabs');
    if (dashNav) {
      dashNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.dash-tab-btn');
        if (btn) {
          dashNav.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tabName = btn.getAttribute('data-tab');
          this.switchTab(tabName);
        }
      });
    }

    // Return to Simulation Button (In Header)
    const btnReturnSim = document.getElementById('btnReturnToSimulation');
    if (btnReturnSim) {
      btnReturnSim.addEventListener('click', () => {
        this.showScreen('simulation');
      });
    }

    // Back to Dashboard Button (In Simulation Header)
    const btnBackToDash = document.getElementById('btnBackToDashboard');
    if (btnBackToDash) {
      btnBackToDash.addEventListener('click', () => {
        this.showScreen('dashboard');
      });
    }

    // Return to Dashboard from Victory Modal
    const btnRestartFromOver = document.getElementById('btnRestartFromOver');
    if (btnRestartFromOver) {
      btnRestartFromOver.addEventListener('click', () => {
        const mo = document.getElementById('matchOverModal');
        if (mo) mo.style.display = 'none';
        this.showScreen('dashboard');
        this.switchTab('leagues');
      });
    }
  }

  bindSocketEvents() {
    this.socket.on('init_data', (data) => {
      if (data.playerPool) this.playerPool = [...data.playerPool];
      if (data.perks) this.perks = { ...data.perks };
    });

    this.socket.on('user_updated', (updatedUser) => {
      if (this.currentUser && this.currentUser.username === updatedUser.username) {
        this.currentUser = updatedUser;
        if (this.activeScreen === 'dashboard') {
          this.renderAllDashboard();
        }
      }
    });

    this.socket.on('game_update', (state) => {
      if (state.phase === 'live' || state.phase === 'freeze' || state.phase === 'timeout') {
        this.isMatchActive = true;
        const btnReturn = document.getElementById('btnReturnToSimulation');
        if (btnReturn) btnReturn.style.display = 'inline-flex';
      } else if (state.phase === 'lobby' || state.phase === 'match_over') {
        this.isMatchActive = false;
        const btnReturn = document.getElementById('btnReturnToSimulation');
        if (btnReturn && state.phase === 'lobby') btnReturn.style.display = 'none';
      }
    });
  }

  handleLogin() {
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
      this.showAuthError('Lütfen kullanıcı adı ve şifrenizi giriniz.');
      return;
    }

    this.socket.emit('auth_login', { username, password }, (res) => {
      if (res && res.success) {
        this.onAuthSuccess(res.user, res.token);
      } else {
        this.showAuthError(res?.error || 'Giriş başarısız!');
      }
    });
  }

  handleRegister() {
    const usernameInput = document.getElementById('regUsername');
    const passwordInput = document.getElementById('regPassword');
    const clubNameInput = document.getElementById('regClubName');
    const selectedIconEl = document.querySelector('.reg-icon-item.selected');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const clubName = clubNameInput ? clubNameInput.value.trim() : '';
    const clubIcon = selectedIconEl ? selectedIconEl.getAttribute('data-icon') : '🐺';

    if (!username || !password || !clubName) {
      this.showAuthError('Lütfen tüm alanları eksiksiz doldurunuz.');
      return;
    }

    this.socket.emit('auth_register', {
      username,
      password,
      clubName,
      clubIcon
    }, (res) => {
      if (res && res.success) {
        this.onAuthSuccess(res.user, res.token);
      } else {
        this.showAuthError(res?.error || 'Kayıt başarısız!');
      }
    });
  }

  onAuthSuccess(user, token) {
    this.currentUser = user;
    this.token = token;
    localStorage.setItem('simulatorx_token', token);
    this.selectedTier = user.club.tier || 'amateur';
    this.clearAuthError();
    this.showScreen('dashboard');

    // Link into rosterManager
    if (window.rosterManager) {
      window.rosterManager.userClub = JSON.parse(JSON.stringify(user.club));
      window.rosterManager.draftRoster = JSON.parse(JSON.stringify(user.club.roster));
    }
  }

  handleLogout() {
    if (confirm('Kulüp hesabınızdan çıkış yapmak istediğinize emin misiniz?')) {
      localStorage.removeItem('simulatorx_token');
      this.currentUser = null;
      this.token = null;
      this.showScreen('auth');
    }
  }

  showAuthError(msg) {
    const alertBox = document.getElementById('authErrorAlert');
    if (alertBox) {
      alertBox.innerText = msg;
      alertBox.style.display = 'block';
    }
  }

  clearAuthError() {
    const alertBox = document.getElementById('authErrorAlert');
    if (alertBox) {
      alertBox.innerText = '';
      alertBox.style.display = 'none';
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    ['tabContentSquad', 'tabContentMatch', 'tabContentLeagues', 'tabContentMarket'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const activeEl = document.getElementById(`tabContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (activeEl) activeEl.style.display = 'block';

    if (tabName === 'squad') this.renderSquadTab();
    if (tabName === 'match') this.renderMatchCenterTab();
    if (tabName === 'leagues') this.renderLeaguesTab();
    if (tabName === 'market') this.renderMarketTab();
  }

  renderAllDashboard() {
    if (!this.currentUser) return;
    const club = this.currentUser.club;
    const league = this.currentUser.leagueData;

    // Header Profile Elements
    const iconEl = document.getElementById('dashClubIcon');
    const nameEl = document.getElementById('dashClubName');
    const managerEl = document.getElementById('dashManagerTag');
    const budgetEl = document.getElementById('dashBudgetVal');
    const tierBadge = document.getElementById('dashLeagueBadge');
    const statsEl = document.getElementById('dashRecordVal');

    if (iconEl) iconEl.innerText = club.icon;
    if (nameEl) nameEl.innerText = club.name;
    if (managerEl) managerEl.innerText = `@${this.currentUser.username}`;
    if (budgetEl) budgetEl.innerText = `$${(club.budget || 25000).toLocaleString()}`;
    if (tierBadge) tierBadge.innerText = `${league.tierBadge || '🌱'} ${league.tierName || 'Amatör Lig'}`;
    if (statsEl) statsEl.innerText = `${club.stats?.won || 0}G - ${club.stats?.lost || 0}M (${club.stats?.trophies || 0} 🏆)`;

    // Render currently active tab
    this.switchTab(this.activeTab);
  }

  // --- TAB 1: SQUAD & PLAYERS ---
  renderSquadTab() {
    const container = document.getElementById('dashSquadGrid');
    if (!container || !this.currentUser) return;
    const squad = this.currentUser.club.roster || [];

    container.innerHTML = squad.map((p, idx) => {
      const perkInfo = this.perks[p.perk] || { name: p.perk, icon: '⚡', desc: '' };
      const skills = p.skills || { aim: 50, reflex: 50, headshot: 50, gamesense: 50, clutch: 50, utility: 50 };

      return `
        <div class="dash-player-card">
          <div class="dp-top-row">
            <span class="dp-slot-badge">SLOT ${idx + 1} • ${p.role.toUpperCase()}</span>
            <span class="dp-rating">⭐ ${Number(p.rating || 0.95).toFixed(2)}</span>
          </div>

          <div class="dp-main-row">
            <div class="dp-avatar">${p.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <div class="dp-name">${p.name}</div>
              <div class="dp-tier">${p.tier || 'Amatör Çaylak'} • ${p.age || 18} Yaşında</div>
            </div>
          </div>

          <div class="dp-perk-box" title="${perkInfo.desc}">
            ${perkInfo.icon} <strong>${perkInfo.name}</strong>
            <small>${perkInfo.desc}</small>
          </div>

          <div class="dp-skills-grid">
            <div class="dp-skill-bar">
              <span class="s-k">AIM:</span>
              <div class="s-bar"><div class="s-fill aim" style="width:${skills.aim}%"></div></div>
              <span class="s-v">${skills.aim}</span>
            </div>
            <div class="dp-skill-bar">
              <span class="s-k">REFLX:</span>
              <div class="s-bar"><div class="s-fill ref" style="width:${skills.reflex}%"></div></div>
              <span class="s-v">${skills.reflex}</span>
            </div>
            <div class="dp-skill-bar">
              <span class="s-k">HS%:</span>
              <div class="s-bar"><div class="s-fill hs" style="width:${skills.headshot || skills.aim}%"></div></div>
              <span class="s-v">${skills.headshot || skills.aim}</span>
            </div>
            <div class="dp-skill-bar">
              <span class="s-k">SENSE:</span>
              <div class="s-bar"><div class="s-fill gs" style="width:${skills.gamesense}%"></div></div>
              <span class="s-v">${skills.gamesense}</span>
            </div>
            <div class="dp-skill-bar">
              <span class="s-k">CLUTCH:</span>
              <div class="s-bar"><div class="s-fill clu" style="width:${skills.clutch}%"></div></div>
              <span class="s-v">${skills.clutch}</span>
            </div>
            <div class="dp-skill-bar">
              <span class="s-k">UTILITY:</span>
              <div class="s-bar"><div class="s-fill utl" style="width:${skills.utility || 45}%"></div></div>
              <span class="s-v">${skills.utility || 45}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Summary calculation
    const summaryBox = document.getElementById('dashSquadSummary');
    if (summaryBox && squad.length > 0) {
      const avgAim = Math.round(squad.reduce((s, p) => s + (p.skills?.aim || 50), 0) / 5);
      const avgRef = Math.round(squad.reduce((s, p) => s + (p.skills?.reflex || 50), 0) / 5);
      const avgHs = Math.round(squad.reduce((s, p) => s + (p.skills?.headshot || 50), 0) / 5);
      const avgGs = Math.round(squad.reduce((s, p) => s + (p.skills?.gamesense || 50), 0) / 5);
      const avgClu = Math.round(squad.reduce((s, p) => s + (p.skills?.clutch || 50), 0) / 5);
      const avgRating = (squad.reduce((s, p) => s + (p.rating || 0.95), 0) / 5).toFixed(2);

      summaryBox.innerHTML = `
        <div class="dash-sum-chip"><span class="lbl">TAKIM RATING</span><strong class="val gold">⭐ ${avgRating}</strong></div>
        <div class="dash-sum-chip"><span class="lbl">ORT. AIM</span><strong class="val">${avgAim}</strong></div>
        <div class="dash-sum-chip"><span class="lbl">ORT. REAKSİYON</span><strong class="val">${avgRef}</strong></div>
        <div class="dash-sum-chip"><span class="lbl">ORT. 1-TAP / HS</span><strong class="val">${avgHs}</strong></div>
        <div class="dash-sum-chip"><span class="lbl">ORT. OYUN ZEKASI</span><strong class="val">${avgGs}</strong></div>
        <div class="dash-sum-chip"><span class="lbl">ORT. CLUTCH</span><strong class="val">${avgClu}</strong></div>
      `;
    }
  }

  // --- TAB 2: MATCH CENTER ---
  renderMatchCenterTab() {
    const container = document.getElementById('dashMatchHero');
    if (!container || !this.currentUser) return;
    const league = this.currentUser.leagueData;
    const club = this.currentUser.club;

    if (league.isSeasonFinished) {
      const isChamp = league.champion && league.champion.teamId === club.id;
      container.innerHTML = `
        <div class="dash-finished-card">
          <div class="df-trophy">🏆</div>
          <h2>SEZON ${league.season} TAMAMLANDI!</h2>
          <p>Lig Şampiyonu: <strong>${league.champion?.icon} ${league.champion?.name}</strong> (${league.champion?.points} Puan)</p>
          ${isChamp ? '<div class="df-reward-banner">🎉 TEBRİKLER! Şampiyonluk Primi Kasaya Eklendi ve Üst Lige Terfi Ettiniz!</div>' : ''}
          <button class="btn btn-primary btn-new-season" id="btnDashResetSeason">🏆 Yeni Sezona Başla</button>
        </div>
      `;
      document.getElementById('btnDashResetSeason')?.addEventListener('click', () => {
        this.socket.emit('reset_user_season', { username: this.currentUser.username });
      });
      return;
    }

    // Get current scheduled match
    const weekSchedule = league.fixtures.find(w => w.week === league.currentWeek);
    if (!weekSchedule) return;
    const userMatch = weekSchedule.matches.find(m => m.homeTeamId === club.id || m.awayTeamId === club.id);
    if (!userMatch) return;

    const isHome = (userMatch.homeTeamId === club.id);
    const opponentId = isHome ? userMatch.awayTeamId : userMatch.homeTeamId;
    const opponent = league.botTeams.find(t => t.id === opponentId) || {
      name: 'Rakip Takım',
      icon: '🛡️',
      stats: { rating: 1.0 },
      roster: []
    };

    container.innerHTML = `
      <div class="dm-hero-card">
        <div class="dm-top-tag">
          <span>📅 ${weekSchedule.name.toUpperCase()} • ${league.tierName.toUpperCase()}</span>
          <span class="dm-side-badge">${isHome ? 'EV SAHİBİ (CT Başlar)' : 'DEPLASMAN (T Başlar)'}</span>
        </div>

        <div class="dm-clash-grid">
          <!-- BİZİM KULÜP -->
          <div class="dm-team-side user">
            <div class="dm-team-icon">${club.icon}</div>
            <div class="dm-team-name">${club.name}</div>
            <div class="dm-team-sub">Reyting: ${(squad => (squad.reduce((s, p) => s + (p.rating || 0.95), 0) / 5).toFixed(2))(club.roster)} • Menajer: @${this.currentUser.username}</div>
          </div>

          <div class="dm-vs-col">
            <span class="dm-vs-title">VS</span>
            <span class="dm-format-badge">MR12 CANLI MAÇ</span>
          </div>

          <!-- RAKİP KULÜP -->
          <div class="dm-team-side opp">
            <div class="dm-team-icon">${opponent.icon}</div>
            <div class="dm-team-name">${opponent.name}</div>
            <div class="dm-team-sub">Reyting: ${opponent.stats?.rating || opponent.rating || 1.0} • Koç: ${opponent.coachName || 'AI'}</div>
          </div>
        </div>

        <!-- RAKİP KADRO ÖNİZLEMESİ -->
        <div class="dm-opp-roster-preview">
          <span class="label">🎯 Rakip İlk 5 Kadrosu:</span>
          <div class="chips-row">
            ${(opponent.roster || []).map(p => `
              <span class="opp-chip">
                ${p.name} <small>(${p.role})</small>
              </span>
            `).join('')}
          </div>
        </div>

        <!-- MAÇ EYLEM BUTONU (CANLI ARENA) -->
        <div class="dm-action-row">
          <button class="btn btn-hero-start-match" id="btnStartMatchFromDash">
            🔥 CANLI MAÇA ÇIK (RADAR ARENASINA GİR)
          </button>
        </div>
      </div>
    `;

    document.getElementById('btnStartMatchFromDash')?.addEventListener('click', () => {
      this.startLiveMatch();
    });
  }

  startLiveMatch() {
    this.socket.emit('start_league_match', { username: this.currentUser.username }, (res) => {
      if (res && res.success) {
        this.showScreen('simulation');
      } else {
        alert(res?.error || 'Maç başlatılamadı!');
      }
    });
  }

  // --- TAB 3: MULTI-TIER LEAGUES ---
  renderLeaguesTab() {
    const tierSelector = document.getElementById('dashTierSelector');
    if (tierSelector) {
      tierSelector.querySelectorAll('.dash-tier-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tier') === this.selectedTier);
      });
      tierSelector.onclick = (e) => {
        const btn = e.target.closest('.dash-tier-btn');
        if (btn) {
          this.selectedTier = btn.getAttribute('data-tier');
          tierSelector.querySelectorAll('.dash-tier-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.loadAndRenderTier(this.selectedTier);
        }
      };
    }

    this.loadAndRenderTier(this.selectedTier);
  }

  loadAndRenderTier(tierKey) {
    // If viewing the user's active tier, use local live league data!
    if (this.currentUser && this.currentUser.leagueData && this.currentUser.leagueData.tierKey === tierKey) {
      this.renderTierContent(this.currentUser.leagueData);
    } else {
      // Query server for overview
      this.socket.emit('get_tier_overview', { tierKey }, (overview) => {
        if (overview) this.renderTierOverviewContent(overview);
      });
    }
  }

  renderTierContent(leagueData) {
    const container = document.getElementById('dashLeagueContent');
    if (!container) return;

    container.innerHTML = `
      <div class="dash-league-header-card">
        <div>
          <h3>${leagueData.tierBadge || '🌱'} ${leagueData.tierName}</h3>
          <p>Aktif Hafta: <strong>Hafta ${leagueData.currentWeek} / 7</strong> • Format: MR12 5v5 Espor Standartları</p>
        </div>
        <div class="dash-league-reward">
          🏆 Şampiyonluk Primi: <strong>+$${(leagueData.tierKey === 'pro' ? 150000 : (leagueData.tierKey === 'challenger' ? 75000 : 40000)).toLocaleString()}</strong>
        </div>
      </div>

      <!-- STANDINGS TABLE -->
      <div class="dash-table-wrap">
        <table class="dash-standings-table">
          <thead>
            <tr>
              <th>SIRA</th>
              <th>KULÜP</th>
              <th>O</th>
              <th>G</th>
              <th>M</th>
              <th>RAUND</th>
              <th>AV</th>
              <th>PUAN</th>
            </tr>
          </thead>
          <tbody>
            ${(leagueData.standings || []).map((t, idx) => `
              <tr class="${t.isUser ? 'user-club-row' : ''} ${idx === 0 ? 'leader-row' : ''}">
                <td class="col-rank">${idx === 0 ? '👑 1' : idx + 1}</td>
                <td class="col-team">
                  <span class="icon">${t.icon}</span>
                  <span class="name">${t.name}</span>
                  ${t.isUser ? '<span class="pill">BİZİM KULÜP</span>' : ''}
                </td>
                <td>${t.played}</td>
                <td class="text-win">${t.won}</td>
                <td class="text-loss">${t.lost}</td>
                <td>${t.roundsWon}:${t.roundsLost}</td>
                <td class="${t.roundDiff >= 0 ? 'text-win' : 'text-loss'}">
                  ${t.roundDiff > 0 ? '+' : ''}${t.roundDiff}
                </td>
                <td class="col-pts">${t.points}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderTierOverviewContent(overview) {
    const container = document.getElementById('dashLeagueContent');
    if (!container) return;

    container.innerHTML = `
      <div class="dash-league-header-card">
        <div>
          <h3>${overview.badge} ${overview.name}</h3>
          <p>${overview.desc}</p>
        </div>
        <div class="dash-league-reward">
          🏆 Şampiyonluk Primi: <strong>+$${overview.rewardChampion.toLocaleString()}</strong>
        </div>
      </div>

      <div class="dash-tier-teams-preview">
        <h4>🛡️ Ligde Mücadele Eden Takımlar (${overview.teams.length} Takım):</h4>
        <div class="tier-teams-grid">
          ${overview.teams.map(t => `
            <div class="tier-team-chip">
              <span class="t-icon">${t.icon}</span>
              <div class="t-info">
                <strong>${t.name}</strong>
                <small>Reyting: ${t.stats?.rating || t.rating || 1.10} • Koç: ${t.coachName || 'AI'}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- TAB 4: TRANSFER MARKET & SCOUT ---
  renderMarketTab() {
    const container = document.getElementById('dashMarketContainer');
    if (!container || !this.currentUser) return;
    const catalog = this.playerPool || [];

    container.innerHTML = `
      <div class="dash-market-top">
        <div class="market-intro">
          <h3>🛒 OYUNCU TRANSFER PAZARI</h3>
          <p>Kulüp kasasındaki bütçenizi kullanarak takımınıza yıldız transferler yapın veya altyapıdan scout yetenekleri keşfedin.</p>
        </div>
        <div class="market-budget-badge">
          Kasa: <strong>$${(this.currentUser.club.budget || 25000).toLocaleString()}</strong>
        </div>
      </div>

      <div class="dash-market-grid">
        ${catalog.slice(0, 12).map(p => {
          const perkInfo = this.perks[p.perk] || { name: p.perk, icon: '⭐', desc: '' };
          const price = p.price || 15000;
          const canAfford = (this.currentUser.club.budget >= price);

          return `
            <div class="market-card">
              <div class="mc-header">
                <div>
                  <div class="mc-name">${p.name} <span class="mc-tier ${p.tier || 'S'}">${p.tier || 'S'}</span></div>
                  <div class="mc-sub">${p.teamName || 'Serbest'} • ${p.role}</div>
                </div>
                <div class="mc-rating">⭐ ${Number(p.rating || 1.10).toFixed(2)}</div>
              </div>

              <div class="mc-perk">
                ${perkInfo.icon} <strong>${perkInfo.name}</strong>
              </div>

              <div class="mc-skills-row">
                <div><span>AIM:</span><strong>${p.skills?.aim || 75}</strong></div>
                <div><span>REF:</span><strong>${p.skills?.reflex || 75}</strong></div>
                <div><span>HS%:</span><strong>${p.skills?.headshot || 70}%</strong></div>
                <div><span>GS:</span><strong>${p.skills?.gamesense || 75}</strong></div>
              </div>

              <div class="mc-footer">
                <span class="mc-price">$${price.toLocaleString()}</span>
                <button class="btn btn-sm btn-sign-player ${canAfford ? '' : 'disabled'}" ${canAfford ? '' : 'disabled'} data-player-id="${p.id}">
                  ${canAfford ? '✍️ Transfer Et' : 'Yetersiz Bakiye'}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Sign button handler
    container.querySelectorAll('.btn-sign-player').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-player-id');
        const playerObj = catalog.find(p => p.id === pId);
        if (playerObj) {
          const slot = prompt('Hangi slottaki oyuncunun yerine transfer edilsin? (1 - 5 arası slot numarası girin):', '1');
          const slotNum = parseInt(slot, 10);
          if (slotNum >= 1 && slotNum <= 5) {
            const roster = [...this.currentUser.club.roster];
            roster[slotNum - 1] = JSON.parse(JSON.stringify(playerObj));
            this.currentUser.club.budget -= (playerObj.price || 10000);
            this.socket.emit('save_user_roster', {
              username: this.currentUser.username,
              roster
            }, (res) => {
              if (res && res.success) {
                alert(`Tebrikler! ${playerObj.name} başarıyla Slot ${slotNum}'e transfer edildi!`);
                this.renderAllDashboard();
              }
            });
          }
        }
      });
    });
  }
}

window.DashboardUI = DashboardUI;
