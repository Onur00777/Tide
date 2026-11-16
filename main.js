'use strict';

class Keyboard {
  constructor(onInteract, onPause) {
    this.keys = new Set();
    const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
    window.addEventListener('keydown', event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (movement.has(event.code)) {
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
    const ids = ['phase', 'timer', 'next-phase', 'tide-meter', 'tide-fill', 'tide-needle', 'notice', 'mode',
      'objective', 'action', 'action-label', 'cargo', 'bank', 'level', 'upgrade', 'district', 'pause', 'pause-layer'];
    this.ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  }

  setText(id, text) {
    const node = this.ui[id];
    if (node.textContent !== text) node.textContent = text;
  }

  draw(game) {
    const { tide, harbor, notice, paused } = game;
    const onFoot = game.mode === 'foot';
    const seconds = Math.ceil(onFoot ? tide.untilFlood : tide.remaining);
    const phase = tide.phase;
    this.setText('phase', phase.name);
    this.setText('timer', `0:${String(seconds).padStart(2, '0')}`);
    this.setText('next-phase', onFoot ? 'TAŞKINA' : phase.next);
    this.setText('district', game.expedition.district.name);
    const progress = `${tide.progress * 100}%`;
    this.ui['tide-fill'].style.width = progress;
    this.ui['tide-needle'].style.left = progress;
    const elapsed = String(Math.floor(tide.progress * tide.duration));
    const meter = this.ui['tide-meter'];
    if (meter.getAttribute('aria-valuenow') !== elapsed) meter.setAttribute('aria-valuenow', elapsed);

    const action = game.interaction;
    this.ui.action.hidden = !action || paused;
    this.setText('action-label', action?.label ?? '');
    const visibleNotice = notice && game.time < notice.until;
    this.ui.notice.hidden = !visibleNotice;
    this.setText('notice', visibleNotice ? notice.message : '');
    this.setText('mode', game.mode === 'boat' ? 'TEKNEDE' : 'YAYA');
    this.setText('objective', game.objective);
    this.setText('cargo', `${game.cargo.length} / ${harbor.capacity}`);
    this.setText('bank', String(harbor.delivered));
    this.setText('level', `Seviye ${harbor.level}`);
    this.setText('upgrade', harbor.next ? `${harbor.next.name} için ${harbor.next.total - harbor.delivered} parça` : 'Tüm yapılar tamamlandı');
    this.setText('pause', paused ? 'Devam et' : 'Duraklat');
    this.ui.pause.setAttribute('aria-pressed', String(paused));
    this.ui['pause-layer'].hidden = !paused;
  }
}

const game = new Game();
const renderer = new Renderer(document.getElementById('sea'), game.world);
const hud = new Hud();

function togglePause() {
  game.paused = !game.paused;
  keyboard.clear();
}

const keyboard = new Keyboard(() => game.interact(), togglePause);
hud.ui.pause.addEventListener('click', togglePause);

let previousFrame;
function frame(now) {
  const seconds = previousFrame === undefined ? 0 : Math.min((now - previousFrame) / 1000, 1 / 30);
  previousFrame = now;
  game.update(seconds, keyboard.dx, keyboard.dy);
  renderer.draw(game);
  hud.draw(game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
