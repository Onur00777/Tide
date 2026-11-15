'use strict';

const VIEW = Object.freeze({ width: 1100, height: 620, tile: 28 });
const TERRAIN = Object.freeze({ sea: ' ', harbor: 'H', pier: 'P', street: '.', rubble: '#', square: '+' });
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const HARBOR_MAP = [
  '  HHHH',
  ' HHHHHH',
  'HHHHHHHH',
  'HHHHHHHH',
  'HHHHHHHHPPP',
  'HHHHHHHHPPP',
  'HHHHHHHH',
  ' HHHHHH',
  '  HHHH',
];

const DISTRICT_MAP = [
  '      .......',
  '    ...#..##....',
  '   ..###..##.....',
  '  ............##..',
  '  ...##..++++.##..',
  ' ...###..++++.....',
  ' .........++.......',
  ' ................##',
  '  ..##...##......##',
  '  ..##...##..###...',
  '   ..........###...',
  '    ..###.........',
  '     .###...##...',
  '      ......##..',
  '        ......',
];

const PHASES = [
  { name: 'Yüksek su', next: 'ÇEKİLMEYE', seconds: 24, exposed: false },
  { name: 'Su çekiliyor', next: 'DÜŞÜK SUYA', seconds: 7, exposed: false },
  { name: 'Düşük su', next: 'YÜKSELMEYE', seconds: 50, exposed: true },
  { name: 'Su yükseliyor', next: 'TAŞKINA', seconds: 9, exposed: true },
];

const UPGRADES = [
  { total: 3, name: 'Kıyı feneri', sprite: 'lamp', x: 256, y: 295 },
  { total: 7, name: 'Depo', sprite: 'shed', x: 173, y: 382, capacity: 6 },
  { total: 12, name: 'Güney feneri', sprite: 'lamp', x: 152, y: 423 },
  { total: 18, name: 'Atölye', sprite: 'shed', x: 231, y: 404, capacity: 8 },
];

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class Tide {
  constructor() {
    this.index = 0;
    this.elapsed = 0;
    this.duration = PHASES.reduce((total, phase) => total + phase.seconds, 0);
  }

  get phase() { return PHASES[this.index]; }
  get remaining() { return this.phase.seconds - this.elapsed; }
  get exposed() { return this.phase.exposed; }
  get progress() {
    const passed = PHASES.slice(0, this.index).reduce((total, phase) => total + phase.seconds, 0);
    return (passed + this.elapsed) / this.duration;
  }

  get water() {
    const fraction = this.elapsed / this.phase.seconds;
    return [1, 1 - fraction, 0, fraction][this.index];
  }

  advance(seconds, onPhaseChange) {
    this.elapsed += seconds;
    while (this.elapsed >= this.phase.seconds) {
      this.elapsed -= this.phase.seconds;
      this.index = (this.index + 1) % PHASES.length;
      onPhaseChange(this.index);
    }
  }
}

class TilePatch {
  constructor(x, y, rows) {
    this.x = x;
    this.y = y;
    this.rows = rows;
    this.tiles = rows.flatMap((row, r) => Array.from(row, (type, c) => ({
      col: c, row: r, type, x: x + (c + 0.5) * VIEW.tile, y: y + (r + 0.5) * VIEW.tile,
    })).filter(tile => tile.type !== TERRAIN.sea));
  }

  at(col, row) { return this.rows[row]?.[col] ?? TERRAIN.sea; }

  atPoint(x, y) {
    return this.at(Math.floor((x - this.x) / VIEW.tile), Math.floor((y - this.y) / VIEW.tile));
  }
}

class World {
  constructor() {
    this.harbor = new TilePatch(64, 208, HARBOR_MAP);
    this.district = new TilePatch(530, 100, DISTRICT_MAP);
    this.dock = { x: 390, y: 348 };
    this.lighthouse = { x: 127, y: 288 };
    this.shore = this.district.tiles.filter(tile => this.isWalkable(tile.type)
      && DIRECTIONS.some(([dx, dy]) => this.district.at(tile.col + dx, tile.row + dy) === TERRAIN.sea));
  }

  terrainAt(x, y) {
    const harbor = this.harbor.atPoint(x, y);
    return harbor !== TERRAIN.sea ? harbor : this.district.atPoint(x, y);
  }

  isWalkable(type) { return type === TERRAIN.street || type === TERRAIN.square; }

  canOccupy(x, y, radius, mode, exposed) {
    if (x - radius < 0 || x + radius > VIEW.width || y - radius < 0 || y + radius > VIEW.height) return false;
    // Test each tile touched by the actor's hitbox, including diagonal corners.
    for (const dx of [-radius, radius]) {
      for (const dy of [-radius, radius]) {
        const type = this.terrainAt(x + dx, y + dy);
        if (mode === 'foot' && (!exposed || !this.isWalkable(type))) return false;
        if (mode === 'boat' && (type === TERRAIN.harbor || type === TERRAIN.pier || (exposed && type !== TERRAIN.sea))) return false;
      }
    }
    return true;
  }

  landingNear(boat) {
    let nearest = null;
    let limit = 48;
    for (const tile of this.shore) {
      const range = distance(boat, tile);
      if (range >= limit || !this.hasClearLanding(boat, tile)) continue;
      nearest = tile;
      limit = range;
    }
    return nearest;
  }

  hasClearLanding(boat, tile) {
    const steps = Math.ceil(distance(boat, tile) / 4);
    for (let step = 1; step < steps; step++) {
      const fraction = step / steps;
      const type = this.terrainAt(boat.x + (tile.x - boat.x) * fraction, boat.y + (tile.y - boat.y) * fraction);
      if (type !== TERRAIN.sea && !this.isWalkable(type)) return false;
    }
    return true;
  }

  nearestWater(boat) {
    const candidates = [];
    for (const tile of this.district.tiles) {
      for (const [dx, dy] of DIRECTIONS) {
        if (this.district.at(tile.col + dx, tile.row + dy) !== TERRAIN.sea) continue;
        const point = { x: tile.x + dx * VIEW.tile, y: tile.y + dy * VIEW.tile };
        if (this.canOccupy(point.x, point.y, boat.radius, 'boat', true)) candidates.push(point);
      }
    }
    return candidates.reduce((best, point) => distance(boat, point) < distance(boat, best) ? point : best, this.dock);
  }

  spawnLoot() {
    const tiles = this.district.tiles.filter(tile => this.isWalkable(tile.type));
    const pieces = [];
    // Sample without replacement, with several pieces near the western approach.
    for (let index = 0; index < 22; index++) {
      const eligible = index < 5 ? tiles.filter(tile => tile.col <= 5) : tiles;
      const tile = eligible[Math.floor(Math.random() * eligible.length)];
      tiles.splice(tiles.indexOf(tile), 1);
      pieces.push({ x: tile.x, y: tile.y, kind: index % 3 });
    }
    return pieces;
  }
}
