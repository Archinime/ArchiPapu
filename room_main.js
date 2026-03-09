import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { defaultInventoryConfig, inventoryGroups } from './inventory-data.js';

// --- SISTEMA DE DATOS E INVENTARIO ---
let playerCoins = parseInt(localStorage.getItem('room_coins')) || 1000;
document.getElementById('coin-amount').innerText = playerCoins;

let inventoryData = JSON.parse(localStorage.getItem('room_inventory')) || defaultInventoryConfig;
if (inventoryData.base_foco) delete inventoryData.base_foco;

for (let cat in defaultInventoryConfig) {
    if(!inventoryData[cat]) inventoryData[cat] = defaultInventoryConfig[cat];
    inventoryData[cat].emoji = defaultInventoryConfig[cat].emoji;
    inventoryData[cat].label = defaultInventoryConfig[cat].label;
    if (!inventoryData[cat].items[inventoryData[cat].equipped]) {
        inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
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
let switchMesh = null;
let focoMesh = null;
let focoDiaMesh = null;
let luzFocoDia = null;

// --- Detección de dispositivo ---
const ua = navigator.userAgent;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
const width = window.innerWidth;
let deviceType = (width < 768 || (isMobileUA && width < 1024)) ? 'mobile' : (width >= 768 && width <= 1024) ? 'tablet' : 'desktop';

// --- Escena, Cámara y Reloj ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);
const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200);
let camPosY = 6, camPosZ = 14, targetY = 6;
if (deviceType === 'mobile') { camPosY = 6; camPosZ = 12; targetY = 5; }
camera.position.set(0, camPosY, camPosZ);

// --- RENDERIZADOR ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.0;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, targetY, 0);
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 2.5; controls.maxDistance = 16;
controls.enablePan = false;

// --- LUCES ---
const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); 
scene.add(hemiLight);

const mainLight = new THREE.SpotLight(0xffeedd, 6);
mainLight.position.set(2, 22, 2);
mainLight.angle = Math.PI / 3; mainLight.penumbra = 0.8; mainLight.decay = 2; mainLight.distance = 60;
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
scene.add(mainLight); scene.add(mainLight.target);

let lightOn = localStorage.getItem('lightState') !== 'off';
const perfCheck = document.getElementById('performance-mode');
perfCheck.checked = localStorage.getItem('performanceMode') === 'true';

// --- LÓGICA DE ILUMINACIÓN DINÁMICA (FOCO_DIA) ---
function actualizarIluminacionFocoDia() {
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
    }
    if (focoDiaMesh) {
        focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material && n.name !== "VideoMesh") { // Evitamos tocar el video aquí
                n.material.emissive.setHex(colorHex);
                n.material.emissiveIntensity = emInt;
            }
        });
    }
}
setInterval(actualizarIluminacionFocoDia, 60000);

function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isLow = perfCheck.checked;
    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            // Si es el video, forzamos material básico (Unlit) para que brille siempre
            if (node.name === "VideoMesh" || categoryKey === 'cuadro') {
                node.castShadow = false; node.receiveShadow = false;
                return; // La lógica de textura de video está en setupWeatherVideo
            }
            if (categoryKey === 'foco' || categoryKey === 'foco_dia') {
                node.castShadow = false; node.receiveShadow = false;
                if (node.material && categoryKey === 'foco') {
                    node.material.emissive = new THREE.Color(0xffeedd);
                    node.material.emissiveIntensity = lightOn ? 1.5 : 0;
                }
            } else {
                node.castShadow = !isLow; node.receiveShadow = !isLow;
                if(node.material) {
                    node.material.side = THREE.DoubleSide;
                }
            }
        }
    });
}

// --- CARGA DE MODELOS ---
let totalModelsToLoad = 0; let modelsLoaded = 0;
for (let cat in inventoryData) {
    let equippedId = inventoryData[cat].equipped;
    if (inventoryData[cat].items[equippedId]?.file) totalModelsToLoad++;
    if (cat === 'foco' && inventoryData[cat].items[equippedId]?.baseFile) totalModelsToLoad++;
}
totalModelsToLoad += 4; // Lunari(2), Cuadro, FocoDia

function checkLoading() {
    modelsLoaded++;
    const loadingEl = document.getElementById('loading');
    if(loadingEl) {
        loadingEl.innerText = `Cargando: ${modelsLoaded}/${totalModelsToLoad}`;
        if (modelsLoaded >= totalModelsToLoad) loadingEl.style.display = 'none';
    }
}

const loader = new GLTFLoader();
let lunariMixer = null;
let baseAction = null, randomAction = null, currentAction = null;

loader.load('lunari_durmiendo1.glb', (gltf) => {
    scene.add(gltf.scene);
    applyMaterialLogic(gltf.scene, 'lunari');
    if (gltf.animations.length > 0) {
        lunariMixer = new THREE.AnimationMixer(gltf.scene);
        baseAction = lunariMixer.clipAction(gltf.animations[0]);
        baseAction.play(); currentAction = baseAction;
    }
    checkLoading();
});

loader.load('Lunari_Duerme_2.glb', (gltf) => {
    if (gltf.animations.length > 0 && lunariMixer) {
        randomAction = lunariMixer.clipAction(gltf.animations[0]);
        randomAction.loop = THREE.LoopOnce; randomAction.clampWhenFinished = true;
    }
    checkLoading();
});

loader.load('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb', (gltf) => {
    focoDiaMesh = gltf.scene;
    applyMaterialLogic(focoDiaMesh, 'foco_dia');
    luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(focoDiaMesh);
    const center = new THREE.Vector3(); box.getCenter(center);
    luzFocoDia.position.copy(center).y -= 0.2;
    luzFocoDia.castShadow = true;
    scene.add(luzFocoDia); scene.add(focoDiaMesh);
    actualizarIluminacionFocoDia();
    checkLoading();
});

// --- SISTEMA DEL CUADRO (VIDEO AUTO-ILUMINADO) ---
(async function setupWeatherVideo() {
    const video = document.createElement('video');
    video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    
    let videoFile = 'dia_soleado.mp4'; 
    const statusBox = document.getElementById('weather-status');

    try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
        const data = await res.json();
        const code = data.current_weather.weathercode;
        const isDay = data.current_weather.is_day === 1;
        
        // Mapeo simple de video para ejemplo
        if (code === 0) videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4';
        else videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4';
        
        statusBox.innerHTML = `🌍 ${isDay ? 'Día' : 'Noche'} | ${data.current_weather.temperature}°C`;
    } catch (e) { console.warn('Clima offline'); }

    video.src = videoFile; video.play().catch(() => {});

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.encoding = THREE.sRGBEncoding;
    
    loader.load('cuadro.glb', (gltf) => {
        const cuadroModel = gltf.scene;
        cuadroModel.traverse((node) => {
            if (node.isMesh) {
                node.name = "VideoMesh";
                // IMPORTANTE: Usamos MeshBasicMaterial para que el video ignore las luces y brille por sí mismo
                node.material = new THREE.MeshBasicMaterial({ map: videoTexture });
            }
        });
        scene.add(cuadroModel);
        loadedSlotMeshes['cuadro'] = cuadroModel;
        checkLoading();
    });
})();

function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
    if (!itemFile) return;
    if (loadedSlotMeshes[categoryKey]) scene.remove(loadedSlotMeshes[categoryKey]);
    loader.load(itemFile, (gltf) => {
        const model = gltf.scene;
        applyMaterialLogic(model, categoryKey);
        if (categoryKey === 'foco') {
            focoMesh = model;
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3(); box.getCenter(center);
            mainLight.position.copy(center).y -= 0.2;
        }
        if (categoryKey === 'interruptor') switchMesh = model;
        scene.add(model);
        loadedSlotMeshes[categoryKey] = model;
        if(isInitialLoad) checkLoading();
    });
}

for (let cat in inventoryData) {
    let id = inventoryData[cat].equipped;
    if (inventoryData[cat].items[id]?.file) loadItemForSlot(cat, inventoryData[cat].items[id].file, true);
    if (cat === 'foco' && inventoryData[cat].items[id]?.baseFile) loadItemForSlot('base_foco', inventoryData[cat].items[id].baseFile, true);
}

// --- INTERACCIÓN ---
function updateLighting() {
    const isLow = perfCheck.checked;
    if (lightOn) {
        mainLight.visible = true;
        ambient.intensity = isLow ? 0.8 : 0.3;
        hemiLight.intensity = isLow ? 0.8 : 0.4;
        document.getElementById('light-status').innerText = '💡 Luz encendida';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 1.5; });
    } else {
        mainLight.visible = false;
        ambient.intensity = 0.02; hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 0; });
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;
    mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) {
        lightOn = !lightOn;
        localStorage.setItem('lightState', lightOn ? 'on' : 'off');
        updateLighting();
        return;
    }

    ['poster_1', 'poster_2', 'poster_3', 'poster_4'].forEach(cat => {
        if (loadedSlotMeshes[cat] && raycaster.intersectObject(loadedSlotMeshes[cat], true).length > 0) {
            const item = inventoryData[cat].items[inventoryData[cat].equipped];
            if (item?.preview) {
                document.getElementById('poster-enlarged-image').src = item.preview;
                document.getElementById('poster-view-modal').classList.add('visible');
            }
        }
    });
}

renderer.domElement.addEventListener('click', handleInteraction);
document.getElementById('close-poster-view').onclick = () => document.getElementById('poster-view-modal').classList.remove('visible');

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (lunariMixer) lunariMixer.update(delta);
    controls.update();
    renderer.render(scene, camera); 
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Inicializar interfaz y calidad
updateLighting();
perfCheck.addEventListener('change', () => {
    renderer.shadowMap.enabled = !perfCheck.checked;
    updateLighting();
    localStorage.setItem('performanceMode', perfCheck.checked);
});

// --- LÓGICA DE TIENDA (Simplificada) ---
document.getElementById('inventory-button').onclick = () => {
    document.getElementById('inventory-modal').classList.add('visible');
    renderInventory();
};
document.getElementById('close-inv').onclick = () => document.getElementById('inventory-modal').classList.remove('visible');

function renderInventory() {
    // Reutiliza tu lógica de renderInventory del archivo original
    // (Asegúrate de que este bloque se mantenga igual que en tu sw.js o versiones previas)
}

function buyItem(category, itemId) {
    let item = inventoryData[category].items[itemId];
    if (playerCoins >= item.price) {
        playerCoins -= item.price; item.owned = true;
        saveGame(); renderInventory();
    } else alert("No tienes suficientes monedas.");
}

function equipItem(category, itemId) {
    inventoryData[category].equipped = itemId;
    saveGame(); renderInventory();
    loadItemForSlot(category, inventoryData[category].items[itemId].file);
}