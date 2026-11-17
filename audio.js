'use strict';

const SOUND_LEVELS = Object.freeze({ on: 0.46, quiet: 0.19, off: 0 });
const SOUND_KEY = 'gelgit.sound';

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
      const sample = (bass + low + mid) * 0.34 + brown * 0.44;
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
    try {
      const saved = localStorage.getItem(SOUND_KEY);
      if (Object.hasOwn(SOUND_LEVELS, saved)) this.level = saved;
    } catch {
      // Storage can be unavailable when the game is opened as a local file.
    }
  }

  get audible() { return this.level !== 'off' && this.visible && !this.paused; }

  unlock() {
    if (!this.audible) return;
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) return;
    if (!this.context) {
      try {
        this.connect(new Audio());
      } catch {
        this.context = null;
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
    const gain = this.output.gain;
    gain.setTargetAtTime(this.audible ? SOUND_LEVELS[this.level] : 0, now, 0.034);
    if (!this.audible) gain.setValueAtTime(0, now + 0.25);
  }

  cycleLevel() {
    this.level = { on: 'quiet', quiet: 'off', off: 'on' }[this.level];
    try {
      localStorage.setItem(SOUND_KEY, this.level);
    } catch {
      // The preference still applies for the current session.
    }
    this.unlock();
    this.refreshVolume();
  }

  refreshVolume() {
    if (!this.output) return;
    const now = this.context.currentTime;
    if (this.output.gain.cancelAndHoldAtTime) this.output.gain.cancelAndHoldAtTime(now);
    else this.output.gain.cancelScheduledValues(now);
    this.updateVolume();
  }

  setVisible(visible) {
    this.visible = visible;
    this.refreshVolume();
  }

  update(game) {
    if (this.paused === game.paused) return;
    this.paused = game.paused;
    this.refreshVolume();
  }
}
