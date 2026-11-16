
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
    enabled:            { default: true },
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
        this.el.setAttribute(name, { enabled: true });
      }
    }
  },

  injectControls: function () {
    const data = this.data;

    for (let i = 0; i < data.controls.length; i++) {
      const name = data.controls[i] + COMPONENT_SUFFIX;
      this.el.setAttribute(name, { enabled: true });
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
        this.emit("ROTATE", {type: "ROTATE", detail: {rotationX: this.rotationX, rotationY: this.rotationY, lookStep: {x: e.movementX, y: e.movementY}}});
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
    } else {
      this.emit("MOVE", {type: "MOVE", detail: new THREE.Vector3()});
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
    this.emit("ROTATE", {type: "ROTATE", detail: {rotationX: this.rotationX, rotationY: this.rotationY, lookStep: {x: lookVector.x, y: lookVector.y}}});
  },

  tick: function (t, dt) {
    if (this.isVelocityActive()) {
      this.getVelocityDelta();
    } else {
      this.emit("MOVE", {type: "MOVE", detail: new THREE.Vector3()});
    }
    if (this.isRotationActive()) {
      this.updateRotation(dt);
    } else {
      this.emit("ROTATE", {type: "ROTATE", detail: {rotationX: this.rotationX, rotationY: this.rotationY, lookStep: {x: 0, y: 0}}});
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

GamepadButton = Object.assign(function () {}, {
  FACE_1: 0,
  FACE_2: 1,
  FACE_3: 2,
  FACE_4: 3,

  L_SHOULDER_1: 4,
  R_SHOULDER_1: 5,
  L_SHOULDER_2: 6,
  R_SHOULDER_2: 7,

  SELECT: 8,
  START: 9,

  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,

  VENDOR: 16,
});

function GamepadButtonEvent (type, index, details) {
  this.type = type;
  this.index = index;
  this.pressed = details.pressed;
  this.value = details.value;
}

const JOYSTICK_EPS = 0.2;

const Hand = {
  LEFT: 'left',
  RIGHT: 'right'
};

const Joystick = {
  MOVEMENT: 1,
  ROTATION: 2
};

AFRAME.registerComponent('globe-gamepad-controls', {

  /*******************************************************************
   * Statics
   */

  GamepadButton: GamepadButton,

  /*******************************************************************
   * Schema
   */

  schema: {
    // Enable/disable gamepad-controls
    enabled: { default: true },

    // Rotation sensitivity
    rotationSensitivity: { default: 2.0 },
  },

  /*******************************************************************
   * Core
   */

  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () {
    const sceneEl = this.el.sceneEl;

    // tracked-controls-webxr was renamed to tracked-controls in aframe 1.7.0
    // tracked-controls-webxr is for aframe 1.6.0 and below
    this.system = sceneEl.systems['tracked-controls'] || sceneEl.systems['tracked-controls-webxr'] || {controllers: []};

    this.prevTime = window.performance.now();

    // Button state
    this.buttons = {};

    // Rotation
    this.rotationX = 0;
    this.rotationY = 0;

    this._lookVector = new THREE.Vector2();
    this._moveVector = new THREE.Vector2();
    this._dpadVector = new THREE.Vector2();

    sceneEl.addBehavior(this);
  },

  /**
   * Called when component is attached and when component data changes.
   * Generally modifies the entity based on the data.
   */
  update: function () { this.tick(); },

  /**
   * Called on each iteration of main render loop.
   */
  tick: function (t, dt) {
    this.updateButtonState();
    if (this.isVelocityActive()) {
      this.getVelocityDelta();
    } else {
      this.emit("MOVE", {type: "MOVE", detail: new THREE.Vector3()});
    }
    if (this.isRotationActive()) {
      this.updateRotation(dt);
    } else {
      this.emit("ROTATE", {type: "ROTATE", detail: {rotationX: this.rotationX, rotationY: this.rotationY, lookStep: {x: 0, y: 0}}});
    }
  },

  /**
   * Called when a component is removed (e.g., via removeAttribute).
   * Generally undoes all modifications to the entity.
   */
  remove: function () { },

  /*******************************************************************
   * Movement
   */

  isVelocityActive: function () {
    if (!this.data.enabled || !this.isConnected()) return false;

    const dpad = this._dpadVector;
    const joystick = this._moveVector;

    this.getDpad(dpad);
    this.getJoystick(Joystick.MOVEMENT, joystick);

    const inputX = dpad.x || joystick.x;
    const inputY = dpad.y || joystick.y;

    return Math.abs(inputX) > JOYSTICK_EPS || Math.abs(inputY) > JOYSTICK_EPS;
  },

  getVelocityDelta: function () {
    const dpad = this._dpadVector;
    const joystick = this._moveVector;

    this.getDpad(dpad);
    this.getJoystick(Joystick.MOVEMENT, joystick);

    const inputX = dpad.x || joystick.x;
    const inputY = dpad.y || joystick.y;
    const dVelocity = new THREE.Vector3();

    if (Math.abs(inputX) > JOYSTICK_EPS) {
      dVelocity.x += inputX;
    }
    if (Math.abs(inputY) > JOYSTICK_EPS) {
      dVelocity.z += inputY;
    }

    this.emit("MOVE", {type: "MOVE", detail: dVelocity.clone()});
  },

  /*******************************************************************
   * Rotation
   */

  isRotationActive: function () {
    if (!this.data.enabled || !this.isConnected()) return false;

    const joystick = this._lookVector;

    this.getJoystick(Joystick.ROTATION, joystick);

    return Math.abs(joystick.x) > JOYSTICK_EPS || Math.abs(joystick.y) > JOYSTICK_EPS;
  },

  updateRotation: function (dt) {
    if (!this.isRotationActive()) return;

    const data = this.data;

    // First copy camera rig pitch/yaw, it may have been changed from
    // another component.
    const lookVector = this._lookVector;

    this.getJoystick(Joystick.ROTATION, lookVector);

    if (Math.abs(lookVector.x) <= JOYSTICK_EPS) lookVector.x = 0;
    if (Math.abs(lookVector.y) <= JOYSTICK_EPS) lookVector.y = 0;

    lookVector.multiplyScalar(data.rotationSensitivity * dt / 1000);
    this.rotationY -= lookVector.x;
    this.rotationX -= lookVector.y;
    this.rotationX = Math.max(- Math.PI / 2.5, Math.min(Math.PI / 2.5, this.rotationX));
    this.emit("ROTATE", {type: "ROTATE", detail: {rotationX: this.rotationX, rotationY: this.rotationY, lookStep: {x: lookVector.x, y: lookVector.y}}});
  },

  /*******************************************************************
   * Button events
   */

  updateButtonState: function () {
    const gamepad = this.getGamepad(Hand.RIGHT);
    if (this.data.enabled && gamepad) {

      // Fire DOM events for button state changes.
      for (var i = 0; i < gamepad.buttons.length; i++) {
        if (gamepad.buttons[i].pressed && !this.buttons[i]) {
          this.emit(new GamepadButtonEvent('gamepadbuttondown', i, gamepad.buttons[i]));
        } else if (!gamepad.buttons[i].pressed && this.buttons[i]) {
          this.emit(new GamepadButtonEvent('gamepadbuttonup', i, gamepad.buttons[i]));
        }
        this.buttons[i] = gamepad.buttons[i].pressed;
      }

    } else {
      // Reset state if controls are disabled or controller is lost.
      for (const key in this.buttons) { this.buttons[key] = false; }
    }
  },

  emit: function (event, data) {
    // Emit convenience event, identifying key.
    if (data) {
      this.el.emit(data.type, data.detail);
    }
    // if (this.data.debug) console.log(event.type + ':' + d.code);

    // Emit convenience event, identifying button index.
    if (event.type && typeof event.index === 'number') {
      this.el.emit(
          event.type,
          new GamepadButtonEvent(event.type, event.index, event)
      );
      this.el.emit(
          event.type + ':' + event.index,
          new GamepadButtonEvent(event.type, event.index, event)
      );
    }
  },

  /*******************************************************************
   * Gamepad state
   */

  /**
   * Returns the Gamepad instance attached to the component. If connected,
   * a proxy-controls component may provide access to Gamepad input from a
   * remote device.
   *
   * @param {string} handPreference
   * @return {Gamepad}
   */
  getGamepad: (function () {
    const _xrGamepads = [];
    const _empty = [];

    return function (handPreference) {
      // https://github.com/donmccurdy/aframe-proxy-controls
      const proxyControls = this.el.sceneEl.components['proxy-controls'];
      const proxyGamepad = proxyControls && proxyControls.isConnected()
          && proxyControls.getGamepad(0);
      if (proxyGamepad) return proxyGamepad;

      // https://www.w3.org/TR/webxr/#dom-xrinputsource-handedness
      _xrGamepads.length = 0;
      for (let i = 0; i < this.system.controllers.length; i++) {
        const xrController = this.system.controllers[i];
        const xrGamepad = xrController ? xrController.gamepad : null;
        _xrGamepads.push(xrGamepad);
        if (xrGamepad && xrController.handedness === handPreference) return xrGamepad;
      }

      // https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/hand
      const navGamepads = navigator.getGamepads ? navigator.getGamepads() : _empty;
      for (let i = 0; i < navGamepads.length; i++) {
        const navGamepad = navGamepads[i];
        if (navGamepad && navGamepad.hand === handPreference) return navGamepad;
      }

      return _xrGamepads[0] || navGamepads[0];
    };
  })(),

  /**
   * Returns the state of the given button.
   * @param  {number} index The button (0-N) for which to find state.
   * @return {GamepadButton}
   */
  getButton: function (index) {
    return this.getGamepad(Hand.RIGHT).buttons[index];
  },

  /**
   * Returns state of the given axis. Axes are labelled 0-N, where 0-1 will
   * represent X/Y on the first joystick, and 2-3 X/Y on the second.
   * @param  {number} index The axis (0-N) for which to find state.
   * @return {number} On the interval [-1,1].
   */
  getAxis: function (index) {
    return this.getGamepad(index > 1 ? Hand.RIGHT : Hand.LEFT).axes[index];
  },

  /**
   * Returns the state of the specified joystick as a THREE.Vector2.
   * @param  {Joystick} role
   * @param  {THREE.Vector2} target
   * @return {THREE.Vector2}
   */
  getJoystick: function (index, target) {
    const gamepad = this.getGamepad(index === Joystick.MOVEMENT ? Hand.LEFT : Hand.RIGHT);
    // gamepad can be null here if it becomes disconnected even if isConnected() was called
    // in the same tick before calling getJoystick.
    if (!gamepad) {
      return target.set(0, 0);
    }
    if (gamepad.mapping === 'xr-standard') {
      // See: https://github.com/donmccurdy/aframe-extras/issues/307
      switch (index) {
        case Joystick.MOVEMENT: return target.set(gamepad.axes[2], gamepad.axes[3]);
        case Joystick.ROTATION: return target.set(gamepad.axes[2], 0);
      }
    } else {
      switch (index) {
        case Joystick.MOVEMENT: return target.set(gamepad.axes[0], gamepad.axes[1]);
        case Joystick.ROTATION: return target.set(gamepad.axes[2], gamepad.axes[3]);
      }
    }
    throw new Error('Unexpected joystick index "%d".', index);
  },

  /**
   * Returns the state of the dpad as a THREE.Vector2.
   * @param {THREE.Vector2} target
   * @return {THREE.Vector2}
   */
  getDpad: function (target) {
    const gamepad = this.getGamepad(Hand.LEFT);
    if (!gamepad) {
      return target.set(0, 0);
    }
    if (!gamepad.buttons[GamepadButton.DPAD_RIGHT]) {
      return target.set(0, 0);
    }
    return target.set(
        (gamepad.buttons[GamepadButton.DPAD_RIGHT].pressed ? 1 : 0)
        + (gamepad.buttons[GamepadButton.DPAD_LEFT].pressed ? -1 : 0),
        (gamepad.buttons[GamepadButton.DPAD_UP].pressed ? -1 : 0)
        + (gamepad.buttons[GamepadButton.DPAD_DOWN].pressed ? 1 : 0)
    );
  },

  /**
   * Returns true if the gamepad is currently connected to the system.
   * @return {boolean}
   */
  isConnected: function () {
    const gamepad = this.getGamepad(Hand.LEFT);
    return !!(gamepad && gamepad.connected);
  },

  /**
   * Returns a string containing some information about the controller. Result
   * may vary across browsers, for a given controller.
   * @return {string}
   */
  getID: function () {
    return this.getGamepad(Hand.LEFT).id;
  }
});
