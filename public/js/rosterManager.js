// SimulatorX - Single Club Owner & Squad Manager Controller
// Allows user to manage their single esports club, customize first 5 roster, scout prospects, and trade players.

class RosterManager {
  constructor() {
    this.socket = null;
    this.userClub = {
      id: 'user_club',
      name: 'Anadolu Wolves',
      icon: '🐺',
      budget: 50000,
      roster: []
    };
    this.draftRoster = [];
    this.playerPool = [];
    this.perks = {};
    this.presets = {};
    this.selectedSlot = 0;
    this.filterRole = 'all';
    this.searchQuery = '';
    this.customPlayers = [];
    this.currentProspect = null;

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
    if (btnOpenRadar) btnOpenRadar.addEventListener('click', () => this.openModal());

    const btnOpenSide = document.getElementById('btnOpenRosterManagerSide');
    if (btnOpenSide) btnOpenSide.addEventListener('click', () => this.openModal());

    const btnOpenLeft = document.getElementById('btnOpenRosterManagerLeft');
    if (btnOpenLeft) btnOpenLeft.addEventListener('click', () => this.openModal());

    // Close Modal Button
    const btnClose = document.getElementById('btnCloseRosterManager');
    if (btnClose) btnClose.addEventListener('click', () => this.closeModal());

    const btnCancel = document.getElementById('btnCancelRoster');
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeModal());

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

    // Scout Prospect Button
    const btnScout = document.getElementById('btnScoutProspect');
    if (btnScout) {
      btnScout.addEventListener('click', () => this.openScoutProspect());
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
      if (data.userClub) {
        this.userClub = JSON.parse(JSON.stringify(data.userClub));
        this.draftRoster = JSON.parse(JSON.stringify(this.userClub.roster || []));
        this.updateSideClubUI();
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

    this.socket.on('league_data', (data) => {
      if (data && data.userClub) {
        this.userClub = JSON.parse(JSON.stringify(data.userClub));
        this.updateSideClubUI();
      }
    });
  }

  updateSideClubUI() {
    const sideName = document.getElementById('sideClubName');
    const sideIcon = document.getElementById('sideClubIcon');
    const badgeIcon = document.getElementById('rmClubIconBadge');
    const budgetVal = document.getElementById('rmClubBudgetValue');
    const nameInput = document.getElementById('rmClubNameInput');

    if (sideName && this.userClub.name) sideName.innerText = this.userClub.name;
    if (sideIcon && this.userClub.icon) sideIcon.innerText = this.userClub.icon;
    if (badgeIcon && this.userClub.icon) badgeIcon.innerText = this.userClub.icon;
    if (nameInput && this.userClub.name) nameInput.value = this.userClub.name;
    if (budgetVal) budgetVal.innerText = `$${(this.userClub.budget || 50000).toLocaleString()}`;
  }

  openModal() {
    if (!this.modal) return;
    this.selectedSlot = 0;
    this.draftRoster = JSON.parse(JSON.stringify(this.userClub.roster || []));
    this.updateSideClubUI();
    this.modal.style.display = 'flex';
    this.renderAll();
  }

  closeModal() {
    if (this.modal) this.modal.style.display = 'none';
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
    const squad = this.draftRoster || [];
    if (squad.length === 0) return;

    const len = squad.length;
    const avgRating = (squad.reduce((s, p) => s + (p.rating || 1.15), 0) / len).toFixed(2);
    const avgAim = Math.round(squad.reduce((s, p) => s + (p.skills?.aim || 92), 0) / len);
    const avgReflex = Math.round(squad.reduce((s, p) => s + (p.skills?.reflex || 92), 0) / len);
    const avgHS = Math.round(squad.reduce((s, p) => s + (p.skills?.headshot || p.skills?.aim || 90), 0) / len);
    const avgGS = Math.round(squad.reduce((s, p) => s + (p.skills?.gamesense || 92), 0) / len);
    const avgClutch = Math.round(squad.reduce((s, p) => s + (p.skills?.clutch || 92), 0) / len);
    const avgUtility = Math.round(squad.reduce((s, p) => s + (p.skills?.utility || 90), 0) / len);

    this.squadSummary.innerHTML = `
      <div class="rm-sum-team-title">${this.userClub.icon} ${this.userClub.name.toUpperCase()} SİNERJİ & KADRO GÜCÜ</div>
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
    const squad = this.draftRoster || [];
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
        <div class="rm-slot-card ${isFocused ? 'focused' : ''} user" data-slot="${idx}">
          <div class="rm-slot-top-bar">
            <span class="rm-slot-title">${SLOT_TITLES[idx] || `SLOT ${idx + 1}`}</span>
            <span class="rm-slot-tier ${p.tier || 'S'}">${p.tier || 'S'}</span>
          </div>
          <div class="rm-slot-main">
            <div class="rm-slot-avatar user">
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
    const currentLineup = this.draftRoster || [];
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
            <span class="rm-pc-avatar user">${p.name.slice(0, 2).toUpperCase()}</span>
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
    if (!this.draftRoster) return;

    // Check if player is already in another slot -> swap!
    const existingIndex = this.draftRoster.findIndex(p => (p.id || p.name) === (player.id || player.name));
    if (existingIndex !== -1 && existingIndex !== slotIndex) {
      const temp = this.draftRoster[slotIndex];
      this.draftRoster[slotIndex] = JSON.parse(JSON.stringify(player));
      this.draftRoster[existingIndex] = temp;
    } else {
      this.draftRoster[slotIndex] = JSON.parse(JSON.stringify(player));
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
      this.draftRoster = JSON.parse(JSON.stringify(squad));
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
    const aim = parseInt(document.getElementById('cpAim')?.value || 60, 10);
    const reflex = parseInt(document.getElementById('cpReflex')?.value || 60, 10);
    const headshot = parseInt(document.getElementById('cpHs')?.value || 55, 10);
    const gamesense = parseInt(document.getElementById('cpGs')?.value || 55, 10);
    const clutch = parseInt(document.getElementById('cpClutch')?.value || 50, 10);
    const utility = parseInt(document.getElementById('cpUtility')?.value || 50, 10);

    const avgSkill = (aim + reflex + headshot + gamesense + clutch) / 5;
    const rating = (0.70 + (avgSkill - 45) * 0.012).toFixed(2);
    let tier = 'Çaylak';
    if (avgSkill >= 92) tier = 'Tier 1 Efsane';
    else if (avgSkill >= 78) tier = 'Tier 2 Pro';
    else if (avgSkill >= 60) tier = 'Genç Yetenek';

    const customP = {
      id: `custom_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
      name,
      teamName: this.userClub.name,
      country: 'TR',
      role,
      tag: 'Özel Kart',
      rating: Number(rating),
      tier,
      price: Math.round(5000 + Math.pow(avgSkill / 10, 3) * 60),
      perk,
      skills: {
        aim,
        reflex,
        headshot,
        gamesense,
        clutch,
        utility,
        aggression: 75
      },
      desc: 'Kulüp sahibi tarafından kulübe kazandırılan özel yetenek.'
    };

    this.customPlayers.unshift(customP);
    this.playerPool.unshift(customP);

    // Automatically put in current focused slot
    this.assignPlayerToSlot(customP, this.selectedSlot);
    this.renderMarketPool();

    // Reset Form
    document.getElementById('cpName').value = '';
    const customForm = document.getElementById('rmCustomForm');
    const btnToggleCustom = document.getElementById('btnToggleCustomPlayer');
    if (customForm) customForm.style.display = 'none';
    if (btnToggleCustom) btnToggleCustom.innerText = '+ Özel Oyuncu Kartı Oluştur';
  }

  openScoutProspect() {
    const container = document.getElementById('rmScoutCard');
    if (!container) return;

    const PROSPECT_NAMES = [
      'Arda "ardx" Yılmaz', 'Kerem "krm" Demir', 'Efe "v0rtex" Kaya', 'Mert "blade" Çelik',
      'Emir "hyper" Şahin', 'Baran "ghost" Öztürk', 'Lukas "lucas" Novak', 'Mateo "pulse" Silva'
    ];
    const COUNTRIES = ['TR', 'TR', 'TR', 'DE', 'SE', 'DK', 'UA', 'PL'];
    const ROLES = ['Entry Fragger', 'AWPer', 'Lurker', 'Site Anchor', 'In-Game Leader (IGL)'];
    const PERKS = ['raw_talent', 'rookie_nervous', 'onetap_god', 'flick_king', 'ice_clutch'];

    const rndIdx = Math.floor(Math.random() * PROSPECT_NAMES.length);
    const chosenName = PROSPECT_NAMES[rndIdx];
    const chosenCountry = COUNTRIES[rndIdx];
    const chosenRole = ROLES[Math.floor(Math.random() * ROLES.length)];
    const chosenPerk = PERKS[Math.floor(Math.random() * PERKS.length)];

    // Raw rookie skills: 45 to 75
    const baseSkill = 48 + Math.floor(Math.random() * 26);
    const aim = Math.min(85, baseSkill + Math.floor(Math.random() * 12) - 4);
    const reflex = Math.min(85, baseSkill + Math.floor(Math.random() * 12) - 4);
    const headshot = Math.min(85, baseSkill + Math.floor(Math.random() * 10) - 5);
    const gamesense = Math.min(85, baseSkill + Math.floor(Math.random() * 8) - 4);
    const clutch = Math.min(85, baseSkill + Math.floor(Math.random() * 12) - 6);
    const utility = Math.min(85, baseSkill + Math.floor(Math.random() * 8) - 4);

    const avgSkill = (aim + reflex + headshot + gamesense + clutch) / 5;
    const rating = (0.75 + (avgSkill - 50) * 0.012).toFixed(2);
    const price = Math.round(1500 + Math.pow(avgSkill / 10, 3) * 35);

    const prospect = {
      id: `prospect_${Date.now()}`,
      name: chosenName,
      country: chosenCountry,
      age: 16 + Math.floor(Math.random() * 4),
      role: chosenRole,
      tier: 'Genç Yetenek',
      tag: 'Scout Keşfi',
      rating: Number(rating),
      price,
      perk: chosenPerk,
      skills: {
        aim,
        reflex,
        headshot,
        gamesense,
        clutch,
        utility,
        aggression: 70
      },
      desc: 'Scout ekibinin yerel turnuvalarda keşfettiği yüksek potansiyelli genç yetenek.'
    };

    this.currentProspect = prospect;
    const perkDef = this.perks[prospect.perk] || { name: prospect.perk, icon: '⭐', desc: '' };

    container.innerHTML = `
      <div class="rm-scout-top">
        <div>
          <div class="rm-scout-badge-prospect">🔍 SCOUT RAPORU: GELECEĞİN YILDIZI (${prospect.age} Yaşında)</div>
          <div class="rm-scout-name">${prospect.name} [${prospect.country}]</div>
          <div class="rm-scout-sub">${prospect.role} • Potansiyel: A+ Sınırsız • Bonservis / Maaş: $${prospect.price.toLocaleString()}</div>
        </div>
        <div class="rm-metric-chip rating">
          <span class="m-label">SCOUT REYTİNG</span>
          <span class="m-val">${prospect.rating}</span>
        </div>
      </div>

      <div class="rm-scout-stats-grid">
        <div class="st-cell"><span class="k">AIM</span><span class="v">${prospect.skills.aim}</span></div>
        <div class="st-cell"><span class="k">REFLX</span><span class="v">${prospect.skills.reflex}</span></div>
        <div class="st-cell"><span class="k">HS%</span><span class="v">${prospect.skills.headshot}%</span></div>
        <div class="st-cell"><span class="k">G.SENSE</span><span class="v">${prospect.skills.gamesense}</span></div>
        <div class="st-cell"><span class="k">CLUTCH</span><span class="v">${prospect.skills.clutch}</span></div>
        <div class="st-cell"><span class="k">UTILITY</span><span class="v">${prospect.skills.utility}</span></div>
      </div>

      <div class="rm-scout-report-text">
        <strong>${perkDef.icon} İmzalı Pasif: ${perkDef.name}</strong><br>
        ${prospect.desc}
      </div>

      <div class="rm-scout-actions">
        <button class="btn btn-scout-reroll" id="btnScoutReroll">🔄 Başka Yetenek Keşfet</button>
        <button class="btn btn-scout-close" id="btnScoutClose">✕ Kapat</button>
        <button class="btn btn-scout-sign" id="btnScoutSign">✍️ Kulübe Kazandır & Slota Al ($${prospect.price.toLocaleString()})</button>
      </div>
    `;

    container.style.display = 'block';

    document.getElementById('btnScoutReroll')?.addEventListener('click', () => this.openScoutProspect());
    document.getElementById('btnScoutClose')?.addEventListener('click', () => { container.style.display = 'none'; });
    document.getElementById('btnScoutSign')?.addEventListener('click', () => {
      this.signProspect(this.currentProspect);
      container.style.display = 'none';
    });
  }

  signProspect(prospect) {
    if (!prospect) return;
    this.customPlayers.unshift(prospect);
    this.playerPool.unshift(prospect);
    this.assignPlayerToSlot(prospect, this.selectedSlot);
    this.renderMarketPool();
  }

  saveAndApply() {
    if (!this.draftRoster || this.draftRoster.length < 5) {
      alert('Kadronuzda 5 oyuncu bulunmalıdır!');
      return;
    }

    const nameInput = document.getElementById('rmClubNameInput');
    if (nameInput && nameInput.value.trim()) {
      this.userClub.name = nameInput.value.trim();
    }

    this.userClub.roster = JSON.parse(JSON.stringify(this.draftRoster));

    // Emit to server
    this.socket.emit('update_user_club', {
      name: this.userClub.name,
      icon: this.userClub.icon,
      roster: this.userClub.roster
    });

    this.updateSideClubUI();
    this.closeModal();
  }
}

window.RosterManager = RosterManager;
