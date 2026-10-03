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
    window._activeWalker = this;

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

    // Spawn point at elevator (Floor 01)
    this.initialPos = new pc.Vec3(7.81, 3.34, -0.55);
    this.initialRot = new pc.Vec3(0.0, 180.0, 0.0);
    this.elevatorPos = new pc.Vec2(-7.70, -0.40);
    this._spawnLock = 15;
    this.entity.setPosition(this.initialPos);
    this.entity.setEulerAngles(this.initialRot);
    this.eulers.set(this.initialRot.x, this.initialRot.y, 0);
    this.targetEulers.set(this.initialRot.x, this.initialRot.y, 0);
    if (this.entity.rigidbody) {
        this.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
        this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
        this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
    }

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
    var defaultHotspots = [
        {
            id: "hs_1790865753234",
            name: "ติดต่อฝ่ายวิชาการ/ธุรการ",
            hint: "คลิกเพื่อดูข้อมูลนักศึกษา",
            icon: "📍",
            url: "https://computing.kku.ac.th/students",
            prox: 3,
            worldPos: new pc.Vec3(-7.117, 3.34, -3.903),
            pos: { x: -7.117, y: 3.34, z: -3.903 },
            action: function () { window.open('https://computing.kku.ac.th/students', '_blank'); },
        },
        {
            id: "hs_1790865815184",
            name: "ห้อง9127",
            hint: "กด [E] หรือคลิกเพื่อเข้าห้อง",
            icon: "🚪",
            url: "../9127/",
            prox: 3,
            worldPos: new pc.Vec3(-26.087, 3.34, -20.398),
            pos: { x: -26.087, y: 3.34, z: -20.398 },
            action: function () { if (window.portalTo9127) window.portalTo9127(); else window.location.href = '../9127/'; },
        },
        {
            id: "hs_1790938266824",
            name: "ลิฟต์ชั้น1",
            hint: "กด [E] หรือคลิกเพื่อเลือกชั้น",
            icon: "🛗",
            url: "#elevator",
            prox: 3,
            worldPos: new pc.Vec3(10.533, 3.34, -2.68),
            pos: { x: 10.533, y: 3.34, z: -2.68 },
            action: function () { if (window.showElevatorModal) window.showElevatorModal(); },
        }
    ];
    this.hotspots = defaultHotspots.slice();

    // Expose position to Admin Editor
    window._hotspotEditorGetPos = function () {
        var p = self.entity.getPosition();
        return { x: p.x, y: p.y, z: p.z };
    };

    // Central Hotspot Action & Portal Router
    // Central Hotspot Action & Portal Router
    function handleHotspotAction(url, name, customAction) {
        if (typeof customAction === 'function') {
            customAction();
            return;
        }
        url = url || '';
        name = name || '';

        // 1. Elevator modal triggers: ONLY when url is '#elevator' or '#modal' or if name is specifically elevator
        var isElev = url === '#elevator' || url === '#modal' || (name && (name.indexOf('ลิฟต์') !== -1 || name.indexOf('ลิฟต์') !== -1));
        if (isElev) {
            if (window.showElevatorModal) {
                window.showElevatorModal();
                return;
            }
        }

        // 2. Room 9127
        if (url.indexOf('9127') !== -1 || name.indexOf('9127') !== -1) {
            if (window.portalTo9127) { window.portalTo9127(); return; }
            else { window.location.href = '../9127/'; return; }
        }

        // 3. External link or standard URL
        if (url.startsWith('http')) {
            window.open(url, '_blank');
            return;
        }
        if (url && url !== '#') {
            window.location.href = url;
            return;
        }

        // 4. จุด Hotspot เปล่า ที่ยังไม่ได้เชื่อมโยงไฟล์ (รอผู้ใช้นำไฟล์มาใส่ในภายหลัง)
        console.log('[Hotspot] จุดเปล่า (รอเชื่อมต่อไฟล์):', name);
        var toast = document.getElementById('nav-arrival-toast');
        var toastText = document.getElementById('nav-arrival-text');
        if (toast && toastText) {
            toastText.textContent = '📍 ' + (name || 'จุด Hotspot') + ' (ยังไม่ได้เชื่อมต่อไฟล์)';
            toast.style.background = 'linear-gradient(135deg, rgba(30,41,59,0.96), rgba(15,23,42,0.96))';
            toast.style.borderColor = '#38bdf8';
            toast.style.display = 'flex';
            setTimeout(function () {
                if (toast) {
                    toast.style.display = 'none';
                    toast.style.background = 'linear-gradient(135deg,rgba(16,185,129,0.95),rgba(5,150,105,0.95))';
                    toast.style.borderColor = '#6ee7b7';
                }
            }, 3000);
        }
    }

    // Helper to create or bind DOM element for a hotspot
    function createHotspotDom(hs) {
        var isElevator = (hs.name && hs.name.indexOf('ลิฟต์') !== -1) || 
                         (hs.url && (hs.url.indexOf('elevator') !== -1 || hs.url === '#elevator')) || 
                         hs.id === 'hs_elevator_main';
        var hintText = isElevator ? 'กด [E] หรือคลิกเพื่อเลือกชั้น' : (hs.hint || 'กด [E] หรือคลิกเพื่อเข้า');
        
        var rawIcon = hs.icon || '';
        var isCorrupted = !rawIcon || rawIcon.indexOf('') !== -1 || rawIcon.indexOf('๐') !== -1 || rawIcon.length > 8;
        var iconHtml = isElevator ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M8 10l-2-2 2-2M16 14l2 2-2 2"/></svg>' : (isCorrupted ? '📍' : rawIcon);

        var el = document.getElementById(hs.id);
        if (!el) {
            el = document.createElement('div');
            el.id = hs.id;
            el.className = 'hotspot-3d';
            el.title = hs.name || 'Hotspot';
            el.innerHTML = '<div class="hotspot-ring"></div>' +
                           '<div class="hotspot-dot">' + iconHtml + '</div>' +
                           '<div class="hotspot-label">' +
                           '  <span class="hotspot-title">' + (hs.name || 'Hotspot') + '</span>' +
                           '  <span class="hotspot-hint">' + hintText + '</span>' +
                           '</div>';
            document.body.appendChild(el);
        } else {
            var hintEl = el.querySelector('.hotspot-hint');
            if (hintEl) hintEl.textContent = hintText;
            var dotEl = el.querySelector('.hotspot-dot');
            if (dotEl) dotEl.innerHTML = iconHtml;
            var titleEl = el.querySelector('.hotspot-title');
            if (titleEl) titleEl.textContent = hs.name || 'Hotspot';
        }

        function triggerHotspot(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (isElevator && window.showElevatorModal) {
                window.showElevatorModal();
                return;
            }
            handleHotspotAction(hs.url, hs.name, hs.action);
        }

        el.onclick = triggerHotspot;
        el.onmousedown = function (e) { e.stopPropagation(); };
        el.ontouchstart = function (e) { e.stopPropagation(); };

        hs.dom = el;
        hs.trigger = triggerHotspot;
        return el;
    }

    // Register / Unregister hooks for Admin Editor
    window._hotspotEditorRegister = function (data) {
        var existing = self.hotspots.find(function(h) { return h.id === data.id; });
        if (existing) return;

        var posX = (data.pos && typeof data.pos.x === 'number') ? data.pos.x : (data.x || 0);
        var posY = (data.pos && typeof data.pos.y === 'number') ? data.pos.y : (data.y || 0);
        var posZ = (data.pos && typeof data.pos.z === 'number') ? data.pos.z : (data.z || 0);

        var isElevator = (data.name && data.name.indexOf('ลิฟต์') !== -1) || 
                         (data.url && (data.url.indexOf('elevator') !== -1 || data.url === '#elevator')) || 
                         data.id === 'hs_elevator_main';

        if (isElevator) {
            self.elevatorPos = new pc.Vec2(posX, posZ);
        }

        var cleanIcon = data.icon || '';
        if (isElevator) cleanIcon = '🛗';
        else if (!cleanIcon || cleanIcon.indexOf('') !== -1 || cleanIcon.indexOf('๐') !== -1 || cleanIcon.length > 8) {
            cleanIcon = '📍';
        }

        var hs = {
            id: data.id,
            name: data.name || 'Hotspot',
            hint: isElevator ? 'กด [E] หรือคลิกเพื่อเลือกชั้น' : (data.hint || 'กด [E] หรือคลิกเพื่อเข้า'),
            icon: cleanIcon,
            url: data.url || '#',
            worldPos: new pc.Vec3(posX, posY, posZ),
            prox: data.prox || 3.0,
            action: function () {
                if (isElevator && window.showElevatorModal) {
                    window.showElevatorModal();
                    return;
                }
                handleHotspotAction(data.url, data.name, null);
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

    // Load custom hotspots from localStorage
    try {
        var savedHs = localStorage.getItem('floor01_hotspots_v1');
        if (savedHs) {
            var parsed = JSON.parse(savedHs);
            if (Array.isArray(parsed)) {
                parsed.forEach(function (item) {
                    window._hotspotEditorRegister(item);
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

    // ─── Spawn-Lock: กัน "ตกจากด้านบน" 15 เฟรมแรก ───
    if (this._spawnLock > 0) {
        this._spawnLock--;
        this.entity.setPosition(this.initialPos);
        if (this.entity.rigidbody) {
            this.entity.rigidbody.linearVelocity  = pc.Vec3.ZERO;
            this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
            this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
        }
        return;
    }

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

    var targetSpeed = this.speed || 6.5;
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
            if (!hs.worldPos) {
                var px = (hs.pos && typeof hs.pos.x === 'number') ? hs.pos.x : (hs.x || 0);
                var py = (hs.pos && typeof hs.pos.y === 'number') ? hs.pos.y : (hs.y || 0);
                var pz = (hs.pos && typeof hs.pos.z === 'number') ? hs.pos.z : (hs.z || 0);
                hs.worldPos = new pc.Vec3(px, py, pz);
            }
            var dist = Math.hypot(pos.x - hs.worldPos.x, pos.z - hs.worldPos.z);
            var el = hs.dom || document.getElementById(hs.id);

            // Proximity [E] key activation
            var proxDist = hs.prox || 3.2;
            if (dist <= proxDist) {
                if (app.keyboard.wasPressed(pc.KEY_E)) {
                    if (typeof hs.trigger === 'function') hs.trigger();
                    else if (typeof hs.action === 'function') hs.action();
                }
            }

            if (el && cam) {
                cam.worldToScreen(hs.worldPos, screenPos);
                var toHs = hs.worldPos.clone().sub(camPos).normalize();
                var dot = camFwd ? camFwd.dot(toHs) : 1;

                var isElev = hs.id === 'hs_elevator_main' || (hs.name && hs.name.indexOf('ลิฟต์') !== -1) || (hs.url && hs.url.indexOf('elevator') !== -1);
                var visibleDist = isElev ? 25.0 : proxDist;
                if (dist <= visibleDist && dot > 0.15 && screenPos.z > 0) {
                    el.style.display = 'flex';
                    el.style.left = Math.round(screenPos.x) + 'px';
                    el.style.top = Math.round(screenPos.y) + 'px';
                    var scale = isElev ? pc.math.clamp(1.2 - (dist / 25.0) * 0.35, 0.8, 1.25) : pc.math.clamp(1.25 - (dist / proxDist) * 0.25, 0.85, 1.25);
                    el.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(2) + ')';
                } else {
                    el.style.display = 'none';
                }
            }
        }

        // Elevator Prompt Banner
        var elevatorPrompt = document.getElementById('elevator-prompt');
        if (elevatorPrompt) {
            var elevX = this.elevatorPos ? this.elevatorPos.x : -7.70;
            var elevZ = this.elevatorPos ? this.elevatorPos.y : -0.40;
            var distToElev = Math.hypot(pos.x - elevX, pos.z - elevZ);
            if (distToElev < 3.5 || pos.x <= -6.0) {
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
