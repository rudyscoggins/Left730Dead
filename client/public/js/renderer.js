/**
 * HTML5 2D Canvas Game Renderer for Left 730 Dead
 * High-performance, pixel-crisp stream overlay viewport with Dusk-to-Dawn lighting.
 */

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = null;
    this.tileSize = 40; // 20x20 tiles = 800x800px base
    this.slashEffects = [];
    this.floaties = [];
    
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

  processCombatEvents(events) {
    if (!events || !events.length) return;

    for (const evt of events) {
      if (evt.type === 'DAMAGE') {
        this.addDamageFloaty(evt.x, evt.y, evt.damage, evt.color || '#ef4444');
        this.addSlashEffect(evt.x, evt.y, '#f87171');
      } else if (evt.type === 'KILL') {
        this.addDamageFloaty(evt.x, evt.y, `+${evt.xp} XP`, '#c084fc');
      } else if (evt.type === 'HEAL') {
        this.addDamageFloaty(evt.x, evt.y, `+${evt.amount} HP`, '#22c55e');
      } else if (evt.type === 'REPAIR') {
        this.addSlashEffect(evt.x, evt.y, '#60a5fa');
      }
    }
  }

  addDamageFloaty(x, y, text, color = '#ffffff') {
    const ts = this.tileSize;
    this.floaties.push({
      x: x * ts + (Math.random() * 12 - 6),
      y: y * ts - 8,
      text: String(text),
      color: color,
      vy: -0.85,
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

  render(snapshot) {
    if (!snapshot || !this.map) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const ts = this.tileSize;
    const now = Date.now();

    // 1. Draw Map & Rooms
    this.renderMap(this.ctx, ts, snapshot);

    // 2. Draw Barricades
    this.renderBarricades(this.ctx, snapshot.barricades, ts);

    // 3. Draw Loot Drops
    this.renderLoot(this.ctx, snapshot.loot, ts, now);

    // 4. Draw Zombies
    this.renderZombies(this.ctx, snapshot.zombies, ts);

    // 5. Draw Survivors
    this.renderSurvivors(this.ctx, snapshot.survivors, ts);

    // 6. Draw Combat Slashes & Floaties
    this.renderEffects(this.ctx);

    // 7. Draw Overlays (Victory / Game Over / Intermission)
    this.renderOverlays(this.ctx, snapshot);
  }

  renderMap(ctx, ts, snapshot) {
    // Outside Ground: Dynamic ambient lighting based on in-game time
    let bgFill = '#0f172a'; // Midnight default
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
      ctx.font = '600 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';

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
          // Wall Body
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

  renderBarricades(ctx, barricades, ts) {
    if (!barricades) return;

    for (const b of barricades) {
      const bx = b.x * ts;
      const by = b.y * ts;
      const hpRatio = b.hp / b.maxHp;

      if (b.isBreached) {
        // Breached Barricade (Red dashed broken frame)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(bx + 4, by + 4, ts - 8, ts - 8);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(bx + 2, by + 2, ts - 4, ts - 4);
        ctx.setLineDash([]);

        // Breached text
        ctx.font = '700 9px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'center';
        ctx.fillText('BREACH', bx + ts / 2, by + ts / 2 + 3);
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

        // Repairing Sparkle Badge
        if (b.repairerCount > 0) {
          ctx.font = '10px sans-serif';
          ctx.fillText('🔨', bx + ts / 2, by + ts / 2 + 4);
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

      // Glow circle
      ctx.beginPath();
      ctx.arc(lx, ly, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
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

  renderSurvivors(ctx, survivors, ts) {
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
      const hpRatio = s.hp / s.maxHp;
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
    // Slashes
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

    // Floating Text
    for (let i = this.floaties.length - 1; i >= 0; i--) {
      const f = this.floaties[i];
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
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
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.85)'); // Amber gold
      grad.addColorStop(0.5, 'rgba(234, 88, 12, 0.88)'); // Orange
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)'); // Dark base

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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.font = '900 30px system-ui, sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.fillText('💀 SQUAD WIPED OUT 💀', this.canvas.width / 2, this.canvas.height / 2 - 25);

      ctx.font = '700 16px monospace';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`Fell at ${snapshot.inGameTime || 'Night'} (Wave ${snapshot.wave})`, this.canvas.width / 2, this.canvas.height / 2 + 10);

      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Restarting run in ${snapshot.gameOverTimer || 5}s...`, this.canvas.width / 2, this.canvas.height / 2 + 40);

    } else if (snapshot.waveState === 'INTERMISSION') {
      const bannerW = 320;
      const bannerH = 34;
      const bx = (this.canvas.width - bannerW) / 2;
      const by = 16;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(bx, by, bannerW, bannerH);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bannerW, bannerH);

      const nextTime = snapshot.inGameTime || 'Night';
      ctx.font = '700 12px monospace';
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'center';
      ctx.fillText(`🛡️ INTERMISSION: ${nextTime} IN ${snapshot.intermissionTimer}s`, this.canvas.width / 2, by + 21);
    }
  }
}
