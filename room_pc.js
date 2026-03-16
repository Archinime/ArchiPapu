import * as THREE from 'three';

export const PCManager = {
    isOn: false,
    screenMesh: null,
    textureOff: null,
    textureOn: null,

    init() {
        // Exponer al scope global para los botones HTML (onclick)
        window.PCManager = this;
        
        const loader = new THREE.TextureLoader();
        
        // Fondo de pantalla de alta fidelidad cuando está prendida
        loader.load('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=512', (tex) => {
            tex.flipY = false; // Importante para que no se vea volteado en GLTF
            this.textureOn = tex;
        });

        // Reloj del sistema operativo
        setInterval(() => {
            const timeEl = document.getElementById('pc-time');
            if(timeEl) timeEl.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }, 1000);
    },

    setScreenMesh(mesh) {
        this.screenMesh = mesh;
        this.updateScreenTexture();
    },

    togglePower() {
        this.isOn = !this.isOn;
        this.updateScreenTexture();

        if (this.isOn) {
            // Animación de inicio en la UI
            const desktop = document.getElementById('pc-environment');
            if(desktop) {
                desktop.style.filter = 'brightness(0)';
                setTimeout(() => desktop.style.filter = 'brightness(1)', 300);
            }
        } else {
            this.closeOS();
        }
    },

    updateScreenTexture() {
        if (!this.screenMesh) return;

        // Buscamos los materiales del modelo de la PC para apagarlos o encenderlos
        this.screenMesh.traverse((node) => {
            if (node.isMesh && node.material) {
                let mats = Array.isArray(node.material) ? node.material : [node.material];
                
                mats.forEach(mat => {
                    // Verificamos si la pieza o material se llama pantalla/screen para solo iluminar eso.
                    // Si el modelo es muy simple, igual aplicará a todo el objeto.
                    const nodeName = node.name.toLowerCase();
                    const matName = mat.name.toLowerCase();
                    const isScreenPart = nodeName.includes('screen') || nodeName.includes('pantalla') || 
                                         matName.includes('screen') || matName.includes('pantalla');

                    if (this.isOn && this.textureOn) {
                        mat.map = this.textureOn;
                        mat.emissiveMap = this.textureOn;
                        mat.color = new THREE.Color(0xffffff);
                        mat.emissive = new THREE.Color(0xffffff);
                        mat.emissiveIntensity = 1.0;
                    } else {
                        mat.map = null;
                        mat.emissiveMap = null;
                        mat.color = new THREE.Color(0x111111);
                        mat.emissive = new THREE.Color(0x000000);
                        mat.emissiveIntensity = 0;
                    }
                    mat.needsUpdate = true;
                });
            }
        });
    },

    openOS() {
        if (!this.isOn) {
            this.togglePower(); // Enciende si estaba apagada
        }
        
        const modal = document.getElementById('pc-os-modal');
        modal.classList.remove('hidden');
        
        // Efecto Fade-in para el modal para que no sea brusco
        setTimeout(() => {
            modal.style.opacity = 1;
            modal.style.pointerEvents = 'auto';
        }, 50);
    },

    closeOS() {
        const modal = document.getElementById('pc-os-modal');
        modal.style.opacity = 0;
        modal.style.pointerEvents = 'none';
        
        // Esperamos que termine el fadeout de CSS antes de ocultarlo del DOM
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); 
    },

    openApp(appName) {
        if(appName === 'browser') {
            const win = document.getElementById('pc-window-browser');
            win.classList.remove('hidden');
            win.style.zIndex = 100;
        }
    },

    closeApp(appName) {
        if(appName === 'browser') {
            document.getElementById('pc-window-browser').classList.add('hidden');
        }
    }
};