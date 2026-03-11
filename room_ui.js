import { 
    scene, camera, renderer, controls, loadedSlotMeshes, switchMesh, focoMesh, focoDiaMesh,
    isTvOn, tvTransitioning, lastTvClickTime, tvScreenMesh, tvVideo, tvPlaylist, currentTvIndex,
    tvEffectVideoOff, tvEffectVideoOn, tvEffectTextureOff, tvEffectTextureOn,
    audioPrenderLuz, audioApagarLuz, audioAbrirPoster, audioCerrarPoster, audioBotonTV,
    playerCoins, inventoryData, gameSettings, saveGame, applyCurrentSettings, 
    updatePlaylist, playNextTv, lightOn, mainLight, ambient, hemiLight,
    isMobileUA, inventoryGroups, defaultInventoryConfig
} from './room_main.js';
import { loadItemForSlot } from './room_models.js';

// ==================== INTERACCIÓN (RAYCASTER) ====================
const raycaster = new THREE.Raycaster(); 
const mouse = new THREE.Vector2();

function toggleLight() {
    lightOn = !lightOn; localStorage.setItem('lightState', lightOn ? 'on' : 'off'); 
    if (lightOn) {
        mainLight.visible = true; ambient.intensity = gameSettings.calidad === 'baja' ? 0.8 : 0.3; hemiLight.intensity = gameSettings.calidad === 'baja' ? 0.8 : 0.4;
        document.getElementById('light-status').innerText = '💡 Luz encendida';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 1.5; });
        audioPrenderLuz.currentTime = 0; audioPrenderLuz.play().catch(e=>{});
    } else {
        mainLight.visible = false; ambient.intensity = 0.02; hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
        if (focoMesh) focoMesh.traverse((n) => { if (n.isMesh && n.material) n.material.emissiveIntensity = 0; });
        audioApagarLuz.currentTime = 0; audioApagarLuz.play().catch(e=>{});
    }
}

const posterViewModal = document.getElementById('poster-view-modal'); 
const posterEnlargedImage = document.getElementById('poster-enlarged-image');
document.getElementById('close-poster-view').onclick = () => { posterViewModal.classList.remove('visible'); audioCerrarPoster.currentTime = 0; audioCerrarPoster.play().catch(e=>{}); };
posterViewModal.onclick = (e) => { if (e.target === posterViewModal) { posterViewModal.classList.remove('visible'); audioCerrarPoster.currentTime = 0; audioCerrarPoster.play().catch(e=>{}); } };

function handleInteraction(event) {
    const rect = renderer.domElement.getBoundingClientRect(); 
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; 
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; 
    raycaster.setFromCamera(mouse, camera);
    
    if (switchMesh && raycaster.intersectObject(switchMesh, true).length > 0) { toggleLight(); return; }
    
    const pantallaMesh = loadedSlotMeshes['pantalla_tv'];
    if (pantallaMesh && raycaster.intersectObject(pantallaMesh, true).length > 0) {
        const tvControls = document.getElementById('tv-controls'); const currentTime = Date.now();
        if (currentTime - lastTvClickTime < 300) { 
            if (isTvOn && !tvTransitioning) { if (tvVideo.paused) tvVideo.play().catch(e=>{}); else tvVideo.pause(); } 
        } else { 
            tvControls.style.display = tvControls.style.display === 'flex' ? 'none' : 'flex'; 
        }
        lastTvClickTime = currentTime; return;
    }

    const posterCategories = ['poster_1', 'poster_2', 'poster_3', 'poster_4'];
    for (let cat of posterCategories) {
        const pMesh = loadedSlotMeshes[cat];
        if (pMesh && raycaster.intersectObject(pMesh, true).length > 0) {
            const itemData = inventoryData[cat].items[inventoryData[cat].equipped];
            if (itemData && itemData.preview) { 
                posterEnlargedImage.src = itemData.preview; 
                posterViewModal.classList.add('visible'); 
                audioAbrirPoster.currentTime = 0; audioAbrirPoster.play().catch(e=>{}); 
            }
            break;
        }
    }
}

// Detección de arrastre vs clic
let pointerDownPos = { x: 0, y: 0 }; let isDragging = false;
renderer.domElement.addEventListener('pointerdown', (e) => { pointerDownPos.x = e.clientX; pointerDownPos.y = e.clientY; isDragging = false; });
renderer.domElement.addEventListener('pointermove', (e) => { const dx = e.clientX - pointerDownPos.x; const dy = e.clientY - pointerDownPos.y; if (Math.sqrt(dx * dx + dy * dy) > 5) isDragging = true; });
renderer.domElement.addEventListener('pointerup', (e) => { 
    if (!isDragging && !document.getElementById('inventory-modal').classList.contains('visible') && !document.getElementById('ff-settings-modal').classList.contains('active')) 
        handleInteraction(e); 
    isDragging = false; 
});

// ==================== TV CONTROLS ====================
const tvPrevBtn = document.getElementById('tv-prev'), tvPlayPauseBtn = document.getElementById('tv-play-pause'), tvNextBtn = document.getElementById('tv-next'), tvPowerBtn = document.getElementById('tv-power');

function playButtonSound() { audioBotonTV.currentTime = 0; audioBotonTV.play().catch(e=>{}); }

tvPrevBtn.onclick = () => { playButtonSound(); if (!isTvOn || tvTransitioning) return; updatePlaylist(); if(tvPlaylist.length===0)return; currentTvIndex = (currentTvIndex - 1 + tvPlaylist.length) % tvPlaylist.length; tvVideo.src = tvPlaylist[currentTvIndex]; tvVideo.play(); };
tvPlayPauseBtn.onclick = () => { playButtonSound(); if (!isTvOn || tvTransitioning) return; if(tvVideo.paused) tvVideo.play(); else tvVideo.pause(); };
tvNextBtn.onclick = () => { playButtonSound(); if (isTvOn && !tvTransitioning) playNextTv(false); };

if (tvPowerBtn) {
    tvPowerBtn.innerText = isTvOn ? '🟢' : '🔴';
    tvPowerBtn.addEventListener('click', () => {
        playButtonSound();
        if (tvTransitioning || !tvScreenMesh) return;
        tvTransitioning = true; tvVideo.pause();
        const mats = Array.isArray(tvScreenMesh.material) ? tvScreenMesh.material : [tvScreenMesh.material];
        const effectVideo = isTvOn ? tvEffectVideoOff : tvEffectVideoOn; 
        const effectTexture = isTvOn ? tvEffectTextureOff : tvEffectTextureOn;

        mats.forEach(mat => { mat.map = effectTexture; mat.emissiveMap = effectTexture; mat.color.setHex(0xffffff); mat.emissive.setHex(0xffffff); mat.emissiveIntensity = 1.0; mat.needsUpdate = true; });
        effectVideo.currentTime = 0; effectVideo.play().catch(e=>{});

        const onEffectEnded = () => {
            effectVideo.removeEventListener('ended', onEffectEnded);
            if (isTvOn) {
                isTvOn = false; tvPowerBtn.innerText = '🔴'; tvPowerBtn.style.color = 'red'; tvPowerBtn.style.textShadow = '0 0 5px red';
                mats.forEach(mat => { mat.map = null; mat.emissiveMap = null; mat.color.setHex(0x000000); mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; mat.needsUpdate = true; });
            } else {
                isTvOn = true; tvPowerBtn.innerText = '🟢'; tvPowerBtn.style.color = '#00ff00'; tvPowerBtn.style.textShadow = '0 0 5px #00ff00';
                mats.forEach(mat => { mat.map = tvTexture; mat.emissiveMap = tvTexture; mat.color.setHex(0xffffff); mat.emissive.setHex(0xffffff); mat.emissiveIntensity = 1.0; mat.needsUpdate = true; });
                if (tvPlaylist.length > 0) { tvVideo.currentTime = 0; tvVideo.play().catch(e=>{}); }
            }
            tvTransitioning = false;
        };
        effectVideo.addEventListener('ended', onEffectEnded, { once: true });
    });
}

// ==================== INVENTARIO ====================
let currentCategory = 'cama', openGroup = 'muebles';

window.equipItem = function(category, itemId) {
    const catData = inventoryData[category];
    if (catData.type === 'multiple') { 
        const idx = catData.equipped.indexOf(itemId); 
        if (idx > -1) catData.equipped.splice(idx, 1); 
        else catData.equipped.push(itemId); 
        updatePlaylist(); 
    } else { 
        catData.equipped = itemId; 
        const itemData = catData.items[itemId]; 
        loadItemForSlot(category, itemData.file, false); 
        if (category === 'foco' && itemData.baseFile) loadItemForSlot('base_foco', itemData.baseFile, false); 
        if (category === 'tele' && itemData.baseFile) loadItemForSlot('pantalla_tv', itemData.baseFile, false); 
    }
    saveGame(); renderInventory(); 
};

window.buyItem = function(category, itemId) {
    let item = inventoryData[category].items[itemId];
    if (playerCoins >= item.price) { playerCoins -= item.price; item.owned = true; saveGame(); renderInventory(); } else alert("No tienes suficientes monedas.");
};

export function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar'), content = document.getElementById('inv-content'); 
    sidebar.innerHTML = ''; content.innerHTML = '';
    inventoryGroups.forEach(group => {
        const groupDiv = document.createElement('div'); groupDiv.className = 'inv-group';
        const groupBtn = document.createElement('button'); groupBtn.className = 'group-btn';
        groupBtn.innerHTML = `<span>${group.emoji} ${group.label}</span> <span style="transition:0.3s; transform: ${openGroup === group.id ? 'rotate(90deg)' : 'rotate(0deg)'}">▶</span>`;
        groupBtn.onclick = () => { openGroup = openGroup === group.id ? null : group.id; renderInventory(); };
        groupDiv.appendChild(groupBtn);
        const groupContent = document.createElement('div'); groupContent.className = `group-content ${openGroup === group.id ? 'open' : ''}`;
        group.categories.forEach(catKey => {
            const catData = inventoryData[catKey]; if(!catData) return;
            const btn = document.createElement('button'); btn.className = `cat-btn ${catKey === currentCategory ? 'active' : ''}`;
            btn.innerHTML = `<span class="cat-icon-emoji">${catData.emoji}</span> <span>${catData.label}</span>`;
            btn.onclick = () => { currentCategory = catKey; renderInventory(); };
            groupContent.appendChild(btn);
        });
        groupDiv.appendChild(groupContent); sidebar.appendChild(groupDiv);
    });

    const catData = inventoryData[currentCategory]; if (!catData) return;
    for (let itemId in catData.items) {
        const item = catData.items[itemId]; let isEq = catData.type === 'multiple' ? catData.equipped.includes(itemId) : catData.equipped === itemId;
        const card = document.createElement('div'); card.className = 'item-card';
        const prev = document.createElement('div'); prev.className = 'item-preview';
        if (item.preview) { const img = document.createElement('img'); img.src = item.preview; img.alt = item.name; img.onerror = () => { prev.innerHTML = `<span>${catData.emoji}</span>`; }; prev.appendChild(img); } else prev.innerHTML = `<span>${catData.emoji}</span>`;
        let btn = item.owned ? (isEq ? `<button class="item-btn btn-equipped" onclick="equipItem('${currentCategory}', '${itemId}')">${catData.type === 'multiple' ? 'Quitar ✓' : 'Equipado ✓'}</button>` : `<button class="item-btn btn-equip" onclick="equipItem('${currentCategory}', '${itemId}')">Equipar</button>`) : `<button class="item-btn btn-buy" onclick="buyItem('${currentCategory}', '${itemId}')">Comprar 🪙${item.price}</button>`;
        card.innerHTML = `<div>${prev.outerHTML}<h4>${item.name}</h4><div class="item-price">${item.owned ? 'Adquirido' : `🪙 ${item.price}`}</div></div>${btn}`; content.appendChild(card);
    }
}

document.getElementById('inventory-button').onclick = () => { document.getElementById('inventory-modal').classList.add('visible'); renderInventory(); };
document.getElementById('close-inv').onclick = () => { document.getElementById('inventory-modal').classList.remove('visible'); };

// ==================== AJUSTES MODAL ====================
const settingsModal = document.getElementById('ff-settings-modal');
document.getElementById('settings-button').onclick = () => settingsModal.classList.add('active');
document.getElementById('close-ff-settings').onclick = () => { 
    settingsModal.classList.remove('active'); 
    localStorage.setItem('ff_settings', JSON.stringify(gameSettings)); 
    applyCurrentSettings(); 
};
document.querySelectorAll('.ff-tab').forEach(tab => {
    tab.onclick = () => { 
        document.querySelectorAll('.ff-tab').forEach(t => t.classList.remove('active')); 
        document.querySelectorAll('.ff-tab-pane').forEach(p => p.classList.remove('active')); 
        tab.classList.add('active'); 
        document.getElementById(tab.dataset.target).classList.add('active'); 
    };
});

export function syncSettingsUI() {
    document.querySelectorAll('#setting-calidad button').forEach(b => {
        b.classList.toggle('active', b.dataset.val === gameSettings.calidad);
        b.onclick = () => { 
            gameSettings.calidad = b.dataset.val; 
            if(gameSettings.calidad === 'baja') { gameSettings.sombras = 0; gameSettings.fps = 30; } 
            else if(gameSettings.calidad === 'media') { gameSettings.sombras = 1; gameSettings.fps = 60; } 
            else if(gameSettings.calidad === 'alta') { gameSettings.sombras = 2; gameSettings.fps = 60; } 
            syncSettingsUI(); applyCurrentSettings(); 
        };
    });
    document.querySelectorAll('#setting-fps button').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val) === gameSettings.fps);
        b.onclick = () => { gameSettings.fps = parseInt(b.dataset.val); syncSettingsUI(); };
    });
    
    const volTV = document.getElementById('setting-volumen-tv'); volTV.value = gameSettings.volumenTV; document.getElementById('vol-tv-val').innerText = `${gameSettings.volumenTV}%`;
    volTV.oninput = (e) => { gameSettings.volumenTV = e.target.value; document.getElementById('vol-tv-val').innerText = `${gameSettings.volumenTV}%`; applyCurrentSettings(); };
    
    const volEf = document.getElementById('setting-volumen-efectos'); volEf.value = gameSettings.volumenEfectos; document.getElementById('vol-efectos-val').innerText = `${gameSettings.volumenEfectos}%`;
    volEf.oninput = (e) => { gameSettings.volumenEfectos = e.target.value; document.getElementById('vol-efectos-val').innerText = `${gameSettings.volumenEfectos}%`; applyCurrentSettings(); };

    const fpsCheck = document.getElementById('setting-showfps'); fpsCheck.checked = gameSettings.mostrarFps; 
    fpsCheck.onchange = (e) => { gameSettings.mostrarFps = e.target.checked; applyCurrentSettings(); };
}

// ==================== INICIALIZACIÓN DE UI ====================
export function initUI() {
    syncSettingsUI();
    // Actualizar estado inicial de la luz
    if (!lightOn) {
        mainLight.visible = false; ambient.intensity = 0.02; hemiLight.intensity = 0.05;
        document.getElementById('light-status').innerText = '💡 Luz apagada';
    } else {
        document.getElementById('light-status').innerText = '💡 Luz encendida';
    }
}