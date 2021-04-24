import React from 'react';
import App, {CAPITAL_GOODS, DelaunayGraph, EFaction, EOrderType, OUTPOST_GOODS, PathFinder, Ship} from './App';
import {shallow} from "enzyme";
import Quaternion from "quaternion";
import sinon from 'sinon';

const setupPathingTest = (points: Array<[number, number, number]>, numMinutes: number = 2) => {
  // setup wrapper to run test
  const wrapper = shallow<App>(<App />);
  const app = wrapper.instance();
  app.forceUpdate = () => undefined;

  // setup test ship and nav point
  const testShip = new Ship();
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
  app.beginSpawnShip(homeWorldTradeItem.planet.id);
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
