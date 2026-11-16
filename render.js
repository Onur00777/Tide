'use strict';

function randomFrom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function noiseFrom(seed) {
  const random = randomFrom(seed);
  const size = 64;
  const samples = Float32Array.from({ length: size * size }, random);
  const at = (x, y) => samples[(y & 63) * size + (x & 63)];
  const smooth = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const col = Math.floor(x);
    const row = Math.floor(y);
    const tx = smooth(x - col);
    const ty = smooth(y - row);
    const top = at(col, row) * (1 - tx) + at(col + 1, row) * tx;
    const bottom = at(col, row + 1) * (1 - tx) + at(col + 1, row + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

class Renderer {
  constructor(canvas, world) {
    this.ctx = canvas.getContext('2d');
    this.world = world;
    const random = randomFrom(4172);
    this.ripples = [96, 120, 108].map(count => Array.from({ length: count }, () => ({
      x: random() * VIEW.width, y: random() * VIEW.height,
      length: 8 + random() * 27, offset: random() * Math.PI * 2,
    })));
    this.harbor = this.paintPatch(world.harbor, false);
    this.district = this.paintPatch(world.district, true);
    this.openWater = new Path2D();
    this.openWater.rect(0, 0, VIEW.width, VIEW.height);
    this.openWater.addPath(this.harbor.land);
    this.lowWater = new Path2D(this.openWater);
    this.lowWater.addPath(this.district.land);
    const ctx = this.ctx;
    this.sea = this.paintSea();
    this.vignette = ctx.createRadialGradient(550, 286, 125, 550, 286, 635);
    this.vignette.addColorStop(0, '#04142100');
    this.vignette.addColorStop(1, '#041421a8');
  }

  paintSea() {
    const canvas = document.createElement('canvas');
    canvas.width = VIEW.width / 2;
    canvas.height = VIEW.height / 2;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(canvas.width, canvas.height);
    const noise = noiseFrom(9712);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const sandbank = noise(x / 88, y / 58);
        const current = noise((x + y * 0.55) / 80, y / 19);
        const ripples = noise((x - y * 1.3) / 16, y / 4.5);
        const depth = sandbank * 0.66 + current * 0.26 + ripples * 0.08;
        const sparkle = Math.max(0, ripples - 0.59) * 21;
        const i = (y * canvas.width + x) * 4;
        image.data[i] = 8 + depth * 40 + sparkle;
        image.data[i + 1] = 40 + depth * 81 + sparkle;
        image.data[i + 2] = 54 + depth * 68 + sparkle;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
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
    const coast = [];
    for (const tile of patch.tiles) {
      const x = tile.x - size / 2;
      const y = tile.y - size / 2;
      const sides = [[0, -1, x, y, x + size, y], [1, 0, x + size, y, x + size, y + size],
        [0, 1, x + size, y + size, x, y + size], [-1, 0, x, y + size, x, y]];
      land.moveTo(x, y);
      for (const [dx, dy, x1, y1, x2, y2] of sides) {
        if (tile.type === TERRAIN.pier || patch.at(tile.col + dx, tile.row + dy) !== TERRAIN.sea) {
          land.lineTo(x2, y2);
          continue;
        }
        const bend = (random() - 0.5) * 19;
        const mx = (x1 + x2) / 2 + dx * bend;
        const my = (y1 + y2) / 2 + dy * bend;
        land.quadraticCurveTo(mx, my, x2, y2);
        edge.moveTo(x1, y1);
        edge.quadraticCurveTo(mx, my, x2, y2);
        coast.push({ x1, y1, mx, my, x2, y2, dx, dy, phase: random() * Math.PI * 2 });
      }
      land.closePath();
    }
    ctx.lineCap = 'round';
    for (const [width, color] of [[42, '#57b7a014'], [27, '#65c6a625'], [15, '#75c1a34a'], [6, '#142b2e8c']]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke(edge);
    }

    ctx.save();
    ctx.clip(land);
    const soil = ctx.createLinearGradient(patch.x, patch.y, patch.x + 180, patch.y + 325);
    soil.addColorStop(0, district ? '#ab9d7e' : '#89975f');
    soil.addColorStop(0.5, district ? '#85866d' : '#6e8050');
    soil.addColorStop(1, district ? '#b4a182' : '#96855a');
    ctx.fillStyle = soil;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    for (const tile of patch.tiles) {
      const x = tile.x - size / 2;
      const y = tile.y - size / 2;
      const roll = Math.floor(random() * 3);
      if (tile.type === TERRAIN.pier) {
        ctx.fillStyle = '#4d3a2c';
        ctx.fillRect(x, y, size, size);
        for (let plank = 0; plank < size; plank += 7) {
          ctx.fillStyle = ['#946744', '#a5774f', '#8b6041'][Math.floor(random() * 3)];
          ctx.fillRect(x, y + plank, size - 1, 6);
          ctx.fillStyle = '#f1c48540';
          ctx.fillRect(x + 2, y + plank + 1, 23, 1);
          ctx.fillStyle = '#493223';
          ctx.fillRect(x + 3, y + plank + 3, 1.5, 1);
          ctx.fillRect(x + 23, y + plank + 3, 1.5, 1);
        }
        continue;
      }
      for (let dot = 0; dot < 28; dot++) {
        const grain = random();
        ctx.fillStyle = grain > 0.55 ? '#24322536' : '#f9dcad47';
        ctx.fillRect(x + random() * size, y + random() * size, 0.6 + grain * 2.7, 0.65 + grain * 1.5);
      }
      if (tile.type === TERRAIN.square) {
        ctx.fillStyle = '#50463158';
        ctx.fillRect(x, y, size, size);
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 3; col++) {
            const inset = row % 2 ? 1 : 4;
            ctx.fillStyle = random() > 0.4 ? '#ab9d80' : '#948870';
            ctx.fillRect(x + inset + col * 8, y + row * 7 + 1, 6.5, 5.5);
          }
        }
      }
      if (tile.type === TERRAIN.rubble) this.ruin(ctx, x, y, roll);
    }
    ctx.strokeStyle = district ? '#d1ba8b4f' : '#cbb88d87';
    ctx.lineWidth = 10;
    ctx.stroke(edge);
    ctx.strokeStyle = '#f7dfae87';
    ctx.lineWidth = 1.8;
    ctx.stroke(edge);
    ctx.restore();
    return { canvas, land, coast };
  }

  ruin(ctx, x, y, variant) {
    ctx.save();
    ctx.translate(x + 14, y + 14);
    ctx.rotate(variant * Math.PI / 2);
    ctx.fillStyle = '#302f28ad';
    ctx.fillRect(-11, -9, 24, 22);
    ctx.fillStyle = '#4b5145';
    ctx.fillRect(-9, -8, 19, 18);
    ctx.fillStyle = '#313d37';
    ctx.fillRect(-8, -7, 12, 10);
    ctx.fillStyle = '#706751';
    ctx.fillRect(-11, -11, 25, 5);
    ctx.fillRect(-11, -8, 5, 21);
    ctx.fillRect(8, -8, 5, 11 + variant * 3);
    ctx.fillStyle = '#c1aa84';
    ctx.fillRect(-12, -12, 23, 2);
    ctx.fillRect(-12, -10, 3, 18);
    ctx.fillRect(8, -10, 3, 8 + variant * 3);
    for (let brick = -8; brick < 11; brick += 5) {
      ctx.fillStyle = '#463d32a0';
      ctx.fillRect(brick, -12, 1, 5);
    }
    ctx.fillStyle = '#968668';
    ctx.fillRect(-3, 3, 4, 3);
    ctx.fillRect(4, 8, 3, 3);
    ctx.fillRect(7, 6, 3, 2);
    ctx.fillStyle = '#6b774b';
    ctx.fillRect(1, -8, 5, 2);
    ctx.fillRect(-9, 7, 3, 4);
    ctx.restore();
  }

  draw(game) {
    const ctx = this.ctx;
    const water = game.tide.water;
    const night = 1 - water;
    ctx.drawImage(this.sea, 0, 0, VIEW.width, VIEW.height);
    this.waves(game.time, 1);
    ctx.globalAlpha = 1 - water * 0.68;
    ctx.drawImage(this.district.canvas, 0, 0);
    ctx.globalAlpha = 1;
    if (water > 0.01) {
      ctx.save();
      ctx.clip(this.district.land);
      this.waves(game.time, water);
      ctx.restore();
    }
    this.surf(this.district.coast, game.time, 1 - water * 0.9);
    ctx.drawImage(this.harbor.canvas, 0, 0);
    this.surf(this.harbor.coast, game.time, 1);
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
    const waterMask = game.tide.exposed ? this.lowWater : this.openWater;
    this.drawBoat(game.boat, game.time, game.mode === 'foot', night, waterMask);
    if (game.mode === 'foot') this.drawWalker(game.walker);
  }

  waves(time, opacity) {
    if (opacity < 0.01) return;
    const ctx = this.ctx;
    for (const [layer, waves] of this.ripples.entries()) {
      const light = 0.1 + layer * 0.045;
      ctx.strokeStyle = `rgba(181, 230, 218, ${opacity * light})`;
      ctx.lineWidth = 0.7 + layer * 0.2;
      ctx.beginPath();
      for (const wave of waves) {
        const phase = time * (0.65 + layer * 0.17) + wave.offset;
        const x = wave.x + Math.cos(phase) * (4 + layer * 2);
        const y = wave.y + Math.sin(phase) * 4;
        const length = wave.length * (0.65 + 0.35 * Math.cos(phase));
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + length * 0.54, y - 2.5, x + length, y - 1);
      }
      ctx.stroke();
    }
  }

  surf(coast, time, visibility) {
    const ctx = this.ctx;
    ctx.lineWidth = 0.85;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(209, 241, 221, ${0.5 * visibility})`;
    ctx.beginPath();
    for (const { x1, y1, mx, my, x2, y2, dx, dy, phase } of coast) {
      const crest = 0.5 + Math.sin(time * 1.8 + phase) * 0.5;
      if (crest < 0.27) continue;
      const distance = 3 + crest * 7;
      const ox = dx * distance;
      const oy = dy * distance;
      const inset = crest * 0.18;
      ctx.moveTo(x1 + (x2 - x1) * inset + ox, y1 + (y2 - y1) * inset + oy);
      ctx.quadraticCurveTo(mx + ox, my + oy, x2 - (x2 - x1) * inset + ox, y2 - (y2 - y1) * inset + oy);
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
      this.disc(x + 4, y + 5, r, '#283b2b99');
      this.disc(x, y, r * 0.75, '#3a5540');
      this.disc(x - r * 0.45, y + r * 0.16, r * 0.55, '#506b46');
      this.disc(x + r * 0.47, y - r * 0.14, r * 0.57, '#4d6742');
      this.disc(x - r * 0.18, y - r * 0.43, r * 0.62, '#6f854e');
      this.disc(x - r * 0.32, y - r * 0.53, r * 0.28, '#8d9a58');
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
    this.disc(x, y, 15.5, '#785b48');
    this.disc(x - 0.5, y - 0.5, 13, '#a5543c');
    this.disc(x - 1, y - 1, 10.5, '#433a35');
    this.disc(x, y, 8.8, '#d3a56c');
    ctx.strokeStyle = '#433a35';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 18, Math.PI * 0.12, Math.PI * 1.12);
    ctx.stroke();
    for (const building of progress.built) {
      if (building.sprite === 'shed') {
        const { x, y } = building;
        ctx.fillStyle = '#333930';
        ctx.fillRect(x - 13, y - 9, 31, 24);
        ctx.fillStyle = '#704a37';
        ctx.fillRect(x - 14, y - 11, 29, 24);
        ctx.fillStyle = '#503a32';
        ctx.fillRect(x - 4, y + 7, 8, 6);
        ctx.fillStyle = '#a86648';
        ctx.fillRect(x - 16, y - 13, 32, 11);
        ctx.fillStyle = '#814734';
        ctx.fillRect(x - 16, y - 2, 32, 10);
        ctx.fillStyle = '#d1966b';
        ctx.fillRect(x - 15, y - 3, 30, 1.5);
        for (let seam = x - 11; seam < x + 15; seam += 6) {
          ctx.fillStyle = '#3e2d254a';
          ctx.fillRect(seam, y - 12, 1, 19);
        }
      } else {
        this.disc(building.x, building.y, 7, '#594537');
        this.disc(building.x - 1, building.y - 1, 4.5, '#bd975f');
      }
    }
  }

  lights(game, night) {
    const ctx = this.ctx;
    const { x, y } = this.world.lighthouse;
    ctx.save();
    ctx.clip(game.tide.exposed ? this.lowWater : this.openWater, 'evenodd');
    this.reflect(x, y, 97, night * 0.47, game.time);
    this.reflect(game.boat.x, game.boat.y, 36, 0.11 + night * 0.57, game.time);
    ctx.restore();
    this.glow(x, y, 66 + night * 35, 0.29 + night * 0.46);
    if (night > 0.05) {
      const angle = game.time * 0.58;
      for (const [width, intensity] of [[0.27, 0.13], [0.18, 0.19], [0.095, 0.22]]) {
        const beam = ctx.createRadialGradient(x, y, 5, x, y, 197);
        beam.addColorStop(0, `rgba(255, 232, 171, ${night * intensity})`);
        beam.addColorStop(1, '#ffd48d00');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, 197, angle - width, angle + width);
        ctx.closePath();
        ctx.fill();
      }
    }
    this.disc(x, y, 5, '#fff1bc');
    this.glow(game.boat.x, game.boat.y, 40 + night * 27, 0.2 + night * 0.58);
    for (const building of game.harbor.built) {
      const radius = building.sprite === 'lamp' ? 53 : 32;
      this.glow(building.x, building.y, radius, 0.22 + night * 0.47);
      this.disc(building.x, building.y, 3, '#ffe9aa');
    }
  }

  reflect(x, y, radius, brightness, time) {
    if (brightness < 0.02) return;
    const ctx = this.ctx;
    for (let index = 0; index < 22; index++) {
      const phase = index * 2.4 + time * (0.95 + index * 0.011);
      const offsetY = (index / 21 - 0.43) * radius * 1.8;
      const offsetX = Math.sin(phase) * radius * 0.8;
      const falloff = 1 - Math.hypot(offsetX, offsetY) / radius;
      if (falloff <= 0) continue;
      const glint = 0.44 + 0.56 * Math.sin(phase) ** 2;
      ctx.fillStyle = `rgba(255, 206, 129, ${brightness * falloff * glint})`;
      ctx.fillRect(x + offsetX, y + offsetY, 4 + radius * 0.34 * falloff, 0.8 + falloff);
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

  drawBoat(boat, time, anchored, night, waterMask) {
    const ctx = this.ctx;
    const speed = boat.currentSpeed / boat.speed;
    const roll = Math.sin(time * 2.8 + boat.x * 0.014 + boat.y * 0.023);
    if (anchored) this.ring(boat.x, boat.y, 21, '#f3ca8a', time);
    if (boat.moving) {
      ctx.save();
      ctx.clip(waterMask, 'evenodd');
      this.drawWake(boat, time, speed);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.heading + roll * 0.032);
    ctx.translate(0, roll * 0.8);

    ctx.fillStyle = '#02161c91';
    ctx.beginPath();
    ctx.ellipse(-1, 2.5, 15, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const hull = new Path2D();
    hull.moveTo(14.5, 0);
    hull.bezierCurveTo(9, -6, 1, -8.5, -8, -7.5);
    hull.lineTo(-12, -5.5);
    hull.lineTo(-12, 5.5);
    hull.lineTo(-8, 7.5);
    hull.bezierCurveTo(1, 8.5, 9, 6, 14.5, 0);
    hull.closePath();
    const deck = ctx.createLinearGradient(0, -8, 0, 8);
    deck.addColorStop(0, '#76523e');
    deck.addColorStop(0.35, '#b18059');
    deck.addColorStop(1, '#63443a');
    ctx.fillStyle = deck;
    ctx.fill(hull);
    ctx.save();
    ctx.clip(hull);
    ctx.fillStyle = '#e4b17b64';
    for (const y of [-4, -1, 2, 5]) ctx.fillRect(-12, y, 27, 0.7);
    ctx.fillStyle = '#4b3229';
    ctx.fillRect(-8.5, -4.5, 4, 10);
    ctx.fillRect(-1, -4, 3.5, 9);
    ctx.fillStyle = '#d7ab79';
    ctx.fillRect(-9, -5.25, 3, 10.5);
    ctx.fillRect(-1.5, -4.75, 3, 9.5);
    ctx.restore();
    ctx.strokeStyle = '#e4c69b';
    ctx.lineWidth = 1.55;
    ctx.stroke(hull);
    ctx.fillStyle = '#263638';
    ctx.fillRect(-14.5, -2.6, 4, 5.2);
    ctx.fillStyle = '#8daca6';
    ctx.fillRect(-14, -2.4, 0.9, 3.7);
    this.disc(7, 0, 2.7, '#5c4033');
    this.disc(7, 0, 1.4 + night * 0.45, '#fff0bc');
    ctx.restore();
  }

  drawWake(boat, time, speed) {
    const ctx = this.ctx;
    const length = 8 + speed * 45;
    const spread = 5 + speed * 10;
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(Math.atan2(boat.velocityY, boat.velocityX));
    const foam = ctx.createLinearGradient(-length - 6, 0, -5, 0);
    foam.addColorStop(0, '#9bd0c300');
    foam.addColorStop(0.52, `rgba(149, 210, 197, ${speed * 0.35})`);
    foam.addColorStop(1, `rgba(223, 246, 226, ${speed * 0.85})`);
    ctx.strokeStyle = foam;
    ctx.lineWidth = 1 + speed;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(-4, side * 7);
      ctx.quadraticCurveTo(-length * 0.48, side * 6, -length, side * spread);
      ctx.moveTo(-11, side * 4);
      ctx.quadraticCurveTo(-length * 0.7, side * 3, -length - 5, side * (spread + 3));
    }
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let index = 0; index < 5; index++) {
      const travel = (time * 4 + index / 5) % 1;
      const x = -13 - travel * length;
      const width = (1.8 + travel * 3) * speed;
      ctx.moveTo(x, -width);
      ctx.quadraticCurveTo(x - 3, 0, x - 1, width);
    }
    ctx.stroke();
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
