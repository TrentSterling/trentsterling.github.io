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

    // --- New seeds ---
    strawberry_seed:        { name: 'Strawberry Seeds', type: 'seed', cropId: 'strawberry',        buyPrice: 7,   icon: 'strawberry_seed' },
    mint_seed:              { name: 'Mint Seeds',       type: 'seed', cropId: 'mint',              buyPrice: 14,  icon: 'mint_seed' },
    lavender_seed:          { name: 'Lavender Seeds',   type: 'seed', cropId: 'lavender',          buyPrice: 26,  icon: 'lavender_seed' },
    tulip_seed:             { name: 'Tulip Bulbs',      type: 'seed', cropId: 'tulip',             buyPrice: 18,  icon: 'tulip_seed' },
    sunflower_seed:         { name: 'Sunflower Seeds',  type: 'seed', cropId: 'sunflower',         buyPrice: 30,  icon: 'sunflower_seed' },
    rose_seed:              { name: 'Rose Seeds',       type: 'seed', cropId: 'rose',              buyPrice: 50,  icon: 'rose_seed' },
    square_watermelon_seed: { name: 'Square Melon Seeds', type: 'seed', cropId: 'square_watermelon', buyPrice: 130, icon: 'square_watermelon_seed' },
    grape_seed:             { name: 'Grape Vine',         type: 'seed', cropId: 'grape',             buyPrice: 45,  icon: 'grape_seed' },

    // --- New crops (harvested) ---
    strawberry:        { name: 'Strawberry',        type: 'crop', sellPrice: 18,  icon: 'strawberry' },
    mint:              { name: 'Mint',              type: 'crop', sellPrice: 22,  icon: 'mint' },
    lavender:          { name: 'Lavender',          type: 'crop', sellPrice: 48,  icon: 'lavender' },
    tulip:             { name: 'Tulip',             type: 'crop', sellPrice: 38,  icon: 'tulip' },
    sunflower:         { name: 'Sunflower',         type: 'crop', sellPrice: 70,  icon: 'sunflower' },
    rose:              { name: 'Rose',              type: 'crop', sellPrice: 95,  icon: 'rose' },
    square_watermelon: { name: 'Square Watermelon', type: 'crop', sellPrice: 300, icon: 'square_watermelon' },
    grape:             { name: 'Grapes',            type: 'crop', sellPrice: 55,  icon: 'grape' },

    // --- Materials (gathered, sellable; reuses the 'crop' sellable bucket) ---
    wood: { name: 'Wood', type: 'crop', sellPrice: 14, icon: 'wood' },
    apple: { name: 'Apple', type: 'crop', sellPrice: 1, icon: 'apple' }, // fruit-tree drop, ~$1 each

    // --- Tools / placeables (bought at shop, not sold) ---
    sprinkler: { name: 'Sprinkler', type: 'tool', buyPrice: 250, icon: 'sprinkler' },

    // --- Animal produce (sellable) ---
    egg:       { name: 'Egg',       type: 'crop', sellPrice: 16, icon: 'egg' },
    cow_milk:  { name: 'Cow Milk',  type: 'crop', sellPrice: 34, icon: 'cow_milk' },
    goat_milk: { name: 'Goat Milk', type: 'crop', sellPrice: 52, icon: 'goat_milk' },
    honey:     { name: 'Honey',     type: 'crop', sellPrice: 75, icon: 'honey' }, // from beehives (#44)

    // --- Fish (caught at the pond, #49) ---
    minnow: { name: 'Minnow', type: 'crop', sellPrice: 12, icon: 'minnow' },
    trout:  { name: 'Trout',  type: 'crop', sellPrice: 30, icon: 'trout' },
    bass:   { name: 'Bass',   type: 'crop', sellPrice: 42, icon: 'bass' },
    salmon: { name: 'Salmon', type: 'crop', sellPrice: 60, icon: 'salmon' },
    pike:    { name: 'Pike',    type: 'crop', sellPrice: 78, icon: 'pike' },
    catfish: { name: 'Catfish 🐱', type: 'crop', sellPrice: 55, icon: 'catfish' }, // it has a cat face. meow.
    bob:     { name: 'Bob',        type: 'crop', sellPrice: 40, icon: 'bob' },     // a fish named Bob. hi Bob.

    // --- Crafted goods (made in the Workshop, sold at market) ---
    cheese:       { name: 'Goat Cheese',  type: 'crop', crafted: true, sellPrice: 130, icon: 'cheese' },
    sunny_jam:    { name: 'Sunny Jam',    type: 'crop', crafted: true, sellPrice: 150, icon: 'sunny_jam' },
    calm_potion:  { name: 'Calm Potion',  type: 'crop', crafted: true, sellPrice: 210, icon: 'calm_potion' },
    country_cake: { name: 'Country Cake', type: 'crop', crafted: true, sellPrice: 240, icon: 'country_cake' },
    perfume:      { name: 'Perfume',      type: 'crop', crafted: true, sellPrice: 300, icon: 'perfume' },
    love_potion:  { name: 'Love Potion',  type: 'crop', crafted: true, sellPrice: 280, icon: 'love_potion' },
    melon_juice:  { name: 'Melon Juice',  type: 'crop', crafted: true, sellPrice: 360, icon: 'melon_juice' },
    grand_elixir: { name: 'Grand Elixir', type: 'crop', crafted: true, sellPrice: 440, icon: 'grand_elixir' },
    wine:         { name: 'Wine',         type: 'crop', crafted: true, sellPrice: 220, icon: 'wine' },
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
