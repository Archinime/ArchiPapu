import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { State, isMobileUA, checkDailyReward, getFreshUrl, disposeThreeJSObject } from './room_state.js';
import { SceneSetup } from './room_scene.js';
import { TVManager } from './room_tv.js';
import { PCManager } from './room_pc.js';
import { LunariSystem } from './room_lunari.js';
import { WeatherSystem } from './room_clima.js';
import { UIManager } from './room_ui.js';

// Inicialización de Entorno y Datos
checkDailyReward();
SceneSetup.init(State.gameSettings, isMobileUA);
const { scene, clock, camera, renderer, controls, ambient, hemiLight, mainLight } = SceneSetup;

// Variables Globales de Escena
const loadedSlotMeshes = {};
let switchMesh = null, focoMesh = null, focoDiaMesh = null, luzFocoDia = null;

const audioPrenderLuz = new Audio('prender_luz.mp3');
const audioApagarLuz = new Audio('apagar_luz.mp3');
const audioAbrirPoster = new Audio('abrir_poster.mp3');
const audioCerrarPoster = new Audio('guardar_poster.mp3');

// Inicializar Módulos
TVManager.init();
PCManager.init();

function applyCurrentSettings() {
    let pixelRatio = 1;
    if (State.gameSettings.calidad === 'media') pixelRatio = Math.min(window.devicePixelRatio, 1.2);
    else if (State.gameSettings.calidad === 'alta') pixelRatio = Math.min(window.devicePixelRatio, 2); 

    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = State.gameSettings.sombras > 0;
    renderer.shadowMap.type = State.gameSettings.sombras >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    mainLight.castShadow = State.gameSettings.sombras > 0;

    if (State.gameSettings.sombras > 0) {
        let shadowRes = State.gameSettings.sombras === 2 ?
            (isMobileUA ? 2048 : 4096) : (isMobileUA ? 512 : 1024);
        if (mainLight.shadow.mapSize.width !== shadowRes) {
            mainLight.shadow.mapSize.set(shadowRes, shadowRes);
            if (mainLight.shadow.map) { mainLight.shadow.map.dispose(); mainLight.shadow.map = null; }
        }
    }

    for (let cat in loadedSlotMeshes) applyMaterialLogic(loadedSlotMeshes[cat], cat);
    if(focoDiaMesh) WeatherSystem.actualizarIluminacion(focoDiaMesh, luzFocoDia, isMobileUA, LunariSystem);

    document.getElementById('fps-counter').style.display = State.gameSettings.mostrarFps ? 'block' : 'none';
    
    TVManager.setVolumes(State.gameSettings.volumenTV, State.gameSettings.volumenEfectos);
    PCManager.setVolume(State.gameSettings.volumenEfectos);

    let volEf = State.gameSettings.volumenEfectos / 100;
    audioPrenderLuz.volume = volEf; audioApagarLuz.volume = volEf;
    audioAbrirPoster.volume = volEf; audioCerrarPoster.volume = volEf;
}

// Iniciar Interfaz de Usuario
UIManager.init(applyCurrentSettings, loadItemForSlot);

function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isFoco = categoryKey === 'foco', isFocoDia = categoryKey === 'foco_dia';
    const allowShadows = State.gameSettings.sombras > 0;
    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            if (isFoco || isFocoDia) {
                node.castShadow = false; node.receiveShadow = false;
                if (node.material) {
                    if (isFoco) { node.material.emissive = new THREE.Color(0xffeedd); node.material.emissiveIntensity = State.lightOn ? 1.5 : 0; }
                    if (isFocoDia) node.material.emissive = new THREE.Color(0xffffff);
                }
            } else {
                node.castShadow = allowShadows; node.receiveShadow = allowShadows;
                if(node.material) {
                    node.material.shadowSide = THREE.FrontSide;
                    if(node.name.toLowerCase().includes('pared') || node.name.toLowerCase().includes('piso') || node.name.toLowerCase().includes('techo')) node.material.shadowSide = THREE.BackSide;
                    node.material.side = THREE.DoubleSide; node.material.needsUpdate = true;
                }
            }
        }
    });
}

// Sistema de Carga
let totalModelsToLoad = 0, modelsLoaded = 0;
for (let cat in State.inventoryData) {
    if (State.inventoryData[cat].type === 'multiple') continue; let eqId = State.inventoryData[cat].equipped;
    if (State.inventoryData[cat].items && State.inventoryData[cat].items[eqId]) {
        let it = State.inventoryData[cat].items[eqId];
        if (it.file) totalModelsToLoad++;
        if (cat === 'foco' && it.baseFile) totalModelsToLoad++; 
        if (cat === 'tele' && it.baseFile) totalModelsToLoad++;
        if (cat === 'pc' && it.baseFile) {
            totalModelsToLoad++;
            totalModelsToLoad++; // Para pantalla_pc2.glb
        }
    }
}
totalModelsToLoad += 5;

function checkLoading() {
    modelsLoaded++;
    const loadingEl = document.getElementById('loading'), loadCount = document.getElementById('loading-count'), loadBar = document.getElementById('loading-bar');
    if(loadCount && loadBar) {
        loadCount.innerText = `${modelsLoaded}/${totalModelsToLoad}`;
        const percent = Math.min((modelsLoaded / totalModelsToLoad) * 100, 100);
        loadBar.style.width = `${percent}%`;
        if (modelsLoaded >= totalModelsToLoad) { setTimeout(() => { if(loadingEl) loadingEl.style.opacity = '0'; setTimeout(()=>loadingEl.style.display='none', 500); }, 500);
        }
    }
}
if(totalModelsToLoad === 0 && document.getElementById('loading')) document.getElementById('loading').style.display = 'none';

const loader = new GLTFLoader();

loader.load(getFreshUrl('lunari_durmiendo1.glb'), (gltf) => {
    const model = gltf.scene; model.visible = false; applyMaterialLogic(model, 'lunari'); scene.add(model); LunariSystem.models.dormir = model;
    if (gltf.animations && gltf.animations.length > 0) { LunariSystem.mixers.dormir = new THREE.AnimationMixer(model); LunariSystem.actions.dormir_base = LunariSystem.mixers.dormir.clipAction(gltf.animations[0]); }
    LunariSystem.currentState = null; LunariSystem.evaluateState(WeatherSystem.esDeDiaLocal, WeatherSystem.lastWeatherCode); checkLoading();
}, undefined, () => checkLoading());

loader.load(getFreshUrl('Lunari_Duerme_2.glb'), (gltf) => {
    if (gltf.animations && gltf.animations.length > 0 && LunariSystem.mixers.dormir) { LunariSystem.actions.dormir_random = LunariSystem.mixers.dormir.clipAction(gltf.animations[0]); LunariSystem.actions.dormir_random.loop = THREE.LoopOnce; LunariSystem.actions.dormir_random.clampWhenFinished = true; }
    checkLoading();
}, undefined, () => checkLoading());

loader.load(getFreshUrl('lunari_esta_despierta.glb'), (gltf) => {
    const model = gltf.scene; model.visible = false; applyMaterialLogic(model, 'lunari'); scene.add(model); LunariSystem.models.despertar = model;
    if (gltf.animations && gltf.animations.length > 0) { LunariSystem.mixers.despertar = new THREE.AnimationMixer(model); LunariSystem.actions.despertar_base = LunariSystem.mixers.despertar.clipAction(gltf.animations[0]); }
    LunariSystem.currentState = null; LunariSystem.evaluateState(WeatherSystem.esDeDiaLocal, WeatherSystem.lastWeatherCode); checkLoading();
}, undefined, () => checkLoading());

loader.load(getFreshUrl('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb'), (gltf) => {
    focoDiaMesh = gltf.scene; applyMaterialLogic(focoDiaMesh, 'foco_dia'); luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(focoDiaMesh); const center = new THREE.Vector3(); box.getCenter(center);
    luzFocoDia.position.copy(center); luzFocoDia.position.y -= 0.2; luzFocoDia.shadow.bias = -0.005; luzFocoDia.shadow.normalBias = 0.1;
    scene.add(luzFocoDia); scene.add(focoDiaMesh); focoDiaMesh.visible = false; luzFocoDia.visible = true; 
    WeatherSystem.actualizarIluminacion(focoDiaMesh, luzFocoDia, isMobileUA, LunariSystem); checkLoading();
}, undefined, () => checkLoading());

// Bucle de Evaluación (Lunari + Clima Cada minuto)
setInterval(() => {
    WeatherSystem.actualizarIluminacion(focoDiaMesh, luzFocoDia, isMobileUA, LunariSystem);
    LunariSystem.evaluateState(WeatherSystem.esDeDiaLocal, WeatherSystem.lastWeatherCode);

    if (LunariSystem.currentState === 'dormir') {
        const { dormir_base, dormir_random } = LunariSystem.actions;
        if (dormir_base && dormir_random && LunariSystem.activeAction !== dormir_random) {
            dormir_base.fadeOut(0.5); dormir_random.reset().fadeIn(0.5).play(); LunariSystem.activeAction = dormir_random;
            const onFinished = (event) => {
                 if (event.action === dormir_random) { 
                    dormir_random.fadeOut(0.5); dormir_base.reset().fadeIn(0.5).play(); 
                    LunariSystem.activeAction = dormir_base; LunariSystem.mixers.dormir.removeEventListener('finished', onFinished); 
                }
            };
            LunariSystem.mixers.dormir.addEventListener('finished', onFinished);
        }
    }
}, 60000);

function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
    if (!itemFile) return;
    if (loadedSlotMeshes[categoryKey]) { scene.remove(loadedSlotMeshes[categoryKey]); disposeThreeJSObject(loadedSlotMeshes[categoryKey]); }
    
    loader.load(getFreshUrl(itemFile), (gltf) => {
        const model = gltf.scene; applyMaterialLogic(model, categoryKey);
        if (categoryKey === 'pantalla_tv') {
            model.traverse((node) => {
                if (node.isMesh && node.material) {
                    TVManager.tvScreenMesh = node; 
                    let mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(mat => { 
                        if (!TVManager.isTvOn) { mat.map = null; mat.emissiveMap = null; mat.color = new THREE.Color(0x000000); mat.emissive = new THREE.Color(0x000000); mat.emissiveIntensity = 0; } 
                        else { mat.map = TVManager.tvTexture; mat.emissiveMap = TVManager.tvTexture; mat.color = new THREE.Color(0xffffff); mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 1.0; }
                        mat.needsUpdate = true;
                    });
                }
            });
            if (!TVManager.isTvOn) TVManager.tvVideo.pause();
        }
        if (categoryKey === 'pantalla_pc') {
            model.traverse((node) => {
                if (node.isMesh && node.material) {
                    PCManager.pcScreenMesh = node; 
                    let mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(mat => { 
                        if (!PCManager.isPcOn) { 
                            mat.color = new THREE.Color(0x000000); 
                            mat.emissive = new THREE.Color(0x000000); 
                            mat.emissiveIntensity = 0; 
                        } else { 
                            mat.color = new THREE.Color(0x2196f3); 
                            mat.emissive = new THREE.Color(0x2196f3); 
                            mat.emissiveIntensity = 1.0; 
                        }
                        mat.needsUpdate = true;
                    });
                }
            });
        }
        if (categoryKey === 'foco') { focoMesh = model;
            const box = new THREE.Box3().setFromObject(model); const center = new THREE.Vector3(); box.getCenter(center); mainLight.position.copy(center); mainLight.position.y -= 0.2;
        }
        if (categoryKey === 'interruptor') switchMesh = model;
        
        scene.add(model); loadedSlotMeshes[categoryKey] = model;
        if(isInitialLoad) checkLoading();
    }, undefined, () => { if(isInitialLoad) checkLoading(); });
}

for (let cat in State.inventoryData) {
    if (State.inventoryData[cat].type === 'multiple') continue; let eqId = State.inventoryData[cat].equipped;
    if (State.inventoryData[cat].items && State.inventoryData[cat].items[eqId]) {
        let it = State.inventoryData[cat].items[eqId];
        if (it.file) loadItemForSlot(cat, it.file, true);
        if (cat === 'foco' && it.baseFile) loadItemForSlot('base_foco', it.baseFile, true);
        if (cat === 'tele' && it.baseFile) loadItemForSlot('pantalla_tv', it.baseFile, true);
        if (cat === 'pc') {
            if (it.baseFile) loadItemForSlot('pantalla_pc', it.baseFile, true);
            loadItemForSlot('pantalla_pc2', 'pantalla_pc2.glb', true);
        }
    }
}

WeatherSystem.setupWeatherVideo(loader, scene, applyMaterialLogic, loadedSlotMeshes, checkLoading);

function updateLighting() {
    if (State.lightOn) {
        mainLight.visible = true;
        ambient.intensity = State.gameSettings.calidad === 'baja' ? 0.8 : 0.3; hemiLight.intensity = State.gameSettings.calidad === 'baja' ? 0.8 : 0.4;
        document.getElementById('light-status').innerText = '💡 Luz encendida';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 1.5; });
    } else {
        mainLight.visible = false; ambient.intensity = 0.02; hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 0; });
    }
}

const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();

function toggleLight() {
    State.lightOn = !State.lightOn;
    localStorage.setItem('lightState', State.lightOn ? 'on' : 'off'); updateLighting();
    if (State.lightOn) { audioPrenderLuz.currentTime = 0; audioPrenderLuz.play().catch(e=>{}); } else { audioApagarLuz.currentTime = 0;
    audioApagarLuz.play().catch(e=>{}); }
}

const posterViewModal = document.getElementById('poster-view-modal'), posterEnlargedImage = document.getElementById('poster-enlarged-image');
document.getElementById('close-poster-view').onclick = () => { posterViewModal.classList.remove('visible'); audioCerrarPoster.currentTime = 0; audioCerrarPoster.play().catch(e=>{}); };
posterViewModal.onclick = (e) => { if (e.target === posterViewModal) { posterViewModal.classList.remove('visible'); audioCerrarPoster.currentTime = 0; audioCerrarPoster.play().catch(e=>{}); } };

function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(mouse, camera);

    if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) { toggleLight(); return; }
    
    // --- TV ---
    const pantallaMesh = loadedSlotMeshes['pantalla_tv'];
    if (pantallaMesh && raycaster.intersectObject(pantallaMesh, true).length > 0) {
        const tvControls = document.getElementById('tv-controls'), currentTime = Date.now();
        
        // Exclusividad: Si abres TV, cierra PC
        document.getElementById('pc-controls').style.display = 'none';

        if (currentTime - TVManager.lastTvClickTime < 300) { 
            if (TVManager.isTvOn && !TVManager.tvTransitioning) { 
                if (TVManager.tvVideo.paused) TVManager.tvVideo.play().catch(e=>{}); else TVManager.tvVideo.pause();
            } 
        } else { 
            if (tvControls.style.display === 'none' || tvControls.style.display === '') tvControls.style.display = 'flex';
            else tvControls.style.display = 'none'; 
        }
        TVManager.lastTvClickTime = currentTime; return;
    }

    // --- PC PRINCIPAL ---
    const pcScreenMesh = loadedSlotMeshes['pantalla_pc'];
    if (pcScreenMesh && raycaster.intersectObject(pcScreenMesh, true).length > 0) {
        const pcControls = document.getElementById('pc-controls');
        const currentTime = Date.now();
        
        // Exclusividad: Si abres PC, cierra TV
        document.getElementById('tv-controls').style.display = 'none';

        if (currentTime - PCManager.lastPcClickTime < 300) { 
            if (PCManager.isPcOn) {
                document.getElementById('pc-iframe').src = 'https://archinime.github.io/Room/';
                document.getElementById('pc-modal').classList.add('visible');
                pcControls.style.display = 'none';
            } 
        } else { 
            if (pcControls.style.display === 'none' || pcControls.style.display === '') pcControls.style.display = 'flex';
            else pcControls.style.display = 'none'; 
        }
        PCManager.lastPcClickTime = currentTime; 
        return;
    }

    // --- SEGUNDA PANTALLA (NUEVA) ---
    const pc2ScreenMesh = loadedSlotMeshes['pantalla_pc2'];
    if (pc2ScreenMesh && raycaster.intersectObject(pc2ScreenMesh, true).length > 0) {
        window.open('https://archinime.github.io/-Archinime-', '_blank');
        return;
    }

    // --- POSTERS ---
    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const pMesh = loadedSlotMeshes[cat];
        if (pMesh && raycaster.intersectObject(pMesh, true).length > 0) {
            const itemData = State.inventoryData[cat].items[State.inventoryData[cat].equipped];
            if (itemData && itemData.preview) { posterEnlargedImage.src = itemData.preview; posterViewModal.classList.add('visible'); audioAbrirPoster.currentTime = 0; audioAbrirPoster.play().catch(e=>{}); }
            break;
        }
    }
}

let pointerDownPos = { x: 0, y: 0 }; let isDragging = false;
renderer.domElement.addEventListener('pointerdown', (e) => { pointerDownPos.x = e.clientX; pointerDownPos.y = e.clientY; isDragging = false; });
renderer.domElement.addEventListener('pointermove', (e) => { const dx = e.clientX - pointerDownPos.x; const dy = e.clientY - pointerDownPos.y; if (Math.sqrt(dx * dx + dy * dy) > 5) isDragging = true; });
renderer.domElement.addEventListener('pointerup', (e) => { if (!isDragging && !document.getElementById('inventory-modal').classList.contains('visible') && !document.getElementById('ff-settings-modal').classList.contains('active') && !document.getElementById('pc-modal').classList.contains('visible')) handleInteraction(e); isDragging = false; });

let then = performance.now(), frames = 0, lastFpsTime = then;
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now(); const elapsed = now - then;
    const fpsInterval = State.gameSettings.fps > 0 ? 1000 / State.gameSettings.fps : 0;
    if (fpsInterval === 0 || elapsed > fpsInterval) {
        if (fpsInterval > 0) then = now - (elapsed % fpsInterval);
        const delta = clock.getDelta(); LunariSystem.update(delta); 
        controls.update(); renderer.render(scene, camera);
        
        if (State.gameSettings.mostrarFps) { 
            frames++;
            if (now - lastFpsTime >= 1000) { document.querySelector('#fps-counter span').innerText = frames; frames = 0; lastFpsTime = now; } 
        }
    }
}

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); applyCurrentSettings(); });
applyCurrentSettings(); updateLighting(); animate();