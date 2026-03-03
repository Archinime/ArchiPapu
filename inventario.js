// inventario.js
// ============================================================
// Configuración por defecto del inventario (extraída del index.txt)
// ============================================================

export const defaultInventoryConfig = {
    piso: { label: "Piso", emoji: "🟫", equipped: "base", items: { "base": { name: "Piso Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/piso.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    paredes: { label: "Paredes", emoji: "🧱", equipped: "base", items: { "base": { name: "Paredes Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/paredes.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    techo: { label: "Techo", emoji: "🛖", equipped: "base", items: { "base": { name: "Techo Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/techo.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    puerta: { label: "Puerta", emoji: "🚪", equipped: "base", items: { "base": { name: "Puerta Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/puerta.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    interruptor: { label: "Interruptor", emoji: "🎛️", equipped: "base", items: { "base": { name: "Interruptor Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/interruptor.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    foco: {
        label: "Foco", emoji: "💡", equipped: "base",
        items: {
            "base": { name: "Foco Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco.glb", baseFile: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/base_foco.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" },
            "foco_brillante": { name: "Foco Brillante", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/foco.glb", baseFile: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/base_foco.glb", price: 250, owned: false, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/foco_brillante.png" }
        }
    },
    cama: {
        label: "Cama", emoji: "🛏️", equipped: "base",
        items: {
            "base": { name: "Cama Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/cama.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" },
            "cama_brillante": { name: "Cama Brillante", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/cama_brillante.glb", price: 500, owned: false, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/cama_brillante.png" }
        }
    },
    silla: { label: "Silla", emoji: "🪑", equipped: "base", items: { "base": { name: "Silla Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/silla.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    pc: { label: "Setup PC", emoji: "🖥️", equipped: "base", items: { "base": { name: "PC Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/pc.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    tele: { label: "Televisor", emoji: "📺", equipped: "base", items: { "base": { name: "Televisor Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/tele.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    mueble1: { label: "Mueble", emoji: "🗄️", equipped: "base", items: { "base": { name: "Mueble 1 Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/mueble1.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    mueble2: { label: "Escritorio", emoji: "🗄️", equipped: "base", items: { "base": { name: "Mueble 2 Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/mueble2.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    alfombra: { label: "Alfombra", emoji: "🔲", equipped: "base", items: { "base": { name: "Alfombra Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/alfombra.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    cortinas: { label: "Cortinas", emoji: "🪟", equipped: "base", items: { "base": { name: "Cortinas Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/cortinas.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    mousepad: { label: "Mouse Pad", emoji: "🖱️", equipped: "base", items: { "base": { name: "Mouse Pad Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/maouse_pad.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    poster_1: { label: "Póster 1", emoji: "🖼️", equipped: "base", items: { "base": { name: "Póster 1 Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/poster_1.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    poster_2: { label: "Póster 2", emoji: "🖼️", equipped: "base", items: { "base": { name: "Póster 2 Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/poster_2.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    poster_3: { label: "Póster 3", emoji: "🖼️", equipped: "base", items: { "base": { name: "Póster 3 Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/poster_3.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    poster_4: { label: "Póster 4", emoji: "🖼️", equipped: "base", items: { "base": { name: "Póster 4 Estándar", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/poster_4.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_piso: { label: "Adorno Piso", emoji: "🎍", equipped: "base", items: { "base": { name: "Deco Piso", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_piso.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_escritorio: { label: "Decoración 1", emoji: "🎍", equipped: "base", items: { "base": { name: "Deco Escritorio", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_escritorio.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_mueble_2: { label: "Decoración 2", emoji: "🎍", equipped: "base", items: { "base": { name: "Libros", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_mueble_2.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_2_mueble_2: { label: "Decoración 3", emoji: "🎍", equipped: "base", items: { "base": { name: "Reloj", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_2_mueble_2.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_mueble_1: { label: "Decoración 1", emoji: "🎍", equipped: "base", items: { "base": { name: "Adorno 1", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_mueble_1.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_2_mueble_1: { label: "Decoración 2", emoji: "🎍", equipped: "base", items: { "base": { name: "Adorno 2", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_2_mueble_1.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_3_mueble_1: { label: "Decoración 3", emoji: "🎍", equipped: "base", items: { "base": { name: "Adorno 3", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_3_mueble_1.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_4_mueble_1: { label: "Decoración 4", emoji: "🎍", equipped: "base", items: { "base": { name: "Adorno 4", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_4_mueble_1.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } },
    deco_5_mueble_1: { label: "Decoración 5", emoji: "🎍", equipped: "base", items: { "base": { name: "Adorno 5", file: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/decoracion_5_mueble_1.glb", price: 0, owned: true, preview: "https://cdn.jsdelivr.net/gh/Archinime/ArchiPapu@main/previews/base.png" } } }
};

// Grupos para organizar la interfaz (coincide con el original)
export const inventoryGroups = [
    { id: 'estructura', label: 'Estructura', emoji: '🏠', categories: ['piso', 'paredes', 'techo', 'puerta'] },
    { id: 'iluminacion', label: 'Iluminación', emoji: '💡', categories: ['interruptor', 'foco'] },
    { id: 'muebles', label: 'Muebles', emoji: '🛋️', categories: ['cama', 'silla', 'pc', 'tele', 'mueble1', 'mueble2'] },
    { id: 'textiles', label: 'Textiles', emoji: '🧶', categories: ['alfombra', 'cortinas', 'mousepad'] },
    { id: 'posters', label: 'Pósters', emoji: '🖼️', categories: ['poster_1', 'poster_2', 'poster_3', 'poster_4'] },
    { id: 'deco_mueble', label: 'Decoración del Mueble', emoji: '🎍', categories: ['deco_mueble_1', 'deco_2_mueble_1', 'deco_3_mueble_1', 'deco_4_mueble_1', 'deco_5_mueble_1'] },
    { id: 'deco_escritorio', label: 'Decoración del Escritorio', emoji: '🎍', categories: ['deco_escritorio', 'deco_mueble_2', 'deco_2_mueble_2'] },
    { id: 'deco_piso', label: 'Decoración del Piso', emoji: '🎍', categories: ['deco_piso'] }
];

// ============================================================
// Funciones de persistencia (localStorage y Firebase)
// ============================================================

// Claves para localStorage
const STORAGE_KEY = 'room_inventory';
const COINS_KEY = 'room_coins';

// Obtiene el inventario guardado o el por defecto
export function loadInventory() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.warn('Error parseando inventario, usando default');
        }
    }
    return JSON.parse(JSON.stringify(defaultInventoryConfig)); // clon profundo
}

// Guarda el inventario en localStorage
export function saveInventory(inventory) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}

// Monedas
export function loadCoins() {
    return parseInt(localStorage.getItem(COINS_KEY)) || 1000;
}

export function saveCoins(coins) {
    localStorage.setItem(COINS_KEY, coins);
}

// ============================================================
// Funciones para Firebase (opcional)
// ============================================================
// Para usar Firebase, descomenta y configura tus credenciales.
// Luego puedes llamar a syncFromFirebase() y syncToFirebase().

/*
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const docRef = doc(db, 'habitacion', 'inventario');

export async function syncFromFirebase() {
    try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.inventory) {
                saveInventory(data.inventory);
                if (data.coins !== undefined) saveCoins(data.coins);
                return data;
            }
        }
    } catch (e) {
        console.error('Error cargando desde Firebase', e);
    }
    return null;
}

export async function syncToFirebase(inventory, coins) {
    try {
        await setDoc(docRef, { inventory, coins, updatedAt: new Date().toISOString() });
        return true;
    } catch (e) {
        console.error('Error guardando en Firebase', e);
        return false;
    }
}
*/