import * as THREE from 'three';

export const PCManager = {
    isPcOn: false,
    pcTransitioning: false,
    lastPcClickTime: 0,
    pcScreenMeshes: [], // ARRAY PARA SOPORTAR MÚLTIPLES PANTALLAS
    audioBotonPC: new Audio('sonido_boton.mp3'),
    
    // NUEVAS PROPIEDADES GAMER
    isGamingMode: false,
    survVideo: document.createElement('video'),
    survVideoTexture: null,
    logoTexture: null, // Textura para PANTALLA 2
    
    init() {
        // Configuramos el video de surv.mp4 en bucle
        this.survVideo.src = 'surv.mp4';
        this.survVideo.loop = true;
        this.survVideo.muted = false; // Sonido activado
        this.survVideo.playsInline = true;
        this.survVideo.crossOrigin = 'anonymous';
        
        // <-- NUEVO: Agregamos el video al DOM (oculto). Esto es VITAL para que los navegadores permitan el audio en texturas 3D.
        document.body.appendChild(this.survVideo);
        this.survVideo.style.display = 'none';
        
        this.survVideoTexture = new THREE.VideoTexture(this.survVideo);
        this.survVideoTexture.minFilter = THREE.LinearFilter;
        this.survVideoTexture.magFilter = THREE.LinearFilter;
        this.survVideoTexture.format = THREE.RGBAFormat;

        // Invertimos el video de izquierda a derecha
        this.survVideoTexture.wrapS = THREE.RepeatWrapping;
        this.survVideoTexture.repeat.x = -1;

        // Cargamos la imagen logo.avif
        const textureLoader = new THREE.TextureLoader();
        this.logoTexture = textureLoader.load('logo.avif');
        this.logoTexture.flipY = false;

        this.setupControls();
    },

    playButtonSound() { 
        this.audioBotonPC.currentTime = 0;
        this.audioBotonPC.play().catch(e=>{});
    },
    
    // Método que LunariSystem manda a llamar
    setGamingMode(active) {
        this.isGamingMode = active;
        if (active) {
            this.isPcOn = true;
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
        this.updateScreens(); // Refrescamos pantallas
    },

    // Lógica maestra de materiales para todas las pantallas
    updateScreens() {
        this.pcScreenMeshes.forEach(mesh => {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(mat => {
                if (this.isPcOn) {
                    // Si está en modo Gaming
                    if (this.isGamingMode) {
                        if (mesh.userData && mesh.userData.isMainVideoScreen) {
                            // Pantalla principal del video (pantalla_pc)
                            mat.map = this.survVideoTexture;
                            mat.emissiveMap = this.survVideoTexture;
                            mat.color.setHex(0xffffff);
                            mat.emissive.setHex(0xffffff);
                            mat.emissiveIntensity = 1.0;
                        } else {
                            // Pantalla secundaria (pantalla_pc2) muestra logo.avif
                            mat.map = this.logoTexture;
                            mat.emissiveMap = this.logoTexture;
                            mat.color.setHex(0xffffff);
                            mat.emissive.setHex(0xffffff);
                            mat.emissiveIntensity = 1.0;
                        }
                    } else {
                        // Color Azul clásico normal
                        mat.map = null;
                        mat.emissiveMap = null;
                        mat.color.setHex(0x2196f3);
                        mat.emissive.setHex(0x2196f3);
                        mat.emissiveIntensity = 1.0;
                    }
                } else {
                    // Apagado
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

    setVolume(volEf) {
        this.audioBotonPC.volume = volEf / 100;
        this.survVideo.volume = volEf / 100; // Enlazamos el volumen del video de juego
    }
};