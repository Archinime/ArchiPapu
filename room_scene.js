import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const SceneSetup = {
    scene: new THREE.Scene(),
    clock: new THREE.Clock(),
    camera: null,
    renderer: null,
    controls: null,
    ambient: null,
    hemiLight: null,
    mainLight: null,

    init(gameSettings, isMobileUA) {
        this.scene.background = new THREE.Color(0x050508);
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200);
        
        let camPosY = 6, camPosZ = 14, targetY = 6;
        if (window.innerWidth < 768 || isMobileUA) { 
            camPosY = 6;
            camPosZ = 12; targetY = 5; 
        }
        this.camera.position.set(0, camPosY, camPosZ);
        
        // OPTIMIZACIÓN: powerPreference y precision ayudan a la GPU del móvil
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: gameSettings.calidad !== 'baja', 
            powerPreference: "high-performance",
            precision: gameSettings.calidad === 'baja' ? 'mediump' : 'highp'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding; 
        
        this.renderer.toneMapping = gameSettings.calidad === 'baja' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = gameSettings.calidad === 'baja' ? 1.0 : 1.2;

        // OPTIMIZACIÓN CRÍTICA: Límite de Pixel Ratio para evitar crash por RAM en pantallas de alta densidad
        const maxPixelRatio = gameSettings.calidad === 'baja' ? 1 : (isMobileUA ? 1.5 : Math.min(window.devicePixelRatio, 2));
        this.renderer.setPixelRatio(maxPixelRatio);
        
        this.renderer.shadowMap.enabled = true; // LAS SOMBRAS NO SE BORRAN
        this.renderer.shadowMap.type = gameSettings.calidad === 'alta' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; 
        
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(0, targetY, 0);
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
        this.controls.minDistance = 2.5; 
        this.controls.maxDistance = 16;
        this.controls.enablePan = false;
        
        // LAS LUCES SE MANTIENEN INTACTAS
        this.ambient = new THREE.AmbientLight(0xffffff, 0.3); 
        this.scene.add(this.ambient);
        
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4); 
        this.hemiLight.position.set(0, 20, 0);
        this.scene.add(this.hemiLight);
        
        this.mainLight = new THREE.SpotLight(0xffeedd, 6); 
        this.mainLight.position.set(2, 22, 2); 
        this.mainLight.angle = Math.PI / 3;
        this.mainLight.penumbra = 0.8;
        this.mainLight.castShadow = true;
        
        // OPTIMIZACIÓN DE VRAM: Sombras adaptativas según calidad
        if (gameSettings.calidad === 'baja') {
            this.mainLight.shadow.mapSize.width = 256;
            this.mainLight.shadow.mapSize.height = 256;
        } else if (gameSettings.calidad === 'media') {
            this.mainLight.shadow.mapSize.width = 512;
            this.mainLight.shadow.mapSize.height = 512;
        } else {
            this.mainLight.shadow.mapSize.width = 1024;
            this.mainLight.shadow.mapSize.height = 1024;
        }
        
        this.mainLight.shadow.bias = -0.001;
        this.mainLight.shadow.camera.near = 1;
        this.mainLight.shadow.camera.far = 50;
        this.scene.add(this.mainLight);
    }
};