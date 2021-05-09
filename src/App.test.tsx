import React from 'react';
import App from './App';
import {shallow, ShallowWrapper} from "enzyme";
import Quaternion from "quaternion";
import sinon, {SinonSpy} from 'sinon';
import {computeConeLineIntersection} from "./Intersection";
import {CAPITAL_GOODS, OUTPOST_GOODS} from "./Resource";
import {EFaction, EShipType, PHYSICS_SCALE, Ship, SHIP_DATA} from "./Ship";
import {EOrderType, Order} from "./Order";
import {DelaunayGraph, PathFinder, VoronoiGraph} from "./Graph";
import {CannonBall} from "./Item";
import {Faction} from "./Faction";
import {Planet} from "./Planet";
import {ESettlementLevel} from "./Interface";

/**
 * Get a test ship from the app.
 * @param app The app containing a blank world.
 * @param wrapper The wrapper containing the app.
 * @param colonyWorldTrades The list of colony worlds containing trade references.
 * @param factionType The faction of the ship to spawn.
 * @param shipType The type of ship to spawn.
 */
const getTestShip = (app: App, wrapper: ShallowWrapper<any>, colonyWorldTrades: Array<{
  id: string, spy: sinon.SinonSpy<[ship: Ship, unloaded?: boolean | undefined], void>, planet: Planet
}>, factionType: EFaction, shipType: EShipType) => {
  // setup test ship and nav point
  // select faction
  app.selectFaction(factionType);
  wrapper.update();

  // get planets
  const faction = app.factions[factionType];
  const getOrder = sinon.spy(faction, "getOrder");
  const homeWorldTradeItem = colonyWorldTrades.find(c => c.id === faction.homeWorldPlanetId);
  if (!homeWorldTradeItem) {
    throw new Error("Could not find home world trade");
  }

  // remove ships at all factions
  for (const faction of Object.values(app.factions)) {
    const homeWorld = colonyWorldTrades.find(c => c.id === faction.homeWorldPlanetId);
    if (!homeWorld) {
      throw new Error("Could not find faction home world");
    }
    homeWorld.planet.shipyard.docks = [];
  }

  // create ship at home world
  const shipData = SHIP_DATA.find(s => s.shipType === shipType);
  if (!shipData) {
    throw new Error("Could not find ship type");
  }
  homeWorldTradeItem.planet.wood += shipData.cost;
  homeWorldTradeItem.planet.shipyard.buildShip(shipType);
  homeWorldTradeItem.planet.shipyard.docks[0].progress += shipData.cost;
  homeWorldTradeItem.planet.shipyard.handleShipyardLoop();
  app.gold += homeWorldTradeItem.planet.shipyard.quoteShip(shipType);

  // spawn at home world
  app.beginSpawnShip(homeWorldTradeItem.planet.id, shipType);
  wrapper.update();

  if (app.playerShip === null) {
    throw new Error("NULL PLAYER SHIP");
  }

  return {
    testShip: app.playerShip,
    faction,
    getOrder,
    homeWorldTradeItem
  };
};

/**
 * Check for valid faction data.
 * @param faction The faction to check for valid data.
 */
const assertFactionData = (faction: Faction) => {
  // get faction home world
  const homeWorld = faction.instance.planets.find(p => p.id === faction.homeWorldPlanetId);
  if (!homeWorld) {
    throw new Error("Could not find faction's home world");
  }

  // for each planet
  for (const planet of faction.instance.planets) {
    // ignore home world
    if (planet.id === faction.homeWorldPlanetId) {
      continue;
    }

    // validate faction's data about each planet
    expect(faction.explorationGraph).toHaveProperty(planet.id);
    const expectedDistance = VoronoiGraph.angularDistance(
      homeWorld.position.rotateVector([0, 0, 1]),
      planet.position.rotateVector([0, 0, 1]),
      faction.instance.worldScale
    );
    expect(faction.explorationGraph[planet.id].distance).toBe(expectedDistance);
    expect(faction.explorationGraph[planet.id].planet).toBe(planet);
  }
};

/**
 * Setup unit tests around pathing.
 * @param points The list of target points to travel to.
 * @param numMinutes The number of minutes for the test to take.
 * The ship shouldn't take more than 2 minutes of game time to travel from the north pole
 * to the equator. The 1 unit scaled world should take 4 minutes to travel half way around
 * the world and 8 minutes to circumnavigate.
 */
const setupPathingTest = (points: Array<[number, number, number]>, numMinutes: number = 2) => {
  // setup wrapper to run test
  const wrapper = shallow<App>(<App isTestMode worldScale={1} />);
  const app = wrapper.instance();
  app.forceUpdate = () => undefined;

  // remove all ships
  for (const faction of Object.values(app.factions)) {
    faction.handleFactionLoop = () => undefined;
  }
  for (const planet of app.planets) {
    planet.handlePlanetLoop = () => undefined;
  }

  // validate data
  for (const faction of Object.values(app.factions)) {
    assertFactionData(faction);
  }

  // setup test ship and nav point
  const colonyWorldTrades = app.planets.map(p => ({ id: p.id, spy: sinon.spy(p, "trade"), planet: p }));
  const {
    testShip
  } = getTestShip(app, wrapper, colonyWorldTrades, EFaction.DUTCH, EShipType.SLOOP);
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

/**
 * Setup settling and trading tests. The ship should settle the planet first then trade with it.
 * The smallest ship, SLOOP, should take 20 trips to settle the planet by itself, then trade two times.
 * @param numMinutes This test should take 20 minutes of game time.
 */
const setupTradingTest = (numMinutes: number = 20) => {
  // setup wrapper to run test
  const wrapper = shallow<App>(<App isTestMode worldScale={1} />);
  const app = wrapper.instance();
  app.forceUpdate = () => undefined;

  // remove all ships
  for (const faction of Object.values(app.factions)) {
    faction.handleFactionLoop = () => undefined;
  }
  for (const planet of app.planets) {
    planet.handlePlanetLoop = () => undefined;
  }

  // validate data
  for (const faction of Object.values(app.factions)) {
    assertFactionData(faction);
  }

  const colonyWorldTrades = app.planets.map(p => ({ id: p.id, spy: sinon.spy(p, "trade"), planet: p }));
  const {
    testShip,
    getOrder,
  } = getTestShip(app, wrapper, colonyWorldTrades, EFaction.DUTCH, EShipType.SLOOP);
  const buyGoodFromShip = sinon.spy(testShip, "buyGoodFromShip");

  // determine number of trips
  const shipData = SHIP_DATA.find(s => s.shipType === EShipType.SLOOP);
  if (!shipData) {
    throw new Error("Could not find ship type");
  }
  const numberOfTripsToColonizePlanet = 20 / shipData.settlementProgressFactor;

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
      if (lastCallCount === numberOfTripsToColonizePlanet + 2) {
        successfullyReachedDestination = true;
        break;
      }
    }
  }

  // expect ship to complete it's mission.
  expect(lastCallCount).toBe(numberOfTripsToColonizePlanet + 2);
  expect(successfullyReachedDestination).toBeTruthy();

  // expect the ship to successfully colonize land
  const colonyWorldTradeItem = colonyWorldTrades.find(c => c.id === getOrder.returnValues[4].planetId);
  if (!colonyWorldTradeItem) {
    throw new Error("Could not find colony world trade");
  }

  expect(successfullyReachedDestination).toBeTruthy();
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

/**
 * Setup piracy test. An English SLOOP should trade with a planet and a Dutch HIND should attack the English SLOOP.
 * @param numMinutes This test should take 20 minutes of game time.
 */
const setupPiracyTest = (numMinutes: number = 20) => {
  // setup wrapper to run test
  const wrapper = shallow<App>(<App isTestMode worldScale={1} />);
  const app = wrapper.instance();
  app.forceUpdate = () => undefined;

  // remove all ships
  for (const faction of Object.values(app.factions)) {
    faction.handleFactionLoop = () => undefined;
  }
  for (const planet of app.planets) {
    planet.handlePlanetLoop = () => undefined;
  }

  // validate data
  for (const faction of Object.values(app.factions)) {
    assertFactionData(faction);
  }

  // give English faction a colony, so they can trade with it, and also be pirated
  const englishFaction = app.factions[EFaction.ENGLISH];
  if (!englishFaction) {
    throw new Error("Could not find English Faction");
  }
  const englishHomeWorld = app.planets.find(p => p.id === englishFaction.homeWorldPlanetId);
  if (!englishHomeWorld) {
    throw new Error("Could not find English Home World");
  }
  const closestEnglishPlanet = Object.values(englishFaction.explorationGraph).reduce((acc, n) => {
    if (!acc || (acc && n.distance < acc.distance)) {
      return {
        distance: n.distance,
        planet: n.planet
      };
    } else {
      return acc;
    }
  }, null as null | {
    distance: number,
    planet: Planet
  });
  if (!closestEnglishPlanet) {
    throw new Error("Could not find closest English Planet");
  }
  closestEnglishPlanet.planet.settlementProgress = 1;
  closestEnglishPlanet.planet.settlementLevel = ESettlementLevel.OUTPOST;
  englishFaction.planetIds.push(closestEnglishPlanet.planet.id);

  // create english ship to be pirated
  const colonyWorldTrades = app.planets.map(p => ({ id: p.id, spy: sinon.spy(p, "trade"), planet: p }));
  const {
    testShip: englishMerchantShip,
    getOrder: englishMerchantShipGetOrder,
  } = getTestShip(app, wrapper, colonyWorldTrades, EFaction.ENGLISH, EShipType.SLOOP);

  // create dutch ship to pirate
  app.returnToMainMenu();
  wrapper.update();
  const {
    testShip: dutchPirateShip,
    getOrder: dutchPirateShipGetOrder,
  } = getTestShip(app, wrapper, colonyWorldTrades, EFaction.DUTCH, EShipType.HIND);

  // test conditions to test for
  let englishBegunTrading: boolean = false;
  let dutchBegunPirating: boolean = false;
  let beginningPiracyMission: boolean = false;
  let goingToEnemyColonyToPirate: boolean = false;
  let englishMerchantShipClosestApproach: number = Math.PI * app.worldScale;
  let dutchPirateShipClosestApproach: number = Math.PI * app.worldScale;
  let dutchPirateShipBegunAttacking: boolean = false;
  let englishMerchantShipDestroyed: boolean = false;
  let dutchPiratePickUpCargo: boolean = false;
  let returningToHomeWorldWithLoot: boolean = false;
  let endingPirateContract: boolean = false;
  let dutchPirateOrder: Order | null = null;
  let returnToHomeWorldSpy: SinonSpy<any> | null = null;
  let beginPirateMissionSpy: SinonSpy<any> | null = null;
  let goToColonyWorldToPirateSpy: SinonSpy<any> | null = null;

  // test the ship navigation to nav point
  const numStepsPerSecond = 10;
  const numSecondsPerMinute = 60;
  const numSteps = numStepsPerSecond * numSecondsPerMinute * numMinutes;
  for (let step = 0; step < numSteps; step++) {
    Object.values(app.planets).forEach(p => p.wood = 0);
    app.gameLoop.call(app);

    // test begin mission conditions
    if (!englishBegunTrading && englishMerchantShipGetOrder.called) {
      expect(englishMerchantShipGetOrder.returnValues[0].orderType).toBe(EOrderType.TRADE);
      englishBegunTrading = true;
    }
    if (!dutchBegunPirating && dutchPirateShipGetOrder.called) {
      expect(dutchPirateShipGetOrder.returnValues[0].orderType).toBe(EOrderType.PIRATE);
      expect(dutchPirateShipGetOrder.returnValues[0].planetId).toBe(closestEnglishPlanet.planet.id);
      dutchBegunPirating = true;
      dutchPirateOrder = dutchPirateShipGetOrder.returnValues[0];
      returnToHomeWorldSpy = sinon.spy(dutchPirateOrder, "returnToHomeWorld");
      beginPirateMissionSpy = sinon.spy(dutchPirateOrder, "beginPirateMission");
      goToColonyWorldToPirateSpy = sinon.spy(dutchPirateOrder, "goToColonyWorldToPirate");
    }
    if (!beginningPiracyMission && beginPirateMissionSpy && beginPirateMissionSpy.callCount === 1) {
      beginningPiracyMission = true;
    }
    if (!goingToEnemyColonyToPirate && goToColonyWorldToPirateSpy && goToColonyWorldToPirateSpy.callCount === 1) {
      goingToEnemyColonyToPirate = true;
      expect(dutchPirateShip.pathFinding.points.length).toBeGreaterThan(0);
      expect(DelaunayGraph.distanceFormula(
          dutchPirateShip.pathFinding.points[dutchPirateShip.pathFinding.points.length - 1],
          DelaunayGraph.normalize(App.lerp(
              closestEnglishPlanet.planet.position.rotateVector([0, 0, 1]),
              englishHomeWorld.position.rotateVector([0, 0, 1]),
              0.25
          ))
      )).toBeLessThan(0.0005);
    }

    // test attack conditions
    const englishClosestApproachToColony = VoronoiGraph.angularDistance(
        englishMerchantShip.position.rotateVector([0, 0, 1]),
        closestEnglishPlanet.planet.position.rotateVector([0, 0, 1]),
        app.worldScale
    );
    if (englishClosestApproachToColony < englishMerchantShipClosestApproach) {
      englishMerchantShipClosestApproach = englishClosestApproachToColony;
    }
    const dutchClosestApproachToColony = VoronoiGraph.angularDistance(
        dutchPirateShip.position.rotateVector([0, 0, 1]),
        DelaunayGraph.normalize(App.lerp(
            closestEnglishPlanet.planet.position.rotateVector([0, 0, 1]),
            englishHomeWorld.position.rotateVector([0, 0, 1]),
            0.25
        )),
        app.worldScale
    );
    if (dutchClosestApproachToColony < dutchPirateShipClosestApproach) {
      dutchPirateShipClosestApproach = dutchClosestApproachToColony;
    }
    if (!dutchPirateShipBegunAttacking && dutchPirateShip.fireControl.isAttacking) {
      dutchPirateShipBegunAttacking = true;
    }
    if (!englishMerchantShipDestroyed && englishMerchantShip.health <= 0) {
      englishMerchantShipDestroyed = true;
    }
    if (!dutchPiratePickUpCargo && dutchPirateShip.hasPirateCargo()) {
      dutchPiratePickUpCargo = true;
    }

    // test end mission conditions
    if (!returningToHomeWorldWithLoot && returnToHomeWorldSpy && returnToHomeWorldSpy.callCount === 1) {
      returningToHomeWorldWithLoot = true;
    }
    if (!endingPirateContract && beginPirateMissionSpy && beginPirateMissionSpy.callCount === 2) {
      endingPirateContract = true;
      break;
    }
  }

  // expect both ships to complete it's mission.
  expect(englishBegunTrading).toBeTruthy();
  expect(dutchBegunPirating).toBeTruthy();
  expect(beginningPiracyMission).toBeTruthy();
  expect(goingToEnemyColonyToPirate).toBeTruthy();
  expect(englishMerchantShipClosestApproach).toBeLessThan(App.VELOCITY_STEP * 400 * app.worldScale);
  expect(dutchPirateShipClosestApproach).toBeLessThan(App.PROJECTILE_DETECTION_RANGE);
  expect(dutchPirateShipBegunAttacking).toBeTruthy();
  expect(englishMerchantShipDestroyed).toBeTruthy();
  expect(dutchPiratePickUpCargo).toBeTruthy();
  expect(returningToHomeWorldWithLoot).toBeTruthy();
  expect(endingPirateContract).toBeTruthy();
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
  describe('test settling and trading',  () => {
    for (let test = 0; test < 10; test++) {
      it(`test settling and trading with random data ${test}`, () => {
        setupTradingTest(60);
      });
    }
  });
  describe('test piracy missions',  () => {
    for (let test = 0; test < 10; test++) {
      it(`test piracy missions with random data ${test}`, () => {
        setupPiracyTest(60);
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
