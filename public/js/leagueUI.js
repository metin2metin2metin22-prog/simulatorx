// SimulatorX - Client-Side Esports League & Fixtures Controller
// Manages league standings table, fixtures, next match card, and live/quick simulation.

class LeagueUI {
  constructor() {
    this.socket = null;
    this.leagueData = null;
    this.activeTab = 'standings';

    this.modal = null;
    this.btnOpenModal = null;
    this.btnCloseModal = null;
    this.heroNextMatch = null;
    this.standingsTableBody = null;
    this.fixturesContainer = null;
  }

  init(socket) {
    this.socket = socket;
    this.bindDOM();
    this.bindSocketEvents();
  }

  bindDOM() {
    this.modal = document.getElementById('leagueModal');
    this.btnOpenModal = document.getElementById('btnOpenLeagueModal');
    this.btnCloseModal = document.getElementById('btnCloseLeagueModal');
    this.heroNextMatch = document.getElementById('leagueHeroNextMatch');
    this.standingsTableBody = document.getElementById('leagueStandingsBody');
    this.fixturesContainer = document.getElementById('leagueFixturesContainer');

    if (this.btnOpenModal) {
      this.btnOpenModal.addEventListener('click', () => this.openModal());
    }
    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener('click', () => this.closeModal());
    }

    // Modal Tabs
    const tabStandings = document.getElementById('tabLeagueStandings');
    const tabFixtures = document.getElementById('tabLeagueFixtures');
    if (tabStandings && tabFixtures) {
      tabStandings.addEventListener('click', () => {
        this.activeTab = 'standings';
        tabStandings.classList.add('active');
        tabFixtures.classList.remove('active');
        document.getElementById('viewLeagueStandings').style.display = 'block';
        document.getElementById('viewLeagueFixtures').style.display = 'none';
      });
      tabFixtures.addEventListener('click', () => {
        this.activeTab = 'fixtures';
        tabFixtures.classList.add('active');
        tabStandings.classList.remove('active');
        document.getElementById('viewLeagueStandings').style.display = 'none';
        document.getElementById('viewLeagueFixtures').style.display = 'block';
        this.renderFixtures();
      });
    }

    // Reset Season Button
    const btnResetSeason = document.getElementById('btnResetSeason');
    if (btnResetSeason) {
      btnResetSeason.addEventListener('click', () => {
        if (confirm('Lig sezonunu sıfırlayıp 1. Haftadan yeni bir sezona başlamak istediğinize emin misiniz?')) {
          this.socket.emit('reset_league_season');
        }
      });
    }
  }

  bindSocketEvents() {
    this.socket.on('init_data', (data) => {
      if (data.league) {
        this.updateLeagueData(data.league);
      }
    });

    this.socket.on('league_data', (data) => {
      this.updateLeagueData(data);
    });

    this.socket.on('game_update', (state) => {
      if (state.league && JSON.stringify(state.league) !== JSON.stringify(this.leagueData)) {
        this.updateLeagueData(state.league);
      }
      if (state.matchInfo) {
        this.updateHUDTeamLabels(state.matchInfo, state);
      }
    });
  }

  updateLeagueData(data) {
    this.leagueData = data;
    this.renderHeroCard();
    this.renderStandings();
    if (this.activeTab === 'fixtures') {
      this.renderFixtures();
    }
    this.updateMiniBadge();
  }

  updateMiniBadge() {
    const badge = document.getElementById('leagueQuickStatus');
    if (!badge || !this.leagueData) return;
    const nm = this.leagueData.nextMatch;
    if (nm) {
      badge.innerHTML = `Sıradaki: <strong>${nm.opponent.icon} ${nm.opponent.name}</strong> (Hafta ${nm.week})`;
    } else if (this.leagueData.isSeasonFinished) {
      badge.innerHTML = `🏆 Sezon Tamamlandı! Şampiyon: <strong>${this.leagueData.champion?.name}</strong>`;
    }
  }

  updateHUDTeamLabels(matchInfo, state) {
    const nameCT = document.getElementById('nameCT');
    const nameT = document.getElementById('nameT');
    const ctCoach = document.getElementById('ctCoachName');
    const tCoach = document.getElementById('tCoachName');

    if (!matchInfo || !matchInfo.isLeagueMatch) return;

    const userClub = matchInfo.userClub;
    const opponent = matchInfo.opponent;

    // Check if teams swapped at round 13
    const isSwapped = (state && state.round >= 13);
    const userIsCTNow = (!isSwapped && matchInfo.userSide === 'ct') || (isSwapped && matchInfo.userSide === 't');

    if (nameCT) {
      nameCT.innerHTML = userIsCTNow 
        ? `${userClub.icon} ${userClub.name} <small>(CT)</small>` 
        : `${opponent.icon} ${opponent.name} <small>(CT)</small>`;
    }
    if (nameT) {
      nameT.innerHTML = !userIsCTNow 
        ? `${userClub.icon} ${userClub.name} <small>(T)</small>` 
        : `${opponent.icon} ${opponent.name} <small>(T)</small>`;
    }
    if (ctCoach) {
      ctCoach.innerText = userIsCTNow ? `Koç (Siz)` : `${opponent.coachName || 'Koç'} (AI)`;
    }
    if (tCoach) {
      tCoach.innerText = !userIsCTNow ? `Koç (Siz)` : `${opponent.coachName || 'Koç'} (AI)`;
    }
  }

  renderHeroCard() {
    if (!this.heroNextMatch || !this.leagueData) return;
    const nm = this.leagueData.nextMatch;

    if (this.leagueData.isSeasonFinished) {
      const champ = this.leagueData.champion;
      const isUserChamp = champ && champ.teamId === this.leagueData.userClub.id;
      this.heroNextMatch.innerHTML = `
        <div class="lh-finished-banner">
          <div class="lh-trophy">🏆</div>
          <div class="lh-finished-info">
            <h3>SEZON ${this.leagueData.season} TAMAMLANDI!</h3>
            <p>Lig Şampiyonu: <strong>${champ?.icon} ${champ?.name}</strong> (${champ?.points} Puan)</p>
            ${isUserChamp ? '<div class="lh-reward-tag">🎉 TEBRİKLER! Şampiyonluk Primi: +$100,000 Kasaya Eklendi!</div>' : ''}
          </div>
          <button class="btn btn-primary btn-new-season" id="btnHeroNewSeason">🏆 Yeni Sezona Başla</button>
        </div>
      `;
      document.getElementById('btnHeroNewSeason')?.addEventListener('click', () => {
        this.socket.emit('reset_league_season');
      });
      return;
    }

    if (!nm) {
      this.heroNextMatch.innerHTML = `<div class="lh-empty">Sıradaki maç bulunamadı.</div>`;
      return;
    }

    const user = this.leagueData.userClub;
    const opp = nm.opponent;

    this.heroNextMatch.innerHTML = `
      <div class="lh-card-top-tag">📅 ${nm.weekName.toUpperCase()}</div>
      <div class="lh-clash-row">
        <!-- USER CLUB -->
        <div class="lh-team-col user">
          <div class="lh-icon">${user.icon}</div>
          <div class="lh-team-name">${user.name}</div>
          <div class="lh-team-sub">Reyting: ${user.stats.rating} • Bütçe: $${(user.budget || 0).toLocaleString()}</div>
        </div>

        <!-- VS DIVIDER -->
        <div class="lh-vs-col">
          <span class="lh-vs-text">VS</span>
          <span class="lh-status-tag">${nm.isHome ? 'EV SAHİBİ (CT Başlar)' : 'DEPLASMAN (T Başlar)'}</span>
        </div>

        <!-- OPPONENT BOT TEAM -->
        <div class="lh-team-col opp">
          <div class="lh-icon">${opp.icon}</div>
          <div class="lh-team-name">${opp.name}</div>
          <div class="lh-team-sub">Reyting: ${opp.stats?.rating || 1.10} • Koç: ${opp.coachName}</div>
        </div>
      </div>

      <!-- OPPONENT ROSTER PREVIEW -->
      <div class="lh-opp-preview">
        <span class="opp-prev-label">🎯 Rakip İlk 5:</span>
        <div class="opp-prev-players">
          ${(opp.roster || []).map(p => `
            <span class="opp-p-chip" title="Aim: ${p.skills?.aim || 90}">
              ${p.name} <small>(${p.role})</small>
            </span>
          `).join('')}
        </div>
      </div>

      <!-- MATCH ACTION BUTTONS -->
      <div class="lh-actions-row">
        <button class="btn btn-primary btn-play-match" id="btnHeroPlayMatch">
          🔥 Canlı Maça Çık (Oyna)
        </button>
        <button class="btn btn-secondary btn-quick-sim" id="btnHeroQuickSim">
          ⚡ Hızlı Simüle Et (Atla)
        </button>
      </div>
    `;

    document.getElementById('btnHeroPlayMatch')?.addEventListener('click', () => {
      this.socket.emit('play_league_match');
      this.closeModal();
    });

    document.getElementById('btnHeroQuickSim')?.addEventListener('click', () => {
      this.socket.emit('quick_sim_league_match');
    });
  }

  renderStandings() {
    if (!this.standingsTableBody || !this.leagueData) return;
    const standings = this.leagueData.standings || [];
    const userId = this.leagueData.userClub?.id;

    this.standingsTableBody.innerHTML = standings.map((team, idx) => {
      const isUser = (team.teamId === userId);
      const isLeader = (idx === 0);
      const rowClass = `${isUser ? 'user-row' : ''} ${isLeader ? 'leader-row' : ''}`;
      const rankBadge = isLeader ? '👑 1' : (idx + 1);

      return `
        <tr class="${rowClass}">
          <td class="col-rank">${rankBadge}</td>
          <td class="col-team">
            <span class="team-icon">${team.icon}</span>
            <span class="team-name">${team.name}</span>
            ${isUser ? '<span class="user-pill">BİZİM KULÜP</span>' : ''}
          </td>
          <td class="col-stat">${team.played}</td>
          <td class="col-stat text-win">${team.won}</td>
          <td class="col-stat text-loss">${team.lost}</td>
          <td class="col-stat">${team.roundsWon} : ${team.roundsLost}</td>
          <td class="col-stat font-bold ${team.roundDiff >= 0 ? 'text-win' : 'text-loss'}">
            ${team.roundDiff > 0 ? '+' : ''}${team.roundDiff}
          </td>
          <td class="col-stat col-pts">${team.points}</td>
        </tr>
      `;
    }).join('');
  }

  renderFixtures() {
    if (!this.fixturesContainer || !this.leagueData) return;
    const fixtures = this.leagueData.fixtures || [];
    const currentWeek = this.leagueData.currentWeek;
    const userId = this.leagueData.userClub?.id;

    this.fixturesContainer.innerHTML = fixtures.map(week => {
      const isCurrent = (week.week === currentWeek);
      const isPast = (week.week < currentWeek);

      return `
        <div class="fix-week-card ${isCurrent ? 'current-week' : ''}">
          <div class="fix-week-header">
            <span>${week.name}</span>
            <span class="fix-status-badge">${isCurrent ? '⚡ AKTİF HAFTA' : (isPast ? '✓ TAMAMLANDI' : 'BEKLİYOR')}</span>
          </div>
          <div class="fix-matches-list">
            ${week.matches.map(m => {
              const home = this.getTeamInfo(m.homeTeamId);
              const away = this.getTeamInfo(m.awayTeamId);
              const hasUser = (m.homeTeamId === userId || m.awayTeamId === userId);
              const scoreText = m.completed 
                ? `<strong>${m.score.homeScore} : ${m.score.awayScore}</strong>` 
                : `<span class="fix-vs">VS</span>`;

              return `
                <div class="fix-match-item ${hasUser ? 'user-match' : ''}">
                  <span class="fix-team home ${m.score && m.score.homeScore > m.score.awayScore ? 'winner' : ''}">
                    ${home.icon} ${home.name}
                  </span>
                  <div class="fix-score-col">${scoreText}</div>
                  <span class="fix-team away ${m.score && m.score.awayScore > m.score.homeScore ? 'winner' : ''}">
                    ${away.icon} ${away.name}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  getTeamInfo(teamId) {
    if (!this.leagueData) return { name: teamId, icon: '🛡️' };
    if (this.leagueData.userClub && teamId === this.leagueData.userClub.id) {
      return this.leagueData.userClub;
    }
    const standing = (this.leagueData.standings || []).find(s => s.teamId === teamId);
    return standing || { name: teamId, icon: '🛡️' };
  }

  openModal() {
    if (this.modal) {
      this.modal.style.display = 'flex';
      this.renderHeroCard();
      this.renderStandings();
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }
}

window.LeagueUI = LeagueUI;
