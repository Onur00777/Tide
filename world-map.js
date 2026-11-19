"use strict";

const SEA_REGIONS = [
  { id: 'harbor', name: 'Başlangıç Limanı', col: 0, row: 1, district: 0, lore: 'Deniz isimleri unutur. Liman hatırlar.' },
  { id: 'oldtown', name: 'Batık Eski Mahalle', col: 1, row: 1, district: 0, lore: 'Kapılardaki çizikler dışarıdan değil, içeriden.' },
  { id: 'lighthouse', name: 'Kayalık Fener Adası', col: 1, row: 0, district: 1, lore: 'Fener söndüğünde aşağıdaki çan cevap veriyor.' },
  { id: 'cathedral', name: 'Yasaklı Batık Katedral', col: 2, row: 0, district: 3, lore: 'Şehir batmadı. Aşağıdan gelen çağrıyı izledi.' },
];

class WorldMap {
  constructor(harbor) {
    this.harbor = harbor;
    this.region = SEA_REGIONS[0];
    this.cache = new Map();
    this.saveIn = 0;
    this.dirty = false;
  }
  get home() { return this.region.id === 'harbor'; }
  get gates() {
    return SEA_REGIONS.filter(r => Math.abs(r.col - this.region.col) + Math.abs(r.row - this.region.row) === 1)
      .map(region => ({ region, x: region.col > this.region.col ? 1030 : region.col < this.region.col ? 65 : 450,
        y: region.row < this.region.row ? 45 : region.row > this.region.row ? 570 : 65 }));
  }
  canEnter(region) { return region.id !== 'cathedral' || (this.harbor.fittings.has('armor') && this.harbor.fittings.has('engine')); }
  nearGate(game) { return game.mode === 'boat' && this.gates.find(gate => distance(gate, game.boat) < 48); }
  update(dt, game) {
    const actor = game.mode === 'foot' ? game.walker : game.boat;
    const col = Math.floor(actor.x / 100), row = Math.floor(actor.y / 100);
    for (let y = Math.max(0, row - 1); y <= Math.min(6, row + 1); y++) for (let x = Math.max(0, col - 1); x <= Math.min(10, col + 1); x++) {
      const key = `${this.region.id}:${x}:${y}`;
      if (!this.harbor.explored.has(key)) { this.harbor.explored.add(key); this.dirty = true; }
    }
    this.saveIn -= dt;
    if (this.dirty && this.saveIn <= 0) { game.persist(this.harbor); this.dirty = false; this.saveIn = 5; }
  }
  travel(game, gate) {
    if (!gate || !this.canEnter(gate.region) || game.mode !== 'boat' || game.boat.currentSpeed > 42) return false;
    this.cache.set(this.region.id, { district: game.expedition.district, sites: game.expedition.sites, deep: game.expedition.deepSite,
      hazards: [...game.world.hazards].map(([tile, kind]) => [tile.col, tile.row, kind]), stranded: game.rescue.stranded });
    game.navigation = null;
    const old = this.region;
    this.region = gate.region;
    const world = game.world;
    world.harbor = new TilePatch(64, 208, this.home ? (game.harbor.projects.has('shipwright') ? SHIPYARD_MAP : HARBOR_MAP) : []);
    const district = this.home ? DISTRICTS[game.harbor.route] : DISTRICTS[this.region.district];
    const cached = this.cache.get(this.region.id);
    world.setDistrict((cached?.district ?? district).map);
    if (cached) {
      game.expedition.district = cached.district;
      game.expedition.sites = cached.sites;
      game.expedition.deepSite = cached.deep;
      world.hazards = new Map(cached.hazards.map(([col, row, kind]) => [world.district.tile(col, row), kind]));
      game.rescue.stranded = cached.stranded && !game.harbor.crew.has(cached.stranded.member.id)
        && game.rescue.passenger?.id !== cached.stranded.member.id && game.rescue.carrying?.id !== cached.stranded.member.id ? cached.stranded : null;
    } else {
      game.expedition.district = district;
      game.expedition.sites = [];
      game.expedition.rollDeepSite();
      game.rescue.stranded = null;
      if (game.tide.exposed) {
        game.expedition.begin(district, game.harbor.relics, game.cargo);
        game.rescue.begin(world, game.harbor.crew, game.expedition.sites);
      }
    }
    game.expedition.opening = null; game.expedition.hoist = null;
    game.boat.x = old.col < this.region.col ? 80 : old.col > this.region.col ? 1015 : 450;
    game.boat.y = old.row < this.region.row ? 70 : old.row > this.region.row ? 545 : 65;
    game.boat.stop(); game.weather.wake = [];
    game.announce(this.region.name.toLocaleUpperCase('tr-TR'), this.region.lore, 'find', 6);
    this.update(0, game);
    return true;
  }
  draw(ctx, game, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#081c25'; ctx.fillRect(0, 0, width, height);
    const sx = width / (VIEW.width * 3), sy = height / (VIEW.height * 2);
    ctx.save(); ctx.scale(sx, sy);
    for (const region of SEA_REGIONS) {
      const ox = region.col * VIEW.width, oy = region.row * VIEW.height;
      for (let row = 0; row < 7; row++) for (let col = 0; col < 11; col++) {
        if (!this.harbor.explored.has(`${region.id}:${col}:${row}`)) continue;
        ctx.fillStyle = region === this.region ? '#284d55' : '#1d363e';
        ctx.fillRect(ox + col * 100, oy + row * 100, 99, 99);
      }
      const patch = region === this.region ? game.world.district : new TilePatch(530, 100, DISTRICTS[region.district].map);
      for (const tile of patch.tiles) {
        if (!this.harbor.explored.has(`${region.id}:${Math.floor(tile.x / 100)}:${Math.floor(tile.y / 100)}`)) continue;
        ctx.fillStyle = tile.type === TERRAIN.rubble ? '#61777a' : '#3f6666';
        ctx.fillRect(ox + tile.x - 14, oy + tile.y - 14, 27, 27);
      }
      const known = [...this.harbor.explored].some(key => key.startsWith(region.id + ':'));
      ctx.fillStyle = known ? '#dfc593' : '#71838a';
      ctx.font = '72px Georgia'; ctx.fillText(known ? region.name : '???', ox + 45, oy + 315, 1000);
      if (region === this.region) for (const gate of this.gates) {
        ctx.fillStyle = this.canEnter(gate.region) ? '#e5bd77' : '#bd6f67';
        ctx.beginPath(); ctx.arc(ox + gate.x, oy + gate.y, 24, 0, Math.PI * 2); ctx.fill();
      }
    }
    const actor = game.mode === 'foot' ? game.walker : game.boat;
    ctx.translate(this.region.col * VIEW.width + actor.x, this.region.row * VIEW.height + actor.y);
    ctx.rotate(actor.heading);
    ctx.fillStyle = '#fff2c6'; ctx.beginPath(); ctx.moveTo(36, 0); ctx.lineTo(-22, -19); ctx.lineTo(-22, 19); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#e4cfa6'; ctx.font = '11px Georgia'; ctx.fillText('N ↑', width - 30, 16);
  }
}
