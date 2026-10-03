pc.script.createLoadingScreen((app) => {
    const loadingScreen = document.getElementById('loading-screen');
    const progressFill  = document.getElementById('progress-fill');
    const progressPct   = document.getElementById('progress-pct');
    const progressText  = document.getElementById('progress-text');
    const enterBtn      = document.getElementById('enter-btn');
    const tipText       = document.getElementById('tip-text');
    const tourHud       = document.getElementById('tour-hud');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnResetCam    = document.getElementById('btn-reset-cam');
    const btnDoorOutside  = document.getElementById('btn-door-outside');
    const btnDoorFloor01  = document.getElementById('btn-door-floor01');
    const portalFade      = document.getElementById('portal-fade');

    // Portal to Floor 01 (ชั้น 1 ด้านใน)
    window.portalToFloor01 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor01/';
        }, 500);
    };

    // Portal to Floor 05
    window.portalToFloor05 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor05/';
        }, 500);
    };

    // Portal to Room 9524
    window.portalTo9524 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../9524/';
        }, 500);
    };

    // Portal to Room 9422
    window.portalTo9422 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../9422/';
        }, 500);
    };

    // Function to navigate back to outside with smooth fade
    window.portalToOutside = function() {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../';
        }, 500);
    };

    if (btnDoorFloor01) {
        btnDoorFloor01.addEventListener('click', window.portalToFloor01);
    }

    if (btnDoorOutside) {
        btnDoorOutside.addEventListener('click', window.portalToOutside);
    }

    if (btnResetCam) {
        btnResetCam.addEventListener('click', () => {
            if (typeof window.resetPlayerPosition === 'function') {
                window.resetPlayerPosition();
            }
        });
    }

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    }

    // Model Level Tuner Buttons (adjusts the 3D model rotation directly)
    const btnTiltL2 = document.getElementById('btn-tilt-l2');
    const btnTiltL  = document.getElementById('btn-tilt-l');
    const btnTiltR  = document.getElementById('btn-tilt-r');
    const btnTiltR2 = document.getElementById('btn-tilt-r2');

    if (btnTiltL2) btnTiltL2.addEventListener('click', () => { if (window.adjustModelLevel) window.adjustModelLevel(-1.0, 0); });
    if (btnTiltL)  btnTiltL.addEventListener('click', () => { if (window.adjustModelLevel) window.adjustModelLevel(-0.2, 0); });
    if (btnTiltR)  btnTiltR.addEventListener('click', () => { if (window.adjustModelLevel) window.adjustModelLevel(0.2, 0); });
    if (btnTiltR2) btnTiltR2.addEventListener('click', () => { if (window.adjustModelLevel) window.adjustModelLevel(1.0, 0); });



    const setProgress = (value) => {
        value = Math.min(1, Math.max(0, value));
        const pct = Math.round(value * 100);
        if (progressFill) progressFill.style.width = pct + '%';
        if (progressPct)  progressPct.textContent = pct + '%';
        if (progressText) {
            if (pct < 100) {
                progressText.textContent = `กำลังโหลดโมเดลโถงชั้น 1 (${pct}%)...`;
            } else {
                progressText.textContent = '✅ ดาวน์โหลดข้อมูลสมบูรณ์แล้ว!';
            }
        }
    };

    const showEnterButton = () => {
        setProgress(1);
        if (progressText) progressText.textContent = '🎉 โถงชั้น 1 พร้อมเข้าชมแล้ว!';
        if (tipText) tipText.style.display = 'none';
        if (enterBtn) {
            enterBtn.style.display = 'block';
            enterBtn.onclick = () => {
                loadingScreen.classList.add('hidden');
                tourHud.classList.add('active');
                const canvas = document.getElementById('application-canvas');
                if (canvas) canvas.focus();
            };
        }
    };

    app.on('preload:progress', setProgress);
    app.on('preload:end', () => {
        app.off('preload:progress');
    });
    app.on('start', showEnterButton);
});
