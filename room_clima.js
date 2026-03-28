import * as THREE from 'three';
import { State, getFreshUrl } from './room_state.js';

export const WeatherSystem = {
    esDeDiaLocal: true,
    lastWeatherCode: 0,

    async iniciarClima(focoDiaMesh, luzFocoDia, isMobileUA, lunariRef) {
        const statusDiv = document.getElementById('weather-status');
        
        try {
            if (statusDiv) statusDiv.innerText = "🌍 Detectando ubicación...";
            
            // NUEVO: Obtenemos coordenadas de forma silenciosa mediante IP (Sin pedir permisos)
            const ipGeoResponse = await fetch('https://get.geojs.io/v1/ip/geo.json');
            const ipGeoData = await ipGeoResponse.json();
            
            const lat = ipGeoData.latitude;
            const lon = ipGeoData.longitude;
            
            // Consultamos el clima en Open-Meteo usando las coordenadas de la IP
            const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const weatherData = await weatherResponse.json();
            
            this.lastWeatherCode = weatherData.current_weather.weathercode;
            this.esDeDiaLocal = weatherData.current_weather.is_day === 1;
            
            if (statusDiv) {
                statusDiv.innerText = `🌍 ${ipGeoData.city} | ${this.obtenerEmojiClima(this.lastWeatherCode)}`;
            }

        } catch (error) {
            console.error("Error al obtener el clima por IP:", error);
            if (statusDiv) statusDiv.innerText = "🌍 Clima por defecto";
            
            // Valores por defecto por si falla la conexión
            this.lastWeatherCode = 0; 
            const hora = new Date().getHours();
            this.esDeDiaLocal = (hora >= 6 && hora < 19);
        }

        // Aplicamos la iluminación basándonos en los datos obtenidos (o en la hora por defecto)
        this.actualizarIluminacion(focoDiaMesh, luzFocoDia, isMobileUA, lunariRef);
    },

    actualizarIluminacion(focoDiaMesh, luzFocoDia, isMobileUA, lunariRef) {
        const hora = new Date().getHours();
        let colorHex, lightInt, emInt, dist;
        
        // Lógica de colores por hora (Mantenida intacta)
        if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8; dist = 35; }
        else if (hora >= 9 && hora < 17) { colorHex = 0xffffff; lightInt = 1.5; emInt = 1.5; dist = 50; }
        else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00; lightInt = 0.7; emInt = 0.7; dist = 40; }
        else { colorHex = 0x5566aa; lightInt = 0.25; emInt = 0.25; dist = 25; }

        if (luzFocoDia) { 
            luzFocoDia.color.setHex(colorHex);
            luzFocoDia.intensity = lightInt; 
            luzFocoDia.distance = dist; 
            // Validamos que exista la configuración para no romper nada
            luzFocoDia.castShadow = State.gameSettings ? State.gameSettings.sombras !== false : true;
        }

        if (focoDiaMesh) {
            focoDiaMesh.traverse(child => {
                if (child.isMesh && child.material) {
                    // Si el material es un arreglo, aplicamos a todos
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.emissive.setHex(colorHex);
                            mat.emissiveIntensity = emInt;
                            mat.needsUpdate = true;
                        });
                    } else {
                        child.material.emissive.setHex(colorHex);
                        child.material.emissiveIntensity = emInt;
                        child.material.needsUpdate = true;
                    }
                }
            });
        }

        // Le avisamos al sistema de Lunari para que actualice sus diálogos basados en el clima
        if (lunariRef && lunariRef.evaluateState) {
            lunariRef.evaluateState(this.esDeDiaLocal, this.lastWeatherCode);
        }
    },

    obtenerEmojiClima(code) {
        // Códigos WMO de Open-Meteo
        if (code === 0) return "☀️";
        if (code >= 1 && code <= 3) return "⛅";
        if (code >= 45 && code <= 48) return "🌫️";
        if (code >= 51 && code <= 67) return "🌧️";
        if (code >= 71 && code <= 77) return "❄️";
        if (code >= 80 && code <= 82) return "🌦️";
        if (code >= 95) return "⛈️";
        return "☁️";
    }
};