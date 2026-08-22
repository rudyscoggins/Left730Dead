/**
 * Barricade Entity (Windows & Doors)
 */

export class Barricade {
  constructor(config) {
    this.id = config.id;
    this.name = config.name || 'Barricade';
    this.x = config.x;
    this.y = config.y;
    this.type = config.type || 'window'; // 'window' | 'door'
    this.maxHp = config.maxHp || 150;
    this.hp = this.maxHp;
    this.isBreached = false;
    this.repairers = new Set(); // Set of survivor IDs actively repairing
    this.lastAttackedTick = 0;
  }

  damage(amount, tick = 0) {
    if (this.hp <= 0) return 0;
    const actualDamage = Math.min(this.hp, amount);
    this.hp -= actualDamage;
    this.lastAttackedTick = tick;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isBreached = true;
    }
    return actualDamage;
  }

  repair(amount) {
    if (this.hp >= this.maxHp) return 0;
    const missing = this.maxHp - this.hp;
    const actualRepair = Math.min(missing, amount);
    this.hp += actualRepair;
    if (this.hp > 0) {
      this.isBreached = false;
    }
    return actualRepair;
  }

  addRepairer(survivorId) {
    this.repairers.add(survivorId);
  }

  removeRepairer(survivorId) {
    this.repairers.delete(survivorId);
  }

  clearRepairers() {
    this.repairers.clear();
  }

  isPassable() {
    return this.isBreached;
  }

  getRepairRatio() {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      type: this.type,
      hp: Math.round(this.hp * 10) / 10,
      maxHp: this.maxHp,
      isBreached: this.isBreached,
      repairerCount: this.repairers.size
    };
  }
}
