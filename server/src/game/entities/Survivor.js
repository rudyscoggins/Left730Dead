/**
 * Survivor Entity Controller (Distributed Autonomous AI + Manual Command Queue)
 * Clean, robust decision pipeline preventing deadlocks, enforcing house defense,
 * and preventing player clipping with dynamic obstacle avoidance and slot distribution.
 */

import { Pathfinding } from '../Pathfinding.js';
import { ROOMS } from '../Map.js';

export const SURVIVOR_STATES = {
  IDLE: 'IDLE',
  REPAIRING: 'REPAIRING',
  ATTACKING: 'ATTACKING',
  MANUAL: 'MANUAL',
  MOVING: 'MOVING',
  GUARDING: 'GUARDING',
  LOOTING: 'LOOTING',
  DEAD: 'DEAD'
};

const SURVIVOR_ROLES = ['CARPENTER', 'SENTINEL', 'SLAYER', 'SCAVENGER'];

const SURVIVOR_COLORS = [
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#10b981'  // Emerald
];

export const GUARD_STATIONS = [
  { name: 'Living Room', x: 7.5, y: 7.5 },
  { name: 'Armory', x: 12.5, y: 7.5 },
  { name: 'Kitchen', x: 7.5, y: 12.5 },
  { name: 'Workshop', x: 12.5, y: 12.5 },
  { name: 'Central Hall', x: 10.0, y: 10.0 }
];

// Slotted interior positions adjacent to barricades so multiple survivors don't overlap
export const BARRICADE_DEFENSE_SLOTS = {
  win_north: [
    { x: 7.0, y: 5.5 },
    { x: 8.0, y: 5.5 },
    { x: 7.5, y: 6.3 }
  ],
  win_south: [
    { x: 7.0, y: 14.5 },
    { x: 8.0, y: 14.5 },
    { x: 7.5, y: 13.7 }
  ],
  win_west: [
    { x: 5.5, y: 9.0 },
    { x: 5.5, y: 10.0 },
    { x: 6.3, y: 9.5 }
  ],
  win_east: [
    { x: 14.5, y: 9.0 },
    { x: 14.5, y: 10.0 },
    { x: 13.7, y: 9.5 }
  ],
  door_main: [
    { x: 11.8, y: 14.5 },
    { x: 12.8, y: 14.5 },
    { x: 12.3, y: 13.7 }
  ]
};

// Legacy fallback dictionary for single points
export const BARRICADE_DEFENSE_SPOTS = {
  win_north: { x: 7.5, y: 5.5 },
  win_south: { x: 7.5, y: 14.5 },
  win_west: { x: 5.5, y: 9.5 },
  win_east: { x: 14.5, y: 9.5 },
  door_main: { x: 12.5, y: 14.5 }
};

// 730 Society Human Customization Options
export const HAIR_COLORS = [
  '#dc2626', // Vibrant Red
  '#b45309', // Auburn
  '#78350f', // Brunette
  '#1c1917', // Dark/Black
  '#fbbf24', // Blonde
  '#94a3b8'  // Silver/Grey
];
export const HAIR_STYLES = ['short', 'fade', 'mohawk', 'messy', 'afro', 'bald'];
export const FACIAL_HAIR = ['full_beard', 'goatee', 'mustache', 'stubble', 'clean'];
export const EYEWEAR = ['none', 'glasses', 'sunglasses', 'goggles'];
export const HEADWEAR = ['none', 'cap_730', 'beanie', 'beret', 'bandana'];
export const OUTFITS = ['leather_jacket', 'flannel_vest', 'camo_tactical', 'heavy_armor', 'hoodie'];
export const SKIN_TONES = ['#fde68a', '#fcd34d', '#fbbf24', '#d97706', '#b45309', '#78350f'];

export function generateSurvivorAppearance(name = '', role = 'SURVIVOR', custom = {}) {
  const isHost = name.toLowerCase().includes('rudy');
  
  if (isHost) {
    return {
      hairColor: '#1c1917',
      hairStyle: 'short',
      facialHair: 'full_beard',
      eyewear: 'none',
      headwear: 'cap_730',
      outfit: 'leather_jacket',
      skinTone: '#fde68a',
      ...custom
    };
  }

  // Deterministic seed hash from survivor name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  let hairColor = custom.hairColor || HAIR_COLORS[hash % HAIR_COLORS.length];
  let hairStyle = custom.hairStyle || HAIR_STYLES[(hash >> 2) % HAIR_STYLES.length];
  let facialHair = custom.facialHair || FACIAL_HAIR[(hash >> 4) % FACIAL_HAIR.length];
  let skinTone = custom.skinTone || SKIN_TONES[(hash >> 6) % SKIN_TONES.length];

  // Thematic role defaults with hashed variety
  let headwear = custom.headwear || 'none';
  let eyewear = custom.eyewear || 'none';
  let outfit = custom.outfit || 'leather_jacket';

  if (role === 'CARPENTER') {
    headwear = 'goggles';
    outfit = 'flannel_vest';
  } else if (role === 'SENTINEL') {
    eyewear = (hash % 2 === 0) ? 'glasses' : 'sunglasses';
    outfit = 'camo_tactical';
    headwear = (hash % 3 === 0) ? 'beret' : 'none';
  } else if (role === 'SLAYER') {
    headwear = 'bandana';
    outfit = 'heavy_armor';
    if (!custom.hairColor) hairColor = '#dc2626'; // Often red/flaming
  } else if (role === 'SCAVENGER') {
    eyewear = 'sunglasses';
    outfit = 'hoodie';
    headwear = (hash % 2 === 0) ? 'beanie' : 'none';
  } else {
    headwear = HEADWEAR[(hash >> 8) % HEADWEAR.length];
    eyewear = EYEWEAR[(hash >> 10) % EYEWEAR.length];
    outfit = OUTFITS[(hash >> 12) % OUTFITS.length];
  }

  return {
    hairColor,
    hairStyle,
    facialHair,
    eyewear,
    headwear,
    outfit,
    skinTone,
    ...custom
  };
}

export class Survivor {
  constructor(config = {}) {
    this.id = config.id || `survivor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.name = config.name || 'Survivor';
    this.discordId = config.discordId ? String(config.discordId) : null;
    this.avatarUrl = config.avatarUrl || null;
    this.color = config.color || SURVIVOR_COLORS[Math.floor(Math.random() * SURVIVOR_COLORS.length)];
    
    // Assign squad role personality & defensive station
    this.role = config.role || SURVIVOR_ROLES[Math.floor(Math.random() * SURVIVOR_ROLES.length)];
    this.guardStation = config.guardStation || GUARD_STATIONS[Math.floor(Math.random() * GUARD_STATIONS.length)];

    // 730 Society Appearance Attributes
    this.appearance = generateSurvivorAppearance(this.name, this.role, config.appearance || {});

    this.x = config.x !== undefined ? config.x : 10.0;
    this.y = config.y !== undefined ? config.y : 10.0;
    this.facingDir = 1; // 1 = right, -1 = left
    this.maxHp = 150;
    this.hp = this.maxHp;
    this.baseSpeed = 2.8; // tiles / sec
    this.baseDamage = 36;
    this.attackRange = 1.5; // tiles
    this.aggroRange = this.role === 'SLAYER' ? 5.0 : 3.8; // tiles
    this.repairRange = 1.8; // tiles
    this.attackCooldown = 0.65; // seconds
    this.attackCooldownTimer = 0.0;

    this.state = SURVIVOR_STATES.IDLE;
    this.stateDetail = 'Guarding';
    this.aimAngle = 0.0;
    this.targetBarricadeId = null;
    this.targetZombieId = null;
    this.targetLootId = null;
    this.path = [];
    this.pathIndex = 0;

    // Manual Command Queue & Timeout
    this.manualCommand = null;
    this.manualTicksRemaining = 0;
    this.kills = 0;
    this.repairsCount = 0;
  }

  isAlive() {
    return this.hp > 0;
  }

  takeDamage(amount) {
    if (!this.isAlive()) return 0;
    const actual = Math.min(this.hp, amount);
    this.hp -= actual;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = SURVIVOR_STATES.DEAD;
      this.stateDetail = 'Downed';
      this.path = [];
    }
    return actual;
  }

  heal(amount) {
    if (!this.isAlive()) return 0;
    const missing = this.maxHp - this.hp;
    const actual = Math.min(missing, amount);
    this.hp += actual;
    return actual;
  }

  getBarricadeSlot(barricadeId, engine) {
    const slots = BARRICADE_DEFENSE_SLOTS[barricadeId] || [{ x: 7.5, y: 7.5 }];
    // 1. First search for an unoccupied slot
    for (const slot of slots) {
      const occupied = engine.survivors.some(s => s.id !== this.id && s.isAlive() && Math.hypot(s.x - slot.x, s.y - slot.y) < 0.65);
      if (!occupied) return slot;
    }
    // 2. Fallback to index-based distribution
    const idx = engine.survivors.findIndex(s => s.id === this.id);
    return slots[Math.max(0, idx) % slots.length];
  }

  getGuardStationTarget(station, engine) {
    if (!station) return { x: 10.0, y: 10.0 };
    const roomSurvivors = engine.survivors.filter(s => s.isAlive() && (s.guardStation?.name === station.name || s.id === this.id));
    if (roomSurvivors.length <= 1) return { x: station.x, y: station.y };

    const survivorIdx = roomSurvivors.findIndex(s => s.id === this.id);
    const angle = (Math.max(0, survivorIdx) * (Math.PI * 2 / roomSurvivors.length)) + 0.35;
    const radius = 0.85;
    const targetX = station.x + Math.cos(angle) * radius;
    const targetY = station.y + Math.sin(angle) * radius;

    if (engine.map && engine.map.isPositionWalkable(targetX, targetY, 0.35)) {
      return { x: targetX, y: targetY };
    }
    return { x: station.x, y: station.y };
  }

  executeManualCommand(commandObj, engine) {
    this.manualCommand = commandObj;
    this.manualTicksRemaining = Math.floor(5 * engine.tps); // 5 seconds in ticks
    this.state = SURVIVOR_STATES.MANUAL;

    const { command, args, targetRoom, targetBarricade, targetPlayer, targetLoot } = commandObj;

    if (command === '!go' && targetRoom) {
      this.stateDetail = `Moving to ${targetRoom.name}`;
      const targetPos = this.getGuardStationTarget(targetRoom, engine);
      this.path = Pathfinding.findPath(this.x, this.y, targetPos.x, targetPos.y, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    } else if (command === '!fix' && targetBarricade) {
      this.stateDetail = `Fixing ${targetBarricade.name}`;
      this.targetBarricadeId = targetBarricade.id;
      const spot = this.getBarricadeSlot(targetBarricade.id, engine);
      this.path = Pathfinding.findPath(this.x, this.y, spot.x, spot.y, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    } else if (command === '!hold' && targetRoom) {
      this.stateDetail = `Holding ${targetRoom.name}`;
      const targetPos = this.getGuardStationTarget(targetRoom, engine);
      this.path = Pathfinding.findPath(this.x, this.y, targetPos.x, targetPos.y, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    } else if (command === '!grab' && targetLoot && engine.map.isInsideHouse(targetLoot.x, targetLoot.y)) {
      this.stateDetail = 'Grabbing loot';
      this.path = Pathfinding.findPath(this.x, this.y, targetLoot.x, targetLoot.y, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    } else if (command === '!help' && targetPlayer) {
      this.stateDetail = `Assisting ${targetPlayer.name}`;
      // Offset target by 0.9 tiles to avoid walking directly onto the player
      const angle = Math.random() * Math.PI * 2;
      const assistX = targetPlayer.x + Math.cos(angle) * 0.85;
      const assistY = targetPlayer.y + Math.sin(angle) * 0.85;
      const finalX = engine.map.isPositionWalkable(assistX, assistY, 0.35) ? assistX : targetPlayer.x;
      const finalY = engine.map.isPositionWalkable(assistX, assistY, 0.35) ? assistY : targetPlayer.y;

      this.path = Pathfinding.findPath(this.x, this.y, finalX, finalY, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    }
  }

  update(dt, engine) {
    if (!this.isAlive()) {
      this.state = SURVIVOR_STATES.DEAD;
      this.stateDetail = 'Downed';
      this.path = [];
      return;
    }

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }

    // Strict containment rule: Keep position locked inside interior house floor
    this.x = Math.max(5.1, Math.min(14.9, this.x));
    this.y = Math.max(5.1, Math.min(14.9, this.y));

    // Passive regeneration perk
    if (engine.progression.modifiers.passiveRegen > 0) {
      this.heal(engine.progression.modifiers.passiveRegen * dt);
    }

    // Handle Manual Command countdown & reversion
    if (this.state === SURVIVOR_STATES.MANUAL) {
      this.manualTicksRemaining--;
      if (this.manualTicksRemaining <= 0) {
        this.state = SURVIVOR_STATES.IDLE;
        this.manualCommand = null;
      }
    }

    // 1. Follow current path if moving
    if (this.path && this.pathIndex < this.path.length) {
      this.moveAlongPath(dt, engine);
      // While moving, check for immediate self-defense if zombie is in melee range
      const opportunityTarget = this.findImmediateMeleeTarget(engine);
      if (opportunityTarget) {
        this.performAttack(opportunityTarget, dt, engine);
      }
      return;
    }

    // 2. If in Manual state and path finished, execute action / defensive hold
    if (this.state === SURVIVOR_STATES.MANUAL) {
      if (this.manualCommand?.command === '!fix' && this.targetBarricadeId) {
        const barricade = engine.barricades.find(b => b.id === this.targetBarricadeId);
        if (barricade && Math.hypot(this.x - (barricade.x + 0.5), this.y - (barricade.y + 0.5)) <= this.repairRange) {
          this.performRepair(barricade, dt, engine);
          this.checkDefensiveAttack(dt, engine);
          return;
        }
      }
      this.checkDefensiveAttack(dt, engine);
      return;
    }

    // 3. Autonomous Decision Tree
    this.runAutonomousAI(dt, engine);
  }

  runAutonomousAI(dt, engine) {
    // -------------------------------------------------------------
    // PRIORITY 1: Immediate Melee Attack (hit anything within reach)
    // -------------------------------------------------------------
    const immediateTarget = this.findImmediateMeleeTarget(engine);
    if (immediateTarget) {
      this.performAttack(immediateTarget, dt, engine);
      this.state = SURVIVOR_STATES.ATTACKING;
      this.stateDetail = `Defending vs ${immediateTarget.type}`;
      return;
    }

    // -------------------------------------------------------------
    // PRIORITY 2: Engage Inside Invaders (Zombies that penetrated house)
    // -------------------------------------------------------------
    const insideZombie = this.findNearestInsideZombie(engine);
    if (insideZombie) {
      this.state = SURVIVOR_STATES.ATTACKING;
      this.stateDetail = `Hunting ${insideZombie.type}`;
      this.path = Pathfinding.findPath(this.x, this.y, insideZombie.x, insideZombie.y, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
      this.moveAlongPath(dt, engine);
      return;
    }

    // -------------------------------------------------------------
    // PRIORITY 3: Loot scavenging (Inside house only)
    // -------------------------------------------------------------
    if (this.hp < 110 || this.role === 'SCAVENGER') {
      const loot = this.findBestLootTarget(engine);
      if (loot) {
        const dist = Math.hypot(this.x - loot.x, this.y - loot.y);
        if (dist <= 1.0) {
          this.state = SURVIVOR_STATES.LOOTING;
          this.stateDetail = 'Collecting Supply';
          return;
        } else {
          this.path = Pathfinding.findPath(this.x, this.y, loot.x, loot.y, engine.map, engine.barricadesMap, false);
          this.pathIndex = 0;
          this.moveAlongPath(dt, engine);
          this.state = SURVIVOR_STATES.MOVING;
          this.stateDetail = 'Grabbing Loot';
          return;
        }
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 4: Repair & Defend Active/Threatened Barricade
    // -------------------------------------------------------------
    const bestBarricade = this.findBestBarricadeTarget(engine);
    if (bestBarricade) {
      const spot = this.getBarricadeSlot(bestBarricade.id, engine);
      const distToSpot = Math.hypot(this.x - spot.x, this.y - spot.y);
      const distToBarricade = Math.hypot(this.x - (bestBarricade.x + 0.5), this.y - (bestBarricade.y + 0.5));

      if (distToSpot <= 0.85 || distToBarricade <= this.repairRange) {
        // Strike any threat near this window
        const threat = engine.zombies.find(z => z.isAlive() && Math.hypot(this.x - z.x, this.y - z.y) <= 2.7);
        if (threat) {
          this.performAttack(threat, dt, engine);
          this.state = SURVIVOR_STATES.ATTACKING;
          this.stateDetail = `Defending vs ${threat.type}`;
          if (bestBarricade.hp < bestBarricade.maxHp) {
            this.performRepair(bestBarricade, dt * 0.5, engine);
          }
        } else if (bestBarricade.hp < bestBarricade.maxHp) {
          this.performRepair(bestBarricade, dt, engine);
          this.state = SURVIVOR_STATES.REPAIRING;
          this.stateDetail = `Fixing ${bestBarricade.name}`;
        } else {
          this.state = SURVIVOR_STATES.GUARDING;
          this.stateDetail = `Guarding ${bestBarricade.name}`;
        }
        return;
      } else {
        if (this.targetBarricadeId !== bestBarricade.id || !this.path || this.path.length === 0) {
          this.targetBarricadeId = bestBarricade.id;
          this.path = Pathfinding.findPath(this.x, this.y, spot.x, spot.y, engine.map, engine.barricadesMap, false);
          this.pathIndex = 0;
        }
        this.moveAlongPath(dt, engine);
        this.state = SURVIVOR_STATES.MOVING;
        this.stateDetail = `Moving to fix ${bestBarricade.name}`;
        return;
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 5: Guard Sector / Spread Out to Assigned Station
    // -------------------------------------------------------------
    const station = this.guardStation || GUARD_STATIONS[0];
    const targetPos = this.getGuardStationTarget(station, engine);
    const stationDist = Math.hypot(this.x - targetPos.x, this.y - targetPos.y);

    if (stationDist > 0.8) {
      if (!this.path || this.path.length === 0) {
        this.path = Pathfinding.findPath(this.x, this.y, targetPos.x, targetPos.y, engine.map, engine.barricadesMap, false);
        this.pathIndex = 0;
      }
      this.moveAlongPath(dt, engine);
      this.state = SURVIVOR_STATES.MOVING;
      this.stateDetail = `Guarding ${station.name}`;
    } else {
      this.state = SURVIVOR_STATES.GUARDING;
      this.stateDetail = `Guarding ${station.name}`;
      this.targetBarricadeId = null;
      this.path = [];
    }
  }

  findImmediateMeleeTarget(engine) {
    let closest = null;

    // Check if stationed at any barricade defense spot
    let isAtDefenseSpot = false;
    for (const slotList of Object.values(BARRICADE_DEFENSE_SLOTS)) {
      for (const spot of slotList) {
        if (Math.hypot(this.x - spot.x, this.y - spot.y) <= 1.2) {
          isAtDefenseSpot = true;
          break;
        }
      }
      if (isAtDefenseSpot) break;
    }

    const maxReach = isAtDefenseSpot ? 2.7 : this.attackRange;
    let minDist = maxReach;

    for (const z of engine.zombies) {
      if (!z.isAlive()) continue;
      const dist = Math.hypot(this.x - z.x, this.y - z.y);
      if (dist <= minDist) {
        minDist = dist;
        closest = z;
      }
    }

    return closest;
  }

  findNearestInsideZombie(engine) {
    let closest = null;
    let minDist = Infinity;

    for (const z of engine.zombies) {
      if (!z.isAlive()) continue;
      if (engine.map.isInsideHouse(z.x, z.y)) {
        const dist = Math.hypot(this.x - z.x, this.y - z.y);
        if (dist < minDist) {
          minDist = dist;
          closest = z;
        }
      }
    }
    return closest;
  }

  findBestBarricadeTarget(engine) {
    let bestBarricade = null;
    let highestScore = -Infinity;

    for (const b of engine.barricades) {
      const bx = b.x + 0.5;
      const by = b.y + 0.5;
      const dist = Math.hypot(this.x - bx, this.y - by);
      const hpMissing = b.maxHp - b.hp;
      const isBreachedBonus = b.isBreached ? 80 : 0;

      // Count nearby zombies menacing this barricade
      let nearbyZombies = 0;
      for (const z of engine.zombies) {
        if (z.isAlive() && Math.hypot(z.x - bx, z.y - by) <= 3.2) {
          nearbyZombies++;
        }
      }

      // If barricade is 100% full and no zombies nearby, skip it
      if (hpMissing <= 0 && nearbyZombies === 0) continue;

      // Count other repairers to spread out defense across different windows
      let otherRepairers = 0;
      for (const s of engine.survivors) {
        if (s.id !== this.id && s.isAlive()) {
          if (s.targetBarricadeId === b.id || b.repairers.has(s.id)) {
            otherRepairers++;
          }
        }
      }

      const roleBonus = this.role === 'CARPENTER' ? 35 : this.role === 'SENTINEL' ? 20 : 0;
      const threatScore = nearbyZombies * 30;
      const score = (hpMissing * 1.0) + isBreachedBonus + threatScore + roleBonus - (dist * 3.5) - (otherRepairers * 70);

      if (score > highestScore) {
        highestScore = score;
        bestBarricade = b;
      }
    }

    return bestBarricade;
  }

  findBestLootTarget(engine) {
    if (!engine.lootDrops || engine.lootDrops.length === 0) return null;

    let closest = null;
    let minDist = Infinity;

    for (const loot of engine.lootDrops) {
      if (!engine.map.isInsideHouse(loot.x, loot.y)) continue;
      
      const dist = Math.hypot(this.x - loot.x, this.y - loot.y);
      if (dist < minDist && dist < 9.0) {
        minDist = dist;
        closest = loot;
      }
    }

    return closest;
  }

  performAttack(zombie, dt, engine) {
    if (this.attackCooldownTimer <= 0) {
      this.attackCooldownTimer = this.attackCooldown;
      this.aimAngle = Math.atan2(zombie.y - this.y, zombie.x - this.x);
      const damage = Math.round(this.baseDamage * engine.progression.modifiers.damageMultiplier);
      const killed = engine.applyDamageToZombie(zombie, damage, this);
      
      // Knockback perk / base small knockback
      const knockForce = (engine.progression.modifiers.knockbackForce || 0) + 0.35;
      const dx = zombie.x - this.x;
      const dy = zombie.y - this.y;
      const len = Math.hypot(dx, dy) || 1;
      zombie.x += (dx / len) * knockForce;
      zombie.y += (dy / len) * knockForce;

      // Cleave perk
      if (engine.progression.modifiers.cleaveCount > 1) {
        const cleaveTargets = engine.zombies.filter(z => z.id !== zombie.id && Math.hypot(this.x - z.x, this.y - z.y) <= this.attackRange + 0.6);
        for (let i = 0; i < Math.min(cleaveTargets.length, engine.progression.modifiers.cleaveCount - 1); i++) {
          engine.applyDamageToZombie(cleaveTargets[i], Math.round(damage * 0.65), this);
        }
      }

      if (killed) {
        this.kills++;
      }
    }
  }

  performRepair(barricade, dt, engine) {
    barricade.addRepairer(this.id);
    this.aimAngle = Math.atan2((barricade.y + 0.5) - this.y, (barricade.x + 0.5) - this.x);
    const baseRepairPerSec = 22;
    const roleMultiplier = this.role === 'CARPENTER' ? 1.4 : 1.0;
    const repairAmount = baseRepairPerSec * roleMultiplier * engine.progression.modifiers.repairSpeedMultiplier * dt;
    const actual = barricade.repair(repairAmount);

    if (actual > 0) {
      this.repairsCount++;
      engine.progression.addXp(0.25, 'repair');
      
      engine.addCombatEvent({
        type: 'REPAIR',
        targetId: barricade.id,
        survivorId: this.id,
        amount: Math.round(actual * 10) / 10,
        x: barricade.x + 0.5,
        y: barricade.y + 0.5
      });
    }
  }

  checkDefensiveAttack(dt, engine) {
    const target = this.findImmediateMeleeTarget(engine);
    if (target) {
      this.performAttack(target, dt, engine);
    }
  }

  moveAlongPath(dt, engine) {
    if (!this.path || this.pathIndex >= this.path.length) {
      this.path = [];
      return;
    }

    const targetNode = this.path[this.pathIndex];
    const speed = this.baseSpeed * engine.progression.modifiers.moveSpeedMultiplier;
    let dx = targetNode.x - this.x;
    let dy = targetNode.y - this.y;
    let dist = Math.hypot(dx, dy);

    if (dist < 0.28) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.path = [];
        return;
      }
      return;
    }

    // Direct movement vector
    let vx = (dx / dist) * speed;
    let vy = (dy / dist) * speed;

    // Dynamic obstacle avoidance against other living survivors
    for (const other of engine.survivors) {
      if (other.id === this.id || !other.isAlive()) continue;

      const toOtherX = other.x - this.x;
      const toOtherY = other.y - this.y;
      const otherDist = Math.hypot(toOtherX, toOtherY);

      if (otherDist > 0.02 && otherDist < 0.95) {
        // Dot product to check if other survivor is in front of travel
        const dot = (vx * toOtherX + vy * toOtherY) / (speed * otherDist);
        if (dot > 0.25) {
          // Tangent (lateral) steering force to walk around
          const perpX = -toOtherY / otherDist;
          const perpY = toOtherX / otherDist;
          const steerIntensity = (0.95 - otherDist) * 1.4;

          vx += perpX * speed * steerIntensity;
          vy += perpY * speed * steerIntensity;
        }
      }
    }

    // Normalize velocity back to intended speed
    const currentSpeed = Math.hypot(vx, vy);
    if (currentSpeed > 0) {
      vx = (vx / currentSpeed) * speed;
      vy = (vy / currentSpeed) * speed;
      this.aimAngle = Math.atan2(vy, vx);
      this.facingDir = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
    }

    const nextX = this.x + vx * dt;
    const nextY = this.y + vy * dt;

    let moved = false;
    if (engine.map.isPositionWalkable(nextX, nextY, 0.35)) {
      this.x = nextX;
      this.y = nextY;
      moved = true;
    } else if (engine.map.isPositionWalkable(nextX, this.y, 0.35)) {
      this.x = nextX;
      moved = true;
    } else if (engine.map.isPositionWalkable(this.x, nextY, 0.35)) {
      this.y = nextY;
      moved = true;
    }

    // Anti-stuck watchdog
    if (!moved || Math.hypot(this.x - (this.lastMoveX ?? this.x), this.y - (this.lastMoveY ?? this.y)) < 0.01) {
      this.stuckTicks = (this.stuckTicks || 0) + 1;
      if (this.stuckTicks > 12) {
        // Skip current stuck waypoint to glide around obstacles
        this.pathIndex++;
        this.stuckTicks = 0;
        if (this.pathIndex >= this.path.length) {
          this.path = [];
        }
      }
    } else {
      this.stuckTicks = 0;
    }
    this.lastMoveX = this.x;
    this.lastMoveY = this.y;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      discordId: this.discordId,
      avatarUrl: this.avatarUrl,
      color: this.color,
      role: this.role,
      appearance: this.appearance,
      facingDir: this.facingDir || (Math.cos(this.aimAngle || 0) >= 0 ? 1 : -1),
      guardStation: this.guardStation?.name || 'Central Hall',
      x: Math.round(this.x * 100) / 100,
      y: Math.round(this.y * 100) / 100,
      aimAngle: Math.round(this.aimAngle * 100) / 100,
      hp: Math.round(this.hp * 10) / 10,
      maxHp: this.maxHp,
      state: this.state,
      stateDetail: this.stateDetail,
      kills: this.kills,
      repairsCount: this.repairsCount,
      isAlive: this.isAlive()
    };
  }
}
