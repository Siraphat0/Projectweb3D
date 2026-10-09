var FpsWalker = pc.createScript("fpsWalker");

FpsWalker.attributes.add("speed", { type: "number", default: 5.8, title: "Speed" });
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
    window._activeWalker = this;

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
    // ระดับพื้นที่ปรับแต่งไว้แล้ว 0.45m — ผ่านทดสอบ real-time
    this.floorY = 0.45;
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

    // ตำแหน่งเริ่มต้นหน้าลิฟต์ชั้น 5 (ค่าหมุดปักจาก scene entity)
    this.initialPos = new pc.Vec3(-2.96, this.floorY + 0.50, -0.98);
    this.initialRot = new pc.Vec3(this.eulers.x, this.eulers.y, 0);

    // ── ตรวจสอบตำแหน่งเดิมเมื่อกลับมาจากห้อง (Return from Room Memory) ──
    var returnData = null;
    try {
        var rawReturn = sessionStorage.getItem('floor05_return_spawn');
        if (rawReturn) {
            returnData = JSON.parse(rawReturn);
            sessionStorage.removeItem('floor05_return_spawn');
        }
    } catch (e) {}

    // Fallback จาก URL query parameter เช่น ?from=9525 หรือ ?from=9524
    var urlParams = new URLSearchParams(window.location.search);
    var fromRoom = urlParams.get('from');
    if (!returnData && fromRoom) {
        var fallbackHotspots = {
            '9525': { x: 10.15, y: this.floorY + 0.50, z: 2.65, pitch: 0, yaw: -90 },
            '9524': { x: 6.85,  y: this.floorY + 0.50, z: 1.51, pitch: 0, yaw: -90 }
        };
        if (fallbackHotspots[fromRoom]) returnData = fallbackHotspots[fromRoom];
    }

    if (returnData && typeof returnData.x === 'number') {
        this.initialPos = new pc.Vec3(returnData.x, returnData.y, returnData.z);
        if (typeof returnData.yaw === 'number') {
            this.initialRot = new pc.Vec3(returnData.pitch || 0, returnData.yaw, 0);
            this.eulers.set(this.initialRot.x, this.initialRot.y, 0);
            this.targetEulers.set(this.initialRot.x, this.initialRot.y, 0);
        }
    }

    // พิกัดประตูลิฟต์ชั้น 5
    this.elevatorPos = new pc.Vec2(-2.96, -0.98);

    // ── กัน "ตกจากด้านบน" (spawn-lock) ──
    // teleport ซ้ำ 15 เฟรมแรก เพราะ rigidbody physics world init มี delay 1–2 frames
    this._spawnLock = 15;

    // วางตำแหน่งเริ่มต้นทันที (setPosition เร็วกว่า teleport 1 frame)
    this.entity.setPosition(this.initialPos);
    if (this.entity.rigidbody) {
        this.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
        this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
        this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
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

    var defaultHotspots = [
        {
            id: "hs_1790919302033",
            name: "ห้อง9524",
            hint: "คลิกเพื่อเข้า",
            icon: "🚪",
            url: "../9524/",
            prox: 3,
            worldPos: new pc.Vec3(7.59, 0.83, 1.509),
            pos: { x: 7.59, y: 0.83, z: 1.509 },
            action: function () { if (window.portalTo9524) window.portalTo9524(); else window.location.href = '../9524/'; },
        },
        {
            id: "hs_1790919326005",
            name: "ห้อง9525",
            hint: "กด [E] หรือคลิกเพื่อเข้าห้อง",
            icon: "🚪",
            url: "../9525/",
            prox: 3,
            worldPos: new pc.Vec3(10.915, 0.834, 2.655),
            pos: { x: 10.915, y: 0.834, z: 2.655 },
            action: function () { if (window.portalTo9525) window.portalTo9525(); else window.location.href = '../9525/'; },
        },
        {
            id: "hs_1790938341440",
            name: "ลิฟต์ชั้น5",
            hint: "กด [E] หรือคลิกเพื่อเลือกชั้น",
            icon: "🛗",
            url: "#elevator",
            prox: 3,
            worldPos: new pc.Vec3(-2.702, 0.9, -0.123),
            pos: { x: -2.702, y: 0.9, z: -0.123 },
            action: function () { if (window.showElevatorModal) window.showElevatorModal(); },
        },
        {
            id: "hs_1790938385079",
            name: "ห้อง9516",
            hint: "คลิกเพื่อเข้า",
            icon: "🚪",
            url: "#",
            prox: 3,
            worldPos: new pc.Vec3(-1.106, 0.9, -0.595),
            pos: { x: -1.106, y: 0.9, z: -0.595 },
            
        },
        {
            id: "hs_1790951011080",
            name: "ห้อง9527",
            hint: "คลิกเพื่อเข้า",
            icon: "🚪",
            url: "#",
            prox: 3,
            worldPos: new pc.Vec3(-2.912, 0.899, -2.432),
            pos: { x: -2.912, y: 0.899, z: -2.432 },
            
        },
        {
            id: "hs_1790957840429",
            name: "บอท",
            hint: "คลิกเพื่อเข้า",
            icon: "🚪",
            url: "#",
            prox: 3,
            worldPos: new pc.Vec3(13.819, 0.895, 2.914),
            pos: { x: 13.819, y: 0.895, z: 2.914 },
            
        }
    ];
    this.hotspots = defaultHotspots.slice();

    window._hotspotEditorGetPos = function () {
        var pos = self.entity.getPosition();
        return { x: pos.x, y: pos.y, z: pos.z };
    };

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

        function saveCurrentSpawn(roomKey) {
            try {
                var p = self.entity.getPosition();
                var data = {
                    x: p.x,
                    y: p.y,
                    z: p.z,
                    pitch: self.eulers.x || 0,
                    yaw: self.eulers.y || 0,
                    room: roomKey
                };
                sessionStorage.setItem('floor05_return_spawn', JSON.stringify(data));
            } catch (e) {}
        }

        // 2. Room 9524 (ห้อง 9524 ชั้น 5)
        if (url.indexOf('9524') !== -1 || name.indexOf('9524') !== -1) {
            saveCurrentSpawn('9524');
            if (window.portalTo9524) { window.portalTo9524(); return; }
            else { window.location.href = '../9524/'; return; }
        }

        // Room 9525 (ห้อง 9525 ชั้น 5)
        if (url.indexOf('9525') !== -1 || name.indexOf('9525') !== -1) {
            saveCurrentSpawn('9525');
            if (window.portalTo9525) { window.portalTo9525(); return; }
            else { window.location.href = '../9525/'; return; }
        }

        // Room 9421 / 9422
        if (url.indexOf('9422') !== -1 || name.indexOf('9422') !== -1 ||
            url.indexOf('9421') !== -1 || name.indexOf('9421') !== -1) {
            saveCurrentSpawn('9422');
            if (window.portalTo9422) { window.portalTo9422(); return; }
            else { window.location.href = '../9422/'; return; }
        }

        // Room 9127
        if (url.indexOf('9127') !== -1 || name.indexOf('9127') !== -1) {
            saveCurrentSpawn('9127');
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

    try {
        var saved = localStorage.getItem('floor05_hotspots_v1');
        if (saved) {
            var list = JSON.parse(saved);
            if (Array.isArray(list)) {
                list.forEach(function (item) {
                    window._hotspotEditorRegister(item);
                });
            }
        }
    } catch (e) {}

    this.hotspots.forEach(function (hs) {
        createHotspotDom(hs);
    });

    window.dispatchEvent(new CustomEvent('hotspot-editor-ready'));
};

FpsWalker.prototype.update = function (dt) {
    var dtSec = Math.min(dt, 0.1);
    var app = this.app;

    // ─── Spawn-Lock: กัน "ตกจากด้านบน" 15 เฟรมแรก ───
    if (this._spawnLock > 0) {
        this._spawnLock--;
        this.entity.setPosition(this.initialPos);
        if (this.entity.rigidbody) {
            this.entity.rigidbody.linearVelocity  = pc.Vec3.ZERO;
            this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;
            this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
        }
        return; // ข้ามการประมวลผลปกติจนกว่าจะ lock หมด
    }

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
            if (distToElev <= 3.5) {
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

    // floorY locked — no keyboard adjustment needed

    // ─── 3D Hotspot Screen Projection & Proximity Trigger ───
    if (this.hotspots && this.hotspots.length > 0) {
        var cam = this.eyeEntity ? this.eyeEntity.camera : null;
        var camFwd = this.eyeEntity ? this.eyeEntity.forward : null;
        var camPos = this.eyeEntity ? this.eyeEntity.getPosition() : this.entity.getPosition();
        var screenPos = new pc.Vec3();
        var pPos = this.entity.getPosition();

        for (var i = 0; i < this.hotspots.length; i++) {
            var hs = this.hotspots[i];
            var dist = Math.hypot(pPos.x - hs.worldPos.x, pPos.z - hs.worldPos.z);
            var el = hs.dom || document.getElementById(hs.id);

            var proxDist = hs.prox || 3.0;
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
    }
};
