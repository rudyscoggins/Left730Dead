/**
 * HTML5 2D Canvas Game Renderer for Left 730 Dead
 * Phase 4: Full Visual Art Overhaul & 730 Society Character Design
 * High-performance, pixel-crisp architectural safehouse, prop furniture,
 * directional 730 Society survivor models, and animated undead zombie horde.
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
    this.corpseDecals = []; // Fallen zombie bodies
    
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

        if (evt.sourceX !== undefined && evt.sourceY !== undefined) {
          this.addTracer(evt.sourceX, evt.sourceY, evt.x, evt.y, evt.attackerRole);
          this.addMuzzleFlash(evt.sourceX, evt.sourceY, evt.x, evt.y);
        }
      } else if (evt.type === 'KILL') {
        this.addDamageFloaty(evt.x, evt.y, `+${evt.xp} XP`, '#c084fc', true);
        this.addBloodSplatter(evt.x, evt.y, 16);
        this.addCorpse(evt.x, evt.y, evt.targetType);
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
    let color = '#fef08a';
    let width = 1.8;
    if (role === 'SLAYER') {
      color = '#f97316';
      width = 2.8;
    } else if (role === 'SENTINEL') {
      color = '#38bdf8';
      width = 2.2;
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

  addCorpse(x, y, type = 'shambler') {
    const ts = this.tileSize;
    if (this.corpseDecals.length > 40) {
      this.corpseDecals.shift();
    }
    this.corpseDecals.push({
      x: x * ts,
      y: y * ts,
      angle: Math.random() * Math.PI * 2,
      isBrute: type === 'brute',
      alpha: 0.85
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

    // 0. Screen Shake
    if (this.shakeIntensity > 0.1) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(shakeX, shakeY);
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
    }

    // 1. Outside Yard, House Structure & Room Floors
    this.renderHouseEnvironment(this.ctx, ts, snapshot);

    // 2. Corpses & Blood Decals
    this.renderCorpsesAndDecals(this.ctx);

    // 3. Themed Room Furniture & Props
    this.renderFurnitureProps(this.ctx, ts, now);

    // 4. Barricades (Detailed Windows & Doors)
    this.renderBarricades(this.ctx, snapshot.barricades, ts);

    // 5. Loot Drops
    this.renderLoot(this.ctx, snapshot.loot, ts, now);

    // 6. Undead Zombie Horde
    this.renderZombies(this.ctx, snapshot.zombies, ts, now);

    // 7. 730 Society Survivors
    this.renderSurvivors(this.ctx, snapshot.survivors, ts, now);

    // 8. Visual Combat Juice (Tracers, Muzzle Flashes, Particles & Floaties)
    this.renderEffects(this.ctx);

    this.ctx.restore();

    // 9. Overlays (Victory / Game Over / Intermission)
    this.renderOverlays(this.ctx, snapshot);
  }

  // -------------------------------------------------------------
  // 1. THE HOUSE & ENVIRONMENT
  // -------------------------------------------------------------

  renderHouseEnvironment(ctx, ts, snapshot) {
    // Outside Ground Lighting (Night, Dusk, Dawn)
    let grassBase = '#091512';
    let gravelColor = '#1c1917';
    if (snapshot?.isDawn || snapshot?.waveState === 'VICTORY') {
      grassBase = '#223828';
      gravelColor = '#44403c';
    } else if (snapshot?.wave <= 3) {
      grassBase = '#111e24';
      gravelColor = '#292524';
    }

    ctx.fillStyle = grassBase;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Gravel Path to Main Door (X: 12, Y: 15 to 20)
    ctx.fillStyle = gravelColor;
    ctx.fillRect(11.5 * ts, 15 * ts, 2 * ts, 5 * ts);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(11.5 * ts, 15 * ts, 2 * ts, 5 * ts);

    // Exterior Wall Lanterns (Warm lighting cones)
    const lights = [
      { x: 7.5, y: 3.6 },
      { x: 12.5, y: 3.6 },
      { x: 3.6, y: 9.5 },
      { x: 15.4, y: 9.5 },
      { x: 12.5, y: 15.4 }
    ];
    for (const l of lights) {
      const grad = ctx.createRadialGradient(l.x * ts, l.y * ts, 4, l.x * ts, l.y * ts, ts * 2.2);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.12)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x * ts, l.y * ts, ts * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Sconce fixture
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(l.x * ts - 2, l.y * ts - 2, 4, 4);
    }

    // Inside House Base Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(4 * ts, 4 * ts, 12 * ts, 12 * ts);

    // Sector 1: Living Room Floor (Parquet Hardwood Planks) [5..9, 5..9]
    ctx.fillStyle = '#3e2312';
    ctx.fillRect(5 * ts, 5 * ts, 5 * ts, 5 * ts);
    ctx.strokeStyle = '#2b160b';
    ctx.lineWidth = 1;
    for (let y = 5; y < 10; y += 0.5) {
      ctx.beginPath();
      ctx.moveTo(5 * ts, y * ts);
      ctx.lineTo(10 * ts, y * ts);
      ctx.stroke();
    }

    // Sector 2: Armory Floor (Diamond Plate Steel) [11..14, 5..9]
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10.5 * ts, 5 * ts, 4.5 * ts, 5 * ts);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 11; x <= 15; x++) {
      ctx.beginPath();
      ctx.moveTo(x * ts, 5 * ts);
      ctx.lineTo(x * ts, 10 * ts);
      ctx.stroke();
    }
    // Steel Plate Rivets
    ctx.fillStyle = '#64748b';
    for (let x = 11; x <= 14; x++) {
      for (let y = 5; y <= 9; y++) {
        ctx.fillRect((x + 0.1) * ts, (y + 0.1) * ts, 2, 2);
        ctx.fillRect((x + 0.9) * ts, (y + 0.9) * ts, 2, 2);
      }
    }

    // Sector 3: Kitchen Floor (Checkered Ceramic Tiles) [5..9, 11..14]
    for (let x = 5; x < 10; x++) {
      for (let y = 10.5; y < 15; y += 0.5) {
        ctx.fillStyle = (x + Math.floor(y * 2)) % 2 === 0 ? '#1f2937' : '#374151';
        ctx.fillRect(x * ts, y * ts, ts, 0.5 * ts);
      }
    }

    // Sector 4: Workshop Floor (Industrial Stained Concrete) [11..14, 11..14]
    ctx.fillStyle = '#262e3d';
    ctx.fillRect(10.5 * ts, 10.5 * ts, 4.5 * ts, 4.5 * ts);
    // Oil spots
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.beginPath();
    ctx.ellipse(12.5 * ts, 12.8 * ts, 18, 10, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Central Hallway (Polished Mahogany + Runner Rug) [9..11, 9..11]
    ctx.fillStyle = '#2e180d';
    ctx.fillRect(9 * ts, 9 * ts, 2 * ts, 2 * ts);
    // Burgundy Center Runner
    ctx.fillStyle = '#831843';
    ctx.fillRect(9.3 * ts, 9.1 * ts, 1.4 * ts, 1.8 * ts);
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1;
    ctx.strokeRect(9.3 * ts, 9.1 * ts, 1.4 * ts, 1.8 * ts);

    // Walls (3D Beveled with drop shadows)
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.grid[y][x];
        if (tile === 2) { // WALL
          // Wall Base & Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(x * ts + 2, y * ts + 2, ts, ts);

          // Wall Body
          ctx.fillStyle = '#334155';
          ctx.fillRect(x * ts, y * ts, ts, ts);

          // Top Bevel Highlight
          ctx.fillStyle = '#475569';
          ctx.fillRect(x * ts, y * ts, ts, 5);

          // Outer Wall Trim
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x * ts, y * ts, ts, ts);
        }
      }
    }
  }

  renderCorpsesAndDecals(ctx) {
    // Blood stains
    for (const d of this.bloodDecals) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
    }

    // Dead zombie corpses
    for (const c of this.corpseDecals) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.globalAlpha = c.alpha;

      const size = c.isBrute ? 22 : 15;
      // Rotting clothes torso
      ctx.fillStyle = c.isBrute ? '#7f1d1d' : '#1e3a5f';
      ctx.fillRect(-size / 2, -size / 3, size, size * 0.7);

      // Decayed skull
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(0, -size / 2, size * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Blood pool under corpse
      ctx.fillStyle = 'rgba(153, 27, 27, 0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.9, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // 2. THEMED FURNITURE & PROPS
  // -------------------------------------------------------------

  renderFurnitureProps(ctx, ts, now) {
    // --- LIVING ROOM PROPS (Sector: 5..9, 5..9) ---
    // Circular Persian Rug (Center)
    ctx.beginPath();
    ctx.arc(7.5 * ts, 7.5 * ts, 1.4 * ts, 0, Math.PI * 2);
    ctx.fillStyle = '#991b1b';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sectional L-Sofa Couch (NW Corner)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(5.4 * ts, 5.4 * ts, 2.2 * ts, 0.8 * ts); // Top cushion
    ctx.fillRect(5.4 * ts, 5.4 * ts, 0.8 * ts, 2.0 * ts); // Left cushion
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(5.4 * ts, 5.4 * ts, 2.2 * ts, 0.8 * ts);
    ctx.strokeRect(5.4 * ts, 5.4 * ts, 0.8 * ts, 2.0 * ts);

    // Coffee Table
    ctx.fillStyle = '#451a03';
    ctx.fillRect(6.8 * ts, 6.8 * ts, 1.2 * ts, 0.7 * ts);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    ctx.strokeRect(6.8 * ts, 6.8 * ts, 1.2 * ts, 0.7 * ts);

    // TV / Fireplace Console against north wall
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(8.2 * ts, 5.1 * ts, 1.4 * ts, 0.4 * ts);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(8.4 * ts, 5.15 * ts, 1.0 * ts, 0.15 * ts); // TV Glow

    // --- ARMORY PROPS (Sector: 11..14, 5..9) ---
    // Weapon Pegboard Wall Racks (North wall)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(11.2 * ts, 5.1 * ts, 2.4 * ts, 0.4 * ts);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(11.2 * ts, 5.1 * ts, 2.4 * ts, 0.4 * ts);
    // Miniature rifles mounted
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(11.4 * ts, 5.25 * ts);
    ctx.lineTo(12.2 * ts, 5.25 * ts);
    ctx.moveTo(12.5 * ts, 5.25 * ts);
    ctx.lineTo(13.4 * ts, 5.25 * ts);
    ctx.stroke();

    // Military Green Ammo Crates
    ctx.fillStyle = '#15803d';
    ctx.fillRect(13.2 * ts, 6.8 * ts, 1.1 * ts, 0.8 * ts);
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(13.2 * ts, 6.8 * ts, 1.1 * ts, 0.8 * ts);
    // Yellow Stencil [730]
    ctx.font = '700 8px monospace';
    ctx.fillStyle = '#fde047';
    ctx.fillText('730 AMMO', 13.75 * ts, 7.3 * ts);

    // Steel Wall Lockers (East wall)
    ctx.fillStyle = '#475569';
    ctx.fillRect(14.4 * ts, 6.0 * ts, 0.4 * ts, 2.2 * ts);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(14.4 * ts, 6.0 * ts, 0.4 * ts, 2.2 * ts);

    // --- KITCHEN PROPS (Sector: 5..9, 11..14) ---
    // L-shaped Granite Countertop (SW corner)
    ctx.fillStyle = '#334155';
    ctx.fillRect(5.2 * ts, 12.6 * ts, 0.7 * ts, 2.2 * ts);
    ctx.fillRect(5.2 * ts, 14.1 * ts, 2.4 * ts, 0.7 * ts);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(5.2 * ts, 12.6 * ts, 0.7 * ts, 2.2 * ts);
    ctx.strokeRect(5.2 * ts, 14.1 * ts, 2.4 * ts, 0.7 * ts);

    // Sink (Chrome basin)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(5.35 * ts, 13.0 * ts, 0.4 * ts, 0.6 * ts);

    // Stovetop (4 burners)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6.4 * ts, 14.2 * ts, 0.9 * ts, 0.5 * ts);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(6.6 * ts, 14.45 * ts, 2.5, 0, Math.PI * 2);
    ctx.arc(7.1 * ts, 14.45 * ts, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Refrigerator
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(5.2 * ts, 11.2 * ts, 0.7 * ts, 1.0 * ts);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(5.2 * ts, 11.2 * ts, 0.7 * ts, 1.0 * ts);

    // --- WORKSHOP PROPS (Sector: 11..14, 11..14) ---
    // Heavy Timber Workbench with Iron Vice (Center East)
    ctx.fillStyle = '#78350f';
    ctx.fillRect(12.4 * ts, 11.4 * ts, 1.8 * ts, 0.9 * ts);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12.4 * ts, 11.4 * ts, 1.8 * ts, 0.9 * ts);

    // Blue Iron Vice clamp
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(14.0 * ts, 11.3 * ts, 0.3 * ts, 0.3 * ts);

    // Red Storage Drum
    ctx.beginPath();
    ctx.arc(14.2 * ts, 13.8 * ts, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Room Label Overlays
    if (this.map.rooms) {
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';

      for (const key of Object.keys(this.map.rooms)) {
        const r = this.map.rooms[key];
        ctx.fillText(`[ ${r.name.toUpperCase()} ]`, (r.x + 0.5) * ts, (r.y + 0.5) * ts);
      }
    }
  }

  // -------------------------------------------------------------
  // 3. FORTIFIED BARRICADES
  // -------------------------------------------------------------

  renderBarricades(ctx, barricades, ts) {
    if (!barricades) return;

    for (const b of barricades) {
      const bx = b.x * ts;
      const by = b.y * ts;
      const hpRatio = b.hp / b.maxHp;

      if (b.isBreached) {
        // Breached Barricade (Shattered broken planks + Red hazard border)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
        ctx.fillRect(bx + 2, by + 2, ts - 4, ts - 4);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(bx + 2, by + 2, ts - 4, ts - 4);
        ctx.setLineDash([]);

        // Broken splinter stubs
        ctx.fillStyle = '#451a03';
        ctx.fillRect(bx + 3, by + 4, 8, 4);
        ctx.fillRect(bx + ts - 11, by + ts - 8, 8, 4);

        // Flashing breach warning text
        ctx.font = '900 9px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'center';
        ctx.fillText('BREACH', bx + ts / 2, by + ts / 2 + 3);
      } else {
        // Fortified Wooden Planks
        const isDoor = b.type === 'door';
        ctx.fillStyle = isDoor ? '#713f12' : '#854d0e';
        ctx.fillRect(bx + 2, by + 2, ts - 4, ts - 4);

        // Individual horizontal wood planks
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1;
        for (let py = 6; py < ts - 4; py += 7) {
          ctx.beginPath();
          ctx.moveTo(bx + 3, by + py);
          ctx.lineTo(bx + ts - 3, by + py);
          ctx.stroke();
        }

        // Metal Corner Reinforcements & Iron Studs
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(bx + 2, by + 2, 6, 6);
        ctx.fillRect(bx + ts - 8, by + 2, 6, 6);
        ctx.fillRect(bx + 2, by + ts - 8, 6, 6);
        ctx.fillRect(bx + ts - 8, by + ts - 8, 6, 6);

        // Iron Nails
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(bx + 4, by + 4, 2, 2);
        ctx.fillRect(bx + ts - 6, by + 4, 2, 2);
        ctx.fillRect(bx + 4, by + ts - 6, 2, 2);
        ctx.fillRect(bx + ts - 6, by + ts - 6, 2, 2);

        // Visual damage cracks
        if (hpRatio < 0.6) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx + ts * 0.3, by + ts * 0.2);
          ctx.lineTo(bx + ts * 0.5, by + ts * 0.55);
          ctx.lineTo(bx + ts * 0.4, by + ts * 0.85);
          ctx.stroke();
        }

        // Repairing Tool Sparkle
        if (b.repairerCount > 0) {
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🔨', bx + ts / 2, by + ts / 2 + 4);
        }
      }

      // Barricade Health Bar
      const barW = ts + 6;
      const barH = 4;
      const barX = bx - 3;
      const barY = by - 6;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.6 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }
  }

  // -------------------------------------------------------------
  // 4. LOOT PICKUPS
  // -------------------------------------------------------------

  renderLoot(ctx, loot, ts, now) {
    if (!loot) return;

    for (const item of loot) {
      const lx = item.x * ts;
      const ly = item.y * ts + Math.sin(now / 200) * 3;

      // Pulse Glow circle
      ctx.beginPath();
      ctx.arc(lx, ly, 13 + Math.sin(now / 150) * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.fill();

      // Health pack tactical box
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(lx - 9, ly - 9, 18, 18);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx - 9, ly - 9, 18, 18);

      // White cross symbol
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx - 6, ly - 2, 12, 4);
      ctx.fillRect(lx - 2, ly - 6, 4, 12);
    }
  }

  // -------------------------------------------------------------
  // 5. UNDEAD ZOMBIE HORDE (Top-Down Sprites & Animations)
  // -------------------------------------------------------------

  renderZombies(ctx, zombies, ts, now) {
    if (!zombies) return;

    for (const z of zombies) {
      const zx = z.x * ts;
      const zy = z.y * ts;
      const isBrute = z.type === 'brute';
      const angle = z.facingAngle || 0;

      ctx.save();
      ctx.translate(zx, zy);
      ctx.rotate(angle);

      // Walking & attack sway
      const sway = Math.sin((now / (isBrute ? 220 : 160)) + z.id.length) * (isBrute ? 2.5 : 3.5);

      if (isBrute) {
        // --- GIANT BRUTE / TANK ---
        const bW = 28;
        const bH = 20;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 0, bW * 0.7, bH * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Muscular Shoulders & Torn Vest
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.ellipse(0, 0, bW / 2, bH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#450a0a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Muscular Scarred Back
        ctx.fillStyle = '#15803d';
        ctx.fillRect(-6, -4, 12, 8);

        // Huge Bloody Knuckle Arms (Lunging forward)
        ctx.fillStyle = '#166534';
        ctx.fillRect(4, -12 + sway, 14, 7); // Right arm
        ctx.fillRect(4, 5 - sway, 14, 7);  // Left arm
        ctx.fillStyle = '#991b1b'; // Bloody fists
        ctx.fillRect(14, -12 + sway, 6, 7);
        ctx.fillRect(14, 5 - sway, 6, 7);

        // Decayed Head with Glowing Red Eyes
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Crimson Pupils
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.fillRect(6, -3, 3, 2);
        ctx.fillRect(6, 1, 3, 2);
        ctx.shadowBlur = 0;

      } else {
        // --- SHAMBLER ZOMBIE ---
        const sW = 18;
        const sH = 12;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 0, sW * 0.6, sH * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Torn Blue/Grey Ripped Shirt
        ctx.fillStyle = '#1e3a5f';
        ctx.beginPath();
        ctx.ellipse(0, 0, sW / 2, sH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Blood stains on back
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(-3, -2, 6, 4);

        // Outstretched Claw Arms (Reaching to bite/scratch)
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(2, -8 + sway, 11, 4); // Right arm
        ctx.fillRect(2, 4 - sway, 11, 4);  // Left arm
        // Claw claws
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(10, -8 + sway, 4, 4);
        ctx.fillRect(10, 4 - sway, 4, 4);

        // Decayed Green Skull
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(1, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Sunken Eye Sockets & Glowing Yellow Pupils
        ctx.fillStyle = '#052e16';
        ctx.fillRect(4, -2.5, 2, 2);
        ctx.fillRect(4, 0.5, 2, 2);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(4.5, -2, 1.5, 1.5);
        ctx.fillRect(4.5, 1, 1.5, 1.5);
      }

      ctx.restore();

      // Zombie Floating Health Bar
      const hpRatio = z.hp / z.maxHp;
      const barW = (isBrute ? 28 : 20);
      const barH = 3.5;
      const barX = zx - barW / 2;
      const barY = zy - (isBrute ? 20 : 15);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }
  }

  // -------------------------------------------------------------
  // 6. 730 SOCIETY SURVIVOR CHARACTERS (Top-Down Models & Roles)
  // -------------------------------------------------------------

  renderSurvivors(ctx, survivors, ts, now) {
    if (!survivors) return;

    for (const s of survivors) {
      const sx = s.x * ts;
      const sy = s.y * ts;
      const angle = s.aimAngle || 0;
      const isHost = s.name.toLowerCase().includes('rudy');
      const role = s.role || 'SURVIVOR';

      if (!s.isAlive) {
        // Downed Corpse View
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💀', 0, 4);
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.fillText('DOWNED', 0, -12);
        ctx.restore();
        continue;
      }

      // Low health warning aura pulse
      const hpRatio = s.hp / s.maxHp;
      if (hpRatio <= 0.3) {
        ctx.beginPath();
        ctx.arc(sx, sy, 18 + Math.sin(now / 100) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // --- TOP-DOWN HUMAN SURVIVOR BODY ---
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);

      // Walking stride & weapon bob
      const isMoving = s.state === 'MOVING';
      const bob = Math.sin(now / 140) * (isMoving ? 1.5 : 0.4);

      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Torso & Tactical Uniform
      let uniformColor = s.color || '#3b82f6';
      if (isHost) uniformColor = '#1e293b'; // Rudy dark tactical jacket
      else if (role === 'CARPENTER') uniformColor = '#ea580c'; // High-vis orange vest
      else if (role === 'SENTINEL') uniformColor = '#15803d'; // Olive camo
      else if (role === 'SLAYER') uniformColor = '#0f172a'; // Heavy black armor
      else if (role === 'SCAVENGER') uniformColor = '#475569'; // Urban hoodie

      ctx.fillStyle = uniformColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Role Gear Details (Vest, Bandolier, Backpack)
      if (role === 'SLAYER') {
        // Red diagonal ammo bandolier
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-6, -5);
        ctx.lineTo(6, 5);
        ctx.stroke();
      } else if (role === 'SCAVENGER') {
        // Backpack on rear
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-10, -5, 4, 10);
      } else if (role === 'CARPENTER') {
        // Toolbelt hammer
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-2, -9, 4, 3);
      }

      // Arms reaching forward gripping firearm
      ctx.fillStyle = '#fde68a'; // Skin hands
      ctx.fillRect(4, -6 + bob, 8, 3.5); // Right arm
      ctx.fillRect(4, 2.5 - bob, 8, 3.5); // Left arm

      // Weapon Firearm Models
      if (role === 'SLAYER' || isHost) {
        // Combat Shotgun (Dark metal double barrel & wooden pump)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(6, -2, 14, 4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(14, -1.5, 6, 3); // Muzzle
      } else if (role === 'SENTINEL') {
        // Marksman Scoped Rifle (Long barrel)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(6, -1.5, 17, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(9, -3.5, 5, 2); // Optical Scope
      } else {
        // Standard Pistol / Carbine
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(6, -1.5, 10, 3);
      }

      // Human Head
      ctx.fillStyle = '#fde68a'; // Face/skin
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Headwear & 730 Society Badges
      if (isHost) {
        // Rudy's "730" Tactical Cap
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, 6.5, Math.PI * 0.6, Math.PI * 2.4);
        ctx.fill();
        // Cap visor forward
        ctx.fillRect(2, -4, 4, 8);
        // Gold "730" pin
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-2, -2, 4, 4);
      } else if (role === 'CARPENTER') {
        // Welding Goggles on forehead
        ctx.fillStyle = '#f97316';
        ctx.fillRect(-2, -5, 3, 10);
      } else if (role === 'SENTINEL') {
        // Tactical Headset
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-1, -7.5, 3, 15);
      } else if (role === 'SLAYER') {
        // Red Bandana
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, 6.5, Math.PI * 0.7, Math.PI * 2.3);
        ctx.fill();
      } else if (role === 'SCAVENGER') {
        // Urban Hoodie
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, Math.PI * 0.5, Math.PI * 2.5);
        ctx.fill();
      }

      ctx.restore();

      // --- OVERHEAD HUD (Name, Role Icon & Health Bar) ---
      const barW = ts * 1.1;
      const barH = 5;
      const barX = sx - barW / 2;
      const barY = sy - 18;

      // Name & Role overhead
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.textAlign = 'center';

      let roleIcon = '🛡️';
      if (role === 'CARPENTER') roleIcon = '🔨';
      else if (role === 'SENTINEL') roleIcon = '🎯';
      else if (role === 'SLAYER') roleIcon = '💥';
      else if (role === 'SCAVENGER') roleIcon = '📦';

      const label = `${roleIcon} ${s.name}`;
      ctx.strokeText(label, sx, barY - 3);
      ctx.fillText(label, sx, barY - 3);

      // Health Bar
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }
  }

  // -------------------------------------------------------------
  // 7. VISUAL COMBAT EFFECTS
  // -------------------------------------------------------------

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
      ctx.moveTo(8, 0);
      ctx.lineTo(20, -7);
      ctx.lineTo(26, 0);
      ctx.lineTo(20, 7);
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

    // 5. Floating Combat Text
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

  // -------------------------------------------------------------
  // 8. OVERLAYS & VICTORY / GAME OVER
  // -------------------------------------------------------------

  renderOverlays(ctx, snapshot) {
    if (snapshot.waveState === 'VICTORY') {
      const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.88)');
      grad.addColorStop(0.5, 'rgba(234, 88, 12, 0.90)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.96)');

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

      ctx.font = '800 16px sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`🔥 Consecutive Night Victories: ${snapshot.winStreak || 1} 🔥`, this.canvas.width / 2, this.canvas.height / 2 + 15);

      const lvl = snapshot.progression?.level || 1;
      const perks = snapshot.progression?.activePerks?.length || 0;
      ctx.font = '600 14px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`Safehouse Fortified to LVL ${lvl} (${perks} Perks Active)`, this.canvas.width / 2, this.canvas.height / 2 + 45);

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
