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
        import("aframe-react").then((importData: any) => {
            Entity = importData.Entity;
            Scene = importData.Scene;
        }).then(() => {
            resolve();
        });
    } else {
        resolve();
    }
});
importPromise.then(() => {
    importReady = true;
});

// @ts-ignore
if (!global.use_ssr) {
    AFRAME.registerComponent('orbit-globe', {
        schema: {},
        tick: function () {
            // @ts-ignore
            const trueUp = this.el.sceneEl!.camera.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3()).normalize();
            // @ts-ignore
            const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.el.sceneEl!.camera.getWorldQuaternion(new THREE.Quaternion()));
            // @ts-ignore
            const rotation = new THREE.Quaternion().setFromUnitVectors(currentUp, trueUp);
            this.el.sceneEl!.camera.applyQuaternion(rotation);
        }
    });

    AFRAME.registerComponent('globe-gravity', {
        scheme: {},
        tick: function () {
            const object3D = this.el.object3D;
            // @ts-ignore
            const trueUp = object3D.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(0, -100, 0)).normalize();
            // @ts-ignore
            this.el.body.applyForce(new CANNON.Vec3(-trueUp.x, -trueUp.y, -trueUp.z).vmul(new CANNON.Vec3(9.8, 9.8, 9.8)), new CANNON.Vec3(0, 0, 0));
        }
    });

    const KEYCODE_TO_CODE: { [x: string]: string } = {
        '38': 'ArrowUp',
        '37': 'ArrowLeft',
        '40': 'ArrowDown',
        '39': 'ArrowRight',
        '87': 'KeyW',
        '65': 'KeyA',
        '83': 'KeyS',
        '68': 'KeyD'
    };
    // @ts-ignore
    const bind = AFRAME.utils.bind;
    // @ts-ignore
    const shouldCaptureKeyEvent = AFRAME.utils.shouldCaptureKeyEvent;
    const CLAMP_VELOCITY = 0.00001;
    const MAX_DELTA = 0.2;
    const KEYS = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'
    ];

    AFRAME.registerComponent('globle-keyboard-controls', {
        schema: {
            acceleration: {default: 65},
            enabled: {default: true},
            fly: {default: false},
        },

        init: function () {
            // To keep track of the pressed keys.
            // @ts-ignore
            this.keys = {};
            // @ts-ignore
            this.easing = 1.1;

            // @ts-ignore
            this.velocity = new THREE.Vector3();

            // Bind methods and add event listeners.
            this.onBlur = bind(this.onBlur, this);
            this.onContextMenu = bind(this.onContextMenu, this);
            this.onFocus = bind(this.onFocus, this);
            this.onKeyDown = bind(this.onKeyDown, this);
            this.onKeyUp = bind(this.onKeyUp, this);
            this.onVisibilityChange = bind(this.onVisibilityChange, this);
            this.attachVisibilityEventListeners();
        },

        tick: function (time: number, delta: number) {
            var el = this.el;
            // @ts-ignore
            var velocity = this.velocity;

            if (!velocity.x && !velocity.y && !velocity.z &&
                // @ts-ignore
                isEmptyObject(this.keys)) { return; }

            // Update velocity.
            delta = delta / 1000;
            this.updateVelocity(delta);

            if (!velocity.x && !velocity.y && !velocity.z) { return; }

            // Get movement vector and translate position.
            el.object3D.position.add(this.getMovementVector(delta));
        },

        remove: function () {
            this.removeKeyEventListeners();
            this.removeVisibilityEventListeners();
        },

        play: function () {
            this.attachKeyEventListeners();
        },

        pause: function () {
            // @ts-ignore
            this.keys = {};
            this.removeKeyEventListeners();
        },

        updateVelocity: function (delta: number) {
            var acceleration;
            var data = this.data;
            // @ts-ignore
            var keys = this.keys;
            // @ts-ignore
            var velocity = this.velocity;

            // If FPS too low, reset velocity.
            // @ts-ignore
            if (delta > MAX_DELTA) {
                velocity.x = 0;
                velocity.y = 0;
                velocity.z = 0;
                return;
            }

            // https://gamedev.stackexchange.com/questions/151383/frame-rate-independant-movement-with-acceleration
            // @ts-ignore
            var scaledEasing = Math.pow(1 / this.easing, delta * 60);
            // Velocity Easing.
            if (velocity.x !== 0) {
                velocity.x = velocity.x * scaledEasing;
            }
            if (velocity.z !== 0) {
                velocity.z = velocity.z * scaledEasing;
            }

            // Clamp velocity easing.
            if (Math.abs(velocity.x) < CLAMP_VELOCITY) { velocity.x = 0; }
            if (Math.abs(velocity.z) < CLAMP_VELOCITY) { velocity.z = 0; }

            if (!data.enabled) { return; }

            // Update velocity using keys pressed.
            acceleration = data.acceleration;
            if (keys.KeyA || keys.ArrowLeft) { velocity.x -= acceleration * delta; }
            if (keys.KeyD || keys.ArrowRight) { velocity.x += acceleration * delta; }
            if (keys.KeyW || keys.ArrowUp) { velocity.z -= acceleration * delta; }
            if (keys.KeyS || keys.ArrowDown) { velocity.z += acceleration * delta; }
        },

        getMovementVector: (function () {
            // @ts-ignore
            var directionVector = new THREE.Vector3(0, 0, 0);

            return function (delta: number) {
                // @ts-ignore
                var velocity = this.velocity;
                // @ts-ignore
                const object3D = this.el.object3D;
                // @ts-ignore
                var rotation = this.el.object3D.getWorldQuaternion(new THREE.Quaternion());
                // @ts-ignore
                const trueUp = object3D.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(0, -100, 0)).normalize();

                // @ts-ignore
                directionVector.copy(velocity);
                directionVector.multiplyScalar(delta);

                // Absolute.
                if (!rotation) { return directionVector; }

                // Transform direction relative to heading.
                // @ts-ignore
                directionVector.applyQuaternion(rotation);
                return directionVector;
            };
        })(),

        attachVisibilityEventListeners: function () {
            window.oncontextmenu = this.onContextMenu;
            window.addEventListener('blur', this.onBlur);
            window.addEventListener('focus', this.onFocus);
            document.addEventListener('visibilitychange', this.onVisibilityChange);
        },

        removeVisibilityEventListeners: function () {
            window.removeEventListener('blur', this.onBlur);
            window.removeEventListener('focus', this.onFocus);
            document.removeEventListener('visibilitychange', this.onVisibilityChange);
        },

        attachKeyEventListeners: function () {
            window.addEventListener('keydown', this.onKeyDown);
            window.addEventListener('keyup', this.onKeyUp);
        },

        removeKeyEventListeners: function () {
            window.removeEventListener('keydown', this.onKeyDown);
            window.removeEventListener('keyup', this.onKeyUp);
        },

        onContextMenu: function () {
            // @ts-ignore
            var keys = Object.keys(this.keys);
            for (var i = 0; i < keys.length; i++) {
                // @ts-ignore
                delete this.keys[keys[i]];
            }
        },

        onBlur: function () {
            this.pause();
        },

        onFocus: function () {
            this.play();
        },

        onVisibilityChange: function () {
            if (document.hidden) {
                this.onBlur();
            } else {
                this.onFocus();
            }
        },

        onKeyDown: function (event: any) {
            var code;
            if (!shouldCaptureKeyEvent(event)) { return; }
            code = event.code || KEYCODE_TO_CODE[event.keyCode];
            // @ts-ignore
            if (KEYS.indexOf(code) !== -1) { this.keys[code] = true; }
        },

        onKeyUp: function (event: any) {
            var code;
            code = event.code || KEYCODE_TO_CODE[event.keyCode];
            // @ts-ignore
            delete this.keys[code];
        }
    });

    // @ts-ignore
    function isEmptyObject (keys: any) {
        var key;
        for (key in keys) { return false; }
        return true;
    }
}

export const PlanetGenerator = () => {
    const [context, setContext] = useState<any>(importReady ? {} : null);
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
            worker.onmessage = (e: MessageEvent<{ mesh: IGameMesh, deleteBefore: boolean, heightMapData: [number, number][] | null }>) => {
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
                    if (deleteBefore) {
                        setWorldModelSource(dataUri);
                    }
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
                                <div ref={ref} style={{width: 250, height: 250}}>
                                </div>
                                <Scene physics="debug: true; driver: local; gravity: 0 0 0;" embedded style={{width: 250, height: 250}}>
                                    <Entity primitive="a-camera" wasd-controls-enabled="false" globle-keyboard-controls={{enabled: true, fly: true}} position={{x: 0, y: 1.6, z: 0}}/>
                                    <Entity static-body="shape: sphere; sphereRadius: 100" gltf-model={worldModelSource} position={{x: 0, y: -100, z: 0}} scale={{x: 100, y: 100, z: 100}}/>
                                    <Entity dynamic-body="shape: box" globe-gravity primitive="a-box" position={{x: 0, y: 10, z: 0}}/>
                                    <Entity dynamic-body="shape: box" globe-gravity primitive="a-box" position={{x: 0, y: 12, z: 0}}/>
                                    <Entity dynamic-body="shape: box" globe-gravity primitive="a-box" position={{x: 0, y: 14, z: 0}}/>
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
