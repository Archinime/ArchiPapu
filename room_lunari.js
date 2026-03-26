import * as THREE from 'three';
import { State } from './room_state.js';
import { LunariIdle } from './lunari_estado_idle.js';
import { LunariDespertar } from './lunari_estado_despertar.js';
import { LunariJugar } from './lunari_estado_jugar.js';
import { LunariDormir } from './lunari_estado_dormir.js';

// Mapa de los módulos de estados
const statesMap = {
    idle: LunariIdle,
    despertar: LunariDespertar,
    jugar: LunariJugar,
    dormir: LunariDormir
};

export const LunariSystem = {
    currentState: null,
    
    // Contenedores de Three.js (No se tocan, room_main.js los llena)
    models: { dormir: null, despertar: null, jugar: null, idle: null },
    mixers: { dormir: null, despertar: null, jugar: null, idle: null },
    actions: { 
        dormir_base: null, dormir_random: null, 
        despertar_base: null, 
        jugar_base: null, 
        idle_base: null, saluda: null, idle_randoms: [], idle_click: null, idle_holds: []    
    },
    
    activeAction: null,
    idleTimer: 0,
    dormirTimer: 0,
    currentIdleIndex: 0,
    holdCooldown: 0, 
    
    stateTimer: 0,
    lastIsDay: true,
    lastWeather: 0,

    audioBeso: new Audio('sonido_beso.mp3'),
    audioCorazon: new Audio('sonido_corazon.mp3'),

    evaluateState(esDeDiaLocal, lastWeatherCode, intervalTick = false) {
        this.lastIsDay = esDeDiaLocal;
        this.lastWeather = lastWeatherCode;
        const hora = new Date().getHours();
        
        if (hora >= 22 || hora < 7) { 
            this.setState('dormir', esDeDiaLocal, lastWeatherCode);
        } else {
            if (!this.currentState || this.currentState === 'dormir') {
                const tvWasOn = localStorage.getItem('room_tv_on') === 'true';
                const pcWasOn = localStorage.getItem('room_pc_on') === 'true';
                let chosenState = 'idle';

                if (tvWasOn && pcWasOn) chosenState = Math.random() < 0.5 ? 'despertar' : 'jugar';
                else if (tvWasOn) chosenState = 'despertar';
                else if (pcWasOn) chosenState = 'jugar';
                else {
                    const statesList = ['idle', 'despertar', 'jugar'];
                    chosenState = statesList[Math.floor(Math.random() * statesList.length)];
                }
                
                this.setState(chosenState, esDeDiaLocal, lastWeatherCode);
            }
        }
    },

    setState(newState, esDeDiaLocal, lastWeatherCode) {
        if (this.currentState === newState) return;
        
        // Ejecutamos la lógica de salida del estado anterior
        if (this.currentState && statesMap[this.currentState].exit) {
            statesMap[this.currentState].exit(this);
        }

        this.currentState = newState;
        this.stateTimer = 0; 
        this.lastIsDay = esDeDiaLocal;
        this.lastWeather = lastWeatherCode;

        for (let key in this.models) {
            if (this.models[key]) this.models[key].visible = false;
        }
        if (this.activeAction) this.activeAction.stop();

        // Vinculamos los eventos de animación una sola vez
        if (!this.onIdleFinishedBound) {
            this.onIdleFinishedBound = (e) => this.onIdleFinished(e);
            this.onDormirFinishedBound = (e) => this.onDormirFinished(e);
        }

        // Ejecutamos la lógica de entrada del nuevo estado
        if (statesMap[newState].enter) {
            statesMap[newState].enter(this);
        }

        this.updateLunariText(esDeDiaLocal, lastWeatherCode);
    },

    complainAboutTV() {
        if (this.currentState === 'despertar' && statesMap.despertar.complainAboutTV) {
            statesMap.despertar.complainAboutTV(this);
        }
    },

    triggerClickAnimation() {
        if (this.currentState === 'idle' && this.activeAction === this.actions.idle_base && this.actions.idle_click) {
            const prevAction = this.activeAction;
            this.activeAction = this.actions.idle_click;
            this.activeAction.reset().play();
            prevAction.crossFadeTo(this.activeAction, 0.8, false);
            this.idleTimer = 0;
        }
    },

    triggerHoldAnimation() {
        if (this.currentState === 'idle' && this.activeAction === this.actions.idle_base && this.actions.idle_holds.length > 0) {
            if (this.holdCooldown > 0) return; 
            
            const randomHold = this.actions.idle_holds[Math.floor(Math.random() * this.actions.idle_holds.length)];
            const prevAction = this.activeAction;
            
            if (randomHold.userData) randomHold.userData.triggered = false;

            this.activeAction = randomHold;
            this.activeAction.reset().play();
            prevAction.crossFadeTo(this.activeAction, 0.8, false);
            this.idleTimer = 0;
            this.holdCooldown = 15;
        }
    },

    onIdleFinished(event) {
        if (statesMap.idle.onFinished) statesMap.idle.onFinished(this, event);
    },

    onDormirFinished(event) {
        if (statesMap.dormir.onFinished) statesMap.dormir.onFinished(this, event);
    },

    update(delta) {
        if (!State.isRoomStarted) return;
        
        if (this.holdCooldown > 0) this.holdCooldown -= delta;

        for (let key in this.mixers) {
            if (this.mixers[key]) this.mixers[key].update(delta);
        }

        // CONTROL DE TIEMPO: 1 Hora exacta (3600 segundos) para cambiar animaciones de día
        if (this.currentState && this.currentState !== 'dormir') {
            this.stateTimer += delta;
            if (this.stateTimer >= 3600) { 
                this.stateTimer = 0;
                const dayStates = ['idle', 'despertar', 'jugar'].filter(s => s !== this.currentState);
                const randomState = dayStates[Math.floor(Math.random() * dayStates.length)];
                this.setState(randomState, this.lastIsDay, this.lastWeather);
            }
        }

        // Delegamos el update al estado activo
        if (this.currentState && statesMap[this.currentState].update) {
            statesMap[this.currentState].update(this, delta);
        }
    },

    updateLunariText(isDay, weatherCode) {
        const dialogBox = document.getElementById('dialogue-text');
        if(!dialogBox) return;
        
        if (this.currentState && statesMap[this.currentState].getDialogue) {
            dialogBox.innerHTML = statesMap[this.currentState].getDialogue(isDay, weatherCode);
        }
    }
};