import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { defaultInventoryConfig, inventoryGroups } from './inventory-data.js';

function getFreshUrl(url) {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}nocache=${Date.now()}`;
}

function disposeThreeJSObject(node) {
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

let playerCoins = parseInt(localStorage.getItem('room_coins')) || 1000;
let inventoryData = JSON.parse(localStorage.getItem('room_inventory')) || defaultInventoryConfig;
if (inventoryData.base_foco) delete inventoryData.base_foco;

// SISTEMA DE RECOMPENSA DIARIA
function checkDailyReward() {
    let lastLogin = localStorage.getItem('room_last_login');
    let today = new Date().toDateString();
    if (lastLogin !== today) {
        playerCoins += 100;
        localStorage.setItem('room_last_login', today);
        const toast = document.getElementById('daily-reward-toast');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 4000);
    }
}
checkDailyReward();
document.getElementById('coin-amount').innerText = playerCoins;

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

function saveGame() {
    localStorage.setItem('room_coins', playerCoins);
    localStorage.setItem('room_inventory', JSON.stringify(inventoryData));
    document.getElementById('coin-amount').innerText = playerCoins;
}

const ua = navigator.userAgent;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
const deviceMemory = navigator.deviceMemory || 4;
const cpuCores = navigator.hardwareConcurrency || 4;
let baseTier = 'alta';
if (isMobileUA || deviceMemory <= 4 || cpuCores <= 4) baseTier = 'media';
if (isMobileUA && (deviceMemory <= 2 || cpuCores <= 2)) baseTier = 'baja';

let gameSettings = JSON.parse(localStorage.getItem('ff_settings')) || {
    calidad: baseTier, 
    sombras: baseTier === 'baja' ? 0 : (baseTier === 'media' ? 1 : 2),
    fps: baseTier === 'baja' ? 30 : 60,
    volumenTV: 50,      
    volumenEfectos: 50, 
    mostrarFps: false
};
// Compatibilidad con versión anterior
if(gameSettings.volumen) { gameSettings.volumenTV = gameSettings.volumen; gameSettings.volumenEfectos = gameSettings.volumen; delete gameSettings.volumen; }

const loadedSlotMeshes = {};
let switchMesh = null, focoMesh = null, focoDiaMesh = null, luzFocoDia = null;
let esDeDiaLocal = true;

// AQUÍ LEEMOS EL ESTADO DE LA TELEVISIÓN
let isTvOn = localStorage.getItem('room_tv_on') === 'true'; 
let tvTransitioning = false; let lastTvClickTime = 0; let tvScreenMesh = null;

const audioPrenderLuz = new Audio('prender_luz.mp3');
const audioApagarLuz = new Audio('apagar_luz.mp3');
const audioAbrirPoster = new Audio('abrir_poster.mp3');
const audioCerrarPoster = new Audio('guardar_poster.mp3');
const audioBotonTV = new Audio('sonido_boton.mp3');

const tvEffectVideoOff = document.createElement('video');
tvEffectVideoOff.src = 'efecto_tele.mp4'; tvEffectVideoOff.crossOrigin = 'anonymous'; tvEffectVideoOff.playsInline = true;
document.body.appendChild(tvEffectVideoOff);
tvEffectVideoOff.style.display = 'none';

const tvEffectVideoOn = document.createElement('video'); 
tvEffectVideoOn.src = 'efecto_tele - Invertido.mp4'; tvEffectVideoOn.crossOrigin = 'anonymous'; tvEffectVideoOn.playsInline = true;
document.body.appendChild(tvEffectVideoOn);
tvEffectVideoOn.style.display = 'none';

const tvEffectTextureOff = new THREE.VideoTexture(tvEffectVideoOff); tvEffectTextureOff.minFilter = THREE.LinearFilter; tvEffectTextureOff.magFilter = THREE.LinearFilter; tvEffectTextureOff.format = THREE.RGBAFormat;
const tvEffectTextureOn = new THREE.VideoTexture(tvEffectVideoOn); tvEffectTextureOn.minFilter = THREE.LinearFilter; tvEffectTextureOn.magFilter = THREE.LinearFilter; tvEffectTextureOn.format = THREE.RGBAFormat;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);
const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200);
let camPosY = 6, camPosZ = 14, targetY = 6;
if (window.innerWidth < 768 || isMobileUA) { camPosY = 6; camPosZ = 12; targetY = 5; }
camera.position.set(0, camPosY, camPosZ);

const renderer = new THREE.WebGLRenderer({ antialias: gameSettings.calidad !== 'baja', powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.target.set(0, targetY, 0); controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 2.5; controls.maxDistance = 16;
controls.enablePan = false;

const ambient = new THREE.AmbientLight(0xffffff, 0.3); scene.add(ambient);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const mainLight = new THREE.SpotLight(0xffeedd, 6); mainLight.position.set(2, 22, 2); mainLight.angle = Math.PI / 3;
mainLight.penumbra = 0.8; mainLight.decay = 2; mainLight.distance = 60;
mainLight.shadow.camera.near = 0.5; mainLight.shadow.camera.far = 40; mainLight.shadow.bias = -0.002;
mainLight.shadow.normalBias = 0.05; mainLight.shadow.radius = 4; scene.add(mainLight); scene.add(mainLight.target);

// AQUÍ LEEMOS EL ESTADO DE LA LUZ
let lightOn = localStorage.getItem('lightState') !== 'off';

// === SISTEMA DE SUEÑO LUNARI ===
let currentHour = new Date().getHours();
let isSleepTime = (currentHour >= 22 || currentHour < 7); // De 10 PM a 7 AM
// Solo despertará si NO es hora de dormir, O si dejaste la luz prendida, O si dejaste la tele prendida
let shouldWakeUp = !isSleepTime || lightOn || isTvOn;

function applyCurrentSettings() {
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
    
    // Aplicar volumen separado
    const tvVideo = document.getElementById('tv-video');
    if (tvVideo) tvVideo.volume = gameSettings.volumenTV / 100;
    tvEffectVideoOff.volume = gameSettings.volumenEfectos / 100;
    tvEffectVideoOn.volume = gameSettings.volumenEfectos / 100;
    let volEf = gameSettings.volumenEfectos / 100;
    audioPrenderLuz.volume = volEf; audioApagarLuz.volume = volEf;
    audioAbrirPoster.volume = volEf; audioCerrarPoster.volume = volEf;
    audioBotonTV.volume = volEf;
}

function updateLunariText(isDay, weatherCode) {
    const dialogBox = document.getElementById('dialogue-text');
    if(!dialogBox) return;

    if (!shouldWakeUp) {
        dialogBox.innerHTML = "<i>Zzz... Zzz...</i><br><span style='font-size:11px;color:#aaa;'>(Lunari está profundamente dormida)</span>";
        return;
    }

    if (!isDay) { dialogBox.innerHTML = "¡Qué noche tan tranquila!<br>¿Deberíamos dormir pronto?"; }
    else if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(weatherCode)) {
        dialogBox.innerHTML = "El clima está feo afuera.<br>¡Mejor nos quedamos viendo anime!";
    } else {
        dialogBox.innerHTML = "¡Hola!<br>Bienvenido de nuevo a casa.<br>¿Vemos un anime hoy?";
    }
}

let lastWeatherCode = 0;
function actualizarIluminacionFocoDia() {
    const hora = new Date().getHours(); let colorHex, lightInt, emInt, dist;
    if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8; dist = 35; }
    else if (hora >= 9 && hora < 17) { colorHex = 0xffffff; lightInt = 1.5; emInt = 1.5; dist = 50; }
    else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00; lightInt = 0.7; emInt = 0.7; dist = 40; }
    else { colorHex = 0x5566aa; lightInt = 0.25; emInt = 0.25; dist = 25; }

    if (luzFocoDia) { luzFocoDia.color.setHex(colorHex); luzFocoDia.intensity = lightInt; luzFocoDia.distance = dist; luzFocoDia.castShadow = gameSettings.sombras > 0; }
    if (focoDiaMesh) {
        focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material) { n.material.emissive.setHex(colorHex); n.material.emissiveIntensity = emInt; n.material.needsUpdate = true; }
        });
    }
    updateLunariText(esDeDiaLocal, lastWeatherCode);
}
setInterval(actualizarIluminacionFocoDia, 60000);

function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isFoco = categoryKey === 'foco', isFocoDia = categoryKey === 'foco_dia';
    const allowShadows = gameSettings.sombras > 0;
    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            if (isFoco || isFocoDia) {
                node.castShadow = false; node.receiveShadow = false;
                if (node.material) {
                    if (isFoco) { node.material.emissive = new THREE.Color(0xffeedd); node.material.emissiveIntensity = lightOn ? 1.5 : 0; }
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

const tvVideo = document.getElementById('tv-video');
const tvTexture = new THREE.VideoTexture(tvVideo); tvTexture.minFilter = THREE.LinearFilter; tvTexture.magFilter = THREE.LinearFilter; tvTexture.format = THREE.RGBAFormat;
tvTexture.encoding = THREE.sRGBEncoding;

let tvPlaylist = []; let currentTvIndex = -1;
function updatePlaylist() {
    tvPlaylist = inventoryData.videos.equipped.map(id => inventoryData.videos.items[id].file);
    if(tvPlaylist.length === 0) tvVideo.pause();
}

function playNextTv(random = false) {
    updatePlaylist(); if(tvPlaylist.length === 0) return;
    currentTvIndex = random ? Math.floor(Math.random() * tvPlaylist.length) : (currentTvIndex + 1) % tvPlaylist.length;
    tvVideo.src = tvPlaylist[currentTvIndex]; tvVideo.volume = gameSettings.volumenTV / 100;
    if (isTvOn && !tvTransitioning) tvVideo.play().catch(e => console.warn('User interaction needed', e));
}

const tvPrevBtn = document.getElementById('tv-prev'), tvPlayPauseBtn = document.getElementById('tv-play-pause'), tvNextBtn = document.getElementById('tv-next'), tvPowerBtn = document.getElementById('tv-power');

function playButtonSound() { audioBotonTV.currentTime = 0; audioBotonTV.play().catch(e=>{}); }

tvPrevBtn.onclick = () => { playButtonSound(); if (!isTvOn || tvTransitioning) return; updatePlaylist(); if(tvPlaylist.length===0)return;
currentTvIndex = (currentTvIndex - 1 + tvPlaylist.length) % tvPlaylist.length; tvVideo.src = tvPlaylist[currentTvIndex]; tvVideo.play(); };
tvPlayPauseBtn.onclick = () => { playButtonSound();
if (!isTvOn || tvTransitioning) return; if(tvVideo.paused) tvVideo.play(); else tvVideo.pause(); };
tvNextBtn.onclick = () => { playButtonSound();
if (isTvOn && !tvTransitioning) playNextTv(false); };

if (tvPowerBtn) {
    // Configuración inicial visual del botón según el guardado
    tvPowerBtn.innerText = isTvOn ? '🟢' : '🔴';
    tvPowerBtn.style.color = isTvOn ? '#00ff00' : 'red';
    tvPowerBtn.style.textShadow = isTvOn ? '0 0 5px #00ff00' : '0 0 5px red';

    tvPowerBtn.addEventListener('click', () => {
        playButtonSound();
        if (tvTransitioning || !tvScreenMesh) return;
        tvTransitioning = true; tvVideo.pause();
        const mats = Array.isArray(tvScreenMesh.material) ? tvScreenMesh.material : [tvScreenMesh.material];
        const effectVideo = isTvOn ? tvEffectVideoOff : tvEffectVideoOn; 
        const effectTexture = isTvOn ? tvEffectTextureOff : tvEffectTextureOn;

        mats.forEach(mat => { mat.map = effectTexture; mat.emissiveMap = effectTexture; mat.color.setHex(0xffffff); mat.emissive.setHex(0xffffff); mat.emissiveIntensity = 1.0; mat.needsUpdate = true; });
        effectVideo.currentTime = 0; effectVideo.play().catch(e=>{});

        const onEffectEnded = () => {
            effectVideo.removeEventListener('ended', onEffectEnded);
            if (isTvOn) {
                isTvOn = false; 
                localStorage.setItem('room_tv_on', 'false'); // Guardamos estado de la TV
                tvPowerBtn.innerText = '🔴'; tvPowerBtn.style.color = 'red'; tvPowerBtn.style.textShadow = '0 0 5px red';
                mats.forEach(mat => { mat.map = null; mat.emissiveMap = null; mat.color.setHex(0x000000); mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; mat.needsUpdate = true; });
            } else {
                isTvOn = true;
                localStorage.setItem('room_tv_on', 'true'); // Guardamos estado de la TV
                tvPowerBtn.innerText = '🟢'; tvPowerBtn.style.color = '#00ff00'; tvPowerBtn.style.textShadow = '0 0 5px #00ff00';
                mats.forEach(mat => { mat.map = tvTexture; mat.emissiveMap = tvTexture; mat.color.setHex(0xffffff); mat.emissive.setHex(0xffffff); mat.emissiveIntensity = 1.0; mat.needsUpdate = true; });
                if (tvPlaylist.length > 0) { tvVideo.currentTime = 0; tvVideo.play().catch(e=>{}); }
            }
            tvTransitioning = false;
        };
        effectVideo.addEventListener('ended', onEffectEnded, { once: true });
    });
}
playNextTv(true);

let totalModelsToLoad = 0, modelsLoaded = 0;
for (let cat in inventoryData) {
    if (inventoryData[cat].type === 'multiple') continue; let eqId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[eqId]) {
        let it = inventoryData[cat].items[eqId];
        if (it.file) totalModelsToLoad++;
        if (cat === 'foco' && it.baseFile) totalModelsToLoad++; if (cat === 'tele' && it.baseFile) totalModelsToLoad++;
    }
}

// Calculamos el total de modelos dependiendo si carga la de dormida (2 modelos) o despierta (1 modelo)
if (shouldWakeUp) {
    totalModelsToLoad += 3; // Lunari Despierta, FocoDia, Cuadro Clima
} else {
    totalModelsToLoad += 4; // Lunari Durmiendo1, Lunari Durmiendo2, FocoDia, Cuadro Clima
}

function checkLoading() {
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
if(totalModelsToLoad === 0 && document.getElementById('loading')) document.getElementById('loading').style.display = 'none';

const loader = new GLTFLoader();
let lunariMixer = null, baseAction = null, randomAction = null, currentAction = null;

// Lógica para cargar el modelo de Lunari correspondiente
if (shouldWakeUp) {
    loader.load(getFreshUrl('lunari_despierta.glb'), (gltf) => {
        const lunariModel = gltf.scene; applyMaterialLogic(lunariModel, 'lunari'); scene.add(lunariModel);
        if (gltf.animations && gltf.animations.length > 0) { 
            lunariMixer = new THREE.AnimationMixer(lunariModel); 
            baseAction = lunariMixer.clipAction(gltf.animations[0]); 
            baseAction.play(); 
            currentAction = baseAction; 
        }
        checkLoading();
    }, undefined, (error) => { console.error('Error cargando lunari despierta:', error); checkLoading(); });
} else {
    loader.load(getFreshUrl('lunari_durmiendo1.glb'), (gltf) => {
        const lunariModel = gltf.scene; applyMaterialLogic(lunariModel, 'lunari'); scene.add(lunariModel);
        if (gltf.animations && gltf.animations.length > 0) { 
            lunariMixer = new THREE.AnimationMixer(lunariModel); 
            baseAction = lunariMixer.clipAction(gltf.animations[0]); 
            baseAction.play(); 
            currentAction = baseAction; 
        }
        checkLoading();
    }, undefined, (error) => { console.error('Error cargando lunari_durmiendo1:', error); checkLoading(); });

    loader.load(getFreshUrl('Lunari_Duerme_2.glb'), (gltf) => {
        if (gltf.animations && gltf.animations.length > 0 && lunariMixer) { 
            randomAction = lunariMixer.clipAction(gltf.animations[0]); 
            randomAction.loop = THREE.LoopOnce; 
            randomAction.clampWhenFinished = true; 
        }
        checkLoading();
    }, undefined, (error) => { console.error('Error cargando Lunari_Duerme_2:', error); checkLoading(); });

    setInterval(() => {
        if (!randomAction || !baseAction || !lunariMixer || currentAction === randomAction) return;
        if (baseAction && randomAction) {
            baseAction.fadeOut(0.5); randomAction.reset().fadeIn(0.5).play(); currentAction = randomAction;
            const onFinished = (event) => {
                if (event.action === randomAction) { randomAction.fadeOut(0.5); baseAction.reset().fadeIn(0.5).play(); currentAction = baseAction; lunariMixer.removeEventListener('finished', onFinished); }
            };
            lunariMixer.addEventListener('finished', onFinished);
        }
    }, 60000);
}

// Cargas normales (Foco, Cuadro)
loader.load(getFreshUrl('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb'), (gltf) => {
    focoDiaMesh = gltf.scene; applyMaterialLogic(focoDiaMesh, 'foco_dia'); 
    luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(focoDiaMesh); const center = new THREE.Vector3(); box.getCenter(center);
    luzFocoDia.position.copy(center); luzFocoDia.position.y -= 0.2; luzFocoDia.shadow.bias = -0.005; luzFocoDia.shadow.normalBias = 0.1;
    scene.add(luzFocoDia); scene.add(focoDiaMesh); focoDiaMesh.visible = false; luzFocoDia.visible = true; 
    actualizarIluminacionFocoDia(); checkLoading();
}, undefined, () => checkLoading());

function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
    if (!itemFile) return;
    if (loadedSlotMeshes[categoryKey]) { scene.remove(loadedSlotMeshes[categoryKey]); disposeThreeJSObject(loadedSlotMeshes[categoryKey]); }
    loader.load(getFreshUrl(itemFile), (gltf) => {
        const model = gltf.scene; applyMaterialLogic(model, categoryKey);
        if (categoryKey === 'pantalla_tv') {
            model.traverse((node) => {
                if (node.isMesh && node.material) {
                    tvScreenMesh = node; 
                    let mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(mat => { 
                        if (!isTvOn) { mat.map = null; mat.emissiveMap = null; mat.color = new THREE.Color(0x000000); mat.emissive = new THREE.Color(0x000000); mat.emissiveIntensity = 0; } 
                        else { mat.map = tvTexture; mat.emissiveMap = tvTexture; mat.color = new THREE.Color(0xffffff); mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 1.0; }
                        mat.needsUpdate = true;
                    });
                }
             });
            if (!isTvOn) tvVideo.pause();
        }
        if (categoryKey === 'foco') { focoMesh = model;
            const box = new THREE.Box3().setFromObject(model); const center = new THREE.Vector3(); box.getCenter(center); mainLight.position.copy(center); mainLight.position.y -= 0.2;
        }
        if (categoryKey === 'interruptor') switchMesh = model;
        scene.add(model); loadedSlotMeshes[categoryKey] = model;
        if(isInitialLoad) checkLoading();
    }, undefined, () => { if(isInitialLoad) checkLoading(); });
}

for (let cat in inventoryData) {
    if (inventoryData[cat].type === 'multiple') continue; let eqId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[eqId]) {
        let it = inventoryData[cat].items[eqId];
        if (it.file) loadItemForSlot(cat, it.file, true);
        if (cat === 'foco' && it.baseFile) loadItemForSlot('base_foco', it.baseFile, true);
        if (cat === 'tele' && it.baseFile) loadItemForSlot('pantalla_tv', it.baseFile, true);
    }
}

(async function setupWeatherVideo() {
    const video = document.createElement('video'); video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    let videoFile = 'dia_soleado.mp4', weatherEmoji = "☀️", weatherName = "Clima estándar", temperature = "--";
    const statusBox = document.getElementById('weather-status');

    try {
        let lat, lon;
        try { const ipResponse = await fetch('https://ipapi.co/json/'); const ipData = await ipResponse.json(); if(ipData.latitude && ipData.longitude) { lat = ipData.latitude; lon = ipData.longitude; 
        } else throw new Error(); } 
        catch(e) { lat = -12.0464; lon = -77.0428; }
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode, isDay = data.current_weather.is_day;
        esDeDiaLocal = (isDay === 1);
        lastWeatherCode = code; actualizarIluminacionFocoDia(); temperature = data.current_weather.temperature;

        if (code === 0) { weatherName = isDay ? "Despejado" : "Noche despejada"; weatherEmoji = isDay ? "☀️" : "🌙"; videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; } 
        else if ([1, 2, 3].includes(code)) { weatherName = isDay ? "Nublado" : "Noche nublada"; weatherEmoji = "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; }
        else if (code === 45 || code === 48) { weatherName = "Niebla"; weatherEmoji = "🌫️"; videoFile = isDay ? 'dia_niebla.mp4' : 'noche_niebla.mp4'; }
        else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) { weatherName = "Lluvia"; weatherEmoji = "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; }
        else if ([71, 73, 75, 77, 85, 86].includes(code)) { weatherName = "Nieve"; weatherEmoji = "❄️"; videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4'; }
        else if ([95, 96, 99].includes(code)) { weatherName = "Tormenta"; weatherEmoji = "⛈️"; videoFile = isDay ? 'dia_tormenta.mp4' : 'noche_tormenta.mp4'; }
    } catch (error) { weatherEmoji = "❌"; weatherName = "Clima offline"; }

    statusBox.innerHTML = temperature !== "--" ? `${weatherEmoji} ${weatherName} | ${temperature}°C` : `${weatherEmoji} ${weatherName}`;
    video.src = videoFile; video.play().catch(e => console.log('Autoplay blocked'));

    const videoTexture = new THREE.VideoTexture(video); videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter; videoTexture.format = THREE.RGBAFormat; videoTexture.encoding = THREE.sRGBEncoding;
    loader.load(getFreshUrl('cuadro.glb'), (gltf) => {
        const cuadroModel = gltf.scene;
        cuadroModel.traverse((node) => {
            if (node.isMesh && node.material) {
                if (Array.isArray(node.material)) { node.material.forEach(mat => { mat.map = videoTexture; mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = videoTexture; mat.emissiveIntensity = 1.0; mat.needsUpdate = true; }); } 
                else { node.material.map = videoTexture; node.material.emissive = new THREE.Color(0xffffff); node.material.emissiveMap = videoTexture; node.material.emissiveIntensity = 1.0; node.material.needsUpdate = true; }
            }
        });
        applyMaterialLogic(cuadroModel, 'cuadro'); scene.add(cuadroModel); loadedSlotMeshes['cuadro'] = cuadroModel; checkLoading();
    }, undefined, () => checkLoading());
})();

function updateLighting() {
    if (lightOn) {
        mainLight.visible = true;
        ambient.intensity = gameSettings.calidad === 'baja' ? 0.8 : 0.3; hemiLight.intensity = gameSettings.calidad === 'baja' ? 0.8 : 0.4;
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
    lightOn = !lightOn;
    localStorage.setItem('lightState', lightOn ? 'on' : 'off'); updateLighting();
    if (lightOn) { audioPrenderLuz.currentTime = 0; audioPrenderLuz.play().catch(e=>{}); } 
    else { audioApagarLuz.currentTime = 0; audioApagarLuz.play().catch(e=>{}); }
}

const posterViewModal = document.getElementById('poster-view-modal'); const posterEnlargedImage = document.getElementById('poster-enlarged-image');
document.getElementById('close-poster-view').onclick = () => { posterViewModal.classList.remove('visible'); audioCerrarPoster.currentTime = 0; audioCerrarPoster.play().catch(e=>{}); };
posterViewModal.onclick = (e) => { if (e.target === posterViewModal) { posterViewModal.classList.remove('visible'); audioCerrarPoster.currentTime = 0; audioCerrarPoster.play().catch(e=>{}); } };

function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(mouse, camera);

    if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) { toggleLight(); return; }
    
    const pantallaMesh = loadedSlotMeshes['pantalla_tv'];
    if (pantallaMesh && raycaster.intersectObject(pantallaMesh, true).length > 0) {
        const tvControls = document.getElementById('tv-controls');
        const currentTime = Date.now();
        if (currentTime - lastTvClickTime < 300) { if (isTvOn && !tvTransitioning) { if (tvVideo.paused) tvVideo.play().catch(e=>{});
        else tvVideo.pause(); } } 
        else { if (tvControls.style.display === 'none' || tvControls.style.display === '') tvControls.style.display = 'flex';
        else tvControls.style.display = 'none'; }
        lastTvClickTime = currentTime; return;
    }

    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const pMesh = loadedSlotMeshes[cat];
        if (pMesh && raycaster.intersectObject(pMesh, true).length > 0) {
            const itemData = inventoryData[cat].items[inventoryData[cat].equipped];
            if (itemData && itemData.preview) { posterEnlargedImage.src = itemData.preview; posterViewModal.classList.add('visible'); audioAbrirPoster.currentTime = 0; audioAbrirPoster.play().catch(e=>{}); }
            break;
        }
    }
}

let pointerDownPos = { x: 0, y: 0 }; let isDragging = false;
renderer.domElement.addEventListener('pointerdown', (e) => { pointerDownPos.x = e.clientX; pointerDownPos.y = e.clientY; isDragging = false; });
renderer.domElement.addEventListener('pointermove', (e) => { const dx = e.clientX - pointerDownPos.x; const dy = e.clientY - pointerDownPos.y; if (Math.sqrt(dx * dx + dy * dy) > 5) isDragging = true; });
renderer.domElement.addEventListener('pointerup', (e) => { if (!isDragging && !document.getElementById('inventory-modal').classList.contains('visible') && !document.getElementById('ff-settings-modal').classList.contains('active')) handleInteraction(e); isDragging = false; });

const settingsModal = document.getElementById('ff-settings-modal');
document.getElementById('settings-button').onclick = () => settingsModal.classList.add('active');
document.getElementById('close-ff-settings').onclick = () => { settingsModal.classList.remove('active'); localStorage.setItem('ff_settings', JSON.stringify(gameSettings)); applyCurrentSettings(); };
document.querySelectorAll('.ff-tab').forEach(tab => {
    tab.onclick = () => { document.querySelectorAll('.ff-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.ff-tab-pane').forEach(p => p.classList.remove('active')); tab.classList.add('active'); document.getElementById(tab.dataset.target).classList.add('active'); };
});

function syncSettingsUI() {
    document.querySelectorAll('#setting-calidad button').forEach(b => {
        b.classList.toggle('active', b.dataset.val === gameSettings.calidad);
        b.onclick = () => { gameSettings.calidad = b.dataset.val; if(gameSettings.calidad === 'baja') { gameSettings.sombras = 0; gameSettings.fps = 30; } else if(gameSettings.calidad === 'media') { gameSettings.sombras = 1; gameSettings.fps = 60; } else if(gameSettings.calidad === 'alta') { gameSettings.sombras = 2; gameSettings.fps = 60; } syncSettingsUI(); applyCurrentSettings(); };
    });
    document.querySelectorAll('#setting-fps button').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val) === gameSettings.fps);
        b.onclick = () => { gameSettings.fps = parseInt(b.dataset.val); syncSettingsUI(); };
    });

    const volTV = document.getElementById('setting-volumen-tv'); volTV.value = gameSettings.volumenTV; document.getElementById('vol-tv-val').innerText = `${gameSettings.volumenTV}%`;
    volTV.oninput = (e) => { gameSettings.volumenTV = e.target.value; document.getElementById('vol-tv-val').innerText = `${gameSettings.volumenTV}%`; applyCurrentSettings(); };
    
    const volEf = document.getElementById('setting-volumen-efectos'); volEf.value = gameSettings.volumenEfectos;
    document.getElementById('vol-efectos-val').innerText = `${gameSettings.volumenEfectos}%`;
    volEf.oninput = (e) => { gameSettings.volumenEfectos = e.target.value; document.getElementById('vol-efectos-val').innerText = `${gameSettings.volumenEfectos}%`; applyCurrentSettings(); };

    const fpsCheck = document.getElementById('setting-showfps');
    fpsCheck.checked = gameSettings.mostrarFps; fpsCheck.onchange = (e) => { gameSettings.mostrarFps = e.target.checked; applyCurrentSettings(); };
}

let currentCategory = 'cama', openGroup = 'muebles';
function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar'), content = document.getElementById('inv-content'); sidebar.innerHTML = ''; content.innerHTML = '';
    inventoryGroups.forEach(group => {
        const groupDiv = document.createElement('div'); groupDiv.className = 'inv-group';
        const groupBtn = document.createElement('button'); groupBtn.className = 'group-btn';
        groupBtn.innerHTML = `<span>${group.emoji} ${group.label}</span> <span style="transition:0.3s; transform: ${openGroup === group.id ? 'rotate(90deg)' : 'rotate(0deg)'}">▶</span>`;
        groupBtn.onclick = () => { openGroup = openGroup === group.id ? null : group.id; renderInventory(); };
        groupDiv.appendChild(groupBtn);
        const groupContent = document.createElement('div'); groupContent.className = `group-content ${openGroup === group.id ? 'open' : ''}`;
        group.categories.forEach(catKey => {
            const catData = inventoryData[catKey]; if(!catData) return;
            const btn = document.createElement('button'); btn.className = `cat-btn ${catKey === currentCategory ? 'active' : ''}`;
            btn.innerHTML = `<span class="cat-icon-emoji">${catData.emoji}</span> <span>${catData.label}</span>`;
            btn.onclick = () => { currentCategory = catKey; renderInventory(); };
            groupContent.appendChild(btn);
        });
        groupDiv.appendChild(groupContent); sidebar.appendChild(groupDiv);
    });

    const catData = inventoryData[currentCategory];
    if (!catData) return;
    for (let itemId in catData.items) {
        const item = catData.items[itemId];
        let isEq = catData.type === 'multiple' ? catData.equipped.includes(itemId) : catData.equipped === itemId;
        const card = document.createElement('div'); card.className = 'item-card';
        const prev = document.createElement('div'); prev.className = 'item-preview';
        if (item.preview) { const img = document.createElement('img'); img.src = item.preview; img.alt = item.name;
        img.onerror = () => { prev.innerHTML = `<span>${catData.emoji}</span>`; }; prev.appendChild(img); } else prev.innerHTML = `<span>${catData.emoji}</span>`;
        let btn = item.owned ?
        (isEq ? `<button class="item-btn btn-equipped" onclick="equipItem('${currentCategory}', '${itemId}')">${catData.type === 'multiple' ? 'Quitar ✓' : 'Equipado ✓'}</button>` : `<button class="item-btn btn-equip" onclick="equipItem('${currentCategory}', '${itemId}')">Equipar</button>`) : `<button class="item-btn btn-buy" onclick="buyItem('${currentCategory}', '${itemId}')">Comprar 🪙${item.price}</button>`;
        card.innerHTML = `<div>${prev.outerHTML}<h4>${item.name}</h4><div class="item-price">${item.owned ? 'Adquirido' : `🪙 ${item.price}`}</div></div>${btn}`; content.appendChild(card);
    }
}

window.equipItem = function(category, itemId) {
    const catData = inventoryData[category];
    if (catData.type === 'multiple') { const idx = catData.equipped.indexOf(itemId); if (idx > -1) catData.equipped.splice(idx, 1); else catData.equipped.push(itemId); updatePlaylist();
    } else { catData.equipped = itemId; const itemData = catData.items[itemId]; loadItemForSlot(category, itemData.file, false);
    if (category === 'foco' && itemData.baseFile) loadItemForSlot('base_foco', itemData.baseFile, false); if (category === 'tele' && itemData.baseFile) loadItemForSlot('pantalla_tv', itemData.baseFile, false);
    }
    saveGame(); renderInventory(); 
};
window.buyItem = function(category, itemId) {
    let item = inventoryData[category].items[itemId];
    if (playerCoins >= item.price) { playerCoins -= item.price; item.owned = true; saveGame(); renderInventory(); } else alert("No tienes suficientes monedas.");
};
document.getElementById('inventory-button').onclick = () => { document.getElementById('inventory-modal').classList.add('visible'); renderInventory(); };
document.getElementById('close-inv').onclick = () => { document.getElementById('inventory-modal').classList.remove('visible'); };

let then = performance.now();
let frames = 0, lastFpsTime = then;
function animate() {
    requestAnimationFrame(animate); const now = performance.now();
    const elapsed = now - then; const fpsInterval = gameSettings.fps > 0 ? 1000 / gameSettings.fps : 0;
    if (fpsInterval === 0 || elapsed > fpsInterval) {
        if (fpsInterval > 0) then = now - (elapsed % fpsInterval);
        const delta = clock.getDelta(); if (lunariMixer) lunariMixer.update(delta);
        controls.update(); renderer.render(scene, camera);
        if (gameSettings.mostrarFps) { frames++;
        if (now - lastFpsTime >= 1000) { document.querySelector('#fps-counter span').innerText = frames; frames = 0; lastFpsTime = now;
        } }
    }
}

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); applyCurrentSettings(); });
syncSettingsUI();
applyCurrentSettings(); updateLighting(); animate();