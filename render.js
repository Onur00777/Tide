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
    this.districtLayers = new Map();
    this.openWater = new Path2D();
    this.openWater.rect(0, 0, VIEW.width, VIEW.height);
    this.openWater.addPath(this.harbor.land);
    const ctx = this.ctx;
    this.sea = this.paintSea();
    this.vignette = ctx.createRadialGradient(550, 286, 125, 550, 286, 635);
    this.vignette.addColorStop(0, '#04142100');
    this.vignette.addColorStop(1, '#041421a8');
  }

  districtLayer() {
    const patch = this.world.district;
    const existing = this.districtLayers.get(patch.rows);
    if (existing) return existing;
    const layer = this.paintPatch(patch, true);
    layer.waterMask = new Path2D(this.openWater);
    layer.waterMask.addPath(layer.land);
    this.districtLayers.set(patch.rows, layer);
    return layer;
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
        const caustic = noise((x + y * 0.45) / 25, y / 11);
        const sparkle = Math.max(0, ripples - 0.61) * (16 + caustic * 21);
        const i = (y * canvas.width + x) * 4;
        image.data[i] = 4 + depth * 37 + sparkle;
        image.data[i + 1] = 22 + depth * 99 + sparkle;
        image.data[i + 2] = 42 + depth * 90 + sparkle;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  paintPatch(patch, district) {
    const canvas = document.createElement('canvas');
    const resolution = 1.5;
    canvas.width = VIEW.width * resolution;
    canvas.height = VIEW.height * resolution;
    const ctx = canvas.getContext('2d');
    ctx.scale(resolution, resolution);
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
    soil.addColorStop(0, district ? '#938f79' : '#777e5e');
    soil.addColorStop(0.54, district ? '#586d6d' : '#4a5f53');
    soil.addColorStop(1, district ? '#8a7465' : '#72745b');
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
      if (district && tile.type === TERRAIN.street) {
        const roadside = DIRECTIONS.some(([dx, dy]) => {
          const type = patch.at(tile.col + dx, tile.row + dy);
          return type === TERRAIN.rubble || type === TERRAIN.door;
        });
        if (roadside) {
          ctx.fillStyle = '#a2adb622';
          ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
          const stain = ctx.createRadialGradient(x + 14, y + 14, 1, x + 14, y + 14, 18);
          stain.addColorStop(0, '#283e4880');
          stain.addColorStop(1, '#283e4800');
          ctx.fillStyle = stain;
          ctx.fillRect(x, y, size, size);
        }
      }
      for (let dot = 0; dot < 22; dot++) {
        const grain = random();
        ctx.fillStyle = grain > 0.55 ? '#162c3536' : '#e6cba12c';
        ctx.fillRect(x + random() * size, y + random() * size, 0.5 + grain * 1.5, 0.55 + grain * 0.95);
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
      if (tile.type === TERRAIN.rubble || tile.type === TERRAIN.door) this.ruin(ctx, tile, patch, roll);
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

  ruin(ctx, tile, patch, variant) {
    const { x, y, col, row } = tile;
    const extendsTo = (dx, dy) => {
      const type = patch.at(col + dx, row + dy);
      return type === TERRAIN.rubble || type === TERRAIN.door;
    };
    ctx.save();
    ctx.translate(x, y);
    const left = extendsTo(-1, 0) ? -14 : -11;
    const top = extendsTo(0, -1) ? -14 : -11;
    const right = extendsTo(1, 0) ? 14 : 11;
    const bottom = extendsTo(0, 1) ? 14 : 11;
    const width = right - left;
    const height = bottom - top;
    ctx.fillStyle = '#081620b4';
    ctx.fillRect(left + 1, top + 3, width + 3, height + 2);
    ctx.fillStyle = '#30464b';
    ctx.fillRect(left, top, width, height);
    const wall = ['#8f7664', '#768989', '#a17e67'][variant];
    ctx.fillStyle = wall;
    if (top !== -14) ctx.fillRect(left, top, width, 4);
    if (left !== -14) ctx.fillRect(left, top, 4, height);
    if (right !== 14) ctx.fillRect(right - 3, top + 1, 3, height * 0.74);
    if (bottom !== 14) ctx.fillRect(left + 3, bottom - 2, width * 0.58, 2);
    ctx.fillStyle = '#ccb59a91';
    if (top !== -14) ctx.fillRect(left + 1, top, width - 2, 1);
    if (left !== -14) ctx.fillRect(left, top + 1, 1, height - 2);
    ctx.fillStyle = '#142933';
    ctx.fillRect(-7, -6, 14, 13);
    if (variant === 0) {
      ctx.fillStyle = '#78938e';
      ctx.fillRect(-5, -5, 1, 11);
      ctx.fillRect(-4, 3, 8, 1);
    } else {
      const roof = ctx.createLinearGradient(-7, -7, 7, 7);
      roof.addColorStop(0, variant === 1 ? '#688c91' : '#a56d59');
      roof.addColorStop(1, '#395362');
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(-7, -7);
      ctx.lineTo(8, -7);
      ctx.lineTo(8, 0);
      ctx.lineTo(1, 0);
      ctx.lineTo(-2, 5);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#dfad876e';
      for (let beam = -5; beam < 7; beam += 3) ctx.fillRect(beam, -6, 0.65, 5);
    }
    ctx.fillStyle = wall;
    ctx.fillRect(4, 7, 2, 2);
    ctx.fillRect(-6, 7, 3, 1);
    ctx.restore();
  }

  draw(game) {
    const ctx = this.ctx;
    const district = this.districtLayer();
    const water = game.tide.water;
    const night = 0.38 + (1 - water) * 0.62;
    const waterMask = game.tide.exposed ? district.waterMask : this.openWater;
    ctx.drawImage(this.sea, 0, 0, VIEW.width, VIEW.height);
    this.waves(game.time, 1);
    ctx.globalAlpha = 1 - water * 0.68;
    ctx.drawImage(district.canvas, 0, 0, VIEW.width, VIEW.height);
    ctx.globalAlpha = 1;
    if (water > 0.01) {
      ctx.save();
      ctx.clip(district.land);
      ctx.fillStyle = `rgba(54, 122, 145, ${water * 0.2})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      this.waves(game.time, water);
      ctx.restore();
    }
    this.surf(district.coast, game.time, 1 - water * 0.9);
    this.drawDistrictConditions(game);
    ctx.drawImage(this.harbor.canvas, 0, 0, VIEW.width, VIEW.height);
    this.surf(this.harbor.coast, game.time, 1);
    this.harborDetails(game.harbor, game.time);

    ctx.fillStyle = `rgba(6, 16, 37, ${night * 0.37})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    this.lights(game, night, waterMask);
    this.dockMarker(game.time);
    if (game.tide.exposed) {
      const action = game.interaction;
      if (action?.type === 'land') this.ring(action.landing.x, action.landing.y, 12, '#ffe1a6', game.time);
      this.drawExpedition(game.expedition, game.time);
    }
    const anchored = game.mode === 'foot';
    this.drawBoat(game.boat, game.time, anchored, night, waterMask, anchored ? [] : game.cargo);
    if (anchored) this.drawWalker(game.walker, game.time);
    const target = game.target;
    if (target?.label === 'Batık kıyı') {
      this.ring(target.point.x, target.point.y, 15, '#8fedd7', game.time);
      this.glow(target.point.x, target.point.y, 22, 0.16);
    }
  }

  drawDistrictConditions(game) {
    const { tide, time } = game;
    const ctx = this.ctx;
    if (tide.exposed) {
      for (const [tile, kind] of this.world.hazards) {
        if (this.world.isRaised(tile)) continue;
        if (kind === 'pool') {
          this.drawPuddle(tile, time, tide.warning, this.world.wetness(tile, tide.water));
          continue;
        }
        const { x, y } = tile;
        ctx.fillStyle = kind === 'algae' ? '#638956a6' : '#785745c4';
        ctx.fillRect(x - 13, y - 13, 26, 26);
        for (let i = 0; i < 7; i++) {
          const ox = (i * 13 + tile.col) % 21 - 10;
          const oy = (i * 9 + tile.row) % 21 - 10;
          this.disc(x + ox, y + oy, 2.2, kind === 'algae' ? '#a0af688e' : '#432e28a3');
        }
      }
    }
    for (const tile of this.world.escape) {
      const { x, y } = tile;
      if (!this.world.roofs.has(tile)) {
        ctx.fillStyle = '#514c42';
        ctx.fillRect(x - 13, y - 10, 26, 24);
        ctx.fillStyle = '#8a8170';
        ctx.fillRect(x - 13, y - 13, 26, 23);
      }
      // Pale coping marks the continuous dry route back to the landing.
      ctx.strokeStyle = '#ebd4a8b0';
      ctx.lineWidth = 1.3;
      ctx.strokeRect(x - 11, y - 11, 22, 21);
    }
  }

  drawPuddle({ x, y }, time, warning, depth) {
    const ctx = this.ctx;
    const tremor = warning ? Math.sin(time * 33 + x) * 1.1 : 0;
    ctx.fillStyle = `rgba(43, 108, 134, ${0.62 + depth * 0.32})`;
    ctx.beginPath();
    ctx.ellipse(x + tremor, y, 11 + depth * 4, 6 + depth * 9, -0.15, 0, Math.PI * 2);
    ctx.fill();
    if (!warning) return;
    ctx.strokeStyle = '#c1f1e2bc';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const bubble = (time * 2.1 + i / 4 + x / 37) % 1;
      ctx.beginPath();
      ctx.ellipse(x - 7 + i * 4 + tremor, y + (i % 2) * 3 - bubble * 4,
        1 + bubble * 2, 0.7 + bubble, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawExpedition(trip, time) {
    const ctx = this.ctx;
    for (const site of trip.sites) {
      const { x, y, opened } = site;
      const active = trip.opening?.site === site;
      const color = opened ? '#547178' : active ? '#ffd298' : '#98f5dd';
      if (!opened) this.vaultLight(x, y, time, active);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#10252c';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.lineWidth = 1.15;
      ctx.strokeStyle = color;
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.fillStyle = color;
      ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
      ctx.restore();
      if (!active) continue;
      ctx.strokeStyle = '#ffe3a7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const angle = Math.PI * 2 * trip.opening.elapsed / site.seconds;
      ctx.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + angle);
      ctx.stroke();
    }
  }

  vaultLight(x, y, time, active) {
    const ctx = this.ctx;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, active ? 34 : 26);
    const opacity = 0.28 + 0.1 * Math.sin(time * 2.4 + x);
    glow.addColorStop(0, active ? '#ffbd688b' : `rgba(101, 250, 222, ${opacity})`);
    glow.addColorStop(1, active ? '#ffbd6800' : '#65fade00');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 35, y - 35, 70, 70);
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

  harborDetails(progress, time) {
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
      if (building.sprite === 'forge') {
        const { x, y } = building;
        ctx.fillStyle = '#111b218a';
        ctx.fillRect(x - 17, y - 11, 55, 40);
        const roof = ctx.createLinearGradient(x, y - 16, x, y + 17);
        roof.addColorStop(0, '#b97857');
        roof.addColorStop(0.5, '#875144');
        roof.addColorStop(0.53, '#483c3b');
        roof.addColorStop(1, '#654138');
        ctx.fillStyle = roof;
        ctx.fillRect(x - 23, y - 15, 49, 33);
        ctx.strokeStyle = '#d8956a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 23, y - 15, 49, 33);
        ctx.fillStyle = '#f0b376';
        ctx.fillRect(x - 15, y + 16, 10, 3);
        ctx.fillRect(x + 7, y + 16, 9, 3);
        this.disc(x + 17, y - 13, 10, '#2b2a2b');
        this.disc(x + 16, y - 16, 7, '#aa6249');
        this.disc(x + 16, y - 16, 4.5, '#252427');
        for (let i = 0; i < 6; i++) {
          const flight = (time * 0.43 + i / 6) % 1;
          const tone = (1 - flight) * 0.18;
          this.disc(x + 16 + flight * 26, y - 16 - flight * 32, 4 + flight * 12, `rgba(226, 187, 163, ${tone})`);
        }
        this.crane(279, 329, 0.65);
      } else if (building.sprite === 'crane') {
        this.crane(building.x, building.y, 1.05);
      } else {
        this.disc(building.x + 3, building.y + 4, 13, '#172827');
        this.disc(building.x, building.y, 10, '#aa8460');
        this.disc(building.x, building.y, 6, '#f7d293');
      }
    }
  }

  crane(x, y, size) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = '#111b21ad';
    ctx.fillRect(-12, -7, 28, 23);
    ctx.fillStyle = '#725745';
    ctx.fillRect(-15, -10, 27, 22);
    ctx.strokeStyle = '#30272a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-6, -35);
    ctx.lineTo(47, -18);
    ctx.stroke();
    ctx.strokeStyle = '#d59c68';
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(-6, -35);
    ctx.lineTo(47, -18);
    ctx.lineTo(10, -20);
    ctx.lineTo(0, 5);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#eda979';
    ctx.beginPath();
    ctx.moveTo(47, -18);
    ctx.lineTo(48, 9);
    ctx.lineTo(44, 12);
    ctx.lineTo(42, 9);
    ctx.stroke();
    this.disc(47, -18, 2.7, '#ffdeb1');
    ctx.restore();
  }

  lights(game, night, waterMask) {
    const ctx = this.ctx;
    const { x, y } = this.world.lighthouse;
    ctx.save();
    ctx.clip(waterMask, 'evenodd');
    this.reflect(x, y, 97, night * 0.47, game.time);
    this.reflect(game.boat.x, game.boat.y, 36, 0.11 + night * 0.57, game.time);
    ctx.restore();
    this.glow(x, y, 66 + night * 35, 0.29 + night * 0.46);
    if (night > 0.05) {
      const angle = game.time * 0.58;
      for (const [width, intensity] of [[0.27, 0.13], [0.18, 0.19], [0.095, 0.22]]) {
        const beam = ctx.createRadialGradient(x, y, 5, x, y, game.harbor.beam);
        beam.addColorStop(0, `rgba(255, 232, 171, ${night * intensity})`);
        beam.addColorStop(1, '#ffd48d00');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, game.harbor.beam, angle - width, angle + width);
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

  drawBoat(boat, time, anchored, night, waterMask, cargo) {
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
    for (const [index, item] of cargo.entries()) {
      const x = -9.5 + Math.floor(index / 2) * 4.4;
      const y = index % 2 ? 0.65 : -4.25;
      ctx.fillStyle = '#36251d';
      ctx.fillRect(x, y, 4.1, 4.2);
      ctx.fillStyle = item.color ?? '#c59360';
      ctx.fillRect(x + 0.4, y, 3.1, 3.2);
      ctx.fillStyle = '#8d563c';
      ctx.fillRect(x + 1.45, y + 0.05, 0.7, 3.1);
    }
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

  drawWalker(walker, time) {
    const ctx = this.ctx;
    this.glow(walker.x, walker.y, 24, 0.23);
    ctx.save();
    const hop = clamp((time - (walker.hopAt ?? -1)) / 0.27, 0, 1);
    ctx.translate(walker.x, walker.y - Math.sin(hop * Math.PI) * 5);
    ctx.rotate(walker.heading);
    const pace = walker.moving ? Math.sin(time * 16) * 2.3 : 0;
    ctx.fillStyle = '#14212b';
    ctx.fillRect(-7 + pace, -4, 6, 2.5);
    ctx.fillRect(-7 - pace, 1.5, 6, 2.5);
    ctx.fillStyle = '#b86c52';
    ctx.beginPath();
    ctx.ellipse(-1.3, 0, 5.2, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a3d38';
    ctx.fillRect(-4.5, -3, 3, 6);
    this.disc(2.1, 0, 3.6, '#ebb37e');
    this.disc(3.8, -0.2, 1.35, '#fff0c2');
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
