'use strict';

class Boat {
  constructor(x, y, hull = 100) {
    Object.assign(this, { x, y, radius: 11, speed: 187, heading: 0, hull, flood: 0, load: 0, engine: 0, armor: false });
    this.stop();
  }

  get currentSpeed() { return Math.hypot(this.velocityX, this.velocityY); }
  get draft() { return this.load * 0.58 + this.flood * 0.42; }

  move(dx, dy, seconds, current, canMove, onImpact) {
    if (seconds <= 0) return;
    const steps = Math.ceil(seconds * 120);
    const dt = seconds / steps;
    const requestedHeading = dx || dy ? Math.atan2(dy, dx) : null;
    let strongestHit = 0;
    this.moving = false;

    for (let step = 0; step < steps; step++) {
      this.flood = Math.min(1, this.flood + (1 - this.hull / 100) * 0.045 * dt);
      const mass = 1 + this.load * 0.5 + this.flood * 0.35;
      const topSpeed = this.speed * (1 - this.load * 0.16 - this.flood * 0.25 - (1 - this.hull / 100) * 0.26);
      let thrust = 0;
      if (requestedHeading !== null) {
        const headingError = requestedHeading - this.heading;
        const turn = Math.atan2(Math.sin(headingError), Math.cos(headingError));
        const turnRate = (5.2 - Math.min(1, this.currentSpeed / topSpeed) * 2.7) / mass;
        this.heading += clamp(turn, -turnRate * dt, turnRate * dt);
        thrust = topSpeed * (0.14 + 0.86 * Math.max(0, Math.cos(requestedHeading - this.heading)));
      }

      // Water-relative thrust and lateral drag let the stern slip through a turn.
      const ax = Math.cos(this.heading);
      const ay = Math.sin(this.heading);
      const vx = this.velocityX - current.x;
      const vy = this.velocityY - current.y;
      const surge = vx * ax + vy * ay;
      const sway = -vx * ay + vy * ax;
      const ahead = thrust + (surge - thrust) * Math.exp(-(thrust ? (2.6 + this.engine * 0.52) / mass : 1.9 / mass) * dt);
      const side = sway * Math.exp(-4.2 / mass * dt);
      this.velocityX = current.x + ahead * ax - side * ay;
      this.velocityY = current.y + ahead * ay + side * ax;

      for (const axis of ['x', 'y']) {
        const velocity = axis === 'x' ? 'velocityX' : 'velocityY';
        if (Math.abs(this[velocity]) < 0.12) continue;
        const next = this[axis] + this[velocity] * dt;
        const x = axis === 'x' ? next : this.x;
        const y = axis === 'y' ? next : this.y;
        if (canMove(x, y)) {
          this[axis] = next;
          this.moving = true;
        } else {
          if (x >= this.radius && y >= this.radius && x <= VIEW.width - this.radius && y <= VIEW.height - this.radius) {
            strongestHit = Math.max(strongestHit, Math.abs(this[velocity]));
          }
          this[velocity] *= -0.12;
        }
      }
    }

    if (strongestHit > 61) {
      const damage = Math.min(this.hull, Math.ceil((strongestHit - 59) * (this.armor ? 0.115 : 0.24)));
      if (damage) {
        this.hull -= damage;
        onImpact(damage);
      }
    }
  }

  stop() {
    this.velocityX = 0;
    this.velocityY = 0;
    this.moving = false;
  }
}
