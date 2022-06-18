import React, {useCallback, useEffect, useRef, useState} from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {Button, Card, CardContent, CardHeader, Container, Grid, Typography} from "@mui/material";
// @ts-ignore
import {generatePlanet, generatePlanetGltf} from "@pickledeggs123/globular-marauders-generator/dist/helpers";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import * as PIXI from "pixi.js";
import Quaternion from "quaternion";

export const PlanetGenerator = () => {
    const [context] = useState<any>({});
    const ref = useRef<HTMLDivElement | null>(null);
    const drawGraph = useCallback(() => {
        const data = generatePlanet();
        const app = context.app as PIXI.Application;
        context.data = data;

        const planetGeometry = new PIXI.Geometry();
        for (const attribute of data.attributes) {
            planetGeometry.addAttribute(attribute.id, attribute.buffer, attribute.size);
        }
        planetGeometry.addIndex(data.index);

        const planetVertexShader = `
            precision mediump float;

            attribute vec3 aPosition;
            attribute vec3 aColor;
            
            uniform mat4 uRotation;

            varying vec3 vColor;

            void main() {
                vColor = aColor;

                gl_Position = uRotation * vec4(aPosition, 1.0);
            }
        `;
        const planetFragmentShader = `
            precision mediump float;

            varying vec3 vColor;

            void main() {
                gl_FragColor = vec4(vColor, 1.0);
            }
        `;
        const planetProgram = new PIXI.Program(planetVertexShader, planetFragmentShader);

        const shader = new PIXI.Shader(planetProgram, {
            uRotation: Quaternion.ONE.toMatrix4()
        });
        const state = PIXI.State.for2d();
        state.depthTest = true;
        const mesh = new PIXI.Mesh(planetGeometry, shader, state);

        app.stage.children.forEach(x => {
            app.stage.removeChild(x);
        });
        app.stage.addChild(mesh);
    }, [context]);
    useEffect(() => {
        context.app = new PIXI.Application({ width : 256, height: 256 });
        ref.current!.appendChild(context.app.view);
        context.app!.ticker.add(() => {
            context.app!.stage.children.forEach((c: any) => {
                const mesh = c as PIXI.Mesh;
                if (mesh?.shader?.uniforms?.uRotation) {
                    mesh.shader.uniforms.uRotation = Quaternion.fromAxisAngle([0, 1, 0], Math.PI * 2 / 100 * (+new Date() % (10 * 1000) / 100)).toMatrix4();
                }
            });
        });
        drawGraph();
        return () => {};
    }, [context, drawGraph, ref]);
    const download = async () => {
        const data: IGameMesh = context.data!;
        const buffer = await generatePlanetGltf(data);

        const downloadURL = function(data: any, fileName: string) {
            let a;
            a = document.createElement('a');
            a.href = data;
            a.download = fileName;
            document.body.appendChild(a);
            a.style.display = 'none';
            a.click();
            a.remove();
        };
        const downloadBlob = function(data: any, fileName: string, mimeType: string) {
            let blob, url: string;
            blob = new Blob([data], {
                type: mimeType
            });
            url = window.URL.createObjectURL(blob);
            downloadURL(url, fileName);
            setTimeout(function() {
                return window.URL.revokeObjectURL(url);
            }, 1000);
        };
        downloadBlob(new Blob([buffer]), "planet.glb", "application/octet-stream");
    };
    
    return (
        <div className="App">
            <WebsiteDrawer rightSide={null}/>
            <Container>
                <Grid container xs={12} spacing={2}>
                    <Grid item xs={12}>
                        <Card>
                            <CardHeader>Planet Generator</CardHeader>
                            <CardContent>
                                <div ref={ref}>
                                </div>
                                <Button onClick={() => {
                                    drawGraph();
                                }}>Refresh</Button>
                                <Button onClick={download}>Download</Button>
                                <Typography variant="body1">
                                    This page allows you to generate a random planet, using the generator package. This is a
                                    package written by me which computes spherical voronoi tesselation. Voronoi tesselation
                                    is the drawing of polygons around a bunch of random points so that the area of each polygon
                                    is closest to that point. It's essentially a map with perfect borders. I color each tile
                                    blue or green randomly to create mini planets.
                                </Typography>
                                <br/>
                                <Typography variant="body1">
                                    Do not forget to download your custom planet so you can view it in full 3d with the Windows 10 3D Viewer app.
                                    Go to the Windows Store and download 3D Viewer so you can view the file from all angles.
                                </Typography>
                                <br/>
                                <Typography variant="body1">
                                    There is a bug where the output of the generator is not valid with part of the sphere missing.
                                    I don't know how to prevent that from happening other than to run the app again.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Container>
        </div>
    );
}
