// SimulatorX - Main Dashboard & Authentication Controller
// Manages Auth Screen, Club Dashboard Hub, Multi-Tier Leagues, Squad Cards,
// Live Matches (Espor TV), Player Training Facility, Scrims, Tournaments, and Replay Theater.

class DashboardUI {
  constructor() {
    this.socket = null;
    this.currentUser = null;
    this.token = localStorage.getItem('simulatorx_token') || null;
    this.activeScreen = 'auth'; // 'auth' | 'dashboard' | 'simulation'
    this.activeTab = 'match'; // 'match' | 'training' | 'scrim' | 'live' | 'tournaments' | 'squad' | 'leagues' | 'replays' | 'market'
    this.selectedTier = 'amateur';
    this.tierOverviewCache = {};
    this.playerPool = [];
    this.perks = {};
    this.trainingDrills = {};
    this.scrimTeams = [];
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
    const now = Date.now();

    // 1. Tick User Scheduled Match Countdown
    if (this.userSchedule && this.userSchedule.countdownSeconds > 0 && !this.userSchedule.isDailyQuotaCompleted) {
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

    // 2. Tick Player Training Timers
    const trainingCountdowns = document.querySelectorAll('.training-countdown-val');
    trainingCountdowns.forEach(el => {
      const endTime = parseInt(el.getAttribute('data-end') || '0', 10);
      const remSec = Math.max(0, Math.ceil((endTime - now) / 1000));
      if (remSec > 0) {
        const m = Math.floor(remSec / 60);
        const s = remSec % 60;
        el.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      } else {
        el.innerText = 'TAMAMLANDI';
        if (this.activeTab === 'training' && !el.classList.contains('ready-rendered')) {
          el.classList.add('ready-rendered');
          this.renderTrainingTab();
        }
      }
    });

    // 3. Tick Scouting Mission Countdown
    const scoutTimerEl = document.querySelector('.scout-countdown-val');
    if (scoutTimerEl) {
      const endTime = parseInt(scoutTimerEl.getAttribute('data-end') || '0', 10);
      const remSec = Math.max(0, Math.ceil((endTime - now) / 1000));
      if (remSec > 0) {
        const m = Math.floor(remSec / 60);
        const s = remSec % 60;
        scoutTimerEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        const totalSec = parseInt(scoutTimerEl.getAttribute('data-total') || '300', 10);
        const progressPct = Math.min(100, Math.max(0, Math.round(((totalSec - remSec) / totalSec) * 100)));
        const fill = document.querySelector('.scout-progress-fill');
        if (fill) fill.style.width = `${progressPct}%`;
      } else {
        scoutTimerEl.innerText = 'TAMAMLANDI';
        if (this.activeTab === 'market' && !scoutTimerEl.classList.contains('ready-rendered')) {
          scoutTimerEl.classList.add('ready-rendered');
          this.renderMarketTab();
        }
      }
    }

    // 4. Tick Tournaments timers if currently on tournaments tab
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
      if (data.trainingDrills) this.trainingDrills = { ...data.trainingDrills };
      if (data.scoutingPrograms) this.scoutingPrograms = { ...data.scoutingPrograms };
      if (data.scrimTeams) this.scrimTeams = [...data.scrimTeams];
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
      'tabContentTraining',
      'tabContentScrim',
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

    // Update active nav button
    const dashNav = document.getElementById('dashNavTabs');
    if (dashNav) {
      dashNav.querySelectorAll('.dash-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
      });
    }

    if (tabName === 'match') this.renderMatchCenterTab();
    if (tabName === 'training') this.renderTrainingTab();
    if (tabName === 'scrim') this.renderScrimTab();
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
  // TAB 1: MATCH CENTER & SCHEDULED TIMETABLE (MAX 2 PER DAY)
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

      const isHome = sched.isHome;
      const opponent = sched.opponent;

      const m = Math.floor(sched.countdownSeconds / 60);
      const s = sched.countdownSeconds % 60;
      const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      let statusBadgeHtml = '';
      let actionBtnHtml = '';
      let noteHtml = '';

      if (sched.status === 'DAILY_LIMIT_REACHED' || sched.isDailyQuotaCompleted) {
        statusBadgeHtml = `<span class="dm-status-badge daily-done">✅ GÜNLÜK RESMİ LİG KOTASI DOLDU (2/2)</span>`;
        actionBtnHtml = `
          <div class="daily-done-banner">
            <div class="ddb-title">📅 Gün ${sched.seasonDay} Resmi Lig Maçları Tamamlandı</div>
            <p>Kulübünüz bugün çıkabileceği maksimum 2 resmi lig maçını oynadı. Lig puan tablosu güncellendi.</p>
            <div class="ddb-actions-row">
              <button class="btn btn-advance-day" id="btnAdvanceSeasonDay">🌅 Yeni Güne Başla (Gün ${sched.seasonDay + 1})</button>
              <button class="btn btn-scrim-shortcut" id="btnGoScrimTab">🥊 Hazırlık / Scrim Maçı Yap</button>
              <button class="btn btn-train-shortcut" id="btnGoTrainTab">🏋️ Oyuncuları Antrenmana Al</button>
            </div>
          </div>
        `;
        noteHtml = `<p class="dm-schedule-note">ℹ️ <strong>Lig Disiplin Kuralı:</strong> Takımlar günde en fazla 2 resmi lig maçı yapabilir. Maç aralarında takımınızı hazırlık maçlarıyla test edebilir veya antrenman tesisinde geliştirebilirsiniz.</p>`;
      } else if (sched.status === 'COMPLETED') {
        statusBadgeHtml = `<span class="dm-status-badge completed">📼 MAÇ TAMAMLANDI (${sched.score.homeScore} - ${sched.score.awayScore})</span>`;
        actionBtnHtml = `
          <button class="btn btn-hero-start-match btn-replay-open" id="btnOpenHeroReplay" data-replay-id="${sched.replayId}">
            📼 MAÇ TEKRARINI VE HLTV ÖZETİNİ İZLE
          </button>
        `;
        noteHtml = `<p class="dm-schedule-note">✅ Bu seansın resmi maçı tamamlandı. Skor puan tablosuna işlendi. Maç tekrarını izleyebilir veya günün 2. maçına hazırlanabilirsiniz.</p>`;
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
            ℹ️ <strong>Resmi Espor Takvimi:</strong> Günlük en fazla 2 resmi maç oynanır (Günün ${sched.session}. Maçı). Fikstür saatinde (${sched.scheduledTime}) canlı yayın otomatik başlar.
          </p>
        `;
      }

      container.innerHTML = `
        <div class="dm-hero-card">
          <div class="dm-top-tag">
            <span>📅 GÜN ${sched.seasonDay || 1} • ${sched.weekName.toUpperCase()} • ${league.tierName.toUpperCase()}</span>
            <div class="dm-tag-right">
              <span class="dm-daily-pill">Günün Maçları: [${sched.matchesPlayedToday || 0} / ${sched.maxDailyMatches || 2}]</span>
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
                <span class="clock-label">FİKSTÜR SAATİ</span>
                <span class="clock-time">${sched.scheduledTime}</span>
                <span class="clock-countdown" id="dashCountdownVal">${timeStr}</span>
              </div>
              <span class="dm-format-badge">MR12 RESMİ LİG MAÇI</span>
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

      document.getElementById('btnAdvanceSeasonDay')?.addEventListener('click', () => {
        this.socket.emit('advance_season_day', { username: this.currentUser.username }, (res) => {
          if (res && res.success) {
            this.renderAllDashboard();
          }
        });
      });

      document.getElementById('btnGoScrimTab')?.addEventListener('click', () => {
        this.switchTab('scrim');
      });

      document.getElementById('btnGoTrainTab')?.addEventListener('click', () => {
        this.switchTab('training');
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
  // TAB 2: PLAYER TRAINING FACILITY (BİREYSEL GELİŞİM KAMP)
  // ==========================================
  renderTrainingTab() {
    const container = document.getElementById('dashTrainingContainer');
    if (!container || !this.currentUser) return;

    const club = this.currentUser.club;
    const roster = club.roster || [];
    const activeTrainings = club.training || {};
    const drills = this.trainingDrills || {};
    const now = Date.now();

    container.innerHTML = `
      <div class="training-intro-bar">
        <div>
          <h3>🏋️ OYUNCU GELİŞİM & ÖZEL KAMP MERKEZİ</h3>
          <p>Oyuncularınızı Aim, Refleks, Demo Analizi, 1vX Clutch veya Utility kamplarına sokarak becerilerini kalıcı olarak artırın.</p>
        </div>
        <div class="training-budget">
          Kasa Bütçesi: <strong>$${(club.budget || 25000).toLocaleString()}</strong>
        </div>
      </div>

      <div class="training-players-grid">
        ${roster.map((player, idx) => {
          const currentTr = activeTrainings[player.id];
          let statusBlock = '';

          if (currentTr) {
            const remSec = Math.max(0, Math.ceil((currentTr.endTime - now) / 1000));
            const isCompleted = remSec <= 0 || currentTr.isReady;
            const m = Math.floor(remSec / 60);
            const s = remSec % 60;
            const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

            if (isCompleted) {
              statusBlock = `
                <div class="tr-active-box ready">
                  <span class="tr-badge-ready">✅ KAMP TAMAMLANDI!</span>
                  <div class="tr-name">${currentTr.drillName}</div>
                  <button class="btn btn-claim-training" data-player-id="${player.id}">
                    🏆 Gelişimi Uygula (+${Object.values(currentTr.gains).join(', ')} Puan)
                  </button>
                </div>
              `;
            } else {
              const totalSec = currentTr.durationMinutes * 60;
              const progressPct = Math.min(100, Math.max(0, Math.round(((totalSec - remSec) / totalSec) * 100)));

              statusBlock = `
                <div class="tr-active-box in-progress">
                  <div class="tr-header-row">
                    <span class="tr-drill-tag">⏳ ${currentTr.drillName}</span>
                    <strong class="training-countdown-val" data-end="${currentTr.endTime}">${timeStr}</strong>
                  </div>
                  <div class="tr-progress-bar">
                    <div class="tr-progress-fill" style="width:${progressPct}%"></div>
                  </div>
                  <small class="tr-note">Oyuncu kampta antrenman yapıyor...</small>
                </div>
              `;
            }
          } else {
            statusBlock = `
              <div class="tr-select-box">
                <label>Hedef Kamp Seçin:</label>
                <select class="tr-drill-select" id="drillSelect_${player.id}">
                  <option value="aim_headshot">🎯 Aim & Headshot Kampı ($1,500 - 10 dk - +2 Aim, +2 HS)</option>
                  <option value="reflex_reaction">⚡ Reaksiyon & Refleks Odası ($1,500 - 10 dk - +3 Reflex)</option>
                  <option value="demo_tactics">🧠 Taktik Demo Analizi ($1,200 - 10 dk - +3 Gamesense)</option>
                  <option value="clutch_mastery">🔥 1vX Clutch Kampı ($2,000 - 15 dk - +3 Clutch)</option>
                  <option value="utility_lineups">💨 Sis & Flaş Lineup Kampı ($1,000 - 8 dk - +4 Utility)</option>
                </select>
                <button class="btn btn-start-training" data-player-id="${player.id}">
                  🚀 Kampa Başlat
                </button>
              </div>
            `;
          }

          const sk = player.skills || { aim: 50, reflex: 50, headshot: 50, gamesense: 50, clutch: 50, utility: 50 };

          return `
            <div class="training-player-card">
              <div class="tpc-top">
                <span class="tpc-role">SLOT ${idx + 1} • ${player.role}</span>
                <span class="tpc-rating">⭐ ${Number(player.rating || 1.0).toFixed(2)}</span>
              </div>
              <div class="tpc-main">
                <div class="tpc-avatar">${player.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h4 class="tpc-name">${player.name}</h4>
                  <small class="tpc-sub">${player.tier || 'Amatör Yetenek'}</small>
                </div>
              </div>

              <div class="tpc-skills-overview">
                <div><span>AIM:</span><strong>${sk.aim}</strong></div>
                <div><span>REFLX:</span><strong>${sk.reflex}</strong></div>
                <div><span>HS%:</span><strong>${sk.headshot || sk.aim}</strong></div>
                <div><span>GS:</span><strong>${sk.gamesense || 50}</strong></div>
                <div><span>CLUTCH:</span><strong>${sk.clutch || 50}</strong></div>
                <div><span>UTILITY:</span><strong>${sk.utility || 50}</strong></div>
              </div>

              ${statusBlock}
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind Start Training Buttons
    container.querySelectorAll('.btn-start-training').forEach(btn => {
      btn.addEventListener('click', () => {
        const playerId = btn.getAttribute('data-player-id');
        const selectEl = document.getElementById(`drillSelect_${playerId}`);
        const drillKey = selectEl ? selectEl.value : 'aim_headshot';

        this.socket.emit('start_player_training', {
          username: this.currentUser.username,
          playerId,
          drillKey
        }, (res) => {
          if (res && res.success) {
            this.renderAllDashboard();
          } else {
            alert(res?.error || 'Antrenman başlatılamadı!');
          }
        });
      });
    });

    // Bind Claim Training Buttons
    container.querySelectorAll('.btn-claim-training').forEach(btn => {
      btn.addEventListener('click', () => {
        const playerId = btn.getAttribute('data-player-id');
        this.socket.emit('claim_player_training', {
          username: this.currentUser.username,
          playerId
        }, (res) => {
          if (res && res.success) {
            alert(res.message);
            this.renderAllDashboard();
          } else {
            alert(res?.error || 'Gelişim alınamadı!');
          }
        });
      });
    });
  }

  // ==========================================
  // TAB 3: HAZIRLIK & SCRIM MAÇI ARENASI
  // ==========================================
  renderScrimTab() {
    const container = document.getElementById('dashScrimContainer');
    if (!container || !this.currentUser) return;

    const club = this.currentUser.club;
    const botTeams = this.scrimTeams || [];

    container.innerHTML = `
      <div class="scrim-setup-card">
        <div class="scrim-hero-top">
          <div>
            <h3>🥊 ÖZEL HAZIRLIK & TAKTİKSEL SCRIM MAÇI</h3>
            <p>Resmi lig maçı dışındaki boş vaktinizde takımınızı istediğiniz bir rakibe karşı canlı 2D radarda test edin veya hızlı simüle ederek performans analizini inceleyin.</p>
          </div>
          <div class="scrim-stat-chip">
            Oynanan Scrim: <strong>${club.stats?.scrimsPlayed || 0} Maç</strong>
          </div>
        </div>

        <div class="scrim-form-grid">
          <div class="scrim-field">
            <label>🛡️ Rakip Espor Kulübü Seçin (100+ Takım):</label>
            <select id="scrimOpponentSelect" class="scrim-select">
              <optgroup label="🌍 Dünya Şampiyonlar Ligi">
                <option value="glob_eternal_fire">🔥 Eternal Fire (TR)</option>
                <option value="glob_vitality">🐝 Team Vitality (FR)</option>
                <option value="glob_spirit">🐉 Team Spirit (CIS)</option>
                <option value="glob_faze">🛡️ FaZe Clan (EU)</option>
                <option value="glob_navi">🇺🇦 Natus Vincere (UA)</option>
                <option value="glob_g2">⚔️ G2 Esports (EU)</option>
              </optgroup>
              <optgroup label="🇹🇷 Ülke Espor Süper Ligi">
                <option value="nat_sangal">🔴 Sangal Esports (TR)</option>
                <option value="nat_bbl">🦁 BBL Esports (TR)</option>
                <option value="nat_fut">🐺 FUT Esports (TR)</option>
                <option value="nat_fire_flux">☄️ Fire Flux (TR)</option>
                <option value="nat_supermassive">🌀 SuperMassive (TR)</option>
              </optgroup>
              <optgroup label="🌊 Bölge Ligi">
                <option value="reg_marmara_predators">🦈 Marmara Predators</option>
                <option value="reg_ege_thunder">⚡ Ege Thunder</option>
                <option value="reg_toros_kaplanlari">🐯 Toros Kaplanları</option>
                <option value="reg_karadeniz_firtinasi">🌊 Karadeniz Fırtınası</option>
              </optgroup>
              <optgroup label="🏙️ Şehir Ligi">
                <option value="city_kadikoy_bulls">🐂 Kadıköy Bulls (İstanbul)</option>
                <option value="city_besiktas_esports">🦅 Beşiktaş Esports (İstanbul)</option>
                <option value="city_cankaya_titans">🏛️ Çankaya Titans (Ankara)</option>
                <option value="city_kordon_sharks">🦈 Kordon Sharks (İzmir)</option>
                <option value="city_nilufer_crocs">🐊 Nilüfer Crocs (Bursa)</option>
              </optgroup>
            </select>
          </div>

          <div class="scrim-field">
            <label>🎯 Taktiksel Odak & Hazırlık Türü:</label>
            <select id="scrimTacticalFocus" class="scrim-select">
              <option value="Standart Taktiksel Hazırlık">🔹 Standart Rekabetçi Taktik</option>
              <option value="Rush B & Short Split Çalışması">🔹 Rush B & Catwalk Baskını Testi</option>
              <option value="Long A Execute & Cross Smoke">🔹 Long A Execute & Mid to B Cross Smoke</option>
              <option value="Eco & Deagle Pusma Tuzağı">🔹 Eco & Deagle Tabanca Pusma Tuzağı</option>
              <option value="Retake & Çapraz AWP Açısı">🔹 Pasif Retake & Çapraz Savunma</option>
            </select>
          </div>
        </div>

        <div class="scrim-actions-row">
          <button class="btn btn-scrim-live" id="btnStartScrimLive">
            🔴 CANLI RADARDA OYNA (5v5 Minimap)
          </button>
          <button class="btn btn-scrim-fast" id="btnStartScrimFast">
            ⚡ HIZLI SİMÜLE ET & HLTV ANALİZİNİ GÖR
          </button>
        </div>
      </div>
    `;

    // Bind Scrim Actions
    document.getElementById('btnStartScrimLive')?.addEventListener('click', () => {
      const oppSelect = document.getElementById('scrimOpponentSelect');
      const focusSelect = document.getElementById('scrimTacticalFocus');
      const opponentId = oppSelect ? oppSelect.value : 'city_kadikoy_bulls';
      const tacticalFocus = focusSelect ? focusSelect.value : 'Standart Taktik';

      this.socket.emit('start_scrim_match', {
        username: this.currentUser.username,
        opponentId,
        tacticalFocus,
        liveArena: true
      }, (res) => {
        if (res && res.success) {
          this.showScreen('simulation');
        } else {
          alert('Hazırlık maçı başlatılamadı!');
        }
      });
    });

    document.getElementById('btnStartScrimFast')?.addEventListener('click', () => {
      const oppSelect = document.getElementById('scrimOpponentSelect');
      const focusSelect = document.getElementById('scrimTacticalFocus');
      const opponentId = oppSelect ? oppSelect.value : 'city_kadikoy_bulls';
      const tacticalFocus = focusSelect ? focusSelect.value : 'Standart Taktik';

      this.socket.emit('start_scrim_match', {
        username: this.currentUser.username,
        opponentId,
        tacticalFocus,
        liveArena: false
      }, (res) => {
        if (res && res.success && res.replayId) {
          this.openReplayModal(res.replayId);
        } else {
          alert('Hazırlık maçı simüle edilemedi!');
        }
      });
    });
  }

  // ==========================================
  // TAB 4: LIVE MATCHES (ESPOR TV - CANLI MAÇLAR)
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
  // TAB 5: TOURNAMENTS & CUPS (KUPALAR)
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
  // TAB 6: SQUAD, TACTICAL BOARD & SYNERGIES
  // ==========================================
  renderSquadTab() {
    const summaryContainer = document.getElementById('dashSquadSummary');
    const gridContainer = document.getElementById('dashSquadGrid');
    if (!gridContainer || !this.currentUser) return;

    const club = this.currentUser.club;
    const squad = club.roster || [];
    const tactics = club.tactics || {
      tStrategy: 'default_a',
      ctStrategy: 'balanced',
      ecoStrategy: 'disciplined',
      primaryAwperSlot: 1,
      iglSlot: 5
    };

    // Calculate active synergies
    const hasIGL = squad.some(p => p.role === 'In-Game Leader (IGL)');
    const hasAWPer = squad.some(p => p.role === 'AWPer');
    const hasEntry = squad.some(p => p.role === 'Entry Fragger');
    const hasAnchor = squad.some(p => p.role === 'Site Anchor');

    // 1. Render Tactical Playbook Header into dashSquadSummary
    if (summaryContainer) {
      summaryContainer.innerHTML = `
        <div class="dash-tactics-card">
          <div class="dtc-header">
            <div>
              <h3>📋 TAKIM TAKTİK TAHTASI & ROL SİNERJİLERİ</h3>
              <p>Takımınızın T ve CT tarafındaki oyun planını belirleyin. Oyuncuların rolleri maç içi düellolara doğrudan etki eder.</p>
            </div>
            <button class="btn btn-save-tactics" id="btnSaveTeamTactics">
              💾 Taktik Planını Kaydet
            </button>
          </div>

          <div class="dtc-grid">
            <div class="dtc-field">
              <label>💣 Terörist (T) Saldırı Stratejisi:</label>
              <select id="selectTStrategy" class="tactics-select">
                <option value="default_a" ${tactics.tStrategy === 'default_a' ? 'selected' : ''}>🎯 Default Harita Kontrolü & Yavaş Execute (Dengeli)</option>
                <option value="rush_b" ${tactics.tStrategy === 'rush_b' ? 'selected' : ''}>⚡ Hızlı Rush B & Catwalk Baskını (%75 B Odağı)</option>
                <option value="mid_split" ${tactics.tStrategy === 'mid_split' ? 'selected' : ''}>💨 Mid to A/B Split & Sis Perdesi (Taktiksel)</option>
              </select>
            </div>

            <div class="dtc-field">
              <label>🛡️ Anti-Terörist (CT) Savunma Planı:</label>
              <select id="selectCTStrategy" class="tactics-select">
                <option value="balanced" ${tactics.ctStrategy === 'balanced' ? 'selected' : ''}>⚖️ Dengeli Bölge Paylaşımı (2A - 1Mid - 2B)</option>
                <option value="aggressive_push" ${tactics.ctStrategy === 'aggressive_push' ? 'selected' : ''}>🔥 Agresif Push & İlk Kan Avı (Yüksek Risk/Ödül)</option>
                <option value="passive_retake" ${tactics.ctStrategy === 'passive_retake' ? 'selected' : ''}>👑 Pasif Çapraz Açı & Retake Odaklı (Bomba Sonrası Güçlü)</option>
              </select>
            </div>

            <div class="dtc-field">
              <label>💰 Takım Ekonomi Politikası:</label>
              <select id="selectEcoStrategy" class="tactics-select">
                <option value="disciplined" ${tactics.ecoStrategy === 'disciplined' ? 'selected' : ''}>📉 Disiplinli Eko (Full Buy için para koru)</option>
                <option value="aggressive_force" ${tactics.ecoStrategy === 'aggressive_force' ? 'selected' : ''}>💥 Agresif Force Buy (Deagle & Famas/Galil baskısı)</option>
              </select>
            </div>
          </div>

          <!-- Active Synergies Chips -->
          <div class="synergy-chips-row">
            <span class="synergy-chip ${hasIGL ? 'active' : 'inactive'}">
              ${hasIGL ? '✅' : '⚪'} 🎯 IGL Etkisi (+4 Takım Oyun Zekası)
            </span>
            <span class="synergy-chip ${hasAWPer ? 'active' : 'inactive'}">
              ${hasAWPer ? '✅' : '⚪'} ⚡ AWPer (Full Buy Raundlarında AWP Güvencesi)
            </span>
            <span class="synergy-chip ${hasEntry ? 'active' : 'inactive'}">
              ${hasEntry ? '✅' : '⚪'} 🔥 Giriş Fragger (+9 Açılış Düellosu Bonusu)
            </span>
            <span class="synergy-chip ${hasAnchor ? 'active' : 'inactive'}">
              ${hasAnchor ? '✅' : '⚪'} 🛡️ Site Anchor (+7 Bomba Alanı Savunma Direnci)
            </span>
          </div>
        </div>
      `;

      // Bind Save Tactics Button
      document.getElementById('btnSaveTeamTactics')?.addEventListener('click', () => {
        const tStrategy = document.getElementById('selectTStrategy')?.value || 'default_a';
        const ctStrategy = document.getElementById('selectCTStrategy')?.value || 'balanced';
        const ecoStrategy = document.getElementById('selectEcoStrategy')?.value || 'disciplined';

        this.socket.emit('update_team_tactics', {
          username: this.currentUser.username,
          tactics: { tStrategy, ctStrategy, ecoStrategy }
        }, (res) => {
          if (res && res.success) {
            alert(res.message);
            this.renderAllDashboard();
          } else {
            alert(res?.error || 'Taktikler kaydedilemedi!');
          }
        });
      });
    }

    // 2. Render 5 Player Cards with Role Selectors, Form Badges, and Slot Move Controls
    gridContainer.innerHTML = squad.map((p, idx) => {
      const perkInfo = this.perks[p.perk] || { name: p.perk, icon: '⚡', desc: '' };
      const skills = p.skills || { aim: 50, reflex: 50, headshot: 50, gamesense: 50, clutch: 50, utility: 50 };
      const form = p.form || 'normal';

      let formHtml = '<span class="dp-form-badge normal">🟢 Normal</span>';
      if (form === 'on_fire') {
        formHtml = '<span class="dp-form-badge on-fire">🔥 ALEVDE (+2 Aim/Ref)</span>';
      } else if (form === 'slump') {
        formHtml = '<span class="dp-form-badge slump">❄️ FORMSUZ (-2 Aim)</span>';
      }

      return `
        <div class="dash-player-card">
          <div class="dp-top-row">
            <div class="dp-slot-controls">
              <span class="dp-slot-badge">SLOT ${idx + 1}</span>
              ${idx > 0 ? `<button class="btn-slot-move" data-action="up" data-slot="${idx}" title="Yukarı Taşı">▲</button>` : ''}
              ${idx < 4 ? `<button class="btn-slot-move" data-action="down" data-slot="${idx}" title="Aşağı Taşı">▼</button>` : ''}
            </div>
            <div class="dp-top-right">
              ${formHtml}
              <span class="dp-rating">⭐ ${Number(p.rating || 0.95).toFixed(2)}</span>
            </div>
          </div>

          <div class="dp-main-row">
            <div class="dp-avatar">${p.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <div class="dp-name">${p.name}</div>
              <div class="dp-tier">${p.tier || 'Amatör Çaylak'} • ${p.age || 18} Yaşında</div>
            </div>
          </div>

          <!-- Dynamic Role Selector -->
          <div class="dp-role-selector-row">
            <label>Taktiksel Rol:</label>
            <select class="dp-role-select" data-player-id="${p.id}">
              <option value="In-Game Leader (IGL)" ${p.role === 'In-Game Leader (IGL)' ? 'selected' : ''}>🎯 In-Game Leader (IGL)</option>
              <option value="AWPer" ${p.role === 'AWPer' ? 'selected' : ''}>⚡ AWPer (Keskin Nişancı)</option>
              <option value="Entry Fragger" ${p.role === 'Entry Fragger' ? 'selected' : ''}>🔥 Entry Fragger (İlk Temas)</option>
              <option value="Site Anchor" ${p.role === 'Site Anchor' ? 'selected' : ''}>🛡️ Site Anchor (Bölge Çapası)</option>
              <option value="Rifler (Star)" ${p.role === 'Rifler (Star)' ? 'selected' : ''}>👑 Rifler (Yıldız Nişancı)</option>
            </select>
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

    // Bind Role Dropdown Changes
    gridContainer.querySelectorAll('.dp-role-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const playerId = sel.getAttribute('data-player-id');
        const newRole = sel.value;
        this.socket.emit('update_player_role', {
          username: this.currentUser.username,
          playerId,
          newRole
        }, (res) => {
          if (res && res.success) {
            this.renderSquadTab();
          }
        });
      });
    });

    // Bind Slot Swap Buttons
    gridContainer.querySelectorAll('.btn-slot-move').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = parseInt(btn.getAttribute('data-slot'), 10);
        const action = btn.getAttribute('data-action');
        const targetSlot = (action === 'up') ? slot - 1 : slot + 1;

        this.socket.emit('swap_roster_slots', {
          username: this.currentUser.username,
          slotA: slot,
          slotB: targetSlot
        }, (res) => {
          if (res && res.success) {
            this.renderAllDashboard();
          }
        });
      });
    });
  }

  // ==========================================
  // TAB 7: MULTI-TIER LEAGUES (5 TIERS)
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
          <p>Aktif Gün: <strong>Gün ${leagueData.seasonDay || 1} / 7</strong> • Fikstür: <strong>${leagueData.currentWeek} / ${leagueData.fixtures?.length || 14}</strong> • Kural: Günde Maks. 2 Maç</p>
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
  // TAB 8: MATCH REPLAYS (TEKRARLAR)
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
            <p>Kulübünüzün resmi lig veya hazırlık maçları otomatik olarak buraya kaydedilir ve kaçırsanız bile dilediğiniz zaman tekrarını inceleyebilirsiniz.</p>
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
  // TAB 9: TRANSFER MARKET & YOUTH SCOUT FACILITY
  // ==========================================
  renderMarketTab() {
    const container = document.getElementById('dashMarketContainer');
    if (!container || !this.currentUser) return;

    const club = this.currentUser.club;
    const catalog = this.playerPool || [];
    const scouting = club.scouting || null;
    const candidates = club.scoutCandidates || [];
    const progs = this.scoutingPrograms || {
      local: { id: 'local', name: '🇹🇷 Yerel Akademi & Şehir Taraması', cost: 800, durationMinutes: 2, stars: 3, badge: 'Yerel Yetenek', desc: 'Bölgesel kafeler ve yerel turnuvalardan 15-18 yaş arası işlenmemiş Türk yetenekler.' },
      challenger: { id: 'challenger', name: '🇪🇺 Avrupa FPL & Challenger Taraması', cost: 2500, durationMinutes: 5, stars: 4, badge: 'FPL Yıldızı', desc: 'Faceit Pro League ve Avrupa challenger liglerinde parlayan genç aim canavarları.' },
      wonderkid: { id: 'wonderkid', name: '⭐ Global Major Wonderkid Avı', cost: 6000, durationMinutes: 10, stars: 5, badge: 'Geleceğin Yıldızı', desc: 'Geleceğin s1mple veya donk adayları! Üst düzey potansiyelli efsane yetenekler.' }
    };

    const now = Date.now();
    let scoutActiveHtml = '';

    if (scouting) {
      const remSec = Math.max(0, Math.ceil((scouting.endTime - now) / 1000));
      const isReady = remSec <= 0 || scouting.isReady;
      const m = Math.floor(remSec / 60);
      const s = remSec % 60;
      const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      const totalSec = scouting.durationMinutes * 60;
      const progressPct = Math.min(100, Math.max(0, Math.round(((totalSec - remSec) / totalSec) * 100)));

      if (isReady) {
        scoutActiveHtml = `
          <div class="scout-active-box ready">
            <div class="sab-title">🎉 GÖZLEMCİ GÖREVİ TAMAMLANDI!</div>
            <p>Gözlemcileriniz sahada yetenek avını bitirdi ve kulübünüz için 3 adayı belirledi.</p>
            <button class="btn btn-claim-scout" id="btnClaimScoutReport">
              🔭 Raporu Aç & Genç Yetenekleri İncele
            </button>
          </div>
        `;
      } else {
        scoutActiveHtml = `
          <div class="scout-active-box in-progress">
            <div class="sab-header">
              <span>🔭 Devam Eden Görev: <strong>${scouting.programName}</strong></span>
              <strong class="scout-countdown-val" data-end="${scouting.endTime}" data-total="${totalSec}">${timeStr}</strong>
            </div>
            <div class="scout-progress-bar">
              <div class="scout-progress-fill" style="width:${progressPct}%"></div>
            </div>
            <small class="sab-note">Gözlemciler LAN turnuvalarını ve FPL maçlarını tarıyor...</small>
          </div>
        `;
      }
    }

    // Candidates Shelf HTML
    let candidatesHtml = '';
    if (candidates.length > 0) {
      candidatesHtml = `
        <div class="scout-candidates-section">
          <div class="scs-header">
            <h3>⭐ KEŞFEDİLEN GENÇ YETENEK ADAYLARI (${candidates.length})</h3>
            <p>Gözlemcilerinizin kulübünüz için bulduğu işlenmemiş yetenekler. Kadronuza katmak için sözleşme teklif edin.</p>
          </div>
          <div class="scout-candidates-grid">
            ${candidates.map(c => {
              const stars = '⭐'.repeat(c.potentialStars || 3);
              const perkInfo = this.perks[c.perk] || { name: c.perk, icon: '⚡' };
              const canAfford = (club.budget >= c.price);

              return `
                <div class="candidate-card">
                  <div class="cc-top">
                    <span class="cc-tier-badge">${c.tier}</span>
                    <span class="cc-stars" title="Potansiyel: ${c.potentialStars}/5 Yıldız">${stars}</span>
                  </div>
                  <div class="cc-main">
                    <div class="cc-avatar">${c.name.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <h4 class="cc-name">${c.name}</h4>
                      <small class="cc-sub">${c.age} Yaşında • ${c.role}</small>
                    </div>
                  </div>
                  <div class="cc-note">
                    ${c.scoutNote || c.desc}
                  </div>
                  <div class="cc-skills">
                    <div><span>AIM:</span><strong>${c.skills.aim}</strong></div>
                    <div><span>REF:</span><strong>${c.skills.reflex}</strong></div>
                    <div><span>HS%:</span><strong>${c.skills.headshot || c.skills.aim}%</strong></div>
                    <div><span>GS:</span><strong>${c.skills.gamesense}</strong></div>
                  </div>
                  <div class="cc-perk">
                    ${perkInfo.icon} <strong>${perkInfo.name}</strong>
                  </div>
                  <div class="cc-footer">
                    <span class="cc-price">$${(c.price || 3000).toLocaleString()}</span>
                    <button class="btn btn-sm btn-sign-candidate ${canAfford ? '' : 'disabled'}" ${canAfford ? '' : 'disabled'} data-cand-id="${c.id}">
                      ${canAfford ? '✍️ Kadroma Kat' : 'Yetersiz Kasa'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="dash-market-top">
        <div class="market-intro">
          <h3>🔭 ALTYAPI & GENÇ YETENEK SCOUT MERKEZİ</h3>
          <p>Gözlemcilerinizi yerel kafelere, FPL liglerine veya dünya çapına göndererek geleceğin yıldızlarını keşfedin.</p>
        </div>
        <div class="market-budget-badge">
          Kasa Bütçesi: <strong>$${(club.budget || 25000).toLocaleString()}</strong>
        </div>
      </div>

      <!-- ACTIVE SCOUT MISSION -->
      ${scoutActiveHtml}

      <!-- SCOUT MISSIONS GRID -->
      <div class="scout-missions-grid">
        ${Object.keys(progs).map(key => {
          const prog = progs[key];
          const canAfford = (club.budget >= prog.cost);
          const isBusy = Boolean(scouting);

          return `
            <div class="scout-mission-card">
              <div class="smc-header">
                <span class="smc-badge">${prog.badge}</span>
                <span class="smc-stars">${'⭐'.repeat(prog.stars)}</span>
              </div>
              <h4 class="smc-name">${prog.name}</h4>
              <p class="smc-desc">${prog.desc}</p>
              <div class="smc-meta">
                <span>⏱️ Süre: <strong>${prog.durationMinutes} dk</strong></span>
                <span>💰 Ücret: <strong>$${prog.cost.toLocaleString()}</strong></span>
              </div>
              <button class="btn btn-start-scout ${(!canAfford || isBusy) ? 'disabled' : ''}" 
                ${(!canAfford || isBusy) ? 'disabled' : ''} data-prog-key="${prog.id}">
                ${isBusy ? 'Gözlemciler Görevde' : (canAfford ? '🔭 Taramayı Başlat' : 'Yetersiz Bütçe')}
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- SCOUT CANDIDATES SHELF -->
      ${candidatesHtml}

      <!-- PRO PLAYER MARKETPLACE -->
      <div class="dash-market-top pro-market-header">
        <div class="market-intro">
          <h3>🛒 PROFESYONEL OYUNCU TRANSFER PAZARI</h3>
          <p>Kanıtlanmış profesyonel oyuncuları transfer ederek ilk 5 kadronuzu güçlendirin.</p>
        </div>
      </div>

      <div class="dash-market-grid">
        ${catalog.slice(0, 12).map(p => {
          const perkInfo = this.perks[p.perk] || { name: p.perk, icon: '⭐', desc: '' };
          const price = p.price || 15000;
          const canAfford = (club.budget >= price);

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
                  ${canAfford ? '✍️ Transfer Et' : 'Yetersiz Kasa'}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind Start Scout Mission Buttons
    container.querySelectorAll('.btn-start-scout').forEach(btn => {
      btn.addEventListener('click', () => {
        const programKey = btn.getAttribute('data-prog-key');
        this.socket.emit('start_scouting_mission', {
          username: this.currentUser.username,
          programKey
        }, (res) => {
          if (res && res.success) {
            this.renderAllDashboard();
          } else {
            alert(res?.error || 'Gözlemci görevi başlatılamadı!');
          }
        });
      });
    });

    // Bind Claim Scout Report Button
    document.getElementById('btnClaimScoutReport')?.addEventListener('click', () => {
      this.socket.emit('claim_scouting_report', {
        username: this.currentUser.username
      }, (res) => {
        if (res && res.success) {
          alert(res.message);
          this.renderAllDashboard();
        } else {
          alert(res?.error || 'Rapor açılamadı!');
        }
      });
    });

    // Bind Candidate Signing (opens interactive modal)
    container.querySelectorAll('.btn-sign-candidate').forEach(btn => {
      btn.addEventListener('click', () => {
        const cId = btn.getAttribute('data-cand-id');
        const candidate = candidates.find(c => c.id === cId);
        if (candidate) {
          this.openSigningModal(candidate, true);
        }
      });
    });

    // Bind Market Player Signing (opens interactive modal)
    container.querySelectorAll('.btn-sign-player').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-player-id');
        const playerObj = catalog.find(p => p.id === pId);
        if (playerObj) {
          this.openSigningModal(playerObj, false);
        }
      });
    });
  }

  // ==========================================
  // INTERACTIVE SIGNING & ROSTER SWAP MODAL
  // ==========================================
  openSigningModal(playerToSign, isScoutCandidate) {
    let modal = document.getElementById('dashSigningModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dashSigningModal';
      modal.className = 'custom-modal-backdrop';
      document.body.appendChild(modal);
    }

    const currentRoster = this.currentUser.club.roster || [];
    const perkInfo = this.perks[playerToSign.perk] || { name: playerToSign.perk, icon: '⚡' };
    const price = playerToSign.price || 5000;

    modal.innerHTML = `
      <div class="custom-modal-card signing-modal-card">
        <div class="cmc-header">
          <div>
            <h3>✍️ OYUNCU TRANSFERİ & KADRO DEĞİŞİMİ</h3>
            <p><strong>${playerToSign.name}</strong> transfer edilecek. Hangi oyuncunun yerine geçeceğini seçin.</p>
          </div>
          <button class="btn-close-modal" id="btnCloseSigningModal">✕</button>
        </div>

        <div class="signing-modal-grid">
          <!-- LEFT: New Player Card -->
          <div class="sm-new-player-col">
            <div class="smn-badge">YENİ TRANSFER</div>
            <div class="smn-avatar">${playerToSign.name.slice(0, 2).toUpperCase()}</div>
            <h4 class="smn-name">${playerToSign.name}</h4>
            <div class="smn-role">${playerToSign.role} • ${playerToSign.tier || 'Yetenek'}</div>
            <div class="smn-rating">⭐ ${Number(playerToSign.rating || 1.0).toFixed(2)}</div>
            <div class="smn-price">Maliyet: <strong>$${price.toLocaleString()}</strong></div>

            <div class="smn-skills-list">
              <div><span>AIM:</span><strong>${playerToSign.skills?.aim || 75}</strong></div>
              <div><span>REF:</span><strong>${playerToSign.skills?.reflex || 75}</strong></div>
              <div><span>HS%:</span><strong>${playerToSign.skills?.headshot || 70}%</strong></div>
              <div><span>GS:</span><strong>${playerToSign.skills?.gamesense || 75}</strong></div>
              <div><span>CLUTCH:</span><strong>${playerToSign.skills?.clutch || 70}</strong></div>
            </div>
          </div>

          <!-- RIGHT: Current 5 Roster Slots -->
          <div class="sm-roster-slots-col">
            <div class="smr-title">MEVCUT İLK 5 KADRONUZ (Değişecek Slotu Seçin):</div>
            <div class="sm-slots-list">
              ${currentRoster.map((oldP, idx) => {
                const aimDiff = (playerToSign.skills?.aim || 75) - (oldP.skills?.aim || 50);
                const refDiff = (playerToSign.skills?.reflex || 75) - (oldP.skills?.reflex || 50);

                const aimDiffHtml = aimDiff >= 0 
                  ? `<span class="diff-pos">+${aimDiff} AIM</span>` 
                  : `<span class="diff-neg">${aimDiff} AIM</span>`;
                const refDiffHtml = refDiff >= 0 
                  ? `<span class="diff-pos">+${refDiff} REF</span>` 
                  : `<span class="diff-neg">${refDiff} REF</span>`;

                return `
                  <div class="sm-slot-item">
                    <div class="smsi-left">
                      <span class="smsi-slot-num">SLOT ${idx + 1}</span>
                      <div class="smsi-info">
                        <strong>${oldP.name}</strong>
                        <small>${oldP.role} • ⭐ ${Number(oldP.rating || 0.95).toFixed(2)}</small>
                      </div>
                    </div>
                    <div class="smsi-diffs">
                      ${aimDiffHtml}
                      ${refDiffHtml}
                    </div>
                    <button class="btn btn-confirm-slot-swap" data-slot="${idx}">
                      Bu Oyuncunun Yerine Al
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Bind Close
    document.getElementById('btnCloseSigningModal')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Bind Slot Confirmation
    modal.querySelectorAll('.btn-confirm-slot-swap').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotIndex = parseInt(btn.getAttribute('data-slot'), 10);
        const eventName = isScoutCandidate ? 'sign_scout_candidate' : 'sign_market_player';
        const payload = isScoutCandidate 
          ? { username: this.currentUser.username, candidateId: playerToSign.id, slotIndex }
          : { username: this.currentUser.username, playerId: playerToSign.id, slotIndex };

        this.socket.emit(eventName, payload, (res) => {
          if (res && res.success) {
            modal.style.display = 'none';
            alert(res.message);
            this.renderAllDashboard();
          } else {
            alert(res?.error || 'Transfer gerçekleştirilemedi!');
          }
        });
      });
    });
  }
}

window.DashboardUI = DashboardUI;
