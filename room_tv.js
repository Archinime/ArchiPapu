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
        // Configuraciones vitales para móviles (playsInline)
        this.tvEffectVideoOff.src = 'efecto_tele.mp4';
        this.tvEffectVideoOff.crossOrigin = 'anonymous'; 
        this.tvEffectVideoOff.playsInline = true;
        this.tvEffectVideoOff.setAttribute('playsinline', '');
        document.body.appendChild(this.tvEffectVideoOff); 
        this.tvEffectVideoOff.style.display = 'none';

        this.tvEffectVideoOn.src = 'efecto_tele - Invertido.mp4'; 
        this.tvEffectVideoOn.crossOrigin = 'anonymous';
        this.tvEffectVideoOn.playsInline = true;
        this.tvEffectVideoOn.setAttribute('playsinline', '');
        document.body.appendChild(this.tvEffectVideoOn); 
        this.tvEffectVideoOn.style.display = 'none';

        // Asegurarnos que la TV principal también tenga playsInline (Obligatorio en iOS)
        this.tvVideo.playsInline = true;
        this.tvVideo.setAttribute('playsinline', '');
        this.tvVideo.setAttribute('webkit-playsinline', '');

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

        // Preparar la playlist inicial
        this.updatePlaylist();
        
        // Escuchar cuando un video termina para reproducir el siguiente en orden
        this.tvVideo.addEventListener('ended', () => {
            if (this.isTvOn && !this.tvTransitioning) {
                // Parámetro false = avanza al siguiente en orden
                this.playNextTv(false);
            }
        });
    },

    updatePlaylist() {
        this.tvPlaylist = State.inventoryData.videos.equipped.map(id => State.inventoryData.videos.items[id].file);
        if(this.tvPlaylist.length === 0) this.tvVideo.pause();
    },

    // NUEVA FUNCIÓN: Sistema anti-bloqueo para Celulares/Tablets
    attemptToPlay() {
        // Asegurar volumen normal si no está silenciado
        if (!this.tvVideo.muted) {
            this.tvVideo.volume = State.gameSettings.volumenTV / 100;
        }

        const playPromise = this.tvVideo.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // Reproducción exitosa de forma normal (En PC funciona directo)
            }).catch(error => {
                console.warn('Autoplay bloqueado por el celular. Forzando inicio en silencio...', error);
                
                // Si el celular bloquea el video, lo silenciamos y forzamos el inicio visual
                this.tvVideo.muted = true;
                this.tvVideo.play().then(() => {
                    
                    // Función que se dispara apenas el usuario toque la pantalla para DEVOLVER EL SONIDO
                    const unmuteOnInteract = () => {
                        this.tvVideo.muted = false;
                        this.tvVideo.volume = State.gameSettings.volumenTV / 100;
                        
                        // Limpiar los eventos de toque
                        document.removeEventListener('pointerdown', unmuteOnInteract);
                        document.removeEventListener('touchstart', unmuteOnInteract);
                        document.removeEventListener('click', unmuteOnInteract);
                    };
                    
                    // Esperamos cualquier toque o clic en la pantalla
                    document.addEventListener('pointerdown', unmuteOnInteract);
                    document.addEventListener('touchstart', unmuteOnInteract);
                    document.addEventListener('click', unmuteOnInteract);
                    
                }).catch(e => console.error('Fallo crítico al reproducir en móvil:', e));
            });
        }
    },

    playNextTv(random = false) {
        this.updatePlaylist();
        if(this.tvPlaylist.length === 0) return;
        
        // Selección de índice (aleatorio al prender, en orden para los siguientes)
        this.currentTvIndex = random 
            ? Math.floor(Math.random() * this.tvPlaylist.length) 
            : (this.currentTvIndex + 1) % this.tvPlaylist.length;
            
        this.tvVideo.src = this.tvPlaylist[this.currentTvIndex];
        
        if (this.isTvOn && !this.tvTransitioning) {
            this.attemptToPlay();
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
            this.tvVideo.muted = false; // Restablecer sonido manual
            this.attemptToPlay(); 
        };
        
        tvPlayPauseBtn.onclick = () => { 
            this.playButtonSound();
            if (!this.isTvOn || this.tvTransitioning) return; 
            if(this.tvVideo.paused) {
                this.tvVideo.muted = false;
                this.attemptToPlay();
            } else {
                this.tvVideo.pause(); 
            }
        };
        
        tvNextBtn.onclick = () => { 
            this.playButtonSound();
            if (this.isTvOn && !this.tvTransitioning) {
                this.tvVideo.muted = false;
                this.playNextTv(false); 
            }
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
                        
                        // Si la tele se prendió a mano
                        this.tvVideo.muted = false;
                        if (this.tvPlaylist.length > 0 && !this.tvVideo.src) {
                            this.playNextTv(true);
                        } else if (this.tvPlaylist.length > 0) {
                            this.tvVideo.currentTime = 0; 
                            this.attemptToPlay();
                        }
                    }
                    this.tvTransitioning = false;
                };
                effectVideo.addEventListener('ended', onEffectEnded, { once: true });
            });
        }
    },

    // Encender la tele automáticamente desde LunariSystem
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

        // Si el mesh de la TV ya está cargado, aplicamos la textura
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

        // Inicia el video automáticamente con la lógica de Móvil
        this.playNextTv(true);
    },
    
    setVolumes(volTv, volEf) {
        if(this.tvVideo) this.tvVideo.volume = volTv / 100;
        this.tvEffectVideoOff.volume = volEf / 100;
        this.tvEffectVideoOn.volume = volEf / 100;
        this.audioBotonTV.volume = volEf / 100;
    }
};