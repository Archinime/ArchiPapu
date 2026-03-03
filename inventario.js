// inventario.js
// Configuración por defecto del inventario
export const defaultInventoryConfig = {
    cama: {
        label: "Cama",
        emoji: "🛏️",
        equipped: "base",
        items: {
            base: {
                name: "Cama estándar",
                file: "models/cama.glb",
                price: 120,
                owned: true,
                preview: "cama1.png",  // Imagen asignada
            },
            individual: {
                name: "Cama individual",
                file: "models/cama_individual.glb",
                price: 80,
                owned: false,
                preview: "cama_individual.png",
            },
        },
    },
    sofa: {
        label: "Sofá",
        emoji: "🛋️",
        equipped: "base",
        items: {
            base: {
                name: "Sofá clásico",
                file: "models/sofa.glb",
                price: 200,
                owned: true,
                preview: "sofa.png",
            },
        },
    },
    lampara: {
        label: "Lámpara",
        emoji: "💡",
        equipped: "base",
        items: {
            base: {
                name: "Lámpara de pie",
                file: "models/lampara.glb",
                price: 45,
                owned: false,
                preview: "lampara.png",
            },
        },
    },
    mesa: {
        label: "Mesa",
        emoji: "🪑",
        equipped: "base",
        items: {
            base: {
                name: "Mesa de centro",
                file: "models/mesa.glb",
                price: 150,
                owned: true,
                preview: "mesa.png",
            },
        },
    },
    estante: {
        label: "Estante",
        emoji: "📚",
        equipped: "base",
        items: {
            base: {
                name: "Estante librero",
                file: "models/estante.glb",
                price: 90,
                owned: false,
                preview: "estante.png",
            },
        },
    },
    alfombra: {
        label: "Alfombra",
        emoji: "🧶",
        equipped: "base",
        items: {
            base: {
                name: "Alfombra suave",
                file: "models/alfombra.glb",
                price: 60,
                owned: true,
                preview: "alfombra.png",
            },
        },
    },
    poster: {
        label: "Póster",
        emoji: "🖼️",
        equipped: "base",
        items: {
            base: {
                name: "Póster decorativo",
                file: "models/poster.glb",
                price: 25,
                owned: false,
                preview: "poster.png",
            },
        },
    },
    maceta: {
        label: "Maceta",
        emoji: "🪴",
        equipped: "base",
        items: {
            base: {
                name: "Maceta con planta",
                file: "models/maceta.glb",
                price: 30,
                owned: true,
                preview: "maceta.png",
            },
        },
    },
    reloj: {
        label: "Reloj",
        emoji: "⏰",
        equipped: "base",
        items: {
            base: {
                name: "Reloj de pared",
                file: "models/reloj.glb",
                price: 40,
                owned: false,
                preview: "reloj.png",
            },
        },
    },
};

// Grupos de categorías (para organizar la interfaz)
export const inventoryGroups = [
    { id: "estructura", label: "Estructura", emoji: "🏗️", categories: [] },
    { id: "iluminacion", label: "Iluminación", emoji: "💡", categories: ["lampara"] },
    { id: "muebles", label: "Muebles", emoji: "🪑", categories: ["cama", "sofa", "mesa", "estante"] },
    { id: "textiles", label: "Textiles", emoji: "🧵", categories: ["alfombra"] },
    { id: "posters", label: "Pósters", emoji: "🖼️", categories: ["poster"] },
    { id: "deco_mueble", label: "Deco Mueble", emoji: "🔮", categories: [] },
    { id: "deco_escritorio", label: "Deco Escritorio", emoji: "✏️", categories: [] },
    { id: "deco_piso", label: "Deco Piso", emoji: "🌿", categories: ["maceta", "reloj"] },
];

// Cargar inventario desde localStorage o usar el default
export function loadInventory() {
    const stored = localStorage.getItem("archinime_inventory");
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.warn("Error parsing stored inventory, using default.");
        }
    }
    // Si no hay datos guardados, clonamos el default
    return JSON.parse(JSON.stringify(defaultInventoryConfig));
}

// Guardar inventario en localStorage
export function saveInventory(data) {
    localStorage.setItem("archinime_inventory", JSON.stringify(data));
}