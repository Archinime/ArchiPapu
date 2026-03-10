import { 
    switchMesh, loadedSlotMeshes, camera, raycaster, mouse, 
    toggleLight, audioAbrirPoster, audioCerrarPoster, audioBotonTV,
    isTvOn, tvTransitioning, tvVideo, tvPlaylist, tvScreenMesh,
    tvEffectVideoOff, tvEffectVideoOn, tvEffectTextureOff, tvEffectTextureOn,
    setTvOn, setTvTransitioning, setLastTvClickTime, playNextTv, playButtonSound,
    playerCoins, saveGame
} from './core.js';

// ---------- Recompensa diaria ----------
export function checkDailyReward() {
    let lastLogin = localStorage.getItem('room_last_login');
    let today = new Date().toDateString();
    if (lastLogin !== today) {
        playerCoins += 100;
        localStorage.setItem('room_last_login', today);
        const toast = document.getElementById('daily-reward-toast');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 4000);
        saveGame();
    }
}

// ---------- Interruptor de luz ----------
export function toggleLight() {
    import('./core.js').then(module => {
        module.lightOn = !module.lightOn;
        localStorage.setItem('lightState', module.lightOn ? 'on' : 'off');
        module.updateLighting();
        if (module.lightOn) { 
            module.audioPrenderLuz.currentTime = 0; 
            module.audioPrenderLuz.play().catch(e=>{}); 
        } else { 
            module.audioApagarLuz.currentTime = 0; 
            module.audioApagarLuz.play().catch(e=>{}); 
        }
    });
}

// ---------- Modal de póster ----------
const posterViewModal = document.getElementById('poster-view-modal');
const posterEnlargedImage = document.getElementById('poster-enlarged-image');

document.getElementById('close-poster-view').onclick = () => { 
    posterViewModal.classList.remove('visible'); 
    audioCerrarPoster.currentTime = 0; 
    audioCerrarPoster.play().catch(e=>{}); 
};

posterViewModal.onclick = (e) => { 
    if (e.target === posterViewModal) { 
        posterViewModal.classList.remove('visible'); 
        audioCerrarPoster.currentTime = 0; 
        audioCerrarPoster.play().catch(e=>{}); 
    } 
};

// ---------- Controles de TV ----------
const tvPrevBtn = document.getElementById('tv-prev'), 
      tvPlayPauseBtn = document.getElementById('tv-play-pause'), 
      tvNextBtn = document.getElementById('tv-next'), 
      tvPowerBtn = document.getElementById('tv-power');

tvPrevBtn.onclick = () => { 
    playButtonSound(); 
    if (!isTvOn || tvTransitioning) return; 
    import('./core.js').then(module => {
        module.updatePlaylist(); 
        if(module.tvPlaylist.length===0) return;
        module.currentTvIndex = (module.currentTvIndex - 1 + module.tvPlaylist.length) % module.tvPlaylist.length; 
        tvVideo.src = module.tvPlaylist[module.currentTvIndex]; 
        tvVideo.play(); 
    });
};

tvPlayPauseBtn.onclick = () => { 
    playButtonSound(); 
    if (!isTvOn || tvTransitioning) return; 
    if(tvVideo.paused) tvVideo.play(); else tvVideo.pause(); 
};

tvNextBtn.onclick = () => { 
    playButtonSound(); 
    if (isTvOn && !tvTransitioning) playNextTv(false); 
};

if (tvPowerBtn) {
    tvPowerBtn.innerText = isTvOn ? '🟢' : '🔴';
    tvPowerBtn.addEventListener('click', () => {
        playButtonSound();
        if (tvTransitioning || !tvScreenMesh) return;
        setTvTransitioning(true);
        tvVideo.pause();
        const mats = Array.isArray(tvScreenMesh.material) ? tvScreenMesh.material : [tvScreenMesh.material];
        const effectVideo = isTvOn ? tvEffectVideoOff : tvEffectVideoOn; 
        const effectTexture = isTvOn ? tvEffectTextureOff : tvEffectTextureOn;

        mats.forEach(mat => { 
            mat.map = effectTexture; 
            mat.emissiveMap = effectTexture; 
            mat.color.setHex(0xffffff); 
            mat.emissive.setHex(0xffffff); 
            mat.emissiveIntensity = 1.0; 
            mat.needsUpdate = true; 
        });
        effectVideo.currentTime = 0; 
        effectVideo.play().catch(e=>{});

        const onEffectEnded = () => {
            effectVideo.removeEventListener('ended', onEffectEnded);
            if (isTvOn) {
                setTvOn(false);
                tvPowerBtn.innerText = '🔴'; 
                tvPowerBtn.style.color = 'red'; 
                tvPowerBtn.style.textShadow = '0 0 5px red';
                mats.forEach(mat => { 
                    mat.map = null; 
                    mat.emissiveMap = null; 
                    mat.color.setHex(0x000000); 
                    mat.emissive.setHex(0x000000); 
                    mat.emissiveIntensity = 0; 
                    mat.needsUpdate = true; 
                });
            } else {
                setTvOn(true);
                tvPowerBtn.innerText = '🟢'; 
                tvPowerBtn.style.color = '#00ff00'; 
                tvPowerBtn.style.textShadow = '0 0 5px #00ff00';
                mats.forEach(mat => { 
                    mat.map = tvTexture; 
                    mat.emissiveMap = tvTexture; 
                    mat.color.setHex(0xffffff); 
                    mat.emissive.setHex(0xffffff); 
                    mat.emissiveIntensity = 1.0; 
                    mat.needsUpdate = true; 
                });
                import('./core.js').then(module => {
                    if (module.tvPlaylist.length > 0) { 
                        tvVideo.currentTime = 0; 
                        tvVideo.play().catch(e=>{}); 
                    }
                });
            }
            setTvTransitioning(false);
        };
        effectVideo.addEventListener('ended', onEffectEnded, { once: true });
    });
}

// ---------- Manejador de interacciones (clics) ----------
function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) { 
        toggleLight(); 
        return; 
    }
    
    const pantallaMesh = loadedSlotMeshes['pantalla_tv'];
    if (pantallaMesh && raycaster.intersectObject(pantallaMesh, true).length > 0) {
        const tvControls = document.getElementById('tv-controls'); 
        const currentTime = Date.now();
        if (currentTime - lastTvClickTime < 300) { 
            if (isTvOn && !tvTransitioning) { 
                if (tvVideo.paused) tvVideo.play().catch(e=>{}); 
                else tvVideo.pause(); 
            } 
        } else { 
            if (tvControls.style.display === 'none' || tvControls.style.display === '') 
                tvControls.style.display = 'flex'; 
            else 
                tvControls.style.display = 'none'; 
        }
        setLastTvClickTime(currentTime);
        return;
    }

    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const pMesh = loadedSlotMeshes[cat];
        if (pMesh && raycaster.intersectObject(pMesh, true).length > 0) {
            import('./core.js').then(module => {
                const itemData = module.inventoryData[cat].items[module.inventoryData[cat].equipped];
                if (itemData && itemData.preview) { 
                    posterEnlargedImage.src = itemData.preview; 
                    posterViewModal.classList.add('visible'); 
                    audioAbrirPoster.currentTime = 0; 
                    audioAbrirPoster.play().catch(e=>{}); 
                }
            });
            break;
        }
    }
}

// ---------- Detección de arrastre vs clic ----------
let pointerDownPos = { x: 0, y: 0 }; 
let isDragging = false;

export function initInteractionEvents(renderer) {
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
            !document.getElementById('ff-settings-modal').classList.contains('active')) 
            handleInteraction(e); 
        isDragging = false; 
    });
}