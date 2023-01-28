import React, {useEffect, useState} from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {Button, Card, CardContent, CardHeader, Container, Grid, Typography} from "@mui/material";
import {DelaunayGraph, VoronoiGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import Quaternion from "quaternion";

interface IThetaTableData {
    thetaNorth: number;
    deltaNorth: number;
    southPoleDistance: number;
    thetaSouth: number;
    deltaSouth: number;
    theta2: number;
    delta2: number;
}

export const GameModel = () => {
    const [thetaTable, setThetaTable] = useState<IThetaTableData[]>([]);

    const drawGraph = () => {
        const getPoints = () => {
            const pointsNorth: Array<{x: number, y: number}> = [];
            const pointsSouth: Array<{x: number, y: number}> = [];

            let position = new Quaternion(0, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
            position = position.normalize();
            const randomAngle = Math.random() * Math.PI * 2;
            const positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [Math.cos(randomAngle), Math.sin(randomAngle), 0]).pow(1 / 10);
            for (let step = 0; step < 40; step++) {
                const point = position.rotateVector([0, 0, 1]);
                const polarCoordinateNorth = {
                    angle: Math.atan2(point[1], point[0]),
                    radius: Math.acos(point[2])
                };
                const polarCoordinateSouth = {
                    radius: Math.PI - Math.acos(point[2])
                }
                const coordinateNorth = {
                    x: Math.cos(polarCoordinateNorth.angle) * polarCoordinateNorth.radius / Math.PI,
                    y: Math.sin(polarCoordinateNorth.angle) * polarCoordinateNorth.radius / Math.PI
                };
                const coordinateSouth = {
                    x: -Math.cos(polarCoordinateNorth.angle) * polarCoordinateSouth.radius / Math.PI,
                    y: -Math.sin(polarCoordinateNorth.angle) * polarCoordinateSouth.radius / Math.PI
                }
                pointsNorth.push(coordinateNorth);
                pointsSouth.push(coordinateSouth);

                position = position.mul(positionVelocity);
            }

            return {
                pointsNorth,
                pointsSouth
            };
        };

        const points = getPoints();

        const drawCanvas = (id: string, points: Array<{x: number, y: number}>) => {
            const canvas = document.getElementById(id)! as HTMLCanvasElement;
            const ctx = canvas.getContext('2d')!;
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const setWhitePixel = (x: number, y: number) => {
                image.data[(x + y * image.width) * 4] = 255;
                image.data[(x + y * image.width) * 4 + 1] = 255;
                image.data[(x + y * image.width) * 4 + 2] = 255;
                image.data[(x + y * image.width) * 4 + 3] = 255;
            };

            // draw base graph
            for (let x = 0; x < image.width; x++) {
                for (let y = 0; y < image.height; y++) {
                    const coordinate = {
                        x: (x / image.width * 2) - 1,
                        y: -((y / image.height * 2) - 1)
                    };
                    const distance = Math.sqrt(coordinate.x ** 2 + coordinate.y ** 2);
                    const polarCoordinate = {
                        angle: Math.atan2(coordinate.y, coordinate.x),
                        radius: distance * Math.PI
                    };
                    if (distance < 1) {
                        if (Math.abs(polarCoordinate.radius - Math.PI / 2) < 0.01) {
                            // equator
                            setWhitePixel(x, y);
                        } else if (Math.abs(polarCoordinate.radius) < 0.01) {
                            // North Pole
                            setWhitePixel(x, y);
                        } else {
                            // special color gradient
                            const p = Quaternion.fromAxisAngle([0, 0, 1], polarCoordinate.angle).mul(Quaternion.fromAxisAngle([0, 1, 0], polarCoordinate.radius));
                            const q = Quaternion.fromBetweenVectors([0, 0, 1], [0, 1, 0]).pow(1 / 3);
                            const point = DelaunayGraph.subtract(p.mul(q).rotateVector([0, 0, 1]), p.rotateVector([0, 0, 1]));
                            image.data[(x + y * image.width) * 4] = ((point[0] + 1) / 2) * 255;
                            image.data[(x + y * image.width) * 4 + 1] = ((point[1] + 1) / 2) * 255;
                            image.data[(x + y * image.width) * 4 + 2] = ((point[2] + 1) / 2) * 255;
                            image.data[(x + y * image.width) * 4 + 3] = 255;
                        }
                    }
                }
            }

            // draw data
            for (const coordinate of points) {
                const x = Math.floor(canvas.width * ((coordinate.x + 1) / 2));
                const y = Math.floor(canvas.height * ((coordinate.y + 1) / 2));

                setWhitePixel(x, y);
            }
            ctx.putImageData(image, 0, 0, 0, 0, image.width, image.height);
        };
        drawCanvas("canvasNorth", points.pointsNorth);
        drawCanvas("canvasSouth", points.pointsSouth);

        // compute theta table
        const r2d = (x: number) => x / Math.PI * 180;
        const d2r = (x: number) => x / 180 * Math.PI;
        const thetaValues: IThetaTableData[] = [];
        for (let i = 0; i < points.pointsNorth.length; i++) {
            const aN = points.pointsNorth[i];
            const bN = points.pointsNorth[(i + 1) % points.pointsNorth.length];
            const aS = points.pointsSouth[i];
            const bS = points.pointsSouth[(i + 1) % points.pointsSouth.length];
            const thetaN = Math.atan2(bN.y - aN.y, bN.x - aN.x);
            const thetaS = VoronoiGraph.angularDistance([1, 0, 0], Quaternion.fromAxisAngle([0, 0, 1], Math.atan2(bS.y - aS.y, bS.x - aS.x)).rotateVector([1, 0, 0]), 1);
            const thetaNorth = r2d(thetaN);
            const thetaSouth = r2d(thetaS);
            const theta2 = Math.sqrt(aN.x ** 2 + aN.y ** 2) < 0.5 ? thetaNorth : thetaSouth;
            thetaValues.push({
                thetaNorth,
                deltaNorth: 0,
                thetaSouth,
                deltaSouth: 0,
                theta2,
                delta2: 0,
                southPoleDistance: 0
            });
        }
        for (let i = 0; i < points.pointsSouth.length; i++) {
            const a = points.pointsSouth[i];
            const t = thetaValues[i];
            t.southPoleDistance = Math.sqrt(a.x ** 2 + a.y ** 2);
        }
        for (let i = 0; i < thetaValues.length; i++) {
            const a = thetaValues[i];
            const b = thetaValues[(i + 1) % thetaValues.length];
            a.deltaNorth = r2d(VoronoiGraph.angularDistance(Quaternion.fromAxisAngle([0, 0, 1], d2r(b.thetaNorth)).rotateVector([1, 0, 0]), Quaternion.fromAxisAngle([0, 0, 1], d2r(a.thetaNorth)).rotateVector([1, 0, 0]), 1));
            a.deltaSouth = r2d(VoronoiGraph.angularDistance(Quaternion.fromAxisAngle([0, 0, 1], d2r(b.thetaSouth)).rotateVector([1, 0, 0]), Quaternion.fromAxisAngle([0, 0, 1], d2r(a.thetaSouth)).rotateVector([1, 0, 0]), 1));
            a.delta2 = r2d(VoronoiGraph.angularDistance(Quaternion.fromAxisAngle([0, 0, 1], d2r(b.theta2)).rotateVector([1, 0, 0]), Quaternion.fromAxisAngle([0, 0, 1], d2r(a.theta2)).rotateVector([1, 0, 0]), 1));
        }
        setThetaTable(thetaValues);
    };
    useEffect(() => {
        drawGraph();
    }, []);
    
    return (
        <div className="App">
            <WebsiteDrawer rightSide={null}/>
            <Container>
                <Typography variant="h3">
                    The Math of the Game
                </Typography>
                <Grid container xs={12} spacing={2}>
                    <Grid item xs={12}>
                        <Card>
                            <CardHeader title="Straight Lines Along a Sphere" subheader="Flatten a pizza pie onto a beach ball"></CardHeader>
                            <CardContent>
                                <Grid container xs={12} spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="h6">North Polar Chart</Typography>
                                        <canvas id="canvasNorth" width={256} height={256}></canvas>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="h6">South Polar Chart</Typography>
                                        <canvas id="canvasSouth" width={256} height={256}></canvas>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="h6">Theta Correction Chart</Typography>
                                        <table>
                                            <tr>
                                                <th>Step</th>
                                                <th>South Pole Distance</th>
                                                <th>Theta Correction v1</th>
                                                <th>Theta Change v1</th>
                                                <th>Theta Correction v2</th>
                                                <th>Theta Change v2</th>
                                            </tr>
                                            {
                                                thetaTable.map(({thetaNorth, deltaNorth, southPoleDistance, theta2, delta2}, i) => (
                                                    <tr style={{color: delta2 > 360 / 20 ? "red" : undefined, fontWeight: southPoleDistance < 0.1 ? "bold" : undefined}}>
                                                        <td>{i}</td>
                                                        <td>{southPoleDistance}</td>
                                                        <td>{thetaNorth}</td>
                                                        <td>{deltaNorth}</td>
                                                        <td>{theta2}</td>
                                                        <td>{delta2}</td>
                                                    </tr>
                                                ))
                                            }
                                        </table>
                                    </Grid>
                                </Grid>
                                <Button onClick={() => {
                                    drawGraph();
                                }}>Refresh</Button>
                                <Typography variant="body1">
                                    This chart shows the great circle arcs across a sphere but mapped onto a pizza pie chart. Notice
                                    that the forward direction follows the curve of the circle. Follow the curve with your finger and the direction of
                                    the curve should also be the same direction. What's strange is how the curve bends and warps but the video game should
                                    render that bendy curve as the same direction. We need to figure out how the direction of the curve changes relative to
                                    the x y flat plane the game is projected onto. For example: notice how the middle of the chart is a straight line with very
                                    little change in direction, that will result in the north pole having a small change in direction. The edge has a large
                                    change of direction, that will result in the south pole having a large change in direction. I think the game renders
                                    sprites in x y flat plane which contains the projection of a sphere, this is the source of the error. The AI and
                                    physics works correctly so the root cause of the rotation bug is the projection. Projecting position works fine, Projecting
                                    rotation does not. This is the most difficult part to make this game work, once this is solved, it's a matter of adding content.
                                </Typography>
                                <br/>
                                <Typography variant="body1">
                                    If we add the rotation/angular/orientation gradient/derivative to the angle, we might approximate
                                    the rotation bug, this would require storing two positions. The two positions are projected onto this pizza pie chart and
                                    the angle between the two points are computed. This correction value is then added to the angle.
                                </Typography>
                                <Typography variant="body1">
                                    Added the Theta Correction Chart to experiment with multiple polar charts to make the transition
                                    between hemispheres more smooth. The original code had an error where when you moved near
                                    the south pole with a polar distance less than 0.1, it would throw values as large as 90 degrees.
                                    That would force the spaceship to rotate 90 degrees side ways when approaching the south pole.
                                    The goal is to avoid hard changes which are shown in red highlight. When you're near the poles, the
                                    table will bold the text.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Container>
        </div>
    );
}
