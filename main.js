import * as THREE from 'three';
import { 
    scene, camera, renderer, controls, clock, loader, 
    getFreshUrl, applyMaterialLogic, actualizarIluminacionFocoDia,
    updateLighting, loadItemForSlot, checkLoading, 
    totalModelsToLoad, modelsLoaded, setTotalModelsToLoad,
    setModelsLoaded, inventoryData, gameSettings, 
    applyCurrentSettings, setFocoDiaMesh, setLuzFocoDia,
    setEsDeDiaLocal, setLastWeatherCode, lunariMixer, baseAction, randomAction, currentAction,
    tvPlaylist, playNextTv
} from './core.js';
import { checkDailyReward, initInteractionEvents } from './interactions.js';
import { syncSettingsUI } from './inventory.js';

// ---------- Inicialización ----------
checkDailyReward();
syncSettingsUI();
applyCurrentSettings();
updateLighting();

// Calcular total de modelos a cargar
for (let cat in inventoryData) {
    if (inventoryData[cat].type === 'multiple') continue; 
    let eqId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[eqId]) {
        let it = inventoryData[cat].items[eqId];
        if (it.file) totalModelsToLoad++; 
        if (cat === 'foco' && it.baseFile) totalModelsToLoad++; 
        if (cat === 'tele' && it.baseFile) totalModelsToLoad++;
    }
}
totalModelsToLoad += 4; // Lunari x2, FocoDia, Cuadro Clima

// ---------- Carga de modelos fijos ----------
let lunariMixer = null, baseAction = null, randomAction = null, currentAction = null;

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
}, undefined, () => checkLoading());

loader.load(getFreshUrl('Lunari_Duerme_2.glb'), (gltf) => {
    if (gltf.animations && gltf.animations.length > 0 && lunariMixer) { 
        randomAction = lunariMixer.clipAction(gltf.animations[0]); 
        randomAction.loop = THREE.LoopOnce; 
        randomAction.clampWhenFinished = true; 
    }
    checkLoading();
}, undefined, () => checkLoading());

loader.load(getFreshUrl('https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco_dia.glb'), (gltf) => {
    const focoDiaMesh = gltf.scene; 
    applyMaterialLogic(focoDiaMesh, 'foco_dia'); 
    const luzFocoDia = new THREE.PointLight(0xffffff, 1, 50);
    const box = new THREE.Box3().setFromObject(focoDiaMesh); 
    const center = new THREE.Vector3(); 
    box.getCenter(center);
    luzFocoDia.position.copy(center); 
    luzFocoDia.position.y -= 0.2; 
    luzFocoDia.shadow.bias = -0.005; 
    luzFocoDia.shadow.normalBias = 0.1;
    scene.add(luzFocoDia); 
    scene.add(focoDiaMesh); 
    focoDiaMesh.visible = false; 
    luzFocoDia.visible = true; 
    setFocoDiaMesh(focoDiaMesh);
    setLuzFocoDia(luzFocoDia);
    actualizarIluminacionFocoDia(); 
    checkLoading();
}, undefined, () => checkLoading());

// Carga de objetos del inventario
for (let cat in inventoryData) {
    if (inventoryData[cat].type === 'multiple') continue; 
    let eqId = inventoryData[cat].equipped;
    if (inventoryData[cat].items && inventoryData[cat].items[eqId]) {
        let it = inventoryData[cat].items[eqId];
        if (it.file) loadItemForSlot(cat, it.file, true);
        if (cat === 'foco' && it.baseFile) loadItemForSlot('base_foco', it.baseFile, true);
        if (cat === 'tele' && it.baseFile) loadItemForSlot('pantalla_tv', it.baseFile, true);
    }
}

// ---------- Configuración del clima y video del cuadro ----------
(async function setupWeatherVideo() {
    const video = document.createElement('video'); 
    video.loop = true; 
    video.muted = true; 
    video.playsInline = true; 
    video.crossOrigin = 'anonymous';
    let videoFile = 'dia_soleado.mp4', weatherEmoji = "☀️", weatherName = "Clima estándar", temperature = "--";
    const statusBox = document.getElementById('weather-status');

    try {
        let lat, lon;
        try { 
            const ipResponse = await fetch('https://ipapi.co/json/'); 
            const ipData = await ipResponse.json(); 
            if(ipData.latitude && ipData.longitude) { 
                lat = ipData.latitude; 
                lon = ipData.longitude; 
            } else throw new Error(); 
        } catch(e) { 
            lat = -12.0464; 
            lon = -77.0428; 
        }
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode, isDay = data.current_weather.is_day;
        setEsDeDiaLocal(isDay === 1);
        setLastWeatherCode(code);
        actualizarIluminacionFocoDia(); 
        temperature = data.current_weather.temperature;

        if (code === 0) { 
            weatherName = isDay ? "Despejado" : "Noche despejada"; 
            weatherEmoji = isDay ? "☀️" : "🌙"; 
            videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; 
        } else if ([1, 2, 3].includes(code)) { 
            weatherName = isDay ? "Nublado" : "Noche nublada"; 
            weatherEmoji = "☁️"; 
            videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; 
        } else if (code === 45 || code === 48) { 
            weatherName = "Niebla"; 
            weatherEmoji = "🌫️"; 
            videoFile = isDay ? 'dia_niebla.mp4' : 'noche_niebla.mp4'; 
        } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) { 
            weatherName = "Lluvia"; 
            weatherEmoji = "🌧️"; 
            videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; 
        } else if ([71, 73, 75, 77, 85, 86].includes(code)) { 
            weatherName = "Nieve"; 
            weatherEmoji = "❄️"; 
            videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4'; 
        } else if ([95, 96, 99].includes(code)) { 
            weatherName = "Tormenta"; 
            weatherEmoji = "⛈️"; 
            videoFile = isDay ? 'dia_tormenta.mp4' : 'noche_tormenta.mp4'; 
        }
    } catch (error) { 
        weatherEmoji = "❌"; 
        weatherName = "Clima offline"; 
    }

    statusBox.innerHTML = temperature !== "--" ? `${weatherEmoji} ${weatherName} | ${temperature}°C` : `${weatherEmoji} ${weatherName}`;
    video.src = videoFile; 
    video.play().catch(e => console.log('Autoplay blocked'));

    const videoTexture = new THREE.VideoTexture(video); 
    videoTexture.minFilter = THREE.LinearFilter; 
    videoTexture.magFilter = THREE.LinearFilter; 
    videoTexture.format = THREE.RGBAFormat; 
    videoTexture.encoding = THREE.sRGBEncoding;

    loader.load(getFreshUrl('cuadro.glb'), (gltf) => {
        const cuadroModel = gltf.scene;
        cuadroModel.traverse((node) => {
            if (node.isMesh && node.material) {
                if (Array.isArray(node.material)) { 
                    node.material.forEach(mat => { 
                        mat.map = videoTexture; 
                        mat.emissive = new THREE.Color(0xffffff); 
                        mat.emissiveMap = videoTexture; 
                        mat.emissiveIntensity = 1.0; 
                        mat.needsUpdate = true; 
                    }); 
                } else { 
                    node.material.map = videoTexture; 
                    node.material.emissive = new THREE.Color(0xffffff); 
                    node.material.emissiveMap = videoTexture; 
                    node.material.emissiveIntensity = 1.0; 
                    node.material.needsUpdate = true; 
                }
            }
        });
        applyMaterialLogic(cuadroModel, 'cuadro'); 
        scene.add(cuadroModel); 
        loadedSlotMeshes['cuadro'] = cuadroModel; 
        checkLoading();
    }, undefined, () => checkLoading());
})();

// ---------- Intervalos ----------
setInterval(actualizarIluminacionFocoDia, 60000);

setInterval(() => {
    if (!randomAction || !baseAction || !lunariMixer || currentAction === randomAction) return;
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

// Iniciar reproducción de TV
playNextTv(true);

// Inicializar eventos de interacción
initInteractionEvents(renderer);

// ---------- Bucle de animación ----------
let then = performance.now(); 
let frames = 0, lastFpsTime = then;

function animate() {
    requestAnimationFrame(animate); 
    const now = performance.now(); 
    const elapsed = now - then; 
    const fpsInterval = gameSettings.fps > 0 ? 1000 / gameSettings.fps : 0;
    if (fpsInterval === 0 || elapsed > fpsInterval) {
        if (fpsInterval > 0) then = now - (elapsed % fpsInterval);
        const delta = clock.getDelta(); 
        if (lunariMixer) lunariMixer.update(delta);
        controls.update(); 
        renderer.render(scene, camera);
        if (gameSettings.mostrarFps) { 
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

// ---------- Evento de redimensionamiento ----------
window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
    applyCurrentSettings(); 
});