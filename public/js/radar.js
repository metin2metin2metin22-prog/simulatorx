// Radar Canvas Rendering Engine for CS:GO Simulator
class RadarRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapImage = new Image();
    this.mapLoaded = false;
    this.mapImage.src = 'assets/de_dust2.png';
    this.mapImage.onload = () => {
      this.mapLoaded = true;
    };

    // Interpolation state
    this.prevPlayers = {};
    this.bulletTracers = [];
    this.particles = [];
    this.pings = [];
  }

  addPing(x, y, label, type = 'danger') {
    this.pings = this.pings || [];
    this.pings.push({
      x,
      y,
      label,
      type,
      createdAt: Date.now(),
      duration: 6000 // 6 seconds prominent tactical alert
    });
  }

  setMap(imageSrc) {
    this.mapLoaded = false;
    this.mapImage.src = imageSrc;
    this.mapImage.onload = () => {
      this.mapLoaded = true;
    };
  }

  render(gameState, localPlayerId) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Map Background
    if (this.mapLoaded) {
      ctx.drawImage(this.mapImage, 0, 0, w, h);
    } else {
      // Fallback blueprint
      this.drawFallbackMap(ctx, w, h);
    }

    if (!gameState) return;

    // 2. Draw Bomb Sites
    this.drawBombSites(ctx, gameState.mapData || DUST2_DATA);

    // 3. Draw Tactical Smokes
    if (gameState.smokes) {
      gameState.smokes.forEach(smoke => this.drawSmoke(ctx, smoke));
    }

    // 4. Draw Grenades / Flashes
    if (gameState.grenades) {
      gameState.grenades.forEach(g => this.drawGrenade(ctx, g));
    }

    // 5. Draw Bomb (Planted or Dropped)
    if (gameState.bomb) {
      this.drawBomb(ctx, gameState.bomb);
    }

    // 6. Draw Bullet Tracers
    this.drawTracers(ctx);

    // 7. Draw Players (Dead players first, then alive)
    if (gameState.players) {
      const players = Object.values(gameState.players);

      // Dead player marks (X)
      players.filter(p => !p.alive).forEach(p => this.drawDeadPlayer(ctx, p));

      // Alive players
      players.filter(p => p.alive).forEach(p => {
        const isSelf = p.id === localPlayerId;
        this.drawAlivePlayer(ctx, p, isSelf);
      });
    }

    // 8. Draw Floating Damage / Effects
    this.drawParticles(ctx);

    // 9. Draw Tactical Radar Pings (Bomb Spotted / Rush Alert)
    this.drawPings(ctx);
  }

  drawPings(ctx) {
    if (!this.pings || this.pings.length === 0) return;
    const now = Date.now();
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i];
      const elapsed = now - p.createdAt;
      if (elapsed > p.duration) {
        this.pings.splice(i, 1);
        continue;
      }

      const progress = (elapsed % 1200) / 1200;
      const fade = Math.max(0, 1 - (elapsed / p.duration));
      const radius = 10 + progress * 40;
      const isDanger = p.type === 'danger';
      const color = isDanger ? '235, 77, 75' : '241, 196, 15';

      ctx.save();
      // Outer pulsating tactical beacon
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${color}, ${(1 - progress) * fade * 0.9})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Middle halo
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color}, ${fade * 0.25})`;
      ctx.fill();

      // Core ping pin
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${color})`;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label badge above
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(p.label, p.x, p.y - 14);
      ctx.restore();
    }
  }

  drawBombSites(ctx, mapData) {
    if (!mapData || !mapData.sites) return;
    const time = Date.now() / 1000;

    ['A', 'B'].forEach(siteKey => {
      const site = mapData.sites[siteKey];
      if (!site) return;

      // Outer dashed circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(site.x, site.y, site.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(235, 94, 40, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      // Pulsing inner aura
      const pulse = Math.sin(time * 2 + (siteKey === 'B' ? 1.5 : 0)) * 0.15 + 0.2;
      ctx.beginPath();
      ctx.arc(site.x, site.y, site.radius * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(235, 94, 40, ${pulse})`;
      ctx.fill();

      // Letter indicator
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(siteKey, site.x, site.y);
      ctx.restore();
    });
  }

  drawSmoke(ctx, smoke) {
    ctx.save();
    const alpha = Math.min(1, smoke.remainingTime / 2);
    const grad = ctx.createRadialGradient(smoke.x, smoke.y, 10, smoke.x, smoke.y, smoke.radius);
    grad.addColorStop(0, `rgba(210, 215, 220, ${0.85 * alpha})`);
    grad.addColorStop(0.7, `rgba(160, 168, 175, ${0.7 * alpha})`);
    grad.addColorStop(1, 'rgba(120, 130, 140, 0)');

    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle swirling particles
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 190, 200, ${0.3 * alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  drawGrenade(ctx, g) {
    ctx.save();
    if (g.type === 'flash') {
      if (g.detonated) {
        // Shockwave
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.detonateProgress * 70, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - g.detonateProgress})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        // Flying flashbang
        ctx.beginPath();
        ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (g.type === 'he') {
      if (g.detonated) {
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.detonateProgress * 80, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 80, 20, ${0.6 * (1 - g.detonateProgress)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawBomb(ctx, bomb) {
    ctx.save();
    const time = Date.now() / 1000;

    if (bomb.planted) {
      // Planted bomb
      const beepFreq = Math.max(1, 8 - (bomb.timer / 40) * 7);
      const isBeepFlash = Math.sin(time * beepFreq * Math.PI * 2) > 0.4;

      // Pulsing blast warning rings
      ctx.beginPath();
      const ringRadius = 20 + ((time * 30) % 35);
      ctx.arc(bomb.x, bomb.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // C4 Box
      ctx.fillStyle = isBeepFlash ? '#ff0000' : '#8e1b1b';
      ctx.fillRect(bomb.x - 9, bomb.y - 7, 18, 14);

      ctx.fillStyle = '#111111';
      ctx.fillRect(bomb.x - 7, bomb.y - 4, 14, 8);

      // Blinking LED
      ctx.beginPath();
      ctx.arc(bomb.x + 3, bomb.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isBeepFlash ? '#00ff00' : '#ff0000';
      ctx.fill();

      // Timer text
      ctx.fillStyle = '#ff3838';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(bomb.timer)}s`, bomb.x, bomb.y - 12);

      // Defuse progress
      if (bomb.defusing) {
        const progress = bomb.defuseProgress || 0;
        ctx.beginPath();
        ctx.arc(bomb.x, bomb.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 11px Arial';
        ctx.fillText('DEFUSING', bomb.x, bomb.y + 24);
      }
    } else if (bomb.dropped && !bomb.carried) {
      // Prominent Dropped C4 on ground with pulsing beacon & alert ring
      const pulse = Math.sin(time * 5) * 0.4 + 0.6;
      const beaconRadius = 16 + ((time * 24) % 20);

      // Warning ring
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y, beaconRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 140, 0, ${pulse * 0.8})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // C4 Box
      ctx.fillStyle = '#ff7700';
      ctx.fillRect(bomb.x - 12, bomb.y - 8, 24, 16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(bomb.x - 12, bomb.y - 8, 24, 16);

      // Black digital timer panel
      ctx.fillStyle = '#111111';
      ctx.fillRect(bomb.x - 9, bomb.y - 5, 18, 10);

      ctx.fillStyle = '#ffea00';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C4', bomb.x, bomb.y);

      // Label above
      ctx.fillStyle = '#ff9900';
      ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText('💣 DÜŞEN BOMBA', bomb.x, bomb.y - 14);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  drawDeadPlayer(ctx, player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    const color = player.team === 'ct' ? 'rgba(74, 144, 226, 0.45)' : 'rgba(230, 126, 34, 0.45)';

    // Skull / cross mark
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    const r = 7;
    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(r, r);
    ctx.moveTo(r, -r);
    ctx.lineTo(-r, r);
    ctx.stroke();

    ctx.restore();
  }

  drawAlivePlayer(ctx, player, isSelf) {
    ctx.save();
    ctx.translate(player.x, player.y);

    const isCT = player.team === 'ct';
    const baseColor = isCT ? '#1e90ff' : '#f39c12';
    const darkColor = isCT ? '#003366' : '#7e3e00';

    // 1. Vision Cone
    const fov = 1.3; // radians (~75 degrees)
    const coneDist = player.weapon === 'awp' ? 140 : 100;
    const coneGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, coneDist);
    if (player.flashDuration > 0) {
      // Blinded cone
      coneGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      coneGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
      coneGrad.addColorStop(0, isCT ? 'rgba(30, 144, 255, 0.28)' : 'rgba(243, 156, 18, 0.28)');
      coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }

    ctx.save();
    ctx.rotate(player.angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneDist, -fov / 2, fov / 2);
    ctx.closePath();
    ctx.fillStyle = coneGrad;
    ctx.fill();

    // Direction line pointer
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16, 0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 2. Self Ring Highlight
    if (isSelf) {
      const time = Date.now() / 300;
      ctx.beginPath();
      ctx.arc(0, 0, 18 + Math.sin(time) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#00ffcc';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', 0, -22);
    }

    // 3. Planting / Defusing radial indicator
    if (player.state === 'planting') {
      const pProg = player.plantProgress || 0;
      ctx.beginPath();
      ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pProg);
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('KURUYOR...', 0, -22);
    } else if (player.state === 'defusing') {
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.fillStyle = '#3498db';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ÇÖZÜYOR...', 0, -22);
    }

    // 4. Main Player Dot Body
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 5. HP Ring around dot
    const hpPercent = Math.max(0, player.hp / 100);
    ctx.beginPath();
    ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPercent);
    ctx.strokeStyle = hpPercent > 0.5 ? '#2ecc71' : (hpPercent > 0.25 ? '#f1c40f' : '#e74c3c');
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 6. Number inside player dot
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 3;
    ctx.fillText(player.slot + 1, 0, 0);
    ctx.shadowBlur = 0;

    // 7. Badges (C4 Carrier / Defuse Kit)
    if (player.hasBomb) {
      const time = Date.now() / 200;
      const pulse = 16 + Math.sin(time) * 3;

      // Glowing C4 carrier ring
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // C4 backpack badge
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(9, -14, 15, 11);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(9, -14, 15, 11);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C4', 16, -8);
    }
    if (player.hasKit) {
      ctx.fillStyle = '#3498db';
      ctx.fillRect(-15, -12, 7, 7);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-15, -12, 7, 7);
    }

    // 8. Name Tag & Weapon Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    const tag = player.hasBomb ? `💣 ${player.name} [C4]` : player.name;
    ctx.fillText(tag, 0, 20);

    ctx.fillStyle = '#bdc3c7';
    ctx.font = '9px Arial';
    ctx.fillText(`${(player.weapon || 'pistol').toUpperCase()}`, 0, 30);

    // 9. Blinded indicator
    if (player.flashDuration > 0) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('* *', 0, -12);
    }

    ctx.restore();
  }

  addTracer(fromX, fromY, toX, toY, weapon, isHit, isHeadshot) {
    this.bulletTracers.push({
      fromX,
      fromY,
      toX,
      toY,
      weapon,
      isHit,
      isHeadshot,
      alpha: 1.0,
      createdAt: Date.now()
    });

    if (isHit) {
      this.particles.push({
        x: toX,
        y: toY,
        text: isHeadshot ? 'HS!' : '-DMG',
        color: isHeadshot ? '#e74c3c' : '#f39c12',
        alpha: 1.0,
        dy: -1.2
      });
    }
  }

  drawTracers(ctx) {
    const now = Date.now();
    for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
      const t = this.bulletTracers[i];
      const elapsed = (now - t.createdAt) / 1000;
      t.alpha = Math.max(0, 1 - elapsed / 0.25);

      if (t.alpha <= 0) {
        this.bulletTracers.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(t.fromX, t.fromY);
      ctx.lineTo(t.toX, t.toY);

      if (t.weapon === 'awp') {
        ctx.strokeStyle = `rgba(255, 230, 100, ${t.alpha})`;
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = `rgba(255, 240, 180, ${t.alpha * 0.8})`;
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();

      // Muzzle flash star
      ctx.beginPath();
      ctx.arc(t.fromX, t.fromY, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 200, ${t.alpha})`;
      ctx.fill();

      ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.y += p.dy;
      p.alpha -= 0.03;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  drawFallbackMap(ctx, w, h) {
    // Grid background
    ctx.fillStyle = '#10161d';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1b2430';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Callout boxes
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px "Segoe UI", Arial';
    ctx.fillText('CS:GO Radar Tactical Grid (de_dust2)', 20, 30);
  }
}

window.RadarRenderer = RadarRenderer;
