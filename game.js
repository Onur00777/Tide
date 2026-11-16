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
  constructor(saved, onDelivery = () => {}) {
    this.world = new World();
    this.tide = new Tide();
    this.harbor = new HarborProgress(saved);
    this.expedition = new Expedition(this.world);
    this.expedition.district = this.nextDistrict;
    if (this.nextDistrict !== DISTRICTS[0]) this.world.setDistrict(this.nextDistrict.map);
    this.onDelivery = onDelivery;
    this.boat = new Boat(411, 348);
    this.boat.speed = this.harbor.boatSpeed;
    this.walker = new Actor(0, 0, 6, 106);
    this.mode = 'boat';
    this.cargo = [];
    this.notice = null;
    this.time = 0;
    this.paused = false;
  }

  get nextDistrict() {
    const next = this.harbor.next;
    return next ? DISTRICTS[next.district] : DISTRICTS[this.expedition.number % DISTRICTS.length];
  }

  get returnTime() {
    if (this.mode !== 'foot') return 0;
    const remaining = this.returnDistance(this.walker);
    return Math.ceil(remaining / (this.walker.speed * 0.72)) + 1;
  }

  get threat() {
    if (this.mode !== 'foot') return 'safe';
    if (this.tide.index === 3 || this.tide.untilFlood <= this.returnTime + 1) return 'critical';
    return this.tide.untilFlood <= this.returnTime + 5 ? 'warning' : 'safe';
  }

  update(seconds, dx, dy) {
    if (this.paused) return;
    this.time += seconds;
    this.tide.advance(seconds, index => this.onPhaseChange(index));

    const actor = this.mode === 'boat' ? this.boat : this.walker;
    const movementTime = this.mode === 'foot' ? seconds * (1 - this.tide.water * 0.28) : seconds;
    actor.move(dx, dy, movementTime, (x, y) => this.world.canOccupy(x, y, actor.radius, this.mode, this.tide.exposed));
    if (this.mode === 'foot') this.explore(seconds, dx || dy);
  }

  explore(seconds, moving) {
    const trip = this.expedition;
    if (trip.opening) {
      if (moving) trip.opening = null;
      else {
        trip.opening.elapsed += seconds;
        if (trip.opening.elapsed >= trip.opening.duration) this.recoverRelic();
      }
    }
    if (trip.key && distance(trip.key, this.walker) < 15) {
      trip.key = null;
      trip.hasKey = true;
      this.notify(`Anahtar bulundu. ${trip.district.house} açılabilir.`);
    }
    if (this.cargo.length >= this.harbor.capacity) return;
    const index = trip.loot.findIndex(piece => distance(piece, this.walker) < 15);
    if (index >= 0) this.cargo.push(trip.loot.splice(index, 1)[0]);
  }

  recoverRelic() {
    const trip = this.expedition;
    const relic = trip.district.relic;
    if (this.cargo.length === this.harbor.capacity) {
      const scrap = this.cargo.findIndex(item => !item.id);
      if (scrap === -1) {
        trip.opening = null;
        this.notify('Yük dolu. Önce limana dön.');
        return;
      }
      const [dropped] = this.cargo.splice(scrap, 1);
      trip.loot.push({ ...dropped, x: this.walker.x, y: this.walker.y });
    }
    this.cargo.push(relic);
    trip.house = null;
    trip.opening = null;
    trip.hasKey = false;
    this.notify(relic.id === 'cog' ? 'Sema serbest! Çarkı al ve onu limana götür.' : `${relic.name} yükte. İskeleye ulaştır!`, 4);
  }

  onPhaseChange(index) {
    if (index === 1) this.notify(`Su çekiliyor. Sıradaki rota ${this.nextDistrict.name}.`);
    if (index === 2) {
      const district = this.nextDistrict;
      this.expedition.begin(district, this.harbor.relics.has(district.relic.id) || this.cargo.includes(district.relic));
      const grounded = !this.world.canOccupy(this.boat.x, this.boat.y, this.boat.radius, 'boat', true);
      if (grounded) {
        Object.assign(this.boat, this.world.nearestWater(this.boat));
        this.boat.stop();
      }
      this.notify(grounded ? 'Mahalle açıldı. Teknen kıyıdaki derin suya alındı.' : `${district.name} açıldı. Kıyıda E ile tekneden in.`);
    }
    if (index === 3) this.notify(this.mode === 'foot' ? 'Su yükseliyor! Hemen tekneye dön.' : 'Su yükseliyor.', 8);
    if (index === 0) {
      this.expedition.end();
      if (this.mode === 'foot') {
        const lost = this.cargo.length;
        this.cargo = [];
        this.board();
        this.notify(lost ? `Suya kapıldın. Tekneye döndün, ${lost} parçayı kaybettin.` : 'Suya kapıldın. Tekneye döndün.', 6);
      } else {
        this.notify('Mahalle yeniden su altında.');
      }
    }
  }

  get interaction() {
    if (this.mode === 'foot') {
      const trip = this.expedition;
      if (trip.opening) return null;
      if (trip.house && distance(trip.house, this.walker) < 33) {
        if (!trip.hasKey) return { type: 'locked', label: 'Kilitli evi incele' };
        const label = this.cargo.length === this.harbor.capacity ? 'Hurda bırakıp kilidi aç' : 'Kilitli evi aç';
        return { type: 'unlock', label };
      }
      const nearBoat = distance(this.walker, this.boat) < 48 && this.world.hasClearLanding(this.boat, this.walker);
      return nearBoat ? { type: 'board', label: 'Tekneye bin' } : null;
    }
    if (distance(this.boat, this.world.dock) < 46 && this.cargo.length) {
      return { type: 'deliver', label: `${this.cargo.length} parça teslim et` };
    }
    const landing = this.tide.exposed && this.world.landingNear(this.boat);
    return landing ? { type: 'land', label: 'Demir at ve in', landing } : null;
  }

  get objective() {
    if (this.mode === 'foot') {
      if (this.threat === 'critical') return 'Dönüş riskli. Hemen tekneye dön!';
      if (this.expedition.opening) return 'Kilit açılıyor. Harekete geçersen işlem kesilir.';
      if (this.expedition.hasKey) return `${this.expedition.district.house} için kehribar işaretini izle.`;
      if (this.cargo.length >= this.harbor.capacity) return 'Yük doldu. Limana dön veya nadir buluntu için hurda bırak.';
      return this.expedition.key ? 'Sokaklarda hurda ve mavi parlayan anahtarı ara.' : 'Buluntularını demir attığın tekneye götür.';
    }
    if (this.cargo.length) return 'Başlangıç İskelesi’nin ucunda E ile yükü teslim et.';
    return this.tide.exposed ? 'Mahalle kıyısında E ile demir at.' : `Sıradaki rota ${this.nextDistrict.name}. Sokaklar düşük suda açılır.`;
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
      this.boat.stop();
      this.mode = 'foot';
      this.returnDistance = this.world.returnDistances(action.landing);
    }
    if (action.type === 'locked') this.notify('Kilitli. Mavi parlayan anahtarı sokaklarda ara.');
    if (action.type === 'unlock') this.expedition.opening = { elapsed: 0, duration: 2.6 };
    if (action.type === 'deliver') this.deliver();
  }

  board() {
    this.mode = 'boat';
    this.walker.moving = false;
    this.expedition.opening = null;
  }

  deliver() {
    this.boat.stop();
    const total = this.cargo.length;
    const valuables = this.cargo.some(item => item.id);
    const lastUnlock = this.harbor.accept(this.cargo).at(-1);
    this.cargo = [];
    this.boat.speed = this.harbor.boatSpeed;
    this.onDelivery(this.harbor);
    if (lastUnlock) this.notify(`Liman gelişti. ${lastUnlock.reward}.`, 7);
    else this.notify(valuables ? 'Buluntu teslim edildi. Günlüğe yeni bir sayfa eklendi.' : `${total} hurda teslim edildi.`, 5);
  }

  notify(message, duration = 4) {
    this.notice = { message, until: this.time + duration };
  }
}
