// Room 9127 FPS Walker - Full parity with Floor 01/03/04/05
// Provides smooth mouse look (drag + pointer lock), natural WASD locomotion,
// head bobbing, footsteps audio, and doorway portal back to Floor 01.

var FpsWalker = pc.createScript("fpsWalker");

FpsWalker.attributes.add("speed",     { type: "number", default: 5.8,  title: "Movement Speed" });
FpsWalker.attributes.add("lookSpeed", { type: "number", default: 0.22, title: "Mouse Look Speed" });
FpsWalker.attributes.add("jumpForce", { type: "number", default: 4.5,  title: "Jump Force" });

FpsWalker.prototype._createProxyFloor = function (floorY) {
    var app = this.app;
    this.floorY = floorY;
    var floorEnt = new pc.Entity("SmoothFloor9127");
    floorEnt.addComponent("collision", { type: "box", halfExtents: new pc.Vec3(60, 0.25, 60) });
    floorEnt.addComponent("rigidbody", { type: pc.BODYTYPE_STATIC, friction: 0.3, restitution: 0.0 });
    floorEnt.setPosition(0, floorY - 0.25, 0);
    app.root.addChild(floorEnt);
    this._proxyFloor = floorEnt;
    var self = this;
    window.adjustFloorY = function (delta) {
        self.floorY += delta;
        self._proxyFloor.setPosition(0, self.floorY - 0.25, 0);
        self._proxyFloor.rigidbody.teleport(self._proxyFloor.getPosition(), self._proxyFloor.getEulerAngles());
        console.log("[Room 9127] floorY =", self.floorY.toFixed(3));
    };
};

FpsWalker.prototype.initialize = function () {
    var self = this;
    var app  = this.app;

    this.eulers       = new pc.Vec3();
    this.targetEulers = new pc.Vec3();

    var angles = this.entity.getLocalEulerAngles();
    var pitch = angles.x || 0;
    var yaw   = angles.y || 0;
    var roll  = angles.z || 0;

    // ─── แก้ปัญหากล้องกลับหัว (Inverted / Upside-down camera fix) ───
    if (Math.abs(Math.abs(roll) - 180) < 45 || Math.abs(pitch) > 85) {
        if (Math.abs(Math.abs(roll) - 180) < 45) {
            pitch = (pitch > 0) ? (180 - pitch) : (-180 - pitch);
            yaw = (yaw + 180) % 360;
        }
        pitch = pc.math.clamp(pitch, -85, 85);
        roll = 0;
    }

    this.eulers.set(pitch, yaw, 0);
    this.targetEulers.set(pitch, yaw, 0);
    this.entity.setEulerAngles(pitch, yaw, 0);

    this.currentVelocity = new pc.Vec3();
    this.initialPos = this.entity.getPosition().clone();
    this.initialRot = new pc.Vec3(pitch, yaw, 0);

    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    // Smooth proxy floor to guarantee zero snagging
    this._createProxyFloor(1.655);
    this._spawnLock = 15;

    if (this.entity.rigidbody) {
        this.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
        this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
        this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
    } else {
        this.entity.setPosition(this.initialPos);
        this.entity.setEulerAngles(this.initialRot);
    }

    // Reset handler for HUD button
    window.resetPlayerPosition = function () {
        self.eulers.set(self.initialRot.x, self.initialRot.y, 0);
        self.targetEulers.set(self.initialRot.x, self.initialRot.y, 0);
        self.currentVelocity.set(0, 0, 0);
        if (self.eyeEntity) {
            self.eyeEntity.setLocalPosition(0, 0, 0);
            self.eyeEntity.setLocalEulerAngles(0, 0, 0);
        }
        if (self.entity.rigidbody) {
            self.entity.rigidbody.linearVelocity  = pc.Vec3.ZERO;
            self.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
            self.entity.rigidbody.teleport(self.initialPos, self.initialRot);
        } else {
            self.entity.setPosition(self.initialPos);
            self.entity.setEulerAngles(self.initialRot);
        }
    };

    // Locomotion & bobbing states
    this.bobTimer      = 0;
    this.breathTimer   = 0;
    this.bobWeight     = 0;
    this.prevStepPhase = 0;

    // Dedicated Eye Entity for natural head motion & bobbing
    var eyeEntity = new pc.Entity("PlayerEye");
    eyeEntity.addComponent("camera", {
        clearColor: this.entity.camera.clearColor,
        farClip:    this.entity.camera.farClip,
        nearClip:   this.entity.camera.nearClip,
        fov: 45
    });
    this.entity.addChild(eyeEntity);
    this.eyeEntity = eyeEntity;
    this.entity.camera.enabled = false;

    // Footsteps sound via Web Audio API
    try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioCtx();
    } catch (e) {
        this.audioCtx = null;
    }

    this.playFootstep = function (isSprint) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === "suspended") this.audioCtx.resume();
        var t = this.audioCtx.currentTime;
        var osc = this.audioCtx.createOscillator();
        var gain = this.audioCtx.createGain();
        var filter = this.audioCtx.createBiquadFilter();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(60 + Math.random() * 20, t);
        osc.frequency.exponentialRampToValueAtTime(18, t + 0.08);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(180, t);

        var vol = isSprint ? 0.12 : 0.08;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(t);
        osc.stop(t + 0.1);
    };

    var canvas = app.graphicsDevice.canvas;

    // ─── Mouse Look Handlers (Drag + Pointer Lock) ───
    var onDown = function (e) {
        if (self.audioCtx && self.audioCtx.state === "suspended") self.audioCtx.resume();

        // Avoid capturing click if user clicked on UI overlays
        if (e.target && e.target.closest && (
            e.target.closest('#tour-hud') ||
            e.target.closest('#hudFloorDropdown') ||
            e.target.closest('.hud-btn') ||
            e.target.closest('#door-prompt') ||
            e.target.closest('#loading-screen')
        )) {
            return;
        }

        self.isDragging = true;
        self.lastX = e.clientX;
        self.lastY = e.clientY;
    };

    var onUp = function () {
        self.isDragging = false;
    };

    var onMove = function (e) {
        var sens = self.lookSpeed || 0.22;

        // Pointer Lock mode (continuous FPS mouse look)
        if (document.pointerLockElement === canvas) {
            var mX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            var mY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
            self.targetEulers.y -= mX * sens * 0.75;
            self.targetEulers.x -= mY * sens * 0.75;
            self.targetEulers.x = Math.max(-85, Math.min(85, self.targetEulers.x));
            return;
        }

        // Drag to look mode
        if (!self.isDragging) return;
        var dx = e.clientX - self.lastX;
        var dy = e.clientY - self.lastY;
        self.lastX = e.clientX;
        self.lastY = e.clientY;

        self.targetEulers.y -= dx * sens;
        self.targetEulers.x -= dy * sens;
        self.targetEulers.x = Math.max(-85, Math.min(85, self.targetEulers.x));
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);

    // Pointer Lock Toggle Helper
    window.togglePointerLock = function () {
        if (document.pointerLockElement === canvas) {
            document.exitPointerLock();
        } else {
            canvas.requestPointerLock();
        }
    };

    // Update UI on pointer lock change
    document.addEventListener("pointerlockchange", function () {
        var isLocked = (document.pointerLockElement === canvas);
        var btn = document.getElementById("btn-pointerlock");
        var text = document.getElementById("pointerlock-text");
        if (btn && text) {
            if (isLocked) {
                btn.classList.add("active");
                text.textContent = "ปลดล็อคเมาส์ (ESC)";
            } else {
                btn.classList.remove("active");
                text.textContent = "เมาส์อิสระ";
            }
        }
    });

    // Touch Support for mobile / tablet
    canvas.addEventListener("touchstart", function (e) {
        if (e.touches.length === 1) {
            if (self.audioCtx && self.audioCtx.state === "suspended") self.audioCtx.resume();
            self.isDragging = true;
            self.lastX = e.touches[0].clientX;
            self.lastY = e.touches[0].clientY;
        }
    }, { passive: true });

    canvas.addEventListener("touchmove", function (e) {
        if (self.isDragging && e.touches.length === 1) {
            var dx = e.touches[0].clientX - self.lastX;
            var dy = e.touches[0].clientY - self.lastY;
            self.lastX = e.touches[0].clientX;
            self.lastY = e.touches[0].clientY;
            var sens = self.lookSpeed || 0.22;
            self.targetEulers.y -= dx * sens * 1.2;
            self.targetEulers.x -= dy * sens * 1.2;
            self.targetEulers.x = Math.max(-85, Math.min(85, self.targetEulers.x));
        }
    }, { passive: true });

    canvas.addEventListener("touchend", function () {
        self.isDragging = false;
    });

    this.on("destroy", function () {
        canvas.removeEventListener("mousedown", onDown);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("mousemove", onMove);
    });
};

FpsWalker.prototype.update = function (dt) {
    var app   = this.app;
    var dtSec = dt || 0.016;

    // ─── Spawn-Lock: กันมุมกล้องพลิกหรือตกจากพื้น 15 เฟรมแรก ───
    if (this._spawnLock > 0) {
        this._spawnLock--;
        this.entity.setPosition(this.initialPos);
        this.entity.setEulerAngles(this.initialRot);
        if (this.entity.rigidbody) {
            this.entity.rigidbody.linearVelocity  = pc.Vec3.ZERO;
            this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
            this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
        }
        return;
    }

    // ─── 1. Cinematic Smooth Camera Look ───
    var rotSmooth = Math.min(1, dtSec * 16);
    this.eulers.x = pc.math.lerp(this.eulers.x, this.targetEulers.x, rotSmooth);
    this.eulers.y = pc.math.lerp(this.eulers.y, this.targetEulers.y, rotSmooth);
    this.entity.setEulerAngles(this.eulers.x, this.eulers.y, 0);

    // ─── 2. Locomotion Direction Aligned with Camera Yaw ───
    var yawRad  = this.eulers.y * pc.math.DEG_TO_RAD;
    var forward = new pc.Vec3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    var right   = new pc.Vec3( Math.cos(yawRad), 0, -Math.sin(yawRad));

    var input = new pc.Vec3();
    if (app.keyboard.isPressed(pc.KEY_W) || app.keyboard.isPressed(pc.KEY_UP))    input.add(forward);
    if (app.keyboard.isPressed(pc.KEY_S) || app.keyboard.isPressed(pc.KEY_DOWN))  input.sub(forward);
    if (app.keyboard.isPressed(pc.KEY_A) || app.keyboard.isPressed(pc.KEY_LEFT))  input.sub(right);
    if (app.keyboard.isPressed(pc.KEY_D) || app.keyboard.isPressed(pc.KEY_RIGHT)) input.add(right);

    var targetSpeed = this.speed || 5.8;
    var isSprinting = app.keyboard.isPressed(pc.KEY_SHIFT);
    if (isSprinting) {
        targetSpeed *= 1.7; // ~9.8 m/s sprint
    }

    if (input.lengthSq() > 0) {
        input.normalize().scale(targetSpeed);
    }

    var accelFactor = Math.min(1, dtSec * 10);
    this.currentVelocity.lerp(this.currentVelocity, input, accelFactor);

    // ─── 3. Physics & Grounding ───
    var isGrounded = false;
    if (this.entity.rigidbody) {
        var vel  = this.entity.rigidbody.linearVelocity;
        var yVel = vel ? vel.y : 0;
        var pos  = this.entity.getPosition();

        var rayEnd = new pc.Vec3(pos.x, pos.y - 0.70, pos.z);
        var hit    = this.app.systems.rigidbody.raycastFirst(pos, rayEnd);
        isGrounded = (hit !== null) || (pos.y <= (this.floorY + 0.60));

        if (isGrounded && app.keyboard.wasPressed(pc.KEY_SPACE)) {
            yVel = this.jumpForce || 4.5;
        }

        // Safety fallback: if player glitches below floor
        if (pos.y < (this.floorY - 4.0)) {
            this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
            this.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
            return;
        }

        this.entity.rigidbody.linearVelocity = new pc.Vec3(this.currentVelocity.x, yVel, this.currentVelocity.z);
        this.entity.rigidbody.teleport(this.entity.getPosition(), this.eulers);
    } else {
        this.entity.translate(this.currentVelocity.x * dtSec, 0, this.currentVelocity.z * dtSec);
        isGrounded = true;
    }

    // ─── 4. Head Bobbing & Natural Breathing ───
    var moveSpeed = this.currentVelocity.length();
    var isMoving  = (moveSpeed > 0.4) && isGrounded;
    var stepRate  = isSprinting ? 12.8 : 9.6;

    if (isMoving) {
        this.bobTimer  += dtSec * stepRate;
        this.bobWeight  = pc.math.lerp(this.bobWeight, 1.0, dtSec * 8);

        var phase = Math.sin(this.bobTimer);
        if (this.prevStepPhase < 0 && phase >= 0) {
            this.playFootstep(isSprinting);
        }
        this.prevStepPhase = phase;
    } else {
        this.bobWeight  = pc.math.lerp(this.bobWeight, 0.0, dtSec * 6);
    }
    this.breathTimer += dtSec;

    if (this.eyeEntity) {
        var bobY    = Math.sin(this.bobTimer) * 0.038 * this.bobWeight;
        var bobX    = Math.cos(this.bobTimer * 0.5) * 0.022 * this.bobWeight;
        var breathY = Math.sin(this.breathTimer * 1.5) * 0.008;

        this.eyeEntity.setLocalPosition(bobX, bobY + breathY, 0);
        this.eyeEntity.setLocalEulerAngles(0, 0, Math.cos(this.bobTimer * 0.5) * 0.65 * this.bobWeight);
    }

    // ─── 5. Check Proximity to Doorway & [E] Key to Exit back to Floor 01 ───
    var distToDoor = this.entity.getPosition().distance(this.initialPos);
    var doorPrompt = document.getElementById("door-prompt");
    if (doorPrompt) {
        if (distToDoor < 4.0) {
            doorPrompt.style.display = "flex";
        } else {
            doorPrompt.style.display = "none";
        }
    }

    if (app.keyboard.wasPressed(pc.KEY_E)) {
        if (typeof window.portalToFloor01 === "function") {
            window.portalToFloor01();
        } else {
            window.location.href = "../floor01/?from=9127";
        }
    }
};
