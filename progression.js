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

class HarborProgress {
  constructor(saved = {}) {
    const ids = Array.isArray(saved.relics) ? saved.relics : [];
    this.relics = new Set(ids.filter(id => typeof id === 'string' && Object.hasOwn(RELICS, id)));
    this.tier = Number.isSafeInteger(saved.tier) ? clamp(saved.tier, 0, HARBOR_GOALS.length) : 0;
    const crew = Array.isArray(saved.crew) ? saved.crew : [];
    this.crew = new Set(crew.filter(id => typeof id === 'string' && Object.hasOwn(CREW, id)));
    const projects = Array.isArray(saved.projects) ? saved.projects : [];
    this.projects = new Set(projects.filter(id => this.crew.has(id)));
  }

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
  get boatSpeed() { return (this.built.findLast(goal => goal.speed)?.speed ?? 187) + (this.projects.has('shipwright') ? 18 : 0); }
  get beam() { return this.built.reduce((radius, goal) => radius + (goal.beam ?? 0), this.projects.has('diver') ? 226 : 197); }

  archive(cargo) {
    for (const item of cargo) this.relics.add(item.id);
  }

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
    return { tier: this.tier, relics: [...this.relics], crew: [...this.crew], projects: [...this.projects] };
  }
}

class ProgressSave {
  static key = 'gelgit.harbor.v2';

  static load() {
    try {
      const current = JSON.parse(localStorage.getItem(this.key));
      if (current && typeof current === 'object') return current;
      const legacy = JSON.parse(localStorage.getItem('gelgit.harbor.v1'));
      // Keep collected artifacts. Obsolete scrap totals did not buy the new structures.
      return { relics: legacy?.relics };
    } catch {
      return {};
    }
  }

  static write(harbor) {
    try {
      localStorage.setItem(this.key, JSON.stringify(harbor.snapshot()));
    } catch {
      // Gameplay can continue when the browser denies local storage.
    }
  }
}
