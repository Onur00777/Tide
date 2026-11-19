'use strict';

const CREW = {
  cartographer: { id: 'cartographer', name: 'Haritacı', color: '#bba4e8' },
  smith: { id: 'smith', name: 'Demirci', color: '#ffad76' },
  diver: { id: 'diver', name: 'Dalgıç / Fenerci', color: '#88edda' },
  shipwright: { id: 'shipwright', name: 'Tersane Ustası', color: '#f6d584' },
};

class CrewRescue {
  constructor() {
    this.missed = 0;
    this.stranded = null;
    this.carrying = null;
    this.passenger = null;
  }

  begin(world, settled, sites) {
    this.stranded = null;
    if (this.carrying || this.passenger) return;
    const available = Object.values(CREW).filter(member => !settled.has(member.id));
    if (!available.length) return;
    if (++this.missed < 3 && Math.random() >= 0.58) return;
    this.missed = 0;

    const interior = world.district.tiles.filter(tile => world.isWalkable(tile.type) && tile.col >= 10
      && !world.shore.includes(tile) && !world.hazards.has(tile)
      && sites.every(site => distance(tile, site) >= 43));
    const risky = interior.filter(tile => world.district.neighbors(tile).some(neighbor =>
      world.roofs.has(neighbor) || world.hazards.has(neighbor)));
    const choices = risky.length ? risky : interior;
    if (!choices.length) return;

    const tile = choices[Math.floor(Math.random() * choices.length)];
    const member = available[Math.floor(Math.random() * available.length)];
    this.stranded = { x: tile.x, y: tile.y, member };
  }

  take() {
    this.carrying = this.stranded.member;
    this.stranded = null;
  }

  board() {
    if (!this.carrying) return;
    this.passenger = this.carrying;
    this.carrying = null;
  }
}
