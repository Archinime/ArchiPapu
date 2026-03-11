import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { inventoryGroups } from './inventory-data.js';
import { State, isMobileUA, checkDailyReward, getFreshUrl, disposeThreeJSObject } from './room_state.js';
import { SceneSetup } from './room_scene.js';

// Inicialización de Entorno y Datos
checkDailyReward();
SceneSetup.init(State.gameSettings, isMobileUA);
const { scene, clock, camera, renderer, controls, ambient, hemiLight, mainLight } = SceneSetup;

// Variables Globales de Instancia
const loadedSlotMeshes = {};
let switchMesh = null, focoMesh = null, focoDiaMesh = null, luzFocoDia = null;

let esDeDiaLocal = true;
let lastWeatherCode = 0;
let isTvOn = false; let tvTransitioning = false; let lastTvClickTime = 0;
let tvScreenMesh = null;

// Configuración de Audio y Video
const audioPrenderLuz = new Audio('prender_luz.mp3');
const audioApagarLuz = new Audio('apagar_luz.mp3');

const audioAbrirPoster = new Audio('abrir_poster.mp3');
const audioCerrarPoster = new Audio('guardar_poster.mp3');
const audioBotonTV = new Audio('sonido_boton.mp3');

const tvEffectVideoOff = document.createElement('video');
tvEffectVideoOff.src = 'efecto_tele.mp4'; tvEffectVideoOff.crossOrigin = 'anonymous';
tvEffectVideoOff.playsInline = true;
document.body.appendChild(tvEffectVideoOff);
tvEffectVideoOff.style.display = 'none';

const tvEffectVideoOn = document.createElement('video');
tvEffectVideoOn.src = 'efecto_tele - Invertido.mp4'; tvEffectVideoOn.crossOrigin = 'anonymous';
tvEffectVideoOn.playsInline = true;
document.body.appendChild(tvEffectVideoOn);
tvEffectVideoOn.style.display = 'none';

const tvEffectTextureOff = new THREE.VideoTexture(tvEffectVideoOff);
tvEffectTextureOff.minFilter = THREE.LinearFilter; tvEffectTextureOff.magFilter = THREE.LinearFilter;
tvEffectTextureOff.format = THREE.RGBAFormat;
const tvEffectTextureOn = new THREE.VideoTexture(tvEffectVideoOn); tvEffectTextureOn.minFilter = THREE.LinearFilter; tvEffectTextureOn.magFilter = THREE.LinearFilter;
tvEffectTextureOn.format = THREE.RGBAFormat;

// Aplicar Ajustes Gráficos Base
function applyCurrentSettings() {
    let pixelRatio = 1;
    if (State.gameSettings.calidad === 'media') pixelRatio = Math.min(window.devicePixelRatio, 1.2);
    else if (State.gameSettings.calidad === 'alta') pixelRatio = Math.min(window.devicePixelRatio, 2); 
    else if (State.gameSettings.calidad === 'ultra') pixelRatio = window.devicePixelRatio; // Soporte Ultra

    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = State.gameSettings.sombras > 0;
    
    // Configuración avanzada de sombras según la calidad
    if (State.gameSettings.sombras >= 3 || State.gameSettings.calidad === 'ultra') {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mainLight.shadow.bias = -0.0001; // Evita el pixelado y el sangrado en ultra
    } else if (State.gameSettings.sombras === 2) {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mainLight.shadow.bias = -0.0005;
    } else {
        renderer.shadowMap.type = THREE.PCFShadowMap;
        mainLight.shadow.bias = -0.001;
    }

    mainLight.castShadow = State.gameSettings.sombras > 0;
    
    if (State.gameSettings.sombras > 0) {
        let shadowRes = 512;
        if (State.gameSettings.calidad === 'ultra' || State.gameSettings.sombras >= 3) {
            shadowRes = isMobileUA ? 2048 : 4096; // 4K para PC, 2K para móviles en Ultra
        } else if (State.gameSettings.sombras === 2) {
            shadowRes = isMobileUA ? 1024 : 2048;
        }
        
        mainLight.shadow.mapSize.set(shadowRes, shadowRes);
        
        // Forzar a Three.js a reconstruir el mapa de sombras en tiempo real
        if (mainLight.shadow.map) {
            mainLight.shadow.map.dispose();
            mainLight.shadow.map = null;
        }
    }

    for (let cat in loadedSlotMeshes) applyMaterialLogic(loadedSlotMeshes[cat], cat);
    if(focoDiaMesh) actualizarIluminacionFocoDia();

    document.getElementById('fps-counter').style.display = State.gameSettings.mostrarFps ? 'block' : 'none';
    
    const tvVideo = document.getElementById('tv-video');
    if (tvVideo) tvVideo.volume = State.gameSettings.volumenTV / 100;
    tvEffectVideoOff.volume = State.gameSettings.volumenEfectos / 100;
    tvEffectVideoOn.volume = State.gameSettings.volumenEfectos / 100;
    
    let volEf = State.gameSettings.volumenEfectos / 100;
    audioPrenderLuz.volume = volEf;
    audioApagarLuz.volume = volEf;
    audioAbrirPoster.volume = volEf; audioCerrarPoster.volume = volEf;
    audioBotonTV.volume = volEf;
}

// Dialogos y Clima
function updateLunariText(isDay, weatherCode) {
    const dialogBox = document.getElementById('dialogue-text');
    if(!dialogBox) return;
    if (lunariSystem.currentState === 'dormir') {
        dialogBox.innerHTML = "Zzz...<br>(Lunari está profundamente dormida)";
        return;
    }

    if (!isDay) { 
        dialogBox.innerHTML = "¡Qué noche tan tranquila!<br>¿Deberíamos dormir pronto?";
    }
    else if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(weatherCode)) {
        dialogBox.innerHTML = "El clima está feo afuera.<br>¡Mejor nos quedamos viendo anime!";
    } else {
        dialogBox.innerHTML = "¡Hola!<br>Bienvenido de nuevo a casa.<br>¿Vemos un anime hoy?";
    }
}

function actualizarIluminacionFocoDia() {
    const hora = new Date().getHours(); let colorHex, lightInt, emInt, dist;
    if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8;
    dist = 35; }
    else if (hora >= 9 && hora < 17) { colorHex = 0xffffff;
    lightInt = 1.5; emInt = 1.5; dist = 50; }
    else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00;
    lightInt = 0.7; emInt = 0.7; dist = 40; }
    else { colorHex = 0x5566aa;
    lightInt = 0.25; emInt = 0.25; dist = 25; }

    if (luzFocoDia) { luzFocoDia.color.setHex(colorHex); luzFocoDia.intensity = lightInt;
    luzFocoDia.distance = dist; luzFocoDia.castShadow = State.gameSettings.sombras > 0; }
    if (focoDiaMesh) {
        focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material) { n.material.emissive.setHex(colorHex); n.material.emissiveIntensity = emInt; n.material.needsUpdate = true; }
        });
    }
    updateLunariText(esDeDiaLocal, lastWeatherCode);
}

// Lógica de Materiales 3D
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

// Lógica de Televisión
const tvVideo = document.getElementById('tv-video');
const tvTexture = new THREE.VideoTexture(tvVideo); tvTexture.minFilter = THREE.LinearFilter; tvTexture.magFilter = THREE.LinearFilter;
tvTexture.format = THREE.RGBAFormat;
tvTexture.encoding = THREE.sRGBEncoding;

let tvPlaylist = []; let currentTvIndex = -1;
function updatePlaylist() {
    tvPlaylist = State.inventoryData.videos.equipped.map(id => State.inventoryData.videos.items[id].file);
    if(tvPlaylist.length === 0) tvVideo.pause();
}

function playNextTv(random = false) {
    updatePlaylist(); if(tvPlaylist.length === 0) return;
    currentTvIndex = random ?
Math.floor(Math.random() * tvPlaylist.length) : (currentTvIndex + 1) % tvPlaylist.length;
    tvVideo.src = tvPlaylist[currentTvIndex]; tvVideo.volume = State.gameSettings.volumenTV / 100;
    if (isTvOn && !tvTransitioning) tvVideo.play().catch(e => console.warn('User interaction needed', e));
}

const tvPrevBtn = document.getElementById('tv-prev'), tvPlayPauseBtn = document.getElementById('tv-play-pause'), tvNextBtn = document.getElementById('tv-next'), tvPowerBtn = document.getElementById('tv-power');

function playButtonSound() { audioBotonTV.currentTime = 0; audioBotonTV.play().catch(e=>{});
}

tvPrevBtn.onclick = () => { playButtonSound(); if (!isTvOn || tvTransitioning) return; updatePlaylist(); if(tvPlaylist.length===0)return;
currentTvIndex = (currentTvIndex - 1 + tvPlaylist.length) % tvPlaylist.length; tvVideo.src = tvPlaylist[currentTvIndex]; tvVideo.play(); };
tvPlayPauseBtn.onclick = () => { playButtonSound();
if (!isTvOn || tvTransitioning) return; if(tvVideo.paused) tvVideo.play(); else tvVideo.pause(); };
tvNextBtn.onclick = () => { playButtonSound();
if (isTvOn && !tvTransitioning) playNextTv(false); };

if (tvPowerBtn) {
    tvPowerBtn.innerText = isTvOn ? '🟢' : '🔴';
    tvPowerBtn.addEventListener('click', () => {
        playButtonSound();
        if (tvTransitioning || !tvScreenMesh) return;
        tvTransitioning = true; tvVideo.pause();
        const mats = Array.isArray(tvScreenMesh.material) ? tvScreenMesh.material : [tvScreenMesh.material];
        const effectVideo = isTvOn ? tvEffectVideoOff : tvEffectVideoOn; 
        const effectTexture = isTvOn ? tvEffectTextureOff : tvEffectTextureOn;

        mats.forEach(mat => { mat.map = effectTexture; mat.emissiveMap = effectTexture; mat.color.setHex(0xffffff); mat.emissive.setHex(0xffffff); mat.emissiveIntensity 
= 1.0; mat.needsUpdate = true; });
        effectVideo.currentTime = 0; effectVideo.play().catch(e=>{});

        const onEffectEnded = () => {
            effectVideo.removeEventListener('ended', onEffectEnded);
            if (isTvOn) {
                isTvOn = false; tvPowerBtn.innerText = '🔴'; tvPowerBtn.style.color = 'red'; tvPowerBtn.style.textShadow = '0 0 5px red';
              
                mats.forEach(mat => { mat.map = null; mat.emissiveMap = null; mat.color.setHex(0x000000); mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; mat.needsUpdate = true; });
} else {
                isTvOn = true;
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

// -------------------------------------------------------------
// --- SISTEMA DE ANIMACIONES Y ESTADOS DE LUNARI ---
// -------------------------------------------------------------
const lunariSystem = {
    currentState: null,
    models: {
        dormir: null,
        despertar: null
    },
    mixers: {
        dormir: null,
        despertar: null
    },
    actions: {
        dormir_base: null,
    
    dormir_random: null,
        despertar_base: null
    },
    activeAction: null,

    evaluateState() {
        const hora = new Date().getHours();
// HORARIOS: 22 a 6 (10 PM a 6:59 AM) = Dormir. Resto = Despierta.
if (hora >= 22 || hora < 7) {
            this.setState('dormir');
} else {
            this.setState('despertar');
}
    },

    setState(newState) {
        if (this.currentState === newState) return;
this.currentState = newState;

        // Ocultar rigurosamente todos los modelos de la escena primero
        for (let key in this.models) {
            if (this.models[key]) this.models[key].visible = false;
}

        // Detener la animación en curso
        if (this.activeAction) this.activeAction.stop();
// Mostrar solo el modelo correcto y reproducir su animación
        if (newState === 'dormir' && this.models.dormir) {
            this.models.dormir.visible = true;
this.activeAction = this.actions.dormir_base;
            if (this.activeAction) this.activeAction.play();
        } 
        else if (newState === 'despertar' && this.models.despertar) {
            this.models.despertar.visible = true;
this.activeAction = this.actions.despertar_base;
            if (this.activeAction) this.activeAction.play();
        }
        
        // Actualiza la caja de texto
        updateLunariText(esDeDiaLocal, lastWeatherCode);
},

    update(delta) {
        for (let key in this.mixers) {
            if (this.mixers[key]) this.mixers[key].update(delta);
}
    }
};

// Sistema de Carga de Modelos 3D
let totalModelsToLoad = 0, modelsLoaded = 0;
for (let cat in State.inventoryData) {
    if (State.inventoryData[cat].type === 'multiple') continue; let eqId = State.inventoryData[cat].equipped;
if (State.inventoryData[cat].items && State.inventoryData[cat].items[eqId]) {
        let it = State.inventoryData[cat].items[eqId];
        if (it.file) totalModelsToLoad++;
if (cat === 'foco' && it.baseFile) totalModelsToLoad++; if (cat === 'tele' && it.baseFile) totalModelsToLoad++;
    }
}
totalModelsToLoad += 5;
// Aumentado para: Lunari Dormir(Mesh+Anim), Lunari Despierta(Mesh), FocoDia, Cuadro Clima

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
// Cargar Lunari: Durmiendo (Base)
loader.load(getFreshUrl('lunari_durmiendo1.glb'), (gltf) => {
    const model = gltf.scene; 
    model.visible = false; // <-- CORRECCIÓN: Nace oculta para evitar cruces de malla
    applyMaterialLogic(model, 'lunari'); 
    scene.add(model);
    lunariSystem.models.dormir = model;
    
    if (gltf.animations && gltf.animations.length > 0) { 
        lunariSystem.mixers.dormir = new THREE.AnimationMixer(model); 
        lunariSystem.actions.dormir_base = lunariSystem.mixers.dormir.clipAction(gltf.animations[0]); 
    }
    
    // Forzamos la 
actualización del estado para que la muestre solo si es la hora correcta
    lunariSystem.currentState = null; 
    lunariSystem.evaluateState();
    
    checkLoading();
}, undefined, () => checkLoading());
// Cargar Lunari: Durmiendo (Animación Aleatoria)
loader.load(getFreshUrl('Lunari_Duerme_2.glb'), (gltf) => {
    if (gltf.animations && gltf.animations.length > 0 && lunariSystem.mixers.dormir) { 
        lunariSystem.actions.dormir_random = lunariSystem.mixers.dormir.clipAction(gltf.animations[0]); 
        lunariSystem.actions.dormir_random.loop = THREE.LoopOnce; 
        lunariSystem.actions.dormir_random.clampWhenFinished = true; 
    }
    checkLoading();
}, undefined, () => checkLoading());
// Cargar Lunari: Despierta
loader.load(getFreshUrl('lunari_esta_despierta.glb'), (gltf) => {
    const model = gltf.scene; 
    model.visible = false; // <-- CORRECCIÓN: Nace oculta para evitar cruces de malla
    applyMaterialLogic(model, 'lunari'); 
    scene.add(model);
    lunariSystem.models.despertar = model;
    
    if (gltf.animations && gltf.animations.length > 0) { 
        lunariSystem.mixers.despertar = new THREE.AnimationMixer(model); 
        lunariSystem.actions.despertar_base = lunariSystem.mixers.despertar.clipAction(gltf.animations[0]); 
    }
    
    // Forzamos la actualización 
del estado para que la muestre solo si es la hora correcta
    lunariSystem.currentState = null; 
    lunariSystem.evaluateState();
    
    checkLoading();
}, undefined, () => checkLoading());
// Foco Día
loader.load(getFreshUrl('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb'), (gltf) => {
    focoDiaMesh = gltf.scene; applyMaterialLogic(focoDiaMesh, 'foco_dia'); 
    luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(focoDiaMesh); const center = new THREE.Vector3(); box.getCenter(center);
    luzFocoDia.position.copy(center); luzFocoDia.position.y -= 0.2; luzFocoDia.shadow.bias = -0.005; luzFocoDia.shadow.normalBias = 0.1;
    scene.add(luzFocoDia); scene.add(focoDiaMesh); focoDiaMesh.visible = false; luzFocoDia.visible = true; 
    actualizarIluminacionFocoDia(); checkLoading();
}, undefined, () => checkLoading());
// Bucle de Evaluación (Cada minuto)
setInterval(() => {
    actualizarIluminacionFocoDia();
    lunariSystem.evaluateState();

    if (lunariSystem.currentState === 'dormir') {
        const { dormir_base, dormir_random } = lunariSystem.actions;
        if (dormir_base && dormir_random && lunariSystem.activeAction !== dormir_random) {
            dormir_base.fadeOut(0.5); 
            dormir_random.reset().fadeIn(0.5).play(); 
            lunariSystem.activeAction = dormir_random;
       
     
            const onFinished = (event) => {
                if (event.action === dormir_random) { 
                    dormir_random.fadeOut(0.5); 
                    dormir_base.reset().fadeIn(0.5).play(); 
               
     lunariSystem.activeAction = dormir_base; 
                    lunariSystem.mixers.dormir.removeEventListener('finished', onFinished); 
                }
            };
            lunariSystem.mixers.dormir.addEventListener('finished', onFinished);
        }
    }
}, 60000);
function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
    if (!itemFile) return;
    if (loadedSlotMeshes[categoryKey]) { scene.remove(loadedSlotMeshes[categoryKey]); disposeThreeJSObject(loadedSlotMeshes[categoryKey]);
}
    
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

// Cargar todo el inventario inicial
for (let cat in State.inventoryData) {
    if (State.inventoryData[cat].type === 'multiple') continue;
let eqId = State.inventoryData[cat].equipped;
    if (State.inventoryData[cat].items && State.inventoryData[cat].items[eqId]) {
        let it = State.inventoryData[cat].items[eqId];
if (it.file) loadItemForSlot(cat, it.file, true);
        if (cat === 'foco' && it.baseFile) loadItemForSlot('base_foco', it.baseFile, true);
if (cat === 'tele' && it.baseFile) loadItemForSlot('pantalla_tv', it.baseFile, true);
    }
}

// Entorno del Clima y API
(async function setupWeatherVideo() {
    const video = document.createElement('video'); video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    let videoFile = 'dia_soleado.mp4', weatherEmoji = "☀️", weatherName = "Clima estándar", temperature = "--";
    const statusBox = document.getElementById('weather-status');

    try {
        let lat, lon;
        try { 
            const ipResponse = 
await fetch('https://ipapi.co/json/'); 
            const ipData = await ipResponse.json(); 
            if(ipData.latitude && ipData.longitude) { lat = ipData.latitude; lon = ipData.longitude; } 
            else throw new Error(); 
        } 
        catch(e) { lat = -12.0464; lon = -77.0428; } 

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    
    const data = await response.json();
        const code = data.current_weather.weathercode, isDay = data.current_weather.is_day;
esDeDiaLocal = (isDay === 1);
        lastWeatherCode = code; actualizarIluminacionFocoDia(); temperature = data.current_weather.temperature;
if (code === 0) { weatherName = isDay ? "Despejado" : "Noche despejada";
            weatherEmoji = isDay ? "☀️" : "🌙";
videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4';
        } 
        else if ([1, 2, 3].includes(code)) { weatherName = isDay ?
"Nublado" : "Noche nublada"; 
            weatherEmoji = "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4';
}
        else if (code === 45 || code === 48) { weatherName = "Niebla";
weatherEmoji = "🌫️"; videoFile = isDay ? 'dia_niebla.mp4' : 'noche_niebla.mp4';
}
        else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) { weatherName = "Lluvia";
weatherEmoji = "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4';
}
        else if ([71, 73, 75, 77, 85, 86].includes(code)) { weatherName = "Nieve";
weatherEmoji = "❄️"; videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4';
}
        else if ([95, 96, 99].includes(code)) { weatherName = "Tormenta"; weatherEmoji = "⛈️";
videoFile = isDay ? 'dia_tormenta.mp4' : 'noche_tormenta.mp4'; }
    } catch (error) { weatherEmoji = "❌";
weatherName = "Clima offline"; }

    statusBox.innerHTML = temperature !== "--" ? `${weatherEmoji} ${weatherName} |
${temperature}°C` : `${weatherEmoji} ${weatherName}`;
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

// Raycaster e Interacciones de Clics
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
function toggleLight() {
    State.lightOn = !State.lightOn;
    localStorage.setItem('lightState', State.lightOn ? 'on' : 'off'); updateLighting();
if (State.lightOn) { audioPrenderLuz.currentTime = 0; audioPrenderLuz.play().catch(e=>{}); } 
    else { audioApagarLuz.currentTime = 0; audioApagarLuz.play().catch(e=>{});
}
}

const posterViewModal = document.getElementById('poster-view-modal'); const posterEnlargedImage = document.getElementById('poster-enlarged-image');
document.getElementById('close-poster-view').onclick = () => { posterViewModal.classList.remove('visible'); audioCerrarPoster.currentTime = 0; audioCerrarPoster.play().catch(e=>{}); };
posterViewModal.onclick = (e) => { if (e.target === posterViewModal) { posterViewModal.classList.remove('visible'); audioCerrarPoster.currentTime = 0; audioCerrarPoster.play().catch(e=>{}); } };
function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect();
mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(mouse, camera);
if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) { toggleLight(); return;
}
    
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
            const itemData = State.inventoryData[cat].items[State.inventoryData[cat].equipped];
if (itemData && itemData.preview) { posterEnlargedImage.src = itemData.preview; posterViewModal.classList.add('visible'); audioAbrirPoster.currentTime = 0; audioAbrirPoster.play().catch(e=>{});
}
            break;
}
    }
}

let pointerDownPos = { x: 0, y: 0 }; let isDragging = false;
renderer.domElement.addEventListener('pointerdown', (e) => { pointerDownPos.x = e.clientX; pointerDownPos.y = e.clientY; isDragging = false; });
renderer.domElement.addEventListener('pointermove', (e) => { const dx = e.clientX - pointerDownPos.x; const dy = e.clientY - pointerDownPos.y; if (Math.sqrt(dx * dx + dy * dy) > 5) isDragging = true; });
renderer.domElement.addEventListener('pointerup', (e) => { if (!isDragging && !document.getElementById('inventory-modal').classList.contains('visible') && !document.getElementById('ff-settings-modal').classList.contains('active')) handleInteraction(e); isDragging = false; });
// UI y Ajustes Modal
const settingsModal = document.getElementById('ff-settings-modal');
document.getElementById('settings-button').onclick = () => settingsModal.classList.add('active');
document.getElementById('close-ff-settings').onclick = () => { settingsModal.classList.remove('active');
localStorage.setItem('ff_settings', JSON.stringify(State.gameSettings)); applyCurrentSettings(); };
document.querySelectorAll('.ff-tab').forEach(tab => {
    tab.onclick = () => { document.querySelectorAll('.ff-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.ff-tab-pane').forEach(p => p.classList.remove('active')); tab.classList.add('active'); document.getElementById(tab.dataset.target).classList.add('active'); };
});
function syncSettingsUI() {
    document.querySelectorAll('#setting-calidad button').forEach(b => {
        b.classList.toggle('active', b.dataset.val === State.gameSettings.calidad);
        b.onclick = () => { 
            State.gameSettings.calidad = b.dataset.val; 
            if(State.gameSettings.calidad === 'baja') { State.gameSettings.sombras = 0; State.gameSettings.fps = 30; } 
            else if(State.gameSettings.calidad === 'media') { State.gameSettings.sombras = 1; State.gameSettings.fps = 60; } 
            else if(State.gameSettings.calidad === 'alta') { State.gameSettings.sombras = 2; State.gameSettings.fps = 60; } 
            else if(State.gameSettings.calidad === 'ultra') { State.gameSettings.sombras = 3; State.gameSettings.fps = 60; } 
            syncSettingsUI(); applyCurrentSettings(); 
        };
    });
document.querySelectorAll('#setting-fps button').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val) === State.gameSettings.fps);
        b.onclick = () => { State.gameSettings.fps = parseInt(b.dataset.val); syncSettingsUI(); };
    });
const volTV = document.getElementById('setting-volumen-tv'); volTV.value = State.gameSettings.volumenTV; document.getElementById('vol-tv-val').innerText = `${State.gameSettings.volumenTV}%`;
    volTV.oninput = (e) => { State.gameSettings.volumenTV = e.target.value;
document.getElementById('vol-tv-val').innerText = `${State.gameSettings.volumenTV}%`; applyCurrentSettings(); };
    
    const volEf = document.getElementById('setting-volumen-efectos'); volEf.value = State.gameSettings.volumenEfectos;
    document.getElementById('vol-efectos-val').innerText = `${State.gameSettings.volumenEfectos}%`;
volEf.oninput = (e) => { State.gameSettings.volumenEfectos = e.target.value; document.getElementById('vol-efectos-val').innerText = `${State.gameSettings.volumenEfectos}%`; applyCurrentSettings(); };

    const fpsCheck = document.getElementById('setting-showfps');
    fpsCheck.checked = State.gameSettings.mostrarFps;
fpsCheck.onchange = (e) => { State.gameSettings.mostrarFps = e.target.checked; applyCurrentSettings(); };
}

// Lógica del Inventario UI
let currentCategory = 'cama', openGroup = 'muebles';
function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar'), content = document.getElementById('inv-content'); sidebar.innerHTML = ''; content.innerHTML = '';
inventoryGroups.forEach(group => {
        const groupDiv = document.createElement('div'); groupDiv.className = 'inv-group';
        const groupBtn = document.createElement('button'); groupBtn.className = 'group-btn';
        groupBtn.innerHTML = `<span>${group.emoji} ${group.label}</span> <span style="transition:0.3s; transform: ${openGroup === group.id ? 'rotate(90deg)' : 'rotate(0deg)'}">▶</span>`;
        groupBtn.onclick = () => { openGroup = openGroup === group.id ? null : group.id; renderInventory(); };
        groupDiv.appendChild(groupBtn);
        const groupContent = document.createElement('div'); groupContent.className = `group-content ${openGroup === group.id 
? 'open' : ''}`;
        group.categories.forEach(catKey => {
            const catData = State.inventoryData[catKey]; if(!catData) return;
            const btn = document.createElement('button'); btn.className = `cat-btn ${catKey === currentCategory ? 'active' : ''}`;
            btn.innerHTML = `<span class="cat-icon-emoji">${catData.emoji}</span> <span>${catData.label}</span>`;
btn.onclick = () => { currentCategory = catKey; renderInventory(); };
            groupContent.appendChild(btn);
        });
        groupDiv.appendChild(groupContent); sidebar.appendChild(groupDiv);
    });

    const catData = State.inventoryData[currentCategory];
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
    const catData = State.inventoryData[category];
if (catData.type === 'multiple') { const idx = catData.equipped.indexOf(itemId); if (idx > -1) catData.equipped.splice(idx, 1); else catData.equipped.push(itemId); updatePlaylist();
} else { 
        catData.equipped = itemId; const itemData = catData.items[itemId];
loadItemForSlot(category, itemData.file, false);
        if (category === 'foco' && itemData.baseFile) loadItemForSlot('base_foco', itemData.baseFile, false);
if (category === 'tele' && itemData.baseFile) loadItemForSlot('pantalla_tv', itemData.baseFile, false);
    }
    State.saveGame(); renderInventory(); 
};
window.buyItem = function(category, itemId) {
    let item = State.inventoryData[category].items[itemId];
    if (State.playerCoins >= item.price) { State.playerCoins -= item.price;
item.owned = true; State.saveGame(); renderInventory(); } 
    else alert("No tienes suficientes monedas.");
};
document.getElementById('inventory-button').onclick = () => { document.getElementById('inventory-modal').classList.add('visible'); renderInventory(); };
document.getElementById('close-inv').onclick = () => { document.getElementById('inventory-modal').classList.remove('visible'); };
// Bucle Principal (Animación y Rendimiento)
let then = performance.now();
let frames = 0, lastFpsTime = then;
function animate() {
    requestAnimationFrame(animate); const now = performance.now();
    const elapsed = now - then;
const fpsInterval = State.gameSettings.fps > 0 ? 1000 / State.gameSettings.fps : 0;
if (fpsInterval === 0 || elapsed > fpsInterval) {
        if (fpsInterval > 0) then = now - (elapsed % fpsInterval);
const delta = clock.getDelta(); 
        lunariSystem.update(delta); 
        
        controls.update(); renderer.render(scene, camera);
        
        if (State.gameSettings.mostrarFps) { frames++;
if (now - lastFpsTime >= 1000) { document.querySelector('#fps-counter span').innerText = frames; frames = 0; lastFpsTime = now;
} 
        }
    }
}

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); applyCurrentSettings(); });
// Inicialización final UI
syncSettingsUI();
applyCurrentSettings(); updateLighting(); animate();