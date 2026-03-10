import { state, scene, loader } from './core.js';
import { getFreshUrl, disposeThreeJSObject } from './utils.js';
import { applyCurrentSettings } from './settings.js';
import { checkLoading } from './loading.js';
import { tvTexture, isTvOn, tvVideo } from './tv.js';  // se definirá después

// Aplica lógica de sombras/emisión según categoría
export function applyMaterialLogic(model, categoryKey) {
    if (!model) return;
    const isFoco = categoryKey === 'foco';
    const isFocoDia = categoryKey === 'foco_dia';
    const allowShadows = state.gameSettings.sombras > 0;

    model.traverse((node) => {
        if (node.isMesh) {
            node.frustumCulled = false;
            if (isFoco || isFocoDia) {
                node.castShadow = false;
                node.receiveShadow = false;
                if (node.material) {
                    if (isFoco) {
                        node.material.emissive = new THREE.Color(0xffeedd);
                        node.material.emissiveIntensity = state.lightOn ? 1.5 : 0;
                    }
                    if (isFocoDia) node.material.emissive = new THREE.Color(0xffffff);
                }
            } else {
                node.castShadow = allowShadows;
                node.receiveShadow = allowShadows;
                if (node.material) {
                    node.material.shadowSide = THREE.FrontSide;
                    if (node.name.toLowerCase().includes('pared') ||
                        node.name.toLowerCase().includes('piso') ||
                        node.name.toLowerCase().includes('techo')) {
                        node.material.shadowSide = THREE.BackSide;
                    }
                    node.material.side = THREE.DoubleSide;
                    node.material.needsUpdate = true;
                }
            }
        }
    });
}

// Carga un modelo para un slot (categoría)
export function loadItemForSlot(categoryKey, itemFile, isInitialLoad = false) {
    if (!itemFile) return;
    if (state.loadedSlotMeshes[categoryKey]) {
        scene.remove(state.loadedSlotMeshes[categoryKey]);
        disposeThreeJSObject(state.loadedSlotMeshes[categoryKey]);
    }

    loader.load(getFreshUrl(itemFile), (gltf) => {
        const model = gltf.scene;
        applyMaterialLogic(model, categoryKey);

        if (categoryKey === 'pantalla_tv') {
            model.traverse((node) => {
                if (node.isMesh && node.material) {
                    state.tvScreenMesh = node;
                    let mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(mat => {
                        if (!state.isTvOn) {
                            mat.map = null;
                            mat.emissiveMap = null;
                            mat.color = new THREE.Color(0x000000);
                            mat.emissive = new THREE.Color(0x000000);
                            mat.emissiveIntensity = 0;
                        } else {
                            mat.map = tvTexture;
                            mat.emissiveMap = tvTexture;
                            mat.color = new THREE.Color(0xffffff);
                            mat.emissive = new THREE.Color(0xffffff);
                            mat.emissiveIntensity = 1.0;
                        }
                        mat.needsUpdate = true;
                    });
                }
            });
            if (!state.isTvOn) tvVideo.pause();
        }

        if (categoryKey === 'foco') {
            state.focoMesh = model;
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            mainLight.position.copy(center);
            mainLight.position.y -= 0.2;
        }

        if (categoryKey === 'interruptor') {
            state.switchMesh = model;
        }

        scene.add(model);
        state.loadedSlotMeshes[categoryKey] = model;
        if (isInitialLoad) checkLoading();
    }, undefined, () => {
        if (isInitialLoad) checkLoading();
    });
}