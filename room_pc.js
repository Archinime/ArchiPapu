import * as THREE from 'three';

export const PCManager = {
    isPcOn: false,
    pcTransitioning: false,
    lastPcClickTime: 0,
    pcScreenMeshes: [], 
    audioBotonPC: new Audio('sonido_boton.mp3'),
    
    isGamingMode: false,
    survVideo: document.createElement('video'),
    survVideoTexture: null,
    logoTexture: null, 
    
    init() {
        this.survVideo.src = 'surv.mp4';
        this.survVideo.loop = true;
        
        // 🛑 CORE FIX: Inicializar SIEMPRE muteado.
        // Si no se hace esto, el navegador bloquea el audio permanentemente al inyectar el video.
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

        // Cargar Logo
        const textureLoader = new THREE.TextureLoader();
        this.logoTexture = textureLoader.load('logo.avif');
        this.logoTexture.flipY = false;
        this.logoTexture.colorSpace = THREE.SRGBColorSpace;

        this.setupUI();
    },

    setupUI() {
        const pcPowerBtn = document.getElementById('pc-power');
        const pcOpenBtn = document.getElementById('pc-open');
        const closePcBtn = document.getElementById('close-pc');
        const pcModal = document.getElementById('pc-modal');
        const pcIframe = document.getElementById('pc-iframe');

        if (pcPowerBtn) {
            pcPowerBtn.onclick = () => {
                this.playButtonSound();
                this.togglePc();
            };
        }

        if (pcOpenBtn) {
            pcOpenBtn.onclick = () => {
                this.playButtonSound();
                if (!this.isPcOn) {
                    alert("¡Primero enciende la PC!");
                    return;
                }
                if (pcIframe && pcModal) {
                    pcIframe.src = 'https://archinime.github.io/Room/';
                    pcModal.classList.add('visible');
                    const pcControls = document.getElementById('pc-controls');
                    if (pcControls) pcControls.style.display = 'none'; 
                }
            };
        }

        if (closePcBtn) {
            closePcBtn.onclick = () => {
                this.playButtonSound();
                if (pcModal) pcModal.classList.remove('visible');
                if (pcIframe) pcIframe.src = ''; 
                const pcControls = document.getElementById('pc-controls');
                if (pcControls) pcControls.style.display = 'flex';
            };
        }
    },

    togglePc() {
        const now = Date.now();
        if (now - this.lastPcClickTime < 1000) return;
        this.lastPcClickTime = now;

        this.isPcOn = !this.isPcOn;
        const pcPowerBtn = document.getElementById('pc-power');
        const pcModal = document.getElementById('pc-modal');
        const pcIframe = document.getElementById('pc-iframe');

        if (pcPowerBtn) {
            pcPowerBtn.innerText = this.isPcOn ? '🟢' : '🔴';
            pcPowerBtn.style.color = this.isPcOn ? '#00ff00' : 'red';
            pcPowerBtn.style.textShadow = this.isPcOn ? '0 0 5px #00ff00' : '0 0 5px red';
        }

        if (this.isGamingMode) {
            if (this.isPcOn) {
                // 🔊 CORE FIX: Desmutear solo cuando el usuario enciende manualmente
                this.survVideo.muted = false; 
                
                // Asegurarnos de que el volumen no se haya quedado en 0 accidentalmente
                if (this.survVideo.volume === 0) this.survVideo.volume = 1.0;

                const playPromise = this.survVideo.play();
                if (playPromise !== undefined) {
                    playPromise.catch((e) => {
                        console.warn("Autoplay estricto bloqueó el sonido. Reproduciendo muteado por seguridad.", e);
                        this.survVideo.muted = true;
                        this.survVideo.play();
                    });
                }
            } else {
                this.survVideo.pause();
            }
        }

        this.updateScreens();

        if (!this.isPcOn && pcModal && pcModal.classList.contains('visible')) {
            pcModal.classList.remove('visible');
            if (pcIframe) pcIframe.src = ''; 
        }
    },

    updateScreens() {
        this.pcScreenMeshes.forEach(mesh => {
            if (!mesh || !mesh.material) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(mat => {
                if (this.isPcOn) {
                    mat.map = this.isGamingMode ? this.survVideoTexture : this.logoTexture;
                    mat.emissiveMap = this.isGamingMode ? this.survVideoTexture : this.logoTexture;
                    mat.color.setHex(0xffffff);
                    mat.emissive.setHex(0xffffff);
                    mat.emissiveIntensity = 1.0;
                } else {
                    mat.map = null;
                    mat.emissiveMap = null;
                    mat.color.setHex(0x000000);
                    mat.emissive.setHex(0x000000);
                    mat.emissiveIntensity = 0;
                }
                mat.needsUpdate = true;
            });
        });
    },

    setGamingMode(active) {
        this.isGamingMode = active;

        if (this.isGamingMode && this.isPcOn) {
            this.survVideo.muted = false; // Intentar desmutear si ya está prendida
            const playPromise = this.survVideo.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    this.survVideo.muted = true;
                    this.survVideo.play();
                });
            }
        } else {
            this.survVideo.pause();
        }

        this.updateScreens();
    },

    playButtonSound() {
        this.audioBotonPC.currentTime = 0;
        this.audioBotonPC.play().catch(()=>{});
    },

    setVolume(volEf) {
        // Asegurar que haya un volumen por defecto si volEf no está definido aún
        const finalVol = volEf !== undefined ? volEf : 1.0;
        this.audioBotonPC.volume = finalVol;
        if (this.survVideo) {
            this.survVideo.volume = finalVol; 
        }
    }
};