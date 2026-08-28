/**
 * Zombie Horde Entity (Shambler & Brute)
 * Robust navigation through breached openings, room doorways, and barricades.
 */

import { Pathfinding } from '../Pathfinding.js';

export const ZOMBIE_TYPES = {
  SHAMBLER: 'shambler',
  BRUTE: 'brute'
};

// Ingress entry vectors for each barricade so zombies step fully inside the house
const BARRICADE_INGRESS_POINTS = {
  win_north: { x: 7.5, y: 5.5 },
  win_south: { x: 7.5, y: 14.5 },
  win_west: { x: 5.5, y: 9.5 },
  win_east: { x: 14.5, y: 9.5 },
  door_main: { x: 12.5, y: 14.5 }
};

export class Zombie {
  constructor(config = {}) {
    this.id = config.id || `zombie_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.type = config.type || (Math.random() < 0.2 ? ZOMBIE_TYPES.BRUTE : ZOMBIE_TYPES.SHAMBLER);
    
    this.x = config.x || 1.5;
    this.y = config.y || 1.5;

    if (this.type === ZOMBIE_TYPES.BRUTE) {
      this.maxHp = 75;
      this.damage = 14;
      this.speed = 0.8;
      this.color = '#7f1d1d';
      this.size = 0.9;
      this.xpValue = 40;
      this.attackCooldown = 1.3;
    } else {
      this.maxHp = 30;
      this.damage = 6;
      this.speed = 1.05;
      this.color = '#ef4444';
      this.size = 0.75;
      this.xpValue = 18;
      this.attackCooldown = 1.1;
    }

    this.hp = this.maxHp;
    this.attackRange = 1.35; // tiles
    this.attackCooldownTimer = 0.0;

    this.state = 'SEEKING_ENTRY';
    this.facingAngle = 0.0;
    this.facingDir = 1; // 1 = right, -1 = left
    this.targetBarricadeId = null;
    this.targetSurvivorId = null;
    
    // Pathfinding state
    this.path = [];
    this.pathIndex = 0;
    this.repathTicks = Math.floor(Math.random() * 10);
  }

  isAlive() {
    return this.hp > 0;
  }

  takeDamage(amount) {
    if (!this.isAlive()) return 0;
    const actual = Math.min(this.hp, amount);
    this.hp -= actual;
    return actual;
  }

  update(dt, engine) {
    if (!this.isAlive()) return;

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }

    this.repathTicks--;

    const isInside = engine.map.isInsideHouse(this.x, this.y);

    // 1. If already inside the house, hunt nearest survivor with A* pathing
    if (isInside) {
      this.huntNearestSurvivor(dt, engine);
      return;
    }

    // 2. If outside, check if adjacent to an unbreached barricade to attack
    const adjacentBarricade = this.findAdjacentIntactBarricade(engine);
    if (adjacentBarricade) {
      this.attackBarricade(adjacentBarricade, dt, engine);
      return;
    }

    // 3. Otherwise, move towards the best entry point (breached window/door or nearest barricade)
    this.moveTowardsEntry(dt, engine);
  }

  findAdjacentIntactBarricade(engine) {
    for (const b of engine.barricades) {
      const bx = b.x + 0.5;
      const by = b.y + 0.5;
      if (!b.isBreached && Math.hypot(this.x - bx, this.y - by) <= 1.35) {
        return b;
      }
    }
    return null;
  }

  attackBarricade(barricade, dt, engine) {
    this.state = 'ATTACKING_BARRICADE';
    this.path = []; // Stop movement while attacking
    
    if (this.attackCooldownTimer <= 0) {
      this.attackCooldownTimer = this.attackCooldown;
      const wasBreached = barricade.isBreached;
      const dmg = barricade.damage(this.damage, engine.tickCount);

      engine.addCombatEvent({
        type: 'BARRICADE_HIT',
        targetId: barricade.id,
        targetName: barricade.name,
        zombieId: this.id,
        zombieType: this.type,
        damage: dmg,
        x: barricade.x + 0.5,
        y: barricade.y + 0.5,
        breached: !wasBreached && barricade.isBreached
      });

      // Spiked barricades perk reflection damage
      if (engine.progression.modifiers.thornsDamage > 0) {
        const thornDmg = engine.progression.modifiers.thornsDamage;
        this.takeDamage(thornDmg);
        engine.addCombatEvent({
          type: 'DAMAGE',
          targetId: this.id,
          damage: thornDmg,
          x: this.x,
          y: this.y,
          color: '#fbbf24'
        });
      }
    }
  }

  huntNearestSurvivor(dt, engine) {
    let nearest = null;
    let minDist = Infinity;

    for (const s of engine.survivors) {
      if (!s.isAlive()) continue;
      const dist = Math.hypot(this.x - s.x, this.y - s.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    }

    if (!nearest) {
      this.state = 'IDLE';
      return;
    }

    // In melee attack range?
    if (minDist <= this.attackRange) {
      this.state = 'ATTACKING_SURVIVOR';
      if (this.attackCooldownTimer <= 0) {
        this.attackCooldownTimer = this.attackCooldown;
        const dealt = nearest.takeDamage(this.damage);
        engine.addCombatEvent({
          type: 'SURVIVOR_HIT',
          targetId: nearest.id,
          targetName: nearest.name,
          zombieId: this.id,
          zombieType: this.type,
          damage: dealt,
          x: nearest.x,
          y: nearest.y
        });
      }
      return;
    }

    // Move towards survivor using A* pathfinding through house doorways
    this.state = 'HUNTING_SURVIVOR';

    if (this.repathTicks <= 0 || !this.path || this.pathIndex >= this.path.length) {
      this.path = Pathfinding.findPath(this.x, this.y, nearest.x, nearest.y, engine.map, engine.barricadesMap, true);
      this.pathIndex = 0;
      this.repathTicks = 15; // Re-evaluate path every 0.6s
    }

    if (this.path && this.pathIndex < this.path.length) {
      this.moveAlongPath(dt, engine);
    } else {
      this.directStepTowards(nearest.x, nearest.y, dt, engine);
    }
  }

  moveTowardsEntry(dt, engine) {
    this.state = 'SEEKING_ENTRY';

    // Prioritize breached openings first, otherwise nearest barricade
    let target = null;
    let minDist = Infinity;

    const breached = engine.barricades.filter(b => b.isBreached);
    const targetPool = breached.length > 0 ? breached : engine.barricades;

    for (const b of targetPool) {
      const bx = b.x + 0.5;
      const by = b.y + 0.5;
      const dist = Math.hypot(this.x - bx, this.y - by);
      if (dist < minDist) {
        minDist = dist;
        target = b;
      }
    }

    if (!target) return;

    // Check if close enough to attack intact barricade directly
    if (!target.isBreached && minDist <= 1.35) {
      this.attackBarricade(target, dt, engine);
      return;
    }

    // If target barricade is breached, aim for the interior ingress tile past the window/door
    const dest = target.isBreached && BARRICADE_INGRESS_POINTS[target.id] 
      ? BARRICADE_INGRESS_POINTS[target.id] 
      : { x: target.x + 0.5, y: target.y + 0.5 };

    if (this.repathTicks <= 0 || !this.path || this.pathIndex >= this.path.length) {
      this.path = Pathfinding.findPath(this.x, this.y, dest.x, dest.y, engine.map, engine.barricadesMap, true);
      this.pathIndex = 0;
      this.repathTicks = 20;
    }

    if (this.path && this.pathIndex < this.path.length) {
      this.moveAlongPath(dt, engine);
    } else {
      this.directStepTowards(dest.x, dest.y, dt, engine);
    }
  }

  moveAlongPath(dt, engine) {
    if (!this.path || this.pathIndex >= this.path.length) {
      this.path = [];
      return;
    }

    const targetNode = this.path[this.pathIndex];
    const dx = targetNode.x - this.x;
    const dy = targetNode.y - this.y;
    const dist = Math.hypot(dx, dy);

    const step = this.speed * dt;
    if (dist > 0.05) {
      this.facingAngle = Math.atan2(dy, dx);
      this.facingDir = Math.cos(this.facingAngle) >= 0 ? 1 : -1;
    }
    if (dist <= step || dist < 0.15) {
      this.x = targetNode.x;
      this.y = targetNode.y;
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.path = [];
      }
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  directStepTowards(tx, ty, dt, engine) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.05) {
      this.facingAngle = Math.atan2(dy, dx);
      this.facingDir = Math.cos(this.facingAngle) >= 0 ? 1 : -1;
      const step = Math.min(dist, this.speed * dt);
      const nextX = this.x + (dx / dist) * step;
      const nextY = this.y + (dy / dist) * step;

      if (Pathfinding.isWalkable(nextX, nextY, engine.map, engine.barricadesMap, true)) {
        this.x = nextX;
        this.y = nextY;
      } else if (Pathfinding.isWalkable(nextX, this.y, engine.map, engine.barricadesMap, true)) {
        this.x = nextX;
      } else if (Pathfinding.isWalkable(this.x, nextY, engine.map, engine.barricadesMap, true)) {
        this.y = nextY;
      }
    }
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: Math.round(this.x * 100) / 100,
      y: Math.round(this.y * 100) / 100,
      facingAngle: Math.round(this.facingAngle * 100) / 100,
      facingDir: this.facingDir || (Math.cos(this.facingAngle || 0) >= 0 ? 1 : -1),
      hp: Math.round(this.hp * 10) / 10,
      maxHp: this.maxHp,
      speed: this.speed,
      color: this.color,
      size: this.size,
      state: this.state
    };
  }
}
