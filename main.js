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
      'objective', 'action', 'action-label', 'cargo', 'bank', 'level', 'record', 'district', 'pause', 'pause-layer',
      'return-time', 'mission-title', 'mission-needs', 'mission-reward', 'journal-open', 'journal-dialog', 'journal-entries',
      'tide', 'viewport', 'sound'];
    this.ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  }

  setText(id, text) {
    const node = this.ui[id];
    if (node.textContent !== text) node.textContent = text;
  }

  draw(game) {
    const { tide, harbor, notice, paused } = game;
    const onFoot = game.mode === 'foot';
    const threat = game.threat;
    if (this.ui.tide.dataset.threat !== threat) {
      this.ui.tide.dataset.threat = threat;
      this.ui.viewport.dataset.threat = threat;
    }
    const seconds = Math.ceil(onFoot ? tide.untilFlood : tide.remaining);
    const phase = tide.phase;
    this.setText('phase', threat === 'critical' ? 'Dönüş zamanı' : phase.name);
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
    this.ui['return-time'].hidden = !onFoot;
    if (onFoot) this.setText('return-time', `TEKNE ~${game.returnTime} SN`);
    this.setText('cargo', `${game.cargo.length} / ${harbor.capacity}`);
    this.setText('bank', String(harbor.delivered));
    this.setText('record', String(harbor.bestHaul));
    this.setText('level', `Seviye ${harbor.level}`);
    this.drawMission(harbor);
    this.setText('pause', paused ? 'Devam et' : 'Duraklat');
    this.ui.pause.setAttribute('aria-pressed', String(paused));
    this.ui['pause-layer'].hidden = !paused;
  }

  drawMission(harbor) {
    const goal = harbor.next;
    const needs = [];
    if (harbor.scrapNeeded) needs.push(`${harbor.scrapNeeded} hurda`);
    if (goal?.relic && !harbor.relics.has(goal.relic.id)) needs.push(goal.relic.name);
    this.setText('mission-title', goal?.title ?? 'Liman Yeniden Yaşıyor');
    this.setText('mission-needs', needs.join(' + '));
    this.setText('mission-reward', goal ? `Ödül · ${goal.reward}` : 'Derin sandıkları çıkar ve sefer rekorunu aş.');
  }

  drawJournal(harbor) {
    const entries = JOURNAL_ENTRIES.map(entry => {
      const found = harbor.relics.has(entry.relic.id);
      const article = document.createElement('article');
      const label = document.createElement('span');
      const title = document.createElement('h3');
      const body = document.createElement('p');
      label.className = 'eyebrow';
      label.textContent = found ? 'TESLİM EDİLDİ' : 'ARANIYOR';
      title.textContent = found ? entry.title : entry.relic.name;
      body.textContent = found ? entry.text : entry.hint;
      article.append(label, title, body);
      return article;
    });
    this.ui['journal-entries'].replaceChildren(...entries);
  }
}

const game = new Game(ProgressSave.load(), harbor => ProgressSave.write(harbor));
const renderer = new Renderer(document.getElementById('sea'), game.world);
const hud = new Hud();
const feedback = new Feedback();

window.addEventListener('keydown', () => feedback.audio.unlock());
window.addEventListener('pointerdown', () => feedback.audio.unlock());
hud.ui.sound.addEventListener('click', () => {
  feedback.audio.toggle();
  const enabled = feedback.audio.enabled;
  hud.setText('sound', enabled ? 'Ses açık' : 'Ses kapalı');
  hud.ui.sound.setAttribute('aria-pressed', String(enabled));
});

function togglePause() {
  if (hud.ui['journal-dialog'].open) return;
  game.paused = !game.paused;
  keyboard.clear();
}

const keyboard = new Keyboard(() => game.interact(), togglePause);
hud.ui.pause.addEventListener('click', togglePause);
const journal = hud.ui['journal-dialog'];
let pausedBeforeJournal = false;
hud.ui['journal-open'].addEventListener('click', () => {
  pausedBeforeJournal = game.paused;
  game.paused = true;
  keyboard.clear();
  hud.drawJournal(game.harbor);
  journal.showModal();
});
journal.addEventListener('close', () => {
  game.paused = pausedBeforeJournal;
  keyboard.clear();
});

let previousFrame;
function frame(now) {
  const seconds = previousFrame === undefined ? 0 : Math.min((now - previousFrame) / 1000, 1 / 30);
  previousFrame = now;
  game.update(seconds, keyboard.dx, keyboard.dy);
  feedback.update(game);
  renderer.draw(game);
  feedback.draw(renderer.ctx, game.time);
  hud.draw(game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
