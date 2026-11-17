'use strict';

class Actor {
  constructor(x, y, radius, speed) {
    Object.assign(this, { x, y, radius, speed, heading: 0, moving: false });
  }

  move(dx, dy, seconds, canMove) {
    const length = Math.hypot(dx, dy);
    const scale = length ? this.speed * seconds / length : 0;
    this.moveBy(dx * scale, dy * scale, canMove);
    if (length) this.heading = Math.atan2(dy, dx);
  }

  moveBy(stepX, stepY, canMove) {
    this.moving = false;
    if (stepX && canMove(this.x + stepX, this.y)) {
      this.x += stepX;
      this.moving = true;
    }
    if (stepY && canMove(this.x, this.y + stepY)) {
      this.y += stepY;
      this.moving = true;
    }
  }
}

class Boat extends Actor {
  constructor(x, y) {
    super(x, y, 11, 187);
    this.stop();
  }

  get currentSpeed() { return Math.hypot(this.velocityX, this.velocityY); }

  move(dx, dy, seconds, canMove) {
    const input = Math.hypot(dx, dy);
    if (!input && this.currentSpeed < 4) {
      this.stop();
      return;
    }

    const throttle = input ? this.speed / input : 0;
    const targetX = dx * throttle;
    const targetY = dy * throttle;
    const response = input ? 6.5 : 4.2;
    const blend = -Math.expm1(-response * seconds);
    const x = this.x;
    const y = this.y;

    // Integrate the velocity change over the frame so coasting is consistent across refresh rates.
    const stepX = targetX * seconds + (this.velocityX - targetX) * blend / response;
    const stepY = targetY * seconds + (this.velocityY - targetY) * blend / response;
    this.velocityX += (targetX - this.velocityX) * blend;
    this.velocityY += (targetY - this.velocityY) * blend;
    this.moveBy(stepX, stepY, canMove);
    if (stepX && this.x === x) this.velocityX = 0;
    if (stepY && this.y === y) this.velocityY = 0;
    if (this.currentSpeed > 4) {
      const turn = Math.atan2(this.velocityY, this.velocityX) - this.heading;
      this.heading += Math.atan2(Math.sin(turn), Math.cos(turn)) * -Math.expm1(-10 * seconds);
    }
  }

  stop() {
    this.velocityX = 0;
    this.velocityY = 0;
    this.moving = false;
  }
}

class Game {
  constructor(saved, persist = () => {}) {
    this.world = new World();
    this.tide = new Tide();
    this.expedition = new Expedition(this.world);
    this.harbor = new HarborProgress(saved);
    this.persist = persist;
    this.route = Math.min(this.harbor.tier, DISTRICTS.length - 1);
    this.expedition.district = this.nextDistrict;
    if (this.route) this.world.setDistrict(this.nextDistrict.map);
    this.boat = new Boat(411, 348);
    this.boat.speed = this.harbor.boatSpeed;
    this.walker = new Actor(0, 0, 6, 81);
    this.mode = 'boat';
    this.cargo = [];
    this.banner = null;
    this.cues = [];
    this.time = 0;
    this.paused = false;
  }

  get nextDistrict() { return DISTRICTS[this.route]; }
  get atDock() { return this.mode === 'boat' && distance(this.boat, this.world.dock) < 52; }
  get full() { return this.cargo.length >= this.harbor.capacity; }
  get threat() {
    if (this.mode !== 'foot') return 'safe';
    if (this.tide.rising || !this.tide.exposed) return 'critical';
    return this.tide.warning ? 'warning' : 'safe';
  }

  get target() {
    if (this.mode === 'foot') {
      if (this.full || this.threat === 'critical') return { point: this.boat, label: 'Tekne', kind: 'home' };
      const site = this.expedition.nearest(this.walker);
      return site ? { point: site, label: 'Kasa', kind: 'vault' } : { point: this.boat, label: 'Tekne', kind: 'home' };
    }
    if (this.cargo.length || this.harbor.ready) return { point: this.world.dock, label: 'Liman', kind: 'home' };
    if (!this.atDock || this.tide.exposed) return { point: { x: 546, y: 316 }, label: 'Batık kıyı', kind: 'vault' };
    return null;
  }

  get objective() {
    if (this.mode === 'foot') {
      if (this.threat === 'critical') return 'Yüksek rotadan tekneye dön';
      if (this.full) return 'Yük dolu · Tekneye dön';
      return this.expedition.nearest(this.walker) ? 'Bir kasa bul' : 'Kasalar açıldı · Tekneye dön';
    }
    if (this.cargo.length) return 'Limanın ışığını izle';
    if (this.harbor.ready) return this.atDock ? 'Yükseltme hazır' : 'Limanın ışığını izle';
    return this.tide.exposed ? 'Kıyıya yanaş' : 'Çekilmeyi bekle';
  }

  get interaction() {
    if (this.mode === 'foot') {
      if (distance(this.walker, this.boat) < 48 && this.world.hasClearLanding(this.boat, this.walker)) {
        return { type: 'board', label: 'Tekneye bin' };
      }
      if (this.expedition.opening) return null;
      const tile = this.world.district.tileAt(this.walker.x, this.walker.y);
      const site = this.tide.exposed && this.world.wetness(tile, this.tide.water) < 0.4
        && !this.full && this.expedition.nearest(this.walker, 35);
      return site ? { type: 'open', label: `${site.label} · ${site.seconds} sn`, site } : null;
    }
    if (this.atDock && this.cargo.length) return { type: 'archive', label: 'Buluntuları indir' };
    const landing = this.tide.exposed && !this.tide.rising && this.world.landingNear(this.boat);
    return landing ? { type: 'land', label: 'Karaya çık', landing } : null;
  }

  update(seconds, dx, dy) {
    if (this.paused) return;
    this.time += seconds;
    this.tide.advance(seconds, index => this.onPhaseChange(index));
    const actor = this.mode === 'boat' ? this.boat : this.walker;
    const onFoot = this.mode === 'foot';
    const start = onFoot && this.world.district.tileAt(actor.x, actor.y);
    const movementTime = onFoot ? seconds * this.world.walkingFactor(start, this.tide.water) : seconds;
    actor.move(dx, dy, movementTime, (x, y) => this.world.canOccupy(x, y, actor.radius, this.mode, this.tide.exposed));
    if (onFoot) {
      const end = this.world.district.tileAt(actor.x, actor.y);
      if (start !== end && this.world.isRaised(end)) actor.hopAt = this.time;
      this.openVault(seconds, dx !== 0 || dy !== 0 || this.world.wetness(end, this.tide.water) >= 0.4);
    }
  }

  openVault(seconds, moving) {
    const { opening } = this.expedition;
    if (!opening) return;
    if (moving) {
      this.expedition.opening = null;
      return;
    }
    opening.elapsed += seconds;
    if (opening.elapsed < opening.site.seconds) return;
    const { site } = opening;
    site.opened = true;
    this.expedition.opening = null;
    if (this.harbor.relics.has(site.item.id) || this.cargo.includes(site.item)) {
      this.announce('KAYITLI ESER', site.item.name, 'find', 2.4);
      return;
    }
    this.cargo.push(site.item);
    this.signal('relic', this.walker);
    this.announce(site.item.kind.toLocaleUpperCase('tr-TR'), site.item.name, 'find', 3);
  }

  onPhaseChange(index) {
    if (index === 2) {
      const district = this.mode === 'foot' ? this.expedition.district : this.nextDistrict;
      this.expedition.begin(district, this.harbor.relics, this.cargo);
      if (this.mode === 'boat' && !this.world.canOccupy(this.boat.x, this.boat.y, this.boat.radius, 'boat', true)) {
        Object.assign(this.boat, this.world.nearestWater(this.boat));
        this.boat.stop();
      }
      this.signal('ebb', this.boat);
      this.announce('GÖZLERİNİ AÇ', 'Sular çekildi', 'ebb', 3.8);
    }
    if (this.tide.rising && this.mode === 'foot') this.announce('KIYIYA DÖN', 'Su yükseliyor', 'danger', 3.3);
    if (index === 0) {
      this.expedition.end();
      if (this.mode === 'foot') {
        const tile = this.world.district.tileAt(this.walker.x, this.walker.y);
        const lost = !this.world.isRaised(tile) && this.cargo.pop();
        this.signal('flood', this.walker);
        this.announce('TAŞKIN', lost ? 'Akıntı bir buluntuyu aldı' : 'Yüksek rotayı izle', 'danger', 4);
      }
    }
  }

  interact() {
    if (this.paused) return;
    const action = this.interaction;
    if (!action) return;
    if (action.type === 'board') {
      this.mode = 'boat';
      this.walker.moving = false;
      this.expedition.opening = null;
      this.world.escape.clear();
    }
    if (action.type === 'land') {
      Object.assign(this.walker, { x: action.landing.x, y: action.landing.y, moving: false, heading: this.boat.heading });
      this.boat.stop();
      this.mode = 'foot';
      this.walker.hopAt = undefined;
      this.world.markEscapeRoute(action.landing);
    }
    if (action.type === 'open') this.expedition.opening = { site: action.site, elapsed: 0 };
    if (action.type === 'archive') this.archive();
  }

  archive() {
    this.boat.stop();
    this.harbor.archive(this.cargo);
    this.cargo = [];
    this.persist(this.harbor);
    this.signal('delivery', this.world.dock);
    this.announce('LİMAN', 'Buluntular güvende', 'find', 2.7);
  }

  upgrade() {
    if (this.paused || !this.atDock) return;
    const goal = this.harbor.upgrade();
    if (!goal) return;
    this.boat.stop();
    this.boat.speed = this.harbor.boatSpeed;
    this.route = Math.min(this.harbor.tier, DISTRICTS.length - 1);
    this.persist(this.harbor);
    this.signal('upgrade', goal);
    this.announce('LİMAN BÜYÜDÜ', goal.title, 'upgrade', 4);
  }

  switchRoute() {
    if (this.paused || !this.atDock) return;
    this.route = (this.route + 1) % (Math.min(this.harbor.tier, DISTRICTS.length - 1) + 1);
  }

  announce(caption, title, kind, duration) {
    this.banner = { caption, title, kind, until: this.time + duration };
  }

  signal(type, { x, y }) { this.cues.push({ type, x, y }); }
}
