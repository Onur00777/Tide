"use strict";

const PORT_CONTRACTS = [
  { id: 'forge', crew: 'smith', relic: 'cog', reward: 5, text: 'Eski Tersane’deki paslı çarkı getir. Ocağı yeniden yakalım.' },
  { id: 'compass', crew: 'cartographer', relic: 'dial', reward: 4, text: 'Fener Adası’nda pusulamı kaybettim. Bulursan kuzeyi çizerim.' },
  { id: 'beacon', crew: 'diver', relic: 'rotor', reward: 6, text: 'İnci Mahallesi’ndeki ilk rotor hâlâ ışığı hatırlıyor.' },
  { id: 'keel', crew: 'shipwright', relic: 'seal', reward: 4, text: 'Tersanenin lonca mührünü getir; ticaret gemileri geri dönsün.' },
];
const RELIC_STORIES = {
  journal: 'Kaptan son sayfaya tek cümle yazmış: Suyu ay çekmiyor. Aşağıdaki çan çağırıyor.',
  cog: 'Dişliler bir saate değil, şehrin taşkın kapılarına ait. Birisi kapıları içeriden açmış.',
  secret: 'Üç fener birden söndüğü gece şehir sessizce suyun altına yürüdü.',
  signal: 'Son ışık bir yardım çağrısı değil, geri dönün işaretiymiş.',
  ledger: 'Son vardiyada isimlerin yanında saat yok; yalnızca birer dalga çizilmiş.',
  spring: 'Zemberek her yükselen suda yeniden geriliyor. Kimin kurduğu bilinmiyor.',
  seal: 'Loncanın mühründe deniz değil, ters çevrilmiş bir katedral var.',
  dial: 'Pusula kuzeyi göstermiyor. İbre, suyun altındaki çana eğiliyor.',
  weather: 'Her fırtınadan önce aynı üç nota. Meteoroloji kaydı dua gibi bitiyor.',
  pearl: 'İncinin içinde bir pencere ışığı var. Elini kapatınca biri perdeyi çekiyor.',
  tidebook: 'Şehrin son haritasında sokaklar katedralin altında birleşiyor.',
  rotor: 'Fenerci ışığı söndürmemiş. Şehre son kez yol göstermek için aşağı çevirmiş.',
  bell: 'Çanın dili sökülmüş. Yine de her gelgitte aynı sesi duyuyorsun.',
  vow: 'Yemin: Son kişi dönene kadar ışığı açık tut. Deniz artık borcunu ödeyebilir.',
  heart: 'Kalp bir makine değil; şehirde kalanların isimlerini taşıyan bir cam küre.',
  chorus: 'Koroda bir ses eksik. Limanda seni bekleyen fener onun yerini dolduracak.',
};

class PortLife {
  constructor(harbor) { this.harbor = harbor; }
  get price() { return [1, 1.5, 1, 2][this.harbor.marketDay % 4]; }
  get demand() { return ['Sakin pazar', 'Tersane siparişi', 'Dolu ambarlar', 'Fırtına sonrası kıtlık'][this.harbor.marketDay % 4]; }
  get contracts() { return PORT_CONTRACTS.filter(c => this.harbor.crew.has(c.crew)); }
  settle(game) {
    const completed = [];
    for (const contract of this.contracts) {
      if (this.harbor.contracts.has(contract.id) || !this.harbor.relics.has(contract.relic)) continue;
      this.harbor.contracts.add(contract.id); this.harbor.addScrap(contract.reward); completed.push(contract);
      if (contract.id === 'compass') for (let x = 0; x < 11; x++) for (let y = 0; y < 7; y++) this.harbor.explored.add(`lighthouse:${x}:${y}`);
    }
    if (completed.length) game.announce('LİMANIN SÖZÜ', completed.map(c => CREW[c.crew].name + ' +' + c.reward).join(' · '), 'upgrade', 5);
    return completed;
  }
  get canEnd() { return ['bell', 'vow', 'heart', 'chorus'].every(id => this.harbor.relics.has(id)) && this.harbor.tier === 3; }
  finish(game) {
    if (!game.atDock || game.paused || !this.canEnd || this.harbor.ending) return;
    this.harbor.ending = true; this.harbor.addScrap(20); game.sanity.panic = 0;
    game.persist(this.harbor); game.signal('upgrade', game.boat);
    game.announce('SON FENER · ŞAFAK', 'İsimleri ışığa bıraktın. Bu kez deniz cevap vermedi. Liman artık evin.', 'upgrade', 15);
  }
  draw(renderer, game) {
    if (!game.map.home) return;
    const ctx = renderer.ctx, time = game.time;
    for (const id of this.harbor.crew) {
      const home = HARBOR_HOMES[id];
      const x = home.x + Math.sin(time * 0.35 + home.x) * 10, y = home.y + 19;
      renderer.drawCrewMember(x, y, CREW[id].color);
      renderer.glow(x, y, 35, 0.24 + Math.sin(time * 4.3 + x) * 0.025);
      const contract = this.contracts.find(c => c.crew === id && !this.harbor.contracts.has(c.id));
      if (Math.floor(time / 6) % 4 === [...this.harbor.crew].indexOf(id) % 4) {
        const text = contract ? RELICS[contract.relic].name + '…' : 'Işık yanıyor. Hoş geldin.';
        ctx.font = '8px Georgia'; const width = ctx.measureText(text).width + 14;
        ctx.fillStyle = '#0a1e26ed'; ctx.fillRect(x - width / 2, y - 34, width, 17);
        ctx.fillStyle = '#e3cc9d'; ctx.textAlign = 'center'; ctx.fillText(text, x, y - 23); ctx.textAlign = 'start';
      }
    }
    const count = Math.min(5, this.harbor.tier + this.harbor.contracts.size);
    for (let i = 0; i < count; i++) {
      const x = 310 + i * 21, y = 405 + Math.sin(time + i) * 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(0.8);
      ctx.fillStyle = '#806447'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e5d0a4'; ctx.fillRect(-4, -3, 5, 6); ctx.restore(); renderer.glow(x, y, 17, 0.2);
    }
    if (this.harbor.contracts.size) {
      const x = 420 + (time * 13 % 650), y = 550 + Math.sin(time * 0.07) * 12;
      ctx.fillStyle = '#ac9270'; ctx.beginPath(); ctx.ellipse(x, y, 19, 7, 0, 0, Math.PI * 2); ctx.fill();
      renderer.glow(x - 6, y, 25, 0.45);
    }
  }
}
