import * as THREE from 'three';
import { TVManager } from './room_tv.js';
import { PCManager } from './room_pc.js';
import { State } from './room_state.js';

export const LunariSystem = {
    currentState: null,
    models: { dormir: null, despertar: null, jugar: null, idle: null },
    mixers: { dormir: null, despertar: null, jugar: null, idle: null },
    actions: { dormir_base: null, dormir_random: null, despertar_base: null, jugar_base: null, idle_base: null, saluda: null, idle_randoms: [] },
    activeAction: null,
    idleTimer: 0,
    dormirTimer: 0,
    currentIdleIndex: 0, 

    // Variables para el sistema de clics interactivos
    clickCount: 0,
    lastClickTime: 0,
    lastForceTime: 0,

    evaluateState(esDeDiaLocal, lastWeatherCode, intervalTick = false) {
        const hora = new Date().getHours();
        if (hora >= 22 || hora < 7) { 
            this.setState('dormir', esDeDiaLocal, lastWeatherCode);
        } else {
            if (!this.currentState || this.currentState === 'dormir') {
                this.setState('idle', esDeDiaLocal, lastWeatherCode);
            } else if (intervalTick && State.isRoomStarted) {
                if (Math.random() < 0.20) {
                    const dayStates = ['idle', 'despertar', 'jugar'];
                    const randomState = dayStates[Math.floor(Math.random() * dayStates.length)];
                    this.setState(randomState, esDeDiaLocal, lastWeatherCode);
                }
            }
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
        if (this.mixers.idle) this.mixers.idle.removeEventListener('finished', this.onIdleFinished);
        if (this.mixers.dormir) this.mixers.dormir.removeEventListener('finished', this.onDormirFinished);

        if (newState === 'dormir' && this.models.dormir) {
            this.models.dormir.visible = true;
            this.activeAction = this.actions.dormir_base;
            // CORRECCIÓN T-POSE: Arranca directo con reset().play() sin fadeIn()
            if (this.activeAction) this.activeAction.reset().play();
            this.dormirTimer = 0;
        } 
        else if (newState === 'despertar' && this.models.despertar) {
            this.models.despertar.visible = true;
            this.activeAction = this.actions.despertar_base;
            // CORRECCIÓN T-POSE
            if (this.activeAction) this.activeAction.reset().play();
            if (State.isRoomStarted) TVManager.turnOnAutomatically(); 
        }
        else if (newState === 'jugar' && this.models.jugar) {
            this.models.jugar.visible = true;
            this.activeAction = this.actions.jugar_base;
            // CORRECCIÓN T-POSE
            if (this.activeAction) this.activeAction.reset().play();
            PCManager.setGamingMode(true);
        }
        else if (newState === 'idle' && this.models.idle) {
            this.models.idle.visible = true;
            this.idleTimer = 0;
            if (this.actions.saluda) {
                this.activeAction = this.actions.saluda;
                // CORRECCIÓN T-POSE
                this.activeAction.reset().play();
                this.mixers.idle.addEventListener('finished', this.onIdleFinished);
            } else {
                this.activeAction = this.actions.idle_base;
                // CORRECCIÓN T-POSE
                if (this.activeAction) this.activeAction.reset().play();
            }
        }
        
        if (oldState === 'jugar' && newState !== 'jugar') {
            PCManager.setGamingMode(false);
        }
        
        this.updateLunariText(esDeDiaLocal, lastWeatherCode);
    },

    onIdleFinished: (event) => {
        if (event.action === LunariSystem.actions.saluda || LunariSystem.actions.idle_randoms.includes(event.action)) {
            const prevAction = event.action;
            const nextAction = LunariSystem.actions.idle_base;
            
            LunariSystem.activeAction = nextAction;
            if (LunariSystem.activeAction) {
                LunariSystem.activeAction.reset().play();
                prevAction.crossFadeTo(LunariSystem.activeAction, 0.8, false);
            }
            LunariSystem.idleTimer = 0;
        }
    },

    onDormirFinished: (event) => {
        if (event.action === LunariSystem.actions.dormir_random) {
            const prevAction = event.action;
            LunariSystem.activeAction = LunariSystem.actions.dormir_base;
            if (LunariSystem.activeAction) {
                LunariSystem.activeAction.reset().play();
                // Usamos crossFadeTo para una transición suave entre animaciones del mismo modelo
                prevAction.crossFadeTo(LunariSystem.activeAction, 0.5, false);
            }
            LunariSystem.dormirTimer = 0;
        }
    },

    // NUEVO: Manejo de clics múltiples
    handleClick() {
        if (this.currentState !== 'dormir') return;
        
        const now = performance.now();
        
        // Cooldown de 6 segundos después de forzarlo
        if (now - this.lastForceTime < 6000) return;
        
        // Reiniciar clics si pasó más de 1 segundo desde el último
        if (now - this.lastClickTime > 1000) {
            this.clickCount = 0;
        }
        
        this.clickCount++;
        this.lastClickTime = now;
        
        // Forzar al hacer 3 toques/clics rápidos
        if (this.clickCount >= 3) {
            this.clickCount = 0;
            this.forceDormirRandom();
        }
    },

    forceDormirRandom() {
        if (!this.actions.dormir_random || this.activeAction === this.actions.dormir_random) return;
        
        this.lastForceTime = performance.now();
        this.dormirTimer = 0; // Reiniciamos el temporizador normal
        
        const prevAction = this.activeAction;
        this.activeAction = this.actions.dormir_random;
        this.activeAction.reset().play();
        prevAction.crossFadeTo(this.activeAction, 0.5, false);
        
        this.mixers.dormir.addEventListener('finished', this.onDormirFinished);
    },

    update(delta) {
        if (!State.isRoomStarted) return; 

        for (let key in this.mixers) {
            if (this.mixers[key]) this.mixers[key].update(delta);
        }

        if (this.currentState === 'idle' && this.activeAction === this.actions.idle_base) {
            this.idleTimer += delta;
            if (this.idleTimer >= 30) {
                this.idleTimer = 0;
                if (this.actions.idle_randoms.length > 0) {
                    const nextAction = this.actions.idle_randoms[this.currentIdleIndex];
                    this.currentIdleIndex = (this.currentIdleIndex + 1) % this.actions.idle_randoms.length;

                    const prevAction = this.activeAction;
                    this.activeAction = nextAction;
                    this.activeAction.reset().play();
                    prevAction.crossFadeTo(this.activeAction, 0.8, false);
                }
            }
        }

        if (this.currentState === 'dormir' && this.activeAction === this.actions.dormir_base) {
            this.dormirTimer += delta;
            if (this.dormirTimer >= 60) {
                // Reutilizamos la función del clic para que la lógica fluida sea la misma
                this.forceDormirRandom();
            }
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
        if (this.currentState === 'idle') {
            dialogBox.innerHTML = "¡Hola!<br>Qué bueno verte por aquí.<br>¿Qué hacemos hoy?";
            return;
        }

        if (!isDay) { 
            dialogBox.innerHTML = "¡Qué noche tan tranquila!<br>¿Deberíamos dormir pronto?";
        } else if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(weatherCode)) {
            dialogBox.innerHTML = "El clima está feo afuera.<br>¡Mejor nos quedamos viendo anime!";
        } else {
            dialogBox.innerHTML = "¡Buenos días!<br>Me quedaré en la cama un ratito más...";
        }
    }
};