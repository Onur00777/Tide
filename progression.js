'use strict';

const HARBOR_GOALS = [
  { title: 'Feneri Güçlendir', relic: RELICS.journal, x: 255, y: 293, sprite: 'lamp', beam: 54 },
  { title: 'Demirciyi Aç', relic: RELICS.cog, x: 177, y: 383, sprite: 'forge', capacity: 4 },
  { title: 'Derin Su Vinci', relic: RELICS.secret, x: 325, y: 333, sprite: 'crane', speed: 230 },
];

const CREW_PROJECTS = {
  smith: { title: 'Demirci Ocağı', detail: '+1 yük yuvası', x: 177, y: 383, sprite: 'forge' },
  diver: { title: 'Fenerci Ağı', detail: 'Daha geniş fener ışığı ve kıyıda ağlar', x: 255, y: 293, sprite: 'lamp' },
  shipwright: { title: 'Tersane İskelesi', detail: 'Yeni iskele, vinç ve daha hızlı tekne', x: 324, y: 308, sprite: 'crane' },
};

const BOAT_UPGRADES = {
  lantern: { crew: 'smith', name: 'Pruva Feneri', cost: 3 },
  lens: { crew: 'smith', name: 'Uzak Menzil Merceği', cost: 4, requires: 'lantern' },
  engine: { crew: 'smith', name: 'Motor Güçlendirmesi', cost: 5 },
  armor: { crew: 'smith', name: 'Gövde Zırhı', cost: 5 },
  crane: { crew: 'shipwright', name: 'Tekne Vinci', cost: 6 },
};

class HarborProgress {
  constructor(saved = {}) {
    const ids = Array.isArray(saved.relics) ? saved.relics : [];
    this.relics = new Set(ids.filter(id => typeof id === 'string' && Object.hasOwn(RELICS, id)));
    this.tier = Number.isSafeInteger(saved.tier) ? clamp(saved.tier, 0, HARBOR_GOALS.length) : 0;
    this.route = Number.isInteger(saved.route) ? clamp(saved.route, 0, this.maxRoute) : this.maxRoute;
    const crew = Array.isArray(saved.crew) ? saved.crew : [];
    this.crew = new Set(crew.filter(id => typeof id === 'string' && Object.hasOwn(CREW, id)));
    const projects = Array.isArray(saved.projects) ? saved.projects : [];
    this.projects = new Set(projects.filter(id => this.crew.has(id)));
    this.scrap = Number.isSafeInteger(saved.scrap) ? clamp(saved.scrap, 0, 9999) : 0;
    const fittings = Array.isArray(saved.fittings) ? saved.fittings : [];
    this.fittings = new Set(Object.keys(BOAT_UPGRADES).filter(id =>
      fittings.includes(id) && this.crew.has(BOAT_UPGRADES[id].crew)
      && (!BOAT_UPGRADES[id].requires || fittings.includes(BOAT_UPGRADES[id].requires))));
    this.hull = Number.isFinite(saved.hull) ? clamp(Math.round(saved.hull), 0, 100) : 100;
  }

  get maxRoute() { return Math.min(this.tier, DISTRICTS.length - 1); }
  get built() { return HARBOR_GOALS.slice(0, this.tier); }
  get structures() {
    const bySprite = new Map(this.built.map(goal => [goal.sprite, goal]));
    for (const id of this.projects) {
      const project = CREW_PROJECTS[id];
      bySprite.set(project.sprite, project);
    }
    return [...bySprite.values()];
  }
  get next() { return HARBOR_GOALS[this.tier]; }
  get ready() { return Boolean(this.next && this.relics.has(this.next.relic.id)); }
  get capacity() { return (this.built.findLast(goal => goal.capacity)?.capacity ?? 3) + Number(this.projects.has('smith')); }
  get boatSpeed() { return (this.built.findLast(goal => goal.speed)?.speed ?? 187) + (this.projects.has('shipwright') ? 18 : 0) + (this.fittings.has('engine') ? 32 : 0); }
  get beam() { return this.built.reduce((radius, goal) => radius + (goal.beam ?? 0), this.projects.has('diver') ? 226 : 197); }

  archive(cargo) {
    for (const item of cargo) {
      this.addScrap(item.scrap ?? 1);
      if (!item.scrap) this.relics.add(item.id);
    }
  }

  get lanternRange() { return this.fittings.has('lens') ? 235 : this.fittings.has('lantern') ? 138 : 0; }

  canFit(id) {
    const upgrade = Object.hasOwn(BOAT_UPGRADES, id) && BOAT_UPGRADES[id];
    return Boolean(upgrade && this.crew.has(upgrade.crew) && !this.fittings.has(id)
      && (!upgrade.requires || this.fittings.has(upgrade.requires)) && this.scrap >= upgrade.cost);
  }

  fit(id) {
    if (!this.canFit(id)) return null;
    const upgrade = BOAT_UPGRADES[id];
    this.scrap -= upgrade.cost;
    this.fittings.add(id);
    return upgrade;
  }

  addScrap(amount) { this.scrap = Math.min(9999, this.scrap + amount); }

  upgrade() {
    if (!this.ready) return null;
    return HARBOR_GOALS[this.tier++];
  }

  buildProject(id) {
    if (!this.crew.has(id) || this.projects.has(id)) return null;
    this.projects.add(id);
    return CREW_PROJECTS[id];
  }

  snapshot() {
    return { tier: this.tier, route: this.route, relics: [...this.relics], crew: [...this.crew], projects: [...this.projects], hull: this.hull, scrap: this.scrap, fittings: [...this.fittings] };
  }
}

class ProgressSave {
  static key = 'gelgit.harbor.v2';

  static read(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  static load() {
    const current = this.read(this.key);
    if (current) return current;
    // Old scrap totals did not represent the current harbor economy.
    return { relics: this.read('gelgit.harbor.v1')?.relics };
  }

  static write(harbor) {
    try {
      localStorage.setItem(this.key, JSON.stringify(harbor.snapshot()));
    } catch {
      // Gameplay can continue when the browser denies local storage.
    }
  }
}
