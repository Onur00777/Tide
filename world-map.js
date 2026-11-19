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
    this.paper = new Map();
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
  parchment(ctx, width, height) {
    const key = width + ':' + height;
    if (!this.paper.has(key)) {
      const paper = document.createElement('canvas'); paper.width = width; paper.height = height;
      const ink = paper.getContext('2d');
      const wash = ink.createRadialGradient(width * 0.4, height * 0.35, 0, width * 0.5, height * 0.5, width * 0.7);
      wash.addColorStop(0, '#273636'); wash.addColorStop(0.55, '#192b2d'); wash.addColorStop(1, '#101e24');
      ink.fillStyle = wash; ink.fillRect(0, 0, width, height);
      // Fixed paper grain never flickers or consumes simulation randomness.
      let seed = 6137;
      const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
      for (let i = 0; i < width * height / 5; i++) {
        ink.fillStyle = random() > 0.5 ? '#cbbd8810' : '#030e1418';
        ink.fillRect(random() * width, random() * height, 0.6 + random(), 0.5 + random());
      }
      ink.strokeStyle = '#d4b88617'; ink.lineWidth = 0.6;
      ink.beginPath();
      for (let i = 1; i < 8; i++) {
        const x = width * i / 8;
        ink.moveTo(x, 0); ink.bezierCurveTo(x + (width / 2 - x) * 0.12, height / 3, x + (width / 2 - x) * 0.12, height * 2 / 3, x, height);
      }
      for (let i = 1; i < 5; i++) { const y = height * i / 5; ink.moveTo(0, y); ink.quadraticCurveTo(width / 2, y + (height / 2 - y) * 0.12, width, y); }
      ink.stroke();
      ink.strokeStyle = '#d4b88624'; ink.strokeRect(4.5, 4.5, width - 9, height - 9);
      ink.font = (width > 500 ? '10px' : '6px') + ' Georgia'; ink.fillStyle = '#c4b58b77';
      for (let i = 1; i < 5; i++) ink.fillText((42 + i) + '°', 7, height * i / 5 - 3);
      this.paper.set(key, paper);
    }
    ctx.drawImage(this.paper.get(key), 0, 0);
  }

  compass(ctx, width, height) {
    const size = width > 500 ? 31 : 17, x = width - size * 2, y = height - size * 1.8;
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#c9b58270'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.82, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 4);
      const length = i % 2 ? size * 0.62 : size;
      ctx.beginPath(); ctx.moveTo(0, -length); ctx.lineTo(size * 0.15, 0); ctx.lineTo(0, size * 0.18); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#827c5b' : '#c4b17f'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -length); ctx.lineTo(-size * 0.15, 0); ctx.lineTo(0, size * 0.18); ctx.closePath();
      ctx.fillStyle = '#34433e'; ctx.fill(); ctx.restore();
    }
    ctx.font = (width > 500 ? '11px' : '8px') + ' Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#d4c198';
    ctx.fillText('K', 0, -size - 5); ctx.fillText('G', 0, size + 10);
    ctx.fillText('B', -size - 6, 3); ctx.fillText('D', size + 6, 3); ctx.restore();
  }

  drawLocal(ctx, game, width, height) {
    this.parchment(ctx, width, height);
    ctx.save(); ctx.scale(width / VIEW.width, height / VIEW.height);
    const visible = point => this.harbor.explored.has(`${this.region.id}:${Math.floor(point.x / 100)}:${Math.floor(point.y / 100)}`);
    for (const patch of [game.world.harbor, game.world.district]) for (const tile of patch.tiles) {
      if (!visible(tile)) continue;
      ctx.fillStyle = patch === game.world.harbor ? '#897657' : game.world.escape.has(tile) ? '#a9c48d' : game.world.isFootTile(tile) ? '#466d74' : '#273d4a';
      ctx.fillRect(tile.x - 13, tile.y - 13, 26, 26);
    }
    for (const site of game.expedition.sites) if (visible(site) && !site.opened) {
      ctx.strokeStyle = site.cellar ? '#b7a1d7' : '#d9b57a'; ctx.lineWidth = 2;
      ctx.strokeRect(site.x - 6, site.y - 6, 12, 12);
    }
    for (const gate of this.gates) {
      ctx.fillStyle = this.canEnter(gate.region) ? '#e7c38c' : '#b36f71';
      ctx.beginPath(); ctx.arc(gate.x, gate.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.font = '12px Georgia'; ctx.textAlign = gate.x > 900 ? 'right' : 'left';
      ctx.fillText(gate.region.name, gate.x > 900 ? gate.x - 14 : gate.x + 14, gate.y + 4);
    }
    for (const [point, color] of [[game.boat, '#dfbd86'], [game.mode === 'foot' ? game.walker : game.boat, '#f8eed1']]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx, game, width, height) {
    ctx.clearRect(0, 0, width, height);
    this.parchment(ctx, width, height);
    const sx = width / (VIEW.width * 3), sy = height / (VIEW.height * 2);
    ctx.save(); ctx.scale(sx, sy);
    for (const region of SEA_REGIONS) {
      const ox = region.col * VIEW.width, oy = region.row * VIEW.height;
      for (let row = 0; row < 7; row++) for (let col = 0; col < 11; col++) {
        if (!this.harbor.explored.has(`${region.id}:${col}:${row}`)) continue;
        ctx.fillStyle = region === this.region ? '#74877327' : '#6c7b6b19';
        ctx.fillRect(ox + col * 100, oy + row * 100, 100, 100);
      }
      const patch = region === this.region ? game.world.district : new TilePatch(530, 100, DISTRICTS[region.district].map);
      for (const tile of patch.tiles) {
        if (!this.harbor.explored.has(`${region.id}:${Math.floor(tile.x / 100)}:${Math.floor(tile.y / 100)}`)) continue;
        ctx.fillStyle = tile.type === TERRAIN.rubble ? '#a29c7a88' : '#81927b66';
        ctx.fillRect(ox + tile.x - 14, oy + tile.y - 14, 27, 27);
      }
      const known = [...this.harbor.explored].some(key => key.startsWith(region.id + ':'));
      ctx.fillStyle = known ? '#d9c69b' : '#9b9b7a88';
      ctx.save(); ctx.scale(1 / sx, 1 / sy);
      ctx.font = (width > 500 ? '16px' : '9px') + ' Georgia';
      const short = { harbor: 'Liman', oldtown: 'Eski Mahalle', lighthouse: 'Fener Adası', cathedral: 'Katedral' };
      ctx.fillText(known ? (width > 500 ? region.name : short[region.id]) : 'Bilinmeyen', (ox + 45) * sx, (oy + 315) * sy, width / 3 - 9); ctx.restore();
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
    this.compass(ctx, width, height);
  }
}
