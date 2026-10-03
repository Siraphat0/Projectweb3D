// Room 9127 FPS Walker - Full parity with Floor 01/03/04/05
// Provides smooth mouse look (drag + pointer lock), natural WASD locomotion,
// head bobbing, footsteps audio, and doorway portal back to Floor 01.

var FpsWalker = pc.createScript("fpsWalker");

FpsWalker.attributes.add("speed",     { type: "number", default: 4.5,  title: "Movement Speed" });
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

    // ─── Hotspot System & Admin Tool Integration ───
    this.hotspots = [];

    // Expose position to Admin Editor
    window._hotspotEditorGetPos = function () {
        var p = self.entity.getPosition();
        return { x: p.x, y: p.y, z: p.z };
    };

    function handleHotspotAction(url, name, customAction) {
        if (typeof customAction === 'function') {
            customAction();
            return;
        }
        url = url || '';
        name = name || '';

        var isElev = url === '#elevator' || url === '#modal' || (name && name.indexOf('ลิฟต์') !== -1);
        if (isElev) {
            if (window.showElevatorModal) {
                window.showElevatorModal();
                return;
            }
        }

        if (url.indexOf('9127') !== -1 || name.indexOf('9127') !== -1) {
            if (window.portalTo9127) { window.portalTo9127(); return; }
            else { window.location.href = '../9127/'; return; }
        }

        if (url.indexOf('9422') !== -1 || name.indexOf('9422') !== -1) {
            window.location.href = '../9422/'; return;
        }

        if (url.indexOf('9524') !== -1 || name.indexOf('9524') !== -1) {
            window.location.href = '../9524/'; return;
        }

        if (url.indexOf('floor01') !== -1) {
            if (window.portalToFloor01) { window.portalToFloor01(); return; }
            else { window.location.href = '../floor01/'; return; }
        }

        if (url.indexOf('inside') !== -1) {
            if (window.portalToInside) { window.portalToInside(); return; }
            else { window.location.href = '../inside/'; return; }
        }

        if (url.startsWith('http')) {
            window.open(url, '_blank');
            return;
        }
        if (url && url !== '#') {
            window.location.href = url;
            return;
        }

        var toast = document.getElementById('nav-arrival-toast');
        var toastText = document.getElementById('nav-arrival-text');
        if (toast && toastText) {
            toastText.textContent = '📍 ' + (name || 'จุด Hotspot');
            toast.style.display = 'flex';
            setTimeout(function () { if (toast) toast.style.display = 'none'; }, 3000);
        }
    }

    function createHotspotDom(hs) {
        var isElevator = (hs.name && hs.name.indexOf('ลิฟต์') !== -1) || 
                         (hs.url && (hs.url.indexOf('elevator') !== -1 || hs.url === '#elevator')) || 
                         hs.id === 'hs_elevator_main';
        var hintText = isElevator ? 'กด [E] หรือคลิกเพื่อเลือกชั้น' : (hs.hint || 'กด [E] หรือคลิกเพื่อเข้า');
        var iconHtml = isElevator ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M8 10l-2-2 2-2M16 14l2 2-2 2"/></svg>' : (hs.icon || '📍');

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

        var cleanIcon = data.icon || (isElevator ? '🛗' : '📍');

        var hs = {
            id: data.id,
            name: data.name || 'Hotspot',
            hint: isElevator ? 'กด [E] หรือคลิกเพื่อเลือกชั้น' : (data.hint || 'กด [E] หรือคลิกเพื่อเข้า'),
            icon: cleanIcon,
            url: data.url || '#',
            worldPos: new pc.Vec3(posX, posY, posZ),
            prox: data.prox || 4.0,
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

    // 1. Load Built-in Default Hotspots
    var defaultList = [{"id":"hs_exit_9127","name":"🚪 ทางออกสู่ชั้น 1 ด้านใน","icon":"🏢","url":"../floor01/","hint":"กด [E] หรือคลิกเพื่อออกไปทางเดินชั้น 1","x":0,"y":1.5,"z":4,"prox":4}];
    defaultList.forEach(function(item) {
        window._hotspotEditorRegister(item);
    });

    // 2. Load custom hotspots from localStorage
    try {
        var savedHs = localStorage.getItem('9127_hotspots_v1');
        if (savedHs) {
            var parsed = JSON.parse(savedHs);
            if (Array.isArray(parsed)) {
                parsed.forEach(function (item) {
                    window._hotspotEditorRegister(item);
                });
            }
        }
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('hotspot-editor-ready'));
    
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

    // Smooth proxy floor to guarantee zero snagging
    this._createProxyFloor(1.655);

    if (this.entity.rigidbody) {
        this.entity.rigidbody.teleport(this.initialPos, this.initialRot);
    } else {
        this.entity.setPosition(this.initialPos);
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
    var pos = this.entity.getPosition();

    if (this.entity.rigidbody) {
        var vel = this.entity.rigidbody.linearVelocity;
        var yVel = vel ? vel.y : 0;

        var rayEnd = new pc.Vec3(pos.x, pos.y - 0.55, pos.z);
        var hit = this.app.systems.rigidbody.raycastFirst(pos, rayEnd);
        isGrounded = (hit !== null) || (pos.y <= (this.floorY + 0.55));

        if (isGrounded && app.keyboard.wasPressed(pc.KEY_SPACE)) {
            yVel = this.jumpForce || 4.5;
        }

        this.entity.rigidbody.linearVelocity = new pc.Vec3(this.currentVelocity.x, yVel, this.currentVelocity.z);
        this.entity.rigidbody.teleport(this.entity.getPosition(), this.eulers);

        // ─── Hotspots & Proximity Triggers ───
        var cam = (this.eyeEntity && this.eyeEntity.camera) ? this.eyeEntity.camera : 
                  (this.cameraEntity && this.cameraEntity.camera ? this.cameraEntity.camera : 
                  (this.entity.camera ? this.entity.camera : 
                  (this.entity.findByName('Camera') ? this.entity.findByName('Camera').camera : null)));
        var camFwd = this.eyeEntity ? this.eyeEntity.forward : this.entity.forward;
        var camPos = this.eyeEntity ? this.eyeEntity.getPosition() : pos;
        var screenPos = new pc.Vec3();

        if (this.hotspots && this.hotspots.length > 0) {
            for (var i = 0; i < this.hotspots.length; i++) {
                var hs = this.hotspots[i];
                if (!hs || !hs.worldPos) continue;
                var dist = Math.hypot(camPos.x - hs.worldPos.x, camPos.z - hs.worldPos.z);
                var el = hs.dom || document.getElementById(hs.id);

                var proxDist = hs.prox || 4.0;
                if (dist <= proxDist) {
                    if (app && app.keyboard && app.keyboard.wasPressed(pc.KEY_E)) {
                        if (typeof hs.trigger === 'function') hs.trigger();
                        else if (typeof hs.action === 'function') hs.action();
                    }
                }

                if (el && cam) {
                    cam.worldToScreen(hs.worldPos, screenPos);
                    var toHs = hs.worldPos.clone().sub(camPos).normalize();
                    var dot = camFwd ? camFwd.dot(toHs) : 1;

                    var visibleDist = 35.0; // 35m visibility
                    if (dist <= visibleDist && dot > 0.05 && screenPos.z > 0) {
                        el.style.display = 'flex';
                        el.style.left = Math.round(screenPos.x) + 'px';
                        el.style.top = Math.round(screenPos.y) + 'px';
                        var scale = pc.math.clamp(1.2 - (dist / 35.0) * 0.4, 0.8, 1.25);
                        el.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(2) + ')';
                    } else {
                        el.style.display = 'none';
                    }
                }
            }
        }

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
