import { state } from './core.js';

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
                if (mat.map) mat.map.dispose();
                mat.dispose();
            });
        } else {
            if (node.material.map) node.material.map.dispose();
            node.material.dispose();
        }
    }
    if (node.children) node.children.forEach(child => disposeThreeJSObject(child));
}

export function saveGame() {
    localStorage.setItem('room_coins', state.playerCoins);
    localStorage.setItem('room_inventory', JSON.stringify(state.inventoryData));
    document.getElementById('coin-amount').innerText = state.playerCoins;
}