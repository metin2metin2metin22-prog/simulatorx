// SimulatorX - Esports Team Owner / Squad Manager & Transfer Market Controller
// Allows users to customize rosters, swap players, inspect skill cards, and apply lineups.

class RosterManager {
  constructor() {
    this.socket = null;
    this.rosters = { ct: [], t: [] };
    this.playerPool = [];
    this.perks = {};
    this.presets = {};
    this.selectedTeam = 'ct';
    this.selectedSlot = 0;
    this.draftRosters = { ct: [], t: [] };
    this.filterRole = 'all';
    this.searchQuery = '';
    this.customPlayers = [];

    this.modal = null;
    this.slotsContainer = null;
    this.poolGrid = null;
    this.squadSummary = null;
  }

  init(socket) {
    this.socket = socket;
    this.bindDOM();
    this.bindSocketEvents();
  }

  bindDOM() {
    this.modal = document.getElementById('rosterManagerModal');
    this.slotsContainer = document.getElementById('rmSlotsContainer');
    this.poolGrid = document.getElementById('rmPoolGrid');
    this.squadSummary = document.getElementById('rmSquadSummary');

    // Open Modal Buttons
    const btnOpenRadar = document.getElementById('btnOpenRosterManager');
    if (btnOpenRadar) btnOpenRadar.addEventListener('click', () => this.openModal(this.selectedTeam));

    const btnOpenSide = document.getElementById('btnOpenRosterManagerSide');
    if (btnOpenSide) btnOpenSide.addEventListener('click', () => this.openModal(this.selectedTeam));

    // Close Modal Button
    const btnClose = document.getElementById('btnCloseRosterManager');
    if (btnClose) btnClose.addEventListener('click', () => this.closeModal());

    const btnCancel = document.getElementById('btnCancelRoster');
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeModal());

    // Team Switcher Tabs
    const btnTeamCT = document.getElementById('rmBtnTeamCT');
    const btnTeamT = document.getElementById('rmBtnTeamT');
    if (btnTeamCT) btnTeamCT.addEventListener('click', () => this.setTeam('ct'));
    if (btnTeamT) btnTeamT.addEventListener('click', () => this.setTeam('t'));

    // Preset Selection
    const btnApplyPreset = document.getElementById('btnApplyPreset');
    const presetSelect = document.getElementById('rmPresetSelect');
    if (btnApplyPreset && presetSelect) {
      btnApplyPreset.addEventListener('click', () => {
        const val = presetSelect.value;
        if (val) this.applyPreset(val);
      });
    }

    // Role Filter Buttons
    const filterContainer = document.getElementById('rmRoleFilters');
    if (filterContainer) {
      filterContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('rm-filter-btn')) {
          filterContainer.querySelectorAll('.rm-filter-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.filterRole = e.target.getAttribute('data-role');
          this.renderMarketPool();
        }
      });
    }

    // Player Search Input
    const searchInput = document.getElementById('rmPlayerSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderMarketPool();
      });
    }

    // Custom Player Form Toggle
    const btnToggleCustom = document.getElementById('btnToggleCustomPlayer');
    const customForm = document.getElementById('rmCustomForm');
    if (btnToggleCustom && customForm) {
      btnToggleCustom.addEventListener('click', () => {
        const isHidden = customForm.style.display === 'none';
        customForm.style.display = isHidden ? 'block' : 'none';
        btnToggleCustom.innerText = isHidden ? '▲ Formu Gizle' : '+ Özel Oyuncu Kartı Oluştur';
      });
    }

    // Custom Player Sliders Live Value Update
    ['cpAim', 'cpReflex', 'cpHs', 'cpGs', 'cpClutch', 'cpUtility'].forEach(id => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(`val${id.slice(2)}`);
      if (el && valEl) {
        el.addEventListener('input', () => { valEl.innerText = el.value; });
      }
    });

    // Create Custom Player Button
    const btnCreate = document.getElementById('btnCreateCustomPlayer');
    if (btnCreate) {
      btnCreate.addEventListener('click', () => this.createCustomPlayer());
    }

    // Save & Apply Button
    const btnSave = document.getElementById('btnSaveRoster');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveAndApply());
    }

    // ESC to close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.style.display === 'flex') {
        this.closeModal();
      }
    });
  }

  bindSocketEvents() {
    this.socket.on('init_data', (data) => {
      if (data.rosters) {
        this.rosters = JSON.parse(JSON.stringify(data.rosters));
        this.draftRosters = JSON.parse(JSON.stringify(data.rosters));
      }
      if (data.playerPool) {
        this.playerPool = [...data.playerPool];
      }
      if (data.perks) {
        this.perks = { ...data.perks };
      }
      if (data.presets) {
        this.presets = { ...data.presets };
      }
    });

    this.socket.on('roster_updated', ({ team, roster }) => {
      if (team && roster) {
        this.rosters[team] = JSON.parse(JSON.stringify(roster));
        this.draftRosters[team] = JSON.parse(JSON.stringify(roster));
        if (this.modal && this.modal.style.display === 'flex') {
          this.renderAll();
        }
      }
    });
  }

  openModal(team = 'ct') {
    if (!this.modal) return;
    this.selectedTeam = team;
    this.selectedSlot = 0;
    this.draftRosters = JSON.parse(JSON.stringify(this.rosters));
    this.modal.style.display = 'flex';
    this.renderAll();
  }

  closeModal() {
    if (this.modal) this.modal.style.display = 'none';
  }

  setTeam(team) {
    this.selectedTeam = team;
    const btnCT = document.getElementById('rmBtnTeamCT');
    const btnT = document.getElementById('rmBtnTeamT');
    if (btnCT) btnCT.classList.toggle('active', team === 'ct');
    if (btnT) btnT.classList.toggle('active', team === 't');
    this.selectedSlot = 0;
    this.renderAll();
  }

  selectSlot(idx) {
    this.selectedSlot = idx;
    this.renderSquadSlots();
    this.renderMarketPool();
  }

  renderAll() {
    this.renderSquadSummary();
    this.renderSquadSlots();
    this.renderMarketPool();
  }

  renderSquadSummary() {
    if (!this.squadSummary) return;
    const squad = this.draftRosters[this.selectedTeam] || [];
    if (squad.length === 0) return;

    const len = squad.length;
    const avgRating = (squad.reduce((s, p) => s + (p.rating || 1.15), 0) / len).toFixed(2);
    const avgAim = Math.round(squad.reduce((s, p) => s + (p.skills?.aim || 92), 0) / len);
    const avgReflex = Math.round(squad.reduce((s, p) => s + (p.skills?.reflex || 92), 0) / len);
    const avgHS = Math.round(squad.reduce((s, p) => s + (p.skills?.headshot || p.skills?.aim || 90), 0) / len);
    const avgGS = Math.round(squad.reduce((s, p) => s + (p.skills?.gamesense || 92), 0) / len);
    const avgClutch = Math.round(squad.reduce((s, p) => s + (p.skills?.clutch || 92), 0) / len);
    const avgUtility = Math.round(squad.reduce((s, p) => s + (p.skills?.utility || 90), 0) / len);

    const teamTitle = this.selectedTeam === 'ct' ? '🛡️ COUNTER-TERRORISTS' : '💣 TERRORISTS';

    this.squadSummary.innerHTML = `
      <div class="rm-sum-team-title">${teamTitle} SİNERJİ & GÜÇ ÖZETİ</div>
      <div class="rm-sum-metrics">
        <div class="rm-metric-chip rating">
          <span class="m-label">TAKIM RATING</span>
          <span class="m-val">⭐ ${avgRating}</span>
        </div>
        <div class="rm-metric-chip">
          <span class="m-label">AIM GÜCÜ</span>
          <span class="m-val">${avgAim}</span>
        </div>
        <div class="rm-metric-chip">
          <span class="m-label">REAKSİYON</span>
          <span class="m-val">${avgReflex}</span>
        </div>
        <div class="rm-metric-chip">
          <span class="m-label">1-TAP / HS</span>
          <span class="m-val">${avgHS}</span>
        </div>
        <div class="rm-metric-chip">
          <span class="m-label">OYUN ZEKASI</span>
          <span class="m-val">${avgGS}</span>
        </div>
        <div class="rm-metric-chip">
          <span class="m-label">CLUTCH BUZU</span>
          <span class="m-val">${avgClutch}</span>
        </div>
        <div class="rm-metric-chip">
          <span class="m-label">BOMBA / UTILITY</span>
          <span class="m-val">${avgUtility}</span>
        </div>
      </div>
    `;
  }

  renderSquadSlots() {
    if (!this.slotsContainer) return;
    const squad = this.draftRosters[this.selectedTeam] || [];
    const SLOT_TITLES = [
      'SLOT 1 • KESKİN NİŞANCI (AWP)',
      'SLOT 2 • GİRİŞ FRAGGER (ENTRY)',
      'SLOT 3 • İKİNCİ SİLAH / YILDIZ',
      'SLOT 4 • BOMBA SAHASI DEFANSI (ANCHOR)',
      'SLOT 5 • SAHA İÇİ LİDER (IGL) / LURKER'
    ];

    this.slotsContainer.innerHTML = squad.map((p, idx) => {
      const isFocused = (this.selectedSlot === idx);
      const perkInfo = this.perks[p.perk] || { name: 'Standart', icon: '⚡', badge: 'PRO' };
      const skills = p.skills || { aim: 92, reflex: 92, headshot: 90, gamesense: 92, clutch: 92, utility: 90 };

      return `
        <div class="rm-slot-card ${isFocused ? 'focused' : ''} ${this.selectedTeam}" data-slot="${idx}">
          <div class="rm-slot-top-bar">
            <span class="rm-slot-title">${SLOT_TITLES[idx] || `SLOT ${idx + 1}`}</span>
            <span class="rm-slot-tier ${p.tier || 'S'}">${p.tier || 'S'}</span>
          </div>
          <div class="rm-slot-main">
            <div class="rm-slot-avatar ${this.selectedTeam}">
              ${p.name.slice(0, 2).toUpperCase()}
            </div>
            <div class="rm-slot-info">
              <div class="rm-slot-name-row">
                <span class="rm-slot-name">${p.name}</span>
                <span class="rm-slot-rating">⭐ ${Number(p.rating || 1.15).toFixed(2)}</span>
              </div>
              <div class="rm-slot-tags">
                <span class="rm-slot-role-tag">${p.role || 'Rifler'}</span>
                <span class="rm-slot-perk-badge" title="${perkInfo.desc}">${perkInfo.icon} ${perkInfo.name}</span>
              </div>
            </div>
          </div>

          <div class="rm-slot-bars">
            <div class="rm-mini-bar-row">
              <span class="b-lbl">AIM:</span>
              <div class="b-track"><div class="b-fill aim" style="width: ${skills.aim}%;"></div></div>
              <span class="b-num">${skills.aim}</span>
            </div>
            <div class="rm-mini-bar-row">
              <span class="b-lbl">REF:</span>
              <div class="b-track"><div class="b-fill ref" style="width: ${skills.reflex}%;"></div></div>
              <span class="b-num">${skills.reflex}</span>
            </div>
            <div class="rm-mini-bar-row">
              <span class="b-lbl">HS%:</span>
              <div class="b-track"><div class="b-fill hs" style="width: ${skills.headshot || skills.aim}%;"></div></div>
              <span class="b-num">${skills.headshot || skills.aim}</span>
            </div>
            <div class="rm-mini-bar-row">
              <span class="b-lbl">GS:</span>
              <div class="b-track"><div class="b-fill gs" style="width: ${skills.gamesense}%;"></div></div>
              <span class="b-num">${skills.gamesense}</span>
            </div>
            <div class="rm-mini-bar-row">
              <span class="b-lbl">CLU:</span>
              <div class="b-track"><div class="b-fill clu" style="width: ${skills.clutch}%;"></div></div>
              <span class="b-num">${skills.clutch}</span>
            </div>
          </div>

          <button class="rm-btn-slot-select ${isFocused ? 'active' : ''}">
            ${isFocused ? '✓ Bu Slot Seçili (Pazardan Tıklayın)' : '🔄 Bu Slotu Değiştir'}
          </button>
        </div>
      `;
    }).join('');

    // Slot click event
    this.slotsContainer.querySelectorAll('.rm-slot-card').forEach(card => {
      card.addEventListener('click', () => {
        const slotIdx = parseInt(card.getAttribute('data-slot'), 10);
        this.selectSlot(slotIdx);
      });
    });
  }

  renderMarketPool() {
    if (!this.poolGrid) return;

    const fullCatalog = [...this.playerPool, ...this.customPlayers];
    const currentLineup = this.draftRosters[this.selectedTeam] || [];
    const lineupIds = new Set(currentLineup.map(p => p.id || p.name));

    let filtered = fullCatalog.filter(p => {
      // Role filter
      if (this.filterRole !== 'all') {
        const pRole = (p.role || '').toLowerCase();
        const fRole = this.filterRole.toLowerCase();
        if (!pRole.includes(fRole) && !fRole.includes(pRole)) return false;
      }
      // Text search
      if (this.searchQuery) {
        const nameMatch = (p.name || '').toLowerCase().includes(this.searchQuery);
        const tagMatch = (p.tag || '').toLowerCase().includes(this.searchQuery);
        const teamMatch = (p.teamName || '').toLowerCase().includes(this.searchQuery);
        if (!nameMatch && !tagMatch && !teamMatch) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      this.poolGrid.innerHTML = `
        <div class="rm-no-players">
          <p>Kriterlere uygun oyuncu bulunamadı.</p>
        </div>
      `;
      return;
    }

    this.poolGrid.innerHTML = filtered.map(p => {
      const inLineup = lineupIds.has(p.id || p.name);
      const perkInfo = this.perks[p.perk] || { name: 'Standart', icon: '⚡', badge: 'PRO' };
      const skills = p.skills || { aim: 92, reflex: 92, headshot: 90, gamesense: 92, clutch: 92, utility: 90 };

      return `
        <div class="rm-pool-card ${inLineup ? 'in-lineup' : ''}" data-player-id="${p.id || p.name}">
          <div class="rm-pc-header">
            <span class="rm-pc-avatar ${this.selectedTeam}">${p.name.slice(0, 2).toUpperCase()}</span>
            <div class="rm-pc-title-col">
              <div class="rm-pc-name">${p.name} <span class="rm-pc-tier ${p.tier || 'S'}">${p.tier || 'S'}</span></div>
              <div class="rm-pc-sub">${p.teamName || 'Pro'} • ${p.role || 'Rifler'}</div>
            </div>
            <div class="rm-pc-rating">⭐ ${Number(p.rating || 1.15).toFixed(2)}</div>
          </div>

          <div class="rm-pc-perk" title="${perkInfo.desc}">
            ${perkInfo.icon} <strong>${perkInfo.name}</strong>
            <small>${perkInfo.desc}</small>
          </div>

          <div class="rm-pc-stats-row">
            <div class="st-cell"><span class="k">AIM</span><span class="v">${skills.aim}</span></div>
            <div class="st-cell"><span class="k">REF</span><span class="v">${skills.reflex}</span></div>
            <div class="st-cell"><span class="k">HS%</span><span class="v">${skills.headshot || skills.aim}</span></div>
            <div class="st-cell"><span class="k">GS</span><span class="v">${skills.gamesense}</span></div>
            <div class="st-cell"><span class="k">CLU</span><span class="v">${skills.clutch}</span></div>
            <div class="st-cell"><span class="k">UTL</span><span class="v">${skills.utility || 90}</span></div>
          </div>

          <p class="rm-pc-desc">${p.desc || ''}</p>

          <button class="rm-btn-pick ${inLineup ? 'disabled' : ''}" ${inLineup ? 'disabled' : ''}>
            ${inLineup ? '✓ Zaten İlk 5\'te' : `➕ Slot ${this.selectedSlot + 1}'e Al`}
          </button>
        </div>
      `;
    }).join('');

    // Click pick player button
    this.poolGrid.querySelectorAll('.rm-pool-card').forEach(card => {
      const btn = card.querySelector('.rm-btn-pick');
      if (btn && !btn.hasAttribute('disabled')) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const pId = card.getAttribute('data-player-id');
          const playerObj = filtered.find(p => (p.id || p.name) === pId);
          if (playerObj) {
            this.assignPlayerToSlot(playerObj, this.selectedSlot);
          }
        });
      }
    });
  }

  assignPlayerToSlot(player, slotIndex) {
    if (!this.draftRosters[this.selectedTeam]) return;

    // Check if player is already in another slot -> swap!
    const existingIndex = this.draftRosters[this.selectedTeam].findIndex(p => (p.id || p.name) === (player.id || player.name));
    if (existingIndex !== -1 && existingIndex !== slotIndex) {
      // Swap the two slots cleanly
      const temp = this.draftRosters[this.selectedTeam][slotIndex];
      this.draftRosters[this.selectedTeam][slotIndex] = JSON.parse(JSON.stringify(player));
      this.draftRosters[this.selectedTeam][existingIndex] = temp;
    } else {
      this.draftRosters[this.selectedTeam][slotIndex] = JSON.parse(JSON.stringify(player));
    }

    // Auto-advance to next slot
    this.selectedSlot = (slotIndex + 1) % 5;
    this.renderAll();
  }

  applyPreset(presetKey) {
    const preset = this.presets[presetKey];
    if (!preset) return;

    const squad = preset.playerIds.map(id => this.playerPool.find(p => p.id === id)).filter(Boolean);
    if (squad.length === 5) {
      this.draftRosters[this.selectedTeam] = JSON.parse(JSON.stringify(squad));
      this.selectedSlot = 0;
      this.renderAll();
    }
  }

  createCustomPlayer() {
    const name = document.getElementById('cpName')?.value.trim();
    if (!name) {
      alert('Lütfen özel oyuncu için bir isim giriniz.');
      return;
    }

    const role = document.getElementById('cpRole')?.value || 'Entry Fragger';
    const perk = document.getElementById('cpPerk')?.value || 'onetap_god';
    const aim = parseInt(document.getElementById('cpAim')?.value || 95, 10);
    const reflex = parseInt(document.getElementById('cpReflex')?.value || 95, 10);
    const headshot = parseInt(document.getElementById('cpHs')?.value || 96, 10);
    const gamesense = parseInt(document.getElementById('cpGs')?.value || 94, 10);
    const clutch = parseInt(document.getElementById('cpClutch')?.value || 93, 10);
    const utility = parseInt(document.getElementById('cpUtility')?.value || 90, 10);

    const avgSkill = (aim + reflex + headshot + gamesense + clutch) / 5;
    const rating = (1.0 + (avgSkill - 85) * 0.02).toFixed(2);

    const customP = {
      id: `custom_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
      name,
      teamName: 'Kulüp Yıldızı',
      country: 'TR',
      role,
      tag: 'Custom Star',
      rating: Number(rating),
      tier: 'S+',
      perk,
      skills: {
        aim,
        reflex,
        headshot,
        gamesense,
        clutch,
        utility,
        aggression: 88
      },
      desc: 'Kulüp sahibi tarafından bizzat transfer edilip eğitilen özel süperstar.'
    };

    this.customPlayers.unshift(customP);

    // Automatically put in current focused slot
    this.assignPlayerToSlot(customP, this.selectedSlot);

    // Reset input
    document.getElementById('cpName').value = '';
    alert(`⭐ ${name} başarıyla oluşturuldu ve Slot ${this.selectedSlot === 0 ? 5 : this.selectedSlot}'e yerleştirildi!`);
  }

  saveAndApply() {
    const team = this.selectedTeam;
    const rosterToSave = this.draftRosters[team];

    if (!rosterToSave || rosterToSave.length < 5) {
      alert('Kadronuzda 5 oyuncu bulunmalıdır!');
      return;
    }

    // Emit to server
    this.socket.emit('update_team_roster', {
      team,
      roster: rosterToSave
    });

    // Update local cache
    this.rosters[team] = JSON.parse(JSON.stringify(rosterToSave));

    this.closeModal();
  }
}

window.RosterManager = RosterManager;
