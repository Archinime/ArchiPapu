import * as THREE from 'three';
import { State } from './room_state.js';

export const TVManager = {
    isTvOn: false,
    tvTransitioning: false,
    lastTvClickTime: 0,
    tvScreenMesh: null,
    tvVideo: document.getElementById('tv-video'),
    tvEffectVideoOff: document.createElement('video'),
    tvEffectVideoOn: document.createElement('video'),
    tvTexture: null,
    tvEffectTextureOff: null,
    tvEffectTextureOn: null,
    tvPlaylist: [],
    currentTvIndex: -1,
    audioBotonTV: new Audio('sonido_boton.mp3'),

    init() {
        this.tvEffectVideoOff.src = 'efecto_tele.mp4';
        this.tvEffectVideoOff.crossOrigin = 'anonymous'; 
        this.tvEffectVideoOff.playsInline = true;
        document.body.appendChild(this.tvEffectVideoOff); 
        this.tvEffectVideoOff.style.display = 'none';

        this.tvEffectVideoOn.src = 'efecto_tele - Invertido.mp4'; 
        this.tvEffectVideoOn.crossOrigin = 'anonymous';
        this.tvEffectVideoOn.playsInline = true;
        document.body.appendChild(this.tvEffectVideoOn); 
        this.tvEffectVideoOn.style.display = 'none';

        this.tvTexture = new THREE.VideoTexture(this.tvVideo); 
        this.tvTexture.minFilter = THREE.LinearFilter; 
        this.tvTexture.magFilter = THREE.LinearFilter;
        this.tvTexture.format = THREE.RGBAFormat;
        this.tvTexture.encoding = THREE.sRGBEncoding;

        this.tvEffectTextureOff = new THREE.VideoTexture(this.tvEffectVideoOff); 
        this.tvEffectTextureOff.minFilter = THREE.LinearFilter; 
        this.tvEffectTextureOff.magFilter = THREE.LinearFilter; 
        this.tvEffectTextureOff.format = THREE.RGBAFormat;
        
        this.tvEffectTextureOn = new THREE.VideoTexture(this.tvEffectVideoOn);
        this.tvEffectTextureOn.minFilter = THREE.LinearFilter; 
        this.tvEffectTextureOn.magFilter = THREE.LinearFilter; 
        this.tvEffectTextureOn.format = THREE.RGBAFormat;

        this.setupControls();

        // Preparar la playlist inicial en silencio
        this.updatePlaylist();
        
        // --- NUEVO: Escuchar cuando un video termina para reproducir el siguiente en orden ---
        this.tvVideo.addEventListener('ended', () => {
            if (this.isTvOn && !this.tvTransitioning) {
                // Parámetro false = avanza al siguiente en orden, no de forma aleatoria
                this.playNextTv(false);
            }
        });
    },

    updatePlaylist() {
        this.tvPlaylist = State.inventoryData.videos.equipped.map(id => State.inventoryData.videos.items[id].file);
        if(this.tvPlaylist.length === 0) this.tvVideo.pause();
    },

    playNextTv(random = false) {
        this.updatePlaylist();
        if(this.tvPlaylist.length === 0) return;
        
        // Si es el encendido (random = true), elige aleatoriamente. Si no, va al siguiente en orden.
        this.currentTvIndex = random 
            ? Math.floor(Math.random() * this.tvPlaylist.length) 
            : (this.currentTvIndex + 1) % this.tvPlaylist.length;
            
        this.tvVideo.src = this.tvPlaylist[this.currentTvIndex];
        this.tvVideo.volume = State.gameSettings.volumenTV / 100;
        
        if (this.isTvOn && !this.tvTransitioning) {
            this.tvVideo.play().catch(e => console.warn('User interaction needed', e));
        }
    },

    playButtonSound() { 
        this.audioBotonTV.currentTime = 0; 
        this.audioBotonTV.play().catch(e=>{});
    },

    setupControls() {
        const tvPrevBtn = document.getElementById('tv-prev'), 
              tvPlayPauseBtn = document.getElementById('tv-play-pause'), 
              tvNextBtn = document.getElementById('tv-next'), 
              tvPowerBtn = document.getElementById('tv-power');
              
        tvPrevBtn.onclick = () => { 
            this.playButtonSound(); 
            if (!this.isTvOn || this.tvTransitioning) return; 
            this.updatePlaylist(); 
            if(this.tvPlaylist.length===0)return;
            this.currentTvIndex = (this.currentTvIndex - 1 + this.tvPlaylist.length) % this.tvPlaylist.length; 
            this.tvVideo.src = this.tvPlaylist[this.currentTvIndex]; 
            this.tvVideo.play(); 
        };
        
        tvPlayPauseBtn.onclick = () => { 
            this.playButtonSound();
            if (!this.isTvOn || this.tvTransitioning) return; 
            if(this.tvVideo.paused) this.tvVideo.play(); 
            else this.tvVideo.pause(); 
        };
        
        tvNextBtn.onclick = () => { 
            this.playButtonSound();
            if (this.isTvOn && !this.tvTransitioning) this.playNextTv(false); 
        };

        if (tvPowerBtn) {
            tvPowerBtn.innerText = this.isTvOn ? '🟢' : '🔴';
            tvPowerBtn.addEventListener('click', () => {
                this.playButtonSound();
                if (this.tvTransitioning || !this.tvScreenMesh) return;
                
                this.tvTransitioning = true; 
                this.tvVideo.pause();
                const mats = Array.isArray(this.tvScreenMesh.material) ? this.tvScreenMesh.material : [this.tvScreenMesh.material];
                
                const effectVideo = this.isTvOn ? this.tvEffectVideoOff : this.tvEffectVideoOn; 
                const effectTexture = this.isTvOn ? this.tvEffectTextureOff : this.tvEffectTextureOn;

                mats.forEach(mat => { 
                    mat.map = effectTexture; 
                    mat.emissiveMap = effectTexture; 
                    mat.color.setHex(0xffffff); 
                    mat.emissive.setHex(0xffffff); 
                    mat.emissiveIntensity = 1.0; 
                    mat.needsUpdate = true; 
                });
                
                effectVideo.currentTime = 0; 
                effectVideo.play().catch(e=>{});

                const onEffectEnded = () => {
                    effectVideo.removeEventListener('ended', onEffectEnded);
                    if (this.isTvOn) {
                        this.isTvOn = false;
                        tvPowerBtn.innerText = '🔴'; 
                        tvPowerBtn.style.color = 'red'; 
                        tvPowerBtn.style.textShadow = '0 0 5px red';
                        mats.forEach(mat => { 
                            mat.map = null; 
                            mat.emissiveMap = null; 
                            mat.color.setHex(0x000000); 
                            mat.emissive.setHex(0x000000); 
                            mat.emissiveIntensity = 0; 
                            mat.needsUpdate = true; 
                        });
                    } else {
                        this.isTvOn = true;
                        tvPowerBtn.innerText = '🟢'; 
                        tvPowerBtn.style.color = '#00ff00'; 
                        tvPowerBtn.style.textShadow = '0 0 5px #00ff00';
                        mats.forEach(mat => { 
                            mat.map = this.tvTexture; 
                            mat.emissiveMap = this.tvTexture; 
                            mat.color.setHex(0xffffff); 
                            mat.emissive.setHex(0xffffff); 
                            mat.emissiveIntensity = 1.0; 
                            mat.needsUpdate = true; 
                        });
                        
                        // Si la tele se prendió a mano, seguimos desde donde estaba. Si no, playNextTv() lo hace
                        if (this.tvPlaylist.length > 0 && !this.tvVideo.src) {
                            this.playNextTv(true);
                        } else if (this.tvPlaylist.length > 0) {
                            this.tvVideo.currentTime = 0; 
                            this.tvVideo.play().catch(e=>{});
                        }
                    }
                    this.tvTransitioning = false;
                };
                effectVideo.addEventListener('ended', onEffectEnded, { once: true });
            });
        }
    },

    // --- NUEVO: Encender la tele automáticamente y poner video aleatorio ---
    turnOnAutomatically() {
        if (this.isTvOn || this.tvTransitioning) return;
        
        this.isTvOn = true;
        
        // Actualizar botón UI
        const tvPowerBtn = document.getElementById('tv-power');
        if (tvPowerBtn) {
            tvPowerBtn.innerText = '🟢'; 
            tvPowerBtn.style.color = '#00ff00'; 
            tvPowerBtn.style.textShadow = '0 0 5px #00ff00';
        }

        // Si el mesh de la TV ya está cargado, aplicamos la textura de la tele encendida
        if (this.tvScreenMesh) {
            const mats = Array.isArray(this.tvScreenMesh.material) ? this.tvScreenMesh.material : [this.tvScreenMesh.material];
            mats.forEach(mat => { 
                mat.map = this.tvTexture; 
                mat.emissiveMap = this.tvTexture; 
                mat.color.setHex(0xffffff); 
                mat.emissive.setHex(0xffffff); 
                mat.emissiveIntensity = 1.0; 
                mat.needsUpdate = true; 
            });
        }

        // Reproduce el primer video de manera aleatoria
        this.playNextTv(true);
    },
    
    setVolumes(volTv, volEf) {
        if(this.tvVideo) this.tvVideo.volume = volTv / 100;
        this.tvEffectVideoOff.volume = volEf / 100;
        this.tvEffectVideoOn.volume = volEf / 100;
        this.audioBotonTV.volume = volEf / 100;
    }
};