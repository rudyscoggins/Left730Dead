/**
 * Authoritative Core Game Engine for Left 730 Dead
 * Dusk to Dawn (7:30 PM -> 7:30 AM) 24-wave Survival Campaign & Endless Mode
 * Calibrated for 25% (1 in 4) Autonomous Win Rate
 */

import { GameMap } from './Map.js';
import { Survivor, SURVIVOR_STATES, GUARD_STATIONS } from './entities/Survivor.js';
import { Zombie, ZOMBIE_TYPES } from './entities/Zombie.js';
import { Barricade } from './entities/Barricade.js';
import { ProgressionSystem } from './ProgressionSystem.js';

export class GameEngine {
  constructor(options = {}) {
    this.tps = options.tps || 25;
    this.tickInterval = 1000 / this.tps;
    this.tickCount = 0;
    this.isRunning = false;
    this.timerId = null;

    this.map = new GameMap(20, 20);
    this.barricades = [];
    this.barricadesMap = new Map(); // "x,y" -> Barricade
    this.survivors = [];
    this.zombies = [];
    this.lootDrops = [];
    this.combatEvents = [];
    this.queuedCommands = new Map(); // playerId -> commandObj

    // Dusk to Dawn Campaign & Progression Mode
    this.maxCampaignWaves = 24; // 24 waves = 12 hours (30 min / wave) = 7:30 PM to 7:30 AM
    this.endlessMode = false;
    this.winStreak = 0;

    this.wave = 1;
    this.waveState = 'INTERMISSION'; // 'INTERMISSION' | 'ACTIVE' | 'VICTORY' | 'GAME_OVER'
    this.intermissionTimer = 7.0; // 7s between waves
    this.intermissionSeconds = 7.0;
    this.autoWave = true;
    this.zombiesToSpawn = 0;
    this.spawnTimerTicks = 0;
    this.spawnIntervalTicks = 35;
    this.gameOverTimer = 0;
    this.victoryTimer = 0;
    this.isDawn = false;

    this.progression = new ProgressionSystem(this);
    this.broadcastCallback = null;
  }

  setBroadcastCallback(fn) {
    this.broadcastCallback = fn;
  }

  setEndlessMode(enabled) {
    this.endlessMode = !!enabled;
    this.broadcastEvent({
      type: 'ENDLESS_MODE_TOGGLED',
      endlessMode: this.endlessMode
    });
  }

  getInGameTime(wave = this.wave, isVictory = (this.waveState === 'VICTORY')) {
    if (isVictory) return '7:30 AM (DAWN)';

    const totalMinutes = (19 * 60 + 30) + ((wave - 1) * 30);
    const day = Math.floor(totalMinutes / (24 * 60)) + 1;
    const minsInDay = totalMinutes % (24 * 60);
    const h24 = Math.floor(minsInDay / 60);
    const mins = minsInDay % 60;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : (h24 > 12 ? h24 - 12 : h24);
    const formattedTime = `${h12}:${mins.toString().padStart(2, '0')} ${period}`;

    if (this.endlessMode && day > 1) {
      return `Night ${day} ${formattedTime}`;
    }
    return formattedTime;
  }

  getTimeIcon(wave = this.wave) {
    if (this.waveState === 'VICTORY' || wave >= 24) return '☀️';
    if (wave <= 4) return '🌇'; // 7:30 PM - 9:00 PM
    if (wave <= 18) return '🌑'; // 9:30 PM - 4:00 AM
    if (wave <= 23) return '🌌'; // 4:30 AM - 6:30 AM
    return '🌅'; // 7:00 AM
  }

  initEntities() {
    this.barricades = [];
    this.barricadesMap.clear();

    for (const cfg of this.map.barricadeConfigs) {
      const b = new Barricade(cfg);
      this.barricades.push(b);
      this.barricadesMap.set(`${b.x},${b.y}`, b);
    }

    // Spawn 2 default demo survivors if empty
    if (this.survivors.length === 0) {
      this.addSurvivor('Rudy (Host)', 'discord_1', '#22c55e', null, 'CARPENTER', GUARD_STATIONS[0]);
      this.addSurvivor('Survivor_730', 'discord_2', '#06b6d4', null, 'SLAYER', GUARD_STATIONS[1]);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.initEntities();

    let lastTime = Date.now();
    this.timerId = setInterval(() => {
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      this.tick(dt);
    }, this.tickInterval);

    console.log(`[GameEngine] Started Left 730 Dead Core Loop @ ${this.tps} TPS`);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timerId);
    this.timerId = null;
    console.log('[GameEngine] Stopped Core Loop');
  }

  addSurvivor(name, discordId = null, color = null, avatarUrl = null, role = null, station = null) {
    const existingIndex = this.survivors.findIndex(s => s.discordId && s.discordId === String(discordId));
    if (existingIndex !== -1) {
      const existing = this.survivors[existingIndex];
      existing.name = name;
      if (avatarUrl) existing.avatarUrl = avatarUrl;
      return existing;
    }

    const spawnIndex = this.survivors.length % this.map.survivorSpawnPoints.length;
    const spawnPos = this.map.survivorSpawnPoints[spawnIndex];
    const stationIndex = this.survivors.length % GUARD_STATIONS.length;

    const survivor = new Survivor({
      id: `s_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      discordId,
      color,
      avatarUrl,
      role: role || (this.survivors.length === 0 ? 'CARPENTER' : 'SLAYER'),
      guardStation: station || GUARD_STATIONS[stationIndex],
      x: spawnPos.x + 0.5,
      y: spawnPos.y + 0.5
    });

    this.survivors.push(survivor);
    this.broadcastEvent({ type: 'SURVIVOR_JOINED', survivor: survivor.toJSON() });
    return survivor;
  }

  removeSurvivor(idOrDiscordId) {
    const idx = this.survivors.findIndex(s => s.id === idOrDiscordId || s.discordId === idOrDiscordId);
    if (idx !== -1) {
      const removed = this.survivors.splice(idx, 1)[0];
      this.broadcastEvent({ type: 'SURVIVOR_LEFT', id: removed.id, name: removed.name });
      return true;
    }
    return false;
  }

  queueCommand(playerId, rawCommand) {
    const parts = rawCommand.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    const commandObj = {
      raw: rawCommand,
      command,
      args,
      targetRoom: null,
      targetBarricade: null,
      targetPlayer: null,
      targetLoot: null
    };

    if (command === '!go' || command === '!hold') {
      commandObj.targetRoom = this.map.findRoomByName(args);
    } else if (command === '!fix') {
      const query = args.toLowerCase();
      commandObj.targetBarricade = this.barricades.find(b => 
        b.name.toLowerCase().includes(query) || b.id.toLowerCase().includes(query)
      ) || this.barricades[0];
    } else if (command === '!help') {
      commandObj.targetPlayer = this.survivors.find(s => 
        s.id !== playerId && s.isAlive() && (s.name.toLowerCase().includes(args.toLowerCase()) || s.hp < s.maxHp)
      ) || this.survivors.find(s => s.id !== playerId && s.isAlive());
    } else if (command === '!grab') {
      commandObj.targetLoot = this.lootDrops[0] || null;
    }

    this.queuedCommands.set(playerId, commandObj);
  }

  spawnZombie(type = null) {
    const spawnIndex = Math.floor(Math.random() * this.map.zombieSpawnPoints.length);
    const spawnPos = this.map.zombieSpawnPoints[spawnIndex];

    // Brutes start spawning at Wave 3+ (scaling up to 35% in late night)
    let resolvedType = type;
    if (!resolvedType) {
      if (this.wave >= 3) {
        const bruteChance = Math.min(0.35, 0.10 + (this.wave - 3) * 0.030);
        resolvedType = Math.random() < bruteChance ? ZOMBIE_TYPES.BRUTE : ZOMBIE_TYPES.SHAMBLER;
      } else {
        resolvedType = ZOMBIE_TYPES.SHAMBLER; // 100% Shamblers in Wave 1 & 2
      }
    }

    const zombie = new Zombie({
      type: resolvedType,
      x: spawnPos.x + 0.5 + (Math.random() * 0.4 - 0.2),
      y: spawnPos.y + 0.5 + (Math.random() * 0.4 - 0.2)
    });

    // Calibrated late-night scaling (Waves 7-24: 10:30 PM to 7:00 AM)
    if (this.wave > 7) {
      const dmgScale = 1 + (this.wave - 7) * 0.019;
      zombie.damage = Math.round(zombie.damage * dmgScale);
      zombie.speed = zombie.speed * (1 + (this.wave - 7) * 0.006);
    }

    this.zombies.push(zombie);
    return zombie;
  }

  startWave(waveNum = this.wave) {
    this.wave = waveNum;
    this.waveState = 'ACTIVE';
    this.isDawn = false;
    
    const activeSurvivors = Math.max(1, this.survivors.filter(s => s.isAlive()).length);

    // Calibrated wave scaling for 1 in 4 (25%) autonomous victory rate
    const lateBonus = this.wave >= 11 ? Math.floor((this.wave - 11) * 1.18) : 0;
    const baseWaveZombies = 3 + Math.floor(this.wave * 2.78) + lateBonus;
    const survivorScaling = (activeSurvivors - 1) * (2 + Math.floor(this.wave * 0.85));
    this.zombiesToSpawn = baseWaveZombies + survivorScaling;
    this.spawnTimerTicks = 0;

    // Spawn interval scales dynamically
    const intervalSec = Math.max(0.37, 1.5 - (activeSurvivors * 0.10) - (this.wave * 0.045));
    this.spawnIntervalTicks = Math.round(intervalSec * this.tps);

    this.broadcastEvent({
      type: 'WAVE_STARTED',
      wave: this.wave,
      inGameTime: this.getInGameTime(this.wave),
      timeIcon: this.getTimeIcon(this.wave),
      totalZombies: this.zombiesToSpawn + this.zombies.length
    });
  }

  applyDamageToZombie(zombie, damage, attacker = null) {
    const dealt = zombie.takeDamage(damage);
    
    this.addCombatEvent({
      type: 'DAMAGE',
      targetId: zombie.id,
      damage: dealt,
      x: zombie.x,
      y: zombie.y,
      sourceX: attacker ? attacker.x : undefined,
      sourceY: attacker ? attacker.y : undefined,
      attackerId: attacker?.id,
      attackerName: attacker?.name,
      attackerRole: attacker?.role,
      targetType: zombie.type,
      color: '#ef4444'
    });

    if (!zombie.isAlive()) {
      // Award XP
      const gainedXp = this.progression.addXp(zombie.xpValue, 'kill');

      this.addCombatEvent({
        type: 'KILL',
        targetId: zombie.id,
        attackerId: attacker?.id,
        attackerName: attacker?.name || 'Squad',
        attackerRole: attacker?.role || 'SURVIVOR',
        targetType: zombie.type,
        xp: gainedXp,
        x: zombie.x,
        y: zombie.y
      });

      // Roll for Loot Drop (Health Pack base 30% * dropRateMultiplier)
      const dropChance = 0.30 * this.progression.modifiers.dropRateMultiplier;
      if (Math.random() < dropChance) {
        this.lootDrops.push({
          id: `loot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          type: 'health',
          amount: 35,
          x: zombie.x,
          y: zombie.y,
          createdTick: this.tickCount
        });
      }

      return true;
    }
    return false;
  }

  healAllSurvivors(amount) {
    for (const s of this.survivors) {
      if (s.isAlive()) {
        s.heal(amount);
      }
    }
  }

  boostBarricadeHp(amount) {
    for (const b of this.barricades) {
      b.repair(amount);
    }
  }

  damageBarricade(id, amount) {
    const b = this.barricades.find(x => x.id === id);
    if (b) {
      b.damage(amount, this.tickCount);
      this.addCombatEvent({
        type: 'BARRICADE_HIT',
        targetId: b.id,
        damage: amount,
        x: b.x + 0.5,
        y: b.y + 0.5
      });
      return true;
    }
    return false;
  }

  killAllZombies() {
    for (const z of this.zombies) {
      z.hp = 0;
    }
  }

  resetGame(preserveStreak = false) {
    if (!preserveStreak) {
      this.winStreak = 0;
    }
    this.wave = 1;
    this.waveState = 'INTERMISSION';
    this.intermissionTimer = this.intermissionSeconds;
    this.gameOverTimer = 0;
    this.victoryTimer = 0;
    this.isDawn = false;
    this.zombies = [];
    this.lootDrops = [];
    this.combatEvents = [];
    this.queuedCommands.clear();
    this.progression.reset();

    for (const b of this.barricades) {
      b.hp = b.maxHp;
      b.isBreached = false;
      b.clearRepairers();
    }

    for (let i = 0; i < this.survivors.length; i++) {
      const s = this.survivors[i];
      const pos = this.map.survivorSpawnPoints[i % this.map.survivorSpawnPoints.length];
      s.x = pos.x + 0.5;
      s.y = pos.y + 0.5;
      s.hp = s.maxHp;
      s.state = SURVIVOR_STATES.IDLE;
      s.stateDetail = 'Guarding';
      s.manualCommand = null;
      s.path = [];
    }

    this.broadcastEvent({ 
      type: 'GAME_RESET',
      winStreak: this.winStreak
    });
  }

  addCombatEvent(evt) {
    this.combatEvents.push({
      ...evt,
      id: `evt_${this.tickCount}_${Math.random()}`,
      tick: this.tickCount
    });
  }

  broadcastEvent(evt) {
    if (this.broadcastCallback) {
      this.broadcastCallback({
        type: 'EVENT',
        event: evt
      });
    }
  }

  tick(dt) {
    this.tickCount++;
    this.combatEvents = []; // Reset transient events per tick

    // 0. Progression Timer Tick (Autopilot perk picking)
    this.progression.tick();

    // 1. Check for Victory Autopilot Countdown
    if (this.waveState === 'VICTORY') {
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0.01) {
        this.resetGame(true); // Preserve win streak
        this.startWave(1);
        return;
      }
    }

    // 2. Check for Squad Wipe / Game Over
    const anySurvivorAlive = this.survivors.some(s => s.isAlive());
    if (!anySurvivorAlive && this.survivors.length > 0) {
      if (this.waveState !== 'GAME_OVER') {
        this.waveState = 'GAME_OVER';
        this.winStreak = 0; // Reset streak on wipe
        this.gameOverTimer = 6.0; // 6 seconds before auto-restart
        this.broadcastEvent({
          type: 'GAME_OVER',
          wave: this.wave,
          inGameTime: this.getInGameTime(this.wave),
          winStreak: 0
        });
      } else {
        this.gameOverTimer -= dt;
        if (this.gameOverTimer <= 0.01) {
          this.resetGame(false);
          this.startWave(1);
          return;
        }
      }
    }

    // 3. Process queued player chat commands
    for (const [playerId, commandObj] of this.queuedCommands.entries()) {
      const survivor = this.survivors.find(s => s.id === playerId || s.discordId === playerId);
      if (survivor && survivor.isAlive()) {
        survivor.executeManualCommand(commandObj, this);
      }
    }
    this.queuedCommands.clear();

    // 4. Update Barricade repairer tracking
    for (const b of this.barricades) {
      b.clearRepairers();
    }

    // 5. Update Survivors
    for (const survivor of this.survivors) {
      survivor.update(dt, this);

      // Check Loot collection
      for (let i = this.lootDrops.length - 1; i >= 0; i--) {
        const loot = this.lootDrops[i];
        if (survivor.isAlive() && Math.hypot(survivor.x - loot.x, survivor.y - loot.y) <= 1.2) {
          if (loot.type === 'health') {
            const healed = survivor.heal(loot.amount);
            this.addCombatEvent({
              type: 'HEAL',
              targetId: survivor.id,
              amount: healed,
              x: survivor.x,
              y: survivor.y
            });
          }
          this.lootDrops.splice(i, 1);
        }
      }
    }

    // 6. Update Zombies
    for (const zombie of this.zombies) {
      zombie.update(dt, this);
    }

    // Clean up dead zombies
    this.zombies = this.zombies.filter(z => z.isAlive());

    // 7. Wave & Spawning Management
    if (this.waveState === 'ACTIVE') {
      if (this.zombiesToSpawn > 0) {
        this.spawnTimerTicks++;
        const requiredTicks = this.spawnIntervalTicks || 35;
        if (this.spawnTimerTicks >= requiredTicks) {
          this.spawnTimerTicks = 0;
          this.spawnZombie();
          this.zombiesToSpawn--;
        }
      } else if (this.zombies.length === 0) {
        // Check if Campaign Victory reached (Wave 24 cleared at 7:30 AM)
        if (!this.endlessMode && this.wave >= this.maxCampaignWaves) {
          this.waveState = 'VICTORY';
          this.isDawn = true;
          this.winStreak++;
          this.victoryTimer = 60.0; // 60 seconds celebration before next night in autopilot

          const victoryXp = this.progression.addXp(500, 'campaign_victory');
          this.healAllSurvivors(100);
          this.boostBarricadeHp(150);

          this.broadcastEvent({
            type: 'VICTORY',
            wave: this.wave,
            inGameTime: '7:30 AM (DAWN)',
            winStreak: this.winStreak,
            xpGained: victoryXp
          });
        } else {
          // Normal Wave cleared!
          this.waveState = 'INTERMISSION';
          this.intermissionTimer = this.intermissionSeconds;
          const waveClearXp = this.progression.addXp(120 * this.wave, 'wave_clear');

          // Post-Wave Squad Field Triage (Heal +35 HP to living survivors & +40 HP to all barricades)
          this.healAllSurvivors(35);
          this.boostBarricadeHp(40);

          this.broadcastEvent({
            type: 'WAVE_CLEARED',
            wave: this.wave,
            inGameTime: this.getInGameTime(this.wave + 1),
            xpGained: waveClearXp
          });
        }
      }
    } else if (this.waveState === 'INTERMISSION' && this.autoWave) {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0.01) {
        this.startWave(this.wave + 1);
      }
    }

    // 8. Broadcast Snapshot
    if (this.broadcastCallback) {
      this.broadcastCallback(this.getSnapshot());
    }
  }

  getSnapshot() {
    return {
      type: 'SNAPSHOT',
      tick: this.tickCount,
      timestamp: Date.now(),
      wave: this.wave,
      waveState: this.waveState,
      inGameTime: this.getInGameTime(this.wave),
      timeIcon: this.getTimeIcon(this.wave),
      isDawn: this.isDawn,
      winStreak: this.winStreak,
      endlessMode: this.endlessMode,
      maxCampaignWaves: this.maxCampaignWaves,
      intermissionTimer: Math.max(0, Math.ceil(this.intermissionTimer)),
      gameOverTimer: Math.max(0, Math.ceil(this.gameOverTimer)),
      victoryTimer: Math.max(0, Math.ceil(this.victoryTimer)),
      autoWave: this.autoWave,
      zombiesRemaining: this.zombies.length + this.zombiesToSpawn,
      zombiesActive: this.zombies.length,
      survivors: this.survivors.map(s => s.toJSON()),
      zombies: this.zombies.map(z => z.toJSON()),
      barricades: this.barricades.map(b => b.toJSON()),
      loot: this.lootDrops,
      progression: this.progression.toJSON(),
      combatEvents: this.combatEvents
    };
  }
}
