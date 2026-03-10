// Este archivo ahora solo importa todos los módulos y arranca la aplicación
import './core.js';  // asegura que core se ejecute primero
import { state, scene, camera, renderer, controls, clock, ambient, hemiLight, mainLight, tvVideo } from './core.js';
import { initInventoryData, initInventoryModal } from './inventory.js';
import { initSettingsModal, applyCurrentSettings } from './settings.js';
import { loadLunari } from './lunari.js';
import { initWeather } from './weather.js';
import { initTVControls } from './tv.js';
import { loadItemForSlot } from './models.js';
import { checkDailyReward } from './rewards.js';
import { updateLighting } from './lighting.js';
import './interactions.js';  // solo importar para que se ejecuten los eventos

// Inicializar datos
initInventoryData();
checkDailyReward();

// Configurar cámaras según dispositivo
const ua = navigator.userAgent;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
let camPosY = 6, camPosZ = 14, targetY = 6;
if (window.innerWidth < 768 || isMobileUA) { camPosY = 6; camPosZ = 12; targetY = 5; }
camera.position.set(0, camPosY, camPosZ);
controls.target.set(0, targetY, 0);

// Añadir luces a la escena
scene.add(ambient);
scene.add(hemiLight);
scene.add(mainLight);
scene.add(mainLight.target);

// Contar modelos a cargar (para barra de progreso)
import { defaultInventoryConfig } from './inventory-data.js';
import { state } from './core.js';
for (let cat in defaultInventoryConfig) {
    if (defaultInventoryConfig[cat].type === 'multiple') continue;
    let eqId = defaultInventoryConfig[cat].equipped;
    if (defaultInventoryConfig[cat].items && defaultInventoryConfig[cat].items[eqId]) {
        let it = defaultInventoryConfig[cat].items[eqId];
        if (it.file) state.totalModelsToLoad++;
        if (cat === 'foco' && it.baseFile) state.totalModelsToLoad++;
        if (cat === 'tele' && it.baseFile) state.totalModelsToLoad++;
    }
}
state.totalModelsToLoad += 4; // Lunari x2, FocoDia, Cuadro Clima

// Cargar modelos iniciales
loadLunari();
initWeather();

// Cargar foco_dia
import { loader, getFreshUrl } from './core.js'; // getFreshUrl desde utils? mejor importar
import { getFreshUrl } from './utils.js';
loader.load(getFreshUrl('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb'), (gltf) => {
    state.focoDiaMesh = gltf.scene;
    import('./models.js').then(mod => mod.applyMaterialLogic(state.focoDiaMesh, 'foco_dia'));
    state.luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(state.focoDiaMesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    state.luzFocoDia.position.copy(center);
    state.luzFocoDia.position.y -= 0.2;
    state.luzFocoDia.shadow.bias = -0.005;
    state.luzFocoDia.shadow.normalBias = 0.1;
    scene.add(state.luzFocoDia);
    scene.add(state.focoDiaMesh);
    state.focoDiaMesh.visible = false;
    state.luzFocoDia.visible = true;
    import('./lighting.js').then(l => l.actualizarIluminacionFocoDia());
    import('./loading.js').then(l => l.checkLoading());
}, undefined, () => import('./loading.js').then(l => l.checkLoading()));

// Cargar cada categoría equipada
for (let cat in state.inventoryData) {
    if (state.inventoryData[cat].type === 'multiple') continue;
    let eqId = state.inventoryData[cat].equipped;
    if (state.inventoryData[cat].items && state.inventoryData[cat].items[eqId]) {
        let it = state.inventoryData[cat].items[eqId];
        if (it.file) loadItemForSlot(cat, it.file, true);
        if (cat === 'foco' && it.baseFile) loadItemForSlot('base_foco', it.baseFile, true);
        if (cat === 'tele' && it.baseFile) loadItemForSlot('pantalla_tv', it.baseFile, true);
    }
}

// Inicializar modales
initInventoryModal();
initSettingsModal();
initTVControls();

// Aplicar configuración inicial
applyCurrentSettings();
updateLighting();

// Bucle de animación
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const elapsed = now - state.then;
    const fpsInterval = state.gameSettings.fps > 0 ? 1000 / state.gameSettings.fps : 0;
    if (fpsInterval === 0 || elapsed > fpsInterval) {
        if (fpsInterval > 0) state.then = now - (elapsed % fpsInterval);
        const delta = clock.getDelta();
        if (state.lunariMixer) state.lunariMixer.update(delta);
        controls.update();
        renderer.render(scene, camera);
        if (state.gameSettings.mostrarFps) {
            state.frames++;
            if (now - state.lastFpsTime >= 1000) {
                document.querySelector('#fps-counter span').innerText = state.frames;
                state.frames = 0;
                state.lastFpsTime = now;
            }
        }
    }
}
animate();

// Redimensionar ventana
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyCurrentSettings();
});