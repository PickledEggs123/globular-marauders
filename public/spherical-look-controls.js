
/**
 * Movement Controls
 *
 * @author Don McCurdy <dm@donmccurdy.com>
 */

const COMPONENT_SUFFIX = '-controls';
const MAX_DELTA = 0.2; // ms
const EPS = 10e-6;
const MOVED = 'moved';

AFRAME.registerComponent('globe-movement-controls', {

  /*******************************************************************
   * Schema
   */

  dependencies: ['rotation'],

  schema: {
    planet: { type: 'selector' },
    speed: { type: 'number', default: 5 },
    lookSpeed: { type: 'number', default: 0.002 },
    radius: {type: 'number', default: 20 },
    enabled:            { type: "boolean", default: true },
    controls:           { default: ['globe-gamepad', 'globe-trackpad', 'globe-keyboard', 'globe-touch', 'globe-nipple'] },
    fly:                { default: false },
    constrainToNavMesh: { default: false },
    camera:             { default: '[globe-movement-controls] [camera]', type: 'selector' }
  },

  /*******************************************************************
   * Lifecycle
   */

  init: function () {
    const el = this.el;
    if (!this.data.camera) {
      this.data.camera = el.querySelector('[camera]');
    }
    this.velocityCtrl = null;

    this.velocity = new THREE.Vector3();
    this.heading = new THREE.Quaternion();
    this.eventDetail = {};
    this.rotationX = 0;
    this.rotationY = 0;
    this.moveVector = new THREE.Vector3();
    this.lastUpVector = null;
    this.lastQuaternion = null;
    this.baseQuaternion = null;

    // Navigation
    this.navGroup = null;
    this.navNode = null;

    if (el.sceneEl.hasLoaded) {
      this.injectControls();
    } else {
      el.sceneEl.addEventListener('loaded', this.injectControls.bind(this));
    }
    el.sceneEl.addEventListener("MOVE", (evt) => {
      this.moveVector = evt.detail;
    });
    el.sceneEl.addEventListener("ROTATE", (evt) => {
      this.rotationX = evt.detail.rotationX;
      this.rotationY = evt.detail.rotationY;
    });
  },

  updateVelocityCtrl: function () {
    const data = this.data;
    if (data.enabled) {
      for (let i = 0, l = data.controls.length; i < l; i++) {
        const control = this.el.components[data.controls[i] + COMPONENT_SUFFIX];
        if (control && (control.isVelocityActive() || (typeof control.isRotationActive === "function" && control.isRotationActive()))) {
          this.velocityCtrl = control;
          return;
        }
      }
      this.velocityCtrl = null;
    }
  },


  update: function (prevData) {
    const el = this.el;
    const data = this.data;
    const nav = el.sceneEl.systems.nav;
    if (el.sceneEl.hasLoaded) {
      this.injectControls();
    }
    if (nav && data.constrainToNavMesh !== prevData.constrainToNavMesh) {
      data.constrainToNavMesh
          ? nav.addAgent(this)
          : nav.removeAgent(this);
    }
    if (data.enabled !== prevData.enabled) {
      // Propagate the enabled change to all controls
      for (let i = 0; i < data.controls.length; i++) {
        const name = data.controls[i] + COMPONENT_SUFFIX;
        this.el.setAttribute(name, { enabled: this.data.enabled });
      }
    }
  },

  injectControls: function () {
    const data = this.data;

    for (let i = 0; i < data.controls.length; i++) {
      const name = data.controls[i] + COMPONENT_SUFFIX;
      this.el.setAttribute(name, { enabled: this.data.enabled });
    }
  },

  updateNavLocation: function () {
    this.navGroup = null;
    this.navNode = null;
  },

  /*******************************************************************
   * Tick
   */

  tick: (function () {
    const start = new THREE.Vector3();
    const end = new THREE.Vector3();
    const clampedEnd = new THREE.Vector3();
    const cameraOffset = new THREE.Vector3();

    return function (t, dt) {
      if (!this.data.planet) return;
      if (!dt) return;
      const timeDelta = dt;

      const el = this.el;
      const data = this.data;

      if (!data.enabled) return;

      this.updateVelocityCtrl();
      const velocityCtrl = this.velocityCtrl;
      const velocity = this.velocity;

      const isInVR = this.el.sceneEl.is('vr-mode');
      if (!velocityCtrl && !isInVR) return;

      // Update velocity. If FPS is too low, reset.
      // if (dt / 1000 > MAX_DELTA) {
      //   velocity.set(0, 0, 0);
      // } else {
      //   this.updateVelocity(dt);
      // }
      //
      // if (data.constrainToNavMesh
      //     && ((!velocityCtrl && isInVR) || velocityCtrl.isNavMeshConstrained !== false)) {
      //
      //   if (velocity.lengthSq() < EPS) return;
      //
      //   start.copy(el.object3D.position);
      //   if (isInVR) {
      //     const cameraEl = data.camera;
      //     cameraEl.object3D.getWorldPosition(cameraOffset);
      //     if (el.object3D.parent) {
      //       el.object3D.parent.worldToLocal(cameraOffset);
      //     }
      //     cameraOffset.sub(el.object3D.position);
      //     cameraOffset.y = 0;
      //     start.add(cameraOffset);
      //   }
      //
      //   if (velocityCtrl) {
      //     end
      //         .copy(velocity)
      //         .multiplyScalar(dt / 1000)
      //         .add(start);
      //   } else {
      //     end.copy(start)
      //   }
      //
      //   const nav = el.sceneEl.systems.nav;
      //   this.navGroup = this.navGroup === null ? nav.getGroup(start) : this.navGroup;
      //   this.navNode = this.navNode || nav.getNode(start, this.navGroup);
      //   this.navNode = nav.clampStep(start, end, this.navGroup, this.navNode, clampedEnd);
      //   if (isInVR) {
      //     clampedEnd.sub(cameraOffset);
      //   }
      //   el.object3D.position.copy(clampedEnd);
      // } else if (velocityCtrl && el.hasAttribute('velocity')) {
      //   el.setAttribute('velocity', velocity);
      // } else
        if (velocityCtrl) {
        let dt = timeDelta / 1000;
        let playerPos = this.el.object3D.position;
        let planetPos = this.data.planet.object3D.position;

        // 1. CALCULATE UP VECTOR (Gravity direction)
        // Direction from planet center to player represents the local "Up"
        let upVector = new THREE.Vector3().subVectors(playerPos, planetPos).normalize();

        // 2. PROCESS WASD INPUTS Relative to Camera View
        // this.moveVector.set(0, 0, 0);
        this.moveVector.normalize();

        // Apply local mouse look rotations (Yaw around planet-up, Pitch around local side-axis)
        let yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
        let pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.rotationX);

        // 3. APPLY ROTATION (Yaw / Pitch)
        // Create the base orientation: align player's local Y axis with the planet's up vector
        if (!this.lastUpVector) {
          this.lastUpVector = upVector.clone();
          this.lastQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upVector);
          this.baseQuaternion = this.lastQuaternion.clone();
        }
        if (this.lastUpVector.dot(upVector) <= Math.cos(THREE.MathUtils.degToRad(1))) {
          let right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.baseQuaternion.clone()).normalize();
          const up = upVector.clone().normalize();
          const forward = right.clone().cross(up.clone()).normalize();
          right = up.clone().cross(forward.clone()).normalize();
          const m = new THREE.Matrix4().makeBasis(right, up, forward);
          console.assert(Math.abs(Math.abs(m.determinant()) - 1) < 0.05, "BAD DETERMINANT", m.determinant(), right, up, forward);
          this.lastQuaternion.setFromRotationMatrix(m).normalize();
          this.lastQuaternion.multiply(new THREE.Quaternion().setFromUnitVectors(this.lastUpVector, upVector));
          this.lastUpVector = upVector.clone();
        }
        this.baseQuaternion.slerp(this.lastQuaternion, 0.1);

        // Combine: Base alignment * Mouse Turn * Mouse Pitch
        this.el.object3D.quaternion.copy(this.baseQuaternion).multiply(yawQuat).multiply(pitchQuat);

        // 4. TRANSLATE POSITION (Walk along the sphere surface)
        if (this.moveVector.lengthSq() > 0) {
          // Transform movement direction into the player's current orientation
          this.moveVector.applyQuaternion(this.el.object3D.quaternion);

          // Project the movement vector onto the sphere's tangent plane so the player doesn't fly off
          let normalProj = upVector.clone().multiplyScalar(this.moveVector.dot(upVector));
          this.moveVector.sub(normalProj).normalize();

          // Move the player point
          playerPos.addScaledVector(this.moveVector, this.data.speed * dt);
          upVector = new THREE.Vector3().subVectors(playerPos, planetPos).normalize();
        }

        // 5. SNAP TO PLANET SURFACE (Fake Gravity)
        // Replace '20.5' with your planet's radius + camera height offset (e.g., radius 20 + 0.5 height)
        let desiredDistance = this.data.radius + 1.6;

        // Force player onto the surface shell
        playerPos.copy(planetPos).addScaledVector(upVector, desiredDistance);
      }

    };
  }()),
});

const PROXY_FLAG = '__keyboard-controls-proxy';

const KeyboardEvent = window.KeyboardEvent;


AFRAME.registerComponent('globe-keyboard-controls', {
  schema: {
    speed: { type: 'number', default: 5 },
    lookSpeed: { type: 'number', default: 0.002 },
    enabled:           { default: true },
    debug:             { default: false },
  },

  init: function () {
    this.rotationX = 0; // Look up/down (pitch)
    this.rotationY = 0; // Look left/right (yaw)
    this.dVelocity = new THREE.Vector3();
    this.localKeys = {};

    // Bind key listeners for WASD movement
    window.addEventListener('keydown', (e) => { this.localKeys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { this.localKeys[e.key.toLowerCase()] = false; });

    // Mouse lock and movement for looking around
    document.addEventListener('click', () => {
      this.el.sceneEl.canvas.requestPointerLock();
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.el.sceneEl.canvas) {
        this.rotationY -= e.movementX * this.data.lookSpeed;
        this.rotationX -= e.movementY * this.data.lookSpeed;
        // Clamp looking up/down so you don't flip your neck backwards
        this.rotationX = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.rotationX));
        this.emit("ROTATE", {type: "ROTATE", detail: {rotationX: this.rotationX, rotationY: this.rotationY}});
      }
    });
  },

  /*******************************************************************
   * Movement
   */

  isVelocityActive: function () {
    return this.data.enabled && !!Object.keys(this.getKeys()).length;
  },

  getVelocityDelta: function () {
    const data = this.data;
    const keys = this.getKeys();

    this.dVelocity.set(0, 0, 0);
    if (data.enabled) {
      if (keys.w || keys.arrowup)    { this.dVelocity.z -= 1; }
      if (keys.a || keys.arrowleft)  { this.dVelocity.x -= 1; }
      if (keys.s || keys.arrowdown)  { this.dVelocity.z += 1; }
      if (keys.d || keys.arrowright) { this.dVelocity.x += 1; }

      this.dVelocity.normalize();

      // Move faster when the shift key is down.
      if (keys.ShiftLeft) { this.dVelocity = this.dVelocity.multiplyScalar(2); }
      this.emit("MOVE", {type: "MOVE", detail: this.dVelocity.clone()});
    }
  },

  tick: function () {
    if (this.isVelocityActive()) {
      this.getVelocityDelta();
    }
  },

  emit: function (event, data) {
    // TODO - keydown only initially?
    // TODO - where the f is the spacebar

    // // Emit original event.
    // if (PROXY_FLAG in event) {
    //   // TODO - Method never triggered.
    //   this.el.emit(event.type, event);
    // }

    // Emit convenience event, identifying key.
    this.el.emit(data.type, data.detail);
    // if (this.data.debug) console.log(event.type + ':' + d.code);
  },

  /*******************************************************************
   * Accessors
   */

  isPressed: function (code) {
    return code in this.getKeys();
  },

  getKeys: function () {
    if (this.isProxied()) {
      return this.el.sceneEl.components['proxy-controls'].getKeyboard();
    }
    return this.localKeys;
  },

  isProxied: function () {
    const proxyControls = this.el.sceneEl.components['proxy-controls'];
    return proxyControls && proxyControls.isConnected();
  },
});

AFRAME.registerComponent("globe-nipple-controls", {
  schema: {
    enabled: { default: true },
    mode: { default: "dynamic", oneOf: ["static", "semi", "dynamic"] },
    rotationSensitivity: { default: 1.0 },
    moveJoystickEnabled: { default: true },
    lookJoystickEnabled: { default: true },
    sideMargin: { default: "30px" },
    bottomMargin: { default: "70px" },
    moveJoystickPosition: { default: "left", oneOf: ["left", "right"] },
    lookJoystickPosition: { default: "right", oneOf: ["left", "right"] },
  },

  init() {
    this.dVelocity = new THREE.Vector3();
    this.lookVector = new THREE.Vector2();
    this.rotationX = 0; // Look up/down (pitch)
    this.rotationY = 0; // Look left/right (yaw)
    this.moveData = undefined;
    this.lookData = undefined;
    this.moving = false;
    this.rotating = false;
  },

  update(oldData) {
    if (
        this.data.moveJoystickPosition !== oldData.moveJoystickPosition ||
        this.data.sideMargin !== oldData.sideMargin ||
        this.data.bottomMargin !== oldData.bottomMargin ||
        this.data.mode !== oldData.mode
    ) {
      this.removeMoveJoystick();
    }
    if (
        this.data.lookJoystickPosition !== oldData.lookJoystickPosition ||
        this.data.sideMargin !== oldData.sideMargin ||
        this.data.bottomMargin !== oldData.bottomMargin ||
        this.data.mode !== oldData.mode
    ) {
      this.removeLookJoystick();
    }
    if (this.data.enabled && this.data.moveJoystickEnabled) {
      this.createMoveJoystick();
    } else {
      this.removeMoveJoystick();
    }
    if (this.data.enabled && this.data.lookJoystickEnabled) {
      this.createLookJoystick();
    } else {
      this.removeLookJoystick();
    }
  },

  pause() {
    this.moving = false;
    this.rotating = false;
  },

  remove() {
    this.removeMoveJoystick();
    this.removeLookJoystick();
  },

  isVelocityActive() {
    return this.data.enabled && this.moving;
  },

  getVelocityDelta() {
    this.dVelocity.set(0, 0, 0);
    if (this.isVelocityActive()) {
      const force = this.moveData.force < 1 ? this.moveData.force : 1;
      const angle = this.moveData.angle.radian;
      const x = Math.cos(angle) * force;
      const z = -Math.sin(angle) * force;
      this.dVelocity.set(x, 0, z);
    }
    this.emit("MOVE", {type: "MOVE", detail: this.dVelocity.clone()});
  },

  isRotationActive() {
    return this.data.enabled && this.rotating;
  },

  updateRotation(dt) {
    if (!this.isRotationActive()) return;

    const force = this.lookData.force < 1 ? this.lookData.force : 1;
    const angle = this.lookData.angle.radian;
    const lookVector = this.lookVector;
    lookVector.x = Math.cos(angle) * force;
    lookVector.y = Math.sin(angle) * force;
    lookVector.multiplyScalar((this.data.rotationSensitivity * dt) / 1000);

    this.rotationY -= lookVector.x;
    let y = this.rotationX + lookVector.y;
    y = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, y));
    this.rotationX = y;
    this.emit("ROTATE", {type: "ROTATE", detail: {rotationX: this.rotationX, rotationY: this.rotationY}});
  },

  tick: function (t, dt) {
    if (this.isVelocityActive()) {
      this.getVelocityDelta();
    }
    if (this.isRotationActive()) {
      this.updateRotation(dt);
    }
  },

  initLeftZone() {
    const leftZone = document.createElement("div");
    leftZone.setAttribute("id", "joystickLeftZone");
    leftZone.setAttribute(
        "style",
        `position:absolute;${this.data.moveJoystickPosition}:${this.data.sideMargin};bottom:${this.data.bottomMargin};z-index:1`
    );
    this.el.sceneEl.appendChild(leftZone);
    this.leftZone = leftZone;
  },

  initRightZone() {
    const rightZone = document.createElement("div");
    rightZone.setAttribute("id", "joystickRightZone");
    rightZone.setAttribute(
        "style",
        `position:absolute;${this.data.lookJoystickPosition}:${this.data.sideMargin};bottom:${this.data.bottomMargin};z-index:1`
    );
    this.el.sceneEl.appendChild(rightZone);
    this.rightZone = rightZone;
  },

  createMoveJoystick() {
    if (this.moveJoystick) return;
    this.initLeftZone();
    const options = {
      mode: this.data.mode,
      zone: this.leftZone,
      color: "white",
      fadeTime: 0,
    };
    this.leftZone.style.width = "100px";
    if (this.data.mode === "static") {
      this.leftZone.style.height = "100px";
      options.position = { left: "50%", bottom: "50%" };
    } else {
      this.leftZone.style.height = "400px";
    }

    this.moveJoystick = nipplejs.create(options);
    this.moveJoystick.on("move", ({data}) => {
      this.moveData = data;
      this.moving = true;
    });
    this.moveJoystick.on("end", () => {
      this.moving = false;
    });
  },

  createLookJoystick() {
    if (this.lookJoystick) return;
    this.initRightZone();
    const options = {
      mode: this.data.mode,
      zone: this.rightZone,
      color: "white",
      fadeTime: 0,
    };
    this.rightZone.style.width = "100px";
    if (this.data.mode === "static") {
      this.rightZone.style.height = "100px";
      options.position = { left: "50%", bottom: "50%" };
    } else {
      this.rightZone.style.height = "400px";
    }

    this.lookJoystick = nipplejs.create(options);
    this.lookJoystick.on("move", ({data}) => {
      this.lookData = data;
      this.rotating = true;
    });
    this.lookJoystick.on("end", () => {
      this.rotating = false;
    });
  },

  removeMoveJoystick() {
    if (this.moveJoystick) {
      this.moveJoystick.destroy();
      this.moveJoystick = undefined;
    }

    this.moveData = undefined;

    if (this.leftZone && this.leftZone.parentNode) {
      this.leftZone.remove();
      this.leftZone = undefined;
    }
  },

  removeLookJoystick() {
    if (this.lookJoystick) {
      this.lookJoystick.destroy();
      this.lookJoystick = undefined;
    }

    this.lookData = undefined;

    if (this.rightZone && this.rightZone.parentNode) {
      this.rightZone.remove();
      this.rightZone = undefined;
    }
  },

  emit: function (event, data) {
    // TODO - keydown only initially?
    // TODO - where the f is the spacebar

    // // Emit original event.
    // if (PROXY_FLAG in event) {
    //   // TODO - Method never triggered.
    //   this.el.emit(event.type, event);
    // }

    // Emit convenience event, identifying key.
    this.el.emit(data.type, data.detail);
    // if (this.data.debug) console.log(event.type + ':' + d.code);
  },
});