import * as THREE from 'three';

export const PCManager = {
    isPcOn: false,
    pcTransitioning: false,
    lastPcClickTime: 0,
    pcScreenMeshes: [], 
    audioBotonPC: new Audio('sonido_boton.mp3'),
    
    isGamingMode: false,
    canPlayAudio: false, 
    survVideo: document.createElement('video'),
    survVideoTexture: null,
    logoTexture: null, 
    
    init() {
        this.survVideo.src = 'surv.mp4';
        this.survVideo.loop = true;
        this.survVideo.muted = true; 
        this.survVideo.playsInline = true;
        this.survVideo.setAttribute('playsinline', ''); 
        this.survVideo.setAttribute('webkit-playsinline', '');
        this.survVideo.crossOrigin = 'anonymous';
        
        document.body.appendChild(this.survVideo);
        this.survVideo.style.display = 'none';
        
        this.survVideoTexture = new THREE.VideoTexture(this.survVideo);
        this.survVideoTexture.minFilter = THREE.LinearFilter;
        this.survVideoTexture.magFilter = THREE.LinearFilter;
        this.survVideoTexture.format = THREE.RGBAFormat;
        this.survVideoTexture.wrapS = THREE.RepeatWrapping;
        this.survVideoTexture.repeat.x = -1;

        const textureLoader = new THREE.TextureLoader();
        this.logoTexture = textureLoader.load('logo.avif');
        this.logoTexture.flipY = false;

        this.setupControls();
    },

    playButtonSound() { 
        this.audioBotonPC.currentTime = 0;
        this.audioBotonPC.play().catch(e=>{});
    },
    
    setGamingMode(active) {
        this.isGamingMode = active;
        if (active) {
            this.isPcOn = true;
            if (this.canPlayAudio) {
                this.survVideo.muted = false;
            } else {
                this.survVideo.muted = true;
            }
            
            this.survVideo.play().catch(e=>{});
            const pcPowerBtn = document.getElementById('pc-power');
            if (pcPowerBtn) {
                pcPowerBtn.innerText = '🟢';
                pcPowerBtn.style.color = '#00ff00';
                pcPowerBtn.style.textShadow = '0 0 5px #00ff00';
            }
        } else {
            this.survVideo.pause();
        }
        this.updateScreens(); 
    },

    updateScreens() {
        this.pcScreenMeshes.forEach(mesh => {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            // Recuperamos los materiales originales guardados en room_main
            const origMats = mesh.userData.originalMaterials;

            mats.forEach((mat, index) => {
                if (this.isGamingMode && this.isPcOn) {
                    if (mesh.userData && mesh.userData.isMainVideoScreen) {
                        mat.map = this.survVideoTexture;
                        mat.emissiveMap = this.survVideoTexture;
                        mat.color.setHex(0xffffff);
                        mat.emissive.setHex(0xffffff);
                        mat.emissiveIntensity = 1.0;
                    } else {
                        mat.map = this.logoTexture;
                        mat.emissiveMap = this.logoTexture;
                        mat.color.setHex(0xffffff);
                        mat.emissive.setHex(0xffffff);
                        mat.emissiveIntensity = 1.0;
                    }
                } else {
                    // SI NO ESTÁ JUGANDO, RESTAURA LAS TEXTURAS ORIGINALES
                    if (origMats && origMats[index]) {
                        mat.map = origMats[index].map;
                        mat.emissiveMap = origMats[index].emissiveMap;
                        mat.color.copy(origMats[index].color);
                        mat.emissive.copy(origMats[index].emissive);
                        mat.emissiveIntensity = origMats[index].emissiveIntensity;
                    }
                }
                mat.needsUpdate = true;
            });
        });
    },

    setupControls() {
        const pcPowerBtn = document.getElementById('pc-power');
        const pcOpenBtn = document.getElementById('pc-open');
        const pcModal = document.getElementById('pc-modal');
        const closePcBtn = document.getElementById('close-pc');
        const pcIframe = document.getElementById('pc-iframe');

        if (pcPowerBtn) {
            pcPowerBtn.onclick = () => {
                this.playButtonSound();
                if (this.pcTransitioning || this.pcScreenMeshes.length === 0) return;
                
                this.isPcOn = !this.isPcOn;
                pcPowerBtn.innerText = this.isPcOn ? '🟢' : '🔴';
                pcPowerBtn.style.color = this.isPcOn ? '#00ff00' : 'red';
                pcPowerBtn.style.textShadow = this.isPcOn ? '0 0 5px #00ff00' : '0 0 5px red';
                
                if (this.isGamingMode) {
                    if (this.isPcOn) {
                        this.survVideo.muted = false;
                        this.survVideo.play().catch(()=>{});
                    } else {
                        this.survVideo.pause();
                    }
                }

                this.updateScreens();
                if (!this.isPcOn && pcModal.classList.contains('visible')) {
                    pcModal.classList.remove('visible');
                    pcIframe.src = ''; 
                }
            };
        }

        if (pcOpenBtn) {
            pcOpenBtn.onclick = () => {
                this.playButtonSound();
                if (!this.isPcOn) {
                    alert("¡Primero enciende la PC!");
                    return;
                }
                pcIframe.src = 'https://archinime.github.io/Room/';
                pcModal.classList.add('visible');
                document.getElementById('pc-controls').style.display = 'none'; 
            };
        }

        if (closePcBtn) {
            closePcBtn.onclick = () => {
                this.playButtonSound();
                pcModal.classList.remove('visible');
                pcIframe.src = ''; 
            };
        }
    },

    // PASAMOS 2 VOLÚMENES: pc y efectos
    setVolume(volPc, volEf) {
        this.audioBotonPC.volume = volEf / 100;
        this.survVideo.volume = volPc / 100; 
    }
};