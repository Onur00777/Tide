'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { createContext, runInContext } = require('node:vm');

const scripts = ['world', 'expedition', 'crew', 'progression', 'boat', 'weather', 'world-map', 'sanity', 'port-life', 'game'].map(name => {
  const filename = name + '.js';
  return { filename, source: readFileSync(join(__dirname, '..', filename), 'utf8') };
});

function scenario(check) {
  const context = createContext({ assert });
  runInContext('let seed = 205; Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);', context);
  for (const { filename, source } of scripts) runInContext(source, context, { filename });
  runInContext('(' + check.toString() + ')()', context);
}

test('every district has a legal harbor-facing landing', () => scenario(() => {
  const world = new World();
  for (const district of DISTRICTS) {
    world.setDistrict(district.map);
    const point = world.shoreTarget;
    const tile = world.landingNear(point);
    assert.ok(tile, district.name);
    assert.ok(world.canOccupy(point.x, point.y, 11, 'boat', true), district.name);
    world.markEscapeRoute(tile);
    assert.ok(world.escape.has(tile));
  }
}));

test('route selection persists without replacing an active low-tide expedition', () => scenario(() => {
  let saved;
  const game = new Game({ tier: 2, route: 0 }, harbor => { saved = harbor.snapshot(); });
  game.switchRoute();
  assert.equal(game.expedition.district, DISTRICTS[1]);
  assert.equal(new Game(saved).nextDistrict, DISTRICTS[1]);
  game.tide.index = 2;
  game.onPhaseChange(2);
  const sites = game.expedition.sites;
  game.switchRoute();
  assert.equal(game.nextDistrict, DISTRICTS[2]);
  assert.equal(game.expedition.district, DISTRICTS[1]);
  assert.equal(game.expedition.sites, sites);
  game.onPhaseChange(2);
  assert.equal(game.expedition.district, DISTRICTS[2]);
  assert.equal(new Game({ tier: 1, route: 99 }).nextDistrict, DISTRICTS[1]);
}));

test('braking slows the boat even if throttle is held', () => scenario(() => {
  const calm = { x: 0, y: 0 };
  const canMove = () => true;
  const onImpact = () => assert.fail('no collision expected');
  const boat = new Boat(400, 300);
  boat.velocityX = 140;
  const coasting = new Boat(400, 300);
  coasting.velocityX = 140;
  boat.move(1, 0, 0.3, calm, canMove, onImpact, true);
  coasting.move(0, 0, 0.3, calm, canMove, onImpact);
  assert.ok(boat.currentSpeed < 42);
  assert.ok(boat.currentSpeed < coasting.currentSpeed);
  assert.ok(boat.x > 400 && boat.x < coasting.x);
}));

test('disembarking requires an exposed shore and low speed', () => scenario(() => {
  const game = new Game();
  const { x, y } = game.world.shoreTarget;
  Object.assign(game.boat, { x, y, velocityX: 110 });
  assert.equal(game.interaction, null);
  game.tide.index = 2;
  assert.equal(game.interaction, null);
  game.boat.stop();
  assert.equal(game.interaction.type, 'land');
  game.interact();
  assert.equal(game.mode, 'foot');
  game.interact();
  assert.equal(game.mode, 'boat');
}));

test('the needed relic is highlighted until it is acquired or the tide turns', () => scenario(() => {
  const game = new Game();
  game.tide.index = 2;
  game.onPhaseChange(2);
  const { x, y } = game.world.shoreTarget;
  Object.assign(game.boat, { x, y });
  game.interact();
  assert.equal(game.requiredFind.item, RELICS.journal);
  assert.equal(game.target.kind, 'required');
  game.tide.index = 4;
  assert.equal(game.target.label, 'Tekne');
  game.tide.index = 2;
  game.cargo.push(RELICS.journal);
  assert.equal(game.requiredFind, null);
}));

test('a repair can draw from stored scrap and a partial on-board stack', () => scenario(() => {
  const game = new Game({ scrap: 4 });
  game.boat.x = 500;
  game.boat.hull = 50;
  game.cargo.push({ ...SCRAP_CRATE, scrap: 1 }, RELICS.journal);
  assert.ok(game.canRepair);
  game.repair();
  assert.equal(game.boat.hull, 84);
  assert.equal(game.harbor.scrap, 3);
  assert.equal(game.onboardScrap, 0);
  assert.equal(game.cargo[0], RELICS.journal);
  Object.assign(game.boat, game.world.dock);
  game.repair();
  assert.equal(game.boat.hull, 100);
  assert.equal(game.harbor.scrap, 3);
}));

test('route changes do not replenish a deep crate within the same tide', () => scenario(() => {
  const game = new Game({ tier: 2, route: 0, crew: ['shipwright'], fittings: ['crane'] });
  assert.ok(game.deepTarget);
  game.deepTarget.opened = true;
  game.switchRoute();
  game.switchRoute();
  assert.equal(game.deepTarget, null);
  game.tide.index = 2;
  game.onPhaseChange(2);
  game.tide.index = 0;
  assert.ok(game.deepTarget);
}));


test('sea regions have navigable gates, respect cathedral lock and restore collected sites', () => scenario(() => {
  const game = new Game();
  game.tide.index = 2; game.onPhaseChange(2);
  const original = game.expedition.sites;
  original[0].opened = true;
  let gate = game.map.gates[0];
  Object.assign(game.boat, gate); game.boat.stop(); game.interact();
  assert.equal(game.map.region.id, 'oldtown'); assert.equal(game.atDock, false);
  gate = game.map.gates.find(g => g.region.id === 'harbor');
  Object.assign(game.boat, gate); game.interact();
  assert.equal(game.expedition.sites, original); assert.equal(original[0].opened, true);
  for (const region of SEA_REGIONS) {
    game.map.region = region;
    for (const entry of game.map.gates) assert.ok(game.world.canOccupy(entry.x, entry.y, 11, 'boat', true));
  }
  assert.equal(game.map.canEnter(SEA_REGIONS[3]), false);
  game.harbor.fittings.add('armor'); game.harbor.fittings.add('engine');
  assert.equal(game.map.canEnter(SEA_REGIONS[3]), true);
}));

test('weather advances independently, bounds trails, and paused simulation freezes', () => scenario(() => {
  const game = new Game(); game.weather.kind = 'storm'; game.weather.lightningIn = 0;
  game.update(0.1, 0, 0);
  assert.ok(game.weather.flash > 0); assert.ok(game.cues.some(c => c.type === 'thunder'));
  const remaining = game.weather.remaining; const time = game.time;
  game.paused = true; game.update(20, 1, 0);
  assert.equal(game.weather.remaining, remaining); assert.equal(game.time, time);
  game.paused = false;
  for (let i = 0; i < 600; i++) game.update(1 / 30, 1, 0);
  assert.ok(game.weather.wake.length <= 35);
}));

test('diving requires both fittings, recovers one reward, and emergency extraction costs cargo', () => scenario(() => {
  const game = new Game(); game.tide.index = 2; game.mode = 'foot';
  const site = { item: RELICS.heart, opened: false };
  game.diving.enter(game, site); assert.equal(game.diving.active, null);
  game.harbor.fittings.add('diveLamp'); game.harbor.fittings.add('boots');
  game.diving.enter(game, site); assert.ok(game.diving.active);
  game.diving.update(10, game); assert.equal(game.cargo.length, 1); assert.ok(site.opened);
  game.diving.update(1, game); assert.equal(game.cargo.length, 1);
  game.tide.index = 4; game.diving.update(10, game);
  assert.equal(game.mode, 'boat'); assert.equal(game.diving.active, null);
  assert.equal(game.cargo.length, 0); assert.equal(game.boat.hull, 85); assert.equal(game.sanity.panic, 100);
}));

test('light recovers panic and contracts pay exactly once across reloads', () => scenario(() => {
  const game = new Game({ crew: ['smith', 'cartographer'], relics: ['cog', 'dial'] });
  game.sanity.panic = 80; game.sanity.update(5, game); assert.equal(game.sanity.panic, 30);
  game.port.settle(game); assert.equal(game.harbor.scrap, 9); assert.equal(game.harbor.contracts.size, 2);
  game.port.settle(game); assert.equal(game.harbor.scrap, 9);
  const restored = new Game(game.harbor.snapshot()); restored.port.settle(restored);
  assert.equal(restored.harbor.scrap, 9); assert.ok(restored.harbor.explored.has('lighthouse:10:6'));
}));

test('economy premiums and finale survive save reload without repeat rewards', () => scenario(() => {
  const game = new Game({ tier: 3, relics: ['bell', 'vow', 'heart', 'chorus'], marketDay: 3 });
  game.cargo = [DEEP_CRATE]; game.archive(); assert.equal(game.harbor.scrap, 8);
  assert.ok(game.port.canEnd); game.port.finish(game); assert.equal(game.harbor.scrap, 28);
  game.port.finish(game); assert.equal(game.harbor.scrap, 28);
  const restored = new Game(game.harbor.snapshot()); assert.ok(restored.harbor.ending);
  restored.port.finish(restored); assert.equal(restored.harbor.scrap, 28);
}));

test('every district supplies four vaults and a reachable cellar over many tides', () => scenario(() => {
  for (const district of DISTRICTS) for (let i = 0; i < 20; i++) {
    const world = new World(); world.setDistrict(district.map);
    const expedition = new Expedition(world); expedition.district = district;
    expedition.begin(district, new Set(), []);
    assert.equal(expedition.sites.length, 4, district.name);
    assert.equal(new Set(expedition.sites.map(s => s.item.id)).size, 4);
    for (const site of expedition.sites) assert.ok(world.district.neighbors(site).some(tile => world.isFootTile(tile)));
    assert.equal(expedition.sites.filter(s => s.cellar).length, 1);
  }
}));


test('all vault rewards are reachable on foot from a valid landing without walking through walls', () => scenario(() => {
  const game = new Game();
  for (const district of DISTRICTS) {
    game.world.setDistrict(district.map); game.expedition.district = district;
    game.expedition.begin(district, new Set(), []);
    const reachable = new Set(game.world.shore);
    const queue = [...reachable];
    for (const tile of queue) for (const next of game.world.district.neighbors(tile)) {
      if (!reachable.has(next) && game.world.isFootTile(next)) { reachable.add(next); queue.push(next); }
    }
    for (const site of game.expedition.sites) {
      assert.ok([...reachable].some(tile => distance(tile, site) < 35 && game.world.canOccupy(tile.x, tile.y, 6, 'foot', true)));
    }
    assert.equal(game.expedition.sites.find(s => s.item.id === district.finds[0]).cellar, false);
  }
}));

test('rescued residents cannot be duplicated by revisiting a cached region', () => scenario(() => {
  const game = new Game(); game.tide.index = 2; game.onPhaseChange(2);
  game.rescue.stranded = { x: 800, y: 300, member: CREW.smith };
  let gate = game.map.gates[0]; Object.assign(game.boat, { x:gate.x, y:gate.y }); game.interact();
  game.harbor.crew.add('smith');
  gate = game.map.gates.find(g => g.region.id === 'harbor'); Object.assign(game.boat, { x:gate.x, y:gate.y }); game.interact();
  assert.equal(game.rescue.stranded, null);
}));
