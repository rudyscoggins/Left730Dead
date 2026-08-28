/**
 * Progression & Rogue-lite Perk System for Left 730 Dead
 */

export const PERK_POOL = [
  // Fortification
  { id: 'rapid_carpentry', name: 'Rapid Carpentry', category: 'Fortification', desc: '+50% Barricade Repair Speed', icon: '🔨', apply: (mods) => { mods.repairSpeedMultiplier += 0.5; } },
  { id: 'reinforced_planks', name: 'Reinforced Planks', category: 'Fortification', desc: '+30 Max Barricade HP & heals all barricades +25 HP', icon: '🧱', apply: (mods, state) => { mods.maxBarricadeHpMultiplier += 0.3; if (state) state.boostBarricadeHp(25); } },
  { id: 'iron_spikes', name: 'Spiked Barricades', category: 'Fortification', desc: 'Zombies attacking barricades take 5 reflected damage', icon: '🪓', apply: (mods) => { mods.thornsDamage += 5; } },
  
  // Combat
  { id: 'sharpened_blades', name: 'Sharpened Blades', category: 'Combat', desc: '+40% Melee Attack Damage', icon: '⚔️', apply: (mods) => { mods.damageMultiplier += 0.4; } },
  { id: 'sweeping_strikes', name: 'Sweeping Strikes', category: 'Combat', desc: 'Attacks can hit up to 2 zombies simultaneously', icon: '🌪️', apply: (mods) => { mods.cleaveCount += 1; } },
  { id: 'heavy_impact', name: 'Heavy Impact', category: 'Combat', desc: 'Attacks knock zombies back 1 tile', icon: '💥', apply: (mods) => { mods.knockbackForce += 1.0; } },

  // Mobility & Economy
  { id: 'adrenaline_rush', name: 'Adrenaline Rush', category: 'Mobility', desc: '+25% Survivor Movement Speed', icon: '⚡', apply: (mods) => { mods.moveSpeedMultiplier += 0.25; } },
  { id: 'scavenger_bounty', name: 'Scavenger Bounty', category: 'Economy', desc: '+35% Shared House XP gains from all sources', icon: '⭐', apply: (mods) => { mods.xpMultiplier += 0.35; } },

  // Survival
  { id: 'medic_bandages', name: 'Medic Bandages', category: 'Survival', desc: 'Survivors passively regenerate 1.5 HP/sec & heal +20 HP instantly', icon: '🩹', apply: (mods, state) => { mods.passiveRegen += 1.5; if (state) state.healAllSurvivors(20); } },
  { id: 'supply_drop', name: 'Supply Cache', category: 'Survival', desc: 'Zombies have 2x higher chance to drop Health Packs', icon: '📦', apply: (mods) => { mods.dropRateMultiplier += 1.0; } }
];

export class ProgressionSystem {
  constructor(engine) {
    this.engine = engine;
    this.level = 1;
    this.currentXp = 0;
    this.xpForNextLevel = this.calculateXpForLevel(1);
    this.activePerks = [];
    this.pendingPerkSelection = null;
    this.perkMode = 'AUTOPILOT'; // 'AUTOPILOT' | 'DRIVEN'
    this.autopilotDelayMs = 1500;
    this.autopilotTicksRemaining = 0;
    
    // Global gameplay modifiers modified by perks
    this.modifiers = {
      repairSpeedMultiplier: 1.0,
      maxBarricadeHpMultiplier: 1.0,
      damageMultiplier: 1.0,
      cleaveCount: 1,
      knockbackForce: 0.0,
      moveSpeedMultiplier: 1.0,
      xpMultiplier: 1.0,
      passiveRegen: 0.0,
      dropRateMultiplier: 1.0,
      thornsDamage: 0
    };
  }

  calculateXpForLevel(lvl) {
    return Math.floor(100 * Math.pow(1.35, lvl - 1));
  }

  addXp(amount, source = 'action') {
    const finalAmount = Math.round(amount * this.modifiers.xpMultiplier);
    this.currentXp += finalAmount;

    while (this.currentXp >= this.xpForNextLevel) {
      this.currentXp -= this.xpForNextLevel;
      this.level++;
      this.xpForNextLevel = this.calculateXpForLevel(this.level);
      this.triggerLevelUp();
    }

    return finalAmount;
  }

  triggerLevelUp() {
    // Pick 3 random distinct perks from pool
    const available = PERK_POOL.filter(p => !this.activePerks.some(a => a.id === p.id));
    const pool = available.length >= 3 ? available : PERK_POOL;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const offered = shuffled.slice(0, Math.min(3, shuffled.length));

    this.pendingPerkSelection = {
      level: this.level,
      offeredPerks: offered,
      offeredTime: Date.now()
    };

    this.engine.broadcastEvent({
      type: 'LEVEL_UP',
      level: this.level,
      offeredPerks: offered
    });

    if (this.perkMode === 'AUTOPILOT') {
      this.autopilotTicksRemaining = Math.max(1, Math.round((this.autopilotDelayMs / 1000) * this.engine.tps));
    }
  }

  tick() {
    if (this.pendingPerkSelection && this.perkMode === 'AUTOPILOT' && this.autopilotTicksRemaining > 0) {
      this.autopilotTicksRemaining--;
      if (this.autopilotTicksRemaining <= 0) {
        const offered = this.pendingPerkSelection.offeredPerks;
        if (offered && offered.length > 0) {
          const randomIndex = Math.floor(Math.random() * offered.length);
          this.selectPerk(offered[randomIndex].id, 'AUTOPILOT');
        }
      }
    }
  }

  selectPerk(perkId, source = 'DRIVEN') {
    const perk = PERK_POOL.find(p => p.id === perkId);
    if (!perk) return false;

    this.activePerks.push({
      id: perk.id,
      name: perk.name,
      category: perk.category,
      desc: perk.desc,
      icon: perk.icon,
      acquiredAtLevel: this.level
    });

    // Apply modifier effects
    perk.apply(this.modifiers, this.engine);

    this.engine.broadcastEvent({
      type: 'PERK_ACQUIRED',
      perk: perk,
      source: source,
      activePerks: this.activePerks
    });

    this.pendingPerkSelection = null;
    this.autopilotTicksRemaining = 0;
    return true;
  }

  setPerkMode(mode) {
    if (mode === 'AUTOPILOT' || mode === 'DRIVEN') {
      this.perkMode = mode;
      return true;
    }
    return false;
  }

  reset() {
    this.level = 1;
    this.currentXp = 0;
    this.xpForNextLevel = this.calculateXpForLevel(1);
    this.activePerks = [];
    this.pendingPerkSelection = null;
    this.autopilotTicksRemaining = 0;
    this.modifiers = {
      repairSpeedMultiplier: 1.0,
      maxBarricadeHpMultiplier: 1.0,
      damageMultiplier: 1.0,
      cleaveCount: 1,
      knockbackForce: 0.0,
      moveSpeedMultiplier: 1.0,
      xpMultiplier: 1.0,
      passiveRegen: 0.0,
      dropRateMultiplier: 1.0,
      thornsDamage: 0
    };
  }

  isPausedForPerk() {
    return !!(this.pendingPerkSelection && this.perkMode === 'DRIVEN');
  }

  toJSON() {
    return {
      level: this.level,
      currentXp: this.currentXp,
      xpForNextLevel: this.xpForNextLevel,
      xpProgress: this.xpForNextLevel > 0 ? this.currentXp / this.xpForNextLevel : 0,
      activePerks: this.activePerks,
      pendingPerkSelection: this.pendingPerkSelection,
      perkMode: this.perkMode,
      isPaused: this.isPausedForPerk(),
      modifiers: this.modifiers
    };
  }
}
