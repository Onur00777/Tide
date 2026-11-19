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
      const style = CUES[cue.type];
      if (!style) continue;
      this.audio.play(cue.type);
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
      ctx.strokeStyle = color;
      ctx.lineWidth = rare ? 2.4 : 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 7 + spread * (this.reduced.matches ? 0.2 : progress), 0, Math.PI * 2);
      ctx.stroke();
      if (this.reduced.matches) continue;
      ctx.fillStyle = color;
      for (let i = 0; i < (rare ? 14 : 7); i++) {
        const angle = i * 2.4 + effect.start;
        const radius = 6 + spread * Math.sqrt(progress) * (0.68 + i % 4 * 0.16);
        const size = (rare ? 3.5 : 2.5) * (0.55 + opacity * 0.45);
        ctx.fillRect(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius - progress * 9, size, size);
      }
      if (progress < 0.24) {
        ctx.globalAlpha = (1 - progress / 0.24) * (rare ? 0.11 : 0.045);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      }
    }
    ctx.restore();
  }
}
