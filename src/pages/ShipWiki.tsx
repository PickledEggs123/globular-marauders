import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
import '../App.scss';
import {WebsiteDrawer2} from "../Drawer";
import {
    Paper,
    Avatar,
    Button,
    Card,
    CardActionArea,
    CardContent,
    CardHeader,
    Container,
    Grid,
    Typography, CardMedia, Icon
} from "@mui/material";
import {EShipType} from "@pickledeggs123/globular-marauders-game/lib/src/ShipType";
import * as PIXI from "pixi.js";
import Quaternion from "quaternion";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
// @ts-ignore
import {generatePlanetGltf} from "@pickledeggs123/globular-marauders-generator/dist/helpers";
import {Layer, Stage} from "@pixi/layers";
import {DepthOutlineFilter} from "../filters/DepthOutline/DepthOutlineFilter";
import {ShipContext} from "../contextes/ShipContext";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import {CheckBoxOutlineBlank} from "@mui/icons-material";


export const ShipWiki = () => {
    const shipContext = useContext(ShipContext);
    const shipMeshes = new Map<EShipType, IGameMesh>();
    shipMeshes.set(EShipType.CUTTER, shipContext[0]);
    shipMeshes.set(EShipType.SLOOP, shipContext[1]);
    shipMeshes.set(EShipType.CORVETTE, shipContext[2]);
    shipMeshes.set(EShipType.BRIGANTINE, shipContext[3]);
    shipMeshes.set(EShipType.BRIG, shipContext[4]);
    shipMeshes.set(EShipType.FRIGATE, shipContext[5]);
    shipMeshes.set(EShipType.GALLEON, shipContext[6]);

    const shipThumbnails = new Map<EShipType, string>();
    // @ts-ignore
    shipThumbnails.set(EShipType.CUTTER, shipContext[0]?.image);
    // @ts-ignore
    shipThumbnails.set(EShipType.SLOOP, shipContext[1]?.image);
    // @ts-ignore
    shipThumbnails.set(EShipType.CORVETTE, shipContext[2]?.image);
    // @ts-ignore
    shipThumbnails.set(EShipType.BRIGANTINE, shipContext[3]?.image);
    // @ts-ignore
    shipThumbnails.set(EShipType.BRIG, shipContext[4]?.image);
    // @ts-ignore
    shipThumbnails.set(EShipType.FRIGATE, shipContext[5]?.image);
    // @ts-ignore
    shipThumbnails.set(EShipType.GALLEON, shipContext[6]?.image);

    const shipBody = new Map<EShipType, string>();
    shipBody.set(EShipType.CUTTER, "A small fast and cheap ship that all players start with. This ship is equipped with 2 cannons on each side. The lack of fire power will relegate this ship to trade duties, carrying cargo between planets.");
    shipBody.set(EShipType.SLOOP, "A small and fast ship with 4 cannons on each side. This ship can also be seen trading but is able to participate in some invasions as a support ship.");
    shipBody.set(EShipType.CORVETTE, "A small and fast ship with 7 cannons on each side. This ship is the first ship that is able to be a lone pirate ship. It has enough fire power to bring down a cutter within 1 minute.");
    shipBody.set(EShipType.BRIGANTINE, "A medium ship with 9 cannons on each side. This ship makes a great pirate ship and invasion ship. It's slightly slower than a corvette.");
    shipBody.set(EShipType.BRIG, "A medium ship with 12 cannons on each side. It's slightly slower than a brigantine. It has high firepower able to capture a planet during an invasion.");
    shipBody.set(EShipType.FRIGATE, "A medium ship with 14 cannons on each side. It's somewhat slow but has great firepower.");
    shipBody.set(EShipType.GALLEON, "A large ship with 42 cannons on each side. It's primary goal is to transport large stacks of gold through space.");

    const [selectedShipType, setSelectedShipType] = useState<EShipType>(EShipType.CUTTER);
    const [context] = useState<any>({});
    const ref = useRef<HTMLDivElement | null>(null);
    const drawGraph = useCallback(() => {
        const data = shipMeshes.get(selectedShipType);

        const app = context.app as PIXI.Application;
        context.data = data;

        const geometry = new PIXI.Geometry();
        if (data) {

            for (const attribute of data.attributes) {
                geometry.addAttribute(attribute.id, attribute.buffer, attribute.size);
            }
            geometry.addIndex(data.index);
        }

        const vertexShader = `
            precision mediump float;

            attribute vec3 aPosition;
            attribute vec3 aColor;
            attribute vec3 aNormal;
            
            uniform mat4 uRotation;

            varying vec3 vColor;
            varying vec4 vPosition;
            varying vec3 vNormal;

            void main() {
                vColor = aColor;

                float scale = 0.025;
                vPosition = uRotation * vec4(aPosition, 1.0) * vec4(-scale, -scale, -scale, 1.0);
                gl_Position = vPosition;
                vNormal = (uRotation * vec4(aNormal, 1.0)).xyz;
            }
        `;
        const fragmentShader = `
            precision mediump float;

            varying vec3 vColor;
            varying vec4 vPosition;
            varying vec3 vNormal;

            void main() {
                gl_FragColor = vec4(vColor * (0.3 + 0.7 * max(0.0, pow(dot(vec3(0.0, 0.0, 1.0), vNormal), 1.0))), 1.0);
            }
        `;
        const program = new PIXI.Program(vertexShader, fragmentShader);

        const depthFragmentShader = `
            precision mediump float;

            varying vec3 vColor;
            varying vec4 vPosition;

            void main() {
                float z = 1.0;
                gl_FragColor = vec4(z, z, z, 1.0);
            }
        `;
        const depthProgram = new PIXI.Program(vertexShader, depthFragmentShader);

        // create color object
        const shader = new PIXI.Shader(program, {
            uRotation: Quaternion.ONE.toMatrix4()
        });
        const state = PIXI.State.for2d();
        state.depthTest = true;
        const mesh = new PIXI.Mesh(geometry, shader, state);

        // create depth object
        const depthShader = new PIXI.Shader(depthProgram, {
            uRotation: Quaternion.ONE.toMatrix4()
        });
        const depthState = PIXI.State.for2d();
        state.depthTest = true;
        const depthMesh = new PIXI.Mesh(geometry, depthShader, depthState);

        // remove old objects
        app.stage.children.forEach(x => {
            app.stage.removeChild(x);
        });

        // ship color
        const staticStage = new Stage();
        const colorLayer = new Layer();
        colorLayer.useRenderTexture = true;
        colorLayer.getRenderTexture().framebuffer.addDepthTexture();
        staticStage.addChild(colorLayer as unknown as any);

        // ship depth
        const depthLayer = new Layer();
        depthLayer.useRenderTexture = true;
        depthLayer.getRenderTexture().framebuffer.addDepthTexture();
        staticStage.addChild(depthLayer as unknown as any);
        const depthOutlineFilter = new DepthOutlineFilter({
            colorLayer,
            depthLayer,
            state: {
                width: 256,
                height: 256,
            },
            depthOutlineThreshold: 1 / 0.0625,
        } as any, 256, 256);
        app.stage.filters = [depthOutlineFilter as unknown as any];
        app.stage.filterArea = app.screen;

        // add objects
        colorLayer.addChild(mesh as unknown as any);
        depthLayer.addChild(depthMesh as unknown as any);

        // save to context
        context.staticStage = staticStage;
        context.depthOutlineFilter = depthOutlineFilter;
        context.colorLayer = colorLayer;
        context.depthLayer = depthLayer;

    }, [context, selectedShipType]);
    useEffect(() => {
        // @ts-ignore
        if (global.use_ssr) {
            return;
        }
        if (context.app) {
            context.app.destroy(true);
        }
        context.app = new PIXI.Application({width: 256, height: 256, backgroundColor: 0x000000});
        ref.current!.appendChild(context.app.view);
        context.app!.ticker.add(() => {
            context.colorLayer!.children.forEach((c: any) => {
                const mesh = c as PIXI.Mesh;
                if (mesh?.shader?.uniforms?.uRotation) {
                    mesh.shader.uniforms.uRotation = Quaternion.fromAxisAngle([0, 1, 0], Math.PI * 2 / 100 * (+new Date() % (10 * 1000) / 100)).toMatrix4();
                }
            });
            context.depthLayer!.children.forEach((c: any) => {
                const mesh = c as PIXI.Mesh;
                if (mesh?.shader?.uniforms?.uRotation) {
                    mesh.shader.uniforms.uRotation = Quaternion.fromAxisAngle([0, 1, 0], Math.PI * 2 / 100 * (+new Date() % (10 * 1000) / 100)).toMatrix4();
                }
            });

            // render ship depth buffer
            context.app.renderer.render(context.staticStage);
            context.depthOutlineFilter.updateDepth();
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
        downloadBlob(new Blob([buffer]), `${selectedShipType}.glb`, "application/octet-stream");
    };

    return (
        <Paper style={{width: "100%", minHeight: "100vh", height: "fit-content", display: "flex", flexDirection: "column"}}>
            <WebsiteDrawer2 rightSide={null} content={
                <Container>
                    <Typography variant="h3">
                        3D Ship Meshes
                    </Typography>
                    <Grid container spacing={2} columns={{
                        xs: 4,
                        lg: 12
                    }}>
                        <Grid item xs={12}>
                            <Card>
                                <CardHeader title={`${selectedShipType} Render`} subheader="Preview and Download a Ship">
                                </CardHeader>
                                <CardContent>
                                    <div ref={ref}>
                                    </div>
                                    <Button variant="contained" onClick={download}>Download</Button>
                                    <Typography variant="body1">
                                        {shipBody.get(selectedShipType) ?? undefined}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="h3">
                                Available Ships
                            </Typography>
                        </Grid>
                        {
                            Object.values(EShipType).map(shipType => {
                                return (
                                    <Grid item xs={4}>
                                        <Card>
                                            <CardActionArea onClick={() => {
                                                setSelectedShipType(shipType);
                                            }}>
                                                <CardMedia component="img" alt={shipType} src={shipThumbnails.get(shipType) ?? undefined}>
                                                </CardMedia>
                                                <CardHeader title={shipType}>
                                                </CardHeader>
                                                <CardContent>
                                                    {shipType === selectedShipType ? <CheckBoxIcon/> : <CheckBoxOutlineBlank/>}
                                                    <Typography variant="body1">
                                                        {shipBody.get(shipType) ?? undefined}
                                                    </Typography>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                );
                            })
                        }
                    </Grid>
                </Container>
            }/>
        </Paper>
    );
}
