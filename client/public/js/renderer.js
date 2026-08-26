/**
 * HTML5 2D Canvas Game Renderer for Left 730 Dead
 * High-performance, pixel-crisp stream overlay viewport with Dusk-to-Dawn lighting,
 * procedural particle effects, blood splatters, screen shake, bullet tracers, and visual juice.
 */

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = null;
    this.tileSize = 40; // 20x20 tiles = 800x800px base
    
    // Effects & Particles
    this.slashEffects = [];
    this.floaties = [];
    this.tracers = [];
    this.muzzleFlashes = [];
    this.particles = []; // Blood & Wood splinters
    this.bloodDecals = []; // Persistent floor stains (capped)
    
    // Screen Shake
    this.shakeIntensity = 0;
    this.shakeDecay = 0.90;

    this.setupCanvasSize();
    window.addEventListener('resize', () => this.setupCanvasSize());
  }

  setupCanvasSize() {
    this.canvas.width = 800;
    this.canvas.height = 800;
    this.tileSize = this.canvas.width / 20;
  }

  setMap(mapData) {
    this.map = mapData;
  }

  triggerScreenShake(amount = 6) {
    this.shakeIntensity = Math.min(24, Math.max(this.shakeIntensity, amount));
  }

  processCombatEvents(events) {
    if (!events || !events.length) return;

    for (const evt of events) {
      if (evt.type === 'DAMAGE') {
        const isCrit = evt.damage >= 25;
        this.addDamageFloaty(evt.x, evt.y, evt.damage, isCrit ? '#fbbf24' : '#ef4444', isCrit);
        this.addSlashEffect(evt.x, evt.y, isCrit ? '#fbbf24' : '#f87171');
        this.addBloodSplatter(evt.x, evt.y, isCrit ? 10 : 5);

        // Add tracer & muzzle flash if attacker position is known
        if (evt.sourceX !== undefined && evt.sourceY !== undefined) {
          this.addTracer(evt.sourceX, evt.sourceY, evt.x, evt.y, evt.attackerRole);
          this.addMuzzleFlash(evt.sourceX, evt.sourceY, evt.x, evt.y);
        }
      } else if (evt.type === 'KILL') {
        this.addDamageFloaty(evt.x, evt.y, `+${evt.xp} XP`, '#c084fc', true);
        this.addBloodSplatter(evt.x, evt.y, 16);
        this.triggerScreenShake(evt.targetType === 'brute' ? 8 : 3);
      } else if (evt.type === 'HEAL') {
        this.addDamageFloaty(evt.x, evt.y, `+${evt.amount} HP`, '#22c55e', false);
      } else if (evt.type === 'REPAIR') {
        this.addSlashEffect(evt.x, evt.y, '#60a5fa');
        this.addWoodSplinters(evt.x, evt.y, 3, '#93c5fd');
      } else if (evt.type === 'BARRICADE_HIT') {
        this.addDamageFloaty(evt.x, evt.y, `-${evt.damage}`, '#f97316');
        this.addWoodSplinters(evt.x, evt.y, evt.breached ? 20 : 6);
        if (evt.breached) {
          this.triggerScreenShake(14);
        } else {
          this.triggerScreenShake(2.5);
        }
      } else if (evt.type === 'SURVIVOR_HIT') {
        this.addDamageFloaty(evt.x, evt.y, `-${evt.damage}`, '#ef4444', true);
        this.triggerScreenShake(6);
        this.addBloodSplatter(evt.x, evt.y, 8);
      }
    }
  }

  addDamageFloaty(x, y, text, color = '#ffffff', isCrit = false) {
    const ts = this.tileSize;
    this.floaties.push({
      x: x * ts + (Math.random() * 14 - 7),
      y: y * ts - 8,
      text: String(text),
      color: color,
      isCrit: isCrit,
      vy: isCrit ? -1.2 : -0.85,
      life: 1.0
    });
  }

  addSlashEffect(x, y, color = '#f87171') {
    const ts = this.tileSize;
    this.slashEffects.push({
      x: x * ts,
      y: y * ts,
      color: color,
      life: 1.0
    });
  }

  addTracer(sx, sy, tx, ty, role = 'SURVIVOR') {
    const ts = this.tileSize;
    let color = '#fef08a'; // Yellow pistol
    let width = 1.5;
    if (role === 'SLAYER') {
      color = '#f97316'; // Orange shotgun
      width = 2.5;
    } else if (role === 'SENTINEL') {
      color = '#38bdf8'; // Blue rifle
      width = 2.0;
    }

    this.tracers.push({
      x1: sx * ts,
      y1: sy * ts,
      x2: tx * ts,
      y2: ty * ts,
      color: color,
      width: width,
      life: 1.0
    });
  }

  addMuzzleFlash(sx, sy, tx, ty) {
    const ts = this.tileSize;
    const angle = Math.atan2(ty - sy, tx - sx);
    this.muzzleFlashes.push({
      x: sx * ts,
      y: sy * ts,
      angle: angle,
      life: 1.0
    });
  }

  addBloodSplatter(x, y, count = 8) {
    const ts = this.tileSize;
    const px = x * ts;
    const py = y * ts;

    // Add flying particles
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.5;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() < 0.3 ? '#991b1b' : '#dc2626',
        life: 1.0,
        decay: 0.04 + Math.random() * 0.04
      });
    }

    // Add semi-permanent floor blood decal
    if (this.bloodDecals.length > 120) {
      this.bloodDecals.shift();
    }
    this.bloodDecals.push({
      x: px + (Math.random() * 12 - 6),
      y: py + (Math.random() * 12 - 6),
      radius: 3 + Math.random() * 5,
      color: Math.random() < 0.4 ? 'rgba(153, 27, 27, 0.45)' : 'rgba(185, 28, 28, 0.4)',
      alpha: 1.0
    });
  }

  addWoodSplinters(x, y, count = 6, color = '#b45309') {
    const ts = this.tileSize;
    const px = x * ts;
    const py = y * ts;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.0;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.0 + Math.random() * 3.0,
        color: color,
        isWood: true,
        life: 1.0,
        decay: 0.05 + Math.random() * 0.05
      });
    }
  }

  render(snapshot) {
    if (!snapshot || !this.map) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const ts = this.tileSize;
    const now = Date.now();

    this.ctx.save();

    // 0. Apply Screen Shake
    if (this.shakeIntensity > 0.1) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(shakeX, shakeY);
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
    }

    // 1. Draw Map & Rooms
    this.renderMap(this.ctx, ts, snapshot);

    // 2. Draw Blood Decals on Floor
    this.renderBloodDecals(this.ctx);

    // 3. Draw Barricades
    this.renderBarricades(this.ctx, snapshot.barricades, ts);

    // 4. Draw Loot Drops
    this.renderLoot(this.ctx, snapshot.loot, ts, now);

    // 5. Draw Zombies
    this.renderZombies(this.ctx, snapshot.zombies, ts);

    // 6. Draw Survivors
    this.renderSurvivors(this.ctx, snapshot.survivors, ts, now);

    // 7. Draw Visual FX, Tracers, Particles & Floaties
    this.renderEffects(this.ctx);

    this.ctx.restore();

    // 8. Draw Overlays (Victory / Game Over / Intermission - not shaken)
    this.renderOverlays(this.ctx, snapshot);
  }

  renderMap(ctx, ts, snapshot) {
    // Outside Ground: Dynamic ambient lighting based on in-game time
    let bgFill = '#0a0f1d'; // Midnight deep blue
    if (snapshot?.isDawn || snapshot?.waveState === 'VICTORY') {
      bgFill = '#292524'; // Warm dawn twilight
    } else if (snapshot?.wave <= 3) {
      bgFill = '#1e1b4b'; // Dusk purple
    }

    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Outside grid dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        if (this.map.grid[y][x] === 0) {
          ctx.beginPath();
          ctx.arc((x + 0.5) * ts, (y + 0.5) * ts, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Safehouse Interior Floor (Solid Dark Wood)
    ctx.fillStyle = '#1c2433';
    ctx.fillRect(4 * ts, 4 * ts, 12 * ts, 12 * ts);

    // Wooden plank lines inside house
    ctx.strokeStyle = '#273449';
    ctx.lineWidth = 1;
    for (let y = 4; y <= 15; y++) {
      ctx.beginPath();
      ctx.moveTo(4 * ts, y * ts);
      ctx.lineTo(16 * ts, y * ts);
      ctx.stroke();
    }

    // Room Label Overlays
    if (this.map.rooms) {
      ctx.font = '700 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';

      for (const key of Object.keys(this.map.rooms)) {
        const r = this.map.rooms[key];
        ctx.fillText(r.name.toUpperCase(), (r.x + 0.5) * ts, (r.y + 0.5) * ts);
      }
    }

    // Draw Walls from Map Grid
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.grid[y][x];
        if (tile === 2) { // WALL
          ctx.fillStyle = '#334155';
          ctx.fillRect(x * ts, y * ts, ts, ts);

          // Top highlight bevel
          ctx.fillStyle = '#475569';
          ctx.fillRect(x * ts, y * ts, ts, 4);

          // Dark wall border
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x * ts, y * ts, ts, ts);
        }
      }
    }
  }

  renderBloodDecals(ctx) {
    for (let i = this.bloodDecals.length - 1; i >= 0; i--) {
      const d = this.bloodDecals[i];
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
    }
  }

  renderBarricades(ctx, barricades, ts) {
    if (!barricades) return;

    for (const b of barricades) {
      const bx = b.x * ts;
      const by = b.y * ts;
      const hpRatio = b.hp / b.maxHp;

      if (b.isBreached) {
        // Breached Barricade (Red flashing broken frame)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(bx + 4, by + 4, ts - 8, ts - 8);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(bx + 2, by + 2, ts - 4, ts - 4);
        ctx.setLineDash([]);

        // Breached text
        ctx.font = '800 10px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'center';
        ctx.fillText('BREACH', bx + ts / 2, by + ts / 2 + 4);
      } else {
        // Intact / Damaged Barricade
        const isDoor = b.type === 'door';
        ctx.fillStyle = isDoor ? '#854d0e' : '#1e3a8a';
        ctx.fillRect(bx + 3, by + 3, ts - 6, ts - 6);

        // Fortification Planks Pattern
        ctx.strokeStyle = isDoor ? '#ca8a04' : '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 3, by + 3, ts - 6, ts - 6);

        // Internal cross planks
        ctx.beginPath();
        ctx.moveTo(bx + 6, by + 6);
        ctx.lineTo(bx + ts - 6, by + ts - 6);
        ctx.moveTo(bx + ts - 6, by + 6);
        ctx.lineTo(bx + 6, by + ts - 6);
        ctx.stroke();

        // Visual damage cracks if low HP
        if (hpRatio < 0.6) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx + ts * 0.3, by + ts * 0.2);
          ctx.lineTo(bx + ts * 0.5, by + ts * 0.5);
          ctx.lineTo(bx + ts * 0.4, by + ts * 0.8);
          ctx.stroke();
        }

        // Repairing Sparkle Badge
        if (b.repairerCount > 0) {
          ctx.font = '12px sans-serif';
          ctx.fillText('🔨', bx + ts / 2, by + ts / 2 + 5);
        }
      }

      // Barricade Health Bar
      const barW = ts + 8;
      const barH = 5;
      const barX = bx - 4;
      const barY = by - 7;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX, barY, barW, barH);

      ctx.fillStyle = hpRatio > 0.6 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }
  }

  renderLoot(ctx, loot, ts, now) {
    if (!loot) return;

    for (const item of loot) {
      const lx = item.x * ts;
      const ly = item.y * ts + Math.sin(now / 200) * 3;

      // Pulse Glow circle
      ctx.beginPath();
      ctx.arc(lx, ly, 12 + Math.sin(now / 150) * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.fill();

      // Health pack box
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(lx - 8, ly - 8, 16, 16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx - 8, ly - 8, 16, 16);

      // White cross
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx - 5, ly - 2, 10, 4);
      ctx.fillRect(lx - 2, ly - 5, 4, 10);
    }
  }

  renderZombies(ctx, zombies, ts) {
    if (!zombies) return;

    for (const z of zombies) {
      const zx = z.x * ts;
      const zy = z.y * ts;
      const size = (z.size || 0.8) * ts;
      const offset = -size / 2;

      // Zombie Body
      ctx.fillStyle = z.color || '#ef4444';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
      ctx.shadowBlur = 8;
      ctx.fillRect(zx + offset, zy + offset, size, size);
      ctx.shadowBlur = 0;

      // Outline
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(zx + offset, zy + offset, size, size);

      // Glowing Eyes
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(zx + offset + 4, zy + offset + 5, 3, 3);
      ctx.fillRect(zx + offset + size - 7, zy + offset + 5, 3, 3);

      // Health Bar
      const hpRatio = z.hp / z.maxHp;
      const barW = size;
      const barH = 4;
      const barX = zx + offset;
      const barY = zy + offset - 6;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }
  }

  renderSurvivors(ctx, survivors, ts, now) {
    if (!survivors) return;

    for (const s of survivors) {
      const sx = s.x * ts;
      const sy = s.y * ts;
      const size = 0.85 * ts;
      const offset = -size / 2;

      if (!s.isAlive) {
        // Downed survivor
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx + offset, sy + offset, size, size);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx + offset, sy + offset, size, size);
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💀', sx, sy + 4);

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.fillText('DOWNED', sx, sy - 6);
        continue;
      }

      // Low health warning aura pulse
      const hpRatio = s.hp / s.maxHp;
      if (hpRatio <= 0.3) {
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.85 + Math.sin(now / 100) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Survivor Body (Colored Square with rounded edges)
      ctx.fillStyle = s.color || '#22c55e';
      ctx.shadowColor = s.color || '#22c55e';
      ctx.shadowBlur = 10;
      ctx.fillRect(sx + offset, sy + offset, size, size);
      ctx.shadowBlur = 0;

      // Inner Highlight
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + offset + 2, sy + offset + 2, size - 4, size - 4);

      // State Icon inside Survivor
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      let icon = '🛡️';
      if (s.state === 'REPAIRING') icon = '🔨';
      else if (s.state === 'ATTACKING') icon = '⚔️';
      else if (s.state === 'MANUAL') icon = '🎮';
      else if (s.state === 'LOOTING') icon = '📦';
      else if (s.state === 'GUARDING') icon = s.role === 'SLAYER' ? '⚔️' : s.role === 'CARPENTER' ? '🔨' : '🛡️';

      ctx.fillText(icon, sx, sy + 4);

      // Survivor Name Overhead
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeText(s.name, sx, sy - 11);
      ctx.fillText(s.name, sx, sy - 11);

      // Survivor Health Bar
      const barW = ts;
      const barH = 5;
      const barX = sx - barW / 2;
      const barY = sy - 8;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }
  }

  renderEffects(ctx) {
    // 1. Bullet Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.width;
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      t.life -= 0.15;
      if (t.life <= 0) this.tracers.splice(i, 1);
    }

    // 2. Muzzle Flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      ctx.save();
      ctx.translate(mf.x, mf.y);
      ctx.rotate(mf.angle);
      ctx.fillStyle = '#fef08a';
      ctx.globalAlpha = Math.max(0, mf.life);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(16, -6);
      ctx.lineTo(22, 0);
      ctx.lineTo(16, 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      mf.life -= 0.25;
      if (mf.life <= 0) this.muzzleFlashes.splice(i, 1);
    }

    // 3. Particles (Blood & Wood splinters)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);

      if (p.isWood) {
        ctx.fillRect(p.x, p.y, p.size * 1.5, p.size * 0.7);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // 4. Combat Slashes
    for (let i = this.slashEffects.length - 1; i >= 0; i--) {
      const s = this.slashEffects[i];
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3 * s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 16 * (1.5 - s.life), 0, Math.PI * 1.5);
      ctx.stroke();
      s.life -= 0.08;
      if (s.life <= 0) this.slashEffects.splice(i, 1);
    }

    // 5. Floating Text (Damage, XP, Heals)
    for (let i = this.floaties.length - 1; i >= 0; i--) {
      const f = this.floaties[i];
      ctx.font = f.isCrit ? '900 13px monospace' : 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = f.isCrit ? 3 : 2;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1.0;

      f.y += f.vy;
      f.life -= 0.035;
      if (f.life <= 0) this.floaties.splice(i, 1);
    }
  }

  renderOverlays(ctx, snapshot) {
    if (snapshot.waveState === 'VICTORY') {
      // Warm Sunrise Golden Victory Screen
      const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.88)'); // Amber gold
      grad.addColorStop(0.5, 'rgba(234, 88, 12, 0.90)'); // Orange
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.96)'); // Dark base

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.font = '900 32px system-ui, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 15;
      ctx.fillText('☀️ 7:30 AM: DAWN REACHED! ☀️', this.canvas.width / 2, this.canvas.height / 2 - 60);
      ctx.shadowBlur = 0;

      ctx.font = '700 20px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🏆 SQUAD SURVIVED THE NIGHT 🏆', this.canvas.width / 2, this.canvas.height / 2 - 20);

      // Streak Badge
      ctx.font = '800 16px sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`🔥 Consecutive Night Victories: ${snapshot.winStreak || 1} 🔥`, this.canvas.width / 2, this.canvas.height / 2 + 15);

      // Level / Stats summary
      const lvl = snapshot.progression?.level || 1;
      const perks = snapshot.progression?.activePerks?.length || 0;
      ctx.font = '600 14px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`Safehouse Fortified to LVL ${lvl} (${perks} Perks Active)`, this.canvas.width / 2, this.canvas.height / 2 + 45);

      // Autopilot Countdown
      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(`🌅 Next Night begins in ${snapshot.victoryTimer || 60}s...`, this.canvas.width / 2, this.canvas.height / 2 + 80);

    } else if (snapshot.waveState === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.font = '900 32px system-ui, sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15;
      ctx.fillText('💀 SQUAD WIPED OUT 💀', this.canvas.width / 2, this.canvas.height / 2 - 25);
      ctx.shadowBlur = 0;

      ctx.font = '700 16px monospace';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`Fell at ${snapshot.inGameTime || 'Night'} (Wave ${snapshot.wave})`, this.canvas.width / 2, this.canvas.height / 2 + 10);

      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Restarting run in ${snapshot.gameOverTimer || 5}s...`, this.canvas.width / 2, this.canvas.height / 2 + 40);

    } else if (snapshot.waveState === 'INTERMISSION') {
      const bannerW = 340;
      const bannerH = 36;
      const bx = (this.canvas.width - bannerW) / 2;
      const by = 16;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(bx, by, bannerW, bannerH);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bannerW, bannerH);

      const nextTime = snapshot.inGameTime || 'Night';
      ctx.font = '700 12px monospace';
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'center';
      ctx.fillText(`🛡️ INTERMISSION: ${nextTime} IN ${snapshot.intermissionTimer}s`, this.canvas.width / 2, by + 22);
    }
  }
}
