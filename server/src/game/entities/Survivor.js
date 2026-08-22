/**
 * Survivor Entity Controller (Distributed Autonomous AI + Manual Command Queue)
 * Clean, robust decision pipeline preventing deadlocks and enforcing house defense.
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

// Interior floor positions adjacent to barricades for safe inside repair/defense
export const BARRICADE_DEFENSE_SPOTS = {
  win_north: { x: 7.5, y: 5.5 },
  win_south: { x: 7.5, y: 14.5 },
  win_west: { x: 5.5, y: 9.5 },
  win_east: { x: 14.5, y: 9.5 },
  door_main: { x: 12.5, y: 14.5 }
};

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

    this.x = config.x !== undefined ? config.x : 10.0;
    this.y = config.y !== undefined ? config.y : 10.0;
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

  executeManualCommand(commandObj, engine) {
    this.manualCommand = commandObj;
    this.manualTicksRemaining = Math.floor(5 * engine.tps); // 5 seconds in ticks
    this.state = SURVIVOR_STATES.MANUAL;

    const { command, args, targetRoom, targetBarricade, targetPlayer, targetLoot } = commandObj;

    if (command === '!go' && targetRoom) {
      this.stateDetail = `Moving to ${targetRoom.name}`;
      this.path = Pathfinding.findPath(this.x, this.y, targetRoom.x + 0.5, targetRoom.y + 0.5, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    } else if (command === '!fix' && targetBarricade) {
      this.stateDetail = `Fixing ${targetBarricade.name}`;
      this.targetBarricadeId = targetBarricade.id;
      const spot = BARRICADE_DEFENSE_SPOTS[targetBarricade.id] || { x: targetBarricade.x + 0.5, y: targetBarricade.y + 0.5 };
      this.path = Pathfinding.findPath(this.x, this.y, spot.x, spot.y, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    } else if (command === '!hold' && targetRoom) {
      this.stateDetail = `Holding ${targetRoom.name}`;
      this.path = Pathfinding.findPath(this.x, this.y, targetRoom.x + 0.5, targetRoom.y + 0.5, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    } else if (command === '!grab' && targetLoot && engine.map.isInsideHouse(targetLoot.x, targetLoot.y)) {
      this.stateDetail = 'Grabbing loot';
      this.path = Pathfinding.findPath(this.x, this.y, targetLoot.x, targetLoot.y, engine.map, engine.barricadesMap, false);
      this.pathIndex = 0;
    } else if (command === '!help' && targetPlayer) {
      this.stateDetail = `Assisting ${targetPlayer.name}`;
      this.path = Pathfinding.findPath(this.x, this.y, targetPlayer.x, targetPlayer.y, engine.map, engine.barricadesMap, false);
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
      const spot = BARRICADE_DEFENSE_SPOTS[bestBarricade.id] || { x: bestBarricade.x + 0.5, y: bestBarricade.y + 0.5 };
      const distToSpot = Math.hypot(this.x - spot.x, this.y - spot.y);
      const distToBarricade = Math.hypot(this.x - (bestBarricade.x + 0.5), this.y - (bestBarricade.y + 0.5));

      if (distToSpot <= 0.8 || distToBarricade <= this.repairRange) {
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
    const stationDist = Math.hypot(this.x - station.x, this.y - station.y);

    if (stationDist > 1.2) {
      if (!this.path || this.path.length === 0) {
        this.path = Pathfinding.findPath(this.x, this.y, station.x, station.y, engine.map, engine.barricadesMap, false);
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
    for (const spot of Object.values(BARRICADE_DEFENSE_SPOTS)) {
      if (Math.hypot(this.x - spot.x, this.y - spot.y) <= 1.2) {
        isAtDefenseSpot = true;
        break;
      }
    }

    const maxReach = isAtDefenseSpot ? 2.7 : this.attackRange;
    let minDist = maxReach;

    for (const z of engine.zombies) {
      if (!z.isAlive()) continue;
      const dist = Math.hypot(this.x - z.x, this.y - z.y);
      if (dist <= maxReach && dist < minDist) {
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
      const spot = BARRICADE_DEFENSE_SPOTS[b.id] || { x: bx, y: by };
      const dist = Math.hypot(this.x - spot.x, this.y - spot.y);
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
    const dx = targetNode.x - this.x;
    const dy = targetNode.y - this.y;
    const dist = Math.hypot(dx, dy);

    const step = speed * dt;
    if (dist <= step || dist < 0.2) {
      this.x = Math.max(5.1, Math.min(14.9, targetNode.x));
      this.y = Math.max(5.1, Math.min(14.9, targetNode.y));
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.path = [];
      }
    } else {
      const nextX = this.x + (dx / dist) * step;
      const nextY = this.y + (dy / dist) * step;
      this.x = Math.max(5.1, Math.min(14.9, nextX));
      this.y = Math.max(5.1, Math.min(14.9, nextY));
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      discordId: this.discordId,
      avatarUrl: this.avatarUrl,
      color: this.color,
      role: this.role,
      guardStation: this.guardStation?.name || 'Central Hall',
      x: Math.round(this.x * 100) / 100,
      y: Math.round(this.y * 100) / 100,
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
