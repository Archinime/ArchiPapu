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
        // OPTIMIZACIÓN: Evitar que ThreeJS genere múltiples tamaños del video en VRAM
        this.survVideoTexture.generateMipmaps = false; 
        
        const textureLoader = new THREE.TextureLoader();
        this.logoTexture = textureLoader.load('logo.avif');
        this.logoTexture.colorSpace = THREE.SRGBColorSpace;
        
        // El resto del código de PCManager se mantiene exactamente igual...
        // [CÓDIGO POSTERIOR MANTENIDO]
        this.setupEventListeners();
        
        const savedState = localStorage.getItem('room_pc_on');
        if (savedState === 'true') {
            this.isPcOn = true;
            this.survVideo.play().catch(e => console.log("Autoplay bloqueado"));
            const pcPowerBtn = document.getElementById('pc-power');
            if(pcPowerBtn) {
                pcPowerBtn.innerText = '🟢';
                pcPowerBtn.style.color = '#00ff00';
                pcPowerBtn.style.textShadow = '0 0 5px #00ff00';
            }
        }
    },

    setCanPlayAudio(canPlay) {
        this.canPlayAudio = canPlay;
    },

    setGamingMode(isGaming) {
        this.isGamingMode = isGaming;
        if (this.isPcOn) {
            this.updateScreens();
        }
    },

    playButtonSound() {
        if (!this.canPlayAudio) return;
        this.audioBotonPC.currentTime = 0;
        this.audioBotonPC.play().catch(e => console.log('Audio error:', e));
    },

    updateScreens() {
        if (this.pcScreenMeshes.length === 0) return;

        let targetTexture = null;
        let emIntensity = 0;

        if (this.isPcOn) {
            targetTexture = this.isGamingMode ? this.survVideoTexture : this.logoTexture;
            emIntensity = 1.0; 
        }

        this.pcScreenMeshes.forEach(mesh => {
            if (mesh && mesh.material) {
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach(mat => {
                    mat.map = targetTexture;
                    mat.emissiveMap = targetTexture;
                    
                    if (this.isPcOn) {
                        mat.color.setHex(0xffffff);
                        mat.emissive.setHex(0xffffff);
                    } else {
                        mat.color.setHex(0x111111);
                        mat.emissive.setHex(0x000000);
                    }
                    
                    mat.emissiveIntensity = emIntensity;
                    mat.needsUpdate = true;
                });
            }
        });
    },

    setupEventListeners() {
        const pcPowerBtn = document.getElementById('pc-power');
        const pcOpenBtn = document.getElementById('pc-open');
        const pcModal = document.getElementById('pc-interface');
        const pcIframe = document.getElementById('pc-iframe');
        const closePcBtn = document.getElementById('close-pc');

        if (pcPowerBtn) {
            pcPowerBtn.onclick = () => {
                this.playButtonSound();
                if (this.pcTransitioning) return;
                
                const now = Date.now();
                if (now - this.lastPcClickTime < 1000) return; 
                this.lastPcClickTime = now;

                if (!this.isPcOn) {
                    this.isPcOn = true;
                    localStorage.setItem('room_pc_on', 'true'); // GUARDADO DE ESTADO
                    this.survVideo.play().catch(e => console.log("Autoplay de surv bloqueado"));
                    this.updateScreens();
                    
                    pcPowerBtn.innerText = '🟢';
                    pcPowerBtn.style.color = '#00ff00';
                    pcPowerBtn.style.textShadow = '0 0 5px #00ff00';
                    document.getElementById('pc-controls').style.display = 'flex';
                } else {
                    this.isPcOn = false;
                    localStorage.setItem('room_pc_on', 'false'); // GUARDADO DE ESTADO
                    this.survVideo.pause();
                    this.updateScreens();
                    
                    pcPowerBtn.innerText = '🔴';
                    pcPowerBtn.style.color = 'red';
                    pcPowerBtn.style.textShadow = '0 0 5px red';
                    
                    if (pcModal.classList.contains('visible')) {
                        pcModal.classList.remove('visible');
                        pcIframe.src = ''; 
                    }
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

    setVolume(volPc, volEf) {
        this.audioBotonPC.volume = volEf / 100;
    }
};