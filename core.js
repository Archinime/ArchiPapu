import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// =============================================
// Objetos inmutables de Three.js
// =============================================
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);

export const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 200);

export const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 2.5;
controls.maxDistance = 16;
controls.enablePan = false;

export const loader = new GLTFLoader();
export const clock = new THREE.Clock();
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();

// =============================================
// Luces (se añadirán a la escena después)
// =============================================
export const ambient = new THREE.AmbientLight(0xffffff, 0.3);
export const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
hemiLight.position.set(0, 20, 0);

export const mainLight = new THREE.SpotLight(0xffeedd, 6);
mainLight.position.set(2, 22, 2);
mainLight.angle = Math.PI / 3;
mainLight.penumbra = 0.8;
mainLight.decay = 2;
mainLight.distance = 60;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 40;
mainLight.shadow.bias = -0.002;
mainLight.shadow.normalBias = 0.05;
mainLight.shadow.radius = 4;

// =============================================
// Estado mutable de la aplicación
// =============================================
export const state = {
    // Inventario y monedas
    playerCoins: parseInt(localStorage.getItem('room_coins')) || 1000,
    inventoryData: null,               // se inicializa en inventory.js

    // Configuración
    gameSettings: null,                 // se inicializa en settings.js

    // Estado de luces
    lightOn: localStorage.getItem('lightState') !== 'off',

    // Mallas cargadas
    loadedSlotMeshes: {},
    switchMesh: null,
    focoMesh: null,
    focoDiaMesh: null,
    luzFocoDia: null,
    tvScreenMesh: null,

    // TV
    isTvOn: false,
    tvTransitioning: false,
    lastTvClickTime: 0,
    tvPlaylist: [],
    currentTvIndex: -1,

    // Lunari
    lunariMixer: null,
    baseAction: null,
    randomAction: null,
    currentAction: null,

    // Clima
    esDeDiaLocal: true,
    lastWeatherCode: 0,

    // Carga
    totalModelsToLoad: 0,
    modelsLoaded: 0,

    // FPS (para el contador)
    then: performance.now(),
    frames: 0,
    lastFpsTime: performance.now()
};

// =============================================
// Elementos multimedia (TV, efectos, audio)
// =============================================
export const tvVideo = document.getElementById('tv-video');
export const tvTexture = new THREE.VideoTexture(tvVideo);
tvTexture.minFilter = THREE.LinearFilter;
tvTexture.magFilter = THREE.LinearFilter;
tvTexture.format = THREE.RGBAFormat;
tvTexture.encoding = THREE.sRGBEncoding;

// Vídeos de efecto (transición)
export const tvEffectVideoOff = document.createElement('video');
tvEffectVideoOff.src = 'efecto_tele.mp4';
tvEffectVideoOff.crossOrigin = 'anonymous';
tvEffectVideoOff.playsInline = true;
document.body.appendChild(tvEffectVideoOff);
tvEffectVideoOff.style.display = 'none';

export const tvEffectVideoOn = document.createElement('video');
tvEffectVideoOn.src = 'efecto_tele - Invertido.mp4';
tvEffectVideoOn.crossOrigin = 'anonymous';
tvEffectVideoOn.playsInline = true;
document.body.appendChild(tvEffectVideoOn);
tvEffectVideoOn.style.display = 'none';

export const tvEffectTextureOff = new THREE.VideoTexture(tvEffectVideoOff);
tvEffectTextureOff.minFilter = THREE.LinearFilter;
tvEffectTextureOff.magFilter = THREE.LinearFilter;
tvEffectTextureOff.format = THREE.RGBAFormat;

export const tvEffectTextureOn = new THREE.VideoTexture(tvEffectVideoOn);
tvEffectTextureOn.minFilter = THREE.LinearFilter;
tvEffectTextureOn.magFilter = THREE.LinearFilter;
tvEffectTextureOn.format = THREE.RGBAFormat;

// Audios
export const audioPrenderLuz = new Audio('prender_luz.mp3');
export const audioApagarLuz = new Audio('apagar_luz.mp3');
export const audioAbrirPoster = new Audio('abrir_poster.mp3');
export const audioCerrarPoster = new Audio('guardar_poster.mp3');
export const audioBotonTV = new Audio('sonido_boton.mp3');