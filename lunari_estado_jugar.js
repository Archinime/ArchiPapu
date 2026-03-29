import { PCManager } from './room_pc.js';

export const LunariJugar = {
    enter(system) {
        if (system.models.jugar) system.models.jugar.visible = true;
        system.activeAction = system.actions.jugar_base;
        if (system.activeAction) system.activeAction.reset().fadeIn(0.5).play();
        PCManager.setGamingMode(true);
    },

    exit(system) {
        PCManager.setGamingMode(false);
    },

    update(system, delta) {},

    onFinished(system, event) {},

    getDialogue(isDay, weatherCode) {
        const lines = [
            "¡Estoy en plena partida en Survev.io!<br>¡Cuidado, no me distraigas o perderé!",
            "¡Uy, casi me matan! ¡Tengo que cubrirme!",
            "¡Vamos, vamos, un kill más y gano la partida!",
            "Este teclado es súper cómodo para jugar, ¡me encanta!"
        ];
        return lines[Math.floor(Math.random() * lines.length)];
    }
};