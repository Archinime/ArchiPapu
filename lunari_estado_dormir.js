export const LunariDormir = {
    enter(system) {
        if (system.models.dormir) system.models.dormir.visible = true;
        system.activeAction = system.actions.dormir_base;
        if (system.activeAction) system.activeAction.reset().fadeIn(0.5).play();
        system.dormirTimer = 0;
        
        if (system.mixers.dormir) system.mixers.dormir.addEventListener('finished', system.onDormirFinishedBound);
    },

    exit(system) {
        if (system.mixers.dormir) system.mixers.dormir.removeEventListener('finished', system.onDormirFinishedBound);
    },

    update(system, delta) {
        if (system.activeAction === system.actions.dormir_base) {
            system.dormirTimer += delta;
            if (system.dormirTimer >= 60) {
                this.triggerRandom(system);
            }
        }
    },

    triggerRandom(system) {
        if (system.actions.dormir_random && system.activeAction === system.actions.dormir_base) {
            system.activeAction.fadeOut(0.5);
            system.activeAction = system.actions.dormir_random;
            system.activeAction.reset().fadeIn(0.5).play();
            system.dormirTimer = 0;
        }
    },

    onFinished(system, event) {
        if (event.action === system.actions.dormir_random) {
            event.action.fadeOut(0.5);
            system.activeAction = system.actions.dormir_base;
            if (system.activeAction) system.activeAction.reset().fadeIn(0.5).play();
            system.dormirTimer = 0;
        }
    },

    getDialogue(isDay, weatherCode) {
        if (isDay) {
            const dayDialogues = [
                "Zzz... 5 minutos más...",
                "Déjame dormir más... zzz...",
                "Mmm... apaga la luz, por favor...",
                "Zzz... no quiero levantarme todavía...",
                "Solo un ratito más... zzz..."
            ];
            return dayDialogues[Math.floor(Math.random() * dayDialogues.length)];
        } else {
            const nightDialogues = [
                "Zzz...<br>(Lunari está profundamente dormida)",
                "Mmm... dulces sueños...",
                "(Respira suavemente mientras duerme...)",
                "Zzz... anime... zzz...",
                "(Se abraza a la almohada...)"
            ];
            return nightDialogues[Math.floor(Math.random() * nightDialogues.length)];
        }
    }
};