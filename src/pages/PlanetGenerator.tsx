import React, {useCallback, useEffect, useRef, useState} from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {Button, Card, CardContent, CardHeader, Container, Grid, Paper, Typography} from "@mui/material";
// @ts-ignore
import {generatePlanetGltf} from "@pickledeggs123/globular-marauders-generator/dist/helpers";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import * as PIXI from "pixi.js";
import {BLEND_MODES} from "pixi.js";
import Quaternion from "quaternion";

interface IGameSpawnPoint {
    point: [number, number, number];
}

interface IGameBuilding {
    type: "PORT" | "HOUSE" | "TEMPLE";
    point: [number, number, number];
    lookAt: [number, number, number];
}

const PLANET_SIZE = 100;

export const PlanetGenerator = () => {
    const [context] = useState<{ app: PIXI.Application | null, preview: IGameMesh | null, gameData: IGameMesh[] } | null>({ app: null, preview: null, gameData: [] });
    const [clientSecret] = useState(Math.random().toString(36).substring(2, 9));
    const [loadMessage, setLoadMessage] = useState<string>("No data loaded...");
    const ref = useRef<HTMLDivElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const drawGraph = useCallback(() => {
        // @ts-ignore
        if (global.use_ssr || !context) {
            return;
        }

        setLoadMessage("No data loaded...");
        const handlePixiRender = (data: IGameMesh[]) => {
            const app = context.app as PIXI.Application;

            const meshesToSendToPixi: PIXI.Mesh<PIXI.Shader>[] = [];
            for (const d of data) {
                if (d.navmesh || d.oceanNavmesh) {
                    continue;
                }

                const planetGeometry = new PIXI.Geometry();
                for (const attribute of d.attributes) {
                    planetGeometry.addAttribute(attribute.id, attribute.buffer, attribute.size);
                }
                planetGeometry.addIndex(new Uint32Array(d.index));

                if (d.ocean) {
                    const planetVertexShader = `
                        precision mediump float;
            
                        attribute vec3 aPosition;
                        
                        uniform mat4 uRotation;
            
                        void main() {
                            gl_Position = uRotation * vec4(aPosition * 0.86, 1.0);
                        }
                    `;
                    const planetFragmentShader = `
                        precision mediump float;
            
                        void main() {
                            gl_FragColor = vec4(0.3, 0.3, 1.0, 0.8);
                        }
                    `;
                    const planetProgram = new PIXI.Program(planetVertexShader, planetFragmentShader);

                    const shader = new PIXI.Shader(planetProgram, {
                        uRotation: Quaternion.ONE.toMatrix4()
                    });
                    const state = PIXI.State.for2d();
                    state.depthTest = true;
                    state.culling = false;
                    state.blend = true;
                    state.blendMode = BLEND_MODES.NORMAL;
                    const mesh = new PIXI.Mesh(planetGeometry, shader, state);
                    meshesToSendToPixi.push(mesh);
                } else {
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
            
                            gl_Position = uRotation * vec4(aPosition * 0.86, 1.0);
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
                    state.culling = false;
                    const mesh = new PIXI.Mesh(planetGeometry, shader, state);
                    meshesToSendToPixi.push(mesh);
                }
            }

            app.stage.children.forEach(x => {
                app.stage.removeChild(x);
            });
            for (const mesh of meshesToSendToPixi) {
                app.stage.addChild(mesh as unknown as any);
            }
        };
        const handleData = (inputData: {meshes: IGameMesh[], spawnPoints: IGameSpawnPoint[], buildings: IGameBuilding[]}, {roomId}: {roomId: string}) => {
            const {
                meshes,
                spawnPoints,
                buildings,
            } = inputData;
            const data: IGameMesh[] = meshes;
            setLoadMessage("Data Loaded");
            context.gameData = data;
            const data2: IGameMesh[] = data.map((d: IGameMesh) => ({
                ...d,
                attributes: [{
                    ...d.attributes.find(x => x.id === "aPosition")!,
                    buffer: [...d.attributes.find(x => x.id === "aPosition")!.buffer.map(x => x * PLANET_SIZE)],
                }, ...d.attributes.filter(x => x.id !== "aPosition"),
                ]
            } as IGameMesh));
            Promise.all<Uint8Array | string>([
                ...data2.map(m => generatePlanetGltf(m, m.ocean, m.navmesh || m.oceanNavmesh)),
                "/meshes/CannonBall.glb",
                "/meshes/GoldCoin.glb",
                "/meshes/ships/sloop.glb",
                "/meshes/WoodenArrow2.glb",
                "/meshes/MaleAnatomy.glb",
                "/meshes/Port1-0.glb",
                "/meshes/Port1-1.glb",
                "/meshes/Port1-2.glb",
                "/meshes/golden+worier+glb+black+dull+gold.glb",
                "/meshes/House1-0.glb",
                "/meshes/House1-1.glb",
                "/meshes/House1-2.glb",
                "/meshes/Temple1-0.glb",
                "/meshes/Temple1-1.glb",
                "/meshes/Temple1-2.glb"
            ]).then((gltf) => {
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
                const worldMeshes: [string, boolean, boolean, boolean, boolean, [number, number, number]][] = [];
                for (let i = 0; i < gltf.length - 15; i++) {
                    const dataUri1 = `data:application/octet-stream;base64,${Uint8ToBase64(gltf[i] as Uint8Array)}`;
                    worldMeshes.push([dataUri1, data2[i].collidable, data2[i].navmesh, data2[i].ocean, data2[i].oceanNavmesh, data2[i].vertex] as [string, boolean, boolean, boolean, boolean, [number, number, number]]);
                }
                if (iframeRef.current) {
                    // @ts-ignore
                    iframeRef.current.contentWindow.clearTerrain();
                    worldMeshes.forEach(w => {
                        // @ts-ignore
                        iframeRef.current.contentWindow.addTerrain(JSON.stringify(w));
                    });
                }

                const dataUri2 = gltf[gltf.length - 13];
                if (iframeRef.current && spawnPoints[0]) {
                    const spawnPoint = spawnPoints[0];
                    const {
                        point,
                    } = spawnPoint;
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "SHIP", data: dataUri2}));
                    // @ts-ignore
                    iframeRef.current.contentWindow.addShip(JSON.stringify({data: dataUri2, point: point.map(x => x * PLANET_SIZE)}));
                }

                const dataUri314 = gltf[gltf.length - 15];
                const dataUri313 = gltf[gltf.length - 14];
                const dataUri312 = gltf[gltf.length - 12];
                const dataUri311 = gltf[gltf.length - 11];
                const dataUri3 = gltf[gltf.length - 10];
                const dataUri39 = gltf[gltf.length - 9];
                const dataUri38 = gltf[gltf.length - 8];
                const houseArray = [];
                if (iframeRef.current && buildings.length) {
                    for (const spawnPoint of buildings) {
                        const {
                            point,
                            lookAt,
                        } = spawnPoint;
                        if (spawnPoint.type === "PORT") {
                            houseArray.push(JSON.stringify({type: "PORT", point: point.map(x => x * PLANET_SIZE), lookAt: lookAt.map(x => x * PLANET_SIZE)}));
                        } else if (spawnPoint.type === "HOUSE") {
                            houseArray.push(JSON.stringify({type: "HOUSE", point: point.map(x => x * PLANET_SIZE), lookAt: lookAt.map(x => x * PLANET_SIZE)}));
                        } else if (spawnPoint.type === "TEMPLE") {
                            houseArray.push(JSON.stringify({type: "TEMPLE", point: point.map(x => x * PLANET_SIZE), lookAt: lookAt.map(x => x * PLANET_SIZE)}));
                        }
                    }
                }

                const dataUri4 = gltf[gltf.length - 7];
                if (iframeRef.current) {
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "WARRIOR", data: dataUri4}));
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "PERSON", data: dataUri311}));
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "ARROW", data: dataUri312}));
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "GOLD_COIN", data: dataUri313}));
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "CANNONBALL", data: dataUri314}));
                }

                const dataUri5 = gltf[gltf.length - 6];
                const dataUri6 = gltf[gltf.length - 5];
                const dataUri7 = gltf[gltf.length - 4];
                const dataUri8 = gltf[gltf.length - 3];
                const dataUri9 = gltf[gltf.length - 2];
                const dataUri10 = gltf[gltf.length - 1];
                if (iframeRef.current) {
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "PORT", data: [dataUri3, dataUri39, dataUri38].join("|")}));
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "HOUSE", data: [dataUri5, dataUri6, dataUri7].join("|")}));
                    // @ts-ignore
                    iframeRef.current.contentWindow.addCharacterModel(JSON.stringify({type: "TEMPLE", data: [dataUri8, dataUri9, dataUri10].join("|")}));
                    for (const house of houseArray) {
                        // @ts-ignore
                        iframeRef.current.contentWindow.addHouse(house);
                    }
                }

                // load client secret for connection purposes
                if (iframeRef.current) {
                    // @ts-ignore
                    iframeRef.current.contentWindow.addClientSecret(JSON.stringify({roomId, clientSecret}));
                }
            });

            handlePixiRender(data);
        }

        (async () => {
            // get room which contains map
            const roomResponse = await fetch(`/api/room/${clientSecret}`);
            const roomJson = await roomResponse.json();
            let roomId = null;
            if (roomJson) {
                const {
                    id
                } = roomJson;
                roomId = id;
            }

            // get map
            let planetJson;
            if (roomId) {
                const planetResponse = await fetch(`/api/planet/${roomId}`);
                planetJson = await planetResponse.json();
            } else {
                const planetResponse = await fetch("/api/planet");
                planetJson = await planetResponse.json();
            }

            // parse map data
            if (planetJson) {
                const {
                    previewUrl,
                    gameUrl,
                } = planetJson;
                const [previewResponse, gameResponse] = await Promise.all([fetch(previewUrl), fetch(gameUrl)]);
                const previewJson = await previewResponse.json();
                const gameJson = await gameResponse.json();

                context.preview = previewJson as IGameMesh;
                handleData(gameJson as {meshes: IGameMesh[], spawnPoints: IGameSpawnPoint[], buildings: IGameBuilding[]}, {roomId});
            }
        })();
    }, [context]);
    useEffect(() => {
        // @ts-ignore
        if (global.use_ssr || !context) {
            return;
        }
        if (context.app) {
            context.app.destroy(true);
        }
        const animation = () => {
            context.app!.stage.children.forEach((c: any) => {
                const mesh = c as PIXI.Mesh;
                if (mesh?.shader?.uniforms?.uRotation) {
                    mesh.shader.uniforms.uRotation = Quaternion.fromAxisAngle([0, 1, 0], Math.PI * 2 / 100 * (+new Date() % (10 * 1000) / 100)).toMatrix4();
                }
            });
        };
        const curRef = ref.current;
        if (ref.current) {
            context.app = new PIXI.Application({ width : 256, height: 256, backgroundColor: 0x000000 });
            // @ts-ignore
            ref.current.appendChild(context.app.view);
            context.app!.ticker.add(animation);
        }
        drawGraph();
        return () => {
            if (curRef && context.app) {
                context.app.ticker.remove(animation);
            }
        };
    }, [context, drawGraph, ref]);
    const download = async () => {
        const data: IGameMesh = context!.preview!;
        const buffer = await generatePlanetGltf(data);

        const downloadURL = function(data: any, fileName: string) {
            // @ts-ignore
            if (global.use_ssr) {
                return;
            }
            let a;
            a = document.createElement('a') as unknown as HTMLAnchorElement;
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
                                <Typography>Load Status: {loadMessage}</Typography>
                                <div ref={ref} style={{width: 256, height: 256}}>
                                </div>
                                {/* @ts-ignore */}
                                <iframe title="3d game" width={256} height={256} ref={iframeRef} allowfullscreen="yes"
                                        allowvr="yes"
                                        src="/planet-generator-iframe.html"/>
                                <Button onClick={() => {
                                    drawGraph();
                                }}>Refresh</Button>
                                <Button onClick={download}>Download</Button>
                                <Typography variant="body1">
                                    This page allows you to generate a random planet, using the generator package. This
                                    is a
                                    package written by me which computes spherical voronoi tesselation. Voronoi
                                    tesselation
                                    is the drawing of polygons around a bunch of random points so that the area of each
                                    polygon
                                    is closest to that point. It's essentially a map with perfect borders. I color each
                                    tile
                                    blue or green randomly to create mini planets.
                                </Typography>
                                <br/>
                                <Typography variant="body1">
                                    Do not forget to download your custom planet so you can view it in full 3d with the
                                    Windows 10 3D Viewer app.
                                    Go to the Windows Store and download 3D Viewer so you can view the file from all
                                    angles.
                                </Typography>
                                <br/>
                                <Typography variant="body1">
                                    There is a bug where the output of the generator is not valid with part of the
                                    sphere missing.
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
