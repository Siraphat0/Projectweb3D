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

    // Portal to Floor 05 (ทางเดินชั้น 5)
    window.portalToFloor05 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor05/?from=9525';
        }, 500);
    };

    // Portal to Floor 04
    window.portalToFloor04 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor04/';
        }, 500);
    };

    // Portal to Floor 03
    window.portalToFloor03 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor03/';
        }, 500);
    };

    // Portal to Floor 02
    window.portalToFloor02 = function () {
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = '../floor02/';
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
                progressText.textContent = `กำลังโหลดข้อมูล 3D ห้อง 9525 (${pct}%)...`;
            } else {
                progressText.textContent = '✅ ดาวน์โหลดข้อมูลห้อง 9525 สมบูรณ์แล้ว!';
            }
        }
    };

    let isLoaded = false;

    const showEnterButton = () => {
        if (isLoaded) return;
        isLoaded = true;

        if (progressFill) progressFill.style.width = '100%';
        if (progressPct)  progressPct.textContent  = '100%';
        if (progressText) progressText.textContent = '✅ ดาวน์โหลดข้อมูลห้อง 9525 สมบูรณ์แล้ว!';

        if (enterBtn) {
            enterBtn.classList.add('visible');
            enterBtn.focus();
            enterBtn.addEventListener('click', () => {
                hideLoadingScreen();
            }, { once: true });
        } else {
            hideLoadingScreen();
        }
    };

    const hideLoadingScreen = () => {
        if (!loadingScreen) return;
        loadingScreen.classList.add('hidden');
        if (tourHud) {
            tourHud.classList.add('active');
            tourHud.classList.add('visible');
        }

        setTimeout(() => {
            loadingScreen.remove();
        }, 800);
    };

    app.on('preload:progress', setProgress);
    app.once('preload:end', () => {
        app.off('preload:progress', setProgress);
    });

    app.once('start', () => {
        setProgress(1);
        setTimeout(showEnterButton, 200);
    });
});
