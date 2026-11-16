'use strict';

const RELICS = {
  journal: { id: 'journal', name: 'Kayıp Kaptan’ın Günlüğü', color: '#ffd68a' },
  cog: { id: 'cog', name: 'Antik Çark', color: '#f2ad78' },
  pearl: { id: 'pearl', name: 'Parlayan İnci', color: '#c6f5e2' },
};

const DEEP_CACHE = { name: 'Derin sandık', value: 4, color: '#e1a369' };

const DISTRICTS = [
  { name: 'Fener Sokağı', house: 'Kaptanın Evi', relic: RELICS.journal, map: DISTRICT_MAP, tags: [[5, 6], [6, 3], [6, 8]] },
  {
    name: 'Eski Tersane', house: 'Demircinin Atölyesi', relic: RELICS.cog, tags: [[7, 3], [8, 6], [6, 10]],
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
    name: 'İnci Mahallesi', house: 'İnci Tacirinin Kasası', relic: RELICS.pearl, tags: [[6, 6], [7, 9], [7, 12]],
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

class Expedition {
  constructor(world) {
    this.world = world;
    this.district = DISTRICTS[0];
    this.number = 0;
    this.loot = [];
    this.key = null;
    this.hasKey = false;
    this.house = null;
    this.reward = null;
    this.opening = null;
  }

  begin(district, securedRelic) {
    this.number++;
    if (district !== this.district) this.world.setDistrict(district.map);
    this.district = district;
    const tiles = this.world.district.tiles;
    this.house = tiles.find(tile => tile.type === TERRAIN.door);
    this.reward = securedRelic ? DEEP_CACHE : district.relic;
    const [col, row] = district.tags[Math.floor(Math.random() * district.tags.length)];
    this.key = this.house ? tiles.find(tile => tile.col === col && tile.row === row) : null;
    this.hasKey = false;
    this.opening = null;
    const choices = tiles.filter(tile => this.world.isWalkable(tile.type) && tile !== this.key);
    this.loot = [];
    for (let index = 0; index < 17; index++) {
      const eligible = index < 5 ? choices.filter(tile => tile.col <= 5) : choices;
      const tile = eligible[Math.floor(Math.random() * eligible.length)];
      choices.splice(choices.indexOf(tile), 1);
      this.loot.push({ x: tile.x, y: tile.y, kind: index % 3 });
    }
  }

  end() {
    this.loot = [];
    this.key = null;
    this.house = null;
    this.reward = null;
    this.hasKey = false;
    this.opening = null;
  }
}
