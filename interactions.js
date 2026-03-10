import { state, getFreshUrl, applyMaterialLogic, actualizarIluminacionFocoDia, loadItemForSlot } from './core.js';

// ==================== TV ====================
function updatePlaylist() {
    state.tvPlaylist = state.inventoryData.videos.equipped.map(id => state.inventoryData.videos.items[id].file);
    if(state.tvPlaylist.length === 0) state.tvVideo.pause();
}

function playNextTv(random = false) {
    updatePlaylist();
    if(state.tvPlaylist.length === 0) return;
    state.currentTvIndex = random ? Math.floor(Math.random() * state.tvPlaylist.length) : (state.currentTvIndex + 1) % state.tvPlaylist.length;
    state.tvVideo.src = state.tvPlaylist[state.currentTvIndex];
    state.tvVideo.volume = state.gameSettings.volumenTV / 100;
    if (state.isTvOn && !state.tvTransitioning) state.tvVideo.play().catch(e => console.warn('User interaction needed', e));
}

// Controles TV
const tvPrevBtn = document.getElementById('tv-prev');
const tvPlayPauseBtn = document.getElementById('tv-play-pause');
const tvNextBtn = document.getElementById('tv-next');
const tvPowerBtn = document.getElementById('tv-power');

function playButtonSound() {
    state.audioBotonTV.currentTime = 0;
    state.audioBotonTV.play().catch(e=>{});
}

tvPrevBtn.onclick = () => {
    playButtonSound();
    if (!state.isTvOn || state.tvTransitioning) return;
    updatePlaylist();
    if(state.tvPlaylist.length===0)return;
    state.currentTvIndex = (state.currentTvIndex - 1 + state.tvPlaylist.length) % state.tvPlaylist.length;
    state.tvVideo.src = state.tvPlaylist[state.currentTvIndex];
    state.tvVideo.play();
};
tvPlayPauseBtn.onclick = () => {
    playButtonSound();
    if (!state.isTvOn || state.tvTransitioning) return;
    if(state.tvVideo.paused) state.tvVideo.play();
    else state.tvVideo.pause();
};
tvNextBtn.onclick = () => {
    playButtonSound();
    if (state.isTvOn && !state.tvTransitioning) playNextTv(false);
};

if (tvPowerBtn) {
    tvPowerBtn.innerText = state.isTvOn ? '🟢' : '🔴';
    tvPowerBtn.addEventListener('click', () => {
        playButtonSound();
        if (state.tvTransitioning || !state.tvScreenMesh) return;
        state.tvTransitioning = true;
        state.tvVideo.pause();
        const mats = Array.isArray(state.tvScreenMesh.material) ? state.tvScreenMesh.material : [state.tvScreenMesh.material];
        const effectVideo = state.isTvOn ? state.tvEffectVideoOff : state.tvEffectVideoOn;
        const effectTexture = state.isTvOn ? state.tvEffectTextureOff : state.tvEffectTextureOn;

        mats.forEach(mat => {
            mat.map = effectTexture;
            mat.emissiveMap = effectTexture;
            mat.color.setHex(0xffffff);
            mat.emissive.setHex(0xffffff);
            mat.emissiveIntensity = 1.0;
            mat.needsUpdate = true;
        });
        effectVideo.currentTime = 0;
        effectVideo.play().catch(e=>{});

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
                    mat.map = new THREE.VideoTexture(state.tvVideo);
                    mat.emissiveMap = mat.map;
                    mat.color.setHex(0xffffff);
                    mat.emissive.setHex(0xffffff);
                    mat.emissiveIntensity = 1.0;
                    mat.needsUpdate = true;
                });
                if (state.tvPlaylist.length > 0) {
                    state.tvVideo.currentTime = 0;
                    state.tvVideo.play().catch(e=>{});
                }
            }
            state.tvTransitioning = false;
        };
        effectVideo.addEventListener('ended', onEffectEnded, { once: true });
    });
}
playNextTv(true);

// ==================== CLIMA (VIDEO EN CUADRO) ====================
(async function setupWeatherVideo() {
    const video = document.createElement('video');
    video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    let videoFile = 'dia_soleado.mp4', weatherEmoji = "☀️", weatherName = "Clima estándar", temperature = "--";
    const statusBox = document.getElementById('weather-status');

    try {
        let lat, lon;
        try {
            const ipResponse = await fetch('https://ipapi.co/json/');
            const ipData = await ipResponse.json();
            if(ipData.latitude && ipData.longitude) { lat = ipData.latitude; lon = ipData.longitude; }
            else throw new Error();
        } catch(e) { lat = -12.0464; lon = -77.0428; }
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode, isDay = data.current_weather.is_day;
        state.esDeDiaLocal = (isDay === 1);
        state.lastWeatherCode = code;
        actualizarIluminacionFocoDia();
        temperature = data.current_weather.temperature;

        if (code === 0) { weatherName = isDay ? "Despejado" : "Noche despejada"; weatherEmoji = isDay ? "☀️" : "🌙"; videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; }
        else if ([1, 2, 3].includes(code)) { weatherName = isDay ? "Nublado" : "Noche nublada"; weatherEmoji = "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; }
        else if (code === 45 || code === 48) { weatherName = "Niebla"; weatherEmoji = "🌫️"; videoFile = isDay ? 'dia_niebla.mp4' : 'noche_niebla.mp4'; }
        else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) { weatherName = "Lluvia"; weatherEmoji = "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; }
        else if ([71, 73, 75, 77, 85, 86].includes(code)) { weatherName = "Nieve"; weatherEmoji = "❄️"; videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4'; }
        else if ([95, 96, 99].includes(code)) { weatherName = "Tormenta"; weatherEmoji = "⛈️"; videoFile = isDay ? 'dia_tormenta.mp4' : 'noche_tormenta.mp4'; }
    } catch (error) { weatherEmoji = "❌"; weatherName = "Clima offline"; }

    statusBox.innerHTML = temperature !== "--" ? `${weatherEmoji} ${weatherName} | ${temperature}°C` : `${weatherEmoji} ${weatherName}`;
    video.src = videoFile;
    video.play().catch(e => console.log('Autoplay blocked'));

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;
    videoTexture.encoding = THREE.sRGBEncoding;

    state.loader.load(getFreshUrl('cuadro.glb'), (gltf) => {
        const cuadroModel = gltf.scene;
        cuadroModel.traverse((node) => {
            if (node.isMesh && node.material) {
                if (Array.isArray(node.material)) {
                    node.material.forEach(mat => {
                        mat.map = videoTexture;
                        mat.emissive = new THREE.Color(0xffffff);
                        mat.emissiveMap = videoTexture;
                        mat.emissiveIntensity = 1.0;
                        mat.needsUpdate = true;
                    });
                } else {
                    node.material.map = videoTexture;
                    node.material.emissive = new THREE.Color(0xffffff);
                    node.material.emissiveMap = videoTexture;
                    node.material.emissiveIntensity = 1.0;
                    node.material.needsUpdate = true;
                }
            }
        });
        applyMaterialLogic(cuadroModel, 'cuadro');
        state.scene.add(cuadroModel);
        state.loadedSlotMeshes['cuadro'] = cuadroModel;
        // checkLoading se llama desde core
    }, undefined, () => {});
})();

// ==================== CAMBIO DE ANIMACIÓN DE LUNARI ====================
setInterval(() => {
    if (!state.randomAction || !state.baseAction || !state.lunariMixer || state.currentAction === state.randomAction) return;
    if (state.baseAction && state.randomAction) {
        state.baseAction.fadeOut(0.5);
        state.randomAction.reset().fadeIn(0.5).play();
        state.currentAction = state.randomAction;
        const onFinished = (event) => {
            if (event.action === state.randomAction) {
                state.randomAction.fadeOut(0.5);
                state.baseAction.reset().fadeIn(0.5).play();
                state.currentAction = state.baseAction;
                state.lunariMixer.removeEventListener('finished', onFinished);
            }
        };
        state.lunariMixer.addEventListener('finished', onFinished);
    }
}, 60000);

// ==================== LUZ DE HABITACIÓN ====================
export function updateLighting() {
    if (state.lightOn) {
        state.mainLight.visible = true;
        state.ambient.intensity = state.gameSettings.calidad === 'baja' ? 0.8 : 0.3;
        state.hemiLight.intensity = state.gameSettings.calidad === 'baja' ? 0.8 : 0.4;
        document.getElementById('light-status').innerText = '💡 Luz encendida';
        if (state.focoMesh) {
            state.focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 1.5; });
        }
    } else {
        state.mainLight.visible = false;
        state.ambient.intensity = 0.02;
        state.hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
        if (state.focoMesh) {
            state.focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 0; });
        }
    }
}

function toggleLight() {
    state.lightOn = !state.lightOn;
    localStorage.setItem('lightState', state.lightOn ? 'on' : 'off');
    updateLighting();
    if (state.lightOn) {
        state.audioPrenderLuz.currentTime = 0;
        state.audioPrenderLuz.play().catch(e=>{});
    } else {
        state.audioApagarLuz.currentTime = 0;
        state.audioApagarLuz.play().catch(e=>{});
    }
}

// ==================== INTERACCIÓN (CLICKS) ====================
const posterViewModal = document.getElementById('poster-view-modal');
const posterEnlargedImage = document.getElementById('poster-enlarged-image');
document.getElementById('close-poster-view').onclick = () => {
    posterViewModal.classList.remove('visible');
    state.audioCerrarPoster.currentTime = 0;
    state.audioCerrarPoster.play().catch(e=>{});
};
posterViewModal.onclick = (e) => {
    if (e.target === posterViewModal) {
        posterViewModal.classList.remove('visible');
        state.audioCerrarPoster.currentTime = 0;
        state.audioCerrarPoster.play().catch(e=>{});
    }
};

let lastTvClickTime = 0;
function handleInteraction(event) {
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.mouse, state.camera);

    if (state.switchMesh && state.raycaster.intersectObject(state.switchMesh, true).length > 0) {
        toggleLight();
        return;
    }

    const pantallaMesh = state.loadedSlotMeshes['pantalla_tv'];
    if (pantallaMesh && state.raycaster.intersectObject(pantallaMesh, true).length > 0) {
        const tvControls = document.getElementById('tv-controls');
        const currentTime = Date.now();
        if (currentTime - lastTvClickTime < 300) {
            if (state.isTvOn && !state.tvTransitioning) {
                if (state.tvVideo.paused) state.tvVideo.play().catch(e=>{});
                else state.tvVideo.pause();
            }
        } else {
            if (tvControls.style.display === 'none' || tvControls.style.display === '') tvControls.style.display = 'flex';
            else tvControls.style.display = 'none';
        }
        lastTvClickTime = currentTime;
        return;
    }

    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const pMesh = state.loadedSlotMeshes[cat];
        if (pMesh && state.raycaster.intersectObject(pMesh, true).length > 0) {
            const itemData = state.inventoryData[cat].items[state.inventoryData[cat].equipped];
            if (itemData && itemData.preview) {
                posterEnlargedImage.src = itemData.preview;
                posterViewModal.classList.add('visible');
                state.audioAbrirPoster.currentTime = 0;
                state.audioAbrirPoster.play().catch(e=>{});
            }
            break;
        }
    }
}

// Eventos de puntero
let pointerDownPos = { x: 0, y: 0 };
let isDragging = false;
state.renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
    isDragging = false;
});
state.renderer.domElement.addEventListener('pointermove', (e) => {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) isDragging = true;
});
state.renderer.domElement.addEventListener('pointerup', (e) => {
    if (!isDragging && !document.getElementById('inventory-modal').classList.contains('visible') && !document.getElementById('ff-settings-modal').classList.contains('active')) {
        handleInteraction(e);
    }
    isDragging = false;
});

// Inicializar estado de luz
updateLighting();

export { updatePlaylist };