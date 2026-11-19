'use strict';

const CUES = {
  impact: { color: '#e4a582', duration: 0.7 },
  ebb: { color: '#a0f4e2', duration: 1.2 },
  relic: { color: '#ffe19d', duration: 1.05 },
  delivery: { color: '#f0c784', duration: 0.8 },
  rescue: { color: '#ffce9d', duration: 1 },
  upgrade: { color: '#ffdf98', duration: 1.5 },
  flood: { color: '#7dcdde', duration: 0.9 },
};

class Feedback {
  constructor() {
    this.audio = new GameAudio();
    this.effects = [];
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  }

  update(game) {
    this.audio.update(game);
    for (const cue of game.cues.splice(0)) {
      this.audio.play(cue.type);
      const style = CUES[cue.type];
      if (!style) continue;
      this.effects.push({ ...cue, ...style, start: game.time });
    }
    this.effects = this.effects.filter(effect => game.time - effect.start < effect.duration);
  }

  draw(ctx, time) {
    if (!this.effects.length) return;
    ctx.save();
    for (const effect of this.effects) {
      const { x, y, color, type } = effect;
      const progress = (time - effect.start) / effect.duration;
      const rare = type === 'relic' || type === 'upgrade';
      const spread = rare ? 43 : 24;
      const opacity = 1 - progress;
      ctx.globalAlpha = opacity * 0.78;
      const radius = 12 + spread * Math.sqrt(progress);
      const bloom = ctx.createRadialGradient(x, y, 0, x, y, radius);
      bloom.addColorStop(0, color + '55'); bloom.addColorStop(1, color + '00');
      ctx.fillStyle = bloom; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      if (progress < 0.24) {
        ctx.globalAlpha = (1 - progress / 0.24) * (rare ? 0.11 : 0.045);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      }
    }
    ctx.restore();
  }
}
