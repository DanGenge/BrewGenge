/* ============================================================
   BREWGENGE DATA
   Recipes are stored at their BASE BATCH size (litres into fermenter).
   ============================================================ */

/* ---- Fallback Celtic crest (drawn SVG, always renders even with no image file) ---- */
const BREWGENGE_LOGO_SVG = `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bgGold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffd873"/><stop offset="1" stop-color="#b4570a"/>
  </linearGradient></defs>
  <circle cx="60" cy="60" r="56" fill="#14110f" stroke="url(#bgGold)" stroke-width="4"/>
  <circle cx="60" cy="60" r="49" fill="none" stroke="#d98a2e" stroke-width="1" opacity="0.5"/>
  <g fill="none" stroke="#d98a2e" stroke-width="3">
    <path d="M60 8 C48 18 48 28 60 36 C72 28 72 18 60 8 Z"/>
    <path d="M60 112 C48 102 48 92 60 84 C72 92 72 102 60 112 Z"/>
    <path d="M8 60 C18 48 28 48 36 60 C28 72 18 72 8 60 Z"/>
    <path d="M112 60 C102 48 92 48 84 60 C92 72 102 72 112 60 Z"/>
  </g>
  <path d="M60 30 L82 40 V62 C82 82 71 91 60 96 C49 91 38 82 38 62 V40 Z"
        fill="#211a17" stroke="#f3b44d" stroke-width="3"/>
  <path d="M60 20 L67 34 H53 Z" fill="#f3b44d"/>
  <path d="M60 40 C46 48 44 66 53 79 C57 85 63 85 67 79 C76 66 74 48 60 40 Z" fill="#bd5b08"/>
  <path d="M60 40 C60 52 60 68 60 80 M48 50 C44 58 46 68 53 74 M72 50 C76 58 74 68 67 74"
        fill="none" stroke="#f3b44d" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M52 58 L68 58 M50 66 L70 66 M53 74 L67 74" stroke="#ffe6b0" stroke-width="1.3" opacity="0.65"/>
</svg>`.trim();

/* ---- Themed NSW/Tasmania recipe artwork (inline SVG scenes) ---- */
const RECIPE_SVG_ICONS = {
  r1: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#7a3a12"/><circle cx="50" cy="33" r="14" fill="#ffcf5c"/><path d="M6 63 Q50 20 94 63" fill="none" stroke="#141312" stroke-width="4"/><path d="M6 63 H94" stroke="#141312" stroke-width="3"/><path d="M22 63V47M36 63V39M50 63V33M64 63V39M78 63V47" stroke="#141312" stroke-width="2.4"/><rect y="63" width="100" height="37" fill="#43200a"/><path d="M40 90l5-15 5 15 5-15 5 15Z" fill="#f3b44d"/></svg>`,
  r2: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#0778b5"/><circle cx="70" cy="30" r="11" fill="#ffe08b"/><path d="M0 66 Q26 48 52 66 T100 62 V100 H0Z" fill="#0aa0dc"/><path d="M0 80 Q26 66 52 80 T100 76 V100 H0Z" fill="#4cc4ef"/><ellipse cx="38" cy="56" rx="6" ry="16" fill="#f3b44d" transform="rotate(-22 38 56)"/></svg>`,
  r3: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#c65416"/><path d="M0 68 Q30 52 56 66 T100 62 V100 H0Z" fill="#1f7a3a"/><path d="M28 20c-8 6-8 16 0 20 8-4 8-14 0-20Z" fill="#f3b44d"/><path d="M25 40h6l-2 8h-2z" fill="#43200a"/><path d="M68 13c-10 7-10 19 0 24 10-5 10-17 0-24Z" fill="#ffd35d"/><path d="M64 37h8l-2 9h-4z" fill="#43200a"/></svg>`,
  r4: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#7d1a1a"/><circle cx="50" cy="55" r="22" fill="#df2f2f"/><rect x="10" y="58" width="10" height="30" fill="#161211"/><rect x="24" y="46" width="12" height="42" fill="#161211"/><path d="M52 88V50q0-10 10-10t10 10v38Z" fill="#161211"/><rect x="76" y="54" width="11" height="34" fill="#161211"/><rect y="88" width="100" height="12" fill="#420a0a"/></svg>`,
  r5: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#0a94b5"/><circle cx="76" cy="24" r="12" fill="#ffe14d"/><rect y="66" width="100" height="34" fill="#f3c033"/><path d="M50 30V66M20 46Q50 30 80 46Z" fill="#df2f2f" stroke="#161211" stroke-width="1.5"/></svg>`,
  r6: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#0f172a"/><circle cx="78" cy="20" r="9" fill="#e2e8f0"/><circle cx="22" cy="16" r="1.4" fill="#fff"/><circle cx="38" cy="26" r="1" fill="#fff"/><circle cx="60" cy="12" r="1.2" fill="#fff"/><path d="M0 80 L22 40 L34 58 L48 30 L64 60 L78 44 L100 80Z" fill="#1e293b"/><path d="M46 34l4 8h-8z" fill="#e2e8f0"/><rect y="80" width="100" height="20" fill="#060a17"/></svg>`,
  r7: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#7ccdf0"/><path d="M10 78 Q30 30 45 78Z" fill="#f8fafc"/><path d="M35 78 Q52 22 68 78Z" fill="#eef3f8"/><path d="M58 78 Q74 34 90 78Z" fill="#dde7ef"/><rect y="78" width="100" height="22" fill="#0778b5"/><circle cx="80" cy="20" r="8" fill="#fdf3c0"/></svg>`,
  r8: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#6d28d9"/><path d="M0 70 L22 30 L34 50 L50 20 L66 50 L78 30 L100 70Z" fill="#5b21b6"/><ellipse cx="50" cy="66" rx="18" ry="20" fill="#43200a"/><circle cx="43" cy="60" r="5" fill="#fff"/><circle cx="57" cy="60" r="5" fill="#fff"/><circle cx="43" cy="61" r="2.3" fill="#161211"/><circle cx="57" cy="61" r="2.3" fill="#161211"/><path d="M40 74 Q50 80 60 74" stroke="#161211" stroke-width="2" fill="none"/><path d="M50 40l4 12h-8z" fill="#f3b44d"/><rect y="86" width="100" height="14" fill="#4c1d95"/></svg>`,
  r9: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#38b0e0"/><circle cx="80" cy="18" r="9" fill="#ffe08b"/><path d="M0 68 Q26 58 50 68 T100 66 V100 H0Z" fill="#0a83c4"/><rect x="30" y="42" width="40" height="20" rx="3" fill="#f8fafc"/><rect x="42" y="30" width="16" height="14" fill="#e2e8f0"/><rect x="46" y="18" width="4" height="14" fill="#161211"/><path d="M26 62h48l-6 8H32Z" fill="#f7c62b"/></svg>`,
  r10: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#413b36"/><circle cx="50" cy="56" r="26" fill="#28221e"/><circle cx="40" cy="48" r="4.5" fill="#fff"/><circle cx="60" cy="48" r="4.5" fill="#fff"/><circle cx="40" cy="48" r="2" fill="#161211"/><circle cx="60" cy="48" r="2" fill="#161211"/><ellipse cx="50" cy="62" rx="7" ry="5" fill="#f5f5f4"/><path d="M50 62 Q46 70 40 68M50 62 Q54 70 60 68" stroke="#161211" stroke-width="1.5" fill="none"/><rect x="68" y="50" width="14" height="20" rx="2" fill="#43200a"/><rect x="68" y="50" width="14" height="5" fill="#fef3e2"/></svg>`
};
const CUSTOM_RECIPE_SVG_ICON = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#1c1917"/><path d="M50 24l4 12h-8z" fill="#f3b44d"/><path d="M50 32c-10 6-12 18-6 28 4 6 8 6 12 0 6-10 4-22-6-28Z" fill="#bd5b08"/><rect y="86" width="100" height="14" fill="#292524"/></svg>`;

const FERMENTABLE_PRICE = { default: 4.85 };
const HOP_PRICE = { default: 0.13 };

/* ---- The 10 built-in recipes ---- */
const RECIPES = [
  { id:"r1", name:"HenHouse Incredible IPA Clone", style:"West Coast IPA", baseBatch:40,
    og:1.063, fg:1.010, abv:6.9, ibu:58, yeast:"US-05 / WLP001", yeastForm:"Dry", atten:0.80,
    tempLo:18, tempHi:20, desc:"Orange peel, pine and dank hop character with a clean, crisp bitterness.",
    ferm:[["American Ale Malt",9.8,4.85],["Vienna Malt",0.6,5.45],["Light Munich I",0.35,5.45],["Carapils / Dextrine",0.25,6.65]],
    hops:[["Simcoe",25,13,"Boil",60],["Cascade",20,7.5,"Boil",15],["Mosaic",20,12,"Boil",15],["Mosaic",50,12,"Whirlpool",20],["Simcoe",50,13,"Whirlpool",20],["Hallertau Blanc",40,10,"Whirlpool",20],["Belma",40,10,"Whirlpool",20],["Cascade",20,7.5,"Whirlpool",20],["Mosaic",40,12,"Dry Hop",0],["Simcoe",40,13,"Dry Hop",0],["Hallertau Blanc",40,10,"Dry Hop",0],["Belma",40,10,"Dry Hop",0],["Cascade",40,7.5,"Dry Hop",0]],
    water:{Ca:110,Mg:12,Na:20,SO4:220,Cl:75,Alk:40} },
  { id:"r2", name:"Newy XPA", style:"Australian Extra Pale Ale", baseBatch:40,
    og:1.045, fg:1.008, abv:4.8, ibu:28, yeast:"US-05", yeastForm:"Dry", atten:0.80,
    tempLo:18, tempHi:20, desc:"Galaxy, Vic Secret and Ella, passionfruit and pine for a Newcastle arvo.",
    ferm:[["Pale Ale Malt (Au)",7.8,4.65],["Wheat Malt (Au)",0.4,5.25],["Carapils / Dextrine",0.2,6.65]],
    hops:[["Galaxy",15,14,"Boil",60],["Vic Secret",20,13,"Whirlpool",20],["Galaxy",30,14,"Whirlpool",20],["Ella",20,15,"Whirlpool",20],["Galaxy",40,14,"Dry Hop",0],["Vic Secret",40,13,"Dry Hop",0]],
    water:{Ca:90,Mg:10,Na:15,SO4:150,Cl:60,Alk:35} },
  { id:"r3", name:"Hunter Valley Hazy IPA", style:"Hazy / NEIPA", baseBatch:40,
    og:1.062, fg:1.012, abv:6.5, ibu:35, yeast:"Verdant IPA / London Ale III", yeastForm:"Liquid", atten:0.74,
    tempLo:19, tempHi:21, desc:"Soft, juicy and hazy, Citra, Galaxy and Nectaron with oats and wheat.",
    ferm:[["Pilsner Malt",8.0,4.65],["Flaked Oats",1.2,5.55],["Wheat Malt",1.0,5.25],["Carapils / Dextrine",0.3,6.65]],
    hops:[["Magnum",15,12,"Boil",60],["Citra",40,12,"Whirlpool",20],["Galaxy",40,14,"Whirlpool",20],["Nectaron",30,13,"Whirlpool",20],["Citra",60,12,"Dry Hop",0],["Galaxy",60,14,"Dry Hop",0],["Nectaron",40,13,"Dry Hop",0]],
    water:{Ca:90,Mg:8,Na:20,SO4:70,Cl:150,Alk:40} },
  { id:"r4", name:"American Red IPA", style:"Red / Amber IPA", baseBatch:40,
    og:1.066, fg:1.012, abv:7.0, ibu:65, yeast:"WLP001 / US-05", yeastForm:"Dry", atten:0.80,
    tempLo:18, tempHi:20, desc:"Caramel malt backbone with a big Chinook, Centennial and Simcoe hop charge.",
    ferm:[["Pale Ale Malt",9.5,4.85],["Munich Dark",0.8,5.45],["Medium Crystal",0.5,5.25],["Carafa Special II",0.15,6.85]],
    hops:[["Chinook",30,13,"Boil",60],["Centennial",20,10,"Boil",15],["Simcoe",20,13,"Boil",15],["Chinook",40,13,"Whirlpool",20],["Centennial",40,10,"Whirlpool",20],["Simcoe",40,13,"Whirlpool",20],["Chinook",40,13,"Dry Hop",0],["Centennial",40,10,"Dry Hop",0]],
    water:{Ca:120,Mg:12,Na:20,SO4:250,Cl:80,Alk:50} },
  { id:"r5", name:"Aussie Classic Lager", style:"Australian Lager", baseBatch:40,
    og:1.045, fg:1.008, abv:4.6, ibu:18, yeast:"SafLager S-23 / W34/70", yeastForm:"Dry", atten:0.78,
    tempLo:12, tempHi:14, desc:"Crisp, clean and easy drinking, Pride of Ringwood keeps it authentically Australian.",
    ferm:[["Pilsner Malt (Au)",8.0,4.65],["Flaked Rice",0.8,9.95],["Carapils / Dextrine",0.2,6.65]],
    hops:[["Pride of Ringwood",20,9,"Boil",60],["Pride of Ringwood",10,9,"Boil",15]],
    water:{Ca:50,Mg:8,Na:10,SO4:50,Cl:50,Alk:30} },
  { id:"r6", name:"Dry Irish Stout", style:"Irish Stout", baseBatch:40,
    og:1.044, fg:1.010, abv:4.4, ibu:38, yeast:"Nottingham / WLP004", yeastForm:"Dry", atten:0.75,
    tempLo:18, tempHi:20, desc:"Roasty, dry and sessionable with flaked barley for a creamy Irish head.",
    ferm:[["Pale Ale Malt (UK)",6.5,5.95],["Flaked Barley (UK)",1.0,6.25],["Roast Barley (UK)",0.6,6.45]],
    hops:[["East Kent Goldings",40,5.5,"Boil",60]],
    water:{Ca:100,Mg:10,Na:25,SO4:55,Cl:100,Alk:150} },
  { id:"r7", name:"Belgian Wit", style:"Belgian Witbier", baseBatch:40,
    og:1.048, fg:1.010, abv:5.0, ibu:15, yeast:"T-58 / WLP400", yeastForm:"Dry", atten:0.75,
    tempLo:19, tempHi:22, desc:"Soft, spicy and refreshing with raw wheat, coriander and orange peel.",
    ferm:[["Pilsner Malt",5.0,4.65],["Raw Wheat",3.0,4.95],["Rolled Oats",0.4,5.55]],
    hops:[["Saaz",20,4,"Boil",60],["Coriander Seed",20,0,"Boil",10],["Orange Peel",20,0,"Boil",10]],
    water:{Ca:60,Mg:8,Na:15,SO4:60,Cl:80,Alk:50} },
  { id:"r8", name:"Hunter Hazy DIPA", style:"Double / Imperial NEIPA", baseBatch:40,
    og:1.075, fg:1.014, abv:8.0, ibu:45, yeast:"London Ale III / Verdant", yeastForm:"Liquid", atten:0.72,
    tempLo:19, tempHi:21, desc:"Big, juicy and soft, Citra, Mosaic and Nelson Sauvin stacked hard.",
    ferm:[["Pale Ale Malt",9.0,4.85],["Flaked Oats",1.5,5.55],["Wheat Malt",1.2,5.25],["Carapils / Dextrine",0.3,6.65]],
    hops:[["Magnum",20,12,"Boil",60],["Citra",60,12,"Whirlpool",20],["Mosaic",60,12,"Whirlpool",20],["Nelson Sauvin",40,12,"Whirlpool",20],["Citra",80,12,"Dry Hop",0],["Mosaic",80,12,"Dry Hop",0],["Nelson Sauvin",40,12,"Dry Hop",0]],
    water:{Ca:90,Mg:8,Na:20,SO4:60,Cl:180,Alk:40} },
  { id:"r9", name:"Session Pale Ale", style:"Session Pale Ale", baseBatch:40,
    og:1.038, fg:1.008, abv:3.8, ibu:25, yeast:"US-05", yeastForm:"Dry", atten:0.80,
    tempLo:18, tempHi:19, desc:"Low ABV, full flavour, Galaxy and Cascade for citrus and passionfruit.",
    ferm:[["Pale Ale Malt",6.5,4.85],["Wheat Malt",0.3,5.25],["Carapils / Dextrine",0.2,6.65]],
    hops:[["Galaxy",15,14,"Boil",60],["Cascade",20,7.5,"Whirlpool",20],["Galaxy",20,14,"Whirlpool",20],["Cascade",30,7.5,"Dry Hop",0],["Galaxy",30,14,"Dry Hop",0]],
    water:{Ca:90,Mg:10,Na:15,SO4:140,Cl:60,Alk:35} },
  { id:"r10", name:"Oatmeal Stout", style:"Oatmeal Stout", baseBatch:40,
    og:1.055, fg:1.014, abv:5.4, ibu:32, yeast:"Nottingham / WLP002", yeastForm:"Dry", atten:0.70,
    tempLo:18, tempHi:20, desc:"Rich, smooth and slightly sweet with oats, chocolate and roast barley.",
    ferm:[["Pale Ale Malt",7.5,4.85],["Flaked Oats",1.0,5.55],["Chocolate Malt",0.5,6.45],["Medium Crystal",0.5,5.25],["Roast Barley",0.2,5.25]],
    hops:[["East Kent Goldings",35,5.5,"Boil",60],["Fuggles",15,4.5,"Boil",15]],
    water:{Ca:110,Mg:12,Na:25,SO4:60,Cl:110,Alk:150} }
];

const EQUIPMENT_PROFILES = [
  { id:"eq-guten50", name:"Guten 50L", type:"eBIAB / HERMS", maxGrain:13, maxKettle:47, boilOff:4, kettleLoss:3, mashThickness:2.9, notes:"40L brew length in a single 50L vessel, basket mash." },
  { id:"eq-grainfather-g30", name:"Grainfather G30", type:"All-in-one eBIAB", maxGrain:6.5, maxKettle:30, boilOff:3, kettleLoss:2, mashThickness:3.0, notes:"Popular entry-level all-in-one, typically brews 20 to 23L." },
  { id:"eq-brewzilla-35", name:"BrewZilla 35L Gen 4", type:"All-in-one eBIAB", maxGrain:8, maxKettle:35, boilOff:3.5, kettleLoss:2.5, mashThickness:2.9, notes:"Mid-size all-in-one, typically brews 23 to 25L." },
  { id:"eq-brewzilla-70", name:"BrewZilla 70L Gen 4", type:"All-in-one eBIAB", maxGrain:16, maxKettle:65, boilOff:4.5, kettleLoss:3.5, mashThickness:2.9, notes:"Larger format, up to around 50L into the fermenter." },
  { id:"eq-3vessel", name:"3-Vessel Keggle Rig", type:"Traditional 3-vessel", maxGrain:12, maxKettle:60, boilOff:5, kettleLoss:4, mashThickness:2.6, notes:"Separate HLT, mash tun and boil kettle. Adjust to your vessels." }
];

const SUPPLIERS = [
  { id:"brewman", name:"Brewman", location:"Brandy Hill, Hunter Region NSW", url:"https://www.brewman.com.au", factor:1.00, deliveryType:"flat", deliveryCost:20, freeOver:null, confirmed:false, notes:"One-stop full range, closest to Richmond Vale by road. Flat rate is indicative, confirm at checkout." },
  { id:"kegland", name:"KegLand", location:"Melbourne, VIC", url:"https://www.kegland.com.au", factor:0.92, deliveryType:"freeover", deliveryCost:12.5, freeOver:50, confirmed:true, notes:"Often cheapest for hops and dry yeast in bulk. Flat $12.50, free over $50 (confirmed)." },
  { id:"graingrape", name:"Grain & Grape", location:"Yarraville, VIC", url:"https://www.graingrape.com.au", factor:1.05, deliveryType:"flat", deliveryCost:15, freeOver:null, confirmed:false, notes:"Great specialty range including Belma and Hallertau Blanc. Delivery estimated." },
  { id:"noblebarons", name:"Noble Barons", location:"Lambton, Newcastle NSW", url:"https://noblebarons.com.au", factor:1.10, deliveryType:"freeover", deliveryCost:10, freeOver:100, confirmed:true, notes:"Closest bricks-and-mortar to Richmond Vale, local delivery from $10, free over $100 (confirmed). 24h notice for grain." }
];

const WATER_IONS = ["Ca","Mg","Na","SO4","Cl","Alk"];
const WATER_LABELS = { Ca:"Calcium", Mg:"Magnesium", Na:"Sodium", SO4:"Sulphate", Cl:"Chloride", Alk:"Alkalinity" };
const FLORAVILLE_WATER = { Ca:13.1, Mg:5.3, Na:28.0, SO4:32.5, Cl:38.0, Alk:24.0 };
