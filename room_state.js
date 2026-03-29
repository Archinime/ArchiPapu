import { defaultInventoryConfig } from './inventory-data.js';

export const State = {
    playerCoins: parseInt(localStorage.getItem('room_coins')) || 1000,
    inventoryData: JSON.parse(localStorage.getItem('room_inventory')) || defaultInventoryConfig,
    // CORRECCIÓN: Evitamos que gameSettings sea null inicializándolo con valores por defecto
    gameSettings: JSON.parse(localStorage.getItem('ff_settings')) || {
        calidad: 'media',
        volumenMusica: 50,
        volumenEfectos: 50,
        volumenPC: 50,
        mostrarFps: false
    },
    lightOn: localStorage.getItem('lightState') !== 'off',
    isRoomStarted: false,
    saveGame() {
        localStorage.setItem('room_coins', this.playerCoins);
        localStorage.setItem('room_inventory', JSON.stringify(this.inventoryData));
        const coinAmount = document.getElementById('coin-amount');
        if (coinAmount) coinAmount.innerText = this.playerCoins;
    }
};

// Limpieza y estructuración del inventario
if (State.inventoryData.base_foco) delete State.inventoryData.base_foco;
for (let cat in defaultInventoryConfig) {
    if(!State.inventoryData[cat]) State.inventoryData[cat] = defaultInventoryConfig[cat];
    State.inventoryData[cat].emoji = defaultInventoryConfig[cat].emoji;
    State.inventoryData[cat].label = defaultInventoryConfig[cat].label;
    State.inventoryData[cat].type = defaultInventoryConfig[cat].type || 'single';
    if (State.inventoryData[cat].type === 'multiple') {
        if (!Array.isArray(State.inventoryData[cat].equipped)) State.inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
    } else {
        if (!State.inventoryData[cat].equipped) State.inventoryData[cat].equipped = defaultInventoryConfig[cat].equipped;
    }
}

// Migración de ajustes antiguos a los nuevos sin crashear
if (State.gameSettings.volumen !== undefined) {
    State.gameSettings.volumenMusica = State.gameSettings.volumen; 
    State.gameSettings.volumenEfectos = State.gameSettings.volumen; 
    delete State.gameSettings.volumen;
}
if(State.gameSettings.volumenPC === undefined) State.gameSettings.volumenPC = 50;

export const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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

export function disposeThreeJSObject(node) {
    if (!node) return;
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
        if (Array.isArray(node.material)) {
            node.material.forEach(mat => {
                if(mat.map) mat.map.dispose();
                mat.dispose();
            });
        } else {
            if(node.material.map) node.material.map.dispose();
            node.material.dispose();
        }
    }
}