var FpsWalker = pc.createScript("fpsWalker");

FpsWalker.attributes.add("speed", { type: "number", default: 4.5, title: "Speed" });
FpsWalker.attributes.add("jumpForce", { type: "number", default: 4.5, title: "Jump Force" });
FpsWalker.attributes.add("lookSpeed", { type: "number", default: 0.22, title: "Look Speed" });

FpsWalker.prototype.initialize = function () {
    this.eulers = new pc.Vec3();
    var angles = this.entity.getLocalEulerAngles();
    var pitch = angles.x || 0;
    var yaw = angles.y || 0;
    var roll = angles.z || 0;

    // ─── แก้ปัญหากล้องกลับหัว (Upside-down camera fix) ───
    // ถ้า roll หรือ pitch กลับหัว (roll ~ 180 หรือ pitch > 85) ปรับกลับเป็นมุมมองแนวตั้งระดับสายตา
    if (Math.abs(Math.abs(roll) - 180) < 30 || Math.abs(pitch) > 85) {
        pitch = -7.1;
        yaw = -92.35;
        roll = 0;
        this.entity.setEulerAngles(pitch, yaw, 0);
    }

    this.eulers.x = pitch;
    this.eulers.y = yaw;
    this.targetEulers = new pc.Vec3(this.eulers.x, this.eulers.y, 0);
    this.currentVelocity = new pc.Vec3();

    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    var self = this;

    // ─── Smooth Proxy Floor for Floor 05 (สร้างพื้นล่องหนเหมือนชั้น 2) ───
    var floorEntity = new pc.Entity('SmoothFloor05');
    floorEntity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(250, 0.05, 250) // แผ่นพื้นฟิสิกส์กว้างราบเรียบเหมือนชั้น 2
    });
    floorEntity.addComponent('rigidbody', {
        type: 'static',
        friction: 0.05,
        restitution: 0
    });
    // ระดับพื้นตามที่ปรับแต่งไว้ (0.15m) เพื่อให้เดินผ่านเก้าอี้และพื้นผิวขรุขระได้อย่างราบรื่น
    this.floorY = 0.15;
    floorEntity.setPosition(0, this.floorY, 0);
    this.app.root.addChild(floorEntity);
    this.floorEntity = floorEntity;

    // Real-time floor height adjust
    window.adjustFloorY = function (delta) {
        self.floorY += delta;
        if (self.floorEntity && self.floorEntity.rigidbody) {
            self.floorEntity.rigidbody.teleport(new pc.Vec3(0, self.floorY, 0), pc.Vec3.ZERO);
        }
        var curP = self.entity.getPosition();
        if (curP.y < self.floorY + 0.5) {
            self.entity.setPosition(curP.x, self.floorY + 1.45, curP.z);
            if (self.entity.rigidbody) {
                self.entity.rigidbody.teleport(new pc.Vec3(curP.x, self.floorY + 1.45, curP.z), self.eulers);
            }
        }
        var badge = document.getElementById('floor-height-num');
        if (badge) badge.textContent = self.floorY.toFixed(2) + 'm';
        console.log('Floor 05 Height:', self.floorY.toFixed(2));
    };

    // ตำแหน่งเริ่มต้นหน้าประตูลิฟต์ (ความสูงระดับสายตา 1.45m)
    var currentPos = this.entity.getPosition().clone();
    this.initialPos = new pc.Vec3(currentPos.x, this.floorY + 1.45, currentPos.z);
    this.initialRot = new pc.Vec3(this.eulers.x, this.eulers.y, 0);

    // พิกัดประตูลิฟต์
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
            self.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
            self.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
            self.entity.rigidbody.teleport(self.initialPos, self.initialRot);
        } else {
            self.entity.setPosition(self.initialPos);
            self.entity.setEulerAngles(self.initialRot);
        }
    };

    // ─── Human Locomotion System ───
    this.bobTimer = 0;
    this.breathTimer = 0;
    this.bobWeight = 0;
    this.prevStepPhase = 0;

    // Eye entity with separate camera component
    var eyeEntity = new pc.Entity('PlayerEye');
    eyeEntity.addComponent('camera', {
        clearColor: this.entity.camera.clearColor,
        farClip: this.entity.camera.farClip,
        nearClip: this.entity.camera.nearClip,
        fov: 45
    });
    this.entity.addChild(eyeEntity);
    this.eyeEntity = eyeEntity;
    this.entity.camera.enabled = false;

    // Procedural Audio Context
    try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioCtx();
    } catch (e) {
        this.audioCtx = null;
    }

    this.playFootstep = function (isSprint) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        var t = this.audioCtx.currentTime;
        var osc = this.audioCtx.createOscillator();
        var gain = this.audioCtx.createGain();
        var filter = this.audioCtx.createBiquadFilter();

        osc.type = 'triangle';
        var baseFreq = 55 + Math.random() * 20;
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(15, t + 0.08);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(160, t);

        var vol = isSprint ? 0.12 : 0.08;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(t);
        osc.stop(t + 0.1);
    };

    // Mouse Drag Listeners
    var canvas = this.app.graphicsDevice.canvas;

    var onDown = function (e) {
        if (self.audioCtx && self.audioCtx.state === 'suspended') {
            self.audioCtx.resume();
        }
        self.isDragging = true;
        self.lastX = e.clientX;
        self.lastY = e.clientY;
    };

    var onUp = function () {
        self.isDragging = false;
    };

    var onMove = function (e) {
        if (!self.isDragging) return;
        var dx = e.clientX - self.lastX;
        var dy = e.clientY - self.lastY;
        self.lastX = e.clientX;
        self.lastY = e.clientY;

        var sens = self.lookSpeed || 0.22;
        self.targetEulers.y -= dx * sens;
        self.targetEulers.x -= dy * sens;
        self.targetEulers.x = Math.max(-85, Math.min(85, self.targetEulers.x));
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);

    // Touch Support
    canvas.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            if (self.audioCtx && self.audioCtx.state === 'suspended') self.audioCtx.resume();
            self.isDragging = true;
            self.lastX = e.touches[0].clientX;
            self.lastY = e.touches[0].clientY;
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', function (e) {
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

    canvas.addEventListener('touchend', function () {
        self.isDragging = false;
    });

    this.on('destroy', function () {
        canvas.removeEventListener('mousedown', onDown);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('mousemove', onMove);
    });

    // ─── Hotspot Editor API ───────────────────────────────────────────────────
    this.hotspots = [
        {
            id: 'hs_elevator_floor05',
            name: 'ลิฟต์ชั้น 5',
            hint: 'กด [E] หรือคลิกเพื่อเลือกชั้น',
            icon: '🛗',
            url: '#elevator',
            worldPos: new pc.Vec3(-2.96, 0.95, -0.98),
            prox: 5.0,
            action: function () {
                if (window.showElevatorModal) window.showElevatorModal();
            }
        },
        {
            id: 'hs_1790919302033',
            name: 'ห้อง9524',
            hint: 'คลิกเพื่อเข้า',
            icon: '🚪',
            url: '#',
            worldPos: new pc.Vec3(7.59, 0.83, 1.509),
            prox: 3.0
        },
        {
            id: 'hs_1790919326005',
            name: 'ห้อง9525',
            hint: 'คลิกเพื่อเข้า',
            icon: '🚪',
            url: '#',
            worldPos: new pc.Vec3(10.915, 0.834, 2.655),
            prox: 3.0
        },
        {
            id: 'hs_1790938341440',
            name: 'ลิฟต์ชั้น5',
            hint: 'กด [E] หรือคลิกเพื่อเลือกชั้น',
            icon: '🛗',
            url: '#elevator',
            worldPos: new pc.Vec3(-2.702, 0.9, -0.123),
            prox: 3.0,
            action: function () {
                if (window.showElevatorModal) window.showElevatorModal();
            }
        },
        {
            id: 'hs_1790938385079',
            name: 'ห้อง9516',
            hint: 'คลิกเพื่อเข้า',
            icon: '🚪',
            url: '#',
            worldPos: new pc.Vec3(-1.106, 0.9, -0.595),
            prox: 3.0
        },
        {
            id: 'hs_1790951011080',
            name: 'ห้อง9527',
            hint: 'คลิกเพื่อเข้า',
            icon: '🚪',
            url: '#',
            worldPos: new pc.Vec3(-2.912, 0.899, -2.432),
            prox: 3.0
        },
        {
            id: 'hs_1790957840429',
            name: 'บอท',
            hint: 'คลิกเพื่อเข้า',
            icon: '🚪',
            url: '#',
            worldPos: new pc.Vec3(13.819, 0.895, 2.914),
            prox: 3.0
        }
    ];

    window._hotspotEditorGetPos = function () {
        var pos = self.entity.getPosition();
        return { x: pos.x, y: pos.y, z: pos.z };
    };

    function createHotspotDomF05(hs) {
        var existing = document.getElementById(hs.id);
        if (existing) { hs.dom = existing; return existing; }
        var isElev = (hs.name && hs.name.indexOf('ลิฟต์') !== -1) || (hs.url === '#elevator');
        var el = document.createElement('div');
        el.id = hs.id;
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
            if (hs.action) { hs.action(); return; }
            if (isElev && window.showElevatorModal) { window.showElevatorModal(); return; }
            if (hs.url && hs.url.startsWith('http')) { window.open(hs.url, '_blank'); return; }
            if (hs.url && hs.url !== '#') window.location.href = hs.url;
        };
        el.style.display = 'none';
        document.body.appendChild(el);
        hs.dom = el;
        return el;
    }

    window._hotspotEditorRegister = function (data) {
        var existing = self.hotspots.find(function(h) { return h.id === data.id; });
        if (existing) return;

        var posX = (data.pos && typeof data.pos.x === 'number') ? data.pos.x : (data.x || 0);
        var posY = (data.pos && typeof data.pos.y === 'number') ? data.pos.y : (data.y || 0);
        var posZ = (data.pos && typeof data.pos.z === 'number') ? data.pos.z : (data.z || 0);
        var isElev = (data.name && data.name.indexOf('ลิฟต์') !== -1) || (data.url === '#elevator');

        var hs = {
            id: data.id,
            name: data.name,
            hint: data.hint,
            icon: data.icon || '📍',
            url: data.url,
            worldPos: new pc.Vec3(posX, posY, posZ),
            prox: data.prox || 3.0,
            action: function () {
                if (isElev && window.showElevatorModal) { window.showElevatorModal(); return; }
                if (data.url && data.url.startsWith('http')) { window.open(data.url, '_blank'); return; }
                if (data.url && data.url !== '#') window.location.href = data.url;
            }
        };
        createHotspotDomF05(hs);
        self.hotspots.push(hs);
    };

    window._hotspotEditorUnregister = function (id) {
        self.hotspots = self.hotspots.filter(function (h) { return h.id !== id; });
        var el = document.getElementById(id);
        if (el) el.remove();
    };

    // Load saved hotspots from localStorage
    try {
        var savedHs = localStorage.getItem('floor05_hotspots_v1');
        if (savedHs) {
            var parsed = JSON.parse(savedHs);
            if (Array.isArray(parsed)) {
                parsed.forEach(function (item) {
                    window._hotspotEditorRegister(item);
                });
            }
        }
    } catch (e) {}

    // Init DOM for default hotspots
    self.hotspots.forEach(function(hs) { createHotspotDomF05(hs); });

    // Ctrl+H toggles hotspot editor panel
    window.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
            e.preventDefault();
            var panel = document.getElementById('hotspot-editor-panel');
            if (panel) panel.style.display = (panel.style.display === 'none' ? 'flex' : 'none');
        }
    });

    window.dispatchEvent(new CustomEvent('hotspot-editor-ready'));
};

FpsWalker.prototype.update = function (dt) {
    var dtSec = Math.min(dt, 0.1);
    var app = this.app;

    // ─── 1. Cinematic Smooth Look ───
    var rotSmooth = Math.min(1, dtSec * 16);
    this.eulers.x = pc.math.lerp(this.eulers.x, this.targetEulers.x, rotSmooth);
    this.eulers.y = pc.math.lerp(this.eulers.y, this.targetEulers.y, rotSmooth);
    this.entity.setEulerAngles(this.eulers.x, this.eulers.y, 0);

    // ─── 2. Smooth Movement (Brisk 5.8m/s) ───
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

    // ─── 3. Physics & Ground Detection (แบบเดียวกับ Floor 01 & Floor 02) ───
    var isGrounded = false;
    if (this.entity.rigidbody) {
        var vel = this.entity.rigidbody.linearVelocity;
        var yVel = vel ? vel.y : 0;

        var pos = this.entity.getPosition();
        var rayEnd = new pc.Vec3(pos.x, pos.y - 0.70, pos.z);
        var hit = this.app.systems.rigidbody.raycastFirst(pos, rayEnd);
        isGrounded = (hit !== null) || (pos.y <= (this.floorY + 0.60));

        if (isGrounded && app.keyboard.wasPressed(pc.KEY_SPACE)) {
            yVel = this.jumpForce || 4.5;
        }

        // ป้องกันตกออกนอกโลกหากหลุดไปต่ำกว่าพื้นมาก
        if (pos.y < (this.floorY - 4.0)) {
            this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
            this.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
            return;
        }

        this.entity.rigidbody.linearVelocity = new pc.Vec3(this.currentVelocity.x, yVel, this.currentVelocity.z);
        this.entity.rigidbody.teleport(this.entity.getPosition(), this.eulers);

        // ─── 4. Elevator Prompt Check (หน้าประตูลิฟต์) ───
        var elevatorPrompt = document.getElementById('elevator-prompt');
        if (elevatorPrompt && this.elevatorPos) {
            var distToElev = Math.hypot(pos.x - this.elevatorPos.x, pos.z - this.elevatorPos.y);
            if (distToElev <= 3.2) {
                if (elevatorPrompt.style.display !== 'flex') elevatorPrompt.style.display = 'flex';
                if (app.keyboard.wasPressed(pc.KEY_E)) {
                    if (window.showElevatorModal) window.showElevatorModal();
                    else if (window.portalToFloor04) window.portalToFloor04();
                }
            } else {
                if (elevatorPrompt.style.display === 'flex') elevatorPrompt.style.display = 'none';
            }
        }
    } else {
        this.entity.translate(this.currentVelocity.x * dtSec, 0, this.currentVelocity.z * dtSec);
        isGrounded = true;
    }

    // ─── 5. Realistic Human Head Bobbing, Breathing & Footsteps ───
    var moveSpeed = this.currentVelocity.length();
    var isMoving = (moveSpeed > 0.4) && isGrounded;
    var stepRate = isSprinting ? 12.8 : 9.6;

    if (isMoving) {
        this.bobTimer += dtSec * stepRate;
        this.bobWeight = pc.math.lerp(this.bobWeight, 1.0, dtSec * 8);
    } else {
        this.bobWeight = pc.math.lerp(this.bobWeight, 0.0, dtSec * 6);
    }

    this.breathTimer += dtSec;

    var stepPhase = Math.sin(this.bobTimer);
    var bobY = -Math.abs(Math.sin(this.bobTimer)) * (isSprinting ? 0.045 : 0.030) * this.bobWeight;
    var bobX = Math.cos(this.bobTimer * 0.5) * (isSprinting ? 0.022 : 0.015) * this.bobWeight;
    var breathY = Math.sin(this.breathTimer * 1.5) * 0.008 * (1.0 - this.bobWeight);

    var strafeAmount = (app.keyboard.isPressed(pc.KEY_A) ? 1 : 0) - (app.keyboard.isPressed(pc.KEY_D) ? 1 : 0);
    var bankRoll = strafeAmount * (isSprinting ? 0.8 : 0.45) * this.bobWeight;
    var headPitch = Math.sin(this.bobTimer) * (isSprinting ? 0.5 : 0.3) * this.bobWeight;

    if (this.eyeEntity) {
        this.eyeEntity.setLocalPosition(bobX, bobY + breathY, 0);
        this.eyeEntity.setLocalEulerAngles(headPitch, 0, bankRoll);

        var targetFov = (isSprinting && isMoving) ? 48.0 : 45.0;
        this.eyeEntity.camera.fov = pc.math.lerp(this.eyeEntity.camera.fov, targetFov, dtSec * 6);
    }

    if (isMoving && this.bobWeight > 0.45) {
        if (this.prevStepPhase > 0 && stepPhase <= 0) {
            this.playFootstep(isSprinting);
        }
    }
    this.prevStepPhase = stepPhase;

    // Keyboard shortcuts for floor adjustment
    if (app.keyboard.wasPressed(pc.KEY_OPEN_BRACKET)) {
        if (window.adjustFloorY) window.adjustFloorY(-0.05);
    }
    if (app.keyboard.wasPressed(pc.KEY_CLOSE_BRACKET)) {
        if (window.adjustFloorY) window.adjustFloorY(0.05);
    }

    // ─── Hotspot 2D Projection ───
    if (this.hotspots && this.hotspots.length > 0 && this.eyeEntity) {
        var cam5 = this.eyeEntity;
        var camPos5 = cam5.getPosition();
        var camFwd5 = cam5.forward;
        var screenPos5 = new pc.Vec3();
        for (var hi = 0; hi < this.hotspots.length; hi++) {
            var hs5  = this.hotspots[hi];
            var dot5 = hs5.dom || document.getElementById(hs5.id);
            if (!dot5) continue;
            var hsWp = hs5.worldPos || new pc.Vec3(hs5.x || 0, hs5.y || 0, hs5.z || 0);
            cam5.camera.worldToScreen(hsWp, screenPos5);
            var toHs5 = hsWp.clone().sub(camPos5).normalize();
            var dot5val = camFwd5 ? camFwd5.dot(toHs5) : 1;
            var dist5 = Math.hypot(pos.x - hsWp.x, pos.z - hsWp.z);
            if (dot5val > 0.15 && screenPos5.z > 0 && dist5 < 22.0) {
                dot5.style.display = 'flex';
                dot5.style.left    = Math.round(screenPos5.x) + 'px';
                dot5.style.top     = Math.round(screenPos5.y) + 'px';
                var scale5 = pc.math.clamp(1.15 - (dist5 / 22.0), 0.7, 1.2);
                dot5.style.transform = 'translate(-50%,-50%) scale(' + scale5.toFixed(2) + ')';
            } else {
                dot5.style.display = 'none';
            }
        }
    }
};