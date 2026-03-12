import * as THREE from 'three';
import { TVManager } from './room_tv.js';

export const LunariSystem = {
    currentState: null,
    models: { dormir: null, despertar: null },
    mixers: { dormir: null, despertar: null },
    actions: { dormir_base: null, dormir_random: null, despertar_base: null },
    activeAction: null,

    evaluateState(esDeDiaLocal, lastWeatherCode) {
        const hora = new Date().getHours();
        if (hora >= 22 || hora < 7) { 
            this.setState('dormir', esDeDiaLocal, lastWeatherCode);
        } else { 
            this.setState('despertar', esDeDiaLocal, lastWeatherCode);
        }
    },

    setState(newState, esDeDiaLocal, lastWeatherCode) {
        if (this.currentState === newState) return;
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
            
            // Llama a prender la tele. Si no le dimos al botón "Iniciar" aún, el sistema esperará
            TVManager.turnOnAutomatically();
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
        if (!isDay) { 
            dialogBox.innerHTML = "¡Qué noche tan tranquila!<br>¿Deberíamos dormir pronto?";
        } else if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(weatherCode)) {
            dialogBox.innerHTML = "El clima está feo afuera.<br>¡Mejor nos quedamos viendo anime!";
        } else {
            dialogBox.innerHTML = "¡Hola!<br>Bienvenido de nuevo a casa.<br>¿Vemos un anime hoy?";
        }
    }
};