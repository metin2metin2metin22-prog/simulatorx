// SimulatorX - Main Dashboard & Authentication Controller
// Manages Auth Screen, Club Dashboard Hub, Multi-Tier Leagues, Squad Cards, Live Matches (Espor TV), Tournaments, and Replay Theater.

class DashboardUI {
  constructor() {
    this.socket = null;
    this.currentUser = null;
    this.token = localStorage.getItem('simulatorx_token') || null;
    this.activeScreen = 'auth'; // 'auth' | 'dashboard' | 'simulation'
    this.activeTab = 'match'; // 'match' | 'live' | 'tournaments' | 'squad' | 'leagues' | 'replays' | 'market'
    this.selectedTier = 'amateur';
    this.tierOverviewCache = {};
    this.playerPool = [];
    this.perks = {};
    this.isMatchActive = false;
    this.userSchedule = null;
    this.cachedLiveMatches = [];
    this.scheduleTimerInterval = null;
  }

  init(socket) {
    this.socket = socket;
    this.bindDOM();
    this.bindSocketEvents();

    // 1-second interval to tick countdown timers smoothly
    this.scheduleTimerInterval = setInterval(() => {
      this.tickClientTimers();
    }, 1000);

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

  tickClientTimers() {
    if (this.activeScreen !== 'dashboard' || !this.currentUser) return;

    // Tick User Scheduled Match Countdown
    if (this.userSchedule && this.userSchedule.countdownSeconds > 0) {
      this.userSchedule.countdownSeconds--;
      const timerDisplay = document.getElementById('dashCountdownVal');
      const startBtn = document.getElementById('btnStartMatchFromDash');
      const m = Math.floor(this.userSchedule.countdownSeconds / 60);
      const s = this.userSchedule.countdownSeconds % 60;
      const str = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      if (timerDisplay) timerDisplay.innerText = str;
      if (startBtn && this.userSchedule.status === 'SCHEDULED') {
        startBtn.innerText = `⏳ Maç Saati Bekleniyor (${str})`;
      }

      // Check if match just became live
      if (this.userSchedule.countdownSeconds <= 0 && this.userSchedule.status === 'SCHEDULED') {
        this.renderMatchCenterTab();
      }
    }

    // Tick Tournaments timers if currently on tournaments tab
    if (this.activeTab === 'tournaments') {
      const tournTimers = document.querySelectorAll('.tourn-timer-val');
      tournTimers.forEach(el => {
        let sec = parseInt(el.getAttribute('data-sec') || '0', 10);
        if (sec > 0) {
          sec--;
          el.setAttribute('data-sec', sec);
          const m = Math.floor(sec / 60);
          const s = sec % 60;
          el.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
      });
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

    // Replay Modal Close Button
    const btnCloseReplayModal = document.getElementById('btnCloseReplayModal');
    if (btnCloseReplayModal) {
      btnCloseReplayModal.addEventListener('click', () => {
        const repModal = document.getElementById('replayDetailModal');
        if (repModal) repModal.style.display = 'none';
      });
    }

    // Replay Modal Sub-Tabs (Box Score vs Timeline)
    const btnRmTabBox = document.getElementById('btnRmTabBox');
    const btnRmTabTimeline = document.getElementById('btnRmTabTimeline');
    if (btnRmTabBox && btnRmTabTimeline) {
      btnRmTabBox.addEventListener('click', () => {
        btnRmTabBox.classList.add('active');
        btnRmTabTimeline.classList.remove('active');
        document.getElementById('rmTabBoxScore').style.display = 'block';
        document.getElementById('rmTabTimeline').style.display = 'none';
      });
      btnRmTabTimeline.addEventListener('click', () => {
        btnRmTabTimeline.classList.add('active');
        btnRmTabBox.classList.remove('active');
        document.getElementById('rmTabBoxScore').style.display = 'none';
        document.getElementById('rmTabTimeline').style.display = 'block';
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

    this.socket.on('live_matches_tick', (matches) => {
      this.cachedLiveMatches = matches;
      if (this.activeScreen === 'dashboard' && this.activeTab === 'live') {
        this.updateLiveMatchesDOM(matches);
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
    [
      'tabContentMatch',
      'tabContentLive',
      'tabContentTournaments',
      'tabContentSquad',
      'tabContentLeagues',
      'tabContentReplays',
      'tabContentMarket'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const activeEl = document.getElementById(`tabContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (activeEl) activeEl.style.display = 'block';

    if (tabName === 'match') this.renderMatchCenterTab();
    if (tabName === 'live') this.renderLiveMatchesTab();
    if (tabName === 'tournaments') this.renderTournamentsTab();
    if (tabName === 'squad') this.renderSquadTab();
    if (tabName === 'leagues') this.renderLeaguesTab();
    if (tabName === 'replays') this.renderReplaysTab();
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

  // ==========================================
  // TAB 1: MATCH CENTER & SCHEDULED TIMETABLE
  // ==========================================
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

    // Query real-time schedule from server
    this.socket.emit('get_user_schedule', { username: this.currentUser.username }, (sched) => {
      if (!sched) return;
      this.userSchedule = sched;

      const userMatch = sched;
      const isHome = sched.isHome;
      const opponent = sched.opponent;

      const m = Math.floor(sched.countdownSeconds / 60);
      const s = sched.countdownSeconds % 60;
      const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      let statusBadgeHtml = '';
      let actionBtnHtml = '';
      let noteHtml = '';

      if (sched.status === 'COMPLETED') {
        const userWon = isHome ? (sched.score.homeScore > sched.score.awayScore) : (sched.score.awayScore > sched.score.homeScore);
        statusBadgeHtml = `<span class="dm-status-badge completed">📼 MAÇ TAMAMLANDI (${sched.score.homeScore} - ${sched.score.awayScore})</span>`;
        actionBtnHtml = `
          <button class="btn btn-hero-start-match btn-replay-open" id="btnOpenHeroReplay" data-replay-id="${sched.replayId}">
            📼 MAÇ TEKRARINI VE HLTV ÖZETİNİ İZLE
          </button>
        `;
        noteHtml = `<p class="dm-schedule-note">✅ Bu haftanın resmi mücadelesi tamamlandı. Lig puan tablosu güncellendi. Yukarıdaki butona tıklayarak maçı raund raund inceleyebilirsiniz.</p>`;
      } else if (sched.status === 'LIVE' || sched.canWatchLive) {
        statusBadgeHtml = `<span class="dm-status-badge live pulse">🔴 ŞU AN CANLI OYNANIYOR</span>`;
        actionBtnHtml = `
          <button class="btn btn-hero-start-match btn-live-pulse" id="btnWatchLiveMatch">
            🔴 MAÇIMI CANLI İZLE (5v5 RADAR ARENASI)
          </button>
        `;
        noteHtml = `<p class="dm-schedule-note text-live">🔥 Kulübünüz sahada! Fikstür saatinde başlayan karşılaşmayı 2D canlı espor radarından izleyin ve taktiksel molalar verin.</p>`;
      } else {
        // SCHEDULED (COUNTDOWN)
        statusBadgeHtml = `<span class="dm-status-badge scheduled">⏳ PLANLANDI • BAŞLAMA SAATİ: ${sched.scheduledTime}</span>`;
        actionBtnHtml = `
          <button class="btn btn-hero-start-match btn-disabled" id="btnStartMatchFromDash" disabled>
            ⏳ Maç Saati Bekleniyor (${timeStr})
          </button>
        `;
        noteHtml = `
          <p class="dm-schedule-note">
            ℹ️ <strong>Resmi Espor Takvimi:</strong> Maçlar "basıp hemen başlat" şeklinde değil, belirlenen fikstür saatinde (${sched.scheduledTime}) otomatik oynanır. Geri sayım bittiğinde canlı yayını buradan anlık izleyebilirsiniz.
          </p>
        `;
      }

      container.innerHTML = `
        <div class="dm-hero-card">
          <div class="dm-top-tag">
            <span>📅 ${sched.weekName.toUpperCase()} • ${league.tierName.toUpperCase()}</span>
            <div class="dm-tag-right">
              ${statusBadgeHtml}
              <span class="dm-side-badge">${isHome ? 'EV SAHİBİ (CT)' : 'DEPLASMAN (T)'}</span>
            </div>
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
              <div class="dm-schedule-clock">
                <span class="clock-label">MAÇ SAATİ</span>
                <span class="clock-time">${sched.scheduledTime}</span>
                <span class="clock-countdown" id="dashCountdownVal">${timeStr}</span>
              </div>
              <span class="dm-format-badge">MR12 RESMİ FİKSTÜR</span>
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

          <!-- MAÇ EYLEM BUTONU (CANLI ARENA / REPLAY) -->
          <div class="dm-action-row">
            ${actionBtnHtml}
            ${noteHtml}
          </div>
        </div>
      `;

      // Bind dynamic actions
      document.getElementById('btnWatchLiveMatch')?.addEventListener('click', () => {
        this.startLiveMatch();
      });

      document.getElementById('btnOpenHeroReplay')?.addEventListener('click', (e) => {
        const repId = e.currentTarget.getAttribute('data-replay-id');
        this.openReplayModal(repId);
      });
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

  // ==========================================
  // TAB 2: LIVE MATCHES (ESPOR TV - CANLI MAÇLAR)
  // ==========================================
  renderLiveMatchesTab() {
    const grid = document.getElementById('dashLiveMatchesGrid');
    if (!grid) return;

    this.socket.emit('get_live_matches', (list) => {
      this.cachedLiveMatches = list || [];
      this.updateLiveMatchesDOM(this.cachedLiveMatches);
    });
  }

  updateLiveMatchesDOM(matches) {
    const grid = document.getElementById('dashLiveMatchesGrid');
    if (!grid) return;

    grid.innerHTML = matches.map(m => `
      <div class="live-match-card">
        <div class="lmc-header">
          <span class="lmc-badge">${m.badge} ${m.tierName}</span>
          <span class="lmc-live-pill">🔴 CANLI • Raund ${m.round}</span>
        </div>

        <div class="lmc-scoreboard">
          <div class="lmc-team home">
            <span class="lmc-icon">${m.homeTeam.icon}</span>
            <span class="lmc-name">${m.homeTeam.name}</span>
          </div>
          <div class="lmc-score">
            <span>${m.score.home}</span>
            <span class="colon">:</span>
            <span>${m.score.away}</span>
          </div>
          <div class="lmc-team away">
            <span class="lmc-name">${m.awayTeam.name}</span>
            <span class="lmc-icon">${m.awayTeam.icon}</span>
          </div>
        </div>

        <div class="lmc-commentary">
          <span class="comm-icon">🎙️</span>
          <span class="comm-text">${m.latestAction}</span>
        </div>

        <div class="lmc-footer">
          <span class="lmc-viewers">👁️ ${m.viewers} Canlı İzleyici</span>
          <button class="btn btn-sm btn-spectate-match" data-match-id="${m.id}">
            🔴 CANLI İZLE
          </button>
        </div>
      </div>
    `).join('');

    // Bind spectate buttons
    grid.querySelectorAll('.btn-spectate-match').forEach(btn => {
      btn.addEventListener('click', () => {
        const matchId = btn.getAttribute('data-match-id');
        this.socket.emit('spectate_live_match', { matchId }, (res) => {
          if (res && res.success) {
            this.showScreen('simulation');
          } else {
            alert(res?.error || 'Canlı yayına bağlanılamadı!');
          }
        });
      });
    });
  }

  // ==========================================
  // TAB 3: TOURNAMENTS & CUPS (KUPALAR)
  // ==========================================
  renderTournamentsTab() {
    const grid = document.getElementById('dashTournamentsGrid');
    if (!grid) return;

    this.socket.emit('get_tournaments', (tournaments) => {
      if (!tournaments || tournaments.length === 0) {
        grid.innerHTML = `<p class="empty-text">Şu an aktif turnuva bulunmuyor.</p>`;
        return;
      }

      grid.innerHTML = tournaments.map(t => {
        let phaseTag = '';
        let timerBlock = '';
        let actionBtn = '';

        const m = Math.floor(t.regTimeRemaining / 60);
        const s = t.regTimeRemaining % 60;
        const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        const isUserRegistered = t.registeredTeams?.some(team => team.id === this.currentUser?.club?.id);

        if (t.phase === 'REGISTRATION_OPEN') {
          phaseTag = `<span class="tourn-phase-badge reg">⏳ KAYITLAR AÇIK</span>`;
          timerBlock = `
            <div class="tourn-timer-row">
              <span>Kayıtların Kapanmasına:</span>
              <strong class="tourn-timer-val" data-sec="${t.regTimeRemaining}">${timeStr}</strong>
            </div>
          `;
          if (isUserRegistered) {
            actionBtn = `<button class="btn btn-tourn-action registered" disabled>✅ Kulübünüz Kayıtlı</button>`;
          } else {
            actionBtn = `<button class="btn btn-tourn-action btn-reg-tourn" data-tourn-id="${t.id}">⭐ KULÜBÜMÜ KAYDET</button>`;
          }
        } else if (t.phase === 'IN_PROGRESS') {
          phaseTag = `<span class="tourn-phase-badge progress">⚔️ ELEMELER SÜRÜYOR</span>`;
          timerBlock = `
            <div class="tourn-timer-row">
              <span>Raund Süresi:</span>
              <strong>${t.stageTimer}s</strong>
            </div>
          `;
          actionBtn = `<button class="btn btn-tourn-action in-prog" disabled>🎯 Maçlar Oynanıyor</button>`;
        } else if (t.phase === 'COMPLETED') {
          phaseTag = `<span class="tourn-phase-badge comp">🏆 ŞAMPİYON İLAN EDİLDİ</span>`;
          timerBlock = `
            <div class="tourn-winner-box">
              <span>Şampiyon:</span>
              <strong>${t.champion?.icon} ${t.champion?.name}</strong>
            </div>
          `;
          actionBtn = `<button class="btn btn-tourn-action comp" disabled>🏆 Tamamlandı</button>`;
        }

        // Bracket rendering
        let bracketHtml = '';
        if (t.bracket && t.bracket.rounds) {
          bracketHtml = `
            <div class="tourn-bracket-preview">
              <span class="bracket-title">🌳 Eleme Eşleşmeleri:</span>
              <div class="bracket-rounds-row">
                ${t.bracket.rounds.map((r, rIdx) => `
                  <div class="bracket-round-col">
                    <span class="round-col-name">${r.name}</span>
                    ${r.matches.map(m => `
                      <div class="bracket-match-chip ${m.completed ? 'done' : ''}">
                        <div class="bm-team ${m.winner?.id === m.homeTeam?.id ? 'winner' : ''}">
                          ${m.homeTeam ? `${m.homeTeam.icon} ${m.homeTeam.name.slice(0, 10)}` : 'Bekleniyor'}
                          ${m.score ? `<strong>${m.score.homeScore}</strong>` : ''}
                        </div>
                        <div class="bm-team ${m.winner?.id === m.awayTeam?.id ? 'winner' : ''}">
                          ${m.awayTeam ? `${m.awayTeam.icon} ${m.awayTeam.name.slice(0, 10)}` : 'Bekleniyor'}
                          ${m.score ? `<strong>${m.score.awayScore}</strong>` : ''}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        return `
          <div class="tourn-card">
            <div class="tc-top">
              <div class="tc-title-box">
                <span class="tc-badge">${t.badge}</span>
                <div>
                  <h3 class="tc-name">${t.name}</h3>
                  <small class="tc-desc">${t.desc}</small>
                </div>
              </div>
              ${phaseTag}
            </div>

            <div class="tc-metrics-row">
              <div class="tc-metric">
                <span class="label">Ödül Havuzu:</span>
                <span class="val text-gold">$${t.reward.toLocaleString()}</span>
              </div>
              <div class="tc-metric">
                <span class="label">Kupa Unvanı:</span>
                <span class="val">🏆 ${t.trophy}</span>
              </div>
              <div class="tc-metric">
                <span class="label">Kayıtlı Takım:</span>
                <span class="val">${t.registeredCount} / ${t.size}</span>
              </div>
            </div>

            ${timerBlock}
            ${bracketHtml}

            <div class="tc-actions">
              ${actionBtn}
            </div>
          </div>
        `;
      }).join('');

      // Bind register buttons
      grid.querySelectorAll('.btn-reg-tourn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tournId = btn.getAttribute('data-tourn-id');
          this.socket.emit('register_tournament', {
            tournamentId: tournId,
            username: this.currentUser.username
          }, (res) => {
            if (res && res.success) {
              alert(res.message);
              this.renderTournamentsTab();
            } else {
              alert(res?.error || 'Kayıt yapılamadı!');
            }
          });
        });
      });
    });
  }

  // ==========================================
  // TAB 4: SQUAD & PLAYERS
  // ==========================================
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
              <span class="s-k">GS:</span>
              <div class="s-bar"><div class="s-fill gs" style="width:${skills.gamesense || 50}%"></div></div>
              <span class="s-v">${skills.gamesense || 50}</span>
            </div>
            <div class="dp-skill-bar">
              <span class="s-k">CLUTCH:</span>
              <div class="s-bar"><div class="s-fill cl" style="width:${skills.clutch || 50}%"></div></div>
              <span class="s-v">${skills.clutch || 50}</span>
            </div>
            <div class="dp-skill-bar">
              <span class="s-k">UTILITY:</span>
              <div class="s-bar"><div class="s-fill ut" style="width:${skills.utility || 50}%"></div></div>
              <span class="s-v">${skills.utility || 50}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // TAB 5: MULTI-TIER LEAGUES (5 TIERS)
  // ==========================================
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
    if (this.currentUser && this.currentUser.leagueData && this.currentUser.leagueData.tierKey === tierKey) {
      this.renderTierContent(this.currentUser.leagueData);
    } else {
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
          🏆 Şampiyonluk Primi: <strong>+$${(leagueData.tierKey === 'global' ? 600000 : (leagueData.tierKey === 'national' ? 250000 : (leagueData.tierKey === 'regional' ? 125000 : (leagueData.tierKey === 'city' ? 75000 : 40000)))).toLocaleString()}</strong>
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

  // ==========================================
  // TAB 6: MATCH REPLAYS (TEKRARLAR)
  // ==========================================
  renderReplaysTab() {
    const container = document.getElementById('dashReplaysList');
    if (!container || !this.currentUser) return;

    this.socket.emit('get_user_replays', { username: this.currentUser.username }, (replays) => {
      if (!replays || replays.length === 0) {
        container.innerHTML = `
          <div class="empty-replays-box">
            <span class="empty-icon">📼</span>
            <h3>Henüz Kaydedilmiş Maç Tekrarı Yok</h3>
            <p>Kulübünüzün fikstür saatinde oynanan maçları otomatik olarak buraya kaydedilir ve kaçırsanız bile dilediğiniz zaman tekrarını izleyebilirsiniz.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = replays.map(r => `
        <div class="replay-card">
          <div class="rc-header">
            <span class="rc-tier">${r.tierName} • ${r.weekName}</span>
            <span class="rc-date">📅 ${r.date}</span>
          </div>

          <div class="rc-scoreboard">
            <div class="rc-team home">
              <span class="rc-icon">${r.homeTeam.icon}</span>
              <span class="rc-name">${r.homeTeam.name}</span>
            </div>
            <div class="rc-score">
              <strong class="${r.score.home > r.score.away ? 'text-win' : ''}">${r.score.home}</strong>
              <span>:</span>
              <strong class="${r.score.away > r.score.home ? 'text-win' : ''}">${r.score.away}</strong>
            </div>
            <div class="rc-team away">
              <span class="rc-name">${r.awayTeam.name}</span>
              <span class="rc-icon">${r.awayTeam.icon}</span>
            </div>
          </div>

          <div class="rc-mvp-strip">
            ⭐ Maçın MVP'si: <strong>${r.matchMvp?.name}</strong> (${r.matchMvp?.kills} Kill - Reyting: ${r.matchMvp?.rating})
          </div>

          <div class="rc-footer">
            <button class="btn btn-sm btn-open-rep" data-replay-id="${r.replayId}">
              📼 TEKRARINI VE HLTV İSTATİSTİKLERİNİ İNCELE
            </button>
          </div>
        </div>
      `).join('');

      // Bind open buttons
      container.querySelectorAll('.btn-open-rep').forEach(btn => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-replay-id');
          this.openReplayModal(rId);
        });
      });
    });
  }

  // ==========================================
  // REPLAY THEATER MODAL (HLTV BOX SCORE & TIMELINE)
  // ==========================================
  openReplayModal(replayId) {
    if (!replayId) return;

    this.socket.emit('get_match_replay', { replayId }, (rep) => {
      if (!rep) {
        alert('Maç tekrarı bulunamadı.');
        return;
      }

      const modal = document.getElementById('replayDetailModal');
      const titleEl = document.getElementById('rmModalTitle');
      const scoreHero = document.getElementById('rmScoreHero');
      const boxScoreContainer = document.getElementById('rmTabBoxScore');
      const timelineContainer = document.getElementById('rmTabTimeline');

      if (!modal) return;

      if (titleEl) titleEl.innerText = `${rep.homeTeam.name} vs ${rep.awayTeam.name} (${rep.tierName})`;

      // 1. Scoreboard Hero
      if (scoreHero) {
        scoreHero.innerHTML = `
          <div class="rm-hero-team home">
            <span class="rm-hero-icon">${rep.homeTeam.icon}</span>
            <span class="rm-hero-name">${rep.homeTeam.name}</span>
          </div>
          <div class="rm-hero-score">
            <span class="s-val ${rep.score.home > rep.score.away ? 'winner' : ''}">${rep.score.home}</span>
            <span class="s-colon">:</span>
            <span class="s-val ${rep.score.away > rep.score.home ? 'winner' : ''}">${rep.score.away}</span>
          </div>
          <div class="rm-hero-team away">
            <span class="rm-hero-name">${rep.awayTeam.name}</span>
            <span class="rm-hero-icon">${rep.awayTeam.icon}</span>
          </div>
        `;
      }

      // 2. HLTV Box Score Table
      if (boxScoreContainer) {
        const renderTable = (teamObj, boxList) => `
          <div class="rm-box-table-card">
            <div class="rm-box-team-title">
              <span>${teamObj.icon} ${teamObj.name}</span>
            </div>
            <table class="rm-box-table">
              <thead>
                <tr>
                  <th>OYUNCU</th>
                  <th>ROL</th>
                  <th>K</th>
                  <th>D</th>
                  <th>A</th>
                  <th>HS%</th>
                  <th>ADR</th>
                  <th>RATING</th>
                </tr>
              </thead>
              <tbody>
                ${(boxList || []).map(p => `
                  <tr>
                    <td class="col-pname"><strong>${p.name}</strong></td>
                    <td class="col-role">${p.role}</td>
                    <td class="col-k text-win">${p.kills}</td>
                    <td class="col-d text-loss">${p.deaths}</td>
                    <td>${p.assists}</td>
                    <td>${p.hsPercent}%</td>
                    <td>${p.adr}</td>
                    <td class="col-rtg ${p.rating >= 1.15 ? 'rating-high' : ''}"><strong>${p.rating}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

        boxScoreContainer.innerHTML = `
          ${renderTable(rep.homeTeam, rep.homeBox)}
          ${renderTable(rep.awayTeam, rep.awayBox)}
        `;
      }

      // 3. Round-by-Round Timeline
      if (timelineContainer) {
        timelineContainer.innerHTML = `
          <div class="rm-timeline-list">
            ${(rep.rounds || []).map(r => `
              <div class="rm-timeline-item">
                <span class="tl-round-badge">R${r.roundNum}</span>
                <span class="tl-winner-team">${r.winningTeamIcon} ${r.winningTeamName}</span>
                <span class="tl-score">${r.scoreAfter}</span>
                <div class="tl-highlight">
                  <span class="hl-mvp">⭐ ${r.mvp}:</span>
                  <span class="hl-desc">${r.highlight}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      // Show modal
      modal.style.display = 'flex';
    });
  }

  // ==========================================
  // TAB 7: TRANSFER MARKET & SCOUT
  // ==========================================
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
