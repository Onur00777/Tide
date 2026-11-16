'use strict';

const HARBOR_GOALS = [
  { title: 'Feneri Güçlendir', total: 3, relic: RELICS.journal, district: 0,
    reward: 'Daha güçlü fener ve Eski Tersane rotası', sprite: 'lamp', x: 256, y: 295, beam: 54 },
  { title: 'Demirciyi Kurtar', total: 3, relic: RELICS.cog, district: 1,
    reward: 'Sema’nın atölyesi, 6 yük yuvası ve İnci Mahallesi rotası', sprite: 'shed', x: 173, y: 382, capacity: 6 },
  { title: 'İnci Fenerini Yak', total: 9, relic: RELICS.pearl, district: 2,
    reward: 'Güney feneri ve daha hızlı tekne', sprite: 'lamp', x: 152, y: 423, speed: 218 },
  { title: 'Rıhtımı Büyüt', total: 18, district: 2,
    reward: 'Yeni ambar ve 8 yük yuvası', sprite: 'shed', x: 231, y: 404, capacity: 8 },
];

const JOURNAL_ENTRIES = [
  { relic: RELICS.journal, hint: 'Kaptanın Evi, Fener Sokağı.', title: 'Bir ışık yeter',
    text: 'Annemin el yazısı. “Martı üç kez döndüğünde feneri yak. Bir kişi daha yolu bulursa bütün geceye değer.” Son sayfada bir tersane krokisi var. Annem birine dönüş yolunu bırakmış.' },
  { relic: RELICS.cog, hint: 'Demircinin Atölyesi, Eski Tersane.', title: 'Sema’nın dönüşü',
    text: 'Çark demir ızgaranın dişlerine oturunca içeriden iki vuruş geldi. Sema bütün geceyi tezgâhın üzerinde geçirmiş. Limanda ona bir tezgâh kurduk. “Biri benim için feneri yaktı,” diyor.' },
  { relic: RELICS.pearl, hint: 'İnci Tacirinin Kasası, İnci Mahallesi.', title: 'Eve giden yol',
    text: 'Kasadaki inciye fener vurunca limanın öbür ucuna kadar ışık düştü. Sema motoru elden geçirirken ben annemin defterine bir satır ekledim. “Fener yanıyor. Bugün eve iki kişi döndük.”' },
];

class HarborProgress {
  constructor(saved = {}) {
    this.delivered = Number.isSafeInteger(saved.delivered) && saved.delivered >= 0 ? saved.delivered : 0;
    this.bestHaul = Number.isSafeInteger(saved.bestHaul) && saved.bestHaul >= 0 ? saved.bestHaul : 0;
    const ids = Array.isArray(saved.relics) ? saved.relics : [];
    this.relics = new Set(ids.filter(id => Object.hasOwn(RELICS, id)));
  }

  get built() {
    const incomplete = HARBOR_GOALS.findIndex(goal => this.delivered < goal.total || (goal.relic && !this.relics.has(goal.relic.id)));
    return incomplete === -1 ? HARBOR_GOALS : HARBOR_GOALS.slice(0, incomplete);
  }

  get next() { return HARBOR_GOALS[this.built.length]; }
  get level() { return this.built.length + 1; }
  get capacity() { return this.built.reduce((capacity, goal) => goal.capacity ?? capacity, 4); }
  get boatSpeed() { return this.built.reduce((speed, goal) => goal.speed ?? speed, 187); }
  get beam() { return this.built.reduce((radius, goal) => radius + (goal.beam ?? 0), 197); }
  get scrapNeeded() { return Math.max(0, (this.next?.total ?? 0) - this.delivered); }

  accept(cargo) {
    const finished = this.built.length;
    const before = this.delivered;
    for (const item of cargo) {
      if (item.id) this.relics.add(item.id);
      else this.delivered += item.value ?? 1;
    }
    this.bestHaul = Math.max(this.bestHaul, this.delivered - before);
    return this.built.slice(finished);
  }

  snapshot() { return { delivered: this.delivered, bestHaul: this.bestHaul, relics: [...this.relics] }; }
}

class ProgressSave {
  static key = 'gelgit.harbor.v1';

  static load() {
    try {
      const data = JSON.parse(localStorage.getItem(this.key));
      return data && typeof data === 'object' ? data : {};
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
