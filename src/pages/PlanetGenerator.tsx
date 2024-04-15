import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
import '../App.scss';
import {WebsiteDrawer} from "../Drawer";
import {Button, Card, CardContent, CardHeader, Container, Grid, Paper, Typography} from "@mui/material";
// @ts-ignore
import {generatePlanetGltf} from "@pickledeggs123/globular-marauders-generator/dist/helpers";
import {IGameMesh} from "@pickledeggs123/globular-marauders-game/lib/src/Interface";
import * as PIXI from "pixi.js";
import {BLEND_MODES} from "pixi.js";
import Quaternion from "quaternion";
import {ShipContext} from "../contextes/ShipContext";
import {getShapeParameters, ShapeType} from "three-to-cannon";
// @ts-ignore
import {Pathfinding} from "@pickledeggs123/three-pathfinding";

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
    AFRAME.registerComponent('globe-gravity', {
        scheme: {},
        tick: function () {
            const object3D = this.el.object3D;
            // @ts-ignore
            const trueUpDistance = object3D.getWorldPosition(new THREE.Vector3());
            // @ts-ignore
            const trueUp = trueUpDistance.clone().normalize();
            // @ts-ignore
            const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.el.object3D.getWorldQuaternion(new THREE.Quaternion()));
            // @ts-ignore
            const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.el.object3D.getWorldQuaternion(new THREE.Quaternion()));;
            // @ts-ignore
            const currentRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.el.object3D.getWorldQuaternion(new THREE.Quaternion()));
            const diffUp = trueUp.clone().sub(currentUp.clone());

            // apply gravity force
            // @ts-ignore
            const gravityForce = this.el.body.mass * 10;
            // @ts-ignore
            this.el.body.applyForce(new CANNON.Vec3(-trueUp.x, -trueUp.y, -trueUp.z).scale(gravityForce), new CANNON.Vec3(0, 0, 0));

            // apply drag
            // @ts-ignore
            this.el.body.applyForce(this.el.body.velocity.clone().scale(-25), new CANNON.Vec3(0, 0, 0));

            // apply sideways tilt force
            // @ts-ignore
            const sidewaysTilt = this.el.body.velocity.clone().scale(100).dot(currentRight.clone());
            const tiltForce = new CANNON.Vec3(currentRight.x, currentRight.y, currentRight.z).scale(sidewaysTilt);
            const tiltPoint = new CANNON.Vec3(currentUp.x, currentUp.y, currentUp.z);
            // @ts-ignore
            this.el.body.applyForce(tiltForce.clone(), tiltPoint.clone());
            // @ts-ignore
            this.el.body.applyForce(tiltForce.clone().scale(-1), tiltPoint.clone().scale(-1));

            // apply up right force
            // @ts-ignore
            const springForce = 300;
            const rotateForce = new CANNON.Vec3(diffUp.x, diffUp.y, diffUp.z).scale(springForce);
            const rotatePoint = new CANNON.Vec3(currentUp.x, currentUp.y, currentUp.z);
            // @ts-ignore
            const dragForce = this.el.body.angularVelocity.clone().cross(rotatePoint.clone()).scale(100);
            // @ts-ignore
            this.el.body.applyForce(rotateForce.clone().vsub(dragForce), rotatePoint.clone());
            // @ts-ignore
            this.el.body.applyForce(rotateForce.clone().vsub(dragForce).scale(-1), rotatePoint.clone().scale(-1));

            // apply horizontal drag
            const horizontalRotatePoint = new CANNON.Vec3(currentForward.x, currentForward.y, currentForward.z);
            // @ts-ignore
            const horizontalDragForce = this.el.body.angularVelocity.clone().cross(horizontalRotatePoint.clone()).scale(100);
            // @ts-ignore
            this.el.body.applyForce(horizontalDragForce.clone().scale(-1), horizontalRotatePoint.clone());
            // @ts-ignore
            this.el.body.applyForce(horizontalDragForce.clone(), horizontalRotatePoint.clone().scale(-1));

            if (trueUpDistance.length() < PLANET_SIZE + 1) {
                const trueUpMagnitude = -(trueUpDistance.length() - PLANET_SIZE - 1);
                const trueUpForce = new CANNON.Vec3(trueUp.x, trueUp.y, trueUp.z).scale(trueUpMagnitude * 1000);
                // @ts-ignore
                this.el.body.applyForce(trueUpForce, new CANNON.Vec3(0, 0, 0));
            }
        }
    });

    AFRAME.registerComponent('globe-trimesh', {
        scheme: {},
        init: function () {
            this.el.addEventListener('model-loaded', () => {
                const obj = this.el.getObject3D('mesh');
                const result = getShapeParameters(obj, { type: ShapeType.MESH });
                // @ts-ignore
                const body = (this.el.components['static-body'].body as CANNON.Body);
                body.shapes.splice(0, body.shapes.length);
                body.shapeOffsets.splice(0, body.shapeOffsets.length)
                body.shapeOrientations.splice(0, body.shapeOrientations.length)
                if (result !== null) {
                    const {
                        offset,
                        orientation,
                        params: {
                            // @ts-ignore
                            vertices,
                            // @ts-ignore
                            indices,
                        },
                    } = result;
                    const shape = new CANNON.Trimesh(vertices, indices);
                    // @ts-ignore
                    this.el.components['static-body'].addShape(shape, offset, orientation);
                }
            });
        }
    });

    AFRAME.registerComponent('look-at-box', {
        schema: {},
        tick: function () {
            // get elements
            const box = document.querySelector("#box")?.object3D;
            const boxPos = document.querySelector("#box-position")?.object3D;
            if (!box || !boxPos) {
                return;
            }

            // get position
            // @ts-ignore
            const boxWorldPos = box.getWorldPosition(new THREE.Vector3());
            // @ts-ignore
            const boxPosWorldPos = boxPos.getWorldPosition(new THREE.Vector3());

            // get info
            // @ts-ignore
            const upVector = boxPosWorldPos.clone().sub(new THREE.Vector3(0, 0, 0)).normalize();
            const object3D = this.el.object3D;
            // @ts-ignore
            const objectWorldPos = object3D.getWorldPosition(new THREE.Vector3());
            // @ts-ignore
            const height = boxPosWorldPos.clone().sub(new THREE.Vector3(0, 0, 0)).length();

            // update info
            // @ts-ignore
            const quaternion = new THREE.Quaternion().setFromUnitVectors(objectWorldPos.clone().normalize(), boxPosWorldPos.clone().normalize());
            // @ts-ignore
            const slerp = new THREE.Quaternion().slerp(quaternion, 0.03);
            // @ts-ignore
            const finalPosition = objectWorldPos.clone().normalize().multiplyScalar(height + 5).applyQuaternion(slerp);

            // update camera
            object3D.position.set(finalPosition.x, finalPosition.y, finalPosition.z);
            const camera = this.el.sceneEl!.camera;
            // @ts-ignore
            camera.up = upVector;
            camera.lookAt(boxWorldPos);
        }
    });

    AFRAME.registerComponent('physics', {
        schema: {},
        init: function () {
            // @ts-ignore
            this.system.driver.world.gravity.set(0, 0, 0);
            // @ts-ignore
            this.system.debug = true;
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
    const KEYS = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'
    ];

    AFRAME.registerComponent('globe-keyboard-controls', {
        schema: {
            acceleration: {default: 100},
            enabled: {default: true},
            fly: {default: false},
        },

        init: function () {
            // To keep track of the pressed keys.
            // @ts-ignore
            this.keys = {};
            // @ts-ignore
            this.velocity = new THREE.Vector3();
            // @ts-ignore
            this.rotation = new THREE.Vector3();

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
            const body = this.el.body;

            // Update velocity.
            delta = delta / 1000;
            this.updateVelocity(delta);

            // Get movement vector and translate position.
            // @ts-ignore
            body.applyForce(this.getMovementVector(delta).clone(), new CANNON.Vec3(0, 0, 0));

            // @ts-ignore
            if (this.rotation.clone().y) {
                // apply rotation force
                // @ts-ignore
                body.applyLocalForce(new CANNON.Vec3(this.rotation.clone().y, 0, 0), new CANNON.Vec3(0, 0, 1));
                // @ts-ignore
                body.applyLocalForce(new CANNON.Vec3(-this.rotation.clone().y, 0, 0), new CANNON.Vec3(0, 0, -1));
            }
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
            // @ts-ignore
            var rotation = this.rotation;

            if (!data.enabled) { return; }

            // Update velocity using keys pressed.
            acceleration = data.acceleration;
            velocity.set(0, 0, 0);
            rotation.set(0, 0, 0);
            if (keys.KeyA || keys.ArrowLeft) { rotation.y = acceleration; }
            if (keys.KeyD || keys.ArrowRight) { rotation.y = -acceleration; }
            if (keys.KeyW || keys.ArrowUp) { velocity.z = -acceleration; }
            if (keys.KeyS || keys.ArrowDown) { velocity.z = acceleration; }

            // @ts-ignore
            const bodyWorldVelocity = this.el.body.velocity.clone();
            // @ts-ignore
            const bodyWorldQuat = this.el.body.quaternion.clone().inverse();
            // @ts-ignore
            const bodyVelocity = new THREE.Vector3(bodyWorldVelocity.x, bodyWorldVelocity.y, bodyWorldVelocity.z).applyQuaternion(new THREE.Quaternion(bodyWorldQuat.x, bodyWorldQuat.y, bodyWorldQuat.z, bodyWorldQuat.w));
            // @ts-ignore
            velocity.sub(new THREE.Vector3(bodyVelocity.x, bodyVelocity.y, bodyVelocity.z).multiplyScalar(1));
        },

        getMovementVector: (function () {
            // @ts-ignore
            var directionVector = new THREE.Vector3(0, 0, 0);

            return function (delta: number) {
                // @ts-ignore
                var velocity = this.velocity;
                // @ts-ignore
                var rotation = this.el.object3D.getWorldQuaternion(new THREE.Quaternion());

                // @ts-ignore
                directionVector.copy(velocity);

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

    const pathfinder = new Pathfinding();
    const ZONE = 'level';

    /**
     * nav
     *
     * Pathfinding system, using PatrolJS.
     */
    AFRAME.registerSystem('globe-nav', {
        navMesh: null as any,
        agents: new Set() as Set<any>,
        init: function () {
            this.navMesh = null;
            this.agents = new Set();
        },

        /**
         * @param {THREE.Geometry} geometry
         */
        setNavMeshGeometry: function (geometry: any) {
            // @ts-ignore
            this.navMesh = new THREE.Mesh(geometry);
            pathfinder.setZoneData(ZONE, Pathfinding.createZone(geometry));
            Array.from(this.agents).forEach((agent) => agent.updateNavLocation());
        },

        /**
         * @return {THREE.Mesh}
         */
        getNavMesh: function () {
            return this.navMesh;
        },

        /**
         * @param {NavAgent} ctrl
         */
        addAgent: function (ctrl: any) {
            this.agents.add(ctrl);
        },

        /**
         * @param {NavAgent} ctrl
         */
        removeAgent: function (ctrl: any) {
            this.agents.delete(ctrl);
        },

        /**
         * @param  {THREE.Vector3} start
         * @param  {THREE.Vector3} end
         * @param  {number} groupID
         * @return {Array<THREE.Vector3>}
         */
        getPath: function (start: any, end: any, groupID: any) {
            return this.navMesh
                ? pathfinder.findPath(start, end, ZONE, groupID)
                : null;
        },

        /**
         * @param {THREE.Vector3} position
         * @return {number}
         */
        getGroup: function (position: any) {
            return this.navMesh
                ? pathfinder.getGroup(ZONE, position)
                : null;
        },

        /**
         * @param  {THREE.Vector3} position
         * @param  {number} groupID
         * @return {Node}
         */
        getNode: function (position: any, groupID: any) {
            return this.navMesh
                ? pathfinder.getClosestNode(position, ZONE, groupID, true)
                : null;
        },

        /**
         * @param  {THREE.Vector3} start Starting position.
         * @param  {THREE.Vector3} end Desired ending position.
         * @param  {number} groupID
         * @param  {Node} node
         * @param  {THREE.Vector3} endTarget (Output) Adjusted step end position.
         * @return {Node} Current node, after step is taken.
         */
        clampStep: function (start: any, end: any, groupID: any, node: any, endTarget: any) {
            if (!this.navMesh) {
                endTarget.copy(end);
                return null;
            } else if (!node) {
                endTarget.copy(end);
                return this.getNode(end, groupID);
            }
            return pathfinder.clampStep(start, end, node, ZONE, groupID, endTarget);
        }
    });

    AFRAME.registerComponent('globe-nav-mesh', {
        schema: {
            nodeName: {type: 'string'}
        },
        hasLoadedNavMesh: false as boolean,
        nodeName: "" as string,
        init: function () {
            this.system = this.el.sceneEl!.systems['globe-nav'];
            this.hasLoadedNavMesh = false;
            this.nodeName = this.data.nodeName;
            this.el.addEventListener('object3dset', this.loadNavMesh.bind(this));
        },

        play: function () {
            if (!this.hasLoadedNavMesh) this.loadNavMesh();
        },

        loadNavMesh: function () {
            var self = this;
            const object = this.el.getObject3D('mesh');
            const scene = this.el.sceneEl!.object3D;

            if (!object) return;

            let navMesh;
            object.traverse((node: any) => {
                if (node.isMesh &&
                    (!self.nodeName || node.name === self.nodeName)) navMesh = node;
            });

            if (!navMesh) return;

            // @ts-ignore
            const navMeshGeometry = navMesh.geometry.clone();
            // @ts-ignore
            navMesh.updateWorldMatrix(true, false);
            // @ts-ignore
            navMeshGeometry.applyMatrix4(navMesh.matrixWorld);
            // @ts-ignore
            this.system!.setNavMeshGeometry(navMeshGeometry);
            this.hasLoadedNavMesh = true;
        }
    });

    AFRAME.registerComponent('globe-nav-agent', {
        schema: {
            destination: {type: 'vec3'},
            active: {default: false},
            speed: {default: 2}
        },
        system: null as any,
        group: null as any,
        path: [] as any,
        raycaster: null as any,
        init: function () {
            this.system = (this.el.sceneEl as any).systems['globe-nav'];
            this.system.addAgent(this);
            this.group = null;
            this.path = [];
            // @ts-ignore
            this.raycaster = new THREE.Raycaster();
        },
        remove: function () {
            this.system.removeAgent(this);
        },
        update: function () {
            this.path.length = 0;
        },
        updateNavLocation: function () {
            this.group = null;
            this.path = [];
        },
        tick: (function () {
            // @ts-ignore
            const vDest = new THREE.Vector3();
            // @ts-ignore
            const vDelta = new THREE.Vector3();
            // @ts-ignore
            const vNext = new THREE.Vector3();

            return function (this: any, t, dt) {
                const el = this.el;
                const data = this.data;
                const raycaster = this.raycaster;
                const speed = data.speed * dt / 1000;

                if (!data.active) return;

                // Use PatrolJS pathfinding system to get shortest path to target.
                if (!this.path.length) {
                    const position = this.el.object3D.position;
                    this.group = this.group || this.system.getGroup(position);
                    this.path = this.system.getPath(position, vDest.copy(data.destination), this.group) || [];
                    el.emit('navigation-start');
                }

                // If no path is found, exit.
                if (!this.path.length) {
                    console.warn('[nav] Unable to find path to %o.', data.destination);
                    this.el.components['globe-nav-agent'].data.active = false;
                    el.emit('navigation-end');
                    el.object3D.position.set(vDest.x, vDest.y, vDest.z);
                    this.group = null;
                    return;
                }

                // Current segment is a vector from current position to next waypoint.
                const vCurrent = el.object3D.position;
                const vWaypoint = this.path[0];
                vDelta.subVectors(vWaypoint, vCurrent);

                const distance = vDelta.length();
                let gazeTarget;

                if (distance < speed) {
                    // If <1 step from current waypoint, discard it and move toward next.
                    this.path.shift();

                    // After discarding the last waypoint, exit pathfinding.
                    if (!this.path.length) {
                        this.el.components['globe-nav-agent'].data.active = false;
                        el.emit('navigation-end');
                        return;
                    }

                    vNext.copy(vCurrent);
                    gazeTarget = this.path[0];
                } else {
                    // If still far away from next waypoint, find next position for
                    // the current frame.
                    vNext.copy(vDelta.setLength(speed)).add(vCurrent);
                    gazeTarget = vWaypoint;
                }

                // Look at the next waypoint.
                // gazeTarget.y = vCurrent.y;
                el.object3D.lookAt(gazeTarget);

                // Raycast against the nav mesh, to keep the agent moving along the
                // ground, not traveling in a straight line from higher to lower waypoints.
                raycaster.ray.origin.copy(vNext.clone().normalize().multiplyScalar(101.5));
                raycaster.ray.direction = vNext.clone().normalize().negate();
                const intersections = raycaster.intersectObject(this.system.getNavMesh());

                if (!intersections.length) {
                    // Raycasting failed. Step toward the waypoint and hope for the best.
                    vCurrent.copy(vNext);
                } else {
                    // Re-project next position onto nav mesh.
                    vDelta.subVectors(intersections[0].point, vCurrent);
                    vCurrent.add(vDelta.setLength(speed));
                }

            };
        }())
    });

    AFRAME.registerComponent('cursor-animator', {
        init: function () {
            this.el.addEventListener('click', function (e: any) {
                const npcEl = document.querySelector('#npc');
                npcEl.components['globe-nav-agent'].data = {
                    active: true,
                    destination: e.detail.intersection.point,
                    speed: 2,
                };
            });
        }
    });
}

const PLANET_SIZE = 100;

export const PlanetGenerator = () => {
    const [context, setContext] = useState<{ app: PIXI.Application | null, preview: IGameMesh | null, gameData: IGameMesh[] } | null>(importReady ? { app: null, preview: null, gameData: [] } : null);
    const shipContext = useContext(ShipContext);
    const [worldModelSource, setWorldModelSource] = useState<[string, boolean, boolean][]>([]);
    const [sloopModelSource, setSloopModelSource] = useState<string>("");
    const [loadMessage, setLoadMessage] = useState<string>("No data loaded...");
    const ref = useRef<HTMLDivElement | null>(null);
    const [forceRefresh, setForceRefresh] = useState<number>(0);
    useEffect(() => {
        // @ts-ignore
        if (global.use_ssr || !context) {
            return;
        }

        setLoadMessage("No data loaded...");
        const handlePixiRender = (data: IGameMesh[]) => {
            const app = context.app as PIXI.Application;

            const meshesToSendToPixi: PIXI.Mesh<PIXI.Shader>[] = [];
            for (const d of data) {
                if (d.navmesh || d.ocean || d.oceanNavmesh) {
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
                            gl_Position = uRotation * vec4(aPosition * 0.90, 1.0);
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
            
                            gl_Position = uRotation * vec4(aPosition * 0.90, 1.0);
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
        const handleData = (meshes: IGameMesh[]) => {
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
            Promise.all<Uint8Array>([...data2.map(m => generatePlanetGltf(m, m.ocean)), generatePlanetGltf(shipContext[1], false)]).then((gltf) => {
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
                const worldMeshes = [];
                for (let i = 0; i < gltf.length - 1; i++) {
                    const dataUri1 = `data:application/octet-stream;base64,${Uint8ToBase64(gltf[i])}`;
                    worldMeshes.push([dataUri1, data2[i].collidable, data2[i].navmesh] as [string, boolean, boolean]);
                }
                setWorldModelSource(worldMeshes);
                const dataUri2 = `data:application/octet-stream;base64,${Uint8ToBase64(gltf[gltf.length - 1])}`;
                setSloopModelSource(dataUri2);
            });

            handlePixiRender(data);
        }

        (async () => {
            const planetResponse = await fetch("/api/planet");
            const planetJson = await planetResponse.json();
            if (planetJson) {
                const {
                    previewUrl,
                    gameUrl,
                } = planetJson;
                const [previewResponse, gameResponse] = await Promise.all([fetch(previewUrl), fetch(gameUrl)]);
                const previewJson = await previewResponse.json();
                const gameJson = await gameResponse.json();

                context.preview = previewJson as IGameMesh;
                handleData(gameJson as IGameMesh[]);
            }
        })();
    }, [context, forceRefresh]);
    const drawGraph = useCallback(() => {
        // @ts-ignore
        if (global.use_ssr || !context) {
            return;
        }
        setForceRefresh(forceRefresh + 1);
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
        // @ts-ignore
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

    if (!importReady) {
        importPromise.then(() => {
            setContext({ app: null, preview: null, gameData: [] });
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
                                <Typography>Load Status: {loadMessage}</Typography>
                                <div ref={ref} style={{width: 256, height: 256}}>
                                </div>
                                <Scene physics="debug: true; driver: local; gravity: 0 0 0;" globe-nav embedded cursor="rayOrigin:mouse" id="scene">
                                    <Entity light={{type: "ambient", color: "#CCC"}}></Entity>
                                    <Entity light={{type: "directional", color: "#EEE", intensity: 0.5}} position={{x: 0, y: 1, z: 0}}></Entity>
                                    <Entity light={{type: "directional", color: "#EEE", intensity: 0.5}} position={{x: 0, y: -1, z: 0}}></Entity>
                                    <Entity physics/>
                                    <Entity id="box" dynamic-body="shape: sphere; sphereRadius: 1; mass: 100" globe-gravity globe-keyboard-controls="enabled: true; fly: true" position={{x: 0, y: 15 + PLANET_SIZE, z: 0}}>
                                        <Entity gltf-model={sloopModelSource} rotation="0 -90 0" scale="0.1 0.1 0.1"></Entity>
                                        <Entity id="box-position" position={{x: 0, y: 0, z: 5}}/>
                                    </Entity>
                                    <Entity id="camera-rig" look-at-box position={{x: 0, y: 0, z: 5}}>
                                        <Entity primitive="a-camera" wasd-controls-enabled="false" look-controls-enabled="false" position={{x: 0, y: 1.6, z: 0}}>
                                        </Entity>
                                    </Entity>
                                    {
                                        worldModelSource.map(([str, collidable, navmesh], index) => (
                                            navmesh ? (
                                                <Entity key={index} globe-nav-mesh gltf-model={str} position={{x: 0, y: 0, z: 0}}/>
                                            ) : collidable ? (
                                                <Entity key={index} static-body="shape: none;" globe-trimesh gltf-model={str} position={{x: 0, y: 0, z: 0}} cursor-animator
                                                />
                                            ): (
                                                <Entity key={index} static-body="shape: none;" gltf-model={str} position={{x: 0, y: 0, z: 0}}/>
                                            )
                                        ))
                                    }
                                    <Entity dynamic-body="shape: sphere; sphereRadius: 1; mass: 100;" globe-gravity position={{x: 3, y: 15 + PLANET_SIZE, z: 0}}>
                                        <Entity gltf-model={sloopModelSource} rotation="0 -90 0" scale="0.1 0.1 0.1"></Entity>
                                    </Entity>
                                    <Entity dynamic-body="shape: sphere; sphereRadius: 1; mass: 100;" globe-gravity position={{x: 6, y: 15 + PLANET_SIZE, z: 0}}>
                                        <Entity gltf-model={sloopModelSource} rotation="0 -90 0" scale="0.1 0.1 0.1"></Entity>
                                    </Entity>
                                    <Entity dynamic-body="shape: sphere; sphereRadius: 1; mass: 100;" globe-gravity position={{x: 9, y: 15 + PLANET_SIZE, z: 0}}>
                                        <Entity gltf-model={sloopModelSource} rotation="0 -90 0" scale="0.1 0.1 0.1"></Entity>
                                    </Entity>
                                    <Entity primitive="a-sphere" globe-nav-agent id="npc" position={{x: 0, y: PLANET_SIZE, z: 0}}></Entity>
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
