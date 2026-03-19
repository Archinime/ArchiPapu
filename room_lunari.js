import * as THREE from 'three';
import { TVManager } from './room_tv.js';
import { PCManager } from './room_pc.js'; // <-- Importamos PCManager para manipularlo

export const LunariSystem = {
    currentState: null,
    // Agregamos jugar a la lista
    models: { dormir: null, despertar: null, jugar: null },
    mixers: { dormir: null, despertar: null, jugar: null },
    actions: { dormir_base: null, dormir_random: null, despertar_base: null, jugar_base: null },
    activeAction: null,

    evaluateState(esDeDiaLocal, lastWeatherCode) {
        const hora = new Date().getHours();
        
        // HORARIO ESTRICTO:
        if (hora >= 22 || hora < 7) { 
            // De 10:00 PM a 6:59 AM - Durmiendo
            this.setState('dormir', esDeDiaLocal, lastWeatherCode);
        } else if (hora === 7) { 
            // De 7:00 AM a 7:59 AM (Exactamente 1 HORA) - Despertando en la cama
            this.setState('despertar', esDeDiaLocal, lastWeatherCode);
        } else {
            // De 8:00 AM a 9:59 PM - Jugando en la PC
            this.setState('jugar', esDeDiaLocal, lastWeatherCode);
        }
    },

    setState(newState, esDeDiaLocal, lastWeatherCode) {
        if (this.currentState === newState) return;
        const oldState = this.currentState;
        this.currentState = newState;

        for (let key in this.models) {
            if (this.models[key]) this.models[key].visible = false;
        }
        
        if (this.activeAction) this.activeAction.stop();

        if (newState === 'dormir' && this.models.dormir) {
            this.models.dormir.visible = true;
            this.activeAction = this.actions.dormir_base;
            if (this.activeAction) this.activeAction.play();
        } 
        else if (newState === 'despertar' && this.models.despertar) {
            this.models.despertar.visible = true;
            this.activeAction = this.actions.despertar_base;
            if (this.activeAction) this.activeAction.play();
            
            // Llama a prender la tele.
            TVManager.turnOnAutomatically();
        }
        else if (newState === 'jugar' && this.models.jugar) {
            this.models.jugar.visible = true;
            this.activeAction = this.actions.jugar_base;
            if (this.activeAction) this.activeAction.play();
            
            // Enciende la PC en modo Juego
            PCManager.setGamingMode(true);
        }
        
        // Si deja de jugar, apagamos su video/modo juego de la PC
        if (oldState === 'jugar' && newState !== 'jugar') {
            PCManager.setGamingMode(false);
        }
        
        this.updateLunariText(esDeDiaLocal, lastWeatherCode);
    },

    update(delta) {
        for (let key in this.mixers) {
            if (this.mixers[key]) this.mixers[key].update(delta);
        }
    },

    updateLunariText(isDay, weatherCode) {
        const dialogBox = document.getElementById('dialogue-text');
        if(!dialogBox) return;
        
        if (this.currentState === 'dormir') {
            dialogBox.innerHTML = "Zzz...<br>(Lunari está profundamente dormida)";
            return;
        }
        
        if (this.currentState === 'jugar') {
            dialogBox.innerHTML = "¡Estoy en plena partida en Survev.io!<br>¡Cuidado, no me distraigas o perderé!";
            return;
        }

        // Conversación si solo está "despertando"
        if (!isDay) { 
            dialogBox.innerHTML = "¡Qué noche tan tranquila!<br>¿Deberíamos dormir pronto?";
        } else if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(weatherCode)) {
            dialogBox.innerHTML = "El clima está feo afuera.<br>¡Mejor nos quedamos viendo anime!";
        } else {
            dialogBox.innerHTML = "¡Buenos días!<br>Me quedaré en la cama un ratito más...";
        }
    }
};