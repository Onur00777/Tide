'use strict';

function randomFrom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

class Renderer {
  constructor(canvas, world) {
    this.ctx = canvas.getContext('2d');
    this.world = world;
    const random = randomFrom(4172);
    this.ripples = Array.from({ length: 216 }, () => ({
      x: random() * VIEW.width, y: random() * VIEW.height,
      length: 6 + random() * 34, offset: random() * 7,
    }));
    this.harbor = this.paintPatch(world.harbor, false);
    this.district = this.paintPatch(world.district, true);
    const ctx = this.ctx;
    this.sea = ctx.createLinearGradient(0, 0, VIEW.width, VIEW.height);
    this.sea.addColorStop(0, '#174553');
    this.sea.addColorStop(0.53, '#236471');
    this.sea.addColorStop(1, '#143c4b');
    this.vignette = ctx.createRadialGradient(550, 286, 125, 550, 286, 635);
    this.vignette.addColorStop(0, '#04142100');
    this.vignette.addColorStop(1, '#041421a8');
  }

  paintPatch(patch, district) {
    const canvas = document.createElement('canvas');
    canvas.width = VIEW.width;
    canvas.height = VIEW.height;
    const ctx = canvas.getContext('2d');
    const random = randomFrom(district ? 9513 : 2741);
    const size = VIEW.tile;
    const land = new Path2D();
    const edge = new Path2D();
    for (const tile of patch.tiles) {
      const x = tile.x - size / 2;
      const y = tile.y - size / 2;
      land.rect(x, y, size, size);
      const sides = [[0, -1, x, y, x + size, y], [1, 0, x + size, y, x + size, y + size],
        [0, 1, x, y + size, x + size, y + size], [-1, 0, x, y, x, y + size]];
      for (const [dx, dy, x1, y1, x2, y2] of sides) {
        if (patch.at(tile.col + dx, tile.row + dy) !== TERRAIN.sea) continue;
        edge.moveTo(x1, y1);
        edge.lineTo(x2, y2);
      }
    }
    ctx.lineCap = 'round';
    for (const [width, color] of [[31, '#65b5a715'], [17, '#8dc7b622'], [7, '#bdd3a749']]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke(edge);
    }
    for (const tile of patch.tiles) {
      const x = tile.x - size / 2;
      const y = tile.y - size / 2;
      const roll = Math.floor(random() * 3);
      const palette = tile.type === TERRAIN.pier ? ['#8d6246', '#956a49', '#9b7050']
        : tile.type === TERRAIN.square ? ['#a29171', '#ad9978', '#9b8a6e']
          : district ? ['#8a886b', '#82856a', '#8b8b72'] : ['#7f8f6a', '#778969', '#85936e'];
      ctx.fillStyle = palette[roll];
      ctx.fillRect(x, y, size, size);
      if (tile.type === TERRAIN.pier) {
        for (let plank = 0; plank < size; plank += 7) {
          ctx.fillStyle = '#362c2a5e';
          ctx.fillRect(x, y + plank, size, 1);
          ctx.fillStyle = '#f1c48530';
          ctx.fillRect(x + 2, y + plank + 2, 24, 1);
        }
        continue;
      }
      for (let dot = 0; dot < 7; dot++) {
        ctx.fillStyle = dot % 2 ? '#202d2e2b' : '#ede6b83a';
        ctx.fillRect(x + random() * 25, y + random() * 25, 1 + random() * 3, 1);
      }
      if (tile.type === TERRAIN.square) {
        ctx.strokeStyle = '#50463143';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 2, 24, 24);
      }
      if (tile.type === TERRAIN.rubble) this.ruin(ctx, x, y, roll);
    }
    ctx.strokeStyle = district ? '#b4ae86' : '#a6a781';
    ctx.lineWidth = 2;
    ctx.stroke(edge);
    return canvas;
  }

  ruin(ctx, x, y, variant) {
    ctx.fillStyle = '#33423d';
    ctx.fillRect(x + 1, y + 1, 26, 26);
    ctx.fillStyle = '#182f32';
    ctx.fillRect(x + 5, y + 5, 18, 18);
    ctx.fillStyle = '#a19b7b';
    ctx.fillRect(x + 1, y + 1, 5, 23);
    ctx.fillRect(x + 1, y + 1, variant === 0 ? 16 : 25, 5);
    ctx.fillStyle = '#666b57';
    ctx.fillRect(x + 23, y + 5, 4, 11 + variant * 4);
    ctx.fillRect(x + 10 + variant * 2, y + 22, 16 - variant * 2, 5);
    ctx.fillStyle = '#77745f';
    ctx.fillRect(x + 9, y + 9, 5, 3);
    ctx.fillRect(x + 16, y + 15, 4, 5);
  }

  draw(game) {
    const ctx = this.ctx;
    const water = game.tide.water;
    const night = 1 - water;
    ctx.fillStyle = this.sea;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    this.chart();
    this.waves(game.time, 1);
    ctx.globalAlpha = 1 - water * 0.68;
    ctx.drawImage(this.district, 0, 0);
    ctx.globalAlpha = 1;
    this.waves(game.time, water * 0.8);
    ctx.drawImage(this.harbor, 0, 0);
    this.harborDetails(game.harbor);

    ctx.fillStyle = `rgba(6, 16, 37, ${night * 0.48})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    this.lights(game, night);
    this.dockMarker(game.time);
    if (game.tide.exposed) {
      const action = game.interaction;
      if (action?.type === 'land') this.ring(action.landing.x, action.landing.y, 12, '#ffe1a6', game.time);
      for (const piece of game.loot) this.debris(piece, game.time);
    }
    this.drawBoat(game.boat, game.time, game.mode === 'foot');
    if (game.mode === 'foot') this.drawWalker(game.walker);
  }

  chart() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#c7e0d815';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 22; x < VIEW.width; x += 64) {
      ctx.moveTo(x + 0.5, 17);
      ctx.lineTo(x + 0.5, VIEW.height - 17);
    }
    for (let y = 17; y < VIEW.height; y += 64) {
      ctx.moveTo(22, y + 0.5);
      ctx.lineTo(VIEW.width - 22, y + 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = '#c7e0d830';
    ctx.strokeRect(21.5, 16.5, VIEW.width - 43, VIEW.height - 33);
  }

  waves(time, opacity) {
    if (opacity < 0.01) return;
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(178, 234, 224, ${opacity * 0.16})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const wave of this.ripples) {
      const x = wave.x + Math.sin(time * 0.49 + wave.offset) * 7;
      const y = wave.y + Math.cos(time * 0.72 + wave.offset) * 2;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + wave.length * 0.5, y - 3, x + wave.length, y);
    }
    ctx.stroke();
  }

  harborDetails(progress) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#c0ad816f';
    ctx.lineWidth = 16;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(294, 348);
    ctx.lineTo(157, 348);
    ctx.lineTo(127, 316);
    ctx.lineTo(127, 288);
    ctx.moveTo(190, 348);
    ctx.lineTo(190, 398);
    ctx.stroke();
    for (const [x, y, r] of [[100, 322, 8], [154, 257, 10], [212, 255, 8], [242, 274, 9], [108, 383, 11], [110, 409, 6], [210, 436, 9], [260, 371, 10]]) {
      this.disc(x + 2, y + 4, r + 2, '#343f31');
      this.disc(x, y, r, '#54694b');
      this.disc(x - 2, y - 2, r * 0.65, '#6b8056');
    }
    for (const x of [292, 318, 344, 368]) {
      for (const y of [322, 374]) {
        this.disc(x + 1, y + 2, 4, '#50382d');
        this.disc(x, y, 3, '#c49968');
      }
    }
    const { x, y } = this.world.lighthouse;
    this.disc(x + 4, y + 5, 20, '#283a36');
    this.disc(x, y, 18, '#d6c29b');
    this.disc(x, y, 14, '#914d39');
    this.disc(x, y, 9, '#e3c089');
    for (const building of progress.built) {
      if (building.sprite === 'shed') {
        const { x, y } = building;
        ctx.fillStyle = '#333930';
        ctx.fillRect(x - 13, y - 9, 31, 24);
        ctx.fillStyle = '#8e523b';
        ctx.fillRect(x - 15, y - 12, 30, 24);
        ctx.fillStyle = '#bc7955';
        ctx.fillRect(x - 15, y - 12, 30, 10);
        ctx.fillStyle = '#503a32';
        ctx.fillRect(x - 4, y + 7, 8, 6);
      } else {
        this.disc(building.x, building.y, 7, '#594537');
      }
    }
  }

  lights(game, night) {
    const { x, y } = this.world.lighthouse;
    this.glow(x, y, 66 + night * 35, 0.29 + night * 0.46);
    if (night > 0.05) {
      const ctx = this.ctx;
      const angle = game.time * 0.58;
      const beam = ctx.createRadialGradient(x, y, 4, x, y, 163);
      beam.addColorStop(0, `rgba(255, 221, 149, ${night * 0.38})`);
      beam.addColorStop(1, '#ffd48d00');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 163, angle - 0.16, angle + 0.16);
      ctx.closePath();
      ctx.fill();
    }
    this.disc(x, y, 5, '#fff1bc');
    this.glow(game.boat.x, game.boat.y, 40 + night * 27, 0.2 + night * 0.58);
    for (const building of game.harbor.built) {
      const radius = building.sprite === 'lamp' ? 53 : 32;
      this.glow(building.x, building.y, radius, 0.22 + night * 0.47);
      this.disc(building.x, building.y, 3, '#ffe9aa');
    }
  }

  dockMarker(time) {
    const { x, y } = this.world.dock;
    this.ring(x, y, 9, '#ffcc82', time);
    this.disc(x, y, 2, '#fff0b2');
  }

  debris(piece, time) {
    const ctx = this.ctx;
    const pulse = 0.48 + Math.sin(time * 4 + piece.x) * 0.17;
    this.glow(piece.x, piece.y, 15, pulse);
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(Math.PI / 4 + piece.kind * 0.23);
    ctx.fillStyle = ['#ffdd8e', '#f7b77b', '#ffe9bd'][piece.kind];
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.fillStyle = '#fff2ca';
    ctx.fillRect(-3.5, -3.5, 7, 1.5);
    ctx.restore();
  }

  drawBoat(boat, time, anchored) {
    const ctx = this.ctx;
    if (anchored) this.ring(boat.x, boat.y, 21, '#f3ca8a', time);
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.heading);
    if (boat.moving) {
      ctx.strokeStyle = '#b8e2da86';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-9, -4);
      ctx.quadraticCurveTo(-20, -5, -33 - Math.sin(time * 12) * 4, -12);
      ctx.moveTo(-9, 4);
      ctx.quadraticCurveTo(-20, 5, -33 - Math.sin(time * 12) * 4, 12);
      ctx.stroke();
    }
    ctx.fillStyle = '#182628';
    ctx.strokeStyle = '#fad693';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.quadraticCurveTo(5, -9, -6, -8);
    ctx.lineTo(-11, -6);
    ctx.lineTo(-11, 6);
    ctx.lineTo(-6, 8);
    ctx.quadraticCurveTo(5, 9, 13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#9b5a3c';
    ctx.fillRect(-8, -5, 9, 10);
    ctx.fillStyle = '#dd9763';
    ctx.fillRect(-5, -5, 2, 10);
    this.disc(4, 0, 2.8, '#fff3c1');
    ctx.restore();
  }

  drawWalker(walker) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(walker.x, walker.y);
    ctx.rotate(walker.heading);
    this.disc(0, 0, 7, '#332a2e');
    this.disc(0, 0, 5.5, '#ce7957');
    this.disc(2, 0, 3.4, '#ffdfa6');
    ctx.restore();
  }

  ring(x, y, radius, color, time) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.68 + Math.sin(time * 4) * 0.22;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  disc(x, y, radius, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  glow(x, y, radius, intensity) {
    const ctx = this.ctx;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgba(255, 211, 132, ${intensity})`);
    glow.addColorStop(0.27, `rgba(255, 177, 92, ${intensity * 0.48})`);
    glow.addColorStop(1, '#ffab5000');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}
