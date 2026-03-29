import * as THREE from 'three';
import { State } from './room_state.js';
import { PCManager } from './room_pc.js';
import { LunariSystem } from './room_lunari.js';

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
    
    hasInteracted: false, 
    pendingAutoTurnOn: false, 

    init() {
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

        this.tvTexture = new THREE.VideoTexture(this.tvVideo);
        this.tvTexture.minFilter = THREE.LinearFilter;
        this.tvTexture.magFilter = THREE.LinearFilter;
        this.tvTexture.format = THREE.RGBAFormat;
        this.tvTexture.encoding = THREE.sRGBEncoding;
        this.tvTexture.generateMipmaps = false; // OPTIMIZADO

        this.tvEffectTextureOff = new THREE.VideoTexture(this.tvEffectVideoOff);
        this.tvEffectTextureOff.minFilter = THREE.LinearFilter;
        this.tvEffectTextureOff.magFilter = THREE.LinearFilter;
        this.tvEffectTextureOff.format = THREE.RGBAFormat;
        this.tvEffectTextureOff.encoding = THREE.sRGBEncoding;
        this.tvEffectTextureOff.generateMipmaps = false; // OPTIMIZADO

        this.tvEffectTextureOn = new THREE.VideoTexture(this.tvEffectVideoOn);
        this.tvEffectTextureOn.minFilter = THREE.LinearFilter;
        this.tvEffectTextureOn.magFilter = THREE.LinearFilter;
        this.tvEffectTextureOn.format = THREE.RGBAFormat;
        this.tvEffectTextureOn.encoding = THREE.sRGBEncoding;
        this.tvEffectTextureOn.generateMipmaps = false; // OPTIMIZADO

        this.updatePlaylist();
        this.setupUI();
        
        const savedTvState = localStorage.getItem('room_tv_on');
        if (savedTvState === 'true') {
            this.turnOnAutomatically();
        }
    },

    updatePlaylist() {
        const tvEquipped = State.inventoryData.tele.equipped;
        this.tvPlaylist = [];
        tvEquipped.forEach(id => {
            const item = State.inventoryData.tele.items[id];
            if (item && item.file && item.file.endsWith('.mp4')) this.tvPlaylist.push(item.file);
        });
        if (this.tvPlaylist.length > 0) {
            if (this.currentTvIndex >= this.tvPlaylist.length) this.currentTvIndex = 0;
            if (this.currentTvIndex === -1) this.currentTvIndex = 0;
            this.tvVideo.src = this.tvPlaylist[this.currentTvIndex];
            if (this.isTvOn && !this.tvTransitioning) {
                this.tvVideo.play().catch(() => {});
            }
        } else {
            this.currentTvIndex = -1;
            this.tvVideo.src = "";
            if (this.isTvOn && !this.tvTransitioning) {
                this.applyEffectAndTurnOff();
            }
        }
    },

    setupUI() {
        const tvControls = document.getElementById('tv-controls');
        const tvPowerBtn = document.getElementById('tv-power');
        const tvNextBtn = document.getElementById('tv-next');

        if (tvPowerBtn) {
            tvPowerBtn.onclick = () => {
                const now = Date.now();
                if (now - this.lastTvClickTime < 1000 || this.tvTransitioning) return;
                this.lastTvClickTime = now;
                
                this.playButtonSound();

                if (!this.isTvOn) {
                    if (this.tvPlaylist.length === 0) {
                        alert("¡Equipa al menos un canal (video) en la tienda para ver la tele!");
                        return;
                    }
                    this.isTvOn = true;
                    this.tvTransitioning = true;
                    localStorage.setItem('room_tv_on', 'true');
                    
                    tvPowerBtn.innerText = '🟢';
                    tvPowerBtn.style.color = '#00ff00';
                    tvPowerBtn.style.textShadow = '0 0 5px #00ff00';
                    tvControls.style.display = 'none';

                    if (this.tvScreenMesh) {
                        const mats = Array.isArray(this.tvScreenMesh.material) ? this.tvScreenMesh.material : [this.tvScreenMesh.material];
                        mats.forEach(mat => {
                            mat.map = this.tvEffectTextureOn;
                            mat.emissiveMap = this.tvEffectTextureOn;
                            mat.color.setHex(0xffffff);
                            mat.emissive.setHex(0xffffff);
                            mat.emissiveIntensity = 1.0;
                            mat.needsUpdate = true;
                        });
                    }
                    
                    this.tvEffectVideoOn.currentTime = 0;
                    this.tvEffectVideoOn.play().catch(e => console.log('Effect blocked', e));
                    
                    const onEffectEnded = () => {
                        this.tvTransitioning = false;
                        if (this.tvScreenMesh && this.isTvOn) {
                            const mats = Array.isArray(this.tvScreenMesh.material) ? this.tvScreenMesh.material : [this.tvScreenMesh.material];
                            mats.forEach(mat => { mat.map = this.tvTexture; mat.emissiveMap = this.tvTexture; mat.needsUpdate = true; });
                        }
                        this.tvVideo.play().catch(e => console.log('Video blocked', e));
                    };
                    this.tvEffectVideoOn.addEventListener('ended', onEffectEnded, { once: true });
                } else {
                    if (LunariSystem.currentState === 'despertar') {
                        if (LunariSystem.actions.despertar_base && LunariSystem.actions.despertar_base.isRunning()) {
                            LunariSystem.complainAboutTV(LunariSystem);
                            tvControls.style.display = 'none';
                            this.isTvOn = true; 
                            localStorage.setItem('room_tv_on', 'true');
                            return; 
                        }
                    }

                    this.applyEffectAndTurnOff();
                }
            };
        }

        if (tvNextBtn) {
            tvNextBtn.onclick = () => {
                if (!this.isTvOn || this.tvTransitioning || this.tvPlaylist.length <= 1) return;
                
                if (LunariSystem.currentState === 'despertar') {
                    if (LunariSystem.actions.despertar_base && LunariSystem.actions.despertar_base.isRunning()) {
                        LunariSystem.complainAboutTV(LunariSystem);
                        tvControls.style.display = 'none';
                        return;
                    }
                }

                this.playButtonSound();
                this.currentTvIndex = (this.currentTvIndex + 1) % this.tvPlaylist.length;
                this.tvVideo.src = this.tvPlaylist[this.currentTvIndex];
                
                this.tvTransitioning = true;
                this.tvVideo.pause();
                
                if (this.tvScreenMesh) {
                    const mats = Array.isArray(this.tvScreenMesh.material) ? this.tvScreenMesh.material : [this.tvScreenMesh.material];
                    mats.forEach(mat => { mat.map = this.tvEffectTextureOn; mat.emissiveMap = this.tvEffectTextureOn; mat.needsUpdate = true; });
                }
                
                this.tvEffectVideoOn.currentTime = 0;
                this.tvEffectVideoOn.play().catch(e => console.log('Effect blocked', e));
                
                const onEffectEnded = () => {
                    this.tvTransitioning = false;
                    if (this.tvScreenMesh && this.isTvOn) {
                        const mats = Array.isArray(this.tvScreenMesh.material) ? this.tvScreenMesh.material : [this.tvScreenMesh.material];
                        mats.forEach(mat => { mat.map = this.tvTexture; mat.emissiveMap = this.tvTexture; mat.needsUpdate = true; });
                    }
                    this.tvVideo.play().catch(e => console.log('Video blocked', e));
                };
                this.tvEffectVideoOn.addEventListener('ended', onEffectEnded, { once: true });
            };
        }
    },

    applyEffectAndTurnOff() {
        this.isTvOn = false;
        this.tvTransitioning = true;
        localStorage.setItem('room_tv_on', 'false');
        
        const tvPowerBtn = document.getElementById('tv-power');
        if(tvPowerBtn) {
            tvPowerBtn.innerText = '🔴';
            tvPowerBtn.style.color = 'red';
            tvPowerBtn.style.textShadow = '0 0 5px red';
        }
        const tvControls = document.getElementById('tv-controls');
        if(tvControls) tvControls.style.display = 'none';

        this.tvVideo.pause();

        if (this.tvScreenMesh) {
            const mats = Array.isArray(this.tvScreenMesh.material) ? this.tvScreenMesh.material : [this.tvScreenMesh.material];
            mats.forEach(mat => {
                mat.map = this.tvEffectTextureOff;
                mat.emissiveMap = this.tvEffectTextureOff;
                mat.needsUpdate = true;
            });
        }

        this.tvEffectVideoOff.currentTime = 0;
        this.tvEffectVideoOff.play().catch(e => console.log('Effect blocked', e));

        const onEffectEnded = () => {
            this.tvTransitioning = false;
            if (this.tvScreenMesh && !this.isTvOn) {
                const mats = Array.isArray(this.tvScreenMesh.material) ? this.tvScreenMesh.material : [this.tvScreenMesh.material];
                mats.forEach(mat => {
                    mat.map = null;
                    mat.emissiveMap = null;
                    mat.color.setHex(0x111111);
                    mat.emissive.setHex(0x000000);
                    mat.emissiveIntensity = 0.0;
                    mat.needsUpdate = true;
                });
            }
        };
        this.tvEffectVideoOff.addEventListener('ended', onEffectEnded, { once: true });
    },

    turnOnAutomatically() {
        if (!this.hasInteracted) {
            this.pendingAutoTurnOn = true;
            return; 
        }

        this.pendingAutoTurnOn = false;
        if (this.isTvOn || this.tvTransitioning) return;
        
        this.isTvOn = true;
        localStorage.setItem('room_tv_on', 'true');
        
        const tvPowerBtn = document.getElementById('tv-power');
        if (tvPowerBtn) {
            tvPowerBtn.innerText = '🟢';
            tvPowerBtn.style.color = '#00ff00'; 
            tvPowerBtn.style.textShadow = '0 0 5px #00ff00';
        }

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

        if (this.tvPlaylist.length > 0) {
            this.tvVideo.play().catch(e => console.log('Auto-play blocked', e));
        }
    },

    setVolume(volTV, volEf) {
        this.audioBotonTV.volume = volEf / 100;
        this.tvVideo.volume = volTV / 100;
    },

    playButtonSound() {
        if (PCManager.canPlayAudio) { 
            this.audioBotonTV.currentTime = 0;
            this.audioBotonTV.play().catch(e => console.log('Audio error:', e));
        }
    }
};