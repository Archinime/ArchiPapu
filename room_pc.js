import * as THREE from 'three';

export const PCManager = {
    isOn: false,
    screenMesh: null,
    textureOff: null,
    textureOn: null,

    init() {
        // Exponer al scope global para los botones HTML (onclick)
        window.PCManager = this;
        
        this.textureOff = new THREE.MeshBasicMaterial({ color: 0x111111 });
        
        const loader = new THREE.TextureLoader();
        // Fondo de pantalla cuando está prendida
        loader.load('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=512', (tex) => {
            this.textureOn = new THREE.MeshBasicMaterial({ map: tex });
        });

        // Reloj
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
        if (!this.isOn) {
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
                    if (this.isOn && this.textureOn) {
                        mat.map = this.textureOn.map;
                        mat.emissiveMap = this.textureOn.map;
                        mat.emissive = new THREE.Color(0xffffff);
                        mat.emissiveIntensity = 1.0;
                    } else {
                        mat.map = null;
                        mat.emissiveMap = null;
                        mat.emissive = new THREE.Color(0x000000);
                        mat.emissiveIntensity = 0;
                    }
                    mat.needsUpdate = true;
                });
            }
        });
    },

    openOS() {
        if (!this.isOn) this.togglePower(); // Enciende si estaba apagada
        document.getElementById('pc-os-modal').classList.remove('hidden');
    },

    closeOS() {
        document.getElementById('pc-os-modal').classList.add('hidden');
    },

    openApp(appName) {
        if(appName === 'browser') {
            document.getElementById('pc-window-browser').classList.remove('hidden');
        }
    },

    closeApp(appName) {
        if(appName === 'browser') {
            document.getElementById('pc-window-browser').classList.add('hidden');
        }
    }
};