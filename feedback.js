'use strict';

const CUES = {
  impact: { color: '#e4a582', duration: 0.7, notes: [[145, 45, 0, 0.26, 0.36], [232, 61, 0.03, 0.13, 0.15]] },
  ebb: { color: '#a0f4e2', duration: 1.2, notes: [[110, 148, 0, 0.44, 0.19], [220, 296, 0.2, 0.55, 0.13], [329, 370, 0.45, 0.7, 0.1]] },
  relic: { color: '#ffe19d', duration: 1.05, notes: [[392, 400, 0, 0.17, 0.16], [523, 528, 0.11, 0.2, 0.16], [784, 790, 0.23, 0.32, 0.16]] },
  delivery: { color: '#f0c784', duration: 0.8, notes: [[260, 360, 0, 0.13, 0.15], [440, 510, 0.11, 0.18, 0.14]] },
  rescue: { color: '#ffce9d', duration: 1, notes: [[260, 320, 0, 0.24, 0.16], [392, 430, 0.18, 0.28, 0.14]] },
  upgrade: { color: '#ffdf98', duration: 1.5, notes: [[261, 264, 0, 0.25, 0.16], [392, 397, 0.12, 0.25, 0.16], [523, 530, 0.24, 0.4, 0.18]] },
  flood: { color: '#7dcdde', duration: 0.9, notes: [[160, 46, 0, 0.45, 0.35], [84, 45, 0.09, 0.33, 0.12]] },
};

class GameAudio {
  constructor() {
    this.enabled = true;
    this.nextSurge = 0;
  }

  unlock() {
    if (!this.enabled) return;
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) return;
    if (!this.context) {
      this.context = new Audio();
      this.output = this.context.createGain();
      this.output.gain.value = 0.42;
      this.output.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.output) this.output.gain.value = this.enabled ? 0.42 : 0;
    if (this.enabled) this.unlock();
  }

  play(notes) {
    if (!this.enabled || this.context?.state !== 'running') return;
    for (const [from, to, delay, duration, volume] of notes) {
      const start = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = from < 180 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain).connect(this.output);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }
  }

  update(game) {
    if (game.paused || (!game.tide.warning && !game.tide.rising)) {
      this.nextSurge = game.time;
      return;
    }
    if (!game.tide.surge || game.time < this.nextSurge || !this.enabled || this.context?.state !== 'running') return;
    this.play([[63, 36, 0, 2.3, 0.38], [86, 42, 0.3, 2.5, 0.24]]);
    this.nextSurge = game.time + 4;
  }
}

class Feedback {
  constructor() {
    this.audio = new GameAudio();
    this.effects = [];
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  }

  update(game) {
    for (const cue of game.cues.splice(0)) {
      const style = CUES[cue.type];
      this.effects.push({ ...cue, ...style, start: game.time });
      this.audio.play(style.notes);
    }
    this.effects = this.effects.filter(effect => game.time - effect.start < effect.duration);
    this.audio.update(game);
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
