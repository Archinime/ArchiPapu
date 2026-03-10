import { state, scene, mainLight, ambient, hemiLight, audioPrenderLuz, audioApagarLuz } from './core.js';
import { updateLunariText } from './lunari.js';  // se definirá después

export function updateLighting() {
    if (state.lightOn) {
        mainLight.visible = true;
        ambient.intensity = state.gameSettings.calidad === 'baja' ? 0.8 : 0.3;
        hemiLight.intensity = state.gameSettings.calidad === 'baja' ? 0.8 : 0.4;
        document.getElementById('light-status').innerText = '💡 Luz encendida';
        if (state.focoMesh) {
            state.focoMesh.traverse((n) => {
                if (n.isMesh && n.material) n.material.emissiveIntensity = 1.5;
            });
        }
    } else {
        mainLight.visible = false;
        ambient.intensity = 0.02;
        hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
        if (state.focoMesh) {
            state.focoMesh.traverse((n) => {
                if (n.isMesh && n.material) n.material.emissiveIntensity = 0;
            });
        }
    }
}

export function toggleLight() {
    state.lightOn = !state.lightOn;
    localStorage.setItem('lightState', state.lightOn ? 'on' : 'off');
    updateLighting();
    if (state.lightOn) {
        audioPrenderLuz.currentTime = 0;
        audioPrenderLuz.play().catch(e => {});
    } else {
        audioApagarLuz.currentTime = 0;
        audioApagarLuz.play().catch(e => {});
    }
}

// Iluminación del foco de día (clima)
export function actualizarIluminacionFocoDia() {
    const hora = new Date().getHours();
    let colorHex, lightInt, emInt, dist;
    if (hora >= 6 && hora < 9) {
        colorHex = 0xffe4b5;
        lightInt = 0.8;
        emInt = 0.8;
        dist = 35;
    } else if (hora >= 9 && hora < 17) {
        colorHex = 0xffffff;
        lightInt = 1.5;
        emInt = 1.5;
        dist = 50;
    } else if (hora >= 17 && hora < 19) {
        colorHex = 0xff8c00;
        lightInt = 0.7;
        emInt = 0.7;
        dist = 40;
    } else {
        colorHex = 0x5566aa;
        lightInt = 0.25;
        emInt = 0.25;
        dist = 25;
    }

    if (state.luzFocoDia) {
        state.luzFocoDia.color.setHex(colorHex);
        state.luzFocoDia.intensity = lightInt;
        state.luzFocoDia.distance = dist;
        state.luzFocoDia.castShadow = state.gameSettings.sombras > 0;
    }
    if (state.focoDiaMesh) {
        state.focoDiaMesh.traverse((n) => {
            if (n.isMesh && n.material) {
                n.material.emissive.setHex(colorHex);
                n.material.emissiveIntensity = emInt;
                n.material.needsUpdate = true;
            }
        });
    }
    updateLunariText(state.esDeDiaLocal, state.lastWeatherCode);
}

// Ejecutar cada minuto
setInterval(actualizarIluminacionFocoDia, 60000);