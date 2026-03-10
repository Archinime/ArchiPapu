import { state, camera, raycaster, mouse, renderer } from './core.js';
import { toggleLight } from './lighting.js';
import { audioAbrirPoster, audioCerrarPoster } from './core.js';

// Modal de póster
const posterViewModal = document.getElementById('poster-view-modal');
const posterEnlargedImage = document.getElementById('poster-enlarged-image');

document.getElementById('close-poster-view').onclick = () => {
    posterViewModal.classList.remove('visible');
    audioCerrarPoster.currentTime = 0;
    audioCerrarPoster.play().catch(e => {});
};
posterViewModal.onclick = (e) => {
    if (e.target === posterViewModal) {
        posterViewModal.classList.remove('visible');
        audioCerrarPoster.currentTime = 0;
        audioCerrarPoster.play().catch(e => {});
    }
};

function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Interruptor
    if (state.switchMesh && raycaster.intersectObject(state.switchMesh, true).length > 0) {
        toggleLight();
        return;
    }

    // Pantalla TV
    const pantallaMesh = state.loadedSlotMeshes['pantalla_tv'];
    if (pantallaMesh && raycaster.intersectObject(pantallaMesh, true).length > 0) {
        const tvControls = document.getElementById('tv-controls');
        const currentTime = Date.now();
        if (currentTime - state.lastTvClickTime < 300) {
            if (state.isTvOn && !state.tvTransitioning) {
                if (tvVideo.paused) tvVideo.play().catch(e => {});
                else tvVideo.pause();
            }
        } else {
            if (tvControls.style.display === 'none' || tvControls.style.display === '') {
                tvControls.style.display = 'flex';
            } else {
                tvControls.style.display = 'none';
            }
        }
        state.lastTvClickTime = currentTime;
        return;
    }

    // Pósters
    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const pMesh = state.loadedSlotMeshes[cat];
        if (pMesh && raycaster.intersectObject(pMesh, true).length > 0) {
            const itemData = state.inventoryData[cat].items[state.inventoryData[cat].equipped];
            if (itemData && itemData.preview) {
                posterEnlargedImage.src = itemData.preview;
                posterViewModal.classList.add('visible');
                audioAbrirPoster.currentTime = 0;
                audioAbrirPoster.play().catch(e => {});
            }
            break;
        }
    }
}

// Detección de arrastre vs clic
let pointerDownPos = { x: 0, y: 0 };
let isDragging = false;

renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
    isDragging = false;
});

renderer.domElement.addEventListener('pointermove', (e) => {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) isDragging = true;
});

renderer.domElement.addEventListener('pointerup', (e) => {
    if (!isDragging &&
        !document.getElementById('inventory-modal').classList.contains('visible') &&
        !document.getElementById('ff-settings-modal').classList.contains('active')) {
        handleInteraction(e);
    }
    isDragging = false;
});