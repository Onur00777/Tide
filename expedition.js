'use strict';

const RELICS = Object.fromEntries([
  ['journal', 'Boğulmuş Kaptanın Günlüğü', 'Günlük', '▤', '#f7c57a'],
  ['cog', 'Paslı Çark', 'Mekanik', '⚙', '#ff9d6d'],
  ['secret', 'Antik Sır', 'Sır', '✦', '#88f3de'],
  ['signal', 'Son İşaret', 'Sır', '✦', '#88f3de'],
  ['ledger', 'Kayıp Vardiya Defteri', 'Günlük', '▤', '#f7c57a'],
  ['spring', 'Yosunlu Zemberek', 'Mekanik', '⚙', '#ff9d6d'],
  ['seal', 'İsimsiz Lonca Mührü', 'Sır', '✦', '#88f3de'],
  ['dial', 'Kırık Pusula Çarkı', 'Mekanik', '⚙', '#ff9d6d'],
  ['weather', 'Kül Fırtınası Günlüğü', 'Günlük', '▤', '#f7c57a'],
  ['pearl', 'Parlayan İnci', 'Sır', '✦', '#88f3de'],
  ['tidebook', 'Derin Su Seyir Defteri', 'Günlük', '▤', '#f7c57a'],
  ['rotor', 'Fenerin İlk Rotoru', 'Mekanik', '⚙', '#ff9d6d'],
].map(([id, name, kind, icon, color]) => [id, { id, name, kind, icon, color }]));

const SCRAP_CRATE = { id: 'scrap', name: 'Hurda Kasası', icon: '▦', color: '#bbad93', scrap: 2 };

const DISTRICTS = [
  { name: 'Fener Sokağı', finds: ['journal', 'signal', 'ledger', 'spring'], map: DISTRICT_MAP },
  {
    name: 'Eski Tersane', finds: ['cog', 'seal', 'dial', 'weather'],
    map: [
      '       .......',
      '    ....###.....',
      '   .....###......',
      '  ...##...........',
      ' ....##......###...',
      ' ............D##...',
      ' ...####...........',
      ' ..........++++....',
      ' ...######.++++....',
      '  .................',
      '   ....###........',
      '    ...###...##...',
      '      .......##..',
      '        .......',
    ],
  },
  {
    name: 'İnci Mahallesi', finds: ['secret', 'pearl', 'tidebook', 'rotor'],
    map: [
      '        .......',
      '      ...##.....',
      '     ....##......',
      '   ...............',
      '  .....####.....##.',
      ' ......####.....##.',
      ' ..................',
      ' ...##...####......',
      ' ...##...#++#......',
      ' ........++++......',
      '  .......#++D.#....',
      '  .......####.#....',
      '    ..............',
      '      ...........',
      '        .......',
    ],
  },
];

const VAULTS = [
  { label: 'Kapıcı Kasası', seconds: 5 },
  { label: 'Mühürlü Sandık', seconds: 7 },
  { label: 'Döküm Kasa', seconds: 9 },
  { label: 'Zırhlı Kasa', seconds: 12 },
];

class Expedition {
  constructor(world) {
    this.world = world;
    this.district = DISTRICTS[0];
    this.sites = [];
    this.opening = null;
  }

  begin(district, owned, cargo) {
    if (district !== this.district) this.world.setDistrict(district.map);
    this.district = district;
    this.opening = null;
    this.world.rollHazards();
    const patch = this.world.district;
    const candidates = shuffle(patch.tiles.filter(tile =>
      (tile.type === TERRAIN.rubble || tile.type === TERRAIN.door) && tile.col >= 4 && tile.col <= 16
      && patch.neighbors(tile).some(neighbor => this.world.isFootTile(neighbor) && !this.world.hazards.has(neighbor))));
    const spots = [];
    for (const tile of candidates) {
      if (spots.some(existing => distance(existing, tile) < 57)) continue;
      spots.push(tile);
      if (spots.length === VAULTS.length) break;
    }
    for (const tile of candidates) {
      if (spots.length === VAULTS.length) break;
      if (!spots.includes(tile)) spots.push(tile);
    }
    const finds = district.finds.map(id => RELICS[id]);
    const uncollected = shuffle(finds.filter(item => !owned.has(item.id) && !cargo.includes(item)));
    const documented = shuffle(finds.filter(item => !uncollected.includes(item)));
    const rewards = [...uncollected, ...documented];
    this.sites = spots.map((tile, index) => ({ ...tile, ...VAULTS[index], item: rewards[index], opened: false }));
  }

  end() {
    this.sites = [];
    this.opening = null;
  }

  nearest(point, limit = Infinity) {
    let nearest = null;
    for (const site of this.sites) {
      const range = distance(point, site);
      if (site.opened || range >= limit) continue;
      nearest = site;
      limit = range;
    }
    return nearest;
  }
}
