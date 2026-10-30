
AFRAME.registerComponent('spherical-fps-controls', {
  schema: {
    planet: { type: 'selector' },
    speed: { type: 'number', default: 5 },
    lookSpeed: { type: 'number', default: 0.002 },
    radius: {type: 'number', default: 20 },
  },

  init: function () {
    this.keys = {};
    this.moveVector = new THREE.Vector3();
    this.rotationX = 0; // Look up/down (pitch)
    this.rotationY = 0; // Look left/right (yaw)

    // Bind key listeners for WASD movement
    window.addEventListener('keydown', (e) => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

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
      }
    });
  },

  tick: function (time, timeDelta) {
    if (!this.data.planet) return;

    let dt = timeDelta / 1000;
    let playerPos = this.el.object3D.position;
    let planetPos = this.data.planet.object3D.position;

    // 1. CALCULATE UP VECTOR (Gravity direction)
    // Direction from planet center to player represents the local "Up"
    let upVector = new THREE.Vector3().subVectors(playerPos, planetPos).normalize();

    // 2. PROCESS WASD INPUTS Relative to Camera View
    this.moveVector.set(0, 0, 0);
    if (this.keys['w']) this.moveVector.z -= 1;
    if (this.keys['s']) this.moveVector.z += 1;
    if (this.keys['a']) this.moveVector.x -= 1;
    if (this.keys['d']) this.moveVector.x += 1;
    this.moveVector.normalize();

    // 3. APPLY ROTATION (Yaw / Pitch)
    // Create the base orientation: align player's local Y axis with the planet's up vector
    let targetRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upVector);

    // Apply local mouse look rotations (Yaw around planet-up, Pitch around local side-axis)
    let yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    let pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.rotationX);

    // Combine: Base alignment * Mouse Turn * Mouse Pitch
    this.el.object3D.quaternion.copy(targetRotation).multiply(yawQuat).multiply(pitchQuat);

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
    let currentDist = playerPos.distanceTo(planetPos);

    // Force player onto the surface shell
    playerPos.copy(planetPos).addScaledVector(upVector, desiredDistance);
  }
});