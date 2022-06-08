import React, {useEffect} from 'react';
import '../App.css';
import {WebsiteDrawer} from "../Drawer";
import {Button, Card, CardContent, CardHeader, Grid, Typography} from "@mui/material";
import {DelaunayGraph} from "@pickledeggs123/globular-marauders-game/lib/src/Graph";
import Quaternion from "quaternion";

export const GameModel = () => {
    const drawGraph = () => {
        const canvas = document.getElementById('canvas')! as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const setWhitePixel = (x: number, y: number) => {
            image.data[(x + y * image.width) * 4] = 255;
            image.data[(x + y * image.width) * 4 + 1] = 255;
            image.data[(x + y * image.width) * 4 + 2] = 255;
            image.data[(x + y * image.width) * 4 + 3] = 255;
        };
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
                        setWhitePixel(x, y);
                    } else if (Math.abs(polarCoordinate.radius) < 0.01) {
                        setWhitePixel(x, y);
                    } else {
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
        {
            let position = new Quaternion(0, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
            position = position.normalize();
            const randomAngle = Math.random() * Math.PI * 2;
            const positionVelocity = Quaternion.fromBetweenVectors([0, 0, 1], [Math.cos(randomAngle), Math.sin(randomAngle), 0]).pow(1 / 250);
            for (let step = 0; step < 1000; step++) {
                const point = position.rotateVector([0, 0, 1]);
                const polarCoordinate = {
                    angle: Math.atan2(point[1], point[0]),
                    radius: Math.acos(point[2])
                };
                const coordinate = {
                    x: Math.cos(polarCoordinate.angle) * polarCoordinate.radius / Math.PI,
                    y: Math.sin(polarCoordinate.angle) * polarCoordinate.radius / Math.PI
                };
                const x = Math.floor(canvas.width * ((coordinate.x + 1) / 2));
                const y = Math.floor(canvas.height * ((coordinate.y + 1) / 2));

                setWhitePixel(x, y);

                position = position.mul(positionVelocity);
            }
        }
        ctx.putImageData(image, 0, 0, 0, 0, image.width, image.height);
    };
    useEffect(() => {
        drawGraph();
    }, []);
    
    return (
        <div className="App">
            <WebsiteDrawer rightSide={null}/>
            <Grid container xs={12} spacing={2}>
                <Grid item xs={12}>
                    <Card>
                        <CardHeader>Straight Lines along a sphere</CardHeader>
                        <CardContent>
                            <Button onClick={() => {
                                drawGraph();
                            }}>Refresh</Button>
                            <canvas id="canvas" width={1024} height={1024}></canvas>
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
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </div>
    );
}
