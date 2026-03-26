import * as THREE from 'three';
import { State } from './room_state.js';
import { LunariIdle } from './lunari_estado_idle.js';
import { LunariDespertar } from './lunari_estado_despertar.js';
import { LunariJugar } from './lunari_estado_jugar.js';
import { LunariDormir } from './lunari_estado_dormir.js';
import { LunariAfuera } from './lunari_estado_afuera.js';

const statesMap = {
    idle: LunariIdle,
    despertar: LunariDespertar,
    jugar: LunariJugar,
    dormir: LunariDormir,
    afuera: LunariAfuera
};

export const LunariSystem = {
    currentState: null,
    
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
        
        // 1. Horario estricto de sueño
        if (hora >= 22 || hora < 7) { 
            this.setState('dormir', esDeDiaLocal, lastWeatherCode);
            return;
        }

        // 2. Verificamos si YA estaba afuera en una sesión anterior y aún no regresa
        const returnTime = parseInt(localStorage.getItem('room_lunari_return_time') || '0');
        if (returnTime > Date.now()) {
            this.setState('afuera', esDeDiaLocal, lastWeatherCode);
            return;
        }

        // 3. Evaluamos si decidirá salir AHORA mismo
        if (!this.currentState || this.currentState === 'dormir' || this.currentState === 'afuera') {
            
            let probSalir = 0;
            if (hora >= 7 && hora < 12) probSalir = 0.10; // Mañana: 10%
            else if (hora >= 12 && hora < 19) probSalir = 0.50; // Tarde: 50%
            else if (hora >= 19 && hora < 22) probSalir = 0.05; // Noche: 5%

            // Tiramos los dados para ver si se va
            if (Math.random() < probSalir) {
                this.setState('afuera', esDeDiaLocal, lastWeatherCode);
                return;
            }

            // 4. Si decidió quedarse, verificamos memoria de TV y PC
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
    },

    setState(newState, esDeDiaLocal, lastWeatherCode) {
        if (this.currentState === newState) return;
        
        // Lógica de salida del estado actual (apagar TV/PC si se va, por ejemplo)
        if (this.currentState && statesMap[this.currentState].exit) {
            statesMap[this.currentState].exit(this);
        }

        this.currentState = newState;
        this.stateTimer = 0; 
        this.lastIsDay = esDeDiaLocal;
        this.lastWeather = lastWeatherCode;

        // Ocultamos todos los modelos. El nuevo estado activará el suyo si lo necesita.
        for (let key in this.models) {
            if (this.models[key]) this.models[key].visible = false;
        }
        if (this.activeAction) this.activeAction.stop();

        if (!this.onIdleFinishedBound) {
            this.onIdleFinishedBound = (e) => this.onIdleFinished(e);
            this.onDormirFinishedBound = (e) => this.onDormirFinished(e);
        }

        // Lógica de entrada del nuevo estado
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

        // CONTROL DE TIEMPO: 1 Hora exacta para cambiar animaciones
        if (this.currentState && this.currentState !== 'dormir' && this.currentState !== 'afuera') {
            this.stateTimer += delta;
            
            if (this.stateTimer >= 3600) { 
                this.stateTimer = 0;
                
                // Al pasar una hora, tiene la oportunidad de salir
                let probSalir = 0;
                const hora = new Date().getHours();
                if (hora >= 7 && hora < 12) probSalir = 0.10;
                else if (hora >= 12 && hora < 19) probSalir = 0.50;
                else if (hora >= 19 && hora < 22) probSalir = 0.05;

                if (Math.random() < probSalir) {
                    this.setState('afuera', this.lastIsDay, this.lastWeather);
                } else {
                    // Si decide no salir, simplemente cambia de actividad
                    const dayStates = ['idle', 'despertar', 'jugar'].filter(s => s !== this.currentState);
                    const randomState = dayStates[Math.floor(Math.random() * dayStates.length)];
                    this.setState(randomState, this.lastIsDay, this.lastWeather);
                }
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