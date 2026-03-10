import { state, renderer, mainLight, scene, camera, controls } from './core.js';
import { applyMaterialLogic } from './models.js';  // se definirá después

// Detección automática de calidad base
const ua = navigator.userAgent;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
const deviceMemory = navigator.deviceMemory || 4;
const cpuCores = navigator.hardwareConcurrency || 4;
let baseTier = 'alta';
if (isMobileUA || deviceMemory <= 4 || cpuCores <= 4) baseTier = 'media';
if (isMobileUA && (deviceMemory <= 2 || cpuCores <= 2)) baseTier = 'baja';

// Cargar o crear settings
state.gameSettings = JSON.parse(localStorage.getItem('ff_settings')) || {
    calidad: baseTier,
    sombras: baseTier === 'baja' ? 0 : (baseTier === 'media' ? 1 : 2),
    fps: baseTier === 'baja' ? 30 : 60,
    volumenTV: 50,
    volumenEfectos: 50,
    mostrarFps: false
};
// Compatibilidad con versión anterior
if (state.gameSettings.volumen) {
    state.gameSettings.volumenTV = state.gameSettings.volumen;
    state.gameSettings.volumenEfectos = state.gameSettings.volumen;
    delete state.gameSettings.volumen;
}

// Aplicar configuración actual
export function applyCurrentSettings() {
    let pixelRatio = 1;
    if (state.gameSettings.calidad === 'media') pixelRatio = Math.min(window.devicePixelRatio, 1.2);
    else if (state.gameSettings.calidad === 'alta') pixelRatio = Math.min(window.devicePixelRatio, 2);

    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = state.gameSettings.sombras > 0;
    renderer.shadowMap.type = state.gameSettings.sombras >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    mainLight.castShadow = state.gameSettings.sombras > 0;
    if (state.gameSettings.sombras > 0) {
        let shadowRes = state.gameSettings.sombras === 2 ? (isMobileUA ? 1024 : 2048) : 512;
        mainLight.shadow.mapSize.set(shadowRes, shadowRes);
    }

    // Re-aplicar materiales (sombras/emisión)
    for (let cat in state.loadedSlotMeshes) {
        applyMaterialLogic(state.loadedSlotMeshes[cat], cat);
    }
    if (state.focoDiaMesh) actualizarIluminacionFocoDia(); // definida en lighting.js

    document.getElementById('fps-counter').style.display = state.gameSettings.mostrarFps ? 'block' : 'none';

    // Volúmenes
    const tvVideo = document.getElementById('tv-video');
    if (tvVideo) tvVideo.volume = state.gameSettings.volumenTV / 100;
    tvEffectVideoOff.volume = state.gameSettings.volumenEfectos / 100;
    tvEffectVideoOn.volume = state.gameSettings.volumenEfectos / 100;

    let volEf = state.gameSettings.volumenEfectos / 100;
    audioPrenderLuz.volume = volEf;
    audioApagarLuz.volume = volEf;
    audioAbrirPoster.volume = volEf;
    audioCerrarPoster.volume = volEf;
    audioBotonTV.volume = volEf;
}

// Sincronizar UI con los valores actuales
export function syncSettingsUI() {
    document.querySelectorAll('#setting-calidad button').forEach(b => {
        b.classList.toggle('active', b.dataset.val === state.gameSettings.calidad);
        b.onclick = () => {
            state.gameSettings.calidad = b.dataset.val;
            if (state.gameSettings.calidad === 'baja') {
                state.gameSettings.sombras = 0;
                state.gameSettings.fps = 30;
            } else if (state.gameSettings.calidad === 'media') {
                state.gameSettings.sombras = 1;
                state.gameSettings.fps = 60;
            } else if (state.gameSettings.calidad === 'alta') {
                state.gameSettings.sombras = 2;
                state.gameSettings.fps = 60;
            }
            syncSettingsUI();
            applyCurrentSettings();
        };
    });

    document.querySelectorAll('#setting-fps button').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val) === state.gameSettings.fps);
        b.onclick = () => {
            state.gameSettings.fps = parseInt(b.dataset.val);
            syncSettingsUI();
        };
    });

    const volTV = document.getElementById('setting-volumen-tv');
    volTV.value = state.gameSettings.volumenTV;
    document.getElementById('vol-tv-val').innerText = `${state.gameSettings.volumenTV}%`;
    volTV.oninput = (e) => {
        state.gameSettings.volumenTV = e.target.value;
        document.getElementById('vol-tv-val').innerText = `${state.gameSettings.volumenTV}%`;
        applyCurrentSettings();
    };

    const volEf = document.getElementById('setting-volumen-efectos');
    volEf.value = state.gameSettings.volumenEfectos;
    document.getElementById('vol-efectos-val').innerText = `${state.gameSettings.volumenEfectos}%`;
    volEf.oninput = (e) => {
        state.gameSettings.volumenEfectos = e.target.value;
        document.getElementById('vol-efectos-val').innerText = `${state.gameSettings.volumenEfectos}%`;
        applyCurrentSettings();
    };

    const fpsCheck = document.getElementById('setting-showfps');
    fpsCheck.checked = state.gameSettings.mostrarFps;
    fpsCheck.onchange = (e) => {
        state.gameSettings.mostrarFps = e.target.checked;
        applyCurrentSettings();
    };
}

// Inicializar eventos del modal de ajustes
export function initSettingsModal() {
    const settingsModal = document.getElementById('ff-settings-modal');
    document.getElementById('settings-button').onclick = () => settingsModal.classList.add('active');
    document.getElementById('close-ff-settings').onclick = () => {
        settingsModal.classList.remove('active');
        localStorage.setItem('ff_settings', JSON.stringify(state.gameSettings));
        applyCurrentSettings();
    };

    document.querySelectorAll('.ff-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.ff-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.ff-tab-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        };
    });

    syncSettingsUI();
}