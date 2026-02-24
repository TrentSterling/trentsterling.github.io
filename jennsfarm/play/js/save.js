const SAVE_KEY = 'jennsfarm_save';

export function saveGame(state) {
    const data = JSON.stringify(state);
    try {
        localStorage.setItem(SAVE_KEY, data);
    } catch (e) {
        console.warn('Save failed:', e);
    }
}

export function loadGame() {
    try {
        const data = localStorage.getItem(SAVE_KEY);
        if (!data) return null;
        return JSON.parse(data);
    } catch (e) {
        console.warn('Load failed:', e);
        return null;
    }
}

export function deleteSave() {
    localStorage.removeItem(SAVE_KEY);
}

export function exportSave(state) {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jennsfarm_save_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importSave() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    resolve(JSON.parse(ev.target.result));
                } catch {
                    console.warn('Invalid save file');
                    resolve(null);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });
}
