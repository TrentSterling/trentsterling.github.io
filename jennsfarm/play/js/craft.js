// js/craft.js - Potion / crafting recipes. Combine crops, herbs, flowers &
// animal produce into high-value goods you sell at market.

export const RECIPES = {
    cheese:      { name: 'Goat Cheese',  out: 'cheese',      inputs: { goat_milk: 2 } },
    sunny_jam:   { name: 'Sunny Jam',    out: 'sunny_jam',   inputs: { strawberry: 3, sunflower: 1 } },
    calm_potion: { name: 'Calm Potion',  out: 'calm_potion', inputs: { lavender: 2, mint: 2 } },
    country_cake:{ name: 'Country Cake', out: 'country_cake',inputs: { egg: 2, wheat: 3, cow_milk: 1 } },
    perfume:     { name: 'Perfume',      out: 'perfume',     inputs: { rose: 1, lavender: 1, tulip: 1 } },
    love_potion: { name: 'Love Potion',  out: 'love_potion', inputs: { rose: 2, tulip: 1 } },
    melon_juice: { name: 'Melon Juice',  out: 'melon_juice', inputs: { square_watermelon: 1 } },
    grand_elixir:{ name: 'Grand Elixir', out: 'grand_elixir',inputs: { lavender: 1, mint: 2, rose: 1 } },
    wine:        { name: 'Wine',         out: 'wine',        inputs: { grape: 3 } },

    // --- Cooked meals (#50): tie crops + fish + honey + eggs together ---
    veggie_soup: { name: 'Veggie Soup', out: 'veggie_soup', inputs: { carrot: 2, potato: 2, tomato: 1 } },
    fruit_pie:   { name: 'Fruit Pie',   out: 'fruit_pie',   inputs: { apple: 3, wheat: 2, strawberry: 2 } },
    fish_stew:   { name: 'Fish Stew',   out: 'fish_stew',   inputs: { trout: 1, potato: 2, carrot: 1 } },
    honey_cake:  { name: 'Honey Cake',  out: 'honey_cake',  inputs: { honey: 1, wheat: 2, egg: 2 } },
};
