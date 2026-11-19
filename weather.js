"use strict";

// Simulation owns weather; rendering never advances random state.
class WeatherSystem {
  constructor(random = Math.random) {
    this.random = random;
    this.kind = 'clear';
    this.remaining = 42;
    this.flash = 0;
    this.lightningIn = 6;
    this.intensity = 0;
    this.wake = [];
    this.sampleIn = 0;
    this.clouds = Array.from({ length: 18 }, () => ({ x: random() * VIEW.width, y: random() * VIEW.height, radius: 95 + random() * 150, speed: 8 + random() * 15 }));
  }
  get label() { return { clear: 'Açık gece', fog: 'Sürüklenen sis', storm: 'Şimşekli fırtına' }[this.kind]; }
  get visibility() { return 1 - this.intensity * (this.kind === 'fog' ? 0.65 : 0.3); }
  update(dt, game) {
    this.remaining -= dt;
    const forbidden = game.map?.region.id === 'cathedral';
    if (game.map?.home && game.harbor.ending) { this.kind = 'clear'; this.flash = 0; }
    else if (forbidden) this.kind = 'storm';
    else if (this.remaining <= 0) {
      const choices = ['clear', 'fog', 'storm'].filter(kind => kind !== this.kind);
      this.kind = choices[Math.floor(this.random() * choices.length)];
      this.remaining = 38 + this.random() * 48;
      game.announce('HAVA DEĞİŞİYOR', this.label, 'ebb', 3);
    }
    this.intensity += ((this.kind === 'clear' ? 0 : 1) - this.intensity) * Math.min(1, dt / 5);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.lightningIn -= dt;
    if (this.kind === 'storm' && this.lightningIn <= 0) {
      this.flash = 1;
      this.lightningIn = 8 + this.random() * 12;
      game.signal('thunder', game.boat);
    }
    for (const cloud of this.clouds) cloud.x = (cloud.x + dt * cloud.speed) % (VIEW.width + 500);
    for (const trail of this.wake) trail.life -= dt;
    this.wake = this.wake.filter(trail => trail.life > 0);
    this.sampleIn -= dt;
    if (game.mode === 'boat' && game.boat.currentSpeed > 12 && this.sampleIn <= 0) {
      this.wake.push({ x: game.boat.x, y: game.boat.y, heading: game.boat.heading, life: 3, speed: game.boat.currentSpeed });
      this.sampleIn = 0.09;
    }
  }
  current(time) {
    const force = this.kind === 'storm' ? 22 * this.intensity : 0;
    return { x: Math.sin(time * 0.41) * force, y: Math.cos(time * 0.27) * force * 0.7 };
  }
  drawWater(ctx, game) {
    ctx.save();
    for (const trail of this.wake) {
      const age = 3 - trail.life;
      for (let i = 0; i < 5; i++) {
        const swirl = Math.sin(i * 17.1 + age * 2.1 + trail.x) * (2 + age * 4);
        const x = trail.x - Math.cos(trail.heading) * (12 + age * 4) + Math.sin(trail.heading) * swirl;
        const y = trail.y - Math.sin(trail.heading) * (12 + age * 4) - Math.cos(trail.heading) * swirl;
        const radius = 2 + age * 3 + i * 0.4;
        const foam = ctx.createRadialGradient(x, y, 0, x, y, radius);
        foam.addColorStop(0, `rgba(164,210,204,${trail.life / 3 * 0.08})`);
        foam.addColorStop(1, 'rgba(164,210,204,0)');
        ctx.fillStyle = foam; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    }
    ctx.restore();
  }
  drawAtmosphere(ctx, game, reduced = false) {
    ctx.save();
    if (this.kind === 'fog') for (const cloud of this.clouds) {
      const x = cloud.x - 250;
      const mist = ctx.createRadialGradient(x, cloud.y, 0, x, cloud.y, cloud.radius);
      mist.addColorStop(0, `rgba(132,169,177,${this.intensity * 0.22})`);
      mist.addColorStop(1, 'rgba(74,108,121,0)');
      ctx.fillStyle = mist;
      ctx.fillRect(x - cloud.radius, cloud.y - cloud.radius, cloud.radius * 2, cloud.radius * 2);
    }
    if (this.kind === 'storm') {
      ctx.strokeStyle = `rgba(165,201,216,${this.intensity * 0.24})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 130; i++) {
        const x = (i * 173 + game.time * 115) % VIEW.width;
        const y = (i * 97 + game.time * 310) % VIEW.height;
        ctx.moveTo(x, y); ctx.lineTo(x - 7, y - 17);
      }
      ctx.stroke();
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(220,239,255,${this.flash * (reduced ? 0.09 : 0.7)})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.fillStyle = `rgba(8,26,42,${this.flash * 0.8})`;
      for (let i = 0; i < 11; i++) {
        const x = 540 + i * 42, h = 32 + (i % 3) * 19;
        ctx.beginPath(); ctx.moveTo(x, 285); ctx.lineTo(x, 285 - h);
        ctx.lineTo(x + 13, 265 - h); ctx.lineTo(x + 27, 285 - h); ctx.lineTo(x + 27, 285); ctx.fill();
      }
    }
    ctx.restore();
  }
}
