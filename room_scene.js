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
            camPosY = 6; camPosZ = 12; targetY = 5; 
        }
        this.camera.position.set(0, camPosY, camPosZ);

        this.renderer = new THREE.WebGLRenderer({ antialias: gameSettings.calidad !== 'baja', powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding; 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; 
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true; 
        this.controls.target.set(0, targetY, 0); 
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
        this.controls.minDistance = 2.5; 
        this.controls.maxDistance = 16;
        this.controls.enablePan = false;

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
        this.scene.add(this.mainLight);
    }
};