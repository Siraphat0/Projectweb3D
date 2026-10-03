// Floor 04 FPS Walker - Full parity with Floor 01
var FpsWalker = pc.createScript("fpsWalker");
FpsWalker.attributes.add("speed",     { type: "number", default: 4.5, title: "Movement Speed" });
FpsWalker.attributes.add("lookSpeed", { type: "number", default: 0.22, title: "Mouse Look Speed" });
FpsWalker.attributes.add("jumpForce", { type: "number", default: 4.5, title: "Jump Force" });

FpsWalker.prototype._createProxyFloor = function (floorY) {
    var app = this.app;
    this.floorY = floorY;
    var floorEnt = new pc.Entity("SmoothFloor04");
    floorEnt.addComponent("collision", { type: "box", halfExtents: new pc.Vec3(60, 0.25, 60) });
    floorEnt.addComponent("rigidbody", { type: pc.BODYTYPE_STATIC, friction: 0.6, restitution: 0.0 });
    floorEnt.setPosition(0, floorY - 0.25, 0);
    app.root.addChild(floorEnt);
    this._proxyFloor = floorEnt;
    var self = this;
    window.adjustFloorY = function (delta) {
        self.floorY += delta;
        self._proxyFloor.setPosition(0, self.floorY - 0.25, 0);
        self._proxyFloor.rigidbody.teleport(self._proxyFloor.getPosition(), self._proxyFloor.getEulerAngles());
        console.log("[Floor04] floorY =", self.floorY.toFixed(3));
    };
};

FpsWalker.prototype.initialize = function () {
    var self = this;
    var app  = this.app;
    this.eulers       = new pc.Vec3();
    this.targetEulers = new pc.Vec3();
    var angles = this.entity.getLocalEulerAngles();
    this.eulers.x = this.targetEulers.x = angles.x || 0;
    this.eulers.y = this.targetEulers.y = angles.y || 0;
    this.currentVelocity = new pc.Vec3();
    this.initialPos = this.entity.getPosition().clone();
    this.initialRot = this.entity.getEulerAngles().clone();
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    // camera y=3.417 -> eyes ~1.65 above floor -> floorY ~ 1.85
    this._createProxyFloor(1.85);
    var currentPos = this.entity.getPosition();
    this.elevatorPos = new pc.Vec2(currentPos.x, currentPos.z);
    if (this.entity.rigidbody) {
        this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
    } else {
        this.entity.setPosition(this.initialPos);
    }
    window.resetPlayerPosition = function () {
        self.eulers.set(self.initialRot.x, self.initialRot.y, 0);
        self.targetEulers.set(self.initialRot.x, self.initialRot.y, 0);
        self.currentVelocity.set(0, 0, 0);
        if (self.entity.rigidbody) {
            self.entity.rigidbody.linearVelocity  = pc.Vec3.ZERO;
            self.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
            self.entity.rigidbody.teleport(self.initialPos, self.initialRot);
        } else {
            self.entity.setPosition(self.initialPos);
            self.entity.setEulerAngles(self.initialRot);
        }
    };
    this.bobTimer = 0;
    this.breathTimer = 0;
    this.bobWeight = 0;
    this.prevStepPhase = 0;
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
    try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioCtx();
    } catch (e) { this.audioCtx = null; }
    this.playFootstep = function (isSprint) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === "suspended") this.audioCtx.resume();
        var t = this.audioCtx.currentTime;
        var osc = this.audioCtx.createOscillator();
        var gain = this.audioCtx.createGain();
        var filter = this.audioCtx.createBiquadFilter();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(55 + Math.random() * 20, t);
        osc.frequency.exponentialRampToValueAtTime(15, t + 0.08);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(160, t);
        var vol = isSprint ? 0.12 : 0.08;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(filter); filter.connect(gain); gain.connect(this.audioCtx.destination);
        osc.start(t); osc.stop(t + 0.1);
    };
    var canvas = app.graphicsDevice.canvas;
    var onDown = function (e) {
        if (self.audioCtx && self.audioCtx.state === "suspended") self.audioCtx.resume();
        self.isDragging = true;
        self.lastX = e.clientX; self.lastY = e.clientY;
    };
    var onUp = function () { self.isDragging = false; };
    var onMove = function (e) {
        if (!self.isDragging) return;
        var dx = e.clientX - self.lastX;
        var dy = e.clientY - self.lastY;
        self.lastX = e.clientX; self.lastY = e.clientY;
        var sens = self.lookSpeed || 0.22;
        self.targetEulers.y -= dx * sens;
        self.targetEulers.x -= dy * sens;
        self.targetEulers.x = Math.max(-85, Math.min(85, self.targetEulers.x));
    };
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("touchstart", function (e) {
        if (e.touches.length === 1) {
            if (self.audioCtx && self.audioCtx.state === "suspended") self.audioCtx.resume();
            self.isDragging = true;
            self.lastX = e.touches[0].clientX; self.lastY = e.touches[0].clientY;
        }
    }, { passive: true });
    canvas.addEventListener("touchmove", function (e) {
        if (self.isDragging && e.touches.length === 1) {
            var dx = e.touches[0].clientX - self.lastX;
            var dy = e.touches[0].clientY - self.lastY;
            self.lastX = e.touches[0].clientX; self.lastY = e.touches[0].clientY;
            var sens = self.lookSpeed || 0.22;
            self.targetEulers.y -= dx * sens * 1.2;
            self.targetEulers.x -= dy * sens * 1.2;
            self.targetEulers.x = Math.max(-85, Math.min(85, self.targetEulers.x));
        }
    }, { passive: true });
    canvas.addEventListener("touchend", function () { self.isDragging = false; });
    this.on("destroy", function () {
        canvas.removeEventListener("mousedown", onDown);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("mousemove", onMove);
    });
    // ─── Hotspot System ───
    this.hotspots = [
        {
            id: 'hs_elevator_floor04',
            name: 'ลิฟต์ชั้น 4',
            hint: 'กด [E] หรือคลิกเพื่อเลือกชั้น',
            icon: '🛗',
            url: '#elevator',
            pos: { x: 0.08, y: 2.80, z: 24.32 },
            prox: 5.0
        },
        {
            id: 'hs_1791026569984',
            name: 'ห้อง9428',
            hint: 'คลิกเพื่อเข้า',
            icon: '🚪',
            url: '#',
            pos: { x: 1.679, y: 3.15, z: 21.867 },
            prox: 3.0
        }
    ];

    window._hotspotEditorGetPos = function () {
        var pos = self.entity.getPosition();
        return { x: pos.x, y: pos.y, z: pos.z };
    };

    function createHotspotDot(hs) {
        var existing = document.getElementById('hs-dot-' + hs.id);
        if (existing) return existing;
        var isElev = (hs.name && hs.name.indexOf('ลิฟต์') !== -1) || (hs.url === '#elevator');
        var el = document.createElement('div');
        el.id = 'hs-dot-' + hs.id;
        el.className = 'hotspot-3d';
        el.title = hs.name;
        var iconHtml = isElev ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M8 10l-2-2 2-2M16 14l2 2-2 2"/></svg>' : (hs.icon || '📍');
        el.innerHTML = '<div class="hotspot-ring"></div>' +
                       '<div class="hotspot-dot">' + iconHtml + '</div>' +
                       '<div class="hotspot-label">' +
                       '  <span class="hotspot-title">' + hs.name + '</span>' +
                       '  <span class="hotspot-hint">' + (hs.hint || 'คลิกเพื่อเข้า') + '</span>' +
                       '</div>';
        el.onclick = function () {
            if (isElev && window.showElevatorModal) { window.showElevatorModal(); return; }
            if (hs.url && hs.url.startsWith('http')) { window.open(hs.url, '_blank'); return; }
            if (hs.url && hs.url !== '#') window.location.href = hs.url;
        };
        el.style.display = 'none';
        document.body.appendChild(el);
        return el;
    }

    window._hotspotEditorRegister = function (hs) {
        var existing = self.hotspots.find(function(h) { return h.id === hs.id; });
        if (existing) return;
        self.hotspots.push(hs);
        createHotspotDot(hs);
    };

    window._hotspotEditorUnregister = function (id) {
        self.hotspots = self.hotspots.filter(function (h) { return h.id !== id; });
        var el = document.getElementById('hs-dot-' + id);
        if (el) el.remove();
    };

    // Load saved hotspots from localStorage
    try {
        var savedHs = localStorage.getItem('floor04_hotspots_v1');
        if (savedHs) {
            var parsed = JSON.parse(savedHs);
            if (Array.isArray(parsed)) {
                parsed.forEach(function(item) {
                    window._hotspotEditorRegister(item);
                });
            }
        }
    } catch(e) {}

    // Init DOM for default hotspots
    self.hotspots.forEach(function(hs) { createHotspotDot(hs); });

    window.dispatchEvent(new CustomEvent('hotspot-editor-ready'));
};

FpsWalker.prototype.update = function (dt) {
    var dtSec = Math.min(dt, 0.1);
    var app = this.app;
    var rotSmooth = Math.min(1, dtSec * 16);
    this.eulers.x = pc.math.lerp(this.eulers.x, this.targetEulers.x, rotSmooth);
    this.eulers.y = pc.math.lerp(this.eulers.y, this.targetEulers.y, rotSmooth);
    this.entity.setEulerAngles(this.eulers.x, this.eulers.y, 0);
    var yawRad  = this.eulers.y * pc.math.DEG_TO_RAD;
    var forward = new pc.Vec3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    var right   = new pc.Vec3( Math.cos(yawRad), 0, -Math.sin(yawRad));
    var input = new pc.Vec3();
    if (app.keyboard.isPressed(pc.KEY_W) || app.keyboard.isPressed(pc.KEY_UP))    input.add(forward);
    if (app.keyboard.isPressed(pc.KEY_S) || app.keyboard.isPressed(pc.KEY_DOWN))  input.sub(forward);
    if (app.keyboard.isPressed(pc.KEY_A) || app.keyboard.isPressed(pc.KEY_LEFT))  input.sub(right);
    if (app.keyboard.isPressed(pc.KEY_D) || app.keyboard.isPressed(pc.KEY_RIGHT)) input.add(right);
    var isSprinting = app.keyboard.isPressed(pc.KEY_SHIFT);
    var targetSpeed = this.speed || 4.5;
    if (isSprinting) targetSpeed *= 1.65;
    if (input.lengthSq() > 0) input.normalize().scale(targetSpeed);
    var accelFactor = Math.min(1, dtSec * 10);
    this.currentVelocity.lerp(this.currentVelocity, input, accelFactor);
    var isGrounded = false;
    if (this.entity.rigidbody) {
        var vel = this.entity.rigidbody.linearVelocity;
        var yVel = vel ? vel.y : 0;
        var pos = this.entity.getPosition();
        var rayEnd = new pc.Vec3(pos.x, pos.y - 0.70, pos.z);
        var hit = this.app.systems.rigidbody.raycastFirst(pos, rayEnd);
        isGrounded = (hit !== null) || (pos.y <= (this.floorY + 0.60));
        if (isGrounded && app.keyboard.wasPressed(pc.KEY_SPACE)) yVel = this.jumpForce || 4.5;
        if (pos.y < (this.floorY - 5.0)) {
            this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
            this.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
            return;
        }
        this.entity.rigidbody.linearVelocity = new pc.Vec3(this.currentVelocity.x, yVel, this.currentVelocity.z);
        this.entity.rigidbody.teleport(this.entity.getPosition(), this.eulers);
        var elevatorPrompt = document.getElementById("elevator-prompt");
        if (elevatorPrompt && this.elevatorPos) {
            var distToElev = Math.hypot(pos.x - this.elevatorPos.x, pos.z - this.elevatorPos.y);
            if (distToElev <= 3.5) {
                if (elevatorPrompt.style.display !== "flex") elevatorPrompt.style.display = "flex";
                if (app.keyboard.wasPressed(pc.KEY_E)) { if (window.showElevatorModal) window.showElevatorModal(); }
            } else {
                if (elevatorPrompt.style.display === "flex") elevatorPrompt.style.display = "none";
            }
        }
    } else {
        this.entity.translate(this.currentVelocity.x * dtSec, 0, this.currentVelocity.z * dtSec);
        isGrounded = true;
    }
    var moveSpeed = this.currentVelocity.length();
    var isMoving  = (moveSpeed > 0.4) && isGrounded;
    var stepRate  = isSprinting ? 12.8 : 9.6;
    if (isMoving) {
        this.bobTimer  += dtSec * stepRate;
        this.bobWeight  = pc.math.lerp(this.bobWeight, 1.0, dtSec * 8);
    } else {
        this.bobWeight  = pc.math.lerp(this.bobWeight, 0.0, dtSec * 6);
    }
    this.breathTimer += dtSec;
    var stepPhase = Math.sin(this.bobTimer);
    var bobY  = -Math.abs(Math.sin(this.bobTimer)) * (isSprinting ? 0.045 : 0.030) * this.bobWeight;
    var bobX  =  Math.cos(this.bobTimer * 0.5)     * (isSprinting ? 0.022 : 0.015) * this.bobWeight;
    var breathY = Math.sin(this.breathTimer * 1.5) * 0.008 * (1.0 - this.bobWeight);
    var strafeAmt = (app.keyboard.isPressed(pc.KEY_A) ? 1 : 0) - (app.keyboard.isPressed(pc.KEY_D) ? 1 : 0);
    var bankRoll  = strafeAmt * (isSprinting ? 0.8 : 0.45) * this.bobWeight;
    var headPitch = Math.sin(this.bobTimer) * (isSprinting ? 0.5 : 0.3) * this.bobWeight;
    if (this.eyeEntity) {
        this.eyeEntity.setLocalPosition(bobX, bobY + breathY, 0);
        this.eyeEntity.setLocalEulerAngles(headPitch, 0, bankRoll);
        var targetFov = (isSprinting && isMoving) ? 48.0 : 45.0;
        this.eyeEntity.camera.fov = pc.math.lerp(this.eyeEntity.camera.fov, targetFov, dtSec * 6);
    }
    if (isMoving && this.bobWeight > 0.45) {
        if (this.prevStepPhase > 0 && stepPhase <= 0) this.playFootstep(isSprinting);
    }
    this.prevStepPhase = stepPhase;
    if (this.hotspots.length > 0 && this.eyeEntity) {
        var cam = this.eyeEntity;
        var camPos = cam.getPosition();
        var camFwd = cam.forward;
        var screenPosH = new pc.Vec3();
        for (var i = 0; i < this.hotspots.length; i++) {
            var hs  = this.hotspots[i];
            var dot = document.getElementById('hs-dot-' + hs.id);
            if (!dot) continue;
            var hsPos = new pc.Vec3(
                (hs.pos ? hs.pos.x : (hs.x || 0)),
                (hs.pos ? hs.pos.y : (hs.y || 0)),
                (hs.pos ? hs.pos.z : (hs.z || 0))
            );
            cam.camera.worldToScreen(hsPos, screenPosH);
            var toHs = hsPos.clone().sub(camPos).normalize();
            var dot2 = camFwd ? camFwd.dot(toHs) : 1;
            var dist = Math.hypot(pos.x - hsPos.x, pos.z - hsPos.z);
            if (dot2 > 0.15 && screenPosH.z > 0 && dist < 22.0) {
                dot.style.display = 'flex';
                dot.style.left    = Math.round(screenPosH.x) + 'px';
                dot.style.top     = Math.round(screenPosH.y) + 'px';
                var scaleH = pc.math.clamp(1.15 - (dist / 22.0), 0.7, 1.2);
                dot.style.transform = 'translate(-50%,-50%) scale(' + scaleH.toFixed(2) + ')';
            } else {
                dot.style.display = 'none';
            }
        }
    }
    if (app.keyboard.wasPressed(pc.KEY_OPEN_BRACKET))  { if (window.adjustFloorY) window.adjustFloorY(-0.05); }
    if (app.keyboard.wasPressed(pc.KEY_CLOSE_BRACKET)) { if (window.adjustFloorY) window.adjustFloorY( 0.05); }
};
