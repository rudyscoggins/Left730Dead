/**
 * Map representation for Left 730 Dead
 * Fixed 20x20 grid with house exterior, rooms, doorways, and barricades.
 */

export const TILE_TYPES = {
  OUTSIDE: 0,
  FLOOR: 1,
  WALL: 2,
  WINDOW: 3,
  DOOR: 4
};

export const ROOMS = {
  LIVING_ROOM: { id: 'living_room', name: 'Living Room', x: 7, y: 7, bounds: { minX: 5, maxX: 9, minY: 5, maxY: 9 } },
  ARMORY: { id: 'armory', name: 'Armory', x: 12, y: 7, bounds: { minX: 11, maxX: 14, minY: 5, maxY: 9 } },
  KITCHEN: { id: 'kitchen', name: 'Kitchen', x: 7, y: 12, bounds: { minX: 5, maxX: 9, minY: 11, maxY: 14 } },
  WORKSHOP: { id: 'workshop', name: 'Workshop', x: 12, y: 12, bounds: { minX: 11, maxX: 14, minY: 11, maxY: 14 } },
  HALLWAY: { id: 'hallway', name: 'Central Hall', x: 10, y: 10, bounds: { minX: 9, maxX: 11, minY: 9, maxY: 11 } }
};

export class GameMap {
  constructor(width = 20, height = 20) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.rooms = ROOMS;
    this.barricadeConfigs = [
      { id: 'win_north', name: 'North Window', x: 7, y: 4, type: 'window' },
      { id: 'win_south', name: 'South Window', x: 7, y: 15, type: 'window' },
      { id: 'win_west', name: 'West Window', x: 4, y: 9, type: 'window' },
      { id: 'win_east', name: 'East Window', x: 15, y: 9, type: 'window' },
      { id: 'door_main', name: 'Main Door', x: 12, y: 15, type: 'door' }
    ];
    this.zombieSpawnPoints = [
      // Top row
      { x: 2, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 },
      // Bottom row
      { x: 2, y: 18 }, { x: 9, y: 18 }, { x: 17, y: 18 },
      // Left col
      { x: 1, y: 5 }, { x: 1, y: 14 },
      // Right col
      { x: 18, y: 5 }, { x: 18, y: 14 }
    ];
    this.survivorSpawnPoints = [
      { x: 7, y: 7 },
      { x: 12, y: 7 },
      { x: 7, y: 12 },
      { x: 12, y: 12 },
      { x: 10, y: 10 }
    ];
    this.initGrid();
  }

  initGrid() {
    this.grid = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => TILE_TYPES.OUTSIDE)
    );

    // Fill house interior with FLOOR
    for (let y = 4; y <= 15; y++) {
      for (let x = 4; x <= 15; x++) {
        this.grid[y][x] = TILE_TYPES.FLOOR;
      }
    }

    // Exterior North & South walls
    for (let x = 4; x <= 15; x++) {
      this.grid[4][x] = TILE_TYPES.WALL;
      this.grid[15][x] = TILE_TYPES.WALL;
    }

    // Exterior West & East walls
    for (let y = 4; y <= 15; y++) {
      this.grid[y][4] = TILE_TYPES.WALL;
      this.grid[y][15] = TILE_TYPES.WALL;
    }

    // Interior dividing walls with wide, clear doorways between all 4 rooms and Central Hall
    for (let y = 5; y <= 14; y++) {
      if (y !== 7 && y !== 9 && y !== 10 && y !== 12) {
        this.grid[y][10] = TILE_TYPES.WALL; // Vertical divider
      }
    }
    for (let x = 5; x <= 14; x++) {
      if (x !== 7 && x !== 9 && x !== 10 && x !== 12) {
        this.grid[10][x] = TILE_TYPES.WALL; // Horizontal divider
      }
    }

    // Set Barricade tiles
    for (const b of this.barricadeConfigs) {
      this.grid[b.y][b.x] = b.type === 'window' ? TILE_TYPES.WINDOW : TILE_TYPES.DOOR;
    }
  }

  isInsideHouse(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    return ix >= 5 && ix <= 14 && iy >= 5 && iy <= 14;
  }

  isOutOfBounds(x, y) {
    return x < 0 || x >= this.width || y < 0 || y >= this.height;
  }

  getTile(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (this.isOutOfBounds(ix, iy)) return TILE_TYPES.WALL;
    return this.grid[iy][ix];
  }

  findRoomByName(name) {
    if (!name) return null;
    const query = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of Object.keys(this.rooms)) {
      const room = this.rooms[key];
      const cleanName = room.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanId = room.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanName.includes(query) || cleanId.includes(query) || query.includes(cleanId)) {
        return room;
      }
    }
    return null;
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      grid: this.grid,
      rooms: this.rooms,
      barricadeConfigs: this.barricadeConfigs
    };
  }
}
