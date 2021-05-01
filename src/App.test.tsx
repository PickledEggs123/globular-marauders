import React from 'react';
import App, {
  CannonBall,
  CAPITAL_GOODS,
  DelaunayGraph,
  EFaction,
  EOrderType,
  EShipType, IConeHitTest,
  OUTPOST_GOODS,
  PathFinder,
  PHYSICS_SCALE,
  Ship,
  VoronoiGraph
} from './App';
import {shallow} from "enzyme";
import Quaternion from "quaternion";
import sinon from 'sinon';

const setupPathingTest = (points: Array<[number, number, number]>, numMinutes: number = 2) => {
  // setup wrapper to run test
  const wrapper = shallow<App>(<App />);
  const app = wrapper.instance();
  app.forceUpdate = () => undefined;

  // setup test ship and nav point
  const testShip = new Ship(EShipType.HIND);
  testShip.id = "ship-0";
  testShip.position = Quaternion.ONE;
  testShip.orientation = Quaternion.ONE;
  testShip.positionVelocity = Quaternion.ONE;
  testShip.orientationVelocity = Quaternion.ONE;
  testShip.pathFinding = new PathFinder<Ship>(testShip);
  testShip.pathFinding.points = points;
  app.ships = [testShip];
  app.playerShip = testShip;

  // test the ship navigation to nav point
  const numStepsPerSecond = 10;
  const numSecondsPerMinute = 60;
  const numSteps = numStepsPerSecond * numSecondsPerMinute * numMinutes;
  let successfullyReachedDestination = false;
  for (let step = 0; step < numSteps; step++) {
    app.gameLoop.call(app);
    if (testShip.pathFinding.points.length === 0) {
      // ship has successfully reached destination
      successfullyReachedDestination = true;
      break;
    }
  }

  // expect the ship to successfully reached destination
  expect(successfullyReachedDestination).toBeTruthy();
};

const setupTradingTest = (numMinutes: number = 2) => {
  // setup wrapper to run test
  const wrapper = shallow<App>(<App />);
  const app = wrapper.instance();
  app.forceUpdate = () => undefined;

  // setup test ship and nav point
  // select faction
  clearInterval(app.rotateCameraInterval);
  app.rotateCameraInterval = null;
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

  // spawn at home world
  app.beginSpawnShip(homeWorldTradeItem.planet.id, EShipType.HIND);
  wrapper.update();

  if (app.playerShip === null) {
    throw new Error("NULL PLAYER SHIP");
  }
  const testShip = app.playerShip;
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
      if (lastCallCount === 7) {
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
  expect(getOrder.returnValues[0].orderType).toBe(EOrderType.SETTLE);
  expect(getOrder.returnValues[1].orderType).toBe(EOrderType.SETTLE);
  expect(getOrder.returnValues[2].orderType).toBe(EOrderType.SETTLE);
  expect(getOrder.returnValues[3].orderType).toBe(EOrderType.SETTLE);
  expect(getOrder.returnValues[4].orderType).toBe(EOrderType.SETTLE);

  // expect ship to trade with second planet
  expect(getOrder.returnValues[5].orderType).toBe(EOrderType.TRADE);
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
 * Determine the direction to aim at a moving target.
 * @param shipPosition The position of the ship right now.
 * @param shipDirection The direction of the ship right now, will extrapolate a target angle
 * @param projectileSpeed The projectile speed will affect the target angle
 */
const computeConeLineIntersection = (shipPosition: [number, number], shipDirection: [number, number], projectileSpeed: number): IConeHitTest => {
  // line cone intersection equations
  // https://www.geometrictools.com/Documentation/IntersectionLineCone.pdf
  // cone - origin V direction D angle Y
  // line - origin P direction U
  const multiply = (a: number[], b: number[], transpose: boolean = false): number[] => {
    if (a.length === 1 && b.length === 1) {
      return [
        a[0] * b[0]
      ];
    } else if (a.length === 3 && b.length === 9) {
      return [
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        a[0] * b[3] + a[1] * b[4] + a[2] * b[5],
        a[0] * b[6] + a[1] * b[7] + a[2] * b[8]
      ];
    } else if (a.length === 9 && b.length === 3) {
      return [
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        a[3] * b[0] + a[4] * b[1] + a[5] * b[2],
        a[6] * b[0] + a[7] * b[1] + a[8] * b[2]
      ];
    } else if (a.length === 3 && b.length === 3 && !transpose) {
      return [
        a[0] * b[0], a[0] * b[1], a[0] * b[2],
        a[1] * b[0], a[1] * b[1], a[1] * b[2],
        a[2] * b[0], a[2] * b[1], a[2] * b[2]
      ];
    } else if (a.length === 3 && b.length === 3 && transpose) {
      return [
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
      ];
    } else if (a.length === 9 && b.length === 9) {
      return [
        a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
        a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
        a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
        a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
        a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
        a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
        a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
        a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
        a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
      ];
    }
    else if (a.length === 1 && b.length === 9) {
      return [
        a[0] * b[0], a[0] * b[1], a[0] * b[2],
        a[0] * b[3], a[0] * b[4], a[0] * b[5],
        a[0] * b[6], a[0] * b[7], a[0] * b[8]
      ];
    }
    else if (a.length === 1 && b.length === 3) {
      return [
        a[0] * b[0], a[0] * b[1], a[0] * b[2]
      ];
    } else {
      throw new Error("Unknown multiplication values");
    }
  };
  const add = (a: number[], b: number[]): number[] => {
    if (a.length === 3 && b.length === 3) {
      return [
        a[0] + b[0],
        a[1] + b[1],
        a[2] + b[2]
      ];
    } else if (a.length === 1 && b.length === 1) {
      return [
        a[0] + b[0]
      ];
    } else {
      throw new Error("Unknown addition values");
    }
  };
  const subtract = (a: number[], b: number[]): number[] => {
    if (a.length === 9 && b.length === 9) {
      return [
        a[0] - b[0], a[1] - b[1], a[2] - b[2],
        a[3] - b[3], a[4] - b[4], a[5] - b[5],
        a[6] - b[6], a[7] - b[7], a[8] - b[8]
      ];
    } else if (a.length === 1 && b.length === 9) {
      return [
        a[0] - b[0], a[0] - b[1], a[0] - b[2],
        a[0] - b[3], a[0] - b[4], a[0] - b[5],
        a[0] - b[6], a[0] - b[7], a[0] - b[8]
      ];
    } else if (a.length === 3 && b.length === 3) {
      return [
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2]
      ];
    } else if (a.length === 1 && b.length === 3) {
      return [
        a[0] - b[0],
        a[0] - b[1],
        a[0] - b[2]
      ];
    } else if (a.length === 3 && b.length === 1) {
      return [
        a[0] - b[0],
        a[1] - b[0],
        a[2] - b[0]
      ];
    } else if (a.length === 1 && b.length === 1) {
      return [
        a[0] - b[0]
      ];
    } else {
      throw new Error("Unknown subtraction values");
    }
  };

  // ship parameters
  const o = [shipPosition[0], shipPosition[1], 0]; // ship position relative to attacking ship
  const d = [shipDirection[0], shipDirection[1], 1];
  const yVector = [projectileSpeed, 0, 1]; // cone size parameters
  const yLength = Math.sqrt(Math.pow(yVector[0], 2) + Math.pow(yVector[1], 2) + Math.pow(yVector[2], 2));
  const yUnit = [yVector[0] / yLength, yVector[1] / yLength, yVector[2] / yLength];
  const v = [0, 0, 1]; // direction of cone facing upwards, attacking ship is not moving
  const y = multiply(v, yUnit, true)[0]; // angle of cone, speed of projectile

  // quadratic equation constants
  const a = subtract(
      multiply(
          multiply(d, v, true),
          multiply(d, v, true),
      ),
      multiply(
          multiply(d, d, true),
          [Math.pow(y, 2)]
      )
  )[0];
  const b = multiply(
      [2],
      subtract(
          multiply(
              multiply(o, v, true),
              multiply(d, v, true)
          ),
          multiply(
              multiply(o, d, true),
              [Math.pow(y, 2)]
          )
        )
  )[0];
  const c = subtract(
      multiply(
          multiply(o, v, true),
          multiply(o, v, true)
      ),
      multiply(
          multiply(o, o, true),
          [Math.pow(y, 2)]
      )
  )[0];

  // a list of possible time values
  const timeValues: number[] = [];

  // case 1
  if (c !== 0) {
    const root = Math.pow(b, 2) - 4 * a * c;
    if (root < 0) {
      // do nothing, no collision possible
    } else if (root === 0) {
      const t = -b / (2 * a);
      timeValues.push(t);
    } else {
      // the pdf contained the wrong quadratic formula, it's not perfectly correct
      const t1 = (-b - Math.sqrt(root)) / (2 * a);
      const t2 = (-b + Math.sqrt(root)) / (2 * a);
      timeValues.push(t1);
      timeValues.push(t2);
    }
  }

  let tMin: number | null = null;
  for (const t of timeValues) {
    if (t >= 0 && (tMin === null || t < tMin)) {
      tMin = t;
    }
  }
  if (tMin === null) {
    return {
      success: false,
      point: null,
      distance: null,
      time: null
    };
  } else {
    const point = add(o, multiply([tMin], d)) as [number, number, number];
    const distance = Math.sqrt(Math.pow(point[0], 2) + Math.pow(point[1], 2));
    const time = tMin;
    return {
      success: true,
      point: [point[0], point[1]],
      distance,
      time
    };
  }
};

describe.skip('test AI Pathing', () => {
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
  describe.skip('test random points',  () => {
    for (let test = 0; test < 10; test++) {
      it(`test pathing with random data ${test}`, () => {
        setupPathingTest(new Array(10).fill(1).map((): [number, number, number] => DelaunayGraph.normalize([
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        ])), 80);
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
  describe.skip('line segment', () => {
    it('large line segment and big movement', () => {
      const a = DelaunayGraph.normalize([1, 0, 1]);
      const b = DelaunayGraph.normalize([1, 0, -1]);
      const c: [number, number, number] = [0, 1, 0];
      const d: [number, number, number] = [1, 0, 0];
      const intercept = App.computeIntercept(a, b, c, d);
      expect(VoronoiGraph.angularDistance(intercept, [1, 0, 0])).toBeLessThan(PHYSICS_SCALE / 1000);

      const segmentDistance: number = VoronoiGraph.angularDistance(a, b);
      const interceptDistance: number = VoronoiGraph.angularDistance(a, intercept) + VoronoiGraph.angularDistance(intercept, b);
      expect(Math.abs(segmentDistance - interceptDistance)).toBeLessThan(PHYSICS_SCALE / 1000);
    });
    it('large line segment and small movement', () => {
      const a = DelaunayGraph.normalize([1, 0, 1]);
      const b = DelaunayGraph.normalize([1, 0, -1]);
      const c: [number, number, number] = [0, 1, 0];
      const d: [number, number, number] = DelaunayGraph.normalize([PHYSICS_SCALE, 1, 0]);
      const intercept = App.computeIntercept(a, b, c, d);
      expect(VoronoiGraph.angularDistance(intercept, [1, 0, 0])).toBeLessThan(PHYSICS_SCALE / 1000);

      const segmentDistance: number = VoronoiGraph.angularDistance(a, b);
      const interceptDistance: number = VoronoiGraph.angularDistance(a, intercept) + VoronoiGraph.angularDistance(intercept, b);
      expect(Math.abs(segmentDistance - interceptDistance)).toBeLessThan(PHYSICS_SCALE / 1000);
    });
    it('small line segment and small movement', () => {
      const a = DelaunayGraph.normalize([1, 0, 1]);
      const b = DelaunayGraph.normalize([1, 0, 1 - PHYSICS_SCALE]);
      const c: [number, number, number] = [0, 1, 0];
      const d: [number, number, number] = DelaunayGraph.normalize([PHYSICS_SCALE, 1, 0]);
      const intercept = App.computeIntercept(a, b, c, d);
      expect(VoronoiGraph.angularDistance(intercept, [1, 0, 0])).toBeLessThan(PHYSICS_SCALE / 1000);

      const segmentDistance: number = VoronoiGraph.angularDistance(a, b);
      const interceptDistance: number = VoronoiGraph.angularDistance(a, intercept) + VoronoiGraph.angularDistance(intercept, b);
      expect(Math.abs(segmentDistance - interceptDistance)).not.toBeLessThan(PHYSICS_SCALE / 1000);
    });
    it('cannon ball hits ship', () => {
      const ship = new Ship(EShipType.HIND);
      ship.id = "test-ship";
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      cannonBall.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      cannonBall.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [0, -1, 0]);
      const hit = App.cannonBallCollision(cannonBall, ship);
      expect(hit).toEqual({
        success: true,
        point: [-0, 0.0003, 0.009995498987044117],
        distance: 0.7503685782431588,
        time: 0.47769947347294545,
      });
    });
    it('cannon ball misses ship (too slow)', () => {
      const ship = new Ship(EShipType.HIND);
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
      const hit = App.cannonBallCollision(cannonBall, ship);
      expect(hit).toEqual({
        success: false,
        point: null,
        distance: null,
        time: null,
      });
    });
    it('cannon ball misses ship (opposite direction)', () => {
      const ship = new Ship(EShipType.HIND);
      ship.id = "test-ship";
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      cannonBall.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      cannonBall.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [0, 1, 0]);
      const hit = App.cannonBallCollision(cannonBall, ship);
      expect(hit).toEqual({
        success: false,
        point: null,
        distance: null,
        time: null,
      });
    });
    it('cannon ball misses ship (parallel direction)', () => {
      const ship = new Ship(EShipType.HIND);
      ship.id = "test-ship";
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      cannonBall.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      cannonBall.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [1, 0, 0]);
      const hit = App.cannonBallCollision(cannonBall, ship);
      expect(hit).toEqual({
        success: false,
        point: null,
        distance: null,
        time: null,
      });
    });
    it('ship hits still cannon ball', () => {
      const ship = new Ship(EShipType.HIND);
      ship.id = "test-ship";
      ship.position = Quaternion.fromBetweenVectors(
          [0, 0, 1],
          DelaunayGraph.normalize([0, 1 - PHYSICS_SCALE * 10, 1])
      );
      ship.positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [0, -1, 0]);
      const cannonBall = new CannonBall(EFaction.ENGLISH);
      const hit = App.cannonBallCollision(cannonBall, ship);
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
