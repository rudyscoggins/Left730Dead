/**
 * Frontend WebSocket Client & UI Controller for Left 730 Dead
 * Dusk to Dawn (7:30 PM - 7:30 AM) Survival Campaign Controller
 */

import { GameRenderer } from './renderer.js';

class GameClient {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new GameRenderer(this.canvas);
    this.ws = null;
    this.latestSnapshot = null;
    this.reconnectAttempts = 0;

    // DOM Elements
    this.statusBadge = document.getElementById('statusBadge');
    this.clockLabel = document.getElementById('hudClock');
    this.waveLabel = document.getElementById('hudWave');
    this.zombiesLabel = document.getElementById('hudZombies');
    this.streakLabel = document.getElementById('hudStreak');
    this.houseLevelLabel = document.getElementById('hudLevel');
    this.xpFill = document.getElementById('xpFill');
    this.xpText = document.getElementById('xpText');
    this.perksContainer = document.getElementById('perksContainer');
    this.survivorList = document.getElementById('survivorList');
    this.eventLog = document.getElementById('eventLog');
    this.commandTargetSelect = document.getElementById('commandTargetSelect');
    this.perkModal = document.getElementById('perkModal');
    this.perkOptions = document.getElementById('perkOptions');

    // Controls
    this.btnToggleAutoWave = document.getElementById('btnToggleAutoWave');
    this.btnToggleEndless = document.getElementById('btnToggleEndless');

    this.initEventListeners();
    this.connect();
    this.startRenderLoop();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.statusBadge.innerHTML = `<span class="status-dot"></span> Connecting...`;
    this.statusBadge.className = 'badge-status';

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.statusBadge.innerHTML = `<span class="status-dot"></span> Online (Port 7300)`;
      this.statusBadge.className = 'badge-status';
      this.reconnectAttempts = 0;
      this.logEvent('Connected to Left 730 Dead Game Engine', 'system');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    this.ws.onclose = () => {
      this.statusBadge.innerHTML = `<span class="status-dot"></span> Offline`;
      this.statusBadge.className = 'badge-status offline';
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
      setTimeout(() => this.connect(), delay);
    };

    this.ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
    };
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  handleMessage(data) {
    if (data.type === 'INIT_MAP') {
      this.renderer.setMap(data.map);
    } else if (data.type === 'SNAPSHOT') {
      this.latestSnapshot = data;
      this.renderer.processCombatEvents(data.combatEvents);
      this.updateHUD(data);
    } else if (data.type === 'EVENT') {
      this.handleGameEvent(data.event);
    }
  }

  handleGameEvent(evt) {
    if (evt.type === 'WAVE_STARTED') {
      this.logEvent(`🌊 Wave ${evt.wave} [${evt.inGameTime || '7:30 PM'}] started! (${evt.totalZombies} zombies incoming)`, 'wave');
    } else if (evt.type === 'WAVE_CLEARED') {
      this.logEvent(`🎉 Wave ${evt.wave} cleared! Next: ${evt.inGameTime || 'Night'} (+${evt.xpGained} XP bonus)`, 'wave');
    } else if (evt.type === 'VICTORY') {
      this.logEvent(`🏆 7:30 AM DAWN REACHED! Squad survived the night! (Streak: ${evt.winStreak}🔥)`, 'level');
    } else if (evt.type === 'LEVEL_UP') {
      this.logEvent(`⭐ House reached Level ${evt.level}!`, 'level');
      if (this.latestSnapshot?.progression?.perkMode === 'DRIVEN') {
        this.showPerkModal(evt.offeredPerks);
      }
    } else if (evt.type === 'PERK_ACQUIRED') {
      this.logEvent(`✨ Perk Unlocked: ${evt.perk.icon} ${evt.perk.name} (${evt.perk.desc})`, 'level');
      this.hidePerkModal();
    } else if (evt.type === 'GAME_OVER') {
      this.logEvent(`💀 SQUAD WIPED OUT at ${evt.inGameTime || 'Night'}! Streak reset. Auto-restarting...`, 'kill');
    } else if (evt.type === 'GAME_RESET') {
      this.logEvent(`🔄 Map reset to 7:30 PM (Wave 1)`, 'system');
    } else if (evt.type === 'ENDLESS_MODE_TOGGLED') {
      this.logEvent(`♾️ Endless Mode ${evt.endlessMode ? 'ENABLED' : 'DISABLED'}`, 'system');
    } else if (evt.type === 'SURVIVOR_JOINED') {
      this.logEvent(`👤 ${evt.survivor.name} joined the house`, 'system');
    } else if (evt.type === 'SURVIVOR_LEFT') {
      this.logEvent(`🚪 ${evt.name} left the house`, 'system');
    }
  }

  updateHUD(snapshot) {
    // In-Game Time & Icon
    if (this.clockLabel) {
      const timeStr = snapshot.inGameTime || '7:30 PM';
      const icon = snapshot.timeIcon || '🌇';
      this.clockLabel.textContent = `${icon} ${timeStr}`;
    }

    // Win Streak
    if (this.streakLabel) {
      const streak = snapshot.winStreak || 0;
      this.streakLabel.textContent = `🏆 ${streak}`;
      this.streakLabel.style.color = streak > 0 ? '#4ade80' : '#94a3b8';
    }

    // Wave & State Label
    if (snapshot.waveState === 'VICTORY') {
      this.waveLabel.textContent = `VICTORY (Next: ${snapshot.victoryTimer}s)`;
    } else if (snapshot.waveState === 'GAME_OVER') {
      this.waveLabel.textContent = `DEFEAT (Restart: ${snapshot.gameOverTimer}s)`;
    } else if (snapshot.waveState === 'INTERMISSION') {
      const maxW = snapshot.endlessMode ? '∞' : (snapshot.maxCampaignWaves || 24);
      this.waveLabel.textContent = `Wave ${snapshot.wave}/${maxW} (${snapshot.intermissionTimer}s)`;
    } else {
      const maxW = snapshot.endlessMode ? '∞' : (snapshot.maxCampaignWaves || 24);
      this.waveLabel.textContent = `Wave ${snapshot.wave}/${maxW}`;
    }

    this.zombiesLabel.textContent = `${snapshot.zombiesRemaining}`;

    // Auto wave & Endless Button States
    if (this.btnToggleAutoWave) {
      this.btnToggleAutoWave.textContent = `🔁 Auto: ${snapshot.autoWave ? 'ON' : 'OFF'}`;
      this.btnToggleAutoWave.style.borderColor = snapshot.autoWave ? '#22c55e' : '#64748b';
    }
    if (this.btnToggleEndless) {
      this.btnToggleEndless.textContent = `♾️ Endless: ${snapshot.endlessMode ? 'ON' : 'OFF'}`;
      this.btnToggleEndless.style.borderColor = snapshot.endlessMode ? '#a855f7' : '#64748b';
    }

    // Progression
    if (snapshot.progression) {
      const p = snapshot.progression;
      this.houseLevelLabel.textContent = `LVL ${p.level}`;
      this.xpFill.style.width = `${Math.min(100, Math.round(p.xpProgress * 100))}%`;
      this.xpText.textContent = `${p.currentXp} / ${p.xpForNextLevel} XP`;

      // Update Perks Badges
      this.perksContainer.innerHTML = '';
      for (const perk of p.activePerks) {
        const b = document.createElement('div');
        b.className = 'perk-badge';
        b.innerHTML = `<span>${perk.icon}</span> <span>${perk.name}</span>`;
        this.perksContainer.appendChild(b);
      }
    }

    // Survivor Squad List & Command Target Select Options
    if (snapshot.survivors) {
      this.renderSurvivorList(snapshot.survivors);
      this.updateCommandTargets(snapshot.survivors);
    }
  }

  renderSurvivorList(survivors) {
    this.survivorList.innerHTML = '';

    for (const s of survivors) {
      const card = document.createElement('div');
      card.className = 'survivor-card';

      const hpPercent = Math.max(0, Math.min(100, (s.hp / s.maxHp) * 100));
      const statusText = s.isAlive ? (s.stateDetail || s.state) : 'DOWNED';
      const statusPillClass = s.isAlive ? '' : 'style="background: rgba(239,68,68,0.2); color: #f87171;"';

      card.innerHTML = `
        <div class="survivor-card-top">
          <div class="survivor-name-tag">
            <span class="survivor-color-pip" style="background-color: ${s.color};"></span>
            <span>${s.name}</span>
            <span style="font-size: 0.65rem; color: var(--text-muted);">[${s.role || 'SURVIVOR'}]</span>
          </div>
          <span class="survivor-status-pill" ${statusPillClass}>${statusText}</span>
        </div>
        <div class="survivor-hp-bar">
          <div class="survivor-hp-fill" style="width: ${hpPercent}%; background: ${hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#eab308' : '#ef4444'};"></div>
        </div>
        <div class="survivor-meta">
          <span>HP: ${Math.round(s.hp)}/${s.maxHp}</span>
          <span>⚔️ ${s.kills} Kills</span>
          <span>🔨 ${s.repairsCount} Reps</span>
        </div>
      `;

      this.survivorList.appendChild(card);
    }
  }

  updateCommandTargets(survivors) {
    const currentVal = this.commandTargetSelect.value;
    const existingIds = Array.from(this.commandTargetSelect.options).map(o => o.value);
    const newIds = survivors.map(s => s.id);

    // Only redraw options if members changed
    if (JSON.stringify(existingIds) !== JSON.stringify(newIds)) {
      this.commandTargetSelect.innerHTML = '';
      for (const s of survivors) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.guardStation || 'Station'})`;
        this.commandTargetSelect.appendChild(opt);
      }
      if (survivors.some(s => s.id === currentVal)) {
        this.commandTargetSelect.value = currentVal;
      }
    }
  }

  showPerkModal(offeredPerks) {
    if (!offeredPerks || !offeredPerks.length) return;
    this.perkOptions.innerHTML = '';

    for (const perk of offeredPerks) {
      const btn = document.createElement('button');
      btn.className = 'perk-option-btn';
      btn.innerHTML = `
        <div class="perk-option-icon">${perk.icon}</div>
        <div class="perk-option-name">${perk.name}</div>
        <div class="perk-option-desc">${perk.desc}</div>
      `;
      btn.onclick = () => {
        this.send({ type: 'SELECT_PERK', perkId: perk.id });
        this.hidePerkModal();
      };
      this.perkOptions.appendChild(btn);
    }

    this.perkModal.classList.add('active');
  }

  hidePerkModal() {
    this.perkModal.classList.remove('active');
  }

  logEvent(text, type = 'normal') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.textContent = `[${time}] ${text}`;
    this.eventLog.appendChild(entry);
    this.eventLog.scrollTop = this.eventLog.scrollHeight;
  }

  initEventListeners() {
    // Add Survivor
    document.getElementById('btnAddSurvivor').onclick = () => {
      const nameInput = document.getElementById('survivorNameInput');
      const name = nameInput.value.trim() || `Survivor_${Math.floor(Math.random() * 100)}`;
      this.send({ type: 'ADD_SURVIVOR', name });
      nameInput.value = '';
    };

    // Wave / Zombies Controls
    document.getElementById('btnSpawnWave').onclick = () => this.send({ type: 'SPAWN_WAVE' });
    document.getElementById('btnSpawnBrute').onclick = () => this.send({ type: 'SPAWN_ZOMBIE', zombieType: 'brute' });
    document.getElementById('btnKillZombies').onclick = () => this.send({ type: 'KILL_ZOMBIES' });
    
    // Auto Wave & Endless Mode Toggles
    if (this.btnToggleAutoWave) {
      this.btnToggleAutoWave.onclick = () => this.send({ type: 'TOGGLE_AUTO_WAVE' });
    }
    if (this.btnToggleEndless) {
      this.btnToggleEndless.onclick = () => this.send({ type: 'TOGGLE_ENDLESS_MODE' });
    }

    // Barricade Damage Controls
    document.getElementById('btnDamageNorthWin').onclick = () => this.send({ type: 'DAMAGE_BARRICADE', barricadeId: 'win_north', damage: 35 });
    document.getElementById('btnDamageSouthWin').onclick = () => this.send({ type: 'DAMAGE_BARRICADE', barricadeId: 'win_south', damage: 35 });
    document.getElementById('btnDamageWestWin').onclick = () => this.send({ type: 'DAMAGE_BARRICADE', barricadeId: 'win_west', damage: 35 });
    document.getElementById('btnDamageEastWin').onclick = () => this.send({ type: 'DAMAGE_BARRICADE', barricadeId: 'win_east', damage: 35 });
    document.getElementById('btnDamageDoor').onclick = () => this.send({ type: 'DAMAGE_BARRICADE', barricadeId: 'door_main', damage: 50 });
    document.getElementById('btnRepairAll').onclick = () => {
      for (const id of ['win_north', 'win_south', 'win_west', 'win_east', 'door_main']) {
        this.send({ type: 'REPAIR_BARRICADE', barricadeId: id, amount: 100 });
      }
    };

    // Reset Game
    document.getElementById('btnResetGame').onclick = () => this.send({ type: 'RESET_GAME' });

    // Perk Mode Toggle
    document.getElementById('perkModeSelect').onchange = (e) => {
      this.send({ type: 'SET_PERK_MODE', mode: e.target.value });
    };

    // Discord Chat Command Simulator
    document.getElementById('btnSendCommand').onclick = () => {
      const playerId = this.commandTargetSelect.value;
      const cmdInput = document.getElementById('chatCommandInput');
      const command = cmdInput.value.trim();
      if (playerId && command) {
        this.send({ type: 'SEND_COMMAND', playerId, command });
        this.logEvent(`💬 Sent "${command}" to ${this.commandTargetSelect.options[this.commandTargetSelect.selectedIndex].text}`, 'system');
        cmdInput.value = '';
      }
    };

    // Quick Command Buttons
    document.querySelectorAll('.quick-cmd-btn').forEach(btn => {
      btn.onclick = () => {
        const cmd = btn.getAttribute('data-cmd');
        const playerId = this.commandTargetSelect.value;
        if (playerId && cmd) {
          this.send({ type: 'SEND_COMMAND', playerId, command: cmd });
          this.logEvent(`💬 Quick command: "${cmd}"`, 'system');
        }
      };
    });

    // OBS Stream Mode Toggle
    const btnStreamMode = document.getElementById('btnToggleStreamMode');
    btnStreamMode.onclick = () => {
      document.body.classList.toggle('stream-mode');
      const isStream = document.body.classList.contains('stream-mode');
      btnStreamMode.textContent = isStream ? 'Exit Stream Mode' : 'OBS Stream Mode';
      this.renderer.setupCanvasSize();
    };
  }

  startRenderLoop() {
    const loop = () => {
      this.renderer.render(this.latestSnapshot);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameClient = new GameClient();
});
