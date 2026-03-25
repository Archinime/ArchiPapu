import * as THREE from 'three';
import { TVManager } from './room_tv.js';
import { PCManager } from './room_pc.js';
import { State } from './room_state.js';

export const LunariSystem = {
    currentState: null,
    models: { dormir: null, despertar: null, jugar: null, idle: null },
    mixers: { dormir: null, despertar: null, jugar: null, idle: null },
    actions: { 
        dormir_base: null, 
        dormir_random: null, 
        despertar_base: null, 
        jugar_base: null, 
        idle_base: null, 
        saluda: null, 
        idle_randoms: [],
        idle_click: null, 
        idle_holds: []    
    },
    activeAction: null,
    idleTimer: 0,
    dormirTimer: 0,
    currentIdleIndex: 0,
    holdCooldown: 0, 

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
            if (this.activeAction) this.activeAction.reset().fadeIn(0.5).play();
            this.dormirTimer = 0;
        } 
        else if (newState === 'despertar' && this.models.despertar) {
            this.models.despertar.visible = true;
            this.activeAction = this.actions.despertar_base;
            if (this.activeAction) this.activeAction.reset().fadeIn(0.5).play();
            if (State.isRoomStarted) TVManager.turnOnAutomatically(); 
        }
        else if (newState === 'jugar' && this.models.jugar) {
            this.models.jugar.visible = true;
            this.activeAction = this.actions.jugar_base;
            if (this.activeAction) this.activeAction.reset().fadeIn(0.5).play();
            PCManager.setGamingMode(true);
        }
        else if (newState === 'idle' && this.models.idle) {
            this.models.idle.visible = true;
            this.idleTimer = 0;
            if (this.actions.saluda) {
                this.activeAction = this.actions.saluda;
                this.activeAction.reset().fadeIn(0.5).play();
                this.mixers.idle.addEventListener('finished', this.onIdleFinished);
            } else {
                this.activeAction = this.actions.idle_base;
                if (this.activeAction) this.activeAction.reset().fadeIn(0.5).play();
            }
        }
        
        if (oldState === 'jugar' && newState !== 'jugar') {
            PCManager.setGamingMode(false);
        }
        
        this.updateLunariText(esDeDiaLocal, lastWeatherCode);
    },

    triggerClickAnimation() {
        if (this.currentState === 'idle' && this.activeAction === this.actions.idle_base && this.actions.idle_click) {
            const prevAction = this.activeAction;
            this.activeAction = this.actions.idle_click;
            this.activeAction.reset().play();
            prevAction.crossFadeTo(this.activeAction, 0.8, false);
            this.idleTimer = 0;
            this.mixers.idle.addEventListener('finished', this.onIdleFinished);
        }
    },

    triggerHoldAnimation() {
        if (this.currentState === 'idle' && this.activeAction === this.actions.idle_base && this.actions.idle_holds.length > 0) {
            if (this.holdCooldown > 0) {
                console.log("Animación en enfriamiento. Faltan " + Math.ceil(this.holdCooldown) + "s");
                return; 
            }
            const randomHold = this.actions.idle_holds[Math.floor(Math.random() * this.actions.idle_holds.length)];
            const prevAction = this.activeAction;
            this.activeAction = randomHold;
            
            if (this.activeAction.userData) this.activeAction.userData.triggered = false;

            this.activeAction.reset().play();
            prevAction.crossFadeTo(this.activeAction, 0.8, false);
            this.idleTimer = 0;
            this.holdCooldown = 15;
            this.mixers.idle.addEventListener('finished', this.onIdleFinished);
        }
    },

    onIdleFinished: (event) => {
        if (event.action && event.action.userData) {
            event.action.userData.triggered = false;
        }

        if (event.action === LunariSystem.actions.saluda || 
            LunariSystem.actions.idle_randoms.includes(event.action) ||
            event.action === LunariSystem.actions.idle_click ||
            LunariSystem.actions.idle_holds.includes(event.action)) {
           
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
            event.action.fadeOut(0.5);
            LunariSystem.activeAction = LunariSystem.actions.dormir_base;
            if (LunariSystem.activeAction) LunariSystem.activeAction.reset().fadeIn(0.5).play();
            LunariSystem.dormirTimer = 0;
        }
    },

    createHeartsEffect() {
        const colors = ['#ff00ff', '#00ffff', '#ff1493', '#8a2be2'];
        
        for (let i = 0; i < 20; i++) {
            const heart = document.createElement('div');
            heart.innerHTML = '❤️';
            heart.style.position = 'fixed'; 
            heart.style.left = '50%';
            heart.style.top = '45%';
            heart.style.fontSize = `${Math.random() * 30 + 15}px`;
            
            const color = colors[Math.floor(Math.random() * colors.length)];
            heart.style.color = 'transparent';  
            heart.style.textShadow = `0 0 0 ${color}, 0 0 15px ${color}`;
            
            heart.style.pointerEvents = 'none';
            heart.style.zIndex = '9999';
            heart.style.transition = 'all 2s cubic-bezier(0.25, 1, 0.5, 1)';
            heart.style.transform = `translate(-50%, -50%) scale(0)`;
            heart.style.opacity = '1';

            document.body.appendChild(heart);

            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * 250 + 100;
                const tx = Math.cos(angle) * distance;
                const ty = Math.sin(angle) * distance - 150; 
                heart.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.5) rotate(${Math.random() * 60 - 30}deg)`;
                heart.style.opacity = '0';
            }, 50);

            setTimeout(() => {
                heart.remove();
            }, 2050);
        }
    },

    update(delta) {
        if (!State.isRoomStarted) return;
        if (this.holdCooldown > 0) {
            this.holdCooldown -= delta;
        }

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
                    this.mixers.idle.addEventListener('finished', this.onIdleFinished);
                }
            }
        }

        if (this.currentState === 'dormir' && this.activeAction === this.actions.dormir_base) {
            this.dormirTimer += delta;
            if (this.dormirTimer >= 60) {
                this.dormirTimer = 0;
                if (this.actions.dormir_random) {
                    this.activeAction.fadeOut(0.5);
                    this.activeAction = this.actions.dormir_random;
                    this.activeAction.reset().fadeIn(0.5).play();
                    this.mixers.dormir.addEventListener('finished', this.onDormirFinished);
                }
            }
        }

        if (this.activeAction && this.activeAction.userData && this.activeAction.userData.fileName) {
            // DIFERENCIAR TIEMPOS: 1.5s para beso normal, 2.0s para beso volado
            let triggerTime = 2.0;
            if (this.activeAction.userData.fileName === 'lunari_beso.glb') {
                triggerTime = 1.5;
            }

            if (this.activeAction.time >= triggerTime && !this.activeAction.userData.triggered) {
                this.activeAction.userData.triggered = true; 
                
                if (this.activeAction.userData.fileName === 'lunari_beso_volado.glb') {
                    this.createHeartsEffect();
                } else if (this.activeAction.userData.fileName === 'lunari_beso.glb') {
                    if (window.startCameraZoom) window.startCameraZoom();
                }
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