import { state, scene, loader } from './core.js';
import { getFreshUrl } from './utils.js';
import { applyMaterialLogic } from './models.js';
import { checkLoading } from './loading.js';
import { actualizarIluminacionFocoDia } from './lighting.js';
import { updateLunariText } from './lunari.js';

export async function initWeather() {
    const video = document.createElement('video');
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let videoFile = 'dia_soleado.mp4';
    let weatherEmoji = "☀️";
    let weatherName = "Clima estándar";
    let temperature = "--";
    const statusBox = document.getElementById('weather-status');

    try {
        let lat, lon;
        try {
            const ipResponse = await fetch('https://ipapi.co/json/');
            const ipData = await ipResponse.json();
            if (ipData.latitude && ipData.longitude) {
                lat = ipData.latitude;
                lon = ipData.longitude;
            } else throw new Error();
        } catch (e) {
            lat = -12.0464;
            lon = -77.0428;
        }
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode;
        const isDay = data.current_weather.is_day;
        state.esDeDiaLocal = (isDay === 1);
        state.lastWeatherCode = code;
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
        } else if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) {
            weatherName = "Lluvia";
            weatherEmoji = "🌧️";
            videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4';
        } else if ([71,73,75,77,85,86].includes(code)) {
            weatherName = "Nieve";
            weatherEmoji = "❄️";
            videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4';
        } else if ([95,96,99].includes(code)) {
            weatherName = "Tormenta";
            weatherEmoji = "⛈️";
            videoFile = isDay ? 'dia_tormenta.mp4' : 'noche_tormenta.mp4';
        }
    } catch (error) {
        weatherEmoji = "❌";
        weatherName = "Clima offline";
    }

    statusBox.innerHTML = temperature !== "--"
        ? `${weatherEmoji} ${weatherName} | ${temperature}°C`
        : `${weatherEmoji} ${weatherName}`;

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
        state.loadedSlotMeshes['cuadro'] = cuadroModel;
        checkLoading();
    }, undefined, () => checkLoading());
}