/**
 * Fast Pathfinding and Flowfield Engine for Left 730 Dead
 * Optimized for high TPS on low-power architectures (Intel N150).
 */

import { TILE_TYPES } from './Map.js';

export class Pathfinding {
  /**
   * Check if a cell is walkable for an entity.
   */
  static isWalkable(x, y, gameMap, barricadesMap, isZombie = false) {
    if (gameMap.isOutOfBounds(x, y)) return false;
    const tile = gameMap.getTile(x, y);

    if (tile === TILE_TYPES.WALL) return false;

    // RULE: Survivors cannot walk outside the house or step into window/door frames
    if (!isZombie) {
      if (tile === TILE_TYPES.OUTSIDE) return false;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      // Strictly inside house interior floors
      if (ix <= 4 || ix >= 15 || iy <= 4 || iy >= 15) return false;
      if (tile === TILE_TYPES.WINDOW || tile === TILE_TYPES.DOOR) return false;
      return true;
    }

    // Zombie Walkability
    if (tile === TILE_TYPES.WINDOW || tile === TILE_TYPES.DOOR) {
      const key = `${Math.floor(x)},${Math.floor(y)}`;
      const barricade = barricadesMap.get(key);
      if (!barricade) return true;
      
      // If barricade is breached, zombie can pass through
      if (barricade.isBreached) return true;

      // Zombie cannot pass through unbreached barricade (must attack it)
      return false;
    }

    return true;
  }

  /**
   * Generates a 2D distance field (Dijkstra Map) from an array of target points.
   * Enables O(1) path vector lookups for dozens of horde entities simultaneously.
   */
  static generateFlowfield(targets, gameMap, barricadesMap, isZombie = false) {
    const width = gameMap.width;
    const height = gameMap.height;
    const distGrid = Array.from({ length: height }, () => Array(width).fill(Infinity));
    const queue = [];

    for (const target of targets) {
      const tx = Math.floor(target.x);
      const ty = Math.floor(target.y);
      if (!gameMap.isOutOfBounds(tx, ty)) {
        distGrid[ty][tx] = 0;
        queue.push({ x: tx, y: ty, dist: 0 });
      }
    }

    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];

    let head = 0;
    while (head < queue.length) {
      const { x, y, dist } = queue[head++];

      for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        // Check walkability
        const walkable = this.isWalkable(nx, ny, gameMap, barricadesMap, isZombie);
        if (!walkable) continue;

        if (distGrid[ny][nx] > dist + 1) {
          distGrid[ny][nx] = dist + 1;
          queue.push({ x: nx, y: ny, dist: dist + 1 });
        }
      }
    }

    return distGrid;
  }

  /**
   * Gets the normalized movement direction vector towards the lowest gradient in a distance field.
   */
  static getDirectionFromField(x, y, distGrid) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const height = distGrid.length;
    const width = distGrid[0].length;

    if (ix < 0 || ix >= width || iy < 0 || iy >= height) return { dx: 0, dy: 0 };

    let bestDist = distGrid[iy][ix];
    let bestDir = { dx: 0, dy: 0 };

    const neighbors = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 0.707, dy: 0.707, checkX: 1, checkY: 1 },
      { dx: -0.707, dy: 0.707, checkX: -1, checkY: 1 },
      { dx: 0.707, dy: -0.707, checkX: 1, checkY: -1 },
      { dx: -0.707, dy: -0.707, checkX: -1, checkY: -1 }
    ];

    for (const n of neighbors) {
      const nx = ix + (n.checkX || n.dx);
      const ny = iy + (n.checkY || n.dy);
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const d = distGrid[ny][nx];
        if (d < bestDist) {
          bestDist = d;
          bestDir = { dx: n.dx, dy: n.dy };
        }
      }
    }

    // Normalize
    const mag = Math.hypot(bestDir.dx, bestDir.dy);
    if (mag > 0.0001) {
      return { dx: bestDir.dx / mag, dy: bestDir.dy / mag };
    }
    return { dx: 0, dy: 0 };
  }

  /**
   * Standard A* Pathfinding for direct destination navigation (e.g. !go room, !help player).
   */
  static findPath(startX, startY, goalX, goalY, gameMap, barricadesMap, isZombie = false) {
    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    const gx = Math.floor(goalX);
    const gy = Math.floor(goalY);

    if (sx === gx && sy === gy) return [];

    const width = gameMap.width;
    const height = gameMap.height;

    const openSet = [];
    const closedSet = new Uint8Array(width * height);
    const gScore = new Float32Array(width * height).fill(Infinity);
    const cameFrom = new Int32Array(width * height).fill(-1);

    const getIndex = (x, y) => y * width + x;
    const heuristic = (x, y) => Math.hypot(x - gx, y - gy);

    const startIndex = getIndex(sx, sy);
    gScore[startIndex] = 0;
    openSet.push({ x: sx, y: sy, f: heuristic(sx, sy) });

    // For indoor survivors, use cardinal 4-directions to pass straight through doorway centers without clipping corners
    const directions = isZombie ? [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1, cost: 1.414 },
      { dx: -1, dy: 1, cost: 1.414 },
      { dx: 1, dy: -1, cost: 1.414 },
      { dx: -1, dy: -1, cost: 1.414 }
    ] : [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];

    while (openSet.length > 0) {
      // Find lowest f in openSet
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIdx].f) {
          lowestIdx = i;
        }
      }

      const current = openSet.splice(lowestIdx, 1)[0];
      const currentIdx = getIndex(current.x, current.y);

      if (current.x === gx && current.y === gy) {
        // Reconstruct path
        const path = [];
        let curr = currentIdx;
        while (curr !== startIndex && curr !== -1) {
          path.unshift({ x: (curr % width) + 0.5, y: Math.floor(curr / width) + 0.5 });
          curr = cameFrom[curr];
        }
        return path;
      }

      closedSet[currentIdx] = 1;

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const neighborIdx = getIndex(nx, ny);
        if (closedSet[neighborIdx]) continue;

        // Allow goal cell even if it's a barricade tile
        const isGoal = (nx === gx && ny === gy);
        if (!isGoal && !this.isWalkable(nx, ny, gameMap, barricadesMap, isZombie)) {
          continue;
        }

        // For diagonal movement, check corner cutting
        if (dir.dx !== 0 && dir.dy !== 0) {
          if (!this.isWalkable(current.x + dir.dx, current.y, gameMap, barricadesMap, isZombie) ||
              !this.isWalkable(current.x, current.y + dir.dy, gameMap, barricadesMap, isZombie)) {
            continue;
          }
        }

        const moveCost = dir.cost || 1.0;
        const tentativeG = gScore[currentIdx] + moveCost;

        if (tentativeG < gScore[neighborIdx]) {
          cameFrom[neighborIdx] = currentIdx;
          gScore[neighborIdx] = tentativeG;
          const f = tentativeG + heuristic(nx, ny);

          const existing = openSet.find(item => item.x === nx && item.y === ny);
          if (existing) {
            existing.f = f;
          } else {
            openSet.push({ x: nx, y: ny, f });
          }
        }
      }
    }

    // Return empty if no path found
    return [];
  }
}
