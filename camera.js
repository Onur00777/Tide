'use strict';

class Camera {
  constructor(canvas, target) {
    this.canvas = canvas;
    this.x = target.x;
    this.y = target.y;
    this.zoom = 1.52;
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  follow(game, seconds) {
    const onFoot = game.mode === 'foot';
    const actor = onFoot ? game.walker : game.boat;
    const goal = onFoot ? 1.88 : 1.52;
    const slide = this.motion.matches ? 1 : -Math.expm1(-5.6 * seconds);
    this.zoom += (goal - this.zoom) * slide;
    this.scale = Math.max(this.width / VIEW.width, this.height / VIEW.height) * this.zoom;
    const halfX = this.width / (2 * this.scale);
    const halfY = this.height / (2 * this.scale);
    this.x = clamp(this.x + (actor.x - this.x) * slide, halfX, VIEW.width - halfX);
    this.y = clamp(this.y + (actor.y - this.y) * slide, halfY, VIEW.height - halfY);
    this.left = this.width / 2 - this.x * this.scale;
    this.top = this.height / 2 - this.y * this.scale;
  }

  apply(ctx) {
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, this.left * this.dpr, this.top * this.dpr);
  }

  project(point) {
    return { x: point.x * this.scale + this.left, y: point.y * this.scale + this.top };
  }
}
