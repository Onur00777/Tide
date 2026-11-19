'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { createContext, runInContext } = require('node:vm');

const scripts = ['world', 'expedition', 'crew', 'progression', 'boat', 'game'].map(name => {
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
