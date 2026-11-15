'use strict';

class Actor {
  constructor(x, y, radius, speed) {
    Object.assign(this, { x, y, radius, speed, heading: 0, moving: false });
  }

  move(dx, dy, seconds, canMove) {
    this.moving = false;
    const length = Math.hypot(dx, dy);
    if (!length) return;

    const stepX = dx / length * this.speed * seconds;
    const stepY = dy / length * this.speed * seconds;
    if (stepX && canMove(this.x + stepX, this.y)) {
      this.x += stepX;
      this.moving = true;
    }
    if (stepY && canMove(this.x, this.y + stepY)) {
      this.y += stepY;
      this.moving = true;
    }
    this.heading = Math.atan2(dy, dx);
  }
}

class HarborProgress {
  constructor() { this.delivered = 0; }

  get built() { return UPGRADES.filter(upgrade => this.delivered >= upgrade.total); }
  get next() { return UPGRADES.find(upgrade => this.delivered < upgrade.total); }
  get level() { return this.built.length + 1; }
  get capacity() { return this.built.reduce((capacity, upgrade) => upgrade.capacity ?? capacity, 4); }
}

class Game {
  constructor() {
    this.world = new World();
    this.tide = new Tide();
    this.harbor = new HarborProgress();
    this.boat = new Actor(411, 348, 11, 187);
    this.walker = new Actor(0, 0, 6, 124);
    this.mode = 'boat';
    this.cargo = 0;
    this.loot = [];
    this.notice = null;
    this.time = 0;
    this.paused = false;
  }

  update(seconds, dx, dy) {
    if (this.paused) return;
    this.time += seconds;
    this.tide.advance(seconds, index => this.onPhaseChange(index));

    const actor = this.mode === 'boat' ? this.boat : this.walker;
    actor.move(dx, dy, seconds, (x, y) => this.world.canOccupy(x, y, actor.radius, this.mode, this.tide.exposed));

    if (this.mode === 'foot' && this.cargo < this.harbor.capacity) {
      const piece = this.loot.findIndex(loot => distance(loot, this.walker) < 15);
      if (piece >= 0) {
        this.loot.splice(piece, 1);
        this.cargo++;
        if (this.cargo === this.harbor.capacity && this.tide.index !== 3) {
          this.notify('Tekne doldu. İskeleye dönüp yükü teslim et.');
        }
      }
    }
  }

  onPhaseChange(index) {
    if (index === 1) this.notify('Su çekiliyor. Kıyı açıldığında tekneden inebilirsin.');
    if (index === 2) {
      const grounded = !this.world.canOccupy(this.boat.x, this.boat.y, this.boat.radius, 'boat', true);
      if (grounded) Object.assign(this.boat, this.world.nearestWater(this.boat));
      this.loot = this.world.spawnLoot();
      this.notify(grounded ? 'Mahalle açıldı. Teknen kıyıdaki derin suya alındı.' : 'Mahalle açıldı. Kıyıda E ile tekneden in.');
    }
    if (index === 3) this.notify(this.mode === 'foot' ? 'Su yükseliyor! Hemen tekneye dön.' : 'Su yükseliyor.', 9);
    if (index === 0) {
      this.loot = [];
      if (this.mode === 'foot') {
        const lost = this.cargo;
        this.cargo = 0;
        this.board();
        this.notify(lost ? `Suya kapıldın. Tekneye döndün, ${lost} parçayı kaybettin.` : 'Suya kapıldın. Tekneye döndün.', 6);
      } else {
        this.notify('Mahalle yeniden su altında.');
      }
    }
  }

  get interaction() {
    if (this.mode === 'foot') {
      const nearBoat = distance(this.walker, this.boat) < 48 && this.world.hasClearLanding(this.boat, this.walker);
      return nearBoat ? { type: 'board', label: 'Tekneye bin' } : null;
    }
    if (distance(this.boat, this.world.dock) < 46 && this.cargo > 0) {
      return { type: 'deliver', label: `${this.cargo} parça teslim et` };
    }
    const landing = this.tide.exposed && this.world.landingNear(this.boat);
    return landing ? { type: 'land', label: 'Demir at ve in', landing } : null;
  }

  get objective() {
    if (this.mode === 'foot') {
      if (this.tide.index === 3) return 'Su yükseliyor. Tekneye hemen dön!';
      if (this.cargo >= this.harbor.capacity) return 'Yük doldu. Demir attığın tekneye dön.';
      return 'Sokaklardaki parlayan enkaz parçalarının üzerinden geç.';
    }
    if (this.cargo > 0) return 'Başlangıç İskelesi’nin ucuna dön ve E ile yükü teslim et.';
    return this.tide.exposed ? 'Batık Mahalle kıyısında E ile demir at.' : 'Batık Mahalle’nin kıyısına ilerle. Sokaklar düşük suda açılır.';
  }

  interact() {
    if (this.paused) return;
    const action = this.interaction;
    if (!action) return;

    if (action.type === 'board') this.board();
    if (action.type === 'land') {
      this.walker.x = action.landing.x;
      this.walker.y = action.landing.y;
      this.walker.heading = this.boat.heading;
      this.walker.moving = false;
      this.boat.moving = false;
      this.mode = 'foot';
    }
    if (action.type === 'deliver') this.deliver();
  }

  board() {
    this.mode = 'boat';
    this.walker.moving = false;
  }

  deliver() {
    const before = this.harbor.level;
    const capacity = this.harbor.capacity;
    const delivered = this.cargo;
    this.harbor.delivered += delivered;
    this.cargo = 0;
    const additions = this.harbor.built.slice(before - 1).map(upgrade => upgrade.name);
    let message = `${delivered} parça teslim edildi.`;
    if (additions.length) message += ` Limana eklendi: ${additions.join(', ')}.`;
    if (capacity !== this.harbor.capacity) message += ` Tekne kapasitesi ${this.harbor.capacity} oldu.`;
    this.notify(message, 6);
  }

  notify(message, duration = 4) {
    this.notice = { message, until: this.time + duration };
  }
}
