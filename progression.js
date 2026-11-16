'use strict';

const HARBOR_GOALS = [
  { title: 'Feneri Güçlendir', relic: RELICS.journal, x: 255, y: 293, sprite: 'lamp', beam: 54 },
  { title: 'Demirciyi Aç', relic: RELICS.cog, x: 177, y: 383, sprite: 'forge', capacity: 4 },
  { title: 'Derin Su Vinci', relic: RELICS.secret, x: 325, y: 333, sprite: 'crane', speed: 230 },
];

class HarborProgress {
  constructor(saved = {}) {
    const ids = Array.isArray(saved.relics) ? saved.relics : [];
    this.relics = new Set(ids.filter(id => typeof id === 'string' && Object.hasOwn(RELICS, id)));
    this.tier = Number.isSafeInteger(saved.tier) ? clamp(saved.tier, 0, HARBOR_GOALS.length) : 0;
  }

  get built() { return HARBOR_GOALS.slice(0, this.tier); }
  get next() { return HARBOR_GOALS[this.tier]; }
  get ready() { return Boolean(this.next && this.relics.has(this.next.relic.id)); }
  get capacity() { return this.built.findLast(goal => goal.capacity)?.capacity ?? 3; }
  get boatSpeed() { return this.built.findLast(goal => goal.speed)?.speed ?? 187; }
  get beam() { return this.built.reduce((radius, goal) => radius + (goal.beam ?? 0), 197); }

  archive(cargo) {
    for (const item of cargo) this.relics.add(item.id);
  }

  upgrade() {
    if (!this.ready) return null;
    return HARBOR_GOALS[this.tier++];
  }

  snapshot() { return { tier: this.tier, relics: [...this.relics] }; }
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
