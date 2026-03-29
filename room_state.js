import { defaultInventoryConfig } from './inventory-data.js';

export const State = {
    playerCoins: parseInt(localStorage.getItem('room_coins')) || 1000,
    inventoryData: JSON.parse(localStorage.getItem('room_inventory')) || defaultInventoryConfig,
    gameSettings: null,
    lightOn: localStorage.getItem('lightState') !== 'off',
    isRoomStarted: false,
    saveGame() {
        localStorage.setItem('room_coins', this.playerCoins);
        localStorage.setItem('room_inventory', JSON.stringify(this.inventoryData));
        const coinAmount = document.getElementById('coin-amount');
        if (coinAmount) coinAmount.innerText = this.playerCoins;
    }
};

if (State.inventoryData.base_foco) delete State.inventoryData.base_foco;
for (let cat in defaultInventoryConfig) {
    if(!State.inventoryData[cat]) State.inventoryData[cat] = defaultInventoryConfig[cat];
    State.inventoryData[cat].emoji = defaultInventoryConfig[cat].emoji;
    State.inventoryData[cat].label = defaultInventoryConfig[cat].label;
    State.inventoryData[cat].type = defaultInventoryConfig[cat].type || 'single';
    if (State.inventoryData[cat].type === 'multiple') {
        if (!Array.isArray(State.inventoryData[cat].equipped)) State.inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
    } else {
        if (!State.inventoryData[cat].equipped || !State.inventoryData[cat].items[State.inventoryData[cat].equipped]) {
            State.inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
        }
    }
    for (let item in defaultInventoryConfig[cat].items) {
        if (!State.inventoryData[cat].items[item]) {
            State.inventoryData[cat].items[item] = defaultInventoryConfig[cat].items[item];
        } else {
            State.inventoryData[cat].items[item].price = defaultInventoryConfig[cat].items[item].price;
            State.inventoryData[cat].items[item].name = defaultInventoryConfig[cat].items[item].name;
            State.inventoryData[cat].items[item].file = defaultInventoryConfig[cat].items[item].file;
        }
    }
}

export const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

State.gameSettings = JSON.parse(localStorage.getItem('ff_settings')) || {
    calidad: isMobileUA ? 'baja' : 'media',
    mostrarFps: false,
    volumenMusica: 50,
    volumenEfectos: 50,
    volumenPC: 50
};
if (State.gameSettings.volumen !== undefined) {
    State.gameSettings.volumenMusica = State.gameSettings.volumen; 
    State.gameSettings.volumenEfectos = State.gameSettings.volumen; 
    delete State.gameSettings.volumen;
}
if(State.gameSettings.volumenPC === undefined) State.gameSettings.volumenPC = 50;

export function checkDailyReward() {
    let lastLogin = localStorage.getItem('room_last_login');
    let today = new Date().toDateString();
    if (lastLogin !== today) {
        State.playerCoins += 100;
        localStorage.setItem('room_last_login', today);
        const toast = document.getElementById('daily-reward-toast');
        if (toast) {
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 4000);
        }
    }
    const coinAmt = document.getElementById('coin-amount');
    if (coinAmt) coinAmt.innerText = State.playerCoins;
}

export function getFreshUrl(url) {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}nocache=${Date.now()}`;
}

// OPTIMIZACIÓN DE VRAM: Eliminación total de objetos y texturas en desuso
export function disposeThreeJSObject(node) {
    if (!node) return;
    node.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (mat.map) mat.map.dispose();
                    if (mat.lightMap) mat.lightMap.dispose();
                    if (mat.bumpMap) mat.bumpMap.dispose();
                    if (mat.normalMap) mat.normalMap.dispose();
                    if (mat.specularMap) mat.specularMap.dispose();
                    if (mat.envMap) mat.envMap.dispose();
                    if (mat.emissiveMap) mat.emissiveMap.dispose();
                    mat.dispose();
                });
            }
        }
    });
}