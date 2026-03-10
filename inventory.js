import { state } from './core.js';
import { defaultInventoryConfig, inventoryGroups } from './inventory-data.js';
import { saveGame } from './utils.js';
import { loadItemForSlot } from './models.js';
import { updatePlaylist } from './tv.js';

// Inicializar inventoryData (compatibilidad con estructura anterior)
export function initInventoryData() {
    let stored = JSON.parse(localStorage.getItem('room_inventory'));
    if (stored && stored.base_foco) delete stored.base_foco;
    state.inventoryData = stored || defaultInventoryConfig;

    for (let cat in defaultInventoryConfig) {
        if (!state.inventoryData[cat]) state.inventoryData[cat] = defaultInventoryConfig[cat];
        state.inventoryData[cat].emoji = defaultInventoryConfig[cat].emoji;
        state.inventoryData[cat].label = defaultInventoryConfig[cat].label;
        state.inventoryData[cat].type = defaultInventoryConfig[cat].type || 'single';
        if (state.inventoryData[cat].type === 'multiple') {
            if (!Array.isArray(state.inventoryData[cat].equipped)) {
                state.inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
            }
        } else {
            if (!state.inventoryData[cat].items[state.inventoryData[cat].equipped]) {
                state.inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
            }
        }
        for (let item in defaultInventoryConfig[cat].items) {
            if (!state.inventoryData[cat].items[item]) {
                state.inventoryData[cat].items[item] = defaultInventoryConfig[cat].items[item];
            } else {
                state.inventoryData[cat].items[item].file = defaultInventoryConfig[cat].items[item].file;
                state.inventoryData[cat].items[item].name = defaultInventoryConfig[cat].items[item].name;
                if (defaultInventoryConfig[cat].items[item].baseFile) {
                    state.inventoryData[cat].items[item].baseFile = defaultInventoryConfig[cat].items[item].baseFile;
                }
                if (defaultInventoryConfig[cat].items[item].preview) {
                    state.inventoryData[cat].items[item].preview = defaultInventoryConfig[cat].items[item].preview;
                }
            }
        }
    }
}

let currentCategory = 'cama';
let openGroup = 'muebles';

export function renderInventory() {
    const sidebar = document.getElementById('inv-sidebar');
    const content = document.getElementById('inv-content');
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
            const catData = state.inventoryData[catKey];
            if (!catData) return;
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

    const catData = state.inventoryData[currentCategory];
    if (!catData) return;

    for (let itemId in catData.items) {
        const item = catData.items[itemId];
        let isEq = catData.type === 'multiple'
            ? catData.equipped.includes(itemId)
            : catData.equipped === itemId;

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

        card.innerHTML = `
            <div>
                ${prev.outerHTML}
                <h4>${item.name}</h4>
                <div class="item-price">${item.owned ? 'Adquirido' : `🪙 ${item.price}`}</div>
            </div>
            ${btnHtml}
        `;
        content.appendChild(card);
    }
}

// Funciones globales para los botones HTML
window.equipItem = function(category, itemId) {
    const catData = state.inventoryData[category];
    if (catData.type === 'multiple') {
        const idx = catData.equipped.indexOf(itemId);
        if (idx > -1) catData.equipped.splice(idx, 1);
        else catData.equipped.push(itemId);
        updatePlaylist();
    } else {
        catData.equipped = itemId;
        const itemData = catData.items[itemId];
        loadItemForSlot(category, itemData.file, false);
        if (category === 'foco' && itemData.baseFile) {
            loadItemForSlot('base_foco', itemData.baseFile, false);
        }
        if (category === 'tele' && itemData.baseFile) {
            loadItemForSlot('pantalla_tv', itemData.baseFile, false);
        }
    }
    saveGame();
    renderInventory();
};

window.buyItem = function(category, itemId) {
    let item = state.inventoryData[category].items[itemId];
    if (state.playerCoins >= item.price) {
        state.playerCoins -= item.price;
        item.owned = true;
        saveGame();
        renderInventory();
    } else {
        alert("No tienes suficientes monedas.");
    }
};

// Inicializar eventos del modal de inventario
export function initInventoryModal() {
    document.getElementById('inventory-button').onclick = () => {
        document.getElementById('inventory-modal').classList.add('visible');
        renderInventory();
    };
    document.getElementById('close-inv').onclick = () => {
        document.getElementById('inventory-modal').classList.remove('visible');
    };
}