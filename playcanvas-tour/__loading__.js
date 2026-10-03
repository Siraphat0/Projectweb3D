pc.script.createLoadingScreen((app) => {
    const loadingScreen = document.getElementById('loading-screen');
    const progressFill = document.getElementById('progress-fill');
    const progressPct = document.getElementById('progress-pct');
    const progressText = document.getElementById('progress-text');
    const enterBtn = document.getElementById('enter-btn');
    const tipText = document.getElementById('tip-text');
    const tourHud = document.getElementById('tour-hud');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnResetCam = document.getElementById('btn-reset-cam');
    const btnDoorInside = document.getElementById('btn-door-inside');

    window.portalToInside = function () {
        const portalFade = document.getElementById('portal-fade');
        if (portalFade) portalFade.classList.add('active');
        setTimeout(() => {
            window.location.href = 'inside/';
        }, 500);
    };

    if (btnDoorInside) {
        btnDoorInside.addEventListener('click', window.portalToInside);
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
                document.documentElement.requestFullscreen().catch(() => { });
            } else {
                document.exitFullscreen().catch(() => { });
            }
        });
    }

    const setProgress = (value) => {
        value = Math.min(1, Math.max(0, value));
        const pct = Math.round(value * 100);
        if (progressFill) progressFill.style.width = pct + '%';
        if (progressPct) progressPct.textContent = pct + '%';
        if (progressText) {
            if (pct < 100) {
                progressText.textContent = `กำลังโหลดโมเดลและพื้นผิว (${pct}%)...`;
            } else {
                progressText.textContent = '✅ ดาวน์โหลดข้อมูลสมบูรณ์แล้ว!';
            }
        }
    };

    const showEnterButton = () => {
        setProgress(1);
        if (progressText) progressText.textContent = ' ฉากพร้อมเข้าชมแล้ว!';
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
