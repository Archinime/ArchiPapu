import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { defaultInventoryConfig, inventoryGroups } from './inventory-data.js';

// --- NUEVO: SISTEMA ANTI-CACHÉ ROBUSTO ---
function getFreshUrl(url) {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    // Esto asegura que cada carga traiga el archivo directamente del servidor
    return `${url}${separator}nocache=${Date.now()}`; 
}

// --- UTILIDAD DE LIMPIEZA DE MEMORIA (EVITA LAG Y FUGAS) ---
function disposeThreeJSObject(node) {
    if (!node) return;
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
        if (Array.isArray(node.material)) {
            node.material.forEach(mat => {
                if(mat.map) mat.map.dispose();
                mat.dispose();
            });
        } else {
            if(node.material.map) node.material.map.dispose();
            node.material.dispose();
        }
    }
    if (node.children) {
        node.children.forEach(child => disposeThreeJSObject(child));
    }
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
        if (!Array.isArray(inventoryData[cat].equipped)) {
            inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
        }
    } else {
        if (!inventoryData[cat].items[inventoryData[cat].equipped]) {
            inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
        }
    }

    for(let item in defaultInventoryConfig[cat].items) {
        if(!inventoryData[cat].items[item]) {
            inventoryData[cat].items[item] = defaultInventoryConfig[cat].items[item];
        } else {
            inventoryData[cat].items[item].file = defaultInventoryConfig[cat].items[item].file;
            inventoryData[cat].items[item].name = defaultInventoryConfig[cat].items[item].name;
            if(defaultInventoryConfig[cat].items[item].baseFile) {
                inventoryData[cat].items[item].baseFile = defaultInventoryConfig[cat].items[item].baseFile;
            }
            if(defaultInventoryConfig[cat].items[item].preview) {
                inventoryData[cat].items[item].preview = defaultInventoryConfig[cat].items[item].preview;
            }
        }
    }
}

function saveGame() {
    localStorage.setItem('room_coins', playerCoins);
    localStorage.setItem('room_inventory', JSON.stringify(inventoryData));
    document.getElementById('coin-amount').innerText = playerCoins;
}

const loadedSlotMeshes = {};
let switchMesh = null;
let focoMesh = null;
let focoDiaMesh = null;
let luzFocoDia = null;
let esDeDiaLocal = true;

const ua = navigator.userAgent;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
const width = window.innerWidth;
let deviceType = (width < 768 || (isMobileUA && width < 1024)) ? 'mobile' : (width >= 768 && width <= 1024) ? 'tablet' : 'desktop';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);
const clock = new THREE.Clock();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200);
let camPosY = 6, camPosZ = 14, targetY = 6;
if (deviceType === 'mobile') { camPosY = 6; camPosZ = 12; targetY = 5; }
camera.position.set(0, camPosY, camPosZ);

const renderer = new THREE.WebGLRenderer({ 
    antialias: !isMobileUA, 
    powerPreference: "high-performance" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.0;
renderer.setPixelRatio(isMobileUA ? 1 : Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, targetY, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 2.5; controls.maxDistance = 16;
controls.enablePan = false;

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); 
hemiLight.position.set(0, 20, 0); 
scene.add(hemiLight);

const mainLight = new THREE.SpotLight(0xffeedd, 6);
mainLight.position.set(2, 22, 2);
mainLight.angle = Math.PI / 3; mainLight.penumbra = 0.8; mainLight.decay = 2; mainLight.distance = 60;
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(isMobileUA ? 1024 : 2048, isMobileUA ? 1024 : 2048); 
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 40; 
mainLight.shadow.bias = -0.002;
mainLight.shadow.normalBias = 0.05; 
mainLight.shadow.radius = 4; 
scene.add(mainLight); scene.add(mainLight.target);

let lightOn = localStorage.getItem('lightState') !== 'off';
const perfCheck = document.getElementById('performance-mode');
perfCheck.checked = localStorage.getItem('performanceMode') === 'true';

function actualizarIluminacionFocoDia() {
    const hora = new Date().getHours();
    let colorHex, lightInt, emInt, dist;

    if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8; dist = 35; } 
    else if (hora >= 9 && hora < 17) { colorHex = 0xffffff; lightInt = 1.5; emInt = 1.5; dist = 50; } 
    else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00; lightInt = 0.7; emInt = 0.7; dist = 40; } 
    else { colorHex = 0x5566aa; lightInt = 0.25; emInt = 0.25; dist = 25; }

    if (luzFocoDia) { luzFocoDia.color.setHex(colorHex); luzFocoDia.intensity = lightInt; luzFocoDia.distance = dist; }
    
    if (focoDiaMesh) {
        focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material) {
                n.material.emissive.setHex(colorHex);
                n.material.emissiveIntensity = emInt;
                n.material.needsUpdate = true;
            }
        });
    }
}
setInterval(actualizarIluminacionFocoDia, 60000);

function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isLow = perfCheck.checked;
    const isFoco = categoryKey === 'foco';
    const isFocoDia = categoryKey === 'foco_dia';

    model.traverse((node) => {
        if (node.isMesh) {
            // OPTIMIZACIÓN EXTREMA: Ahora el motor no renderiza lo que está a espaldas de la cámara.
            node.frustumCulled = true; 
            
            if (isFoco || isFocoDia) {
                node.castShadow = false; node.receiveShadow = false;
                if (node.material) {
                    if (isFoco) {
                        node.material.emissive = new THREE.Color(0xffeedd);
                        node.material.emissiveIntensity = lightOn ? 1.5 : 0;
                    }
                    if (isFocoDia) { node.material.emissive = new THREE.Color(0xffffff); }
                }
            } else {
                node.castShadow = !isLow; node.receiveShadow = !isLow;
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

const tvVideo = document.getElementById('tv-video');
const tvTexture = new THREE.VideoTexture(tvVideo);
tvTexture.minFilter = THREE.LinearFilter;
tvTexture.magFilter = THREE.LinearFilter;
tvTexture.format = THREE.RGBAFormat;
tvTexture.encoding = THREE.sRGBEncoding;

let tvPlaylist = [];
let currentTvIndex = -1;
function updatePlaylist() {
    tvPlaylist = inventoryData.videos.equipped.map(id => inventoryData.videos.items[id].file);
    if(tvPlaylist.length === 0) tvVideo.pause();
}

function playNextTv(random = false) {
    updatePlaylist();
    if(tvPlaylist.length === 0) return;
    if(random) { currentTvIndex = Math.floor(Math.random() * tvPlaylist.length); } 
    else { currentTvIndex = (currentTvIndex + 1) % tvPlaylist.length; }
    
    tvVideo.src = getFreshUrl(tvPlaylist[currentTvIndex]); // Se asegura la carga fresca
    tvVideo.play().catch(e => console.warn('Requiere interacción de usuario primero', e));
}

tvVideo.addEventListener('ended', () => playNextTv(false));
document.getElementById('tv-prev').onclick = () => {
    updatePlaylist();
    if(tvPlaylist.length === 0) return;
    currentTvIndex = (currentTvIndex - 1 + tvPlaylist.length) % tvPlaylist.length;
    tvVideo.src = getFreshUrl(tvPlaylist[currentTvIndex]);
    tvVideo.play();
};
document.getElementById('tv-next').onclick = () => playNextTv(false);
document.getElementById('tv-play-pause').onclick = () => {
    if(tvVideo.paused) tvVideo.play(); else tvVideo.pause();
};
playNextTv(true);

let totalModelsToLoad = 0;
let modelsLoaded = 0;
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
totalModelsToLoad += 4;

function checkLoading() {
    modelsLoaded++;
    const loadingEl = document.getElementById('loading');
    if(loadingEl) {
        loadingEl.innerText = `Cargando: ${modelsLoaded}/${totalModelsToLoad}`;
        if (modelsLoaded >= totalModelsToLoad) { loadingEl.style.display = 'none'; }
    }
}
if(totalModelsToLoad === 0 && document.getElementById('loading')) { document.getElementById('loading').style.display = 'none'; }

const loader = new GLTFLoader();
let lunariMixer = null; let baseAction = null; let randomAction = null; let currentAction = null;

loader.load(getFreshUrl('lunari_durmiendo1.glb'), (gltf) => {
    const lunariModel = gltf.scene;
    applyMaterialLogic(lunariModel, 'lunari');
    scene.add(lunariModel);

    if (gltf.animations && gltf.animations.length > 0) {
        lunariMixer = new THREE.AnimationMixer(lunariModel);
        baseAction = lunariMixer.clipAction(gltf.animations[0]);
        baseAction.play();
        currentAction = baseAction;
    }
    checkLoading();
}, undefined, (e) => { console.error('Error cargando a Lunari:', e); checkLoading(); });

loader.load(getFreshUrl('Lunari_Duerme_2.glb'), (gltf) => {
    if (gltf.animations && gltf.animations.length > 0 && lunariMixer) {
        const clip = gltf.animations[0];
        randomAction = lunariMixer.clipAction(clip);
        randomAction.loop = THREE.LoopOnce;
        randomAction.clampWhenFinished = true;
    }
    checkLoading();
}, undefined, (e) => { console.error('Error cargando animación aleatoria:', e); checkLoading(); });

loader.load(getFreshUrl('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb'), (gltf) => {
    focoDiaMesh = gltf.scene;
    applyMaterialLogic(focoDiaMesh, 'foco_dia'); 
    luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(focoDiaMesh);
    const center = new THREE.Vector3(); box.getCenter(center);
    luzFocoDia.position.copy(center); luzFocoDia.position.y -= 0.2;
    luzFocoDia.castShadow = true; luzFocoDia.shadow.mapSize.set(1024, 1024);
    luzFocoDia.shadow.bias = -0.005; luzFocoDia.shadow.normalBias = 0.1;
    scene.add(luzFocoDia); scene.add(focoDiaMesh);
    focoDiaMesh.visible = false; luzFocoDia.visible = true; 
    actualizarIluminacionFocoDia(); checkLoading();
}, undefined, (e) => { console.error('Error cargando foco de dia:', e); checkLoading(); });

setInterval(() => {
    if (!randomAction || !baseAction || !lunariMixer) return;
    if (currentAction === randomAction) return;

    if (baseAction && randomAction) {
        baseAction.fadeOut(0.5); randomAction.reset().fadeIn(0.5).play(); currentAction = randomAction;
        const onFinished = (event) => {
            if (event.action === randomAction) {
                randomAction.fadeOut(0.5); baseAction.reset().fadeIn(0.5).play(); currentAction = baseAction;
                lunariMixer.removeEventListener('finished', onFinished);
            }
        };
        lunariMixer.addEventListener('finished', onFinished);
    }
}, 60000);

function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
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
                    if (Array.isArray(node.material)) {
                        node.material.forEach(mat => {
                            mat.map = tvTexture; mat.emissive = new THREE.Color(0xffffff);
                            mat.emissiveMap = tvTexture; mat.emissiveIntensity = 1.0; mat.needsUpdate = true;
                        });
                    } else {
                        node.material.map = tvTexture; node.material.emissive = new THREE.Color(0xffffff);
                        node.material.emissiveMap = tvTexture; node.material.emissiveIntensity = 1.0; node.material.needsUpdate = true;
                    }
                }
            });
        }

        if (categoryKey === 'foco') {
            focoMesh = model;
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3(); box.getCenter(center);
            mainLight.position.copy(center); mainLight.position.y -= 0.2;
        }

        if (categoryKey === 'interruptor') switchMesh = model;
        scene.add(model); loadedSlotMeshes[categoryKey] = model;
        if(isInitialLoad) checkLoading();
    }, undefined, (e) => { 
        console.error(`Error cargando modelo [${categoryKey}]:`, itemFile);
        if(isInitialLoad) checkLoading();
    });
}

for (let cat in inventoryData) {
    if (inventoryData[cat].type === 'multiple') continue;
    let equippedItemId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[equippedItemId]) {
        let itemData = inventoryData[cat].items[equippedItemId];
        if (itemData.file) { loadItemForSlot(cat, itemData.file, true); }
        if (cat === 'foco' && itemData.baseFile) { loadItemForSlot('base_foco', itemData.baseFile, true); }
        if (cat === 'tele' && itemData.baseFile) { loadItemForSlot('pantalla_tv', itemData.baseFile, true); }
    }
}

(async function setupWeatherVideo() {
    const video = document.createElement('video');
    video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    
    let videoFile = 'dia_soleado.mp4'; 
    let weatherEmoji = "☀️"; let weatherName = "Clima estándar"; let temperature = "--";
    const statusBox = document.getElementById('weather-status');

    try {
        let lat, lon;
        try {
            const ipResponse = await fetch('https://ipapi.co/json/');
            const ipData = await ipResponse.json();
            if(ipData.latitude && ipData.longitude) { lat = ipData.latitude; lon = ipData.longitude; } 
            else throw new Error("Fallback a Lima");
        } catch(ipError) { lat = -12.0464; lon = -77.0428; }

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        
        const code = data.current_weather.weathercode; const isDay = data.current_weather.is_day;
        esDeDiaLocal = (isDay === 1); actualizarIluminacionFocoDia(); temperature = data.current_weather.temperature;

        if (code === 0) { weatherName = isDay ? "Despejado" : "Noche despejada"; weatherEmoji = isDay ? "☀️" : "🌙"; videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; } 
        else if (code === 1 || code === 2) { weatherName = isDay ? "Parcialmente nublado" : "Noche algo nublada"; weatherEmoji = isDay ? "⛅" : "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; } 
        else if (code === 3) { weatherName = "Muy nublado"; weatherEmoji = "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; } 
        else if (code === 45 || code === 48) { weatherName = "Niebla"; weatherEmoji = "🌫️"; videoFile = isDay ? 'dia_niebla.mp4' : 'noche_niebla.mp4'; } 
        else if ([51, 53, 55, 56, 57].includes(code)) { weatherName = "Llovizna"; weatherEmoji = isDay ? "🌦️" : "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; } 
        else if ([61, 63, 65, 66, 67].includes(code)) { weatherName = "Lluvia"; weatherEmoji = "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; } 
        else if ([71, 73, 75, 77].includes(code)) { weatherName = "Nieve"; weatherEmoji = "❄️"; videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4'; } 
        else if ([80, 81, 82].includes(code)) { weatherName = "Aguaceros"; weatherEmoji = "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; } 
        else if ([85, 86].includes(code)) { weatherName = "Chubascos de nieve"; weatherEmoji = "🌨️"; videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4'; } 
        else if ([95, 96, 99].includes(code)) { weatherName = "Tormenta"; weatherEmoji = "⛈️"; videoFile = isDay ? 'dia_tormenta.mp4' : 'noche_tormenta.mp4'; } 
        else { weatherName = "Desconocido"; videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; }
    } catch (error) { console.warn('Error clima:', error); weatherEmoji = "❌"; weatherName = "Clima offline"; }

    if (temperature !== "--") { statusBox.innerHTML = `${weatherEmoji} ${weatherName} | ${temperature}°C`; } 
    else { statusBox.innerHTML = `${weatherEmoji} ${weatherName}`; }
    
    video.src = getFreshUrl(videoFile);
    video.play().catch(e => console.log('Autoplay bloqueado:', e));
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter; videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat; videoTexture.encoding = THREE.sRGBEncoding;

    loader.load(getFreshUrl('cuadro.glb'), (gltf) => {
        const cuadroModel = gltf.scene;
        cuadroModel.traverse((node) => {
            if (node.isMesh) {
                if (Array.isArray(node.material)) {
                    node.material.forEach(mat => {
                        mat.map = videoTexture; mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = videoTexture; mat.emissiveIntensity = 1.0; mat.needsUpdate = true;
                    });
                } else if (node.material) {
                    node.material.map = videoTexture; node.material.emissive = new THREE.Color(0xffffff); node.material.emissiveMap = videoTexture; node.material.emissiveIntensity = 1.0; node.material.needsUpdate = true;
                }
            }
        });
        applyMaterialLogic(cuadroModel, 'cuadro'); scene.add(cuadroModel); loadedSlotMeshes['cuadro'] = cuadroModel; checkLoading();
    }, undefined, (e) => { console.error('Error cargando cuadro:', e); checkLoading(); });
})();

function updateLighting() {
    const isLow = perfCheck.checked;
    if (lightOn) {
        mainLight.visible = true; ambient.intensity = isLow ? 0.8 : 0.3; hemiLight.intensity = isLow ? 0.8 : 0.4;
        document.getElementById('light-status').innerText = '💡 Luz encendida';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 1.5; });
    } else {
        mainLight.visible = false; ambient.intensity = 0.02; hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 0; });
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function toggleLight() {
    lightOn = !lightOn; localStorage.setItem('lightState', lightOn ? 'on' : 'off'); updateLighting();
}

const posterViewModal = document.getElementById('poster-view-modal');
const posterEnlargedImage = document.getElementById('poster-enlarged-image');
const closePosterBtn = document.getElementById('close-poster-view');

function openPosterPreview(categoryKey) {
    const equippedId = inventoryData[categoryKey].equipped;
    const itemData = inventoryData[categoryKey].items[equippedId];
    if (itemData && itemData.preview) {
        posterEnlargedImage.src = getFreshUrl(itemData.preview);
        posterViewModal.classList.add('visible');
    }
}

closePosterBtn.onclick = () => posterViewModal.classList.remove('visible');
posterViewModal.onclick = (e) => { if (e.target === posterViewModal) posterViewModal.classList.remove('visible'); };

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
            if (tvVideo.paused) { tvVideo.play().catch(e => console.warn('Requiere interacción', e)); }
        } else { tvControls.style.display = 'none'; }
        return;
    }

    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const posterMesh = loadedSlotMeshes[cat];
        if (posterMesh) {
            const intersects = raycaster.intersectObject(posterMesh, true);
            if (intersects.length > 0) { openPosterPreview(cat); break; }
        }
    }
}

renderer.domElement.addEventListener('click', handleInteraction);
renderer.domElement.addEventListener('touchstart', (e) => { 
    if(document.getElementById('inventory-modal').classList.contains('visible')) return;
    handleInteraction(e); 
}, {passive: true});

function updateQuality() {
    const isLow = perfCheck.checked;
    renderer.shadowMap.enabled = !isLow;
    renderer.setPixelRatio(isLow ? 1 : Math.min(window.devicePixelRatio, 2));
    document.getElementById('quality-indicator').textContent = isLow ? 'Modo Humilde' : 'Calidad Alta';
    for (let cat in loadedSlotMeshes) { applyMaterialLogic(loadedSlotMeshes[cat], cat); }
    if (focoDiaMesh) { actualizarIluminacionFocoDia(); }
    localStorage.setItem('performanceMode', isLow); updateLighting();
}
perfCheck.addEventListener('change', updateQuality);

let currentCategory = 'cama'; let openGroup = 'muebles';

function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar'); const content = document.getElementById('inv-content');
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
        let isEquipped = false;
        if (catData.type === 'multiple') { isEquipped = catData.equipped.includes(itemId); } 
        else { isEquipped = catData.equipped === itemId; }
        
        const card = document.createElement('div'); card.className = 'item-card';
        const previewDiv = document.createElement('div'); previewDiv.className = 'item-preview';
        if (item.preview) {
            const img = document.createElement('img');
            img.src = getFreshUrl(item.preview);
            img.alt = item.name; img.onerror = () => { previewDiv.innerHTML = `<span>${catData.emoji}</span>`; };
            previewDiv.appendChild(img);
        } else { previewDiv.innerHTML = `<span>${catData.emoji}</span>`; }
        
        let btnHTML = '';
        if (item.owned) {
            if (isEquipped) { btnHTML = `<button class="item-btn btn-equipped" onclick="equipItem('${currentCategory}', '${itemId}')">${catData.type === 'multiple' ? 'Quitar ✓' : 'Equipado ✓'}</button>`; } 
            else { btnHTML = `<button class="item-btn btn-equip" onclick="equipItem('${currentCategory}', '${itemId}')">Equipar</button>`; }
        } else { btnHTML = `<button class="item-btn btn-buy" onclick="buyItem('${currentCategory}', '${itemId}')">Comprar 🪙${item.price}</button>`; }

        card.innerHTML = `<div>${previewDiv.outerHTML}<h4>${item.name}</h4><div class="item-price">${item.owned ? 'Adquirido' : `🪙 ${item.price}`}</div></div>${btnHTML}`;
        content.appendChild(card);
    }
}

window.equipItem = function(category, itemId) {
    const catData = inventoryData[category];
    if (catData.type === 'multiple') {
        const idx = catData.equipped.indexOf(itemId);
        if (idx > -1) { catData.equipped.splice(idx, 1); } else { catData.equipped.push(itemId); }
        updatePlaylist(); 
    } else {
        catData.equipped = itemId; const itemData = catData.items[itemId];
        loadItemForSlot(category, itemData.file, false);
        if (category === 'foco' && itemData.baseFile) { loadItemForSlot('base_foco', itemData.baseFile, false); }
        if (category === 'tele' && itemData.baseFile) { loadItemForSlot('pantalla_tv', itemData.baseFile, false); }
    }
    saveGame(); renderInventory(); 
};

window.buyItem = function(category, itemId) {
    let item = inventoryData[category].items[itemId];
    if (playerCoins >= item.price) { playerCoins -= item.price; item.owned = true; saveGame(); renderInventory(); } 
    else { alert("No tienes suficientes monedas."); }
};

document.getElementById('inventory-button').onclick = () => { document.getElementById('inventory-modal').classList.add('visible'); renderInventory(); };
document.getElementById('close-inv').onclick = () => { document.getElementById('inventory-modal').classList.remove('visible'); };
document.getElementById('settings-button').onclick = () => { document.getElementById('settings-panel').classList.toggle('visible'); };

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (lunariMixer) lunariMixer.update(delta);
    controls.update(); renderer.render(scene, camera); 
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
updateQuality();