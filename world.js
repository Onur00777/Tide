'use strict';

const VIEW = Object.freeze({ width: 1100, height: 620, tile: 28 });
const TERRAIN = Object.freeze({ sea: ' ', harbor: 'H', pier: 'P', street: '.', rubble: '#', square: '+', door: 'D' });
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

const SHIPYARD_MAP = HARBOR_MAP.map((row, index) => index === 3 ? row + 'PPP' : row);

const DISTRICT_MAP = [
  '      .......',
  '    ...#..##....',
  '   ..###..##.....',
  '  ............##..',
  '  ...##..++++.D#..',
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
  { name: 'Yüksek Su', min: 10, max: 13 },
  { name: 'Su Çekiliyor', min: 5, max: 7 },
  { name: 'Sular Çekildi', min: 66, max: 94 },
  { name: 'Dip Akıntısı Başladı - Tehlike Yakın', min: 12, max: 17 },
  { name: 'Sular Basıyor!', min: 16, max: 21 },
];

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

class Tide {
  constructor(random = Math.random) {
    this.random = random;
    this.index = 0;
    this.elapsed = 0;
    this.duration = this.sampleDuration();
  }

  get phase() { return PHASES[this.index]; }
  get exposed() { return this.index >= 2; }
  get warning() { return this.index === 3; }
  get rising() { return this.index === 4; }
  get surge() { return this.warning ? clamp((this.elapsed - 2) / 5, 0, 1) : Number(this.rising); }

  get water() {
    const fraction = this.elapsed / this.duration;
    return [1, 1 - fraction, 0, 0, fraction][this.index];
  }

  sampleDuration() {
    const { min, max } = this.phase;
    return min + this.random() * (max - min);
  }

  advance(seconds, onPhaseChange) {
    this.elapsed += seconds;
    while (this.elapsed >= this.duration) {
      this.elapsed -= this.duration;
      this.index = (this.index + 1) % PHASES.length;
      this.duration = this.sampleDuration();
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
    this.grid = new Map(this.tiles.map(tile => [`${tile.col},${tile.row}`, tile]));
  }

  at(col, row) { return this.rows[row]?.[col] ?? TERRAIN.sea; }

  atPoint(x, y) {
    return this.at(Math.floor((x - this.x) / VIEW.tile), Math.floor((y - this.y) / VIEW.tile));
  }

  tile(col, row) { return this.grid.get(`${col},${row}`); }

  tileAt(x, y) {
    return this.tile(Math.floor((x - this.x) / VIEW.tile), Math.floor((y - this.y) / VIEW.tile));
  }

  neighbors(tile) {
    return DIRECTIONS.map(([dx, dy]) => this.tile(tile.col + dx, tile.row + dy)).filter(Boolean);
  }
}

class World {
  constructor() {
    this.setHarborExpanded(false);
    this.dock = { x: 390, y: 348 };
    this.lighthouse = { x: 127, y: 288 };
    this.setDistrict(DISTRICT_MAP);
  }

  setHarborExpanded(expanded) {
    const map = expanded ? SHIPYARD_MAP : HARBOR_MAP;
    if (this.harbor?.rows !== map) this.harbor = new TilePatch(64, 208, map);
  }

  setDistrict(rows) {
    this.district = new TilePatch(530, 100, rows);
    this.roofs = new Set(this.district.tiles.filter(tile => tile.type === TERRAIN.rubble
      && this.district.neighbors(tile).filter(neighbor => this.isWalkable(neighbor.type)).length >= 2));
    this.hazards = new Map();
    this.escape = new Set();
    this.shore = this.district.tiles.filter(tile => this.isWalkable(tile.type)
      && DIRECTIONS.some(([dx, dy]) => this.district.at(tile.col + dx, tile.row + dy) === TERRAIN.sea));
    this.approaches = this.shore.flatMap(tile => DIRECTIONS.flatMap(([dx, dy]) => {
      const point = { x: tile.x + dx * VIEW.tile, y: tile.y + dy * VIEW.tile };
      if (!this.canOccupy(point.x, point.y, 11, 'boat', true) || !this.hasClearLanding(point, tile)) return [];
      return [{ ...point, tile }];
    }));
    this.shoreTarget = this.approaches.reduce((closest, point) =>
      !closest || distance(point, this.dock) < distance(closest, this.dock) ? point : closest, null);
  }

  terrainAt(x, y) {
    const harbor = this.harbor.atPoint(x, y);
    return harbor !== TERRAIN.sea ? harbor : this.district.atPoint(x, y);
  }

  isWalkable(type) { return type === TERRAIN.street || type === TERRAIN.square; }

  isFootTile(tile) { return Boolean(tile && (this.roofs.has(tile) || this.isWalkable(tile.type))); }
  isRaised(tile) { return this.roofs.has(tile) || this.escape.has(tile); }

  rollHazards() {
    const choices = shuffle(this.district.tiles.filter(tile => tile.col >= 3 && tile.col <= 18
      && this.isWalkable(tile.type) && !this.shore.includes(tile)
      && this.district.neighbors(tile).filter(neighbor => this.isFootTile(neighbor)).length >= 3));
    this.hazards.clear();
    for (const tile of choices) {
      if ([...this.hazards.keys()].some(existing => distance(existing, tile) < VIEW.tile * 1.7)) continue;
      const index = this.hazards.size;
      this.hazards.set(tile, index < 7 ? 'pool' : index % 2 ? 'algae' : 'mud');
      if (this.hazards.size === 22) break;
    }
  }

  wetness(tile, water) {
    if (this.isRaised(tile)) return 0;
    const threshold = this.hazards.get(tile) === 'pool' ? 0.02 : 0.28;
    return clamp((water - threshold) / (1 - threshold) * (threshold < 0.1 ? 2.5 : 1), 0, 1);
  }

  walkingFactor(tile, water) {
    if (this.isRaised(tile)) return 1;
    const hazard = this.hazards.get(tile);
    const dry = hazard === 'algae' ? 0.69 : hazard === 'mud' ? 0.56 : 1;
    return Math.max(0.4, dry * (1 - this.wetness(tile, water) * 0.56));
  }

  canOccupy(x, y, radius, mode, exposed) {
    if (x - radius < 0 || x + radius > VIEW.width || y - radius < 0 || y + radius > VIEW.height) return false;
    // Test each tile touched by the actor's hitbox, including diagonal corners.
    for (const dx of [-radius, radius]) {
      for (const dy of [-radius, radius]) {
        const type = this.terrainAt(x + dx, y + dy);
        if (mode === 'foot' && !this.isFootTile(this.district.tileAt(x + dx, y + dy))) return false;
        if (mode === 'boat' && (type === TERRAIN.harbor || type === TERRAIN.pier || type === TERRAIN.rubble || type === TERRAIN.door || (exposed && type !== TERRAIN.sea))) return false;
      }
    }
    return true;
  }

  currentAt(point, tide) {
    const fraction = clamp(tide.elapsed / tide.duration, 0, 1);
    const ebb = tide.index === 1 ? -25 * Math.sin(fraction * Math.PI) : 0;
    const flood = tide.rising ? 31 * Math.sin(fraction * Math.PI) : tide.warning ? 6 * tide.surge : 0;
    const exposure = clamp((point.x - 408) / 200, 0, 1);
    const strength = (ebb + flood) * exposure;
    return { x: strength * 0.88, y: strength * clamp((point.y - 308) / 220, -0.5, 0.5) };
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
      if (type !== TERRAIN.sea && !this.isFootTile(this.district.tileAt(
        boat.x + (tile.x - boat.x) * fraction, boat.y + (tile.y - boat.y) * fraction))) return false;
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

  markEscapeRoute(landing) {
    const queue = [landing];
    const parents = new Map([[landing, null]]);
    for (const tile of queue) {
      const neighbors = this.district.neighbors(tile).sort((a, b) => Number(this.roofs.has(b)) - Number(this.roofs.has(a)));
      for (const neighbor of neighbors) {
        if (!this.isFootTile(neighbor) || parents.has(neighbor)) continue;
        parents.set(neighbor, tile);
        queue.push(neighbor);
      }
    }

    // Link scattered rooftops back to this landing using contiguous high tiles.
    this.escape = new Set([landing]);
    const anchors = [];
    for (const roof of queue.toReversed()) {
      if (!this.roofs.has(roof) || anchors.some(anchor => distance(anchor, roof) < VIEW.tile * 4)) continue;
      anchors.push(roof);
      for (let tile = roof; tile && !this.escape.has(tile); tile = parents.get(tile)) this.escape.add(tile);
    }
  }
}
