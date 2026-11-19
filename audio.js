'use strict';

const SOUND_LEVELS = Object.freeze({ on: 0.46, quiet: 0.19, off: 0 });
const SOUND_KEY = 'gelgit.sound';

// Tones describe start/end pitch, onset, duration, peak gain and attack in seconds.
const AUDIO_EVENTS = {
  thunder: { noise: [2.6, 0.17, 0.12, 180], tones: [[43, 25, 0, 2.8, 0.09, 0.18]], gap: 5 },
  retreat: { tones: [[59, 43, 0, 3.4, 0.085, 0.75], [89, 56, 0.25, 3.1, 0.036, 0.85]] },
  undertow: { tones: [[42, 55, 0, 3.1, 0.092, 0.82], [66, 77, 0.35, 2.9, 0.033, 0.65]] },
  rising: { tones: [[48, 61, 0, 3.7, 0.104, 0.8], [82, 97, 0.3, 3.1, 0.038, 0.78]] },
  relic: { noise: [0.25, 0.11, 0.048, 370], tones: [[148, 105, 0, 0.31, 0.077, 0.034], [247, 239, 0.07, 0.71, 0.034, 0.055]] },
  delivery: { tones: [[127, 106, 0, 0.41, 0.055, 0.062], [195, 183, 0.12, 0.64, 0.032, 0.085]] },
  rescue: { tones: [[147, 145, 0, 0.56, 0.051, 0.08], [220, 217, 0.16, 0.75, 0.036, 0.10]] },
  upgrade: { noise: [0.28, 0.09, 0.04, 445], tones: [[116, 99, 0, 0.43, 0.072, 0.045], [207, 199, 0.04, 0.64, 0.043, 0.046], [312, 298, 0.075, 0.91, 0.027, 0.055]] },
  impact: { noise: [0.29, 0.12, 0.052, 310], tones: [[81, 49, 0, 0.39, 0.086, 0.06]], gap: 0.85 },
  flood: { tones: [[72, 46, 0, 1.2, 0.062, 0.20]] },
};

function seaNoise(context) {
  const frames = context.sampleRate * 8;
  const overlap = Math.floor(context.sampleRate * 0.18);
  const buffer = context.createBuffer(2, frames, context.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    let seed = 1387 + channel * 6503;
    let bass = 0, low = 0, mid = 0, brown = 0;
    for (let i = 0; i < frames + overlap; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      bass = 0.997 * bass + white * 0.031;
      low = 0.979 * low + white * 0.063;
      mid = 0.882 * mid + white * 0.111;
      brown = 0.996 * brown + white * 0.041;
      const sample = (bass + low + mid) * 0.16 + brown * 0.21;
      if (i < frames) {
        samples[i] = sample;
      } else {
        const j = i - frames;
        const blend = (1 - Math.cos(Math.PI * j / overlap)) / 2;
        samples[j] = sample * (1 - blend) + samples[j] * blend;
      }
    }
  }
  return buffer;
}

class GameAudio {
  constructor() {
    this.level = 'on';
    this.paused = false;
    this.visible = !document.hidden;
    this.voices = new Set();
    this.lastCue = new Map();
    try {
      const saved = localStorage.getItem(SOUND_KEY);
      if (Object.hasOwn(SOUND_LEVELS, saved)) this.level = saved;
    } catch {
      // Storage can be unavailable when the game is opened as a local file.
    }
  }

  get audible() { return this.level !== 'off' && this.visible && !this.paused; }

  unlock() {
    if (!this.audible || this.unavailable) return;
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) return;
    if (!this.context) {
      try {
        this.connect(new Audio());
      } catch {
        this.unavailable = true;
        return;
      }
    }
    if (this.context.state !== 'running' && !this.resuming) {
      this.resuming = this.context.resume().catch(() => {}).finally(() => { this.resuming = null; });
    }
  }

  connect(context) {
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 29;
    highpass.Q.value = 0.6;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 740;
    lowpass.Q.value = 0.45;
    const output = context.createGain();
    output.gain.value = 0;
    highpass.connect(lowpass).connect(output).connect(context.destination);

    const water = context.createBufferSource();
    const noiseBuffer = seaNoise(context);
    water.buffer = noiseBuffer;
    water.loop = true;
    const swell = context.createGain();
    swell.gain.value = 0.16;
    const wave = context.createOscillator();
    wave.type = 'sine';
    wave.frequency.value = 0.12;
    const depth = context.createGain();
    depth.gain.value = 0.055;
    wave.connect(depth).connect(swell.gain);
    water.connect(swell).connect(highpass);
    water.start();
    wave.start();

    Object.assign(this, { context, mix: highpass, output, noiseBuffer });
    this.updateVolume();
  }

  updateVolume() {
    if (!this.output) return;
    const now = this.context.currentTime;
    const target = this.audible ? SOUND_LEVELS[this.level] : 0;
    if (this.fade?.target === target) return;
    const { start = now, from = 0, target: previous = 0 } = this.fade ?? {};
    const progress = Math.min(1, (now - start) / 0.18);
    const current = from + (previous - from) * progress;
    const gain = this.output.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(current, now);
    gain.linearRampToValueAtTime(target, now + 0.18);
    this.fade = { start: now, from: current, target };
  }

  cycleLevel() {
    this.level = { on: 'quiet', quiet: 'off', off: 'on' }[this.level];
    try {
      localStorage.setItem(SOUND_KEY, this.level);
    } catch {
      // The preference still applies for the current session.
    }
    this.unlock();
    this.updateVolume();
  }

  setVisible(visible) {
    this.visible = visible;
    this.updateVolume();
  }

  update(game) {
    this.paused = game.paused;
    this.updateVolume();
    const { tide } = game;
    if (this.tidePhase !== tide.index) {
      this.tidePhase = tide.index;
      this.heardTide = false;
    }
    if (this.heardTide) return;
    const cue = tide.index === 1 ? 'retreat' : tide.rising ? 'rising' : tide.warning && tide.surge > 0 ? 'undertow' : null;
    if (cue) this.heardTide = this.play(cue);
  }

  play(type) {
    const cue = AUDIO_EVENTS[type];
    if (!cue || !this.audible || this.context?.state !== 'running') return false;
    const now = this.context.currentTime;
    if (now - (this.lastCue.get(type) ?? -Infinity) < (cue.gap ?? 0.22)) return false;
    if (this.voices.size + cue.tones.length + Number(Boolean(cue.noise)) > 8) return false;
    this.lastCue.set(type, now);

    for (const [from, to, delay, duration, peak, attack] of cue.tones) {
      const start = now + delay;
      const tone = this.context.createOscillator();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(from, start);
      tone.frequency.exponentialRampToValueAtTime(to, start + duration);
      this.voice(tone, start, duration, peak, attack);
    }
    if (cue.noise) {
      const [duration, peak, attack, cutoff] = cue.noise;
      const noise = this.context.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.Q.value = 0.5;
      noise.connect(filter);
      this.voice(noise, now, duration, peak, attack, filter);
    }
    return true;
  }

  voice(source, start, duration, peak, attack, input = source) {
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(peak, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration - 0.015);
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    input.connect(envelope).connect(this.mix);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      if (input !== source) input.disconnect();
      envelope.disconnect();
    };
    source.start(start);
    source.stop(start + duration);
  }
}
