import { state, tvVideo, tvTexture, tvEffectVideoOff, tvEffectVideoOn, tvEffectTextureOff, tvEffectTextureOn, audioBotonTV } from './core.js';
import { state } from './core.js';  // para acceder a inventoryData

export function updatePlaylist() {
    state.tvPlaylist = state.inventoryData.videos.equipped.map(id => state.inventoryData.videos.items[id].file);
    if (state.tvPlaylist.length === 0) tvVideo.pause();
}

export function playNextTv(random = false) {
    updatePlaylist();
    if (state.tvPlaylist.length === 0) return;
    if (random) {
        state.currentTvIndex = Math.floor(Math.random() * state.tvPlaylist.length);
    } else {
        state.currentTvIndex = (state.currentTvIndex + 1) % state.tvPlaylist.length;
    }
    tvVideo.src = state.tvPlaylist[state.currentTvIndex];
    tvVideo.volume = state.gameSettings.volumenTV / 100;
    if (state.isTvOn && !state.tvTransitioning) {
        tvVideo.play().catch(e => console.warn('User interaction needed', e));
    }
}

function playButtonSound() {
    audioBotonTV.currentTime = 0;
    audioBotonTV.play().catch(e => {});
}

// Inicializar controles de TV
export function initTVControls() {
    const tvPrevBtn = document.getElementById('tv-prev');
    const tvPlayPauseBtn = document.getElementById('tv-play-pause');
    const tvNextBtn = document.getElementById('tv-next');
    const tvPowerBtn = document.getElementById('tv-power');

    if (tvPowerBtn) {
        tvPowerBtn.innerText = state.isTvOn ? '🟢' : '🔴';
        tvPowerBtn.addEventListener('click', () => {
            playButtonSound();
            if (state.tvTransitioning || !state.tvScreenMesh) return;
            state.tvTransitioning = true;
            tvVideo.pause();

            const mats = Array.isArray(state.tvScreenMesh.material)
                ? state.tvScreenMesh.material
                : [state.tvScreenMesh.material];
            const effectVideo = state.isTvOn ? tvEffectVideoOff : tvEffectVideoOn;
            const effectTexture = state.isTvOn ? tvEffectTextureOff : tvEffectTextureOn;

            mats.forEach(mat => {
                mat.map = effectTexture;
                mat.emissiveMap = effectTexture;
                mat.color.setHex(0xffffff);
                mat.emissive.setHex(0xffffff);
                mat.emissiveIntensity = 1.0;
                mat.needsUpdate = true;
            });
            effectVideo.currentTime = 0;
            effectVideo.play().catch(e => {});

            const onEffectEnded = () => {
                effectVideo.removeEventListener('ended', onEffectEnded);
                if (state.isTvOn) {
                    state.isTvOn = false;
                    tvPowerBtn.innerText = '🔴';
                    tvPowerBtn.style.color = 'red';
                    tvPowerBtn.style.textShadow = '0 0 5px red';
                    mats.forEach(mat => {
                        mat.map = null;
                        mat.emissiveMap = null;
                        mat.color.setHex(0x000000);
                        mat.emissive.setHex(0x000000);
                        mat.emissiveIntensity = 0;
                        mat.needsUpdate = true;
                    });
                } else {
                    state.isTvOn = true;
                    tvPowerBtn.innerText = '🟢';
                    tvPowerBtn.style.color = '#00ff00';
                    tvPowerBtn.style.textShadow = '0 0 5px #00ff00';
                    mats.forEach(mat => {
                        mat.map = tvTexture;
                        mat.emissiveMap = tvTexture;
                        mat.color.setHex(0xffffff);
                        mat.emissive.setHex(0xffffff);
                        mat.emissiveIntensity = 1.0;
                        mat.needsUpdate = true;
                    });
                    if (state.tvPlaylist.length > 0) {
                        tvVideo.currentTime = 0;
                        tvVideo.play().catch(e => {});
                    }
                }
                state.tvTransitioning = false;
            };
            effectVideo.addEventListener('ended', onEffectEnded, { once: true });
        });
    }

    tvPrevBtn.onclick = () => {
        playButtonSound();
        if (!state.isTvOn || state.tvTransitioning) return;
        updatePlaylist();
        if (state.tvPlaylist.length === 0) return;
        state.currentTvIndex = (state.currentTvIndex - 1 + state.tvPlaylist.length) % state.tvPlaylist.length;
        tvVideo.src = state.tvPlaylist[state.currentTvIndex];
        tvVideo.play();
    };

    tvPlayPauseBtn.onclick = () => {
        playButtonSound();
        if (!state.isTvOn || state.tvTransitioning) return;
        if (tvVideo.paused) tvVideo.play();
        else tvVideo.pause();
    };

    tvNextBtn.onclick = () => {
        playButtonSound();
        if (state.isTvOn && !state.tvTransitioning) playNextTv(false);
    };

    // Iniciar con un video aleatorio
    playNextTv(true);
}