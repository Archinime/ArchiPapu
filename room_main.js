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

// --- VARIABLES DEL FOCO DE DÍA ---
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

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); 
hemiLight.position.set(0, 20, 0); 
scene.add(hemiLight);

const mainLight = new THREE.SpotLight(0xffeedd, 6);
mainLight.position.set(2, 22, 2);
mainLight.angle = Math.PI / 3; mainLight.penumbra = 0.8; mainLight.decay = 2; mainLight.distance = 60;
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.near = 0.5; mainLight.shadow.camera.far = 40; 
mainLight.shadow.bias = -0.0005; // Ajustado para evitar rayas
mainLight.shadow.normalBias = 0.02; 
scene.add(mainLight); scene.add(mainLight.target);

let lightOn = localStorage.getItem('lightState') !== 'off';
const perfCheck = document.getElementById('performance-mode');
perfCheck.checked = localStorage.getItem('performanceMode') === 'true';

function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isLow = perfCheck.checked;
    const isFoco = (categoryKey === 'foco' || categoryKey === 'foco_dia');

    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            if (isFoco) {
                node.castShadow = false; node.receiveShadow = false;
                if (node.material) {
                    node.material.emissive = new THREE.Color(0xffeedd);
                    // El foco de día siempre tiene emisivo si es de día
                    if(categoryKey === 'foco_dia') {
                        node.material.emissiveIntensity = esDeDiaLocal ? 1.5 : 0;
                    } else {
                        node.material.emissiveIntensity = lightOn ? 1.5 : 0;
                    }
                }
            } else {
                node.castShadow = !isLow; node.receiveShadow = !isLow;
                if(node.material) {
                    node.material.shadowSide = THREE.FrontSide;
                    if(node.name.toLowerCase().includes('pared') || node.name.toLowerCase().includes('piso')) {
                        node.material.shadowSide = THREE.BackSide;
                    }
                    node.material.side = THREE.DoubleSide;
                }
            }
        }
    });
}

let totalModelsToLoad = 0;
let modelsLoaded = 0;

for (let cat in inventoryData) {
    let equippedItemId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[equippedItemId]) {
        let itemData = inventoryData[cat].items[equippedItemId];
        if (itemData.file) totalModelsToLoad++;
        if (cat === 'foco' && itemData.baseFile) totalModelsToLoad++;
    }
}
totalModelsToLoad += 4; // Lunaris(2) + Cuadro + FocoDia

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
});

loader.load('Lunari_Duerme_2.glb', (gltf) => {
    if (gltf.animations && gltf.animations.length > 0 && lunariMixer) {
        randomAction = lunariMixer.clipAction(gltf.animations[0]);
        randomAction.loop = THREE.LoopOnce;
        randomAction.clampWhenFinished = true;
    }
    checkLoading();
});

// --- CARGA FOCO DE DÍA (INDEPENDIENTE) ---
loader.load('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb', (gltf) => {
    focoDiaMesh = gltf.scene;
    applyMaterialLogic(focoDiaMesh, 'foco_dia'); 
    
    // Luz de día: Rango reducido a 25 y sin sombras para evitar rayas con la luz principal
    luzFocoDia = new THREE.PointLight(0xffeedd, 1.5, 25);
    const box = new THREE.Box3().setFromObject(focoDiaMesh);
    const center = new THREE.Vector3(); box.getCenter(center);
    luzFocoDia.position.copy(center);
    luzFocoDia.position.y -= 0.2;
    luzFocoDia.castShadow = false; // Desactivado para evitar conflicto de sombras (rayas)
    
    scene.add(luzFocoDia);
    scene.add(focoDiaMesh);
    
    actualizarEstadoFocoDia();
    checkLoading();
});

function actualizarEstadoFocoDia() {
    if (focoDiaMesh && luzFocoDia) {
        focoDiaMesh.visible = esDeDiaLocal;
        luzFocoDia.visible = esDeDiaLocal;
        focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material) n.material.emissiveIntensity = esDeDiaLocal ? 1.5 : 0;
        });
    }
}

setInterval(() => {
    if (!randomAction || !baseAction || !lunariMixer || currentAction === randomAction) return;
    baseAction.fadeOut(0.5);
    randomAction.reset().fadeIn(0.5).play();
    currentAction = randomAction;
    const onFinished = (event) => {
        if (event.action === randomAction) {
            randomAction.fadeOut(0.5);
            baseAction.reset().fadeIn(0.5).play();
            currentAction = baseAction;
            lunariMixer.removeEventListener('finished', onFinished);
        }
    };
    lunariMixer.addEventListener('finished', onFinished);
}, 60000);

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
            mainLight.position.copy(center); mainLight.position.y -= 0.2; 
        }
        if (categoryKey === 'interruptor') switchMesh = model;
        scene.add(model);
        loadedSlotMeshes[categoryKey] = model; 
        if(isInitialLoad) checkLoading();
    }, undefined, () => { if(isInitialLoad) checkLoading(); });
}

for (let cat in inventoryData) {
    let equippedItemId = inventoryData[cat].equipped;
    let itemData = inventoryData[cat].items[equippedItemId];
    if (itemData && itemData.file) loadItemForSlot(cat, itemData.file, true);
    if (cat === 'foco' && itemData.baseFile) loadItemForSlot('base_foco', itemData.baseFile, true);
}

// --- CLIMA Y VIDEO ---
(async function setupWeatherVideo() {
    const video = document.createElement('video');
    video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    let videoFile = 'dia_soleado.mp4', weatherEmoji = "☀️", weatherName = "Clima estándar", temperature = "--";
    const statusBox = document.getElementById('weather-status');

    try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
        const data = await response.json();
        const isDay = data.current_weather.is_day;
        
        esDeDiaLocal = (isDay === 1);
        actualizarEstadoFocoDia();

        temperature = data.current_weather.temperature;
        const code = data.current_weather.weathercode;
        if (code === 0) { weatherEmoji = isDay ? "☀️" : "🌙"; videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; }
        else if (code <= 3) { weatherEmoji = isDay ? "⛅" : "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; }
        else { weatherEmoji = "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; }
    } catch (e) { console.warn('Clima offline'); }

    statusBox.innerHTML = `${weatherEmoji} ${temperature}°C`;
    video.src = videoFile;
    video.play().catch(() => {});
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.encoding = THREE.sRGBEncoding;
    
    loader.load('cuadro.glb', (gltf) => {
        gltf.scene.traverse((n) => { if(n.isMesh) n.material.map = videoTexture; });
        applyMaterialLogic(gltf.scene, 'cuadro');
        scene.add(gltf.scene);
        loadedSlotMeshes['cuadro'] = gltf.scene;
        checkLoading();
    });
})();

// --- ILUMINACIÓN (SOLO FOCO NORMAL RESPONDE AL INTERRUPTOR) ---
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

renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) {
        lightOn = !lightOn;
        localStorage.setItem('lightState', lightOn ? 'on' : 'off'); 
        updateLighting();
    }
});

function updateQuality() {
    const isLow = perfCheck.checked;
    renderer.shadowMap.enabled = !isLow;
    renderer.setPixelRatio(isLow ? 1 : Math.min(window.devicePixelRatio, 2));
    for (let cat in loadedSlotMeshes) applyMaterialLogic(loadedSlotMeshes[cat], cat);
    if(focoDiaMesh) applyMaterialLogic(focoDiaMesh, 'foco_dia');
    updateLighting(); 
}
perfCheck.addEventListener('change', updateQuality);

// --- RESTO DE LÓGICA DE INTERFAZ (IGUAL A LA ANTERIOR) ---
let currentCategory = 'cama', openGroup = 'muebles';
function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar'), content = document.getElementById('inv-content');
    sidebar.innerHTML = ''; content.innerHTML = '';
    inventoryGroups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'inv-group';
        const groupBtn = document.createElement('button');
        groupBtn.className = 'group-btn';
        groupBtn.innerHTML = `<span>${group.emoji} ${group.label}</span> <span style="transform: ${openGroup === group.id ? 'rotate(90deg)' : ''}">▶</span>`;
        groupBtn.onclick = () => { openGroup = openGroup === group.id ? null : group.id; renderInventory(); };
        groupDiv.appendChild(groupBtn);
        const groupContent = document.createElement('div');
        groupContent.className = `group-content ${openGroup === group.id ? 'open' : ''}`;
        group.categories.forEach(catKey => {
            const btn = document.createElement('button');
            btn.className = `cat-btn ${catKey === currentCategory ? 'active' : ''}`;
            btn.innerHTML = `${inventoryData[catKey].emoji} ${inventoryData[catKey].label}`;
            btn.onclick = () => { currentCategory = catKey; renderInventory(); };
            groupContent.appendChild(btn);
        });
        groupDiv.appendChild(groupContent); sidebar.appendChild(groupDiv);
    });
    const catData = inventoryData[currentCategory];
    for (let itemId in catData.items) {
        const item = catData.items[itemId], isEquipped = catData.equipped === itemId;
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `<h4>${item.name}</h4><button class="item-btn ${isEquipped ? 'btn-equipped' : (item.owned ? 'btn-equip' : 'btn-buy')}" data-id="${itemId}">${isEquipped ? 'Equipado' : (item.owned ? 'Equipar' : 'Comprar')}</button>`;
        content.appendChild(card);
    }
    document.querySelectorAll('.btn-equip').forEach(b => b.onclick = (e) => equipItem(currentCategory, e.target.getAttribute('data-id')));
}

function equipItem(category, itemId) {
    inventoryData[category].equipped = itemId;
    saveGame(); renderInventory(); 
    loadItemForSlot(category, inventoryData[category].items[itemId].file, false);
}

document.getElementById('inventory-button').onclick = () => { document.getElementById('inventory-modal').classList.add('visible'); renderInventory(); };
document.getElementById('close-inv').onclick = () => document.getElementById('inventory-modal').classList.remove('visible');

function animate() {
    requestAnimationFrame(animate);
    if (lunariMixer) lunariMixer.update(clock.getDelta());
    controls.update();
    renderer.render(scene, camera); 
}
animate();
updateQuality();