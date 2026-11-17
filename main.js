'use strict';

const MOVEMENT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

class Keyboard {
  constructor(onInteract, onPause, modal) {
    this.keys = new Set();
    window.addEventListener('keydown', event => {
      if (modal.open || event.ctrlKey || event.altKey || event.metaKey) return;
      if (MOVEMENT.has(event.code)) {
        event.preventDefault();
        this.keys.add(event.code);
      }
      if (event.repeat) return;
      if (event.code === 'KeyE') onInteract();
      if (event.code === 'Escape') onPause();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
  }

  clear() { this.keys.clear(); }
  get dx() { return Number(this.held('KeyD', 'ArrowRight')) - Number(this.held('KeyA', 'ArrowLeft')); }
  get dy() { return Number(this.held('KeyS', 'ArrowDown')) - Number(this.held('KeyW', 'ArrowUp')); }
  held(a, b) { return this.keys.has(a) || this.keys.has(b); }
}

class Hud {
  constructor() {
    const ids = ['game', 'phase', 'mode', 'location', 'objective', 'return-time', 'cargo',
      'banner', 'banner-caption', 'banner-title', 'waypoint', 'waypoint-arrow', 'waypoint-name',
      'action', 'action-label', 'opening', 'opening-label', 'opening-meter', 'harbor', 'harbor-title', 'harbor-requirement',
      'upgrade', 'route', 'pause', 'pause-layer', 'resume', 'sound', 'collection', 'collection-open', 'collection-items'];
    this.ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  }

  text(id, value) {
    const node = this.ui[id];
    if (node.textContent !== value) node.textContent = value;
  }

  draw(game, camera) {
    const { tide, harbor, paused } = game;
    const onFoot = game.mode === 'foot';
    this.ui.game.dataset.tide = tide.rising ? 'rising' : tide.warning ? 'warning' : 'still';
    this.ui.game.style.setProperty('--surge', tide.surge);
    this.text('phase', tide.phase.name);

    this.text('mode', onFoot ? 'Yaya' : 'Teknede');
    this.text('location', game.atDock ? 'Başlangıç Limanı' : game.expedition.district.name);
    this.text('objective', game.objective);
    this.ui['return-time'].hidden = !onFoot;
    if (onFoot) this.text('return-time', '~' + game.returnTime + ' sn · Tekne');
    this.drawCargo(game.cargo, harbor.capacity);

    const action = game.interaction;
    const opening = game.expedition.opening;
    this.ui.action.hidden = paused || !action;
    this.text('action-label', action?.label ?? '');
    this.ui.opening.hidden = !opening || paused;
    if (opening) {
      this.text('opening-label', 'Kasa açılıyor · ' + Math.ceil(opening.site.seconds - opening.elapsed) + ' sn');
      this.ui['opening-meter'].value = opening.elapsed / opening.site.seconds;
    }

    this.ui.harbor.hidden = !game.atDock || paused;
    const goal = harbor.next;
    this.text('harbor-title', goal?.title ?? 'Liman tamamlandı');
    this.text('harbor-requirement', harbor.ready ? 'Geliştirme hazır' : goal?.relic.name ?? '');
    this.ui.upgrade.disabled = !harbor.ready;
    this.ui.upgrade.hidden = !goal;
    this.ui.route.hidden = !harbor.tier;
    this.text('route', 'Rota · ' + game.nextDistrict.name + '  ↻');

    this.ui.pause.setAttribute('aria-pressed', String(paused));
    this.ui['pause-layer'].hidden = !paused || this.ui.collection.open;
    const banner = game.banner;
    this.ui.banner.hidden = paused || !banner || banner.until <= game.time;
    if (!this.ui.banner.hidden) {
      this.ui.banner.dataset.kind = banner.kind;
      this.text('banner-caption', banner.caption);
      this.text('banner-title', banner.title);
    }
    this.drawWaypoint(game.target, camera, paused);
  }

  drawCargo(items, capacity) {
    const key = capacity + ':' + items.map(item => item.id).join(',');
    if (key === this.cargoKey) return;
    this.cargoKey = key;
    const slots = Array.from({ length: capacity }, (_, index) => {
      const slot = document.createElement('span');
      slot.className = 'cargo-slot';
      const item = items[index];
      slot.textContent = item?.icon ?? '·';
      slot.title = item?.name ?? 'Boş yük yuvası';
      if (item) {
        slot.dataset.filled = '';
        slot.style.setProperty('--item-color', item.color);
      }
      return slot;
    });
    this.ui.cargo.replaceChildren(...slots);
  }

  drawWaypoint(target, camera, paused) {
    const waypoint = this.ui.waypoint;
    waypoint.hidden = true;
    if (!target || paused) return;
    const point = camera.project(target.point);
    const pad = 49;
    const top = camera.width <= 590 ? 155 : 102;
    const bottom = Math.max(top, camera.height - 150);
    const x = clamp(point.x, pad, camera.width - pad);
    const y = clamp(point.y, top, bottom);
    if (x === point.x && y === point.y) return;
    waypoint.hidden = false;
    waypoint.style.left = x + 'px';
    waypoint.style.top = y + 'px';
    waypoint.dataset.kind = target.kind;
    const angle = Math.atan2(point.y - y, point.x - x) * 180 / Math.PI + 45;
    this.ui['waypoint-arrow'].style.setProperty('--bearing', angle + 'deg');
    this.text('waypoint-name', target.label);
  }

  drawCollection(harbor) {
    const cards = Object.values(RELICS).map(item => {
      const visible = harbor.relics.has(item.id);
      const card = document.createElement('article');
      const symbol = document.createElement('span');
      const title = document.createElement('strong');
      card.className = 'relic';
      if (visible) card.style.setProperty('--item-color', item.color);
      symbol.textContent = visible ? item.icon : '◇';
      title.textContent = visible ? item.name : 'Keşfedilmedi';
      card.append(symbol, title);
      return card;
    });
    this.ui['collection-items'].replaceChildren(...cards);
  }
}

const game = new Game(ProgressSave.load(), harbor => ProgressSave.write(harbor));
const canvas = document.getElementById('sea');
const renderer = new Renderer(canvas, game.world);
const camera = new Camera(canvas, game.boat);
const feedback = new Feedback();
const hud = new Hud();
const collection = hud.ui.collection;

function togglePause() {
  if (collection.open) return;
  game.paused = !game.paused;
  keyboard.clear();
}

const keyboard = new Keyboard(() => game.interact(), togglePause, collection);
hud.ui.pause.addEventListener('click', togglePause);
hud.ui.resume.addEventListener('click', togglePause);
hud.ui.action.addEventListener('click', () => game.interact());
hud.ui.upgrade.addEventListener('click', () => game.upgrade());
hud.ui.route.addEventListener('click', () => game.switchRoute());

window.addEventListener('pointerdown', () => feedback.audio.unlock());
window.addEventListener('keydown', () => feedback.audio.unlock());
hud.ui.sound.addEventListener('click', () => {
  feedback.audio.toggle();
  hud.ui.sound.setAttribute('aria-pressed', String(feedback.audio.enabled));
});

let pausedBeforeCollection = false;
hud.ui['collection-open'].addEventListener('click', () => {
  pausedBeforeCollection = game.paused;
  game.paused = true;
  keyboard.clear();
  hud.drawCollection(game.harbor);
  collection.showModal();
});
collection.addEventListener('close', () => {
  game.paused = pausedBeforeCollection;
  keyboard.clear();
});

let previousFrame;
function frame(now) {
  const seconds = previousFrame === undefined ? 0 : Math.min((now - previousFrame) / 1000, 1 / 30);
  previousFrame = now;
  game.update(seconds, keyboard.dx, keyboard.dy);
  feedback.update(game);
  camera.follow(game, seconds);
  camera.apply(renderer.ctx);
  renderer.draw(game);
  feedback.draw(renderer.ctx, game.time);
  hud.draw(game, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
