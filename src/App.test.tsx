import React from 'react';
import App from './App';
import {shallow, ShallowWrapper} from "enzyme";
import Quaternion from "quaternion";
import sinon from 'sinon';
import {computeConeLineIntersection} from "./Intersection";
import {CAPITAL_GOODS, OUTPOST_GOODS} from "./Resource";
import {EFaction, EShipType, PHYSICS_SCALE, Ship, SHIP_DATA} from "./Ship";
import {EOrderType} from "./Order";
import {DelaunayGraph, PathFinder, VoronoiGraph} from "./Graph";
import {CannonBall} from "./Item";

const getTestShip = (app: App, wrapper: ShallowWrapper<any>) => {
  // setup test ship and nav point
  // select faction
  app.selectFaction(EFaction.DUTCH);
  wrapper.update();

  // get planets
  const faction = app.factions[EFaction.DUTCH];
  const getOrder = sinon.spy(faction, "getOrder");
  const colonyWorldTrades = app.planets.map(p => ({ id: p.id, spy: sinon.spy(p, "trade"), planet: p }));
  const homeWorldTradeItem = colonyWorldTrades.find(c => c.id === faction.homeWoldPlanetId);
  if (!homeWorldTradeItem) {
    throw new Error("Could not find home world trade");
  }

  // remove ships at all factions
  for (const faction of Object.values(app.factions)) {
    const homeWorld = colonyWorldTrades.find(c => c.id === faction.homeWoldPlanetId);
    if (!homeWorld) {
      throw new Error("Could not find faction home world");
    }
    homeWorld.planet.shipyard.docks = [];
  }

  // create ship at home world
  homeWorldTradeItem.planet.wood += 600;
  homeWorldTradeItem.planet.shipyard.buildShip(EShipType.SLOOP);
  homeWorldTradeItem.planet.shipyard.docks[0].progress += 600;
  homeWorldTradeItem.planet.shipyard.handleShipyardLoop();

  // spawn at home world
  app.beginSpawnShip(homeWorldTradeItem.planet.id, EShipType.SLOOP);
  wrapper.update();

  if (app.playerShip === null) {
    throw new Error("NULL PLAYER SHIP");
  }

  return {
    testShip: app.playerShip,
    faction,
    getOrder,
    colonyWorldTrades,
    homeWorldTradeItem
  };
}
const setupPathingTest = (points: Array<[number, number, number]>, numMinutes: number = 2) => {
  // setup wrapper to run test
  const wrapper = shallow<App>(<App isTestMode />);
  const app = wrapper.instance();
  app.worldScale = 1;
  app.forceUpdate = () => undefined;

  // remove all ships
  for (const faction of Object.values(app.factions)) {
    faction.handleFactionLoop = () => undefined;
  }
  for (const planet of app.planets) {
    planet.handlePlanetLoop = () => undefined;
  }

  // setup test ship and nav point
  const {
    testShip
  } = getTestShip(app, wrapper);
  testShip.position = Quaternion.ONE;
  testShip.positionVelocity = Quaternion.ONE;
  testShip.orientation = Quaternion.ONE;
  testShip.orientationVelocity = Quaternion.ONE;
  testShip.pathFinding = new PathFinder<Ship>(testShip);

  // test the ship navigation to nav point
  const numStepsPerSecond = 10;
  const numSecondsPerMinute = 60;
  const numSteps = numStepsPerSecond * numSecondsPerMinute * numMinutes;
  let successfullyReachedDestination = false;
  for (let step = 0; step < numSteps; step++) {
    app.gameLoop.call(app);
    expect(testShip.fireControl.isAttacking).toBeFalsy();
    if (testShip.pathFinding.points.length === 0) {
      // ship has successfully reached destination
      successfullyReachedDestination = true;
      break;
    }
  }

  // expect the ship to successfully reached destination
  expect(successfullyReachedDestination).toBeTruthy();
};

const setupTradingTest = (numMinutes: number = 10) => {
  // setup wrapper to run test
  const wrapper = shallow<App>(<App isTestMode />);
  const app = wrapper.instance();
  app.worldScale = 0.25;
  app.forceUpdate = () => undefined;

  // remove all ships
  for (const faction of Object.values(app.factions)) {
    faction.handleFactionLoop = () => undefined;
  }
  for (const planet of app.planets) {
    planet.handlePlanetLoop = () => undefined;
  }

  const {
    testShip,
    getOrder,
    colonyWorldTrades,
  } = getTestShip(app, wrapper);
  const buyGoodFromShip = sinon.spy(testShip, "buyGoodFromShip");

  // test the ship navigation to nav point
  const numStepsPerSecond = 10;
  const numSecondsPerMinute = 60;
  const numSteps = numStepsPerSecond * numSecondsPerMinute * numMinutes;
  let successfullyReachedDestination = false;
  let lastCallCount: number = 0;
  for (let step = 0; step < numSteps; step++) {
    Object.values(app.planets).forEach(p => p.wood = 0);
    app.gameLoop.call(app);
    if (getOrder.callCount !== lastCallCount) {
      lastCallCount = getOrder.callCount;
      if (lastCallCount === 22) {
        successfullyReachedDestination = true;
        break;
      }
    }
  }

  // expect the ship to successfully colonize land
  const colonyWorldTradeItem = colonyWorldTrades.find(c => c.id === getOrder.returnValues[4].planetId);
  if (!colonyWorldTradeItem) {
    throw new Error("Could not find colony world trade");
  }

  expect(successfullyReachedDestination).toBeTruthy();
  const numberOfTripsToColonizePlanet = 20;
  for (let i = 0; i < numberOfTripsToColonizePlanet; i++) {
    expect(getOrder.returnValues[i].orderType).toBe(EOrderType.SETTLE);
  }

  // expect ship to trade with second planet
  expect(getOrder.returnValues[numberOfTripsToColonizePlanet].orderType).toBe(EOrderType.TRADE);
  expect(colonyWorldTradeItem.spy.callCount).toBeGreaterThan(0);
  let buyGoodCall = 0;
  for (let step = 0; step < colonyWorldTradeItem.spy.callCount; step++) {
    for (const outpostGood of OUTPOST_GOODS) {
      expect(buyGoodFromShip.getCall(buyGoodCall++).args[0]).toBe(outpostGood);
    }
    for (const capitalGood of CAPITAL_GOODS) {
      expect(buyGoodFromShip.getCall(buyGoodCall++).args[0]).toBe(capitalGood);
    }
  }
};

describe('test AI Pathing', () => {
  describe('test pathing from all 360 degrees', () => {
    for (let angle = 0; angle < 360; angle += 5) {
      it(`test pathing form angle ${angle}`, () => {
        setupPathingTest([
          [
            Math.cos(angle / 180 * Math.PI),
            Math.sin(angle / 180 * Math.PI),
            0
          ]
        ]);
      });
    }
  });
  describe('test settling points',  () => {
    for (let test = 0; test < 10; test++) {
      it(`test settling with random data ${test}`, () => {
        setupTradingTest(60);
      });
    }
  });
});
describe('Collision Detection', () => {
  describe('line segment', () => {
    it('large line segment and big movement', () => {
      const a = DelaunayGraph.normalize([1, 0, 1]);
      const b = DelaunayGraph.normalize([1, 0, -1]);
      const c: [number, number, number] = [0, 1, 0];
      const d: [number, number, number] = [1, 0, 0];
      const intercept = App.computeIntercept(a, b, c, d);
      expect(VoronoiGraph.angularDistance(intercept, [1, 0, 0], 1)).toBeLessThan(PHYSICS_SCALE / 1000);

      const segmentDistance: number = VoronoiGraph.angularDistance(a, b, 1);
      const interceptDistance: number = VoronoiGraph.angularDistance(a, intercept, 1) + VoronoiGraph.angularDistance(intercept, b, 1);
      expect(Math.abs(segmentDistance - interceptDistance)).toBeLessThan(PHYSICS_SCALE / 1000);
    });
    it('large line segment and small movement', () => {
      const a = DelaunayGraph.normalize([1, 0, 1]);
      const b = DelaunayGraph.normalize([1, 0, -1]);
      const c: [number, number, number] = [0, 1, 0];
      const d: [number, number, number] = DelaunayGraph.normalize([PHYSICS_SCALE, 1, 0]);
      const intercept = App.computeIntercept(a, b, c, d);
      expect(VoronoiGraph.angularDistance(intercept, [1, 0, 0], 1)).toBeLessThan(PHYSICS_SCALE / 1000);

      const segmentDistance: number = VoronoiGraph.angularDistance(a, b, 1);
      const interceptDistance: number = VoronoiGraph.angularDistance(a, intercept, 1) + VoronoiGraph.angularDistance(intercept, b, 1);
      expect(Math.abs(segmentDistance - interceptDistance)).toBeLessThan(PHYSICS_SCALE / 1000);
    });
    it('small line segment and small movement', () => {
      const a = DelaunayGraph.normalize([1, 0, 1]);
      const b = DelaunayGraph.normalize([1, 0, 1 - PHYSICS_SCALE]);
      const c: [number, number, number] = [0, 1, 0];
      const d: [number, number, number] = DelaunayGraph.normalize([PHYSICS_SCALE, 1, 0]);
      const intercept = App.computeIntercept(a, b, c, d);
      expect(VoronoiGraph.angularDistance(intercept, [1, 0, 0], 1)).toBeLessThan(PHYSICS_SCALE / 1000);

      const segmentDistance: number = VoronoiGraph.angularDistance(a, b, 1);
      const interceptDistance: number = VoronoiGraph.angularDistance(a, intercept, 1) + VoronoiGraph.angularDistance(intercept, b, 1);
      expect(Math.abs(segmentDistance - interceptDistance)).not.toBeLessThan(PHYSICS_SCALE / 1000);
    });
    it('cannon ball hits ship', () => {
      const ship = new Ship({} as App, EShipType.HIND);
      ship.id = "test-ship";
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      cannonBall.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      cannonBall.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [0, -1, 0]);
      const hit = App.cannonBallCollision(cannonBall, ship, 1);
      expect(hit).toEqual({
        success: true,
        point: [-0, 0.0003, 0.009995498987044117],
        distance: 0.7503685782431588,
        time: 0.47769947347294545,
      });
    });
    it('cannon ball misses ship (too slow)', () => {
      const ship = new Ship({} as App, EShipType.HIND);
      ship.id = "test-ship";
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      cannonBall.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      cannonBall.positionVelocity = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, -PHYSICS_SCALE, 1])
      );
      const hit = App.cannonBallCollision(cannonBall, ship, 1);
      expect(hit).toEqual({
        success: false,
        point: null,
        distance: null,
        time: null,
      });
    });
    it('cannon ball misses ship (opposite direction)', () => {
      const ship = new Ship({} as App, EShipType.HIND);
      ship.id = "test-ship";
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      cannonBall.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      cannonBall.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [0, 1, 0]);
      const hit = App.cannonBallCollision(cannonBall, ship, 1);
      expect(hit).toEqual({
        success: false,
        point: null,
        distance: null,
        time: null,
      });
    });
    it('cannon ball misses ship (parallel direction)', () => {
      const ship = new Ship({} as App, EShipType.HIND);
      ship.id = "test-ship";
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      cannonBall.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      cannonBall.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [1, 0, 0]);
      const hit = App.cannonBallCollision(cannonBall, ship, 1);
      expect(hit).toEqual({
        success: false,
        point: null,
        distance: null,
        time: null,
      });
    });
    it('ship hits still cannon ball', () => {
      const ship = new Ship({} as App, EShipType.HIND);
      ship.id = "test-ship";
      ship.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      ship.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [0, -1, 0]);
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      const hit = App.cannonBallCollision(cannonBall, ship, 1);
      expect(hit).toEqual({
        success: true,
        point: [0, 0.0034277921407224843, 0.0036400880538801747],
        distance: 0.7553704751672747,
        time: 0.4808837799541822,
      });
    });
  });
  describe('Aiming at moving target', () => {
    it('should aim north', () => {
      const projectileSpeed = 5;
      const shipPosition: [number, number] = [0, 4];
      const shipDirection: [number, number] = [0, 1];

      expect(computeConeLineIntersection(shipPosition, shipDirection, projectileSpeed)).toEqual({
        success: true,
        point: [0, 5],
        distance: 5,
        time: 1
      });
    });
    it('should aim south', () => {
      const projectileSpeed = 5;
      const shipPosition: [number, number] = [0, -6];
      const shipDirection: [number, number] = [0, 1];

      expect(computeConeLineIntersection(shipPosition, shipDirection, projectileSpeed)).toEqual({
        success: true,
        point: [0, -5],
        distance: 5,
        time: 1
      });
    });
    it('should aim east', () => {
      const projectileSpeed = 5;
      const shipPosition: [number, number] = [5, -1];
      const shipDirection: [number, number] = [0, 1];

      expect(computeConeLineIntersection(shipPosition, shipDirection, projectileSpeed)).toEqual({
        success: true,
        point: [5, 0],
        distance: 5,
        time: 1
      });
    });
    it('should aim west', () => {
      const projectileSpeed = 5;
      const shipPosition: [number, number] = [-5, -1];
      const shipDirection: [number, number] = [0, 1];

      expect(computeConeLineIntersection(shipPosition, shipDirection, projectileSpeed)).toEqual({
        success: true,
        point: [-5, 0],
        distance: 5,
        time: 1
      });
    });
    it('should miss because too fast', () => {
      const projectileSpeed = 1;
      const shipPosition: [number, number] = [0, 4];
      const shipDirection: [number, number] = [0, 2];

      expect(computeConeLineIntersection(shipPosition, shipDirection, projectileSpeed)).toEqual({
        success: false,
        point: null,
        distance: null,
        time: null
      });
    });
  });
});
