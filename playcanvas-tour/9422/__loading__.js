pc.script.createLoadingScreen((app) => {
    const loadingScreen = document.getElementById('loading-screen');
    const progressFill  = document.getElementById('progress-fill');
    const progressPct   = document.getElementById('progress-pct');
    const progressText  = document.getElementById('progress-text');
    const enterBtn      = document.getElementById('enter-btn');
    const tipText       = document.getElementById('tip-text');
    const tourHud       = document.getElementById('tour-hud');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnResetCam   = document.getElementById('btn-reset-cam');
    const portalFade    = document.getElementById('portal-fade');

    // Portal to Floor 04 (ทางเดินชั้น 4)
    window.portalToFloor04 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor04/';
        }, 500);
    };

    // Portal to Floor 01
    window.portalToFloor01 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor01/';
        }, 500);
    };

    // Portal to Main Lobby
    window.portalToInside = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../inside/';
        }, 500);
    };

    // Portal to Floor 02
    window.portalToFloor02 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor02/';
        }, 500);
    };

    // Portal to Floor 03
    window.portalToFloor03 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor03/';
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

    // Portal to Outside
    window.portalToOutside = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../';
        }, 500);
    };

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
                progressText.textContent = `กำลังโหลดข้อมูล 3D ห้อง 9422 (${pct}%)...`;
            } else {
                progressText.textContent = '✅ ดาวน์โหลดข้อมูลห้อง 9422 สมบูรณ์แล้ว!';
            }
        }
    };

    const showEnterButton = () => {
        setProgress(1);
        if (progressText) progressText.textContent = '🎉 ห้อง 9422 พร้อมเข้าชมแล้ว!';
        if (tipText) tipText.style.display = 'none';
        if (enterBtn) {
            enterBtn.style.display = 'inline-block';
            enterBtn.classList.add('visible');
            enterBtn.onclick = () => {
                if (loadingScreen) {
                    loadingScreen.classList.add('hidden');
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 500);
                }
                if (tourHud) tourHud.classList.add('active');
                const canvas = document.getElementById('application-canvas');
                if (canvas) canvas.focus();
            };
        }
    };

    app.on('preload:progress', setProgress);

    app.on('preload:end', () => {
        app.off('preload:progress');
        setProgress(1);
        setTimeout(showEnterButton, 300);
    });

    app.on('start', () => {
        showEnterButton();
    });

    // Safety fallback: if anything stalls, show button after 2.5s
    setTimeout(() => {
        showEnterButton();
    }, 2500);
});
