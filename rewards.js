import { state } from './core.js';
import { saveGame } from './utils.js';

export function checkDailyReward() {
    let lastLogin = localStorage.getItem('room_last_login');
    let today = new Date().toDateString();
    if (lastLogin !== today) {
        state.playerCoins += 100;
        localStorage.setItem('room_last_login', today);
        const toast = document.getElementById('daily-reward-toast');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 4000);
    }
}