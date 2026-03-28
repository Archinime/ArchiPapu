import * as THREE from 'three';
import { State, getFreshUrl } from './room_state.js';

export const WeatherSystem = {
    esDeDiaLocal: true,
    lastWeatherCode: 0,
    
    actualizarIluminacion(focoDiaMesh, luzFocoDia, isMobileUA, lunariRef) {
        const hora = new Date().getHours();
        let colorHex, lightInt, emInt, dist;
        
        // Lógica de colores según la hora local del dispositivo
        if (hora >= 6 && hora < 9) { colorHex = 0xffe4b5; lightInt = 0.8; emInt = 0.8; dist = 35; }
        else if (hora >= 9 && hora < 17) { colorHex = 0xffffff; lightInt = 1.5; emInt = 1.5; dist = 50; }
        else if (hora >= 17 && hora < 19) { colorHex = 0xff8c00; lightInt = 0.7; emInt = 0.7; dist = 40; }
        else { colorHex = 0x5566aa; lightInt = 0.25; emInt = 0.25; dist = 25; }

        if (luzFocoDia) { 
            luzFocoDia.color.setHex(colorHex);
            luzFocoDia.intensity = lightInt; 
            luzFocoDia.distance = dist; 
            // La sombra del foco de día depende de si la luz general está prendida
            luzFocoDia.castShadow = State.lightOn; 
        }
        
        if (focoDiaMesh) {
            focoDiaMesh.material.emissive.setHex(colorHex);
            focoDiaMesh.material.emissiveIntensity = emInt;
        }
    },

    // --- NUEVA LÓGICA DE CLIMA SILENCIOSA POR IP ---
    async initClima(lunariRef) {
        const weatherStatus = document.getElementById('weather-status');
        if (weatherStatus) weatherStatus.innerText = '🌍 Detectando ubicación...';

        try {
            // 1. OBTENER COORDENADAS POR IP (Sin pedir permisos molestos al usuario)
            const ipResponse = await fetch('https://get.geojs.io/v1/ip/geo.json');
            if (!ipResponse.ok) throw new Error("Fallo al obtener IP");
            const ipData = await ipResponse.json();
            
            const lat = ipData.latitude;
            const lon = ipData.longitude;
            const ciudad = ipData.city || "tu zona";

            if (weatherStatus) weatherStatus.innerText = '☁️ Sincronizando clima...';

            // 2. CONSULTAR EL CLIMA CON LAS COORDENADAS OBTENIDAS
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
            if (!weatherRes.ok) throw new Error("Fallo al obtener clima");
            const weatherData = await weatherRes.json();

            // 3. ACTUALIZAR ESTADOS
            this.esDeDiaLocal = weatherData.current_weather.is_day === 1;
            this.lastWeatherCode = weatherData.current_weather.weathercode;

            // 4. ACTUALIZAR INTERFAZ Y LUNARI
            if (weatherStatus) {
                // Muestra un pequeño texto con la ciudad detectada por IP si lo deseas
                const icono = this.esDeDiaLocal ? '☀️' : '🌙';
                weatherStatus.innerText = `${icono} Clima en ${ciudad}`;
            }

            if (lunariRef && lunariRef.updateLunariText) {
                lunariRef.updateLunariText(this.esDeDiaLocal, this.lastWeatherCode);
            }

            return { isDay: this.esDeDiaLocal, weatherCode: this.lastWeatherCode };

        } catch (error) {
            console.error("Error en el sistema de clima silencioso:", error);
            if (weatherStatus) weatherStatus.innerText = '⚠️ Error de conexión';
            
            // Valores de respaldo por si falla el internet o los servidores
            this.esDeDiaLocal = new Date().getHours() >= 6 && new Date().getHours() < 18;
            this.lastWeatherCode = 0; // Despejado por defecto
            
            if (lunariRef && lunariRef.updateLunariText) {
                lunariRef.updateLunariText(this.esDeDiaLocal, this.lastWeatherCode);
            }
            
            return { isDay: this.esDeDiaLocal, weatherCode: this.lastWeatherCode };
        }
    }
};