import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import Quaternion from "quaternion";
import {Game} from "@pickledeggs123/globular-marauders-game/lib/src/Game";
import {DelaunayGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// const canvas: HTMLCanvasElement = document.createElement('canvas');
// canvas.width = 1024;
// canvas.height = 1024;
// document.getElementById('root')!.appendChild(canvas);
// const ctx = canvas.getContext('2d')!;
// for (let x = 0; x < canvas.width; x++) {
//     for (let y = 0; y < canvas.height; y++) {
//         const coordinate = {
//             x: (x / canvas.width * 2) - 1,
//             y: -((y / canvas.height * 2) - 1)
//         };
//         const distance = Math.sqrt(coordinate.x ** 2 + coordinate.y ** 2);
//         const polarCoordinate = {
//             angle: Math.atan2(coordinate.y, coordinate.x),
//             radius: distance * Math.PI
//         };
//         if (distance < 1) {
//             if (Math.abs(polarCoordinate.radius - Math.PI / 2) < 0.01) {
//                 ctx.fillStyle = `rgb(255,255,255)`;
//                 ctx.fillRect(x, y, 1, 1);
//             } else if (Math.abs(polarCoordinate.radius) < 0.01) {
//                 ctx.fillStyle = `rgb(255,255,255)`;
//                 ctx.fillRect(x, y, 1, 1);
//             } else {
//                 const p = Quaternion.fromAxisAngle([0, 0, 1], polarCoordinate.angle).mul(Quaternion.fromAxisAngle([0, 1, 0], polarCoordinate.radius));
//                 const q = Quaternion.fromBetweenVectors([0, 0, 1], [0, 1, 0]).pow(1 / 3);
//                 const point = DelaunayGraph.subtract(p.mul(q).rotateVector([0, 0, 1]), p.rotateVector([0, 0, 1]));
//                 ctx.fillStyle = `rgb(${((point[0] + 1) / 2) * 255},${((point[1] + 1) / 2) * 255},${((point[2] + 1) / 2) * 255})`;
//                 ctx.fillRect(x, y, 1, 1);
//             }
//         }
//     }
// }
// {
//     let position = new Quaternion(0, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
//     position = position.normalize();
//     const randomAngle = Math.random() * Math.PI * 2;
//     const positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [Math.cos(randomAngle), Math.sin(randomAngle), 0]).pow(1 / 250);
//     for (let step = 0; step < 1000; step++) {
//         const point = position.rotateVector([0, 0, 1]);
//         const polarCoordinate = {
//             angle: Math.atan2(point[1], point[0]),
//             radius: Math.acos(point[2])
//         };
//         const coordinate = {
//             x: Math.cos(polarCoordinate.angle) * polarCoordinate.radius / Math.PI,
//             y: Math.sin(polarCoordinate.angle) * polarCoordinate.radius / Math.PI
//         };
//         const x = Math.floor(canvas.width * ((coordinate.x + 1) / 2));
//         const y = Math.floor(canvas.height * ((coordinate.y + 1) / 2));
//         ctx.fillStyle = `rgb(255,255,255)`;
//         ctx.fillRect(x, y, 3, 3);
//         position = position.mul(positionVelocity);
//     }
// }
//
// const description = document.createElement("p")!;
// description.innerText = "This chart shows the great circle arcs across a sphere but mapped onto a pizza pie chart. Notice" +
//     " that the forward direction follows the curve of the circle. Follow the curve with your finger and the direction of" +
//     " the curve should also be the same direction. What's strange is how the curve bends and warps but the video game should" +
//     " render that bendy curve as the same direction. We need to figure out how the direction of the curve changes relative to" +
//     " the x y flat plane the game is projected onto. For example: notice how the middle of the chart is a straight line with very" +
//     " little change in direction, that will result in the north pole having a small change in direction. The edge has a large" +
//     " change of direction, that will result in the south pole having a large change in direction. I think the game renders" +
//     " sprites in x y flat plane which contains the projection of a sphere, this is the source of the error. The AI and" +
//     " physics works correctly so the root cause of the rotation bug is the projection. Projecting position works fine, Projecting" +
//     " rotation does not. This is the most difficult part to make this game work, once this is solved, it's a matter of adding content.";
// document.getElementById('root')!.appendChild(description);
//
// const possibleSolution = document.createElement("p")!;
// possibleSolution.innerText = "If we add the rotation/angular/orientation gradient/derivative to the angle, we might approximate" +
//     " the rotation bug, this would require storing two positions. The two positions are projected onto this pizza pie chart and" +
//     " the angle between the two points are computed. This correction value is then added to the angle.";
// document.getElementById('root')!.appendChild(possibleSolution);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
