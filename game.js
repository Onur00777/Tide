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

class Game {
  constructor(saved, persist = () => {}) {
    this.world = new World();
    this.tide = new Tide();
    this.weather = new WeatherSystem();
    this.expedition = new Expedition(this.world);
    this.rescue = new CrewRescue();
    this.harbor = new HarborProgress(saved);
    this.world.setHarborExpanded(this.harbor.projects.has('shipwright'));
    this.persist = persist;
    this.loadRoute();
    this.boat = new Boat(411, 348, this.harbor.hull);
    this.configureBoat();
    this.walker = new Actor(0, 0, 6, 81);
    this.mode = 'boat';
    this.cargo = [];
    this.banner = null;
    this.cues = [];
    this.time = 0;
    this.paused = false;
  }

  configureBoat() {
    this.boat.speed = this.harbor.boatSpeed;
    this.boat.engine = Number(this.harbor.fittings.has('engine'));
    this.boat.armor = this.harbor.fittings.has('armor');
  }

  get deepTarget() {
    const site = this.expedition.deepSite;
    return this.harbor.fittings.has('crane') && this.tide.water >= 0.55 && !site?.opened ? site : null;
  }

  loadRoute() {
    const district = this.nextDistrict;
    if (district === this.expedition.district && this.expedition.deepSite) return;
    const recovered = this.expedition.deepSite?.opened;
    if (district !== this.expedition.district) this.world.setDistrict(district.map);
    this.expedition.district = district;
    this.expedition.rollDeepSite();
    // A new district during the same tide must not replenish a collected deep crate.
    if (recovered && this.expedition.deepSite) this.expedition.deepSite.opened = true;
  }

  get nextDistrict() { return DISTRICTS[this.harbor.route]; }
  get atDock() { return this.mode === 'boat' && distance(this.boat, this.world.dock) < 52; }
  get landing() { return this.mode === 'boat' && this.tide.exposed && !this.tide.rising ? this.world.landingNear(this.boat) : null; }
  get canDisembark() { return this.boat.currentSpeed <= 42; }
  get full() { return this.cargo.length >= this.harbor.capacity; }
  get threat() {
    if (this.mode !== 'foot') return 'safe';
    if (this.tide.rising || !this.tide.exposed) return 'critical';
    return this.tide.warning ? 'warning' : 'safe';
  }

  get requiredFind() {
    const relic = this.harbor.next?.relic;
    if (!relic || this.harbor.ready || this.cargo.includes(relic)) return null;
    return this.expedition.sites.find(site => !site.opened && site.item === relic) ?? null;
  }

  get target() {
    if (this.mode === 'foot') {
      if (this.rescue.carrying || this.full || this.threat === 'critical') return { point: this.boat, label: 'Tekne', kind: 'home' };
      const survivor = this.rescue.stranded;
      if (survivor && distance(this.walker, survivor) < 112) {
        return { point: survivor, label: survivor.member.name, kind: 'crew' };
      }
      const required = this.requiredFind;
      if (required) return { point: required, label: 'Liman buluntusu', kind: 'required' };
      const site = this.expedition.nearest(this.walker);
      return site ? { point: site, label: 'Kasa', kind: 'vault' } : { point: this.boat, label: 'Tekne', kind: 'home' };
    }
    if (this.rescue.passenger || this.cargo.length || this.harbor.ready) return { point: this.world.dock, label: 'Liman', kind: 'home' };
    if (this.deepTarget && !this.full) return { point: this.deepTarget, label: 'Batık ağır kasa', kind: 'vault' };
    if ((!this.atDock || this.tide.exposed) && this.world.shoreTarget) {
      return { point: this.world.shoreTarget, label: 'Batık kıyı', kind: 'shore' };
    }
    return null;
  }

  get objective() {
    if (this.mode === 'foot') {
      if (this.rescue.carrying) return `${this.rescue.carrying.name} ile tekneye dön`;
      if (this.threat === 'critical') return 'Yüksek rotadan tekneye dön';
      if (this.rescue.stranded && distance(this.walker, this.rescue.stranded) < 112) return 'Yardım ışığına yaklaş';
      if (this.full) return 'Yük dolu · Tekneye dön';
      if (this.requiredFind) return this.requiredFind.item.name + ' izini sür';
      return this.expedition.nearest(this.walker) ? 'Bir kasa bul' : 'Kasalar açıldı · Tekneye dön';
    }
    if (this.rescue.passenger) return `${this.rescue.passenger.name} ile limana dön`;
    if (this.cargo.length) return 'Limanın ışığını izle';
    if (this.harbor.ready) return this.atDock ? 'Yükseltme hazır' : 'Limanın ışığını izle';
    if (this.deepTarget && !this.full) return 'Vinçle ağır kasayı çıkar';
    if (this.landing) return this.canDisembark ? 'Karaya çık' : 'Yanaşmak için yavaşla';
    return this.tide.exposed && !this.tide.rising ? 'Kıyıya yanaş' : 'Çekilmeyi bekle';
  }

  get interaction() {
    if (this.mode === 'foot') {
      if (distance(this.walker, this.boat) < 48 && this.world.hasClearLanding(this.boat, this.walker)) {
        return { type: 'board', label: 'Tekneye bin' };
      }
      if (this.expedition.opening) return null;
      const survivor = this.rescue.stranded;
      if (survivor && distance(this.walker, survivor) < 20) {
        return { type: 'rescue', label: `${survivor.member.name} · Sırtla` };
      }
      const tile = this.world.district.tileAt(this.walker.x, this.walker.y);
      const site = this.tide.exposed && this.world.wetness(tile, this.tide.water) < 0.4
        && !this.rescue.carrying && !this.full && this.expedition.nearest(this.walker, 35);
      return site ? { type: 'open', label: `${site.label} · ${site.seconds} sn`, site } : null;
    }
    if (this.atDock && this.cargo.length) return { type: 'archive', label: 'Buluntuları indir' };
    const deep = this.deepTarget;
    if (this.expedition.hoist) return null;
    if (!this.full && deep && distance(this.boat, deep) < 46 && this.boat.currentSpeed < 24) {
      return { type: 'hoist', label: 'Ağır kasayı vinçle çek' };
    }
    const landing = this.canDisembark && this.landing;
    return landing ? { type: 'land', label: 'Karaya çık', landing } : null;
  }

  update(seconds, dx, dy, braking = false) {
    if (this.paused) return;
    this.time += seconds;
    this.weather.update(seconds, this);
    this.tide.advance(seconds, index => this.onPhaseChange(index));
    const actor = this.mode === 'boat' ? this.boat : this.walker;
    const onFoot = this.mode === 'foot';
    const start = onFoot && this.world.district.tileAt(actor.x, actor.y);
    const canMove = (x, y) => this.world.canOccupy(x, y, actor.radius, this.mode, this.tide.exposed);
    if (onFoot) {
      actor.move(dx, dy, seconds * this.world.walkingFactor(start, this.tide.water), canMove);
    } else {
      const weight = this.cargo.reduce((total, item) => total + (item.weight ?? 1), 0);
      this.boat.load = clamp((weight + (this.rescue.passenger ? 0.55 : 0)) / this.harbor.capacity, 0, 1);
      this.hoistCrate(seconds, !braking && Boolean(dx || dy));
      const current = this.expedition.hoist ? { x: 0, y: 0 } : this.world.currentAt(this.boat, this.tide);
      const wind = this.weather.current(this.time);
      current.x += wind.x; current.y += wind.y;
      this.boat.move(dx, dy, seconds, current, canMove, damage => this.onImpact(damage), braking);
    }
    if (onFoot) {
      const end = this.world.district.tileAt(actor.x, actor.y);
      if (start !== end && this.world.isRaised(end)) actor.hopAt = this.time;
      this.openVault(seconds, dx !== 0 || dy !== 0 || this.world.wetness(end, this.tide.water) >= 0.4);
    } else if (this.atDock && this.rescue.passenger) {
      const member = this.rescue.passenger;
      this.rescue.passenger = null;
      this.harbor.crew.add(member.id);
      this.persist(this.harbor);
      this.signal('delivery', this.world.dock);
      this.announce('MÜRETTEBAT GÜVENDE', `${member.name} limana yerleşti`, 'find', 4);
    }
  }

  hoistCrate(seconds, steering) {
    const lift = this.expedition.hoist;
    if (!lift) return;
    if (steering || lift.site !== this.deepTarget || this.full || distance(this.boat, lift.site) >= 46) {
      this.expedition.hoist = null;
      return;
    }
    lift.elapsed += seconds;
    if (lift.elapsed < lift.site.seconds) return;
    this.expedition.hoist = null;
    lift.site.opened = true;
    this.cargo.push(DEEP_CRATE);
    this.signal('relic', this.boat);
    this.announce('VİNÇ', DEEP_CRATE.name, 'find', 3);
  }

  onImpact(damage) {
    this.harbor.hull = this.boat.hull;
    this.persist(this.harbor);
    this.signal('impact', this.boat);
    this.announce('GÖVDE HASARI', '−' + damage + ' · Tekne su alıyor', 'danger', 2.5);
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
    this.collect(site.item, this.walker);
  }

  collect(item, point) {
    const known = this.harbor.relics.has(item.id) || this.cargo.includes(item);
    this.cargo.push(known ? SCRAP_CRATE : item);
    this.signal('relic', point);
    this.announce(known ? 'HURDA' : item.kind.toLocaleUpperCase('tr-TR'), known ? SCRAP_CRATE.name : item.name, 'find', 3);
  }

  onPhaseChange(index) {
    if (index === 2) {
      const district = this.mode === 'foot' ? this.expedition.district : this.nextDistrict;
      this.expedition.begin(district, this.harbor.relics, this.cargo);
      this.rescue.begin(this.world, this.harbor.crew, this.expedition.sites);
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
      this.rescue.stranded = null;
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
      this.rescue.board();
      this.mode = 'boat';
      this.walker.moving = false;
      this.expedition.opening = null;
      this.world.escape.clear();
    }
    if (action.type === 'rescue') {
      this.rescue.take();
      this.signal('rescue', this.walker);
      this.announce('YARDIM ULAŞTI', 'Tekneye dön', 'find', 2.5);
    }
    if (action.type === 'land') {
      Object.assign(this.walker, { x: action.landing.x, y: action.landing.y, moving: false, heading: this.boat.heading });
      this.boat.stop();
      this.mode = 'foot';
      this.walker.hopAt = undefined;
      this.world.markEscapeRoute(action.landing);
    }
    if (action.type === 'open') this.expedition.opening = { site: action.site, elapsed: 0 };
    if (action.type === 'hoist') {
      this.boat.stop();
      this.expedition.hoist = { site: this.deepTarget, elapsed: 0 };
    }
    if (action.type === 'archive') this.archive();
  }

  get onboardScrap() { return this.cargo.reduce((sum, item) => sum + (item.scrap ?? 0), 0); }
  get repairCost() { return this.atDock ? 0 : SCRAP_CRATE.scrap; }
  get canRepair() {
    return !this.paused && this.mode === 'boat' && this.boat.hull < 100
      && (this.harbor.scrap + this.onboardScrap >= this.repairCost);
  }

  repair() {
    if (!this.canRepair) return;
    const cost = this.repairCost;
    if (!cost) {
      this.boat.stop();
    } else {
      let remaining = cost;
      this.cargo = this.cargo.flatMap(item => {
        if (!item.scrap || !remaining) return [item];
        const used = Math.min(remaining, item.scrap);
        remaining -= used;
        return item.scrap > used ? [{ ...item, scrap: item.scrap - used }] : [];
      });
      this.harbor.scrap -= remaining;
    }
    this.boat.hull = cost ? Math.min(100, this.boat.hull + 34) : 100;
    this.boat.flood = 0;
    this.harbor.hull = this.boat.hull;
    this.persist(this.harbor);
    this.signal('delivery', this.boat);
    this.announce('TAMİR', cost ? 'Gövde yamalandı' : 'Gövde tamamen onarıldı', 'find', 2.8);
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
    this.configureBoat();
    this.harbor.route = this.harbor.maxRoute;
    if (!this.tide.exposed) this.loadRoute();
    this.persist(this.harbor);
    this.signal('upgrade', goal);
    this.announce('LİMAN BÜYÜDÜ', goal.title, 'upgrade', 4);
  }

  buildCrewProject(id) {
    if (this.paused || !this.atDock) return;
    const project = this.harbor.buildProject(id);
    if (!project) return;
    this.boat.stop();
    this.configureBoat();
    this.world.setHarborExpanded(this.harbor.projects.has('shipwright'));
    if (!this.world.canOccupy(this.boat.x, this.boat.y, this.boat.radius, 'boat', this.tide.exposed)) {
      Object.assign(this.boat, this.world.dock);
    }
    this.persist(this.harbor);
    this.signal('upgrade', project);
    this.announce('LİMAN BÜYÜDÜ', project.title, 'upgrade', 4);
  }

  fitBoat(id) {
    if (this.paused || !this.atDock) return;
    const upgrade = this.harbor.fit(id);
    if (!upgrade) return;
    this.boat.stop();
    this.persist(this.harbor);
    this.configureBoat();
    this.signal('upgrade', this.boat);
    this.announce('TEKNE GÜÇLENDİ', upgrade.name, 'upgrade', 3);
  }

  switchRoute() {
    if (this.paused || !this.atDock || !this.harbor.maxRoute) return;
    this.harbor.route = (this.harbor.route + 1) % (this.harbor.maxRoute + 1);
    if (!this.tide.exposed) this.loadRoute();
    this.persist(this.harbor);
  }

  announce(caption, title, kind, duration) {
    this.banner = { caption, title, kind, until: this.time + duration };
  }

  signal(type, { x, y }) { this.cues.push({ type, x, y }); }
}
