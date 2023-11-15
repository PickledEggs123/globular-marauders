import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {Paper, Button, Card, CardContent, CardHeader, Container, Grid, Typography} from "@mui/material";
// @ts-ignore
import {generatePlanetGltf} from "@pickledeggs123/globular-marauders-generator/dist/helpers";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import * as PIXI from "pixi.js";
import Quaternion from "quaternion";

let Entity: any = () => null;
let Scene: any = () => null;
let importReady = false;
const importPromise: Promise<void> = new Promise<void>((resolve) => {
    // @ts-ignore
    if (!global.use_ssr) {
        // @ts-ignore
        import("aframe").then(() => {
            // @ts-ignore
            import("aframe-react").then((importData: any) => {
                Entity = importData.Entity;
                Scene = importData.Scene;
            });
        });
    }
    resolve();
});
importPromise.then(() => {
    importReady = true;
});

export const PlanetGenerator = () => {
    const [context, setContext] = useState<any>(null);
    const [worldModelSource, setWorldModelSource] = useState<string>("");
    const ref = useRef<HTMLDivElement | null>(null);
    const worker: Worker | undefined = useMemo(
        // @ts-ignore
        () => !global.use_ssr && Worker ? new Worker(new URL("./planet-generator-worker", import.meta.url)) : undefined,
        []
    );
    useEffect(() => {
        // @ts-ignore
        if (global.use_ssr || !context) {
            return;
        }
        if (worker) {
            worker.onmessage = (e: MessageEvent<{ mesh: IGameMesh, deleteBefore: boolean }>) => {
                const data = e.data.mesh;
                const deleteBefore = e.data.deleteBefore;
                const app = context.app as PIXI.Application;
                context.data = data;
                generatePlanetGltf(data).then((gltf: any) => {
                    const Uint8ToBase64 = (u8Arr: Uint8Array) => {
                        const CHUNK_SIZE = 0x8000; //arbitrary number
                        let index = 0;
                        const length = u8Arr.length;
                        let result = '';
                        let slice: any;
                        while (index < length) {
                            slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
                            result += String.fromCharCode.apply(null, slice);
                            index += CHUNK_SIZE;
                        }
                        return btoa(result);
                    }
                    const dataUri = `data:application/octet-stream;base64,${Uint8ToBase64(gltf)}`;
                    setWorldModelSource(dataUri);
                });

                const planetGeometry = new PIXI.Geometry();
                for (const attribute of data.attributes) {
                    planetGeometry.addAttribute(attribute.id, attribute.buffer, attribute.size);
                }
                planetGeometry.addIndex(data.index);

                const planetVertexShader = `
                    precision mediump float;
        
                    attribute vec3 aPosition;
                    attribute vec3 aColor;
                    attribute vec3 aNormal;
                    
                    uniform mat4 uRotation;
        
                    varying vec3 vColor;
                    varying vec3 vNormal;
        
                    void main() {
                        vColor = aColor;
        
                        gl_Position = uRotation * vec4(aPosition, 1.0);
                        vNormal = (uRotation * vec4(aNormal, 1.0)).xyz;
                    }
                `;
                const planetFragmentShader = `
                    precision mediump float;
        
                    varying vec3 vColor;
                    varying vec3 vNormal;
        
                    void main() {
                        gl_FragColor = vec4(vColor * (0.3 + 0.7 * max(0.0, pow(dot(vec3(0.0, 0.0, -1.0), vNormal), 3.0))), 1.0);
                    }
                `;
                const planetProgram = new PIXI.Program(planetVertexShader, planetFragmentShader);

                const shader = new PIXI.Shader(planetProgram, {
                    uRotation: Quaternion.ONE.toMatrix4()
                });
                const state = PIXI.State.for2d();
                state.depthTest = true;
                const mesh = new PIXI.Mesh(planetGeometry, shader, state);

                if (deleteBefore) {
                    app.stage.children.forEach(x => {
                        app.stage.removeChild(x);
                    });
                }
                app.stage.addChild(mesh as unknown as any);
            }
        }
    }, [worker, context]);
    const drawGraph = useCallback(() => {
        // @ts-ignore
        if (global.use_ssr || !context) {
            return;
        }
        if (window?.Worker && worker) {
            worker.postMessage("init");
        }
    }, [context]);
    useEffect(() => {
        // @ts-ignore
        if (global.use_ssr || !context) {
            return;
        }
        if (context.app) {
            context.app.destroy(true);
        }
        context.app = new PIXI.Application({ width : 256, height: 256, backgroundColor: 0x000000 });
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
            // @ts-ignore
            if (global.use_ssr) {
                return;
            }
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

    if (!importReady) {
        importPromise.then(() => {
            setContext({});
        });
        return null;
    }

    return (
        <Paper style={{width: "100vw", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer rightSide={null}/>
            <Container>
                <Typography variant="h3">
                    Procedural Planet Generator
                </Typography>
                <Grid container xs={12} spacing={2}>
                    <Grid item xs={12}>
                        <Card>
                            <CardHeader title="Planet Generator" subheader="Create unique random planets"></CardHeader>
                            <CardContent>
                                <div ref={ref}>
                                </div>
                                <Scene embedded style={{width: 250, height: 250}}>
                                    <Entity camera look-controls position={{x: 0, y: 0, z: 0}}/>
                                    <Entity gltf-model={worldModelSource} position={{x: 0, y: 0, z: -10}}/>
                                </Scene>
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
        </Paper>
    );
}
