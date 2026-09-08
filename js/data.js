/* ============================================================
   BREW CALCULATOR DATA
   Recipes are formulated at a BASE BATCH = 40L (fits Guten 50L)
   ============================================================ */

const RECIPES = [
{
  id: "R1", name: "HenHouse Incredible IPA Clone", style: "West Coast IPA",
  baseBatch: 40, og: 1.063, fg: 1.010, abv: 6.9, ibu: 58,
  yeast: "US-05 / WLP001", yeastForm: "Dry", atten: 0.80, tempLo: 18, tempHi: 20,
  desc: "Clone of HenHouse Brewing Incredible IPA. Orange peel, pine and dank hop character with a clean, crisp bitterness. Cascade, Mosaic, Hallertau Blanc, Simcoe and Belma.",
  ferm: [
    ["American Ale Malt", 9.8, 300, "Clean base malt"],
    ["Vienna Malt", 0.6, 295, "Light toast"],
    ["Light Munich I", 0.35, 290, "Malt depth"],
    ["Carapils / Dextrine", 0.25, 275, "Foam and body"]
  ],
  hops: [
    ["Simcoe", 25, 13.0, "Boil", 60, ""],
    ["Cascade", 20, 7.5, "Boil", 15, ""],
    ["Mosaic", 20, 12.0, "Boil", 15, ""],
    ["Mosaic", 50, 12.0, "Whirlpool", 20, ""],
    ["Simcoe", 50, 13.0, "Whirlpool", 20, ""],
    ["Hallertau Blanc", 40, 10.0, "Whirlpool", 20, ""],
    ["Belma", 40, 10.0, "Whirlpool", 20, ""],
    ["Cascade", 20, 7.5, "Whirlpool", 20, ""],
    ["Mosaic", 40, 12.0, "Dry Hop", 0, "Day 4"],
    ["Simcoe", 40, 13.0, "Dry Hop", 0, "Day 4"],
    ["Hallertau Blanc", 40, 10.0, "Dry Hop", 0, "Day 7"],
    ["Belma", 40, 10.0, "Dry Hop", 0, "Day 7"],
    ["Cascade", 40, 7.5, "Dry Hop", 0, "Day 7"]
  ],
  water: { Calcium: 110, Magnesium: 12, Sodium: 20, Sulphate: 220, Chloride: 75, Alkalinity: 40 }
},
{
  id: "R2", name: "Newy XPA", style: "Australian Extra Pale Ale",
  baseBatch: 40, og: 1.045, fg: 1.008, abv: 4.8, ibu: 28,
  yeast: "US-05", yeastForm: "Dry", atten: 0.80, tempLo: 18, tempHi: 20,
  desc: "Local-style XPA built around Galaxy, Vic Secret and Ella. Passionfruit, peach and pine, light and easy drinking for a Newcastle arvo.",
  ferm: [
    ["Pale Ale Malt (Au)", 7.8, 300, "Base malt"],
    ["Wheat Malt (Au)", 0.4, 295, "Head retention"],
    ["Carapils / Dextrine", 0.2, 275, "Body"]
  ],
  hops: [
    ["Galaxy", 15, 14.0, "Boil", 60, ""],
    ["Vic Secret", 20, 13.0, "Whirlpool", 20, ""],
    ["Galaxy", 30, 14.0, "Whirlpool", 20, ""],
    ["Ella", 20, 15.0, "Whirlpool", 20, ""],
    ["Galaxy", 40, 14.0, "Dry Hop", 0, "Day 4"],
    ["Vic Secret", 40, 13.0, "Dry Hop", 0, "Day 4"]
  ],
  water: { Calcium: 90, Magnesium: 10, Sodium: 15, Sulphate: 150, Chloride: 60, Alkalinity: 35 }
},
{
  id: "R3", name: "Hunter Valley Hazy IPA", style: "Hazy / NEIPA",
  baseBatch: 40, og: 1.062, fg: 1.012, abv: 6.5, ibu: 35,
  yeast: "Verdant IPA / London Ale III", yeastForm: "Liquid", atten: 0.74, tempLo: 19, tempHi: 21,
  desc: "Soft, juicy and hazy. Citra, Galaxy and Nectaron for tropical fruit and stonefruit, oats and wheat for a silky mouthfeel.",
  ferm: [
    ["Pilsner Malt", 8.0, 300, "Base malt"],
    ["Flaked Oats", 1.2, 280, "Haze and body"],
    ["Wheat Malt", 1.0, 295, "Haze and head retention"],
    ["Carapils / Dextrine", 0.3, 275, "Body"]
  ],
  hops: [
    ["Magnum", 15, 12.0, "Boil", 60, ""],
    ["Citra", 40, 12.0, "Whirlpool", 20, ""],
    ["Galaxy", 40, 14.0, "Whirlpool", 20, ""],
    ["Nectaron", 30, 13.0, "Whirlpool", 20, ""],
    ["Citra", 60, 12.0, "Dry Hop", 0, "Day 3"],
    ["Galaxy", 60, 14.0, "Dry Hop", 0, "Day 3"],
    ["Nectaron", 40, 13.0, "Dry Hop", 0, "Day 6"]
  ],
  water: { Calcium: 90, Magnesium: 8, Sodium: 20, Sulphate: 70, Chloride: 150, Alkalinity: 40 }
},
{
  id: "R4", name: "American Red IPA", style: "Red / Amber IPA",
  baseBatch: 40, og: 1.066, fg: 1.012, abv: 7.0, ibu: 65,
  yeast: "WLP001 / US-05", yeastForm: "Dry", atten: 0.80, tempLo: 18, tempHi: 20,
  desc: "Malt backbone from Munich Dark and crystal malt, balanced by a big Chinook, Centennial and Simcoe hop charge. Caramel, pine and citrus.",
  ferm: [
    ["Pale Ale Malt", 9.5, 300, "Base malt"],
    ["Munich Dark", 0.8, 285, "Malt depth and colour"],
    ["Medium Crystal", 0.5, 270, "Caramel notes"],
    ["Carafa Special II", 0.15, 230, "Colour adjustment, no roast flavour"]
  ],
  hops: [
    ["Chinook", 30, 13.0, "Boil", 60, ""],
    ["Centennial", 20, 10.0, "Boil", 15, ""],
    ["Simcoe", 20, 13.0, "Boil", 15, ""],
    ["Chinook", 40, 13.0, "Whirlpool", 20, ""],
    ["Centennial", 40, 10.0, "Whirlpool", 20, ""],
    ["Simcoe", 40, 13.0, "Whirlpool", 20, ""],
    ["Chinook", 40, 13.0, "Dry Hop", 0, "Day 4"],
    ["Centennial", 40, 10.0, "Dry Hop", 0, "Day 4"]
  ],
  water: { Calcium: 120, Magnesium: 12, Sodium: 20, Sulphate: 250, Chloride: 80, Alkalinity: 50 }
},
{
  id: "R5", name: "Aussie Classic Lager", style: "Australian Lager",
  baseBatch: 40, og: 1.045, fg: 1.008, abv: 4.6, ibu: 18,
  yeast: "SafLager S-23 / W34/70", yeastForm: "Dry", atten: 0.78, tempLo: 12, tempHi: 14,
  desc: "Crisp, clean and easy drinking. Pride of Ringwood keeps it authentically Australian. Lager fermentation needed, or a clean ale yeast at cooler temps as a shortcut.",
  ferm: [
    ["Pilsner Malt (Au)", 8.0, 300, "Base malt"],
    ["Flaked Rice", 0.8, 300, "Lightens body, crisp finish"],
    ["Carapils / Dextrine", 0.2, 275, "Foam stability"]
  ],
  hops: [
    ["Pride of Ringwood", 20, 9.0, "Boil", 60, ""],
    ["Pride of Ringwood", 10, 9.0, "Boil", 15, ""]
  ],
  water: { Calcium: 50, Magnesium: 8, Sodium: 10, Sulphate: 50, Chloride: 50, Alkalinity: 30 }
},
{
  id: "R6", name: "Dry Irish Stout", style: "Irish Stout",
  baseBatch: 40, og: 1.044, fg: 1.010, abv: 4.4, ibu: 38,
  yeast: "Nottingham / WLP004", yeastForm: "Dry", atten: 0.75, tempLo: 18, tempHi: 20,
  desc: "Roasty, dry and sessionable. Flaked barley for the classic creamy Irish head, roast barley for coffee and dark chocolate notes.",
  ferm: [
    ["Pale Ale Malt (UK)", 6.5, 300, "Base malt"],
    ["Rolled / Flaked Barley (UK)", 1.0, 280, "Creamy head, body"],
    ["Roast Barley (UK)", 0.6, 260, "Coffee and roast character"]
  ],
  hops: [
    ["East Kent Goldings", 40, 5.5, "Boil", 60, ""]
  ],
  water: { Calcium: 100, Magnesium: 10, Sodium: 25, Sulphate: 55, Chloride: 100, Alkalinity: 150 }
},
{
  id: "R7", name: "Belgian Wit", style: "Belgian Witbier",
  baseBatch: 40, og: 1.048, fg: 1.010, abv: 5.0, ibu: 15,
  yeast: "T-58 / WLP400", yeastForm: "Dry", atten: 0.75, tempLo: 19, tempHi: 22,
  desc: "Soft, spicy and refreshing. Raw wheat and oats for the classic silky haze, coriander and orange peel added late for spice and citrus zest.",
  ferm: [
    ["Pilsner Malt", 5.0, 300, "Base malt"],
    ["Wheat (Raw, unmalted)", 3.0, 290, "Classic witbier haze and body"],
    ["Rolled Oats", 0.4, 280, "Extra silkiness"]
  ],
  hops: [
    ["Saaz", 20, 4.0, "Boil", 60, ""],
    ["Coriander Seed (crushed)", 20, 0.0, "Boil", 10, ""],
    ["Orange Peel (dried, bitter)", 20, 0.0, "Boil", 10, ""]
  ],
  water: { Calcium: 60, Magnesium: 8, Sodium: 15, Sulphate: 60, Chloride: 80, Alkalinity: 50 }
},
{
  id: "R8", name: "Hunter Hazy DIPA", style: "Double / Imperial NEIPA",
  baseBatch: 40, og: 1.075, fg: 1.014, abv: 8.0, ibu: 45,
  yeast: "London Ale III / Verdant", yeastForm: "Liquid", atten: 0.72, tempLo: 19, tempHi: 21,
  desc: "Big, juicy and soft. Citra, Mosaic and Nelson Sauvin stacked hard in the whirlpool and dry hop for maximum tropical fruit and white wine character.",
  ferm: [
    ["Pale Ale Malt", 9.0, 300, "Base malt"],
    ["Flaked Oats", 1.5, 280, "Haze and body"],
    ["Wheat Malt", 1.2, 295, "Haze and head retention"],
    ["Carapils / Dextrine", 0.3, 275, "Body"]
  ],
  hops: [
    ["Magnum", 20, 12.0, "Boil", 60, ""],
    ["Citra", 60, 12.0, "Whirlpool", 20, ""],
    ["Mosaic", 60, 12.0, "Whirlpool", 20, ""],
    ["Nelson Sauvin", 40, 12.0, "Whirlpool", 20, ""],
    ["Citra", 80, 12.0, "Dry Hop", 0, "Day 3"],
    ["Mosaic", 80, 12.0, "Dry Hop", 0, "Day 3"],
    ["Nelson Sauvin", 40, 12.0, "Dry Hop", 0, "Day 6"]
  ],
  water: { Calcium: 90, Magnesium: 8, Sodium: 20, Sulphate: 60, Chloride: 180, Alkalinity: 40 }
},
{
  id: "R9", name: "Session Pale Ale", style: "Session Pale Ale",
  baseBatch: 40, og: 1.038, fg: 1.008, abv: 3.8, ibu: 25,
  yeast: "US-05", yeastForm: "Dry", atten: 0.80, tempLo: 18, tempHi: 19,
  desc: "Low ABV, full flavour. Galaxy and Cascade for a citrus and passionfruit finish, built for back to back schooners on a long weekend.",
  ferm: [
    ["Pale Ale Malt", 6.5, 300, "Base malt"],
    ["Wheat Malt", 0.3, 295, "Head retention"],
    ["Carapils / Dextrine", 0.2, 275, "Body, since gravity is low"]
  ],
  hops: [
    ["Galaxy", 15, 14.0, "Boil", 60, ""],
    ["Cascade", 20, 7.5, "Whirlpool", 20, ""],
    ["Galaxy", 20, 14.0, "Whirlpool", 20, ""],
    ["Cascade", 30, 7.5, "Dry Hop", 0, "Day 4"],
    ["Galaxy", 30, 14.0, "Dry Hop", 0, "Day 4"]
  ],
  water: { Calcium: 90, Magnesium: 10, Sodium: 15, Sulphate: 140, Chloride: 60, Alkalinity: 35 }
},
{
  id: "R10", name: "Oatmeal Stout", style: "Oatmeal Stout",
  baseBatch: 40, og: 1.055, fg: 1.014, abv: 5.4, ibu: 32,
  yeast: "Nottingham / WLP002", yeastForm: "Dry", atten: 0.70, tempLo: 18, tempHi: 20,
  desc: "Rich, smooth and slightly sweet. Oats and crystal malt build body, chocolate and roast barley add coffee and dark chocolate depth.",
  ferm: [
    ["Pale Ale Malt", 7.5, 300, "Base malt"],
    ["Flaked Oats", 1.0, 280, "Silky body"],
    ["Chocolate Malt", 0.5, 230, "Chocolate and coffee notes"],
    ["Medium Crystal", 0.5, 270, "Sweetness and body"],
    ["Roast Barley", 0.2, 260, "Dry roast finish"]
  ],
  hops: [
    ["East Kent Goldings", 35, 5.5, "Boil", 60, ""],
    ["Fuggles", 15, 4.5, "Boil", 15, ""]
  ],
  water: { Calcium: 110, Magnesium: 12, Sodium: 25, Sulphate: 60, Chloride: 110, Alkalinity: 150 }
}
];

/* ---- Ingredient pricing (Brewman, brewman.com.au, confirmed 8 Sep 2026 unless flagged) ---- */

const FERMENTABLE_PRICES = {
  "American Ale Malt": [4.65, "N", "Brewman lists this as 'Ale (Au)'. Closest equivalent base malt."],
  "Vienna Malt": [5.45, "Y", "Brewman: Vienna Malt (Au)."],
  "Light Munich I": [5.45, "N", "Brewman lists 'Munich (Au)', not split by Lovibond. Used as equivalent."],
  "Carapils / Dextrine": [6.65, "N", "Brewman does not stock a dedicated Carapils. 'Cara Pils (GER)' used as the closest dextrine malt."],
  "Pale Ale Malt (Au)": [4.65, "N", "Brewman lists local base malt as 'Ale (Au)'."],
  "Wheat Malt (Au)": [5.25, "Y", "Brewman: Wheat Malt (Au)."],
  "Pilsner Malt": [4.65, "Y", "Brewman: Pilsner (Au)."],
  "Flaked Oats": [5.55, "N", "Brewman stocks 'Rolled Oats (Au)', used as the flaked oats equivalent."],
  "Wheat Malt": [5.25, "Y", "Brewman: Wheat Malt (Au)."],
  "Munich Dark": [5.45, "Y", "Brewman: Munich Dark (Au)."],
  "Medium Crystal": [5.25, "Y", "Brewman: Medium Crystal (Au)."],
  "Carafa Special II": [6.85, "Y", "Brewman: Carafa S Type 2 (GER)."],
  "Pilsner Malt (Au)": [4.65, "Y", "Brewman: Pilsner (Au)."],
  "Flaked Rice": [9.95, "Y", "Brewman: Rolled/Flaked Rice (Au)."],
  "Pale Ale Malt (UK)": [5.95, "Y", "Brewman: Pale Ale (UK)."],
  "Rolled / Flaked Barley (UK)": [6.25, "Y", "Brewman: Rolled/Flaked Barley (UK)."],
  "Roast Barley (UK)": [6.45, "Y", "Brewman: Roast Barley (UK)."],
  "Wheat (Raw, unmalted)": [4.95, "Y", "Brewman: Wheat (Raw) (Au)."],
  "Rolled Oats": [5.55, "Y", "Brewman: Rolled Oats (Au)."],
  "Pale Ale Malt": [4.65, "N", "Using Brewman 'Ale (Au)'. Swap for Maris Otter (UK) $5.95/kg for more character."],
  "Chocolate Malt": [6.45, "Y", "Brewman: Chocolate (Au)."],
  "Roast Barley": [5.25, "Y", "Brewman: Roast Malt (Au)."]
};

const HOP_PRICES = {
  "Simcoe": [0.13, "Y", "Brewman: Simcoe USA (T90)."],
  "Cascade": [0.13, "Y", "Brewman: Cascade USA (T90)."],
  "Mosaic": [0.13, "Y", "Brewman: Mosaic USA (T90)."],
  "Hallertau Blanc": [0.16, "N", "Not stocked by Brewman. Estimate, see Find Ingredients tab."],
  "Belma": [0.16, "N", "Not stocked by Brewman. Estimate, see Find Ingredients tab."],
  "Galaxy": [0.13, "Y", "Brewman: Galaxy AUS (T90)."],
  "Vic Secret": [0.13, "Y", "Brewman: Vic Secret (AUS) (T90)."],
  "Ella": [0.13, "Y", "Brewman: Ella (AUS) (T90)."],
  "Magnum": [0.13, "Y", "Brewman: Magnum GER (T90)."],
  "Citra": [0.13, "Y", "Brewman: Citra USA (T90)."],
  "Nectaron": [0.13, "Y", "Brewman: Nectaron (Hort4337) NZ (T90)."],
  "Chinook": [0.13, "Y", "Brewman: Chinook USA (T90)."],
  "Centennial": [0.13, "Y", "Brewman: Centennial USA (T90)."],
  "Pride of Ringwood": [0.13, "N", "Brewman lists 'Super Pride (AUS)', a Pride of Ringwood-derived variety, used as equivalent."],
  "East Kent Goldings": [0.13, "Y", "Brewman: East Kent Goldings UK (T90)."],
  "Saaz": [0.13, "Y", "Brewman: Saaz Czech (T90)."],
  "Coriander Seed (crushed)": [0.05, "N", "Estimate, check Brewman Herbs/Spice/Oak category."],
  "Orange Peel (dried, bitter)": [0.05, "N", "Estimate, check Brewman Herbs/Spice/Oak category."],
  "Nelson Sauvin": [0.13, "Y", "Brewman: Nelson Sauvin NZ (T90)."],
  "Fuggles": [0.13, "Y", "Brewman: Fuggles UK (T90)."]
};

const YEAST_PRICES = {
  Dry: [6.50, "Y", "Brewman: Safale US-05, 11.5g sachet, $6.50. Used as the reference dry yeast price."],
  Liquid: [17.00, "N", "Brewman stocks Wyeast liquid cultures, exact current price not confirmed. Indicative market price, check brewman.com.au."]
};
const DME_PRICE_PER_KG = [9.00, "N", "Estimate for light DME used in a yeast starter. Not confirmed at Brewman, check the Malt Extract category."];

const SALT_PRICES = {
  "Gypsum (CaSO4.2H2O)": [0.02, "N", "Estimate. Confirm current price under Brewman Additives."],
  "Calcium Chloride (CaCl2.2H2O)": [0.03, "N", "Estimate. Confirm current price under Brewman Additives."],
  "Epsom Salt (MgSO4.7H2O)": [0.015, "N", "Estimate. Confirm current price under Brewman Additives."],
  "Table Salt (NaCl)": [0.005, "N", "Estimate, widely available."],
  "Baking Soda (NaHCO3)": [0.01, "N", "Estimate, widely available."],
  "Lactic Acid 88%": [0.06, "N", "Estimate. Confirm current price under Brewman Additives."],
  "Campden Tablets": [0.15, "N", "Estimate per tablet. Confirm current price under Brewman Additives."]
};

/* ---- Floraville (Hunter Water, Grahamstown/Tomago Sandbeds) source water defaults ---- */
const SOURCE_WATER_DEFAULTS = { Calcium: 13.1, Magnesium: 5.3, Sodium: 28.0, Sulphate: 32.5, Chloride: 38.0, Alkalinity: 24.0 };

/* ---- Salt ppm contribution per gram, spread across total liquor volume ---- */
const SALT_PPM_PER_GRAM = {
  "Gypsum (CaSO4.2H2O)": { Calcium: 61.5, Sulphate: 147.4 },
  "Calcium Chloride (CaCl2.2H2O)": { Calcium: 72.0, Chloride: 127.0 },
  "Epsom Salt (MgSO4.7H2O)": { Magnesium: 26.0, Sulphate: 103.0 },
  "Table Salt (NaCl)": { Sodium: 39.3, Chloride: 60.7 },
  "Baking Soda (NaHCO3)": { Sodium: 27.4, Alkalinity: 59.5 }
};
const SALT_DEFAULT_GRAMS = {
  "Gypsum (CaSO4.2H2O)": 65, "Calcium Chloride (CaCl2.2H2O)": 14, "Epsom Salt (MgSO4.7H2O)": 2,
  "Table Salt (NaCl)": 0, "Baking Soda (NaHCO3)": 0
};

const WATER_IONS = ["Calcium","Magnesium","Sodium","Sulphate","Chloride","Alkalinity"];
const WATER_COMMENTS = {
  Calcium: "Aim roughly 50 to 150 depending on style",
  Magnesium: "Usually 5 to 20, yeast nutrient",
  Sodium: "Keep moderate, under 100",
  Sulphate: "Higher for hoppy styles, crisper finish",
  Chloride: "Higher for malty or hazy styles, fuller mouthfeel",
  Alkalinity: "Balances mash pH against dark, roasted grain"
};

/* ============================================================
   SUPPLIER DATABASE (Find a Supplier tab)
   Manually researched 8 Sep 2026.
   ============================================================ */
const SUPPLIERS = [
  {
    id: "brewman", name: "Brewman", url: "https://www.brewman.com.au",
    location: "Brandy Hill, Hunter Region NSW",
    delivery: { type: "flat", cost: 20, freeOver: null, notes: "Courier, flat $20 for up to 10kg anywhere in Australia including Tasmania. This rate comes from a 2017 supplier forum post, not the live checkout, confirm current cost in your cart." },
    confirmed: "N",
    priceFactor: { ferm: 1.00, hop: 1.00, yeast: 1.00, salt: 1.00 },
    note: "Our Cost tab baseline. Closest full-range supplier to Richmond Vale by road, one-stop for grain, hops and yeast."
  },
  {
    id: "kegland", name: "KegLand", url: "https://www.kegland.com.au",
    location: "Melbourne, VIC",
    delivery: { type: "flat_free_over", cost: 12.50, freeOver: 50, notes: "Standard flat rate $12.50, free over $50. Express $24.95. Click & collect free from the Melbourne warehouse (not practical from NSW)." },
    confirmed: "Y",
    priceFactor: { ferm: 1.00, hop: 0.85, yeast: 0.90, salt: 1.00 },
    note: "Frequently the cheapest for hops and dry yeast in bulk packs, based on confirmed per-gram comparisons on the Find Ingredients tab. Interstate freight from Melbourne."
  },
  {
    id: "graingrape", name: "Grain & Grape", url: "https://www.graingrape.com.au",
    location: "Yarraville, VIC",
    delivery: { type: "flat", cost: 15, freeOver: null, notes: "Estimate only, current shipping rates could not be confirmed in this search. Check graingrape.com.au at checkout." },
    confirmed: "N",
    priceFactor: { ferm: 1.05, hop: 1.05, yeast: 1.00, salt: 1.05 },
    note: "Large range including specialty hops (Belma, Hallertau Blanc) that Brewman does not stock."
  },
  {
    id: "craftbrewer", name: "Craftbrewer", url: "https://www.craftbrewer.com.au",
    location: "Brisbane, QLD",
    delivery: { type: "flat", cost: 12, freeOver: null, notes: "The Craftbrewer website appeared to be under redevelopment at the time of research (8 Sep 2026), confirm the store is actively trading before ordering." },
    confirmed: "N",
    priceFactor: { ferm: 1.00, hop: 1.00, yeast: 1.00, salt: 1.00 },
    note: "Long-running specialty supplier, historically strong on liquid yeast range."
  },
  {
    id: "noblebarons", name: "Noble Barons (Newcastle Brew Shop)", url: "https://noblebarons.com.au",
    location: "Lambton, Newcastle NSW, closest bricks-and-mortar supplier to Richmond Vale",
    delivery: { type: "local_flat_free_over", cost: 10, freeOver: 100, notes: "Local delivery from $10 for Newcastle, Port Stephens and lower Hunter postcodes, free over $100 in eligible areas. Rest of NSW from $15, QLD/VIC/TAS/SA from $20. Grain bills need 24 hours notice to mill and package. Check your postcode is in the eligible local zone before assuming free delivery." },
    confirmed: "Y",
    priceFactor: { ferm: 1.10, hop: 1.10, yeast: 1.05, salt: 1.10 },
    note: "Boutique local pricing tends to run a little higher than the big online warehouses, but you can talk to a real brewer in person and pick up same day."
  }
];

/* ---- Find Ingredients static comparison (manually researched snapshot, 8 Sep 2026) ---- */
const HOP_COMPARISON = [
  ["Citra", 0.13, 2.19/25, 34.95/500],
  ["Simcoe", 0.13, null, 34.95/500],
  ["Cascade", 0.13, 1.71/25, 24.95/500],
  ["Mosaic", 0.13, 2.15/25, 34.95/500],
  ["Centennial", 0.13, 1.93/25, 29.95/500],
  ["Amarillo", 0.13, 2.24/25, 33.95/500],
  ["Galaxy", 0.13, null, 34.45/500],
  ["Magnum", 0.13, 1.71/25, 24.00/500],
  ["Chinook", 0.13, 1.84/25, null],
  ["Saaz", 0.13, 2.37/25, null],
  ["East Kent Goldings", 0.13, 2.55/25, null],
  ["Hallertau Mittelfruh", 0.13, 2.24/25, 34.95/500]
];
const YEAST_COMPARISON = [["Safale US-05", 6.50, 5.95]];
const SPECIALTY_ITEMS = [
  ["Belma", "HenHouse Incredible IPA Clone", "Grain & Grape, Craftbrewer, The Hop Shop NZ",
   "Not found at Brewman or KegLand in this search. NZ/boutique hop, may need to be ordered from a specialty supplier or substituted with Citra or Nelson Sauvin for a similar strawberry/melon note."],
  ["Hallertau Blanc", "HenHouse Incredible IPA Clone", "Grain & Grape, Craftbrewer",
   "Not found at Brewman. KegLand stocks Hallertau Mittelfruh which is a different variety, do not substitute. Check Grain & Grape or Craftbrewer for the true Blanc variety."],
  ["WLP001 California Ale (liquid)", "Red IPA, XPA, HenHouse clone (alt)", "KegLand, Grain & Grape",
   "Brewman stocks Wyeast, not White Labs. Wyeast 1056 American Ale is fermentation-equivalent and the closest substitute for a liquid strain from Brewman."],
  ["Verdant IPA / London Ale III (liquid)", "Hazy IPA, Hazy DIPA", "KegLand, Grain & Grape",
   "Specialty hazy strains are usually only available liquid. Confirm current stock, these sell out fast."],
  ["Coriander seed, orange peel", "Belgian Wit", "Brewman Herbs/Spice/Oak category, any supermarket spice aisle",
   "Cheapest is usually your local supermarket spice aisle for small quantities."]
];
