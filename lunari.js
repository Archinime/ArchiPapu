import { state, scene, loader } from './core.js';
import { getFreshUrl } from './utils.js';
import { applyMaterialLogic } from './models.js';
import { checkLoading } from './loading.js';

export function updateLunariText(isDay, weatherCode) {
    const dialogBox = document.getElementById('dialogue-text');
    if (!dialogBox) return;
    if (!isDay) {
        dialogBox.innerHTML = "¡Qué noche tan tranquila!<br>¿Deberíamos dormir pronto?";
    } else if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(weatherCode)) {
        dialogBox.innerHTML = "El clima está feo afuera.<br>¡Mejor nos quedamos viendo anime!";
    } else {
        dialogBox.innerHTML = "¡Hola!<br>Bienvenido de nuevo a casa.<br>¿Vemos un anime hoy?";
    }
}

// Cargar modelos de Lunari
export function loadLunari() {
    loader.load(getFreshUrl('lunari_durmiendo1.glb'), (gltf) => {
        const lunariModel = gltf.scene;
        applyMaterialLogic(lunariModel, 'lunari');
        scene.add(lunariModel);
        if (gltf.animations && gltf.animations.length > 0) {
            state.lunariMixer = new THREE.AnimationMixer(lunariModel);
            state.baseAction = state.lunariMixer.clipAction(gltf.animations[0]);
            state.baseAction.play();
            state.currentAction = state.baseAction;
        }
        checkLoading();
    }, undefined, () => checkLoading());

    loader.load(getFreshUrl('Lunari_Duerme_2.glb'), (gltf) => {
        if (gltf.animations && gltf.animations.length > 0 && state.lunariMixer) {
            state.randomAction = state.lunariMixer.clipAction(gltf.animations[0]);
            state.randomAction.loop = THREE.LoopOnce;
            state.randomAction.clampWhenFinished = true;
        }
        checkLoading();
    }, undefined, () => checkLoading());
}

// Cambiar animación aleatoria cada minuto
setInterval(() => {
    if (!state.randomAction || !state.baseAction || !state.lunariMixer || state.currentAction === state.randomAction) return;
    if (state.baseAction && state.randomAction) {
        state.baseAction.fadeOut(0.5);
        state.randomAction.reset().fadeIn(0.5).play();
        state.currentAction = state.randomAction;
        const onFinished = (event) => {
            if (event.action === state.randomAction) {
                state.randomAction.fadeOut(0.5);
                state.baseAction.reset().fadeIn(0.5).play();
                state.currentAction = state.baseAction;
                state.lunariMixer.removeEventListener('finished', onFinished);
            }
        };
        state.lunariMixer.addEventListener('finished', onFinished);
    }
}, 60000);