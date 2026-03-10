import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { defaultInventoryConfig } from './inventory-data.js';

// ==================== HELPER FUNCTIONS ====================
export function getFreshUrl(url) {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}nocache=${Date.now()}`;
}

export function disposeThreeJSObject(node) {
    if (!node) return;
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
        if (Array.isArray(node.material)) {
            node.material.forEach(mat => { if(mat.map) mat.map.dispose(); mat.dispose(); });
        } else {
            if(node.material.map) node.material.map.dispose(); node.material.dispose();
        }
    }
    if (node.children) node.children.forEach(child => disposeThreeJSObject(child));
}

// ==================== ESTADO GLOBAL ====================
export const state = {
    playerCoins: parseInt(localStorage.getItem('room_coins')) || 1000,
    inventoryData: JSON.parse(localStorage.getItem('room_inventory')) || defaultInventoryConfig,
    gameSettings: JSON.parse(localStorage.getItem('ff_settings')) || (() => {
        const ua = navigator.userAgent;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const deviceMemory = navigator.deviceMemory || 4;
        const cpuCores = navigator.hardwareConcurrency || 4;
        let baseTier = 'alta';
        if (isMobileUA || deviceMemory <= 4 || cpuCores <= 4) baseTier = 'media';
        if (isMobileUA && (deviceMemory <= 2 || cpuCores <= 2)) baseTier = 'baja';
        return {
            calidad: baseTier,
            sombras: baseTier === 'baja' ? 0 : (baseTier === 'media' ? 1 : 2),
            fps: baseTier === 'baja' ? 30 : 60,
            volumenTV: 50,
            volumenEfectos: 50,
            mostrarFps: false
        };
    })(),

    // Three.js
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200),
    renderer: null,
    controls: null,
    loader: new GLTFLoader(),
    clock: new THREE.Clock(),
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),

    // Luces
    ambient: new THREE.AmbientLight(0xffffff, 0.3),
    hemiLight: new THREE.HemisphereLight(0xffffff, 0x444444, 0.4),
    mainLight: new THREE.SpotLight(0xffeedd, 6),

    // Meshes
    loadedSlotMeshes: {},
    switchMesh: null,
    focoMesh: null,
    focoDiaMesh: null,
    luzFocoDia: null,
    tvScreenMesh: null,

    // Estado de luz y TV
    lightOn: localStorage.getItem('lightState') !== 'off',
    isTvOn: false,
    tvTransitioning: false,
    tvVideo: document.getElementById('tv-video'),
    tvPlaylist: [],
    currentTvIndex: -1,

    // Lunari
    lunariMixer: null,
    baseAction: null,
    randomAction: null,
    currentAction: null,

    // Clima
    esDeDiaLocal: true,
    lastWeatherCode: 0,

    // Audio
    audioPrenderLuz: new Audio('prender_luz.mp3'),
    audioApagarLuz: new Audio('apagar_luz.mp3'),
    audioAbrirPoster: new Audio('abrir_poster.mp3'),
    audioCerrarPoster: new Audio('guardar_poster.mp3'),
    audioBotonTV: new Audio('sonido_boton.mp3'),

    tvEffectVideoOff: (() => {
        const v = document.createElement('video');
        v.src = 'efecto_tele.mp4'; v.crossOrigin = 'anonymous'; v.playsInline = true;
        document.body.appendChild(v); v.style.display = 'none';
        return v;
    })(),
    tvEffectVideoOn: (() => {
        const v = document.createElement('video');
        v.src = 'efecto_tele - Invertido.mp4'; v.crossOrigin = 'anonymous'; v.playsInline = true;
        document.body.appendChild(v); v.style.display = 'none';
        return v;
    })(),
    tvEffectTextureOff: null,
    tvEffectTextureOn: null,

    // Carga
    totalModelsToLoad: 0,
    modelsLoaded: 0
};

// Limpiar inventario antiguo
if (state.inventoryData.base_foco) delete state.inventoryData.base_foco;

// Sincronizar con configuración por defecto
for (let cat in defaultInventoryConfig) {
    if(!state.inventoryData[cat]) state.inventoryData[cat] = defaultInventoryConfig[cat];
    state.inventoryData[cat].emoji = defaultInventoryConfig[cat].emoji;
    state.inventoryData[cat].label = defaultInventoryConfig[cat].label;
    state.inventoryData[cat].type = defaultInventoryConfig[cat].type || 'single';
    if (state.inventoryData[cat].type === 'multiple') {
        if (!Array.isArray(state.inventoryData[cat].equipped)) state.inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
    } else {
        if (!state.inventoryData[cat].items[state.inventoryData[cat].equipped]) state.inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
    }
    for(let item in defaultInventoryConfig[cat].items) {
        if(!state.inventoryData[cat].items[item]) state.inventoryData[cat].items[item] = defaultInventoryConfig[cat].items[item];
        else {
            state.inventoryData[cat].items[item].file = defaultInventoryConfig[cat].items[item].file;
            state.inventoryData[cat].items[item].name = defaultInventoryConfig[cat].items[item].name;
            if(defaultInventoryConfig[cat].items[item].baseFile) state.inventoryData[cat].items[item].baseFile = defaultInventoryConfig[cat].items[item].baseFile;
            if(defaultInventoryConfig[cat].items[item].preview) state.inventoryData[cat].items[item].preview = defaultInventoryConfig[cat].items[item].preview;
        }
    }
}

// ==================== CONFIGURACIÓN INICIAL DE THREE.JS ====================
state.scene.background = new THREE.Color(0x050508);

let camPosY = 6, camPosZ = 14, targetY = 6;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (window.innerWidth < 768 || isMobileUA) { camPosY = 6; camPosZ = 12; targetY = 5; }
state.camera.position.set(0, camPosY, camPosZ);

state.renderer = new THREE.WebGLRenderer({ antialias: state.gameSettings.calidad !== 'baja', powerPreference: "high-performance" });
state.renderer.setSize(window.innerWidth, window.innerHeight);
state.renderer.outputEncoding = THREE.sRGBEncoding;
state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
state.renderer.toneMappingExposure = 1.0;
document.body.appendChild(state.renderer.domElement);

state.controls = new OrbitControls(state.camera, state.renderer.domElement);
state.controls.enableDamping = true;
state.controls.target.set(0, targetY, 0);
state.controls.maxPolarAngle = Math.PI / 2 - 0.05;
state.controls.minDistance = 2.5;
state.controls.maxDistance = 16;
state.controls.enablePan = false;

// Luces
state.scene.add(state.ambient);
state.hemiLight.position.set(0, 20, 0);
state.scene.add(state.hemiLight);
state.mainLight.position.set(2, 22, 2);
state.mainLight.angle = Math.PI / 3;
state.mainLight.penumbra = 0.8;
state.mainLight.decay = 2;
state.mainLight.distance = 60;
state.mainLight.shadow.camera.near = 0.5;
state.mainLight.shadow.camera.far = 40;
state.mainLight.shadow.bias = -0.002;
state.mainLight.shadow.normalBias = 0.05;
state.mainLight.shadow.radius = 4;
state.scene.add(state.mainLight);
state.scene.add(state.mainLight.target);

// Texturas de efectos TV
state.tvEffectTextureOff = new THREE.VideoTexture(state.tvEffectVideoOff);
state.tvEffectTextureOff.minFilter = THREE.LinearFilter;
state.tvEffectTextureOff.magFilter = THREE.LinearFilter;
state.tvEffectTextureOff.format = THREE.RGBAFormat;
state.tvEffectTextureOn = new THREE.VideoTexture(state.tvEffectVideoOn);
state.tvEffectTextureOn.minFilter = THREE.LinearFilter;
state.tvEffectTextureOn.magFilter = THREE.LinearFilter;
state.tvEffectTextureOn.format = THREE.RGBAFormat;

// ==================== FUNCIONES DE APLICACIÓN DE CONFIGURACIÓN ====================
export function applyCurrentSettings() {
    let pixelRatio = 1;
    if (state.gameSettings.calidad === 'media') pixelRatio = Math.min(window.devicePixelRatio, 1.2);
    else if (state.gameSettings.calidad === 'alta') pixelRatio = Math.min(window.devicePixelRatio, 2);

    state.renderer.setPixelRatio(pixelRatio);
    state.renderer.shadowMap.enabled = state.gameSettings.sombras > 0;
    state.renderer.shadowMap.type = state.gameSettings.sombras >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    state.mainLight.castShadow = state.gameSettings.sombras > 0;
    if (state.gameSettings.sombras > 0) {
        let shadowRes = state.gameSettings.sombras === 2 ? (isMobileUA ? 1024 : 2048) : 512;
        state.mainLight.shadow.mapSize.set(shadowRes, shadowRes);
    }

    for (let cat in state.loadedSlotMeshes) applyMaterialLogic(state.loadedSlotMeshes[cat], cat);
    if(state.focoDiaMesh) actualizarIluminacionFocoDia();

    document.getElementById('fps-counter').style.display = state.gameSettings.mostrarFps ? 'block' : 'none';

    if (state.tvVideo) state.tvVideo.volume = state.gameSettings.volumenTV / 100;
    state.tvEffectVideoOff.volume = state.gameSettings.volumenEfectos / 100;
    state.tvEffectVideoOn.volume = state.gameSettings.volumenEfectos / 100;
    state.audioPrenderLuz.volume = state.gameSettings.volumenEfectos / 100;
    state.audioApagarLuz.volume = state.gameSettings.volumenEfectos / 100;
    state.audioAbrirPoster.volume = state.gameSettings.volumenEfectos / 100;
    state.audioCerrarPoster.volume = state.gameSettings.volumenEfectos / 100;
    state.audioBotonTV.volume = state.gameSettings.volumenEfectos / 100;
}

export function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isFoco = categoryKey === 'foco', isFocoDia = categoryKey === 'foco_dia';
    const allowShadows = state.gameSettings.sombras > 0;
    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            if (isFoco || isFocoDia) {
                node.castShadow = false; node.receiveShadow = false;
                if (node.material) {
                    if (isFoco) { node.material.emissive = new THREE.Color(0xffeedd); node.material.emissiveIntensity = state.lightOn ? 1.5 : 0; }
                    if (isFocoDia) node.material.emissive = new THREE.Color(0xffffff);
                }
            } else {
                node.castShadow = allowShadows; node.receiveShadow = allowShadows;
                if(node.material) {
                    node.material.shadowSide = THREE.FrontSide;
                    if(node.name.toLowerCase().includes('pared') || node.name.toLowerCase().includes('piso') || node.name.toLowerCase().includes('techo')) node.material.shadowSide = THREE.BackSide;
                    node.material.side = THREE.DoubleSide;
                    node.material.needsUpdate = true;
                }
            }
        }
    });
}

// ==================== LUZ NATURAL (FOCO DÍA) ====================
function updateLunariText(isDay, weatherCode) {
    const dialogBox = document.getElementById('dialogue-text');
    if(!dialogBox) return;
    if (!isDay) {
        dialogBox.innerHTML = "¡Qué noche tan tranquila!<br>¿Deberíamos dormir pronto?";
    } else if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(weatherCode)) {
        dialogBox.innerHTML = "El clima está feo afuera.<br>¡Mejor nos quedamos viendo anime!";
    } else {
        dialogBox.innerHTML = "¡Hola!<br>Bienvenido de nuevo a casa.<br>¿Vemos un anime hoy?";
    }
}

export function actualizarIluminacionFocoDia() {
    const hora = new Date().getHours();
    let colorHex, lightInt, emInt, dist;
    if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8; dist = 35; }
    else if (hora >= 9 && hora < 17) { colorHex = 0xffffff; lightInt = 1.5; emInt = 1.5; dist = 50; }
    else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00; lightInt = 0.7; emInt = 0.7; dist = 40; }
    else { colorHex = 0x5566aa; lightInt = 0.25; emInt = 0.25; dist = 25; }

    if (state.luzFocoDia) {
        state.luzFocoDia.color.setHex(colorHex);
        state.luzFocoDia.intensity = lightInt;
        state.luzFocoDia.distance = dist;
        state.luzFocoDia.castShadow = state.gameSettings.sombras > 0;
    }
    if (state.focoDiaMesh) {
        state.focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material) {
                n.material.emissive.setHex(colorHex);
                n.material.emissiveIntensity = emInt;
                n.material.needsUpdate = true;
            }
        });
    }
    updateLunariText(state.esDeDiaLocal, state.lastWeatherCode);
}

// ==================== CONTADOR DE CARGA ====================
function checkLoading() {
    state.modelsLoaded++;
    const loadingEl = document.getElementById('loading');
    const loadCount = document.getElementById('loading-count');
    const loadBar = document.getElementById('loading-bar');
    if(loadCount && loadBar) {
        loadCount.innerText = `${state.modelsLoaded}/${state.totalModelsToLoad}`;
        const percent = Math.min((state.modelsLoaded / state.totalModelsToLoad) * 100, 100);
        loadBar.style.width = `${percent}%`;
        if (state.modelsLoaded >= state.totalModelsToLoad) {
            setTimeout(() => { if(loadingEl) loadingEl.style.opacity = '0'; setTimeout(()=>loadingEl.style.display='none', 500); }, 500);
        }
    }
}

// ==================== CARGA DE MODELOS ====================
export function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
    if (!itemFile) return;
    if (state.loadedSlotMeshes[categoryKey]) {
        state.scene.remove(state.loadedSlotMeshes[categoryKey]);
        disposeThreeJSObject(state.loadedSlotMeshes[categoryKey]);
    }
    state.loader.load(getFreshUrl(itemFile), (gltf) => {
        const model = gltf.scene;
        applyMaterialLogic(model, categoryKey);
        if (categoryKey === 'pantalla_tv') {
            model.traverse((node) => {
                if (node.isMesh && node.material) {
                    state.tvScreenMesh = node;
                    let mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(mat => {
                        if (!state.isTvOn) {
                            mat.map = null; mat.emissiveMap = null;
                            mat.color = new THREE.Color(0x000000);
                            mat.emissive = new THREE.Color(0x000000);
                            mat.emissiveIntensity = 0;
                        } else {
                            mat.map = new THREE.VideoTexture(state.tvVideo);
                            mat.emissiveMap = mat.map;
                            mat.color = new THREE.Color(0xffffff);
                            mat.emissive = new THREE.Color(0xffffff);
                            mat.emissiveIntensity = 1.0;
                        }
                        mat.needsUpdate = true;
                    });
                }
            });
            if (!state.isTvOn) state.tvVideo.pause();
        }
        if (categoryKey === 'foco') {
            state.focoMesh = model;
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            state.mainLight.position.copy(center);
            state.mainLight.position.y -= 0.2;
        }
        if (categoryKey === 'interruptor') state.switchMesh = model;
        state.scene.add(model);
        state.loadedSlotMeshes[categoryKey] = model;
        if(isInitialLoad) checkLoading();
    }, undefined, () => { if(isInitialLoad) checkLoading(); });
}

// Calcular total de modelos a cargar
for (let cat in state.inventoryData) {
    if (state.inventoryData[cat].type === 'multiple') continue;
    let eqId = state.inventoryData[cat].equipped;
    if (state.inventoryData[cat].items && state.inventoryData[cat].items[eqId]) {
        let it = state.inventoryData[cat].items[eqId];
        if (it.file) state.totalModelsToLoad++;
        if (cat === 'foco' && it.baseFile) state.totalModelsToLoad++;
        if (cat === 'tele' && it.baseFile) state.totalModelsToLoad++;
    }
}
state.totalModelsToLoad += 4; // Lunari x2, FocoDia, Cuadro Clima

// Cargar Lunari
state.loader.load(getFreshUrl('lunari_durmiendo1.glb'), (gltf) => {
    const lunariModel = gltf.scene;
    applyMaterialLogic(lunariModel, 'lunari');
    state.scene.add(lunariModel);
    if (gltf.animations && gltf.animations.length > 0) {
        state.lunariMixer = new THREE.AnimationMixer(lunariModel);
        state.baseAction = state.lunariMixer.clipAction(gltf.animations[0]);
        state.baseAction.play();
        state.currentAction = state.baseAction;
    }
    checkLoading();
}, undefined, () => checkLoading());

state.loader.load(getFreshUrl('Lunari_Duerme_2.glb'), (gltf) => {
    if (gltf.animations && gltf.animations.length > 0 && state.lunariMixer) {
        state.randomAction = state.lunariMixer.clipAction(gltf.animations[0]);
        state.randomAction.loop = THREE.LoopOnce;
        state.randomAction.clampWhenFinished = true;
    }
    checkLoading();
}, undefined, () => checkLoading());

// Cargar foco_dia
state.loader.load(getFreshUrl('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb'), (gltf) => {
    state.focoDiaMesh = gltf.scene;
    applyMaterialLogic(state.focoDiaMesh, 'foco_dia');
    state.luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(state.focoDiaMesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    state.luzFocoDia.position.copy(center);
    state.luzFocoDia.position.y -= 0.2;
    state.luzFocoDia.shadow.bias = -0.005;
    state.luzFocoDia.shadow.normalBias = 0.1;
    state.scene.add(state.luzFocoDia);
    state.scene.add(state.focoDiaMesh);
    state.focoDiaMesh.visible = false;
    state.luzFocoDia.visible = true;
    actualizarIluminacionFocoDia();
    checkLoading();
}, undefined, () => checkLoading());

// Cargar elementos equipados inicialmente
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

// Mostrar monedas iniciales
document.getElementById('coin-amount').innerText = state.playerCoins;

// ==================== FUNCIÓN DE GUARDADO ====================
export function saveGame() {
    localStorage.setItem('room_coins', state.playerCoins);
    localStorage.setItem('room_inventory', JSON.stringify(state.inventoryData));
    document.getElementById('coin-amount').innerText = state.playerCoins;
}

// ==================== BUCLE DE ANIMACIÓN ====================
let then = performance.now();
let frames = 0, lastFpsTime = then;

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const elapsed = now - then;
    const fpsInterval = state.gameSettings.fps > 0 ? 1000 / state.gameSettings.fps : 0;
    if (fpsInterval === 0 || elapsed > fpsInterval) {
        if (fpsInterval > 0) then = now - (elapsed % fpsInterval);
        const delta = state.clock.getDelta();
        if (state.lunariMixer) state.lunariMixer.update(delta);
        state.controls.update();
        state.renderer.render(state.scene, state.camera);
        if (state.gameSettings.mostrarFps) {
            frames++;
            if (now - lastFpsTime >= 1000) {
                document.querySelector('#fps-counter span').innerText = frames;
                frames = 0;
                lastFpsTime = now;
            }
        }
    }
}
animate();

// ==================== RESIZE ====================
window.addEventListener('resize', () => {
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    applyCurrentSettings();
});