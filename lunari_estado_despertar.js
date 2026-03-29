import { TVManager } from './room_tv.js';
import { State } from './room_state.js';

export const LunariDespertar = {
    enter(system) {
        if (system.models.despertar) system.models.despertar.visible = true;
        system.activeAction = system.actions.despertar_base;
        if (system.activeAction) system.activeAction.reset().fadeIn(0.5).play();
        if (State.isRoomStarted) TVManager.turnOnAutomatically(); 
    },

    exit(system) {
        if (TVManager.isTvOn && !TVManager.tvTransitioning) {
            const tvPowerBtn = document.getElementById('tv-power');
            if (tvPowerBtn) tvPowerBtn.click();
        }
    },

    update(system, delta) {
    },

    onFinished(system, event) {},

    getDialogue(isDay, weatherCode) {
        const lines = [
            "Este anime está muy interesante.<br>¡Shhh! Estoy prestando atención.",
            "¡Wow, la animación de esta escena es increíble!",
            "¿Tú también lo estás viendo? El prota es genial.",
            "Siempre me dejan con intriga al final del episodio..."
        ];
        return lines[Math.floor(Math.random() * lines.length)];
    },

    complainAboutTV(system) {
        const complaints = [
            "¡Oye! ¡Estoy viendo mi programa favorito!<br>Déjame ver la tele tranquila... 📺😠",
            "¡No cambies! Estaba en la mejor parte... 🥺",
            "¡Devuélveme el control! ¡Quiero seguir viendo! 😤"
        ];
        const dialogBox = document.getElementById('dialogue-text');
        if (dialogBox) {
            dialogBox.innerHTML = complaints[Math.floor(Math.random() * complaints.length)];
            setTimeout(() => {
                if (system.currentState === 'despertar') {
                    system.updateLunariText(system.lastIsDay, system.lastWeather);
                }
            }, 4000);
        }
    }
};