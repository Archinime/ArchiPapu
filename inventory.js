import { 
    inventoryData, playerCoins, gameSettings, saveGame, 
    loadItemForSlot, updatePlaylist, applyCurrentSettings 
} from './core.js';
import { inventoryGroups } from './inventory-data.js';

// ---------- Variables de estado para la UI ----------
let currentCategory = 'cama';
let openGroup = 'muebles';

// ---------- Renderizado del inventario ----------
export function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar'), 
          content = document.getElementById('inv-content');
    sidebar.innerHTML = ''; 
    content.innerHTML = '';

    inventoryGroups.forEach(group => {
        const groupDiv = document.createElement('div'); 
        groupDiv.className = 'inv-group';
        const groupBtn = document.createElement('button'); 
        groupBtn.className = 'group-btn';
        groupBtn.innerHTML = `<span>${group.emoji} ${group.label}</span> <span style="transition:0.3s; transform: ${openGroup === group.id ? 'rotate(90deg)' : 'rotate(0deg)'}">▶</span>`;
        groupBtn.onclick = () => { 
            openGroup = openGroup === group.id ? null : group.id; 
            renderInventory(); 
        };
        groupDiv.appendChild(groupBtn);

        const groupContent = document.createElement('div'); 
        groupContent.className = `group-content ${openGroup === group.id ? 'open' : ''}`;
        group.categories.forEach(catKey => {
            const catData = inventoryData[catKey]; 
            if(!catData) return;
            const btn = document.createElement('button'); 
            btn.className = `cat-btn ${catKey === currentCategory ? 'active' : ''}`;
            btn.innerHTML = `<span class="cat-icon-emoji">${catData.emoji}</span> <span>${catData.label}</span>`;
            btn.onclick = () => { 
                currentCategory = catKey; 
                renderInventory(); 
            };
            groupContent.appendChild(btn);
        });
        groupDiv.appendChild(groupContent); 
        sidebar.appendChild(groupDiv);
    });

    const catData = inventoryData[currentCategory]; 
    if (!catData) return;

    for (let itemId in catData.items) {
        const item = catData.items[itemId]; 
        let isEq = catData.type === 'multiple' ? catData.equipped.includes(itemId) : catData.equipped === itemId;
        const card = document.createElement('div'); 
        card.className = 'item-card';
        const prev = document.createElement('div'); 
        prev.className = 'item-preview';
        if (item.preview) { 
            const img = document.createElement('img'); 
            img.src = item.preview; 
            img.alt = item.name; 
            img.onerror = () => { prev.innerHTML = `<span>${catData.emoji}</span>`; }; 
            prev.appendChild(img); 
        } else { 
            prev.innerHTML = `<span>${catData.emoji}</span>`; 
        }

        let btnHtml = '';
        if (item.owned) {
            if (isEq) {
                btnHtml = `<button class="item-btn btn-equipped" onclick="window.equipItem('${currentCategory}', '${itemId}')">${catData.type === 'multiple' ? 'Quitar ✓' : 'Equipado ✓'}</button>`;
            } else {
                btnHtml = `<button class="item-btn btn-equip" onclick="window.equipItem('${currentCategory}', '${itemId}')">Equipar</button>`;
            }
        } else {
            btnHtml = `<button class="item-btn btn-buy" onclick="window.buyItem('${currentCategory}', '${itemId}')">Comprar 🪙${item.price}</button>`;
        }

        card.innerHTML = `<div>${prev.outerHTML}<h4>${item.name}</h4><div class="item-price">${item.owned ? 'Adquirido' : `🪙 ${item.price}`}</div></div>${btnHtml}`; 
        content.appendChild(card);
    }
}

// ---------- Funciones globales para botones (expuestas en window) ----------
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
        if (category === 'foco' && itemData.baseFile) 
            loadItemForSlot('base_foco', itemData.baseFile, false); 
        if (category === 'tele' && itemData.baseFile) 
            loadItemForSlot('pantalla_tv', itemData.baseFile, false); 
    }
    saveGame(); 
    renderInventory(); 
};

window.buyItem = function(category, itemId) {
    let item = inventoryData[category].items[itemId];
    if (playerCoins >= item.price) { 
        playerCoins -= item.price; 
        item.owned = true; 
        saveGame(); 
        renderInventory(); 
    } else { 
        alert("No tienes suficientes monedas."); 
    }
};

// ---------- Configuración (settings) ----------
const settingsModal = document.getElementById('ff-settings-modal');

document.getElementById('settings-button').onclick = () => 
    settingsModal.classList.add('active');

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
            if(gameSettings.calidad === 'baja') { 
                gameSettings.sombras = 0; 
                gameSettings.fps = 30; 
            } else if(gameSettings.calidad === 'media') { 
                gameSettings.sombras = 1; 
                gameSettings.fps = 60; 
            } else if(gameSettings.calidad === 'alta') { 
                gameSettings.sombras = 2; 
                gameSettings.fps = 60; 
            } 
            syncSettingsUI(); 
            applyCurrentSettings(); 
        };
    });

    document.querySelectorAll('#setting-fps button').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val) === gameSettings.fps);
        b.onclick = () => { 
            gameSettings.fps = parseInt(b.dataset.val); 
            syncSettingsUI(); 
        };
    });
    
    const volTV = document.getElementById('setting-volumen-tv'); 
    volTV.value = gameSettings.volumenTV; 
    document.getElementById('vol-tv-val').innerText = `${gameSettings.volumenTV}%`;
    volTV.oninput = (e) => { 
        gameSettings.volumenTV = e.target.value; 
        document.getElementById('vol-tv-val').innerText = `${gameSettings.volumenTV}%`; 
        applyCurrentSettings(); 
    };
    
    const volEf = document.getElementById('setting-volumen-efectos'); 
    volEf.value = gameSettings.volumenEfectos; 
    document.getElementById('vol-efectos-val').innerText = `${gameSettings.volumenEfectos}%`;
    volEf.oninput = (e) => { 
        gameSettings.volumenEfectos = e.target.value; 
        document.getElementById('vol-efectos-val').innerText = `${gameSettings.volumenEfectos}%`; 
        applyCurrentSettings(); 
    };

    const fpsCheck = document.getElementById('setting-showfps'); 
    fpsCheck.checked = gameSettings.mostrarFps; 
    fpsCheck.onchange = (e) => { 
        gameSettings.mostrarFps = e.target.checked; 
        applyCurrentSettings(); 
    };
}

// ---------- Botón de inventario ----------
document.getElementById('inventory-button').onclick = () => { 
    document.getElementById('inventory-modal').classList.add('visible'); 
    renderInventory(); 
};

document.getElementById('close-inv').onclick = () => { 
    document.getElementById('inventory-modal').classList.remove('visible'); 
};