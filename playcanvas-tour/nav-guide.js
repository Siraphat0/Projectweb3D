/**
 * nav-guide.js — Sci-Fi Neon Floor Navigation & Waypoint Corridor Guide
 * Features:
 *  - Room search with real-time filtering & Enter to navigate
 *  - Corridors & walkway waypoint pathfinding (arrows turn along hallways)
 *  - Smooth corner turning for chevrons
 *  - Clean HUD search trigger & shortcut '/'
 *  - No distance display on active banner (per user request)
 *  - Cross-floor support (floor01, floor02, floor03, floor04, floor05, inside)
 */
(function () {
    'use strict';

    var activeTarget = null; // { id, name, icon, worldPos, ... }
    var navArrows = [];
    var navContainer = null;
    var targetRing = null;
    var navMaterial = null;
    var ringMaterial = null;
    var navTexture = null;
    var ringTexture = null;
    var navTime = 0;
    var isInitialized = false;

    var MAX_ARROWS = 45;
    var SPACING = 1.55; // meters between arrows
    var TARGET_RADIUS = 2.4; // Arrival distance in meters
    var ANGLE_OFFSET = 180; // Rotation offset for PlayCanvas plane forward vector

    // ─────────────────────────────────────────────────────────────
    // 0. Corridor Waypoints & Hallway Network per Floor
    // ─────────────────────────────────────────────────────────────
    var FLOOR_CORRIDORS = {
        floor01: [
            { x: -7.70, z: -0.40 },    // Elevator (Floor 01)
            { x: -7.12, z: -0.55 },    // Academic office junction
            { x: -7.12, z: -3.90 },    // Academic office entrance
            { x: 0.00, z: -0.55 },     // Mid hall
            { x: 7.81, z: -0.55 },     // Spawn / Corridor East
            { x: -26.09, z: -0.55 },   // Corner turn to Lab 9127
            { x: -26.09, z: -20.40 }   // Room 9127 Door
        ],
        floor02: [
            { x: -7.70, z: -0.40 },    // Elevator (Floor 02)
            { x: -1.00, z: -0.40 },    // Corridor West
            { x: 2.50, z: -0.40 },     // Co-Working Space
            { x: 7.50, z: -0.40 },     // Corridor East
            { x: 12.50, z: -0.40 }     // Library & Student Lounge
        ],
        floor03: [
            { x: -1.27, z: 6.17 },     // Elevator (Floor 03)
            { x: 5.00, z: 6.17 },      // Hallway to Lecture room
            { x: 15.20, z: 6.17 },     // Room 9301
            { x: -1.27, z: 0.00 },     // Mid hall junction
            { x: -1.27, z: -5.00 },    // Corridor North
            { x: -1.27, z: -10.50 }    // Computer Lab
        ],
        floor04: [
            { x: 0.08, z: 24.32 },     // Elevator (Floor 04)
            { x: 8.00, z: 24.32 },     // Hallway to Dept Office
            { x: 16.50, z: 24.32 },    // Dept Office
            { x: 0.08, z: 15.00 },     // Mid hallway
            { x: 0.08, z: 5.00 }       // Classroom 9401
        ],
        floor05: [
            { x: -2.96, z: -0.98 },    // Elevator (Floor 05)
            { x: 5.00, z: -0.98 },     // Hallway to Meeting room
            { x: 14.00, z: -0.98 },    // Meeting Room 9501
            { x: -2.96, z: 6.50 },     // Mid hallway
            { x: -2.96, z: 14.50 }     // Dean Office
        ],
        inside: [
            { x: -6.50, z: 2.50 },     // Info Desk
            { x: -0.46, z: 2.50 },     // Main Lobby Center
            { x: 6.80, z: 2.50 },      // Junction to Elevator
            { x: 6.80, z: -3.20 }      // Main Elevator
        ]
    };

    function getCurrentFloorId() {
        var path = (window.location.pathname || '').toLowerCase();
        if (path.indexOf('floor01') !== -1) return 'floor01';
        if (path.indexOf('floor02') !== -1) return 'floor02';
        if (path.indexOf('floor03') !== -1) return 'floor03';
        if (path.indexOf('floor04') !== -1) return 'floor04';
        if (path.indexOf('floor05') !== -1) return 'floor05';
        if (path.indexOf('inside') !== -1)  return 'inside';
        return 'floor01';
    }

    function getWalker() {
        if (window._activeWalker) return window._activeWalker;
        if (window.pc && pc.Application) {
            var app = pc.Application.getApplication();
            if (app && app.root) {
                var player = app.root.findByName('Player') || app.root.findByName('Camera');
                if (player && player.script) {
                    var w = player.script.fpsWalker || player.script.firstPersonController;
                    if (w) {
                        window._activeWalker = w;
                        return w;
                    }
                }
            }
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Procedural Texture Generators
    // ─────────────────────────────────────────────────────────────

    function createChevronTexture(app) {
        var c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        var ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);

        function drawChevronPath(cx, cy, w, h, t) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + w, cy + h);
            ctx.lineTo(cx + w - t * 0.7, cy + h + t);
            ctx.lineTo(cx, cy + t * 1.2);
            ctx.lineTo(cx - w + t * 0.7, cy + h + t);
            ctx.lineTo(cx - w, cy + h);
            ctx.closePath();
        }

        var chevrons = [
            { y: 55,  w: 62, h: 36, thick: 14, alpha: 1.0 },
            { y: 110, w: 72, h: 42, thick: 16, alpha: 0.82 },
            { y: 170, w: 82, h: 48, thick: 18, alpha: 0.58 }
        ];

        chevrons.forEach(function (ch) {
            ctx.save();
            ctx.globalAlpha = ch.alpha;

            // Outer Cyan Glow
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 28;
            ctx.fillStyle = '#0891b2';
            drawChevronPath(128, ch.y, ch.w + 5, ch.h + 5, ch.thick + 5);
            ctx.fill();

            // Mid Electric Blue / Cyan
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 14;
            ctx.fillStyle = '#38bdf8';
            drawChevronPath(128, ch.y, ch.w, ch.h, ch.thick);
            ctx.fill();

            // Core White Beam
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#ffffff';
            drawChevronPath(128, ch.y + 2, ch.w - 12, ch.h - 8, ch.thick - 6);
            ctx.fill();

            ctx.restore();
        });

        var tex = new pc.Texture(app.graphicsDevice, {
            width: 256,
            height: 256,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            autoMipmap: true
        });
        tex.setSource(c);
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        return tex;
    }

    function createRingTexture(app) {
        var c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        var ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);

        ctx.save();
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 24;

        // Outer ring
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(128, 128, 95, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(128, 128, 65, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(128, 128, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        var tex = new pc.Texture(app.graphicsDevice, {
            width: 256,
            height: 256,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            autoMipmap: true
        });
        tex.setSource(c);
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        return tex;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PlayCanvas 3D Entities Setup
    // ─────────────────────────────────────────────────────────────

    function init3D(app) {
        if (navContainer) return;

        navContainer = new pc.Entity('NavGuideContainer');
        app.root.addChild(navContainer);

        navTexture = createChevronTexture(app);
        ringTexture = createRingTexture(app);

        navMaterial = new pc.StandardMaterial();
        navMaterial.diffuse = new pc.Color(0, 0, 0);
        navMaterial.emissive = new pc.Color(0.25, 0.9, 1.0);
        navMaterial.emissiveMap = navTexture;
        navMaterial.opacityMap = navTexture;
        navMaterial.blendType = pc.BLEND_ADDITIVE;
        navMaterial.cull = pc.CULLFACE_NONE;
        navMaterial.depthWrite = false;
        navMaterial.update();

        ringMaterial = new pc.StandardMaterial();
        ringMaterial.diffuse = new pc.Color(0, 0, 0);
        ringMaterial.emissive = new pc.Color(0.2, 0.85, 1.0);
        ringMaterial.emissiveMap = ringTexture;
        ringMaterial.opacityMap = ringTexture;
        ringMaterial.blendType = pc.BLEND_ADDITIVE;
        ringMaterial.cull = pc.CULLFACE_NONE;
        ringMaterial.depthWrite = false;
        ringMaterial.update();

        targetRing = new pc.Entity('NavTargetRing');
        targetRing.addComponent('model', { type: 'plane' });
        if (targetRing.model && targetRing.model.meshInstances && targetRing.model.meshInstances[0]) {
            targetRing.model.meshInstances[0].material = ringMaterial;
        }
        targetRing.enabled = false;
        navContainer.addChild(targetRing);

        for (var i = 0; i < MAX_ARROWS; i++) {
            var arrow = new pc.Entity('NavArrow_' + i);
            arrow.addComponent('model', { type: 'plane' });
            if (arrow.model && arrow.model.meshInstances && arrow.model.meshInstances[0]) {
                arrow.model.meshInstances[0].material = navMaterial;
            }
            arrow.enabled = false;
            navContainer.addChild(arrow);
            navArrows.push(arrow);
        }

        app.on('update', updateNavigation);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Hallway Route Calculation (Turns & Curves along Corridors)
    // ─────────────────────────────────────────────────────────────

    function findNearestNodeIndex(pos, nodes) {
        var bestIdx = 0;
        var bestDist = Infinity;
        for (var i = 0; i < nodes.length; i++) {
            var d = Math.hypot(nodes[i].x - pos.x, nodes[i].z - pos.z);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    function computeCorridorPath(playerPos, targetPos) {
        var floorId = getCurrentFloorId();
        var nodes = FLOOR_CORRIDORS[floorId];

        // 1. If target has explicit waypoints defined, use them
        if (activeTarget && Array.isArray(activeTarget.waypoints) && activeTarget.waypoints.length > 0) {
            var wp = [{ x: playerPos.x, z: playerPos.z }];
            activeTarget.waypoints.forEach(function (p) {
                wp.push({ x: p.x, z: p.z });
            });
            wp.push({ x: targetPos.x, z: targetPos.z });
            return wp;
        }

        var directDist = Math.hypot(targetPos.x - playerPos.x, targetPos.z - playerPos.z);
        if (!nodes || nodes.length < 2 || directDist < 3.2) {
            return [
                { x: playerPos.x, z: playerPos.z },
                { x: targetPos.x, z: targetPos.z }
            ];
        }

        // 2. Find nearest corridor nodes
        var startNodeIdx = findNearestNodeIndex(playerPos, nodes);
        var endNodeIdx   = findNearestNodeIndex(targetPos, nodes);

        if (startNodeIdx === endNodeIdx) {
            var n = nodes[startNodeIdx];
            var dDirect = directDist;
            var dVia = Math.hypot(n.x - playerPos.x, n.z - playerPos.z) + Math.hypot(targetPos.x - n.x, targetPos.z - n.z);
            if (dVia < dDirect * 1.35) {
                return [
                    { x: playerPos.x, z: playerPos.z },
                    { x: n.x, z: n.z },
                    { x: targetPos.x, z: targetPos.z }
                ];
            }
            return [
                { x: playerPos.x, z: playerPos.z },
                { x: targetPos.x, z: targetPos.z }
            ];
        }

        // 3. Connect through corridor node sequence
        var rawPath = [{ x: playerPos.x, z: playerPos.z }];
        var step = (endNodeIdx > startNodeIdx) ? 1 : -1;
        for (var i = startNodeIdx; i !== endNodeIdx + step; i += step) {
            rawPath.push({ x: nodes[i].x, z: nodes[i].z });
        }
        rawPath.push({ x: targetPos.x, z: targetPos.z });

        // 4. Remove backwards hook if player is already ahead of first waypoint
        if (rawPath.length >= 3) {
            var d02 = Math.hypot(rawPath[2].x - rawPath[0].x, rawPath[2].z - rawPath[0].z);
            var d12 = Math.hypot(rawPath[2].x - rawPath[1].x, rawPath[2].z - rawPath[1].z);
            if (d02 < d12) {
                rawPath.splice(1, 1);
            }
        }

        return rawPath;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Navigation Update Loop with Curving / Turning Chevrons
    // ─────────────────────────────────────────────────────────────

    function updateNavigation(dt) {
        var walker = getWalker();
        if (!activeTarget || !walker) {
            if (targetRing && targetRing.enabled) targetRing.enabled = false;
            navArrows.forEach(function (a) { if (a.enabled) a.enabled = false; });
            return;
        }

        var playerPos = walker.entity.getPosition();
        var floorY = (typeof walker.floorY === 'number') ? walker.floorY : (playerPos.y - 0.95);
        var arrowY = floorY + 0.05; // Slightly above floor

        var targetPos = activeTarget.worldPos;
        var directDist = Math.hypot(targetPos.x - playerPos.x, targetPos.z - playerPos.z);

        // Check Arrival
        if (directDist <= TARGET_RADIUS) {
            onArrived();
            return;
        }

        navTime += dt;

        // Destination Beacon Ring
        if (targetRing) {
            targetRing.enabled = true;
            targetRing.setPosition(targetPos.x, arrowY + 0.01, targetPos.z);
            var ringScale = 2.2 + Math.sin(navTime * 4.0) * 0.3;
            targetRing.setLocalScale(ringScale, 1.0, ringScale);
            targetRing.setEulerAngles(0, navTime * 30.0, 0);
        }

        // Calculate path along corridors
        var path = computeCorridorPath(playerPos, targetPos);

        // Calculate segment lengths
        var segLengths = [];
        var totalDist = 0;
        for (var s = 0; s < path.length - 1; s++) {
            var slen = Math.hypot(path[s + 1].x - path[s].x, path[s + 1].z - path[s].z);
            segLengths.push(slen);
            totalDist += slen;
        }

        var startOffset = 1.2;
        var availableDist = totalDist - startOffset - 0.9;
        var arrowCount = Math.min(MAX_ARROWS, Math.max(0, Math.floor(availableDist / SPACING)));

        for (var i = 0; i < MAX_ARROWS; i++) {
            var arrow = navArrows[i];
            if (i < arrowCount) {
                var targetD = startOffset + i * SPACING;

                // Find which segment targetD belongs to
                var acc = 0;
                var segIdx = 0;
                for (var j = 0; j < segLengths.length; j++) {
                    if (acc + segLengths[j] >= targetD || j === segLengths.length - 1) {
                        segIdx = j;
                        break;
                    }
                    acc += segLengths[j];
                }

                var segDist = targetD - acc;
                var segLen = Math.max(0.001, segLengths[segIdx]);
                var t = Math.min(1.0, Math.max(0.0, segDist / segLen));

                var p0 = path[segIdx];
                var p1 = path[segIdx + 1];

                var px = p0.x + t * (p1.x - p0.x);
                var pz = p0.z + t * (p1.z - p0.z);

                // Segment direction
                var dirX = (p1.x - p0.x) / segLen;
                var dirZ = (p1.z - p0.z) / segLen;

                // Smooth corner curving: if near the end of segment and there's a next segment
                if (segIdx < path.length - 2) {
                    var distToCorner = segLen - segDist;
                    var cornerRadius = 1.4; // Curve influence zone in meters
                    if (distToCorner < cornerRadius) {
                        var p2 = path[segIdx + 2];
                        var nextLen = Math.max(0.001, segLengths[segIdx + 1]);
                        var nextDirX = (p2.x - p1.x) / nextLen;
                        var nextDirZ = (p2.z - p1.z) / nextLen;

                        var blend = (cornerRadius - distToCorner) / cornerRadius; // 0 to 1
                        dirX = (1 - blend * 0.75) * dirX + (blend * 0.75) * nextDirX;
                        dirZ = (1 - blend * 0.75) * dirZ + (blend * 0.75) * nextDirZ;
                    }
                }

                var angleDeg = Math.atan2(dirX, dirZ) * (180 / Math.PI) + ANGLE_OFFSET;

                arrow.enabled = true;
                arrow.setPosition(px, arrowY, pz);
                arrow.setEulerAngles(0, angleDeg, 0);

                // Animated wave pulse flowing forward toward target
                var wave = (Math.sin(navTime * 6.5 - i * 0.55) + 1.0) * 0.5;
                arrow.setLocalScale(0.85 + 0.22 * wave, 1.0, 1.10 + 0.28 * wave);
            } else {
                if (arrow.enabled) arrow.enabled = false;
            }
        }
    }

    function onArrived() {
        var name = activeTarget ? activeTarget.name : 'จุดหมาย';
        cancelNavigation();

        var toast = document.getElementById('nav-arrival-toast');
        var toastText = document.getElementById('nav-arrival-text');
        if (toast && toastText) {
            toastText.textContent = '🎉 ถึงจุดหมาย ' + name + ' เรียบร้อยแล้ว!';
            toast.style.display = 'flex';
            setTimeout(function () {
                if (toast) toast.style.display = 'none';
            }, 3800);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Public API & Navigation Control
    // ─────────────────────────────────────────────────────────────

    window.startNavigation = function (hotspotId) {
        var list = getHotspotsList();
        var hs = list.find(function (h) { return h.id === hotspotId; });
        if (!hs) return;

        var walker = getWalker();
        if (walker && walker.app && !isInitialized) {
            init3D(walker.app);
            isInitialized = true;
        }

        activeTarget = hs;


        window.toggleNavMenu(false);
    };

    window.cancelNavigation = function () {
        activeTarget = null;
        if (targetRing) targetRing.enabled = false;
        navArrows.forEach(function (a) { a.enabled = false; });
    };

    window.toggleNavMenu = function (forceState) {
        var modal = document.getElementById('nav-modal');
        if (!modal) return;

        var shouldOpen = (typeof forceState === 'boolean') ? forceState : (modal.style.display === 'none' || !modal.style.display);
        if (shouldOpen) {
            var searchInput = document.getElementById('nav-search-input');
            if (searchInput) {
                searchInput.value = '';
                searchInput.oninput = function () {
                    renderDestList(this.value);
                };
                searchInput.onkeydown = function (e) {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                        window.toggleNavMenu(false);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        var listEl = document.getElementById('nav-dest-list');
                        var firstItem = listEl ? listEl.querySelector('.nav-dest-item') : null;
                        if (firstItem) firstItem.click();
                    }
                };
            }
            renderDestList('');
            modal.style.display = 'flex';
            setTimeout(function () {
                var inp = document.getElementById('nav-search-input');
                if (inp) inp.focus();
            }, 80);
        } else {
            modal.style.display = 'none';
            var canvas = document.getElementById('application-canvas');
            if (canvas) canvas.focus();
        }
    };

    function getHotspotsList() {
        var walker = getWalker();
        var arr = (walker && Array.isArray(walker.hotspots)) ? [].concat(walker.hotspots) : [];

        // Also check custom hotspots saved in localStorage for this floor
        var floorKey = getCurrentFloorId() + '_hotspots_v1';
        try {
            var saved = localStorage.getItem(floorKey);
            if (saved) {
                var customList = JSON.parse(saved);
                if (Array.isArray(customList)) {
                    customList.forEach(function (ch) {
                        if (ch && ch.id && !arr.some(function (h) { return h.id === ch.id; })) {
                            var p = ch.pos || {};
                            arr.push({
                                id: ch.id,
                                name: ch.name || 'จุดหมาย',
                                hint: ch.hint || 'จุดที่บันทึกไว้',
                                icon: ch.icon || '📍',
                                worldPos: new pc.Vec3(p.x || 0, p.y || 1.5, p.z || 0)
                            });
                        }
                    });
                }
            }
        } catch (e) {}

        // Fallback to DOM elements if array is still empty
        if (arr.length === 0) {
            var domHotspots = document.querySelectorAll('.hotspot-3d');
            domHotspots.forEach(function (el) {
                var titleEl = el.querySelector('.hotspot-title');
                var hintEl  = el.querySelector('.hotspot-hint');
                var dotEl   = el.querySelector('.hotspot-dot');
                var name    = titleEl ? titleEl.textContent : (el.title || el.id);
                if (el.id === 'hs_elevator_main') return;
                arr.push({
                    id: el.id,
                    name: name,
                    hint: hintEl ? hintEl.textContent : 'คลิกเพื่อเริ่มนำทาง',
                    icon: dotEl ? dotEl.textContent.trim() : '📍',
                    worldPos: null
                });
            });
        }

        return arr;
    }

    function renderDestList(filterText) {
        var listEl = document.getElementById('nav-dest-list');
        var cancelBtn = document.getElementById('btn-cancel-nav-modal');
        if (!listEl) return;

        if (cancelBtn) {
            cancelBtn.style.display = activeTarget ? 'block' : 'none';
        }

        listEl.innerHTML = '';
        var query = (filterText || '').toLowerCase().trim();
        var hotspotArray = getHotspotsList();

        if (hotspotArray.length === 0) {
            listEl.innerHTML = '<div class="nav-empty">ยังไม่มีจุดหมายบนชั้นนี้' +
                '<span>กด <kbd>Ctrl+H</kbd> เพื่อเพิ่มจุด Hotspot</span></div>';
            return;
        }

        var matched = query
            ? hotspotArray.filter(function (hs) {
                return (hs.name && hs.name.toLowerCase().indexOf(query) !== -1) ||
                       (hs.hint && hs.hint.toLowerCase().indexOf(query) !== -1);
            })
            : hotspotArray;

        if (matched.length === 0) {
            listEl.innerHTML = '<div class="nav-empty">ไม่พบห้องที่ค้นหา "' + query.replace(/</g, '&lt;') + '"</div>';
            return;
        }

        matched.forEach(function (hs) {
            var isCurrent = activeTarget && activeTarget.id === hs.id;
            var isElevator = (hs.name && hs.name.indexOf('ลิฟต์') !== -1) || hs.id === 'hs_elevator_main';
            var iconSvg = isElevator
                ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M9 10l-1.5-2L6 10M15 14l1.5 2 1.5-2"/></svg>'
                : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>';

            var item = document.createElement('div');
            item.className = 'nav-dest-item' + (isCurrent ? ' active' : '');
            item.setAttribute('data-name', hs.name || '');

            // Highlight matched text (escape first)
            var displayName = String(hs.name || '').replace(/</g, '&lt;');
            if (query) {
                var idx = displayName.toLowerCase().indexOf(query);
                if (idx !== -1) {
                    displayName = displayName.substring(0, idx) +
                        '<mark>' + displayName.substring(idx, idx + query.length) + '</mark>' +
                        displayName.substring(idx + query.length);
                }
            }

            item.innerHTML =
                '<span class="nav-dest-icon">' + iconSvg + '</span>' +
                '<span class="nav-dest-name">' + displayName + '</span>' +
                (isCurrent ? '<span class="nav-dest-tag">กำลังนำทาง</span>' : '<span class="nav-dest-go">เลือก</span>');

            item.onclick = function () {
                window.startNavigation(hs.id);
            };

            listEl.appendChild(item);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 6. DOM Injection & Auto-Initialization
    // ─────────────────────────────────────────────────────────────

    function injectUI() {
        if (document.getElementById('nav-modal')) return;

        // Styles
        var style = document.createElement('style');
        style.textContent =
            '@keyframes arrival-pop { 0%{ transform:translate(-50%, -12px); opacity:0; } 100%{ transform:translate(-50%, 0); opacity:1; } }' +
            '#nav-modal { font-family:\'Sarabun\',sans-serif; }' +
            '#nav-modal .nav-card { background:#fff; color:#1f2937; width:90%; max-width:460px; border-radius:10px; box-shadow:0 12px 40px rgba(0,0,0,0.28); box-sizing:border-box; overflow:hidden; }' +
            '#nav-modal .nav-head { display:flex; justify-content:space-between; align-items:flex-start; padding:18px 20px 14px; border-bottom:1px solid #e5e7eb; }' +
            '#nav-modal .nav-title { font-size:17px; font-weight:700; color:#111827; margin:0; }' +
            '#nav-modal .nav-sub { font-size:12.5px; color:#6b7280; margin-top:2px; }' +
            '#nav-modal .nav-close { background:none; border:none; color:#9ca3af; font-size:22px; line-height:1; cursor:pointer; padding:0 2px; }' +
            '#nav-modal .nav-close:hover { color:#111827; }' +
            '#nav-modal .nav-body { padding:14px 20px 18px; }' +
            '#nav-modal ::-webkit-scrollbar { width:6px; }' +
            '#nav-modal ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:3px; }' +
            '#nav-search-input { width:100%; box-sizing:border-box; background:#f9fafb; border:1px solid #d1d5db; border-radius:6px; color:#111827; font-size:14px; font-family:\'Sarabun\',sans-serif; padding:10px 12px; outline:none; margin-bottom:12px; }' +
            '#nav-search-input:focus { border-color:#f95738; background:#fff; }' +
            '#nav-search-input::placeholder { color:#9ca3af; }' +
            '#nav-dest-list { display:flex; flex-direction:column; max-height:320px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:6px; }' +
            '.nav-dest-item { display:flex; align-items:center; gap:12px; padding:11px 14px; cursor:pointer; background:#fff; border-bottom:1px solid #f0f1f3; }' +
            '.nav-dest-item:last-child { border-bottom:none; }' +
            '.nav-dest-item:hover { background:#fff4f1; }' +
            '.nav-dest-item.active { background:#fff4f1; box-shadow:inset 3px 0 0 #f95738; }' +
            '.nav-dest-icon { color:#f95738; display:flex; flex-shrink:0; }' +
            '.nav-dest-name { flex:1; font-size:14.5px; font-weight:600; color:#1f2937; }' +
            '.nav-dest-name mark { background:#ffe3dc; color:inherit; padding:0 1px; }' +
            '.nav-dest-go { font-size:12px; color:#9ca3af; }' +
            '.nav-dest-item:hover .nav-dest-go { color:#f95738; }' +
            '.nav-dest-tag { font-size:11.5px; color:#f95738; font-weight:700; }' +
            '.nav-empty { text-align:center; color:#6b7280; padding:22px 12px; font-size:14px; }' +
            '.nav-empty span { display:block; font-size:12px; color:#9ca3af; margin-top:6px; }' +
            '.nav-empty kbd { background:#f3f4f6; border:1px solid #d1d5db; border-radius:3px; padding:0 5px; font-size:11px; }' +
            '#btn-cancel-nav-modal { display:none; width:100%; margin-top:12px; padding:9px; background:#fff; border:1px solid #d1d5db; color:#b91c1c; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; font-family:\'Sarabun\',sans-serif; }' +
            '#btn-cancel-nav-modal:hover { background:#fef2f2; border-color:#fca5a5; }';
        document.head.appendChild(style);

        // Navigation Selection Modal
        var modal = document.createElement('div');
        modal.id = 'nav-modal';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(17,24,39,0.55); z-index:10002; align-items:center; justify-content:center;';
        modal.innerHTML =
            '<div class="nav-card">' +
            '  <div class="nav-head">' +
            '    <div>' +
            '      <h3 class="nav-title">ค้นหาห้อง / นำทาง</h3>' +
            '      <div class="nav-sub">พิมพ์ชื่อห้อง หรือเลือกจากรายการด้านล่าง</div>' +
            '    </div>' +
            '    <button class="nav-close" onclick="window.toggleNavMenu(false)" aria-label="ปิด">&times;</button>' +
            '  </div>' +
            '  <div class="nav-body">' +
            '    <input id="nav-search-input" type="text" placeholder="ค้นหา เช่น 9127, ห้องสมุด, ลิฟต์" autocomplete="off" />' +
            '    <div id="nav-dest-list"></div>' +
            '    <button onclick="window.cancelNavigation(); window.toggleNavMenu(false);" id="btn-cancel-nav-modal">ยกเลิกการนำทาง</button>' +
            '  </div>' +
            '</div>';
        modal.onclick = function (e) {
            if (e.target === modal) window.toggleNavMenu(false);
        };
        document.body.appendChild(modal);


        // Arrival Toast
        var toast = document.createElement('div');
        toast.id = 'nav-arrival-toast';
        toast.style.cssText = 'display:none; position:fixed; top:85px; left:50%; transform:translateX(-50%); background:#fff; border:1px solid #f95738; border-left:4px solid #f95738; box-shadow:0 6px 20px rgba(0,0,0,0.2); color:#1f2937; padding:11px 20px; border-radius:6px; font-size:14px; font-weight:600; align-items:center; gap:10px; z-index:10001; animation:arrival-pop 0.3s ease-out; font-family:\'Sarabun\',sans-serif;';
        toast.innerHTML = '<span id="nav-arrival-text">ถึงจุดหมายแล้ว</span>';
        document.body.appendChild(toast);

        // Enhance HUD button to show "🔍 ค้นหาห้อง..."
        var navBtn = document.getElementById('btn-nav-guide');
        if (navBtn) {
            navBtn.title = 'ค้นหาห้อง / นำทาง (กด / เพื่อค้นหา)';
            navBtn.innerHTML = '<span style="font-size:15px;">🔍</span><span style="font-weight:600;">ค้นหาห้อง...</span><kbd style="background:rgba(255,255,255,0.18); padding:1px 5px; border-radius:4px; font-size:10px; opacity:0.85; margin-left:2px;">/</kbd>';
            navBtn.style.background = 'linear-gradient(135deg, rgba(14,165,233,0.35), rgba(2,132,199,0.35))';
            navBtn.style.borderColor = 'rgba(56,189,248,0.6)';
            navBtn.style.boxShadow = '0 0 12px rgba(56,189,248,0.25)';
        }

        // Global hotkey: '/' to search
        window.addEventListener('keydown', function (e) {
            if (e.key === '/' && document.activeElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                window.toggleNavMenu(true);
            }
        });
    }

    function tryInit() {
        injectUI();

        var walker = getWalker();
        if (walker && walker.app && !isInitialized) {
            init3D(walker.app);
            isInitialized = true;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    window.addEventListener('hotspot-editor-ready', tryInit);
    window.addEventListener('load', tryInit);
})();
