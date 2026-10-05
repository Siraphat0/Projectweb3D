pc.script.createLoadingScreen((app) => {
    const loadingScreen  = document.getElementById('loading-screen');
    const progressFill   = document.getElementById('progress-fill');
    const progressPct    = document.getElementById('progress-pct');
    const progressText   = document.getElementById('progress-text');
    const enterBtn       = document.getElementById('enter-btn');
    const tipText        = document.getElementById('tip-text');
    const tourHud        = document.getElementById('tour-hud');
    const btnFullscreen  = document.getElementById('btn-fullscreen');
    const btnResetCam    = document.getElementById('btn-reset-cam');
    const btnBackFloor04 = document.getElementById('btn-back-floor04');
    const btnElevFloor02 = document.getElementById('btn-elevator-floor02');
    const btnElevFloor01 = document.getElementById('btn-elevator-floor01');
    const btnDoorInside  = document.getElementById('btn-door-inside');
    const portalFade     = document.getElementById('portal-fade');
    const elevatorModal  = document.getElementById('elevator-modal');

    // Elevator Modal Controller
    window.showElevatorModal = function () {
        if (elevatorModal) elevatorModal.style.display = 'flex';
    };

    // Portal to Room 9524
    window.portalTo9524 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../9524/';
        }, 500);
    };

    // Portal to Room 9525
    window.portalTo9525 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../9525/';
        }, 500);
    };

    // Portal to Room 9422
    window.portalTo9422 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../9422/';
        }, 500);
    };

    // Portal to Floor 04 (go down)
    window.portalToFloor04 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor04/';
        }, 500);
    };

    // Portal to Floor 03 (go down)
    window.portalToFloor03 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor03/';
        }, 500);
    };

    // Portal to Floor 02 (go down)
    window.portalToFloor02 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor02/';
        }, 500);
    };

    // Portal to Floor 01 (go down)
    window.portalToFloor01 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor01/';
        }, 500);
    };

    // Portal to Main Inside Lobby
    window.portalToInside = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../inside/';
        }, 500);
    };

    // Portal to Outside
    window.portalToOutside = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../';
        }, 500);
    };

    if (btnBackFloor04) btnBackFloor04.addEventListener('click', window.portalToFloor04);
    if (btnElevFloor02) btnElevFloor02.addEventListener('click', window.portalToFloor02);
    if (btnElevFloor01) btnElevFloor01.addEventListener('click', window.portalToFloor01);
    if (btnDoorInside)  btnDoorInside.addEventListener('click', window.portalToInside);

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

    const setProgress = (value) => {
        value = Math.min(1, Math.max(0, value));
        const pct = Math.round(value * 100);
        if (progressFill) progressFill.style.width = pct + '%';
        if (progressPct)  progressPct.textContent = pct + '%';
        if (progressText) {
            if (pct < 100) {
                progressText.textContent = `กำลังโหลดโมเดลชั้น 5 (${pct}%)...`;
            } else {
                progressText.textContent = '✅ ดาวน์โหลดข้อมูลสมบูรณ์แล้ว!';
            }
        }
    };

    const showEnterButton = () => {
        setProgress(1);
        if (progressText) progressText.textContent = '🎉 ชั้น 5 พร้อมเข้าชมแล้ว!';
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
