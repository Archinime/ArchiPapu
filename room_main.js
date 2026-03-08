import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { defaultInventoryConfig, inventoryGroups } from './inventory-data.js';

// --- SISTEMA DE DATOS E INVENTARIO ---
let playerCoins = parseInt(localStorage.getItem('room_coins')) || 1000;
document.getElementById('coin-amount').innerText = playerCoins;

let inventoryData = JSON.parse(localStorage.getItem('room_inventory')) || defaultInventoryConfig;
if (inventoryData.base_foco) delete inventoryData.base_foco;

// Sincronizar objetos nuevos y verificar integridad
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

// --- Detección de dispositivo ---
const ua = navigator.userAgent;
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
const width = window.innerWidth;
let deviceType = (width < 768 || (isMobileUA && width < 1024)) ? 'mobile' : (width >= 768 && width <= 1024) ? 'tablet' : 'desktop';

// --- Escena, Cámara y Reloj (Para Animaciones) ---
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
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); hemiLight.position.set(0, 20, 0); scene.add(hemiLight);

const mainLight = new THREE.SpotLight(0xffeedd, 6);
mainLight.position.set(2, 22, 2); mainLight.angle = Math.PI / 3; mainLight.penumbra = 0.8; mainLight.decay = 2; mainLight.distance = 60;
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.near = 0.5; mainLight.shadow.camera.far = 40; mainLight.shadow.bias = -0.0001; mainLight.shadow.normalBias = 0.02; mainLight.shadow.radius = 4; 
scene.add(mainLight); scene.add(mainLight.target);

// NUEVA LUZ: Foco de día (Comienza apagada, se controla por el clima)
const dayLight = new THREE.SpotLight(0xffffee, 0); 
dayLight.angle = Math.PI / 3; dayLight.penumbra = 0.8; dayLight.decay = 2; dayLight.distance = 60;
dayLight.castShadow = true;
dayLight.shadow.mapSize.set(2048, 2048);
dayLight.shadow.bias = -0.0001;
scene.add(dayLight); scene.add(dayLight.target);

let lightOn = localStorage.getItem('lightState') !== 'off';
const perfCheck = document.getElementById('performance-mode');
perfCheck.checked = localStorage.getItem('performanceMode') === 'true';

function applyMaterialLogic(model, categoryKey) {
    if(!model) return;
    const isLow = perfCheck.checked;
    const isFoco = categoryKey === 'foco' || categoryKey === 'foco_dia';

    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            if (isFoco) {
                node.castShadow = false; node.receiveShadow = false;
                if (node.material && categoryKey === 'foco') {
                    node.material.emissive = new THREE.Color(0xffeedd);
                    node.material.emissiveIntensity = lightOn ? 1.5 : 0;
                }
            } else {
                node.castShadow = !isLow; node.receiveShadow = !isLow;
                if(node.material) {
                    node.material.shadowSide = THREE.FrontSide;
                    if(node.name.toLowerCase().includes('pared') || node.name.toLowerCase().includes('piso')) {
                        node.material.shadowSide = THREE.BackSide;
                    }
                    node.material.side = THREE.DoubleSide;
                    node.material.needsUpdate = true;
                }
            }
        }
    });
}

// --- CÁLCULO DINÁMICO DE CARGA ---
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

totalModelsToLoad += 2; // Lunari
totalModelsToLoad += 2; // Cuadro y Foco Dia

function checkLoading() {
    modelsLoaded++;
    const loadingEl = document.getElementById('loading');
    if(loadingEl) {
        loadingEl.innerText = `Cargando: ${modelsLoaded}/${totalModelsToLoad}`;
        if (modelsLoaded >= totalModelsToLoad) {
            loadingEl.style.display = 'none';
        }
    }
}

if(totalModelsToLoad === 0 && document.getElementById('loading')) {
    document.getElementById('loading').style.display = 'none';
}

// --- CARGA DE MODELOS Y LUNARI CON ANIMACIONES ---
const loader = new GLTFLoader();
let lunariMixer = null;
let baseAction = null;
let randomAction = null;
let currentAction = null;

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
}, undefined, (e) => {
    console.error('Error cargando a Lunari:', e);
    checkLoading();
});

loader.load('Lunari_Duerme_2.glb', (gltf) => {
    if (gltf.animations && gltf.animations.length > 0 && lunariMixer) {
        const clip = gltf.animations[0];
        randomAction = lunariMixer.clipAction(clip);
        randomAction.loop = THREE.LoopOnce;
        randomAction.clampWhenFinished = true;
    }
    checkLoading();
}, undefined, (e) => {
    console.error('Error cargando animación aleatoria:', e);
    checkLoading();
});

setInterval(() => {
    if (!randomAction || !baseAction || !lunariMixer) return;
    if (currentAction === randomAction) return;

    if (baseAction && randomAction) {
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
    }
}, 60000);

function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
    if (!itemFile) return;
    if (loadedSlotMeshes[categoryKey]) {
        scene.remove(loadedSlotMeshes[categoryKey]);
    }

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
    }, undefined, (e) => { 
        console.error(`Error cargando modelo [${categoryKey}]:`, itemFile); 
        if(isInitialLoad) checkLoading();
    });
}

for (let cat in inventoryData) {
    let equippedItemId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[equippedItemId]) {
        let itemData = inventoryData[cat].items[equippedItemId];
        if (itemData.file) {
            loadItemForSlot(cat, itemData.file, true);
        }
        if (cat === 'foco' && itemData.baseFile) {
            loadItemForSlot('base_foco', itemData.baseFile, true);
        }
    }
}

// --- CARGA DEL FOCO DE DÍA (INVISIBLE) ---
loader.load('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb', (gltf) => {
    const focoDiaModel = gltf.scene;
    
    // Ocultamos el objeto para que no se vea físicamente
    focoDiaModel.visible = false;
    
    applyMaterialLogic(focoDiaModel, 'foco_dia');
    scene.add(focoDiaModel);

    // Posicionamos la nueva luz exactamente donde está el foco_dia
    const box = new THREE.Box3().setFromObject(focoDiaModel);
    const center = new THREE.Vector3(); 
    box.getCenter(center);
    dayLight.position.copy(center); 
    dayLight.position.y -= 0.2;
    dayLight.target.position.set(center.x, 0, center.z);
    
    checkLoading();
}, undefined, (e) => {
    console.error('Error cargando foco_dia:', e);
    checkLoading();
});

// --- CARGA DEL CUADRO CON VIDEO Y CLIMA API (MAPEADO COMPLETO Y DÍA/NOCHE) ---
(async function setupWeatherVideo() {
    const video = document.createElement('video');
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    // Valores por defecto
    let videoFile = 'dia_soleado.mp4'; 
    let weatherEmoji = "☀️";
    let weatherName = "Clima estándar";
    let temperature = "--";

    const statusBox = document.getElementById('weather-status');

    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        
        const code = data.current_weather.weathercode;
        const isDay = data.current_weather.is_day; // 1 = día, 0 = noche
        temperature = data.current_weather.temperature;

        // --- INTEGRACIÓN LUZ FOCO DÍA ---
        // Si la API confirma que es de día (1), la luz del foco_dia se activa
        if (isDay === 1) {
            dayLight.intensity = 6;
        } else {
            dayLight.intensity = 0;
        }

        // MAPEADO COMPLETO WMO CON VERIFICACIÓN DÍA Y NOCHE
        if (code === 0) {
            weatherName = isDay ? "Despejado" : "Noche despejada";
            weatherEmoji = isDay ? "☀️" : "🌙";
            videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4';
        } else if (code === 1 || code === 2) {
            weatherName = isDay ? "Parcialmente nublado" : "Noche algo nublada";
            weatherEmoji = isDay ? "⛅" : "☁️";
            videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4';
        } else if (code === 3) {
            weatherName = "Muy nublado";
            weatherEmoji = "☁️";
            videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4';
        } else if (code === 45 || code === 48) {
            weatherName = "Niebla";
            weatherEmoji = "🌫️";
            videoFile = isDay ? 'dia_niebla.mp4' : 'noche_niebla.mp4';
        } else if ([51, 53, 55, 56, 57].includes(code)) {
            weatherName = "Llovizna";
            weatherEmoji = isDay ? "🌦️" : "🌧️";
            videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4';
        } else if ([61, 63, 65, 66, 67].includes(code)) {
            weatherName = "Lluvia";
            weatherEmoji = "🌧️";
            videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4';
        } else if ([71, 73, 75, 77].includes(code)) {
            weatherName = "Nieve";
            weatherEmoji = "❄️";
            videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4';
        } else if ([80, 81, 82].includes(code)) {
            weatherName = "Aguaceros";
            weatherEmoji = "🌧️";
            videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4';
        } else if ([85, 86].includes(code)) {
            weatherName = "Chubascos de nieve";
            weatherEmoji = "🌨️";
            videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4';
        } else if ([95, 96, 99].includes(code)) {
            weatherName = "Tormenta";
            weatherEmoji = "⛈️";
            videoFile = isDay ? 'dia_tormenta.mp4' : 'noche_tormenta.mp4';
        } else {
            weatherName = "Desconocido";
            videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4';
        }

    } catch (error) {
        console.warn('Error con el clima, usando defecto:', error);
        weatherEmoji = "❌";
        weatherName = "Clima offline";
        // En caso de error dejamos la luz apagada o encendida según prefieras. Aquí la dejamos apagada.
        dayLight.intensity = 0; 
    }

    // Actualizar la interfaz con el clima y la TEMPERATURA
    if (temperature !== "--") {
        statusBox.innerHTML = `${weatherEmoji} ${weatherName} | ${temperature}°C`;
    } else {
        statusBox.innerHTML = `${weatherEmoji} ${weatherName}`;
    }
    video.src = videoFile;
    // Iniciar video
    video.play().catch(e => console.log('Autoplay bloqueado:', e));
    // Configurar textura 3D
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;
    videoTexture.encoding = THREE.sRGBEncoding;
    
    // Cargar el cuadro
    loader.load('cuadro.glb', (gltf) => {
        const cuadroModel = gltf.scene;
        
        cuadroModel.traverse((node) => {
            if (node.isMesh) {
                if (Array.isArray(node.material)) {
                    node.material.forEach(mat => {
                        mat.map = videoTexture;
                        mat.needsUpdate = true;
                    });
                } else if (node.material) {
                    node.material.map = videoTexture;
                    node.material.needsUpdate = true;
                }
            }
        });
       
        applyMaterialLogic(cuadroModel, 'cuadro');
        scene.add(cuadroModel);
        loadedSlotMeshes['cuadro'] = cuadroModel;
        checkLoading();
    }, undefined, (e) => {
        console.error('Error cargando cuadro:', e);
        checkLoading();
    });

})();

// --- SISTEMA DE ILUMINACIÓN ---
function updateLighting() {
    const isLow = perfCheck.checked;
    
    // Ajustamos las sombras de la luz de día según el modo rendimiento
    dayLight.castShadow = !isLow;

    if (lightOn) {
        mainLight.visible = true;
        ambient.intensity = isLow ? 0.8 : 0.3; hemiLight.intensity = isLow ? 0.8 : 0.4;
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

function toggleLight() {
    lightOn = !lightOn;
    localStorage.setItem('lightState', lightOn ? 'on' : 'off'); updateLighting();
}

// --- FUNCIONES PARA LOS POSTERS ---
const posterViewModal = document.getElementById('poster-view-modal');
const posterEnlargedImage = document.getElementById('poster-enlarged-image');
const closePosterBtn = document.getElementById('close-poster-view');

function openPosterPreview(categoryKey) {
    const equippedId = inventoryData[categoryKey].equipped;
    const itemData = inventoryData[categoryKey].items[equippedId];
    if (itemData && itemData.preview) {
        posterEnlargedImage.src = itemData.preview;
        posterViewModal.classList.add('visible');
    }
}

closePosterBtn.onclick = () => posterViewModal.classList.remove('visible');
posterViewModal.onclick = (e) => { 
    if (e.target === posterViewModal) posterViewModal.classList.remove('visible');
};

// --- SISTEMA DE INTERACCIÓN GENERAL ---
function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;
    mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // Chequeo de Luz (sólo interactúa con el manual, la luz de día es independiente)
    if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) {
        toggleLight();
        return; 
    }

    // Chequeo de Pósters Dinámicos
    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const posterMesh = loadedSlotMeshes[cat];
        if (posterMesh) {
            const intersects = raycaster.intersectObject(posterMesh, true);
            if (intersects.length > 0) {
                openPosterPreview(cat);
                break;
            }
        }
    }
}

renderer.domElement.addEventListener('click', handleInteraction);
renderer.domElement.addEventListener('touchstart', (e) => { 
    if(document.getElementById('inventory-modal').classList.contains('visible')) return;
    handleInteraction(e); 
}, {passive: true});

// --- Calidad / Modo Humilde ---
function updateQuality() {
    const isLow = perfCheck.checked;
    renderer.shadowMap.enabled = !isLow;
    renderer.setPixelRatio(isLow ? 1 : Math.min(window.devicePixelRatio, 2));
    document.getElementById('quality-indicator').textContent = isLow ? 'Modo Humilde' : 'Calidad Alta';
    for (let cat in loadedSlotMeshes) {
        applyMaterialLogic(loadedSlotMeshes[cat], cat);
    }
    
    localStorage.setItem('performanceMode', isLow);
    updateLighting(); 
}
perfCheck.addEventListener('change', updateQuality);

// --- LÓGICA DE INTERFAZ DEL INVENTARIO ---
let currentCategory = 'cama';
let openGroup = 'muebles';

function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar');
    const content = document.getElementById('inv-content');
    sidebar.innerHTML = ''; content.innerHTML = '';
    
    inventoryGroups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'inv-group';

        const groupBtn = document.createElement('button');
        groupBtn.className = 'group-btn';
        groupBtn.innerHTML = `<span>${group.emoji} ${group.label}</span> <span style="transition:0.3s; transform: ${openGroup === group.id ? 'rotate(90deg)' : 'rotate(0deg)'}">▶</span>`;
        groupBtn.onclick = () => {
            openGroup = openGroup === group.id ? null : group.id;
            renderInventory();
        };
   
        groupDiv.appendChild(groupBtn);

        const groupContent = document.createElement('div');
        groupContent.className = `group-content ${openGroup === group.id ? 'open' : ''}`;

        group.categories.forEach(catKey => {
            const catData = inventoryData[catKey];
  
            if(!catData) return;
            const btn = document.createElement('button');
            btn.className = `cat-btn ${catKey === currentCategory ? 'active' : ''}`;
            btn.innerHTML = `<span class="cat-icon-emoji">${catData.emoji}</span> <span>${catData.label}</span>`;
            btn.onclick = () => { currentCategory = catKey; renderInventory(); };
            groupContent.appendChild(btn);
        });

        groupDiv.appendChild(groupContent);
        sidebar.appendChild(groupDiv);
    });

    const catData = inventoryData[currentCategory];
    if (!catData) return;
    
    for (let itemId in catData.items) {
        const item = catData.items[itemId];
        const isEquipped = catData.equipped === itemId;
        
        const card = document.createElement('div');
        card.className = 'item-card';

        const previewDiv = document.createElement('div');
        previewDiv.className = 'item-preview';
        if (item.preview) {
            const img = document.createElement('img');
            img.src = item.preview;
            img.alt = item.name;
            img.onerror = () => { previewDiv.innerHTML = `<span>${catData.emoji}</span>`; };
            previewDiv.appendChild(img);
        } else {
            previewDiv.innerHTML = `<span>${catData.emoji}</span>`;
        }
        
        let btnHTML = '';
        if (isEquipped) {
            btnHTML = `<button class="item-btn btn-equipped" disabled>Equipado ✓</button>`;
        } else if (item.owned) {
            btnHTML = `<button class="item-btn btn-equip" data-id="${itemId}">Equipar</button>`;
        } else {
            btnHTML = `<button class="item-btn btn-buy" data-id="${itemId}">Comprar 🪙${item.price}</button>`;
        }

        card.innerHTML = `
            <div>
                ${previewDiv.outerHTML}
                <h4>${item.name}</h4>
                <div class="item-price">${item.owned ? 'Adquirido' : `🪙 ${item.price}`}</div>
            </div>
            ${btnHTML}
        `;
        
        const previewContainer = card.querySelector('.item-preview');
        if (previewContainer && item.preview) {
            previewContainer.innerHTML = '';
            const img = document.createElement('img');
            img.src = item.preview;
            img.alt = item.name;
            img.onerror = () => { previewContainer.innerHTML = `<span>${catData.emoji}</span>`; };
            previewContainer.appendChild(img);
        }
        
        content.appendChild(card);
    }

    document.querySelectorAll('.btn-equip').forEach(b => {
        b.onclick = (e) => equipItem(currentCategory, e.target.getAttribute('data-id'));
    });
    document.querySelectorAll('.btn-buy').forEach(b => {
        b.onclick = (e) => buyItem(currentCategory, e.target.getAttribute('data-id'));
    });
}

function equipItem(category, itemId) {
    inventoryData[category].equipped = itemId;
    saveGame();
    renderInventory(); 
    
    const itemData = inventoryData[category].items[itemId];
    loadItemForSlot(category, itemData.file, false);

    if (category === 'foco' && itemData.baseFile) {
        loadItemForSlot('base_foco', itemData.baseFile, false);
    }
}

function buyItem(category, itemId) {
    let item = inventoryData[category].items[itemId];
    if (playerCoins >= item.price) {
        playerCoins -= item.price;
        item.owned = true;
        saveGame();
        renderInventory();
    } else {
        alert("No tienes suficientes monedas.");
    }
}

// Eventos UI
document.getElementById('inventory-button').onclick = () => {
    document.getElementById('inventory-modal').classList.add('visible');
    renderInventory();
};
document.getElementById('close-inv').onclick = () => {
    document.getElementById('inventory-modal').classList.remove('visible');
};
document.getElementById('settings-button').onclick = () => {
    document.getElementById('settings-panel').classList.toggle('visible');
};

// --- Animación y Resize ---
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

updateQuality();