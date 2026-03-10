import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { defaultInventoryConfig } from './inventory-data.js';

// ---------- Utilidades ----------
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

// ---------- Estado Global ----------
export let playerCoins = parseInt(localStorage.getItem('room_coins')) || 1000;
export let inventoryData = JSON.parse(localStorage.getItem('room_inventory')) || defaultInventoryConfig;
if (inventoryData.base_foco) delete inventoryData.base_foco;

// Fusionar con configuración por defecto
for (let cat in defaultInventoryConfig) {
    if(!inventoryData[cat]) inventoryData[cat] = defaultInventoryConfig[cat];
    inventoryData[cat].emoji = defaultInventoryConfig[cat].emoji;
    inventoryData[cat].label = defaultInventoryConfig[cat].label;
    inventoryData[cat].type = defaultInventoryConfig[cat].type || 'single';
    if (inventoryData[cat].type === 'multiple') {
        if (!Array.isArray(inventoryData[cat].equipped)) inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
    } else {
        if (!inventoryData[cat].items[inventoryData[cat].equipped]) inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
    }
    for(let item in defaultInventoryConfig[cat].items) {
        if(!inventoryData[cat].items[item]) inventoryData[cat].items[item] = defaultInventoryConfig[cat].items[item];
        else {
            inventoryData[cat].items[item].file = defaultInventoryConfig[cat].items[item].file;
            inventoryData[cat].items[item].name = defaultInventoryConfig[cat].items[item].name;
            if(defaultInventoryConfig[cat].items[item].baseFile) inventoryData[cat].items[item].baseFile = defaultInventoryConfig[cat].items[item].baseFile;
            if(defaultInventoryConfig[cat].items[item].preview) inventoryData[cat].items[item].preview = defaultInventoryConfig[cat].items[item].preview;
        }
    }
}

export function saveGame() {
    localStorage.setItem('room_coins', playerCoins);
    localStorage.setItem('room_inventory', JSON.stringify(inventoryData));
    document.getElementById('coin-amount').innerText = playerCoins;
}

// Configuración de calidad
const ua = navigator.userAgent;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
const deviceMemory = navigator.deviceMemory || 4; 
const cpuCores = navigator.hardwareConcurrency || 4;
let baseTier = 'alta';
if (isMobileUA || deviceMemory <= 4 || cpuCores <= 4) baseTier = 'media';
if (isMobileUA && (deviceMemory <= 2 || cpuCores <= 2)) baseTier = 'baja';

export let gameSettings = JSON.parse(localStorage.getItem('ff_settings')) || {
    calidad: baseTier, 
    sombras: baseTier === 'baja' ? 0 : (baseTier === 'media' ? 1 : 2),
    fps: baseTier === 'baja' ? 30 : 60,
    volumenTV: 50,
    volumenEfectos: 50,
    mostrarFps: false
};
if(gameSettings.volumen) { 
    gameSettings.volumenTV = gameSettings.volumen; 
    gameSettings.volumenEfectos = gameSettings.volumen; 
    delete gameSettings.volumen; 
}

// ---------- Referencias a mallas y objetos 3D ----------
export const loadedSlotMeshes = {};
export let switchMesh = null;
export let focoMesh = null;
export let focoDiaMesh = null;
export let luzFocoDia = null;
export let esDeDiaLocal = true;
export let isTvOn = false;
export let tvTransitioning = false;
export let lastTvClickTime = 0;
export let tvScreenMesh = null;

// Audio
export const audioPrenderLuz = new Audio('prender_luz.mp3');
export const audioApagarLuz = new Audio('apagar_luz.mp3');
export const audioAbrirPoster = new Audio('abrir_poster.mp3');
export const audioCerrarPoster = new Audio('guardar_poster.mp3');
export const audioBotonTV = new Audio('sonido_boton.mp3');

// Videos y texturas para TV
export const tvEffectVideoOff = document.createElement('video');
tvEffectVideoOff.src = 'efecto_tele.mp4'; 
tvEffectVideoOff.crossOrigin = 'anonymous'; 
tvEffectVideoOff.playsInline = true;
document.body.appendChild(tvEffectVideoOff); 
tvEffectVideoOff.style.display = 'none';

export const tvEffectVideoOn = document.createElement('video'); 
tvEffectVideoOn.src = 'efecto_tele - Invertido.mp4'; 
tvEffectVideoOn.crossOrigin = 'anonymous'; 
tvEffectVideoOn.playsInline = true;
document.body.appendChild(tvEffectVideoOn); 
tvEffectVideoOn.style.display = 'none';

export const tvEffectTextureOff = new THREE.VideoTexture(tvEffectVideoOff); 
tvEffectTextureOff.minFilter = THREE.LinearFilter; 
tvEffectTextureOff.magFilter = THREE.LinearFilter; 
tvEffectTextureOff.format = THREE.RGBAFormat;

export const tvEffectTextureOn = new THREE.VideoTexture(tvEffectVideoOn); 
tvEffectTextureOn.minFilter = THREE.LinearFilter; 
tvEffectTextureOn.magFilter = THREE.LinearFilter; 
tvEffectTextureOn.format = THREE.RGBAFormat;

// ---------- Escena, cámara, renderer, controles, luces ----------
export const scene = new THREE.Scene(); 
scene.background = new THREE.Color(0x050508);
export const clock = new THREE.Clock();

export const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200);
let camPosY = 6, camPosZ = 14, targetY = 6;
if (window.innerWidth < 768 || isMobileUA) { camPosY = 6; camPosZ = 12; targetY = 5; }
camera.position.set(0, camPosY, camPosZ);

export const renderer = new THREE.WebGLRenderer({ antialias: gameSettings.calidad !== 'baja', powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding; 
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.target.set(0, targetY, 0); 
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 2.5; 
controls.maxDistance = 16; 
controls.enablePan = false;

export const ambient = new THREE.AmbientLight(0xffffff, 0.3); 
scene.add(ambient);
export const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); 
hemiLight.position.set(0, 20, 0); 
scene.add(hemiLight);

export const mainLight = new THREE.SpotLight(0xffeedd, 6); 
mainLight.position.set(2, 22, 2); 
mainLight.angle = Math.PI / 3;
mainLight.penumbra = 0.8; 
mainLight.decay = 2; 
mainLight.distance = 60;
mainLight.shadow.camera.near = 0.5; 
mainLight.shadow.camera.far = 40; 
mainLight.shadow.bias = -0.002;
mainLight.shadow.normalBias = 0.05; 
mainLight.shadow.radius = 4; 
scene.add(mainLight); 
scene.add(mainLight.target);

export let lightOn = localStorage.getItem('lightState') !== 'off';

// ---------- Funciones de aplicación de configuración y materiales ----------
export function applyCurrentSettings() {
    let pixelRatio = 1;
    if (gameSettings.calidad === 'media') pixelRatio = Math.min(window.devicePixelRatio, 1.2);
    else if (gameSettings.calidad === 'alta') pixelRatio = Math.min(window.devicePixelRatio, 2); 

    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = gameSettings.sombras > 0;
    renderer.shadowMap.type = gameSettings.sombras >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    mainLight.castShadow = gameSettings.sombras > 0;
    if (gameSettings.sombras > 0) {
        let shadowRes = gameSettings.sombras === 2 ? (isMobileUA ? 1024 : 2048) : 512;
        mainLight.shadow.mapSize.set(shadowRes, shadowRes);
    }

    for (let cat in loadedSlotMeshes) applyMaterialLogic(loadedSlotMeshes[cat], cat);
    if(focoDiaMesh) actualizarIluminacionFocoDia();

    document.getElementById('fps-counter').style.display = gameSettings.mostrarFps ? 'block' : 'none';
    
    const tvVideo = document.getElementById('tv-video');
    if (tvVideo) tvVideo.volume = gameSettings.volumenTV / 100;
    tvEffectVideoOff.volume = gameSettings.volumenEfectos / 100;
    tvEffectVideoOn.volume = gameSettings.volumenEfectos / 100;
    
    let volEf = gameSettings.volumenEfectos / 100;
    audioPrenderLuz.volume = volEf; 
    audioApagarLuz.volume = volEf;
    audioAbrirPoster.volume = volEf; 
    audioCerrarPoster.volume = volEf;
    audioBotonTV.volume = volEf;
}

export function updateLunariText(isDay, weatherCode) {
    const dialogBox = document.getElementById('dialogue-text');
    if(!dialogBox) return;
    if (!isDay) { dialogBox.innerHTML = "¡Qué noche tan tranquila!<br>¿Deberíamos dormir pronto?"; }
    else if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(weatherCode)) {
        dialogBox.innerHTML = "El clima está feo afuera.<br>¡Mejor nos quedamos viendo anime!";
    } else {
        dialogBox.innerHTML = "¡Hola!<br>Bienvenido de nuevo a casa.<br>¿Vemos un anime hoy?";
    }
}

let lastWeatherCode = 0;
export function actualizarIluminacionFocoDia() {
    const hora = new Date().getHours(); 
    let colorHex, lightInt, emInt, dist;
    if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8; dist = 35; }
    else if (hora >= 9 && hora < 17) { colorHex = 0xffffff; lightInt = 1.5; emInt = 1.5; dist = 50; }
    else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00; lightInt = 0.7; emInt = 0.7; dist = 40; }
    else { colorHex = 0x5566aa; lightInt = 0.25; emInt = 0.25; dist = 25; }

    if (luzFocoDia) { 
        luzFocoDia.color.setHex(colorHex); 
        luzFocoDia.intensity = lightInt; 
        luzFocoDia.distance = dist; 
        luzFocoDia.castShadow = gameSettings.sombras > 0; 
    }
    if (focoDiaMesh) {
        focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material) { 
                n.material.emissive.setHex(colorHex); 
                n.material.emissiveIntensity = emInt; 
                n.material.needsUpdate = true; 
            }
        });
    }
    updateLunariText(esDeDiaLocal, lastWeatherCode);
}

export function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isFoco = categoryKey === 'foco', isFocoDia = categoryKey === 'foco_dia';
    const allowShadows = gameSettings.sombras > 0;
    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            if (isFoco || isFocoDia) {
                node.castShadow = false; 
                node.receiveShadow = false;
                if (node.material) {
                    if (isFoco) { 
                        node.material.emissive = new THREE.Color(0xffeedd); 
                        node.material.emissiveIntensity = lightOn ? 1.5 : 0; 
                    }
                    if (isFocoDia) node.material.emissive = new THREE.Color(0xffffff);
                }
            } else {
                node.castShadow = allowShadows; 
                node.receiveShadow = allowShadows;
                if(node.material) {
                    node.material.shadowSide = THREE.FrontSide;
                    if(node.name.toLowerCase().includes('pared') || node.name.toLowerCase().includes('piso') || node.name.toLowerCase().includes('techo')) 
                        node.material.shadowSide = THREE.BackSide;
                    node.material.side = THREE.DoubleSide; 
                    node.material.needsUpdate = true;
                }
            }
        }
    });
}

// ---------- Lógica de TV ----------
export const tvVideo = document.getElementById('tv-video');
export const tvTexture = new THREE.VideoTexture(tvVideo); 
tvTexture.minFilter = THREE.LinearFilter; 
tvTexture.magFilter = THREE.LinearFilter; 
tvTexture.format = THREE.RGBAFormat; 
tvTexture.encoding = THREE.sRGBEncoding;

export let tvPlaylist = []; 
export let currentTvIndex = -1;

export function updatePlaylist() {
    tvPlaylist = inventoryData.videos.equipped.map(id => inventoryData.videos.items[id].file);
    if(tvPlaylist.length === 0) tvVideo.pause();
}

export function playNextTv(random = false) {
    updatePlaylist(); 
    if(tvPlaylist.length === 0) return;
    currentTvIndex = random ? Math.floor(Math.random() * tvPlaylist.length) : (currentTvIndex + 1) % tvPlaylist.length;
    tvVideo.src = tvPlaylist[currentTvIndex]; 
    tvVideo.volume = gameSettings.volumenTV / 100;
    if (isTvOn && !tvTransitioning) tvVideo.play().catch(e => console.warn('User interaction needed', e));
}

export function playButtonSound() { 
    audioBotonTV.currentTime = 0; 
    audioBotonTV.play().catch(e=>{}); 
}

// ---------- Control de luz ----------
export function updateLighting() {
    if (lightOn) {
        mainLight.visible = true; 
        ambient.intensity = gameSettings.calidad === 'baja' ? 0.8 : 0.3; 
        hemiLight.intensity = gameSettings.calidad === 'baja' ? 0.8 : 0.4;
        document.getElementById('light-status').innerText = '💡 Luz encendida';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 1.5; });
    } else {
        mainLight.visible = false; 
        ambient.intensity = 0.02; 
        hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 0; });
    }
}

// ---------- Raycaster para interacciones ----------
export const raycaster = new THREE.Raycaster(); 
export const mouse = new THREE.Vector2();

// ---------- Carga de modelos ----------
export const loader = new GLTFLoader();
export let totalModelsToLoad = 0, modelsLoaded = 0;

export function checkLoading() {
    modelsLoaded++;
    const loadingEl = document.getElementById('loading');
    const loadCount = document.getElementById('loading-count');
    const loadBar = document.getElementById('loading-bar');
    if(loadCount && loadBar) {
        loadCount.innerText = `${modelsLoaded}/${totalModelsToLoad}`;
        const percent = Math.min((modelsLoaded / totalModelsToLoad) * 100, 100);
        loadBar.style.width = `${percent}%`;
        if (modelsLoaded >= totalModelsToLoad) {
            setTimeout(() => { if(loadingEl) loadingEl.style.opacity = '0'; setTimeout(()=>loadingEl.style.display='none', 500); }, 500);
        }
    }
}

export function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
    if (!itemFile) return;
    if (loadedSlotMeshes[categoryKey]) { 
        scene.remove(loadedSlotMeshes[categoryKey]); 
        disposeThreeJSObject(loadedSlotMeshes[categoryKey]); 
    }
    loader.load(getFreshUrl(itemFile), (gltf) => {
        const model = gltf.scene; 
        applyMaterialLogic(model, categoryKey);
        if (categoryKey === 'pantalla_tv') {
            model.traverse((node) => {
                if (node.isMesh && node.material) {
                    tvScreenMesh = node; 
                    let mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(mat => { 
                        if (!isTvOn) { 
                            mat.map = null; 
                            mat.emissiveMap = null; 
                            mat.color = new THREE.Color(0x000000); 
                            mat.emissive = new THREE.Color(0x000000); 
                            mat.emissiveIntensity = 0; 
                        } else { 
                            mat.map = tvTexture; 
                            mat.emissiveMap = tvTexture; 
                            mat.color = new THREE.Color(0xffffff); 
                            mat.emissive = new THREE.Color(0xffffff); 
                            mat.emissiveIntensity = 1.0; 
                        }
                        mat.needsUpdate = true;
                    });
                }
            });
            if (!isTvOn) tvVideo.pause();
        }
        if (categoryKey === 'foco') { 
            focoMesh = model; 
            const box = new THREE.Box3().setFromObject(model); 
            const center = new THREE.Vector3(); 
            box.getCenter(center); 
            mainLight.position.copy(center); 
            mainLight.position.y -= 0.2; 
        }
        if (categoryKey === 'interruptor') switchMesh = model;
        scene.add(model); 
        loadedSlotMeshes[categoryKey] = model;
        if(isInitialLoad) checkLoading();
    }, undefined, () => { if(isInitialLoad) checkLoading(); });
}

// Exportar también setters para variables que necesitan ser modificadas desde otros módulos
export function setSwitchMesh(mesh) { switchMesh = mesh; }
export function setFocoMesh(mesh) { focoMesh = mesh; }
export function setFocoDiaMesh(mesh) { focoDiaMesh = mesh; }
export function setLuzFocoDia(light) { luzFocoDia = light; }
export function setTvScreenMesh(mesh) { tvScreenMesh = mesh; }
export function setTvOn(value) { isTvOn = value; }
export function setTvTransitioning(value) { tvTransitioning = value; }
export function setLastTvClickTime(value) { lastTvClickTime = value; }
export function setLightOn(value) { lightOn = value; }
export function setEsDeDiaLocal(value) { esDeDiaLocal = value; }
export function setLastWeatherCode(value) { lastWeatherCode = value; }