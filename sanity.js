"use strict";

class SanitySystem {
  constructor() { this.panic = 0; this.pulseIn = 0; this.whisperIn = 8; this.safe = true; }
  update(dt, game) {
    const actor = game.mode === 'foot' ? game.walker : game.boat;
    this.safe = game.atDock || (game.mode === 'foot' && !game.diving.active && distance(actor, game.boat) < 65)
      || (game.mode === 'boat' && game.harbor.lanternRange > 0 && game.weather.kind !== 'storm');
    const dark = game.mode === 'foot' && !game.harbor.fittings.has('diveLamp');
    const danger = Number(dark) * 1.3 + Number(game.weather.kind === 'storm') * 1.4
      + Number(game.mode === 'foot' && game.tide.rising) * 3 + Number(Boolean(game.diving.active)) * 1.2;
    this.panic = clamp(this.panic + dt * (this.safe ? -10 : danger || -0.6), 0, 100);
    this.pulseIn -= dt; this.whisperIn -= dt;
    if (this.panic > 35 && this.pulseIn <= 0) {
      game.signal('heartbeat', actor); this.pulseIn = 1.2 - this.panic * 0.006;
    }
    if (this.panic > 65 && this.whisperIn <= 0) {
      game.signal('whisper', actor); this.whisperIn = 9;
    }
  }
  draw(ctx, game, reduced) {
    if (this.panic < 20) return;
    const actor = game.mode === 'foot' ? game.walker : game.boat;
    const radius = 220 - this.panic * 1.2;
    ctx.save();
    const veil = ctx.createRadialGradient(actor.x, actor.y, radius * 0.3, actor.x, actor.y, radius);
    veil.addColorStop(0, 'rgba(8,5,18,0)'); veil.addColorStop(1, `rgba(12,4,22,${this.panic * 0.007})`);
    ctx.fillStyle = veil; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (this.panic > 65 && !reduced) for (let i = 0; i < 5; i++) {
      const angle = i * 1.26 + Math.sin(game.time * 0.3) * 0.2;
      const x = actor.x + Math.cos(angle) * radius, y = actor.y + Math.sin(angle) * radius;
      ctx.fillStyle = `rgba(5,3,15,${0.3 + Math.sin(game.time + i) * 0.2})`;
      ctx.beginPath(); ctx.ellipse(x, y, 8, 25, angle, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

class DivingSystem {
  constructor() { this.active = null; }
  get equipped() { return this.game.harbor.fittings.has('diveLamp') && this.game.harbor.fittings.has('boots'); }
  enter(game, site) {
    this.game = game;
    if (!this.equipped || !game.tide.exposed || game.tide.rising || game.full || site.opened) return;
    this.active = { site, elapsed: 0, oxygen: 30, recovered: false };
    game.announce('MAHZENE İNİYORSUN', 'Hareketsiz kal · E ile çık · Yükselen su havanı tüketir', 'ebb', 4);
  }
  update(dt, game) {
    const dive = this.active;
    if (!dive) return;
    dive.oxygen -= dt * (game.tide.rising || !game.tide.exposed ? 2.5 : 1);
    dive.elapsed += dt;
    if (dive.elapsed >= 9 && !dive.recovered && !game.full) {
      game.collect(dive.site.item, game.walker);
      dive.site.opened = true; dive.recovered = true;
      game.announce('MAHZENİN SIRRI', 'Buluntu sende · E ile yüzeye çık', 'find', 5);
    }
    if (dive.oxygen <= 0) {
      game.cargo.pop(); game.sanity.panic = 100;
      game.rescue.board(); game.mode = 'boat'; this.active = null;
      game.boat.hull = Math.max(1, game.boat.hull - 15);
      game.harbor.hull = game.boat.hull; game.persist(game.harbor);
      game.announce('ACİL TAHLİYE', 'Emniyet halatı seni kurtardı · Bir yük kayıp · Gövde −15', 'danger', 5);
    }
  }
  draw(ctx, game) {
    const dive = this.active;
    if (!dive) return;
    const { x, y } = game.walker;
    ctx.save();
    ctx.fillStyle = '#080e19ef'; ctx.fillRect(x - 145, y - 95, 290, 190);
    ctx.strokeStyle = '#647b83'; ctx.lineWidth = 2;
    ctx.strokeRect(x - 131, y - 81, 262, 162);
    const water = clamp(1 - dive.oxygen / 30, 0, 1);
    ctx.fillStyle = '#234c6577'; ctx.fillRect(x - 130, y + 80 - 160 * water, 260, 160 * water);
    ctx.fillStyle = '#ead6a8'; ctx.textAlign = 'center'; ctx.font = '12px Georgia';
    ctx.fillText('MÜHÜRLÜ MAHZEN', x, y - 51);
    ctx.font = '10px sans-serif';
    ctx.fillText(dive.recovered ? 'Sır günlüğüne eklenecek. Limana dön.' : `Mührü çözüyorsun · ${Math.ceil(Math.max(0, 9 - dive.elapsed))} sn`, x, y - 15);
    ctx.fillText(`Hava ${Math.ceil(dive.oxygen)} sn · E: Yüzeye çık`, x, y + 45);
    ctx.strokeStyle = '#c2b083'; ctx.beginPath(); ctx.moveTo(x, y - 80); ctx.lineTo(x + 9, y + 8); ctx.stroke();
    ctx.restore();
  }
}
