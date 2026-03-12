import * as THREE from 'three';
import { State, getFreshUrl } from './room_state.js';

export const WeatherSystem = {
    esDeDiaLocal: true,
    lastWeatherCode: 0,
    
    actualizarIluminacion(focoDiaMesh, luzFocoDia, isMobileUA, lunariRef) {
        const hora = new Date().getHours(); let colorHex, lightInt, emInt, dist;
        if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8; dist = 35; }
        else if (hora >= 9 && hora < 17) { colorHex = 0xffffff; lightInt = 1.5; emInt = 1.5; dist = 50; }
        else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00; lightInt = 0.7; emInt = 0.7; dist = 40; }
        else { colorHex = 0x5566aa; lightInt = 0.25; emInt = 0.25; dist = 25; }

        if (luzFocoDia) { 
            luzFocoDia.color.setHex(colorHex); luzFocoDia.intensity = lightInt; luzFocoDia.distance = dist; 
            luzFocoDia.castShadow = State.gameSettings.sombras > 0;
            if (State.gameSettings.sombras > 0) {
                let diaShadowRes = State.gameSettings.sombras === 2 ? (isMobileUA ? 2048 : 4096) : 1024;
                if (luzFocoDia.shadow.mapSize.width !== diaShadowRes) {
                    luzFocoDia.shadow.mapSize.set(diaShadowRes, diaShadowRes);
                    if (luzFocoDia.shadow.map) { luzFocoDia.shadow.map.dispose(); luzFocoDia.shadow.map = null; }
                }
            }
        }
        if (focoDiaMesh) {
            focoDiaMesh.traverse((n) => {
                if (n.isMesh && n.material) { n.material.emissive.setHex(colorHex); n.material.emissiveIntensity = emInt; n.material.needsUpdate = true; }
            });
        }
        if(lunariRef) lunariRef.updateLunariText(this.esDeDiaLocal, this.lastWeatherCode);
    },

    async setupWeatherVideo(loader, scene, materialLogicCallback, loadedMeshesObj, checkLoadingCallback) {
        const video = document.createElement('video'); video.loop = true; video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous';
        let videoFile = 'dia_soleado.mp4', weatherEmoji = "☀️", weatherName = "Clima estándar", temperature = "--";
        const statusBox = document.getElementById('weather-status');

        try {
            let lat, lon;
            try { 
                const ipResponse = await fetch('https://ipapi.co/json/'); 
                const ipData = await ipResponse.json(); 
                if(ipData.latitude && ipData.longitude) { lat = ipData.latitude; lon = ipData.longitude; } 
                else throw new Error(); 
            } 
            catch(e) { lat = -12.0464; lon = -77.0428; } 

            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const data = await response.json();
            const code = data.current_weather.weathercode, isDay = data.current_weather.is_day;
            this.esDeDiaLocal = (isDay === 1);
            this.lastWeatherCode = code; temperature = data.current_weather.temperature;
            
            if (code === 0) { weatherName = isDay ? "Despejado" : "Noche despejada"; weatherEmoji = isDay ? "☀️" : "🌙"; videoFile = isDay ? 'dia_soleado.mp4' : 'noche_despejada.mp4'; } 
            else if ([1, 2, 3].includes(code)) { weatherName = isDay ? "Nublado" : "Noche nublada"; weatherEmoji = "☁️"; videoFile = isDay ? 'dia_nublado.mp4' : 'noche_nublada.mp4'; }
            else if (code === 45 || code === 48) { weatherName = "Niebla"; weatherEmoji = "🌫️"; videoFile = isDay ? 'dia_niebla.mp4' : 'noche_niebla.mp4'; }
            else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) { weatherName = "Lluvia"; weatherEmoji = "🌧️"; videoFile = isDay ? 'dia_lluvia.mp4' : 'noche_lluvia.mp4'; }
            else if ([71, 73, 75, 77, 85, 86].includes(code)) { weatherName = "Nieve"; weatherEmoji = "❄️"; videoFile = isDay ? 'dia_nieve.mp4' : 'noche_nieve.mp4'; }
            else if ([95, 96, 99].includes(code)) { weatherName = "Tormenta"; weatherEmoji = "⛈️"; videoFile = isDay ? 'dia_tormenta.mp4' : 'noche_tormenta.mp4'; }
        } catch (error) { weatherEmoji = "❌"; weatherName = "Clima offline"; }

        statusBox.innerHTML = temperature !== "--" ? `${weatherEmoji} ${weatherName} | ${temperature}°C` : `${weatherEmoji} ${weatherName}`;
        video.src = videoFile; video.play().catch(e => console.log('Autoplay blocked'));

        const videoTexture = new THREE.VideoTexture(video); videoTexture.minFilter = THREE.LinearFilter; videoTexture.magFilter = THREE.LinearFilter; videoTexture.format = THREE.RGBAFormat; videoTexture.encoding = THREE.sRGBEncoding;
        
        loader.load(getFreshUrl('cuadro.glb'), (gltf) => {
            const cuadroModel = gltf.scene;
            cuadroModel.traverse((node) => {
                if (node.isMesh && node.material) {
                    if (Array.isArray(node.material)) { node.material.forEach(mat => { mat.map = videoTexture; mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = videoTexture; mat.emissiveIntensity = 1.0; mat.needsUpdate = true; }); } 
                    else { node.material.map = videoTexture; node.material.emissive = new THREE.Color(0xffffff); node.material.emissiveMap = videoTexture; node.material.emissiveIntensity = 1.0; node.material.needsUpdate = true; }
                }
            });
            materialLogicCallback(cuadroModel, 'cuadro'); scene.add(cuadroModel); loadedMeshesObj['cuadro'] = cuadroModel; checkLoadingCallback();
        }, undefined, () => checkLoadingCallback());
    }
};