import React from 'react';
import App, {DelaunayGraph, PathFinder, Ship} from './App';
import {shallow} from "enzyme";
import Quaternion from "quaternion";

const setupTest = (points: Array<[number, number, number]>, numMinutes: number = 2) => {
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

describe('test AI Pathing', () => {
  describe('test pathing from all 360 degrees', () => {
    for (let angle = 0; angle < 360; angle += 5) {
      it(`test pathing form angle ${angle}`, () => {
        setupTest([
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
        setupTest(new Array(10).fill(1).map((): [number, number, number] => DelaunayGraph.normalize([
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        ])), 80);
      });
    }
  });
});
