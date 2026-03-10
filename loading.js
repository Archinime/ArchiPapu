import { state } from './core.js';

export function checkLoading() {
    state.modelsLoaded++;
    const loadingEl = document.getElementById('loading');
    const loadCount = document.getElementById('loading-count');
    const loadBar = document.getElementById('loading-bar');
    if (loadCount && loadBar) {
        loadCount.innerText = `${state.modelsLoaded}/${state.totalModelsToLoad}`;
        const percent = Math.min((state.modelsLoaded / state.totalModelsToLoad) * 100, 100);
        loadBar.style.width = `${percent}%`;
        if (state.modelsLoaded >= state.totalModelsToLoad) {
            setTimeout(() => {
                if (loadingEl) loadingEl.style.opacity = '0';
                setTimeout(() => loadingEl.style.display = 'none', 500);
            }, 500);
        }
    }
}

export function initLoadingCounter() {
    // El contador se actualiza en cada checkLoading
}