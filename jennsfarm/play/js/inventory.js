// Item definitions
export const ITEMS = {
    carrot_seed:  { name: 'Carrot Seeds',  type: 'seed', cropId: 'carrot',  buyPrice: 5,  icon: 'carrot_seed' },
    tomato_seed:  { name: 'Tomato Seeds',  type: 'seed', cropId: 'tomato',  buyPrice: 10, icon: 'tomato_seed' },
    potato_seed:  { name: 'Potato Seeds',  type: 'seed', cropId: 'potato',  buyPrice: 3,  icon: 'potato_seed' },
    wheat_seed:   { name: 'Wheat Seeds',   type: 'seed', cropId: 'wheat',   buyPrice: 8,  icon: 'wheat_seed' },
    carrot:       { name: 'Carrot',        type: 'crop', sellPrice: 15, icon: 'carrot' },
    tomato:       { name: 'Tomato',        type: 'crop', sellPrice: 25, icon: 'tomato' },
    potato:       { name: 'Potato',        type: 'crop', sellPrice: 10, icon: 'potato' },
    wheat:        { name: 'Wheat',         type: 'crop', sellPrice: 20, icon: 'wheat' },
};

export function createInventory() {
    const items = {};

    return {
        add(id, qty = 1) {
            items[id] = (items[id] || 0) + qty;
        },

        remove(id, qty = 1) {
            if (!items[id] || items[id] < qty) return false;
            items[id] -= qty;
            if (items[id] <= 0) delete items[id];
            return true;
        },

        count(id) {
            return items[id] || 0;
        },

        has(id, qty = 1) {
            return (items[id] || 0) >= qty;
        },

        getAll() {
            return { ...items };
        },

        // For save/load
        serialize() {
            return { ...items };
        },

        load(data) {
            Object.keys(items).forEach(k => delete items[k]);
            Object.assign(items, data);
        }
    };
}
