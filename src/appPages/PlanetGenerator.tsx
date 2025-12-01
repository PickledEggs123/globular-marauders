'use client';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import '../App.scss';
import {WebsiteDrawer2} from "../Drawer";
import {
    Button,
    Card,
    CardContent,
    CardHeader, Checkbox,
    Container,
    Grid,
    Paper,
    Tooltip,
    Typography
} from "@mui/material";
// @ts-ignore
import {generatePlanetGltf} from "@pickledeggs123/globular-marauders-generator/dist/helpers";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import {createStyles, makeStyles} from "@mui/styles";
import {MusicNote, MusicOff} from "@mui/icons-material";

interface IGameSpawnPoint {
    point: [number, number, number];
}

interface IGameBuilding {
    type: "PORT" | "HOUSE" | "TEMPLE";
    point: [number, number, number];
    lookAt: [number, number, number];
}

const PLANET_SIZE = 100;

const useStyles = makeStyles((theme) =>
    createStyles({
        responsiveIframe: {
            width: "100%",
            aspectRatio: "1 / 1",
            border: "none",
            margin: 0,
            padding: 0,
        }
    })
);

export const PlanetGenerator = () => {
    const [context] = useState<{ preview: IGameMesh | null, gameData: IGameMesh[] } | null>({ preview: null, gameData: [] });
    const [playMusic, setPlayMusic] = useState<boolean>(true);
    const [clientSecret] = useState(Math.random().toString(36).substring(2, 9));
    const [loadMessage, setLoadMessage] = useState<string>("No data loaded...");
    const classes = useStyles();
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const drawGraph = useCallback(() => {
        // @ts-ignore
        if (global.use_ssr || !context) {
            return;
        }

        setLoadMessage("No data loaded...");
        const Uint8ToBase64 = (u8Arr: Uint8Array): string => {
            const CHUNK_SIZE = 0x8000;
            let index = 0;
            const length = u8Arr.length;
            let result = '';
            while (index < length) {
                const slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
                result += String.fromCharCode.apply(null, Array.from(slice));
                index += CHUNK_SIZE;
            }
            return btoa(result);
        };

        const addCharacterModel = (iframe: HTMLIFrameElement, type: string, data: string) => {
            // @ts-ignore
            iframe.contentWindow?.addCharacterModel(JSON.stringify({ type, data }));
        };

        const addBuildings = (iframe: HTMLIFrameElement, buildings: IGameBuilding[], dataUris: string[]) => {
            const houseArray = buildings.map(building => {
                const { point, lookAt, type } = building;
                return JSON.stringify({
                    type: type.toUpperCase(),
                    point: point.map(x => x * PLANET_SIZE),
                    lookAt: lookAt.map(x => x * PLANET_SIZE)
                });
            });

            const buildingTypeMap: Record<string, string[]> = {
                PORT: [dataUris[0], dataUris[1], dataUris[2]],
                HOUSE: [dataUris[3], dataUris[4], dataUris[5]],
                TEMPLE: [dataUris[6], dataUris[7], dataUris[8]]
            };

            Object.entries(buildingTypeMap).forEach(([type, uris]) => {
                addCharacterModel(iframe, type, uris.join("|"));
            });

            houseArray.forEach(house => {
                // @ts-ignore
                iframe.contentWindow?.addHouse(house);
            });
        };

        const handleData = async (
            inputData: { meshes: IGameMesh[], spawnPoints: IGameSpawnPoint[], buildings: IGameBuilding[] },
            { roomId }: { roomId: string }
        ) => {
            const { meshes, spawnPoints, buildings } = inputData;
            let data: IGameMesh[] = meshes.map((mesh: IGameMesh) => ({
                ...mesh,
                attributes: mesh.attributes.map(attr =>
                    attr.id === "aPosition"
                        ? { ...attr, buffer: attr.buffer.map(x => x * PLANET_SIZE) }
                        : attr
                )
            }));
            data = data.map((x: IGameMesh): IGameMesh[] => {
                if (x.navmesh) {
                    return [{
                        ...x,
                        attributes: [...x.attributes.filter(x => x.id !== "aNormal")],
                        // @ts-ignore
                        navmesh: true,
                    }, {
                        ...x,
                        // @ts-ignore
                        projected: true,
                        navmesh: false,
                    }];
                } else if (x.oceanNavmesh) {
                    return [{
                        ...x,
                        attributes: [...x.attributes.filter(x => x.id !== "aNormal")],
                        // @ts-ignore
                        oceanNavmesh: true,
                    }];
                } else {
                    return [x];
                }
            }).flat();
            setLoadMessage("Data Loaded");
            context.gameData = data;

            const staticMeshPaths = [
                "/meshes/EpicStore/Fireball/source/Fireball.glb",
                "/meshes/Model_Redo/Warrior/Wizard.glb",
                "/meshes/Model_Redo/indicators/npc indicator/NpcDestination.glb",
                "/meshes/Model_Redo/indicators/ship indicator/ShipDestination.glb",
                "/meshes/Model_Redo/piratesloop/sloop.glb",
                "/meshes/Model_Redo/Ship Wheel/ShipWheel.glb",
                "/meshes/Model_Redo/Cannon_Ball/CannonBall.glb",
                "/meshes/Model_Redo/Gold Coin/GoldCoin.glb",
                "/meshes/ships/sloop.glb",
                "/meshes/Model_Redo/Arrow/Arrow.glb",
                "/meshes/Model_Redo/Villagers/Villager.glb",
                "/meshes/Model_Redo/Port/Port.glb",
                "/meshes/Model_Redo/Port/Port.glb",
                "/meshes/Model_Redo/Port/Port.glb",
                "/meshes/Model_Redo/Warrior/Warrior.glb",
                "/meshes/Model_Redo/House/House.glb",
                "/meshes/Model_Redo/House/House.glb",
                "/meshes/Model_Redo/House/House.glb",
                "/meshes/Model_Redo/Temple/Temple.glb",
                "/meshes/Model_Redo/Temple/Temple.glb",
                "/meshes/Model_Redo/Temple/Temple.glb",
            ];

            const gltf = await Promise.all<Uint8Array | string>([
                ...data.map(m => generatePlanetGltf(m, m.ocean, m.navmesh || m.oceanNavmesh)),
                ...staticMeshPaths
            ]);

            const worldMeshes: [string, boolean?, boolean?, boolean?, boolean?, [number, number, number]?, boolean?][] = [];
            for (let i = 0; i < data.length; i++) {
                const dataUri = `data:application/octet-stream;base64,${Uint8ToBase64(gltf[i] as Uint8Array)}`;
                worldMeshes.push([
                    dataUri,
                    data[i].collidable,
                    data[i].navmesh,
                    data[i].ocean,
                    data[i].oceanNavmesh,
                    // @ts-ignore
                    data[i].vertex,
                    // @ts-ignore
                    data[i].projected,
                ]);
            }

            if (iframeRef.current) {
                const contentWindow = iframeRef.current.contentWindow as IFrameWindow;
                contentWindow?.setDemo(false);
                contentWindow?.clearTerrain();

                worldMeshes.forEach(w => {
                    contentWindow?.addTerrain(JSON.stringify(w));
                });

                const shipDataUri = gltf[gltf.length - 13] as string;
                if (spawnPoints[0]) {
                    const spawnPoint = spawnPoints[0];
                    addCharacterModel(iframeRef.current, "SHIP", shipDataUri);
                    await contentWindow?.addShip(JSON.stringify({
                        data: shipDataUri,
                        point: spawnPoint.point.map(x => x * PLANET_SIZE)
                    }));
                }

                const warriorDataUri = gltf[gltf.length - 7] as string;
                addCharacterModel(iframeRef.current, "FIREBALL", gltf[gltf.length - 21] as string);
                addCharacterModel(iframeRef.current, "WIZARD", gltf[gltf.length - 20] as string);
                addCharacterModel(iframeRef.current, "NPC_DESTINATION", gltf[gltf.length - 19] as string);
                addCharacterModel(iframeRef.current, "SHIP_DESTINATION", gltf[gltf.length - 18] as string);
                addCharacterModel(iframeRef.current, "WARRIOR", warriorDataUri);
                addCharacterModel(iframeRef.current, "PIRATE_SHIP", gltf[gltf.length - 17] as string);
                addCharacterModel(iframeRef.current, "PERSON", gltf[gltf.length - 11] as string);
                addCharacterModel(iframeRef.current, "ARROW", gltf[gltf.length - 12] as string);
                addCharacterModel(iframeRef.current, "GOLD_COIN", gltf[gltf.length - 14] as string);
                addCharacterModel(iframeRef.current, "CANNONBALL", gltf[gltf.length - 15] as string);
                addCharacterModel(iframeRef.current, "HELM", gltf[gltf.length - 16] as string);

                if (buildings.length) {
                    addBuildings(iframeRef.current, buildings, [
                        gltf[gltf.length - 10] as string,
                        gltf[gltf.length - 9] as string,
                        gltf[gltf.length - 8] as string,
                        gltf[gltf.length - 6] as string,
                        gltf[gltf.length - 5] as string,
                        gltf[gltf.length - 4] as string,
                        gltf[gltf.length - 3] as string,
                        gltf[gltf.length - 2] as string,
                        gltf[gltf.length - 1] as string
                    ]);
                }

                if (spawnPoints.length) {
                    for (const spawnPoint of spawnPoints.slice(1)) {
                        contentWindow?.addPirateShipSpawnPoint(JSON.stringify({
                            point: spawnPoint.point.map(x => x * PLANET_SIZE)
                        }));
                    }
                }

                contentWindow?.addClientSecret(JSON.stringify({ roomId, clientSecret }));
            }
        };

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
                await handleData(gameJson as {meshes: IGameMesh[], spawnPoints: IGameSpawnPoint[], buildings: IGameBuilding[]}, {roomId});
            }
        })();
    }, [context]);
    useEffect(() => {
        drawGraph();
    }, []);
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
        <Paper style={{width: "100%", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer2 rightSide={
                <React.Fragment>
                    <Tooltip title="Audio">
                        <Checkbox tabIndex={-1}
                                  checked={playMusic}
                                  onChange={() => {
                                      setPlayMusic(!playMusic);
                                      if (iframeRef.current) {
                                          // @ts-ignore
                                          iframeRef.current.contentWindow.setPlayMusic(!setPlayMusic);
                                      }
                                  }}
                                  icon={<MusicOff/>}
                                  checkedIcon={<MusicNote/>}
                                  color="default" />
                    </Tooltip>
                </React.Fragment>
            } content={
                <Container>
                    <Typography variant="h3">
                        Procedural Planet Generator
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Card>
                                <CardHeader title="Planet Generator" subheader="Create unique random planets"></CardHeader>
                                <CardContent>
                                    <Typography>Load Status: {loadMessage}</Typography>
                                    <Grid container gap={2}>
                                        <Grid item xs={6}>
                                            <Button variant="contained" fullWidth onClick={() => {
                                                drawGraph();
                                            }}>Refresh</Button>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Button variant="contained" fullWidth onClick={download}>Download</Button>
                                        </Grid>
                                    </Grid>
                                    <br/>
                                    {/* @ts-ignore */}
                                    <iframe title="3d game" className={classes.responsiveIframe} ref={iframeRef} allowFullScreen="yes"
                                            allowvr="yes"
                                            src="/iframe-planet-generator.html"/>
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
                                        Included on this page is a video game in the second window. Please use arrow keys or WASD
                                        to move the ship. You can also click on the water to far away from the ship to move the ship.
                                        Click on the cannons to fire cannon balls or use QE keys to aim and fire cannon balls.
                                        Click on land to send a landing party of pirates/knights that will attack villagers for coins.
                                        Coins can be used to purchase additional ships.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            }/>
        </Paper>
    );
}

export default PlanetGenerator;
