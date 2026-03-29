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
        this.survVideoTexture.wrapT = THREE.RepeatWrapping;
        this.survVideoTexture.generateMipmaps = false; // CLAVE PARA NO SOBRECARGAR LA VRAM EN MÓVILES
        this.survVideoTexture.encoding = THREE.sRGBEncoding;

        const logoImage = new Image();
        logoImage.src = 'logo.avif';
        logoImage.onload = () => {
            this.logoTexture = new THREE.Texture(logoImage);
            this.logoTexture.needsUpdate = true;
            this.logoTexture.encoding = THREE.sRGBEncoding;
            this.logoTexture.flipY = false;
            this.logoTexture.minFilter = THREE.LinearFilter; 
            this.logoTexture.generateMipmaps = false; // OPTIMIZADO
            if (!this.isPcOn) this.updateScreens(); 
        };

        this.setupUI();
        
        const savedPcState = localStorage.getItem('room_pc_on');
        if (savedPcState === 'true') {
            this.isPcOn = true;
            const pcPowerBtn = document.getElementById('pc-power');
            if(pcPowerBtn) {
                pcPowerBtn.innerText = '🟢';
                pcPowerBtn.style.color = '#00ff00';
                pcPowerBtn.style.textShadow = '0 0 5px #00ff00';
            }
        }
    },

    setGamingMode(isGaming) {
        this.isGamingMode = isGaming;
        if (this.isPcOn) {
            this.updateScreens();
        }
    },

    updateScreens() {
        this.pcScreenMeshes.forEach(mesh => {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(mat => {
                if (this.isPcOn) {
                    if (this.isGamingMode && this.survVideoTexture) {
                        mat.map = this.survVideoTexture;
                        mat.emissiveMap = this.survVideoTexture;
                        this.survVideo.play().catch(e => console.log('Autoplay blocked', e));
                    } else if (this.logoTexture) {
                        mat.map = this.logoTexture;
                        mat.emissiveMap = this.logoTexture;
                        this.survVideo.pause();
                    }
                    mat.color.setHex(0xffffff);
                    mat.emissive.setHex(0xffffff);
                    mat.emissiveIntensity = 1.0;
                } else {
                    mat.map = null;
                    mat.emissiveMap = null;
                    mat.color.setHex(0x111111);
                    mat.emissive.setHex(0x000000);
                    mat.emissiveIntensity = 0.0;
                    this.survVideo.pause();
                }
                mat.needsUpdate = true;
            });
        });
    },

    setupUI() {
        const pcControls = document.getElementById('pc-controls');
        const pcPowerBtn = document.getElementById('pc-power');
        const pcOpenBtn = document.getElementById('pc-open-full');
        const pcModal = document.getElementById('pc-full-modal');
        const closePcBtn = document.getElementById('close-pc');
        const pcIframe = document.getElementById('pc-iframe');

        if (pcPowerBtn) {
            pcPowerBtn.onclick = () => {
                const now = Date.now();
                if (now - this.lastPcClickTime < 500) return;
                this.lastPcClickTime = now;
                
                this.playButtonSound();

                if (!this.isPcOn) {
                    this.isPcOn = true;
                    localStorage.setItem('room_pc_on', 'true');
                    this.updateScreens();
                    
                    pcPowerBtn.innerText = '🟢';
                    pcPowerBtn.style.color = '#00ff00';
                    pcPowerBtn.style.textShadow = '0 0 5px #00ff00';
                    document.getElementById('pc-controls').style.display = 'none'; 
                } else {
                    this.isPcOn = false;
                    localStorage.setItem('room_pc_on', 'false'); 
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
        this.survVideo.volume = volPc / 100;
    },

    playButtonSound() {
        if (this.canPlayAudio) {
            this.audioBotonPC.currentTime = 0;
            this.audioBotonPC.play().catch(e => console.log('Audio error:', e));
        }
    }
};