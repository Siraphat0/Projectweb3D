var FirstPersonController = pc.createScript("firstPersonController");

FirstPersonController.attributes.add("speed", { type: "number", default: 4.5, title: "Speed" });
FirstPersonController.attributes.add("jumpForce", { type: "number", default: 4, title: "Jump Force" });
FirstPersonController.attributes.add("lookSpeed", { type: "number", default: 0.22, title: "Look Speed" });

FirstPersonController.prototype.initialize = function () {
    this.eulers = new pc.Vec3();
    var angles = this.entity.getLocalEulerAngles();
    this.eulers.x = angles.x || 0;
    this.eulers.y = angles.y || 0;

    this.targetEulers = new pc.Vec3(this.eulers.x, this.eulers.y, 0);
    this.currentVelocity = new pc.Vec3();

    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    var self = this;

    // ─── 1. Model Tilt Correction (applied to model in World Space) ───
    var splatEntity = this.app.root.findByName('C1.sog');
    var collisionEntity = this.app.root.findByName('C1');

    this.modelTiltX = 0;
    this.modelTiltZ = 0;

    if (splatEntity) {
        this.origSplatRot = splatEntity.getEulerAngles().clone();
    }
    if (collisionEntity) {
        this.origCollisionRot = collisionEntity.getEulerAngles().clone();
    }

    window.adjustModelLevel = function (dZ, dX) {
        self.modelTiltZ += dZ;
        self.modelTiltX += (dX || 0);

        if (splatEntity && self.origSplatRot) {
            var q = new pc.Quat();
            q.setFromEulerAngles(self.origSplatRot.x, self.origSplatRot.y, self.origSplatRot.z);

            var qCorrection = new pc.Quat();
            qCorrection.setFromEulerAngles(self.modelTiltX, 0, self.modelTiltZ);

            var qResult = new pc.Quat();
            qResult.mul2(qCorrection, q);

            var correctedAngles = new pc.Vec3();
            qResult.getEulerAngles(correctedAngles);
            splatEntity.setEulerAngles(correctedAngles.x, correctedAngles.y, correctedAngles.z);
        }

        if (collisionEntity && self.origCollisionRot) {
            var q2 = new pc.Quat();
            q2.setFromEulerAngles(self.origCollisionRot.x, self.origCollisionRot.y, self.origCollisionRot.z);

            var qC2 = new pc.Quat();
            qC2.setFromEulerAngles(self.modelTiltX, 0, self.modelTiltZ);

            var qR2 = new pc.Quat();
            qR2.mul2(qC2, q2);

            var cAngles = new pc.Vec3();
            qR2.getEulerAngles(cAngles);
            collisionEntity.setEulerAngles(cAngles.x, cAngles.y, cAngles.z);
        }
    };

    // Auto-apply user's calibrated tilt
    window.adjustModelLevel(4.4, -3.0);

    // ─── 2. Smooth Invisible Proxy Floor (Locked at 0.92m) ───
    var floorEntity = new pc.Entity('SmoothInsideFloor');
    floorEntity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(250, 0.05, 250)
    });
    floorEntity.addComponent('rigidbody', {
        type: 'static',
        friction: 0.05,
        restitution: 0
    });
    this.floorY = 0.92;
    floorEntity.setPosition(0, this.floorY, 0);
    this.app.root.addChild(floorEntity);
    this.floorEntity = floorEntity;

    // Initial Standing Position (Eye level ~1.45m above floor)
    var currentPos = this.entity.getPosition().clone();
    this.initialPos = new pc.Vec3(currentPos.x, this.floorY + 1.45, currentPos.z);
    this.initialRot = this.entity.getEulerAngles().clone();

    this.entity.setPosition(this.initialPos);
    if (this.entity.rigidbody) {
        this.entity.rigidbody.teleport(this.initialPos, this.eulers);
    }

    // ─── 3. Eye Entity for Natural Head Motion & Bobbing ───
    var eyeEntity = new pc.Entity('PlayerEye');
    eyeEntity.addComponent('camera', {
        fov: 45,
        nearClip: 0.1,
        farClip: 1000,
        clearColor: new pc.Color(0.12, 0.12, 0.12, 1),
        clearColorBuffer: true,
        clearDepthBuffer: true,
        layers: [0, 1, 2, 3, 4],
        priority: 0
    });
    // Turn off parent camera component to prevent double rendering
    if (this.entity.camera) {
        this.entity.camera.enabled = false;
    }
    this.entity.addChild(eyeEntity);
    this.eyeEntity = eyeEntity;

    // Locomotion states
    this.bobTimer = 0;
    this.bobWeight = 0;
    this.breathTimer = 0;
    this.prevStepPhase = 0;

    // ─── 4. Procedural Footstep Audio (Web Audio API) ───
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });

    this.playFootstep = function (isSprinting) {
        if (!audioCtx) {
            try { audioCtx = new AudioContext(); } catch (e) { return; }
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        var now = audioCtx.currentTime;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        var filter = audioCtx.createBiquadFilter();

        // Low-frequency impact thud (65Hz - 90Hz)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isSprinting ? 95 : 75, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.08);

        // Filter for soft rubber shoe on polished floor tile
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isSprinting ? 320 : 220, now);

        // Volume envelope (gentle, realistic)
        var vol = isSprinting ? 0.16 : 0.10;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isSprinting ? 0.09 : 0.07));

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
    };

    // Global reset
    window.resetPlayerPosition = function () {
        self.eulers.x = self.initialRot.x || 0;
        self.eulers.y = self.initialRot.y || 0;
        self.targetEulers.copy(self.eulers);
        self.currentVelocity.set(0, 0, 0);
        self.bobTimer = 0;
        self.bobWeight = 0;

        if (self.eyeEntity) {
            self.eyeEntity.setLocalPosition(0, 0, 0);
            self.eyeEntity.setLocalEulerAngles(0, 0, 0);
            self.eyeEntity.camera.fov = 45;
        }

        self.entity.setEulerAngles(self.eulers.x, self.eulers.y, 0);

        if (self.entity.rigidbody) {
            self.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
            self.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
            self.entity.rigidbody.teleport(self.initialPos, self.eulers);
        } else {
            self.entity.setPosition(self.initialPos);
        }
    };

    // Mouse Listeners
    window.addEventListener('mousedown', function (e) {
        if (e.button === 0) {
            self.isDragging = true;
            self.lastX = e.clientX;
            self.lastY = e.clientY;
        }
    });

    window.addEventListener('mousemove', function (e) {
        if (self.isDragging) {
            var dx = e.clientX - self.lastX;
            var dy = e.clientY - self.lastY;
            self.lastX = e.clientX;
            self.lastY = e.clientY;
            self.rotateCamera(dx, dy);
        }
    });

    window.addEventListener('mouseup', function () {
        self.isDragging = false;
    });

    // Touch Support
    window.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            self.isDragging = true;
            self.lastX = e.touches[0].clientX;
            self.lastY = e.touches[0].clientY;
        }
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
        if (self.isDragging && e.touches.length === 1) {
            var dx = e.touches[0].clientX - self.lastX;
            var dy = e.touches[0].clientY - self.lastY;
            self.lastX = e.touches[0].clientX;
            self.lastY = e.touches[0].clientY;
            self.rotateCamera(dx, dy);
        }
    }, { passive: true });

    window.addEventListener('touchend', function () {
        self.isDragging = false;
    });
};

FirstPersonController.prototype.rotateCamera = function (dx, dy) {
    var speed = this.lookSpeed || 0.22;
    this.targetEulers.x -= dy * speed;
    this.targetEulers.y -= dx * speed;
    this.targetEulers.x = pc.math.clamp(this.targetEulers.x, -85, 85);
};

FirstPersonController.prototype.update = function (dt) {
    var app = this.app;
    var dtSec = dt || 0.016;

    // ─── 1. Cinematic Smooth Look ───
    var rotSmooth = Math.min(1, dtSec * 16);
    this.eulers.x = pc.math.lerp(this.eulers.x, this.targetEulers.x, rotSmooth);
    this.eulers.y = pc.math.lerp(this.eulers.y, this.targetEulers.y, rotSmooth);
    this.entity.setEulerAngles(this.eulers.x, this.eulers.y, 0);

    // ─── 2. Smooth Movement ───
    var yawRad = this.eulers.y * pc.math.DEG_TO_RAD;
    var forward = new pc.Vec3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    var right   = new pc.Vec3(Math.cos(yawRad), 0, -Math.sin(yawRad));

    var input = new pc.Vec3();
    if (app.keyboard.isPressed(pc.KEY_W) || app.keyboard.isPressed(pc.KEY_UP))    input.add(forward);
    if (app.keyboard.isPressed(pc.KEY_S) || app.keyboard.isPressed(pc.KEY_DOWN))  input.sub(forward);
    if (app.keyboard.isPressed(pc.KEY_A) || app.keyboard.isPressed(pc.KEY_LEFT))  input.sub(right);
    if (app.keyboard.isPressed(pc.KEY_D) || app.keyboard.isPressed(pc.KEY_RIGHT)) input.add(right);

    var targetSpeed = this.speed || 5.8;
    var isSprinting = app.keyboard.isPressed(pc.KEY_SHIFT);
    if (isSprinting) {
        targetSpeed *= 1.7; // ~9.8m/s
    }

    if (input.lengthSq() > 0) {
        input.normalize().scale(targetSpeed);
    }

    var accelFactor = Math.min(1, dtSec * 9);
    this.currentVelocity.lerp(this.currentVelocity, input, accelFactor);

    // ─── 3. Physics & Jump ───
    var isGrounded = false;
    if (this.entity.rigidbody) {
        var vel = this.entity.rigidbody.linearVelocity;
        var yVel = vel ? vel.y : 0;

        var pos = this.entity.getPosition();
        var rayEnd = new pc.Vec3(pos.x, pos.y - 0.52, pos.z);
        var hit = this.app.systems.rigidbody.raycastFirst(pos, rayEnd);
        isGrounded = (hit !== null) || (pos.y <= (this.floorY + 0.52));

        if (isGrounded && app.keyboard.wasPressed(pc.KEY_SPACE)) {
            yVel = this.jumpForce || 4.5;
        }

        this.entity.rigidbody.linearVelocity = new pc.Vec3(this.currentVelocity.x, yVel, this.currentVelocity.z);
        this.entity.rigidbody.teleport(this.entity.getPosition(), this.eulers);

        // ─── 4. Doorway Trigger Check ───
        var doorFloor01Prompt = document.getElementById('door-floor01-prompt');
        if (doorFloor01Prompt) {
            if (pos.z <= 0.5 || pos.x <= 7.5) {
                if (doorFloor01Prompt.style.display !== 'flex') doorFloor01Prompt.style.display = 'flex';
                if (app.keyboard.wasPressed(pc.KEY_E)) {
                    if (window.portalToFloor01) window.portalToFloor01();
                }
            } else {
                if (doorFloor01Prompt.style.display === 'flex') doorFloor01Prompt.style.display = 'none';
            }
        }
    } else {
        this.entity.translate(this.currentVelocity.x * dtSec, 0, this.currentVelocity.z * dtSec);
        isGrounded = true;
    }

    // ─── 5. Realistic Human Head Bobbing, Breathing & Footsteps ───
    var moveSpeed = this.currentVelocity.length();
    var isMoving = (moveSpeed > 0.4) && isGrounded;
    var stepRate = isSprinting ? 12.0 : 8.8;

    if (isMoving) {
        this.bobTimer += dtSec * stepRate;
        this.bobWeight = pc.math.lerp(this.bobWeight, 1.0, dtSec * 8);
    } else {
        this.bobWeight = pc.math.lerp(this.bobWeight, 0.0, dtSec * 6);
    }

    this.breathTimer += dtSec;

    // Vertical dip on each step (inverted pendulum kinematics)
    var stepPhase = Math.sin(this.bobTimer);
    var bobY = -Math.abs(Math.sin(this.bobTimer)) * (isSprinting ? 0.045 : 0.030) * this.bobWeight;

    // Horizontal head sway (left/right foot weight shift)
    var bobX = Math.cos(this.bobTimer * 0.5) * (isSprinting ? 0.022 : 0.015) * this.bobWeight;

    // Idle breathing (gentle 8mm chest rise and fall when stationary)
    var breathY = Math.sin(this.breathTimer * 1.5) * 0.008 * (1.0 - this.bobWeight);

    // Subtle head tilt / banking when strafing
    var strafeAmount = (app.keyboard.isPressed(pc.KEY_A) ? 1 : 0) - (app.keyboard.isPressed(pc.KEY_D) ? 1 : 0);
    var bankRoll = strafeAmount * (isSprinting ? 0.8 : 0.45) * this.bobWeight;
    var headPitch = Math.sin(this.bobTimer) * (isSprinting ? 0.5 : 0.3) * this.bobWeight;

    // Apply smooth local offsets to eye entity
    if (this.eyeEntity) {
        this.eyeEntity.setLocalPosition(bobX, bobY + breathY, 0);
        this.eyeEntity.setLocalEulerAngles(headPitch, 0, bankRoll);

        // Dynamic FOV (Subtle widening on sprint)
        var targetFov = (isSprinting && isMoving) ? 48.0 : 45.0;
        this.eyeEntity.camera.fov = pc.math.lerp(this.eyeEntity.camera.fov, targetFov, dtSec * 6);
    }

    // Footstep audio trigger on downward foot impact
    if (isMoving && this.bobWeight > 0.45) {
        if (this.prevStepPhase > 0 && stepPhase <= 0) {
            this.playFootstep(isSprinting);
        }
    }
    this.prevStepPhase = stepPhase;
};