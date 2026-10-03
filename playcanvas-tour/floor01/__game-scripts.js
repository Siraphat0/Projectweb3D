var FpsWalker = pc.createScript("fpsWalker");

FpsWalker.attributes.add("speed", { type: "number", default: 4.5, title: "Movement Speed" });
FpsWalker.attributes.add("lookSpeed", { type: "number", default: 0.22, title: "Mouse Look Speed" });
FpsWalker.attributes.add("jumpForce", { type: "number", default: 4.5, title: "Jump Force" });

FpsWalker.prototype.initialize = function () {
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

    // ─── Smooth Proxy Floor for Floor01 ───
    var floorEntity = new pc.Entity('SmoothFloor01');
    floorEntity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(250, 0.05, 250)
    });
    floorEntity.addComponent('rigidbody', {
        type: 'static',
        friction: 0.05,
        restitution: 0
    });
    this.floorY = 2.38;
    floorEntity.setPosition(0, this.floorY, 0);
    this.app.root.addChild(floorEntity);
    this.floorEntity = floorEntity;

    this.initialPos = this.entity.getPosition().clone();
    this.initialRot = this.entity.getEulerAngles().clone();

    // ─── Eye Entity for Natural Head Motion & Bobbing ───
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

    // ─── Procedural Footstep Audio (Web Audio API) ───
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

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isSprinting ? 95 : 75, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.08);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isSprinting ? 320 : 220, now);

        var vol = isSprinting ? 0.16 : 0.10;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isSprinting ? 0.09 : 0.07));

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
    };

    // Reset player position handler
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

    // ─── Hotspot System & Admin Tool Integration ───
    this.hotspots = [
        {
            id: 'hotspot-9127',
            name: 'ห้อง 9127',
            hint: 'กด [E] หรือคลิกเพื่อเข้าห้อง',
            icon: '🚪',
            url: '../9127/',
            worldPos: new pc.Vec3(0.0, 3.2, -0.6),
            prox: 3.2,
            action: function () {
                if (window.portalTo9127) window.portalTo9127();
                else window.location.href = '../9127/';
            }
        }
    ];

    // Expose position to Admin Editor
    window._hotspotEditorGetPos = function () {
        var p = self.entity.getPosition();
        return { x: p.x, y: p.y, z: p.z };
    };

    // Helper to create or bind DOM element for a hotspot
    function createHotspotDom(hs) {
        var el = document.getElementById(hs.id);
        if (!el) {
            el = document.createElement('div');
            el.id = hs.id;
            el.className = 'hotspot-3d';
            el.title = hs.name;
            el.innerHTML = '<div class="hotspot-ring"></div>' +
                           '<div class="hotspot-dot">' + (hs.icon || '📍') + '</div>' +
                           '<div class="hotspot-label">' +
                           '  <span class="hotspot-title">' + hs.name + '</span>' +
                           '  <span class="hotspot-hint">' + (hs.hint || 'คลิกเพื่อดู') + '</span>' +
                           '</div>';
            el.onclick = function () {
                if (hs.action) hs.action();
                else if (hs.url && hs.url !== '#') window.location.href = hs.url;
            };
            document.body.appendChild(el);
        }
        hs.dom = el;
        return el;
    }

    // Register / Unregister hooks for Admin Editor
    window._hotspotEditorRegister = function (data) {
        var hs = {
            id: data.id,
            name: data.name,
            hint: data.hint,
            icon: data.icon,
            url: data.url,
            worldPos: new pc.Vec3(data.pos.x, data.pos.y, data.pos.z),
            prox: data.prox || 3.0,
            action: function () {
                if (data.url && data.url !== '#') window.location.href = data.url;
            }
        };
        createHotspotDom(hs);
        self.hotspots.push(hs);
    };

    window._hotspotEditorUnregister = function (id) {
        self.hotspots = self.hotspots.filter(function (h) { return h.id !== id; });
        var el = document.getElementById(id);
        if (el) el.remove();
    };

    // Load any saved custom hotspots from localStorage
    try {
        var savedHs = localStorage.getItem('floor01_hotspots_v1');
        if (savedHs) {
            var parsed = JSON.parse(savedHs);
            if (Array.isArray(parsed)) {
                parsed.forEach(function (item) {
                    if (item.id !== 'hotspot-9127') {
                        window._hotspotEditorRegister(item);
                    }
                });
            }
        }
    } catch (e) {}

    // Init existing DOM elements for default hotspots
    this.hotspots.forEach(function (hs) {
        createHotspotDom(hs);
    });

    // Notify window that hotspot editor is ready
    window.dispatchEvent(new CustomEvent('hotspot-editor-ready'));
};

FpsWalker.prototype.rotateCamera = function (dx, dy) {
    var speed = this.lookSpeed || 0.22;
    this.targetEulers.x -= dy * speed;
    this.targetEulers.y -= dx * speed;
    this.targetEulers.x = pc.math.clamp(this.targetEulers.x, -85, 85);
};

FpsWalker.prototype.update = function (dt) {
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

    var accelFactor = Math.min(1, dtSec * 10);
    this.currentVelocity.lerp(this.currentVelocity, input, accelFactor);

    // ─── 3. Physics & Jump ───
    var isGrounded = false;
    if (this.entity.rigidbody) {
        var vel = this.entity.rigidbody.linearVelocity;
        var yVel = vel ? vel.y : 0;

        var pos = this.entity.getPosition();
        var rayEnd = new pc.Vec3(pos.x, pos.y - 0.55, pos.z);
        var hit = this.app.systems.rigidbody.raycastFirst(pos, rayEnd);
        isGrounded = (hit !== null) || (pos.y <= (this.floorY + 0.55));

        if (isGrounded && app.keyboard.wasPressed(pc.KEY_SPACE)) {
            yVel = this.jumpForce || 4.5;
        }

        this.entity.rigidbody.linearVelocity = new pc.Vec3(this.currentVelocity.x, yVel, this.currentVelocity.z);
        this.entity.rigidbody.teleport(this.entity.getPosition(), this.eulers);

        // ─── Hotspots & Proximity Triggers ───
        var cam = this.eyeEntity ? this.eyeEntity.camera : null;
        var camFwd = this.eyeEntity ? this.eyeEntity.forward : null;
        var camPos = this.eyeEntity ? this.eyeEntity.getPosition() : pos;
        var screenPos = new pc.Vec3();

        for (var i = 0; i < this.hotspots.length; i++) {
            var hs = this.hotspots[i];
            var dist = Math.hypot(pos.x - hs.worldPos.x, pos.z - hs.worldPos.z);
            var el = hs.dom || document.getElementById(hs.id);

            if (el && cam) {
                cam.worldToScreen(hs.worldPos, screenPos);
                var toHs = hs.worldPos.clone().sub(camPos).normalize();
                var dot = camFwd ? camFwd.dot(toHs) : 1;

                if (dot > 0.15 && screenPos.z > 0 && dist < 22.0) {
                    el.style.display = 'flex';
                    el.style.left = Math.round(screenPos.x) + 'px';
                    el.style.top = Math.round(screenPos.y) + 'px';
                    var scale = pc.math.clamp(1.15 - (dist / 22.0), 0.7, 1.2);
                    el.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(2) + ')';
                } else {
                    el.style.display = 'none';
                }
            }
        }

        // Room 9127 Doorway Proximity Prompt Banner
        var doorPrompt = document.getElementById('door-9127-prompt');
        if (doorPrompt) {
            var distTo9127 = Math.hypot(pos.x - 0.0, pos.z - (-0.6));
            if (distTo9127 < 3.2 || (pos.z <= 0.2 && pos.x <= 1.2)) {
                if (doorPrompt.style.display !== 'flex') doorPrompt.style.display = 'flex';
                if (app.keyboard.wasPressed(pc.KEY_E)) {
                    if (window.portalTo9127) window.portalTo9127();
                }
            } else {
                if (doorPrompt.style.display === 'flex') doorPrompt.style.display = 'none';
            }
        }

        // Elevator Prompt Banner
        var elevatorPrompt = document.getElementById('elevator-prompt');
        if (elevatorPrompt) {
            if (pos.x <= -6.0) {
                if (elevatorPrompt.style.display !== 'flex') elevatorPrompt.style.display = 'flex';
                if (app.keyboard.wasPressed(pc.KEY_E)) {
                    if (window.showElevatorModal) window.showElevatorModal();
                }
            } else {
                if (elevatorPrompt.style.display === 'flex') elevatorPrompt.style.display = 'none';
            }
        }
    } else {
        this.entity.translate(this.currentVelocity.x * dtSec, 0, this.currentVelocity.z * dtSec);
        isGrounded = true;
    }

    // ─── 4. Realistic Human Head Bobbing, Breathing & Footsteps ───
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

    // Vertical step dip
    var stepPhase = Math.sin(this.bobTimer);
    var bobY = -Math.abs(Math.sin(this.bobTimer)) * (isSprinting ? 0.045 : 0.030) * this.bobWeight;

    // Horizontal head sway (left/right foot weight shift)
    var bobX = Math.cos(this.bobTimer * 0.5) * (isSprinting ? 0.022 : 0.015) * this.bobWeight;

    // Idle breathing
    var breathY = Math.sin(this.breathTimer * 1.5) * 0.008 * (1.0 - this.bobWeight);

    // Subtle bank / roll tilt on strafe
    var strafeAmount = (app.keyboard.isPressed(pc.KEY_A) ? 1 : 0) - (app.keyboard.isPressed(pc.KEY_D) ? 1 : 0);
    var bankRoll = strafeAmount * (isSprinting ? 0.8 : 0.45) * this.bobWeight;
    var headPitch = Math.sin(this.bobTimer) * (isSprinting ? 0.5 : 0.3) * this.bobWeight;

    if (this.eyeEntity) {
        this.eyeEntity.setLocalPosition(bobX, bobY + breathY, 0);
        this.eyeEntity.setLocalEulerAngles(headPitch, 0, bankRoll);

        // Dynamic FOV on sprint
        var targetFov = (isSprinting && isMoving) ? 48.0 : 45.0;
        this.eyeEntity.camera.fov = pc.math.lerp(this.eyeEntity.camera.fov, targetFov, dtSec * 6);
    }

    // Footstep audio trigger
    if (isMoving && this.bobWeight > 0.45) {
        if (this.prevStepPhase > 0 && stepPhase <= 0) {
            this.playFootstep(isSprinting);
        }
    }
    this.prevStepPhase = stepPhase;
};