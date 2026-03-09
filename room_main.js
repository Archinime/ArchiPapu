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
    if (node.children) {
        node.children.forEach(child => disposeThreeJSObject(child));
    }
}

// --- Detección de dispositivo ---
const ua = navigator.userAgent;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
const width = window.innerWidth;
let deviceType = (width < 768 || (isMobileUA && width < 1024)) ? 'mobile' : (width >= 768 && width <= 1024) ? 'tablet' : 'desktop';

// --- NUEVO: SISTEMA DE AJUSTES (ESTILO FREE FIRE) ---
const defaultSettings = {
    resolution: isMobileUA ? 'low' : 'high', // Celular = baja res por defecto
    shadows: !isMobileUA,                    // Celular = sin sombras por defecto
    fps: isMobileUA ? 30 : 60,               // Celular = 30fps para ahorrar batería
    volume: 0.5,
    mute: false,
    showFps: !isMobileUA
};

let gameSettings = JSON.parse(localStorage.getItem('room_settings')) || { ...defaultSettings };

// Rellenar valores faltantes por si es una versión vieja guardada
for (let key in defaultSettings) {
    if (gameSettings[key] === undefined) gameSettings[key] = defaultSettings[key];
}

function saveSettings() {
    localStorage.setItem('room_settings', JSON.stringify(gameSettings));
    applySettings();
}

// --- SISTEMA DE DATOS E INVENTARIO ---
let playerCoins = parseInt(localStorage.getItem('room_coins')) || 1000;
document.getElementById('coin-amount').innerText = playerCoins;
let inventoryData = JSON.parse(localStorage.getItem('room_inventory')) || defaultInventoryConfig;
if (inventoryData.base_foco) delete inventoryData.base_foco;

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
        if(!inventoryData[cat].items[item]) {
            inventoryData[cat].items[item] = defaultInventoryConfig[cat].items[item];
        } else {
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

const loadedSlotMeshes = {};
let switchMesh = null, focoMesh = null, focoDiaMesh = null, luzFocoDia = null;
let esDeDiaLocal = true;

// --- Escena, Cámara y Reloj ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);
const clock = new THREE.Clock();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200);
let camPosY = 6, camPosZ = 14, targetY = 6;
if (deviceType === 'mobile') { camPosY = 6; camPosZ = 12; targetY = 5; }
camera.position.set(0, camPosY, camPosZ);

const renderer = new THREE.WebGLRenderer({ 
    antialias: !isMobileUA, // FIJO: AA apagado en móviles desde el inicio
    powerPreference: "high-performance" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, targetY, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 2.5; controls.maxDistance = 16;
controls.enablePan = false;

// --- LUCES BASE ---
const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); 
hemiLight.position.set(0, 20, 0); 
scene.add(hemiLight);

const mainLight = new THREE.SpotLight(0xffeedd, 6);
mainLight.position.set(2, 22, 2);
mainLight.angle = Math.PI / 3; mainLight.penumbra = 0.8; mainLight.decay = 2; mainLight.distance = 60;
mainLight.shadow.mapSize.set(isMobileUA ? 512 : 2048, isMobileUA ? 512 : 2048);
mainLight.shadow.camera.near = 0.5; mainLight.shadow.camera.far = 40; 
mainLight.shadow.bias = -0.002; mainLight.shadow.normalBias = 0.05; mainLight.shadow.radius = 4; 
scene.add(mainLight); scene.add(mainLight.target);

let lightOn = localStorage.getItem('lightState') !== 'off';

function actualizarIluminacionFocoDia() {
    const hora = new Date().getHours();
    let colorHex, lightInt, emInt, dist;

    if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8; dist = 35; } 
    else if (hora >= 9 && hora < 17) { colorHex = 0xffffff; lightInt = 1.5; emInt = 1.5; dist = 50; } 
    else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00; lightInt = 0.7; emInt = 0.7; dist = 40; } 
    else { colorHex = 0x5566aa; lightInt = 0.25; emInt = 0.25; dist = 25; }

    if (luzFocoDia) {
        luzFocoDia.color.setHex(colorHex); luzFocoDia.intensity = lightInt; luzFocoDia.distance = dist;
    }
    if (focoDiaMesh) {
        focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material) {
                n.material.emissive.setHex(colorHex); n.material.emissiveIntensity = emInt; n.material.needsUpdate = true;
            }
        });
    }
}
setInterval(actualizarIluminacionFocoDia, 60000);

function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isFoco = categoryKey === 'foco';
    const isFocoDia = categoryKey === 'foco_dia';
    const castShadows = gameSettings.shadows;

    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            if (isFoco || isFocoDia) {
                node.castShadow = false; node.receiveShadow = false;
                if (node.material) {
                    if (isFoco) {
                        node.material.emissive = new THREE.Color(0xffeedd);
                        node.material.emissiveIntensity = lightOn ? 1.5 : 0;
                    }
                    if (isFocoDia) node.material.emissive = new THREE.Color(0xffffff); 
                }
            } else {
                node.castShadow = castShadows; node.receiveShadow = castShadows;
                if(node.material) {
                    node.material.shadowSide = THREE.FrontSide;
                    if(node.name.toLowerCase().includes('pared') || node.name.toLowerCase().includes('piso') || node.name.toLowerCase().includes('techo')) {
                        node.material.shadowSide = THREE.BackSide;
                    }
                    node.material.side = THREE.DoubleSide;
                    node.material.needsUpdate = true;
                }
            }
        }
    });
}

// --- LÓGICA DE VIDEOS EN TV ---
const tvVideo = document.getElementById('tv-video');
const tvTexture = new THREE.VideoTexture(tvVideo);
tvTexture.minFilter = THREE.LinearFilter; tvTexture.magFilter = THREE.LinearFilter;
tvTexture.format = THREE.RGBAFormat; tvTexture.encoding = THREE.sRGBEncoding;

let tvPlaylist = []; let currentTvIndex = -1;
function updatePlaylist() {
    tvPlaylist = inventoryData.videos.equipped.map(id => inventoryData.videos.items[id].file);
    if(tvPlaylist.length === 0) tvVideo.pause();
}

function playNextTv(random = false) {
    updatePlaylist();
    if(tvPlaylist.length === 0) return;
    if(random) currentTvIndex = Math.floor(Math.random() * tvPlaylist.length);
    else currentTvIndex = (currentTvIndex + 1) % tvPlaylist.length;
    
    tvVideo.src = tvPlaylist[currentTvIndex];
    tvVideo.play().catch(e => console.warn('Requiere interacción de usuario primero', e));
}

tvVideo.addEventListener('ended', () => playNextTv(false));
document.getElementById('tv-prev').onclick = () => {
    updatePlaylist(); if(tvPlaylist.length === 0) return;
    currentTvIndex = (currentTvIndex - 1 + tvPlaylist.length) % tvPlaylist.length;
    tvVideo.src = tvPlaylist[currentTvIndex]; tvVideo.play();
};
document.getElementById('tv-next').onclick = () => playNextTv(false);
document.getElementById('tv-play-pause').onclick = () => {
    if(tvVideo.paused) tvVideo.play(); else tvVideo.pause();
};
playNextTv(true);

// --- CARGA DE MODELOS ---
let totalModelsToLoad = 0, modelsLoaded = 0;
for (let cat in inventoryData) {
    if (inventoryData[cat].type === 'multiple') continue;
    let equippedItemId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[equippedItemId]) {
        let itemData = inventoryData[cat].items[equippedItemId];
        if (itemData.file) totalModelsToLoad++;
        if (cat === 'foco' && itemData.baseFile) totalModelsToLoad++;
        if (cat === 'tele' && itemData.baseFile) totalModelsToLoad++;
    }
}
totalModelsToLoad += 4; // Lunari + Animación + Cuadro + Foco de Día

function checkLoading() {
    modelsLoaded++;
    const loadingEl = document.getElementById('loading');
    if(loadingEl) {
        loadingEl.innerText = `Cargando: ${modelsLoaded}/${totalModelsToLoad}`;
        if (modelsLoaded >= totalModelsToLoad) loadingEl.style.display = 'none';
    }
}
if(totalModelsToLoad === 0 && document.getElementById('loading')) document.getElementById('loading').style.display = 'none';

const loader = new GLTFLoader();
let lunariMixer = null, baseAction = null, randomAction = null, currentAction = null;

loader.load(getFreshUrl('lunari_durmiendo1.glb'), (gltf) => {
    const lunariModel = gltf.scene; applyMaterialLogic(lunariModel, 'lunari'); scene.add(lunariModel);
    if (gltf.animations && gltf.animations.length > 0) {
        lunariMixer = new THREE.AnimationMixer(lunariModel);
        baseAction = lunariMixer.clipAction(gltf.animations[0]); baseAction.play(); currentAction = baseAction;
    }
    checkLoading();
}, undefined, (e) => checkLoading());

loader.load(getFreshUrl('Lunari_Duerme_2.glb'), (gltf) => {
    if (gltf.animations && gltf.animations.length > 0 && lunariMixer) {
        randomAction = lunariMixer.clipAction(gltf.animations[0]);
        randomAction.loop = THREE.LoopOnce; randomAction.clampWhenFinished = true;
    }
    checkLoading();
}, undefined, (e) => checkLoading());

loader.load(getFreshUrl('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb'), (gltf) => {
    focoDiaMesh = gltf.scene; applyMaterialLogic(focoDiaMesh, 'foco_dia'); 
    luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(focoDiaMesh);
    const center = new THREE.Vector3(); box.getCenter(center);
    luzFocoDia.position.copy(center); luzFocoDia.position.y -= 0.2;
    luzFocoDia.castShadow = true; luzFocoDia.shadow.mapSize.set(1024, 1024);
    luzFocoDia.shadow.bias = -0.005; luzFocoDia.shadow.normalBias = 0.1;
    scene.add(luzFocoDia); scene.add(focoDiaMesh);
    focoDiaMesh.visible = false; luzFocoDia.visible = true; 
    actualizarIluminacionFocoDia(); checkLoading();
}, undefined, (e) => checkLoading());

setInterval(() => {
    if (!randomAction || !baseAction || !lunariMixer) return;
    if (currentAction === randomAction) return;
    if (baseAction && randomAction) {
        baseAction.fadeOut(0.5); randomAction.reset().fadeIn(0.5).play(); currentAction = randomAction;
        const onFinished = (event) => {
            if (event.action === randomAction) {
                randomAction.fadeOut(0.5); baseAction.reset().fadeIn(0.5).play();
                currentAction = baseAction; lunariMixer.removeEventListener('finished', onFinished);
            }
        };
        lunariMixer.addEventListener('finished', onFinished);
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
                    let mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(mat => {
                        mat.map = tvTexture; mat.emissive = new THREE.Color(0xffffff);
                        mat.emissiveMap = tvTexture; mat.emissiveIntensity = 1.0; mat.needsUpdate = true;
                    });
                }
            });
        }
        if (categoryKey === 'foco') {
            focoMesh = model; const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3(); box.getCenter(center);
            mainLight.position.copy(center); mainLight.position.y -= 0.2;
        }
        if (categoryKey === 'interruptor') switchMesh = model;

        scene.add(model); loadedSlotMeshes[categoryKey] = model;
        if(isInitialLoad) checkLoading();
    }, undefined, (e) => { if(isInitialLoad) checkLoading(); });
}

for (let cat in inventoryData) {
    if (inventoryData[cat].type === 'multiple') continue;
    let equippedItemId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[equippedItemId]) {
        let itemData = inventoryData[cat].items[equippedItemId];
        if (itemData.file) loadItemForSlot(cat, itemData.file, true);
        if (cat === 'foco' && itemData.baseFile) loadItemForSlot('base_foco', itemData.baseFile, true);
        if (cat === 'tele' && itemData.baseFile) loadItemForSlot('pantalla_tv', itemData.baseFile, true);
    }
}

// --- CLIMA NINJA ---
(async function setupWeatherVideo() {
    const video = document.createElement('video');
    video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    let videoFile = 'dia_soleado.mp4'; let weatherEmoji = "☀️"; let weatherName = "Clima estándar"; let temperature = "--";
    const statusBox = document.getElementById('weather-status');

    try {
        let lat = -12.0464, lon = -77.0428;
        try {
            const ipResponse = await fetch('https://ipapi.co/json/');
            const ipData = await ipResponse.json();
            if(ipData.latitude && ipData.longitude) { lat = ipData.latitude; lon = ipData.longitude; }
        } catch(ipError) { }

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        
        const code = data.current_weather.weathercode; const isDay = data.current_weather.is_day;
        esDeDiaLocal = (isDay === 1); actualizarIluminacionFocoDia(); temperature = data.current_weather.temperature;

        if (code === 0) { weatherName = isDay ? "Despejado" : "Noche despejada"; weatherEmoji = isDay ? "☀️" : "🌙"; videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; } 
        else if (code <= 2) { weatherName = isDay ? "Parcialmente nublado" : "Noche nublada"; weatherEmoji = isDay ? "⛅" : "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; } 
        else if (code === 3) { weatherName = "Muy nublado"; weatherEmoji = "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; } 
        else if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) { weatherName = "Lluvia"; weatherEmoji = "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; } 
        else { weatherName = "Clima detectado"; videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; }
    } catch (error) { weatherEmoji = "❌"; weatherName = "Clima offline"; }

    statusBox.innerHTML = temperature !== "--" ? `${weatherEmoji} ${weatherName} | ${temperature}°C` : `${weatherEmoji} ${weatherName}`;
    video.src = videoFile; video.play().catch(e => {});
    
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter; videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat; videoTexture.encoding = THREE.sRGBEncoding;
    
    loader.load(getFreshUrl('cuadro.glb'), (gltf) => {
        const cuadroModel = gltf.scene;
        cuadroModel.traverse((node) => {
            if (node.isMesh) {
                let mats = Array.isArray(node.material) ? node.material : [node.material];
                mats.forEach(mat => {
                    mat.map = videoTexture; mat.emissive = new THREE.Color(0xffffff);
                    mat.emissiveMap = videoTexture; mat.emissiveIntensity = 1.0; mat.needsUpdate = true;
                });
            }
        });
        applyMaterialLogic(cuadroModel, 'cuadro'); scene.add(cuadroModel);
        loadedSlotMeshes['cuadro'] = cuadroModel; checkLoading();
    }, undefined, (e) => checkLoading());
})();

// --- SISTEMA DE ILUMINACIÓN Y AJUSTES APLICADOS ---
function updateLighting() {
    if (lightOn) {
        mainLight.visible = true;
        ambient.intensity = gameSettings.shadows ? 0.3 : 0.6; // Sin sombras iluminamos más con ambiente
        hemiLight.intensity = gameSettings.shadows ? 0.4 : 0.6;
        document.getElementById('light-status').innerText = '💡 Luz encendida';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 1.5; });
    } else {
        mainLight.visible = false; ambient.intensity = 0.02; hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 0; });
    }
}

// APLICA LA CONFIGURACIÓN DEL MODAL FREE FIRE
function applySettings() {
    // Resolución
    let dpr = 1;
    if (gameSettings.resolution === 'low') dpr = 0.75;
    else if (gameSettings.resolution === 'normal') dpr = 1;
    else dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);

    // Sombras
    renderer.shadowMap.enabled = gameSettings.shadows;
    mainLight.castShadow = gameSettings.shadows;
    if(luzFocoDia) luzFocoDia.castShadow = gameSettings.shadows;
    
    // Recorrer modelos para sombras
    for (let cat in loadedSlotMeshes) applyMaterialLogic(loadedSlotMeshes[cat], cat);
    if(focoDiaMesh) applyMaterialLogic(focoDiaMesh, 'foco_dia');

    // Sonido
    tvVideo.volume = gameSettings.mute ? 0 : gameSettings.volume;
    tvVideo.muted = gameSettings.mute;

    // UI
    document.getElementById('fps-counter').style.display = gameSettings.showFps ? 'block' : 'none';

    updateLighting();
}

const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
function toggleLight() {
    lightOn = !lightOn; localStorage.setItem('lightState', lightOn ? 'on' : 'off'); updateLighting();
}

function openPosterPreview(categoryKey) {
    const equippedId = inventoryData[categoryKey].equipped;
    const itemData = inventoryData[categoryKey].items[equippedId];
    if (itemData && itemData.preview) {
        document.getElementById('poster-enlarged-image').src = itemData.preview;
        document.getElementById('poster-view-modal').classList.add('visible');
    }
}

document.getElementById('close-poster-view').onclick = () => document.getElementById('poster-view-modal').classList.remove('visible');

function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;
    mouse.x = ((x - rect.left) / rect.width) * 2 - 1; mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) { toggleLight(); return; }

    const pantallaMesh = loadedSlotMeshes['pantalla_tv'];
    if (pantallaMesh && raycaster.intersectObject(pantallaMesh, true).length > 0) {
        const tvControls = document.getElementById('tv-controls');
        if (tvControls.style.display === 'none' || tvControls.style.display === '') {
            tvControls.style.display = 'flex';
            if (tvVideo.paused) tvVideo.play().catch(e => {});
        } else tvControls.style.display = 'none';
        return;
    }

    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const posterMesh = loadedSlotMeshes[cat];
        if (posterMesh && raycaster.intersectObject(posterMesh, true).length > 0) { openPosterPreview(cat); break; }
    }
}
renderer.domElement.addEventListener('click', handleInteraction);
renderer.domElement.addEventListener('touchstart', (e) => { 
    if(document.getElementById('inventory-modal').classList.contains('visible') || document.getElementById('ff-settings-modal').classList.contains('visible')) return;
    handleInteraction(e); 
}, {passive: true});

// --- LÓGICA DE INTERFAZ DEL INVENTARIO ---
let currentCategory = 'cama', openGroup = 'muebles';
function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar'), content = document.getElementById('inv-content');
    sidebar.innerHTML = ''; content.innerHTML = '';
    
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

    const catData = inventoryData[currentCategory]; if (!catData) return;
    for (let itemId in catData.items) {
        const item = catData.items[itemId];
        let isEquipped = catData.type === 'multiple' ? catData.equipped.includes(itemId) : catData.equipped === itemId;
        const card = document.createElement('div'); card.className = 'item-card';
        const previewDiv = document.createElement('div'); previewDiv.className = 'item-preview';
        if (item.preview) {
            const img = document.createElement('img'); img.src = item.preview; img.alt = item.name;
            img.onerror = () => { previewDiv.innerHTML = `<span>${catData.emoji}</span>`; };
            previewDiv.appendChild(img);
        } else previewDiv.innerHTML = `<span>${catData.emoji}</span>`;
        
        let btnHTML = item.owned 
            ? (isEquipped ? `<button class="item-btn btn-equipped" onclick="equipItem('${currentCategory}', '${itemId}')">${catData.type === 'multiple' ? 'Quitar ✓' : 'Equipado ✓'}</button>` : `<button class="item-btn btn-equip" onclick="equipItem('${currentCategory}', '${itemId}')">Equipar</button>`)
            : `<button class="item-btn btn-buy" onclick="buyItem('${currentCategory}', '${itemId}')">Comprar 🪙${item.price}</button>`;

        card.innerHTML = `<div>${previewDiv.outerHTML}<h4>${item.name}</h4><div class="item-price">${item.owned ? 'Adquirido' : `🪙 ${item.price}`}</div></div>${btnHTML}`;
        content.appendChild(card);
    }
}

window.equipItem = function(category, itemId) {
    const catData = inventoryData[category];
    if (catData.type === 'multiple') {
        const idx = catData.equipped.indexOf(itemId);
        if (idx > -1) catData.equipped.splice(idx, 1); else catData.equipped.push(itemId);
        updatePlaylist(); 
    } else {
        catData.equipped = itemId; const itemData = catData.items[itemId];
        loadItemForSlot(category, itemData.file, false);
        if (itemData.baseFile) {
            if(category === 'foco') loadItemForSlot('base_foco', itemData.baseFile, false);
            if(category === 'tele') loadItemForSlot('pantalla_tv', itemData.baseFile, false);
        }
    }
    saveGame(); renderInventory(); 
};

window.buyItem = function(category, itemId) {
    let item = inventoryData[category].items[itemId];
    if (playerCoins >= item.price) { playerCoins -= item.price; item.owned = true; saveGame(); renderInventory(); } 
    else alert("No tienes suficientes monedas.");
};

// Eventos UI Generales
document.getElementById('inventory-button').onclick = () => { document.getElementById('inventory-modal').classList.add('visible'); renderInventory(); };
document.getElementById('close-inv').onclick = () => document.getElementById('inventory-modal').classList.remove('visible');

// --- EVENTOS DEL NUEVO MENÚ DE AJUSTES ---
const settingsModal = document.getElementById('ff-settings-modal');
document.getElementById('settings-button').onclick = () => {
    // Sincronizar UI con el estado actual
    document.getElementById('set-resolution').value = gameSettings.resolution;
    document.getElementById('set-shadows').checked = gameSettings.shadows;
    document.getElementById('set-fps').value = gameSettings.fps;
    document.getElementById('set-volume').value = gameSettings.volume;
    document.getElementById('set-mute').checked = gameSettings.mute;
    document.getElementById('set-showfps').checked = gameSettings.showFps;
    settingsModal.classList.add('visible');
};
document.getElementById('close-ff-settings').onclick = () => settingsModal.classList.remove('visible');

// Pestañas
document.querySelectorAll('.ff-tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll('.ff-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ff-tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    };
});

// Guardar al cambiar opciones
document.getElementById('set-resolution').onchange = (e) => { gameSettings.resolution = e.target.value; saveSettings(); };
document.getElementById('set-shadows').onchange = (e) => { gameSettings.shadows = e.target.checked; saveSettings(); };
document.getElementById('set-fps').onchange = (e) => { gameSettings.fps = parseInt(e.target.value); saveSettings(); };
document.getElementById('set-volume').oninput = (e) => { gameSettings.volume = parseFloat(e.target.value); saveSettings(); };
document.getElementById('set-mute').onchange = (e) => { gameSettings.mute = e.target.checked; saveSettings(); };
document.getElementById('set-showfps').onchange = (e) => { gameSettings.showFps = e.target.checked; saveSettings(); };

document.getElementById('btn-reset-settings').onclick = () => {
    if(confirm('¿Restaurar todos los ajustes gráficos y de sonido a los valores recomendados de fábrica?')) {
        gameSettings = { ...defaultSettings };
        saveSettings(); settingsModal.classList.remove('visible');
    }
};

// --- BUCLE DE ANIMACIÓN Y LÍMITE DE FPS ---
let then = performance.now();
let frames = 0, lastFpsTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    
    const now = performance.now();
    const elapsed = now - then;
    const fpsInterval = 1000 / gameSettings.fps;

    // Si ha pasado el tiempo necesario según los FPS objetivo, renderizamos
    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval); // Ajuste preciso
        
        const delta = clock.getDelta();
        if (lunariMixer) lunariMixer.update(delta);
        controls.update();
        renderer.render(scene, camera); 

        // Cálculo de FPS UI
        if(gameSettings.showFps) {
            frames++;
            if (now - lastFpsTime >= 1000) {
                document.querySelector('#fps-counter span').innerText = frames;
                frames = 0; lastFpsTime = now;
            }
        }
    }
}
applySettings(); // Aplicar al inicio
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});