// NPC の装備生成と ARC 機械の定義
import { ITEMS, ITEM_LIST, createItem, modFits, lootInstance, pickLootItem, ammoForCaliber } from './items.js';
import { newActorInv, autoInsert } from './inventory.js';

export const MACHINES = {
  wasp: {
    name: 'ワスプ', fly: 3.2, speed: 6, turn: 3, radius: 0.6, sight: 75, hear: 60,
    hp: { core: 45, body: 95 }, armor: { core: 1, body: 3 },
    weapon: { dmg: 13, pen: 22, rpm: 480, burst: 6, pause: 1.6, spread: 2.0, range: 60, sound: 'zap', tracer: '#ff6040' },
    shapes: [{ zone: 'core', y: 0, r: 0.24 }, { zone: 'body', y: 0, r: 0.6 }], loot: [1, 3], threat: 1,
  },
  hornet: {
    name: 'ホーネット', fly: 6.5, speed: 9, turn: 2.5, radius: 0.8, sight: 95, hear: 80,
    hp: { core: 70, body: 170 }, armor: { core: 2, body: 4 },
    weapon: { dmg: 22, pen: 32, rpm: 360, burst: 3, pause: 2.2, spread: 1.4, range: 90, sound: 'zap2', tracer: '#ffa020' },
    shapes: [{ zone: 'core', y: 0, r: 0.28 }, { zone: 'body', y: 0, r: 0.8 }], loot: [2, 3], threat: 2,
  },
  tick: {
    name: 'ティック', fly: 0, speed: 8, turn: 6, radius: 0.5, sight: 45, hear: 40,
    hp: { core: 30, body: 70 }, armor: { core: 1, body: 2 },
    explode: { dmg: 120, radius: 4.5, trigger: 2.0 },
    shapes: [{ zone: 'core', y: 0.75, r: 0.22 }, { zone: 'body', y: 0.45, r: 0.55 }], loot: [1, 2], threat: 1,
  },
  sentinel: {
    name: 'センチネル', fly: 0, speed: 2.4, turn: 1.2, radius: 1.5, height: 4, sight: 95, hear: 90,
    hp: { core: 320, body: 1400, leg: 450 }, armor: { core: 4, body: 5, leg: 4 },
    weapon: { dmg: 60, pen: 50, rpm: 70, burst: 2, pause: 2.2, charge: 1.1, spread: 0.5, range: 110, sound: 'laser', tracer: '#40e0ff', beam: true },
    shapes: [{ zone: 'core', y: 3.55, r: 0.45, back: 0.6 }, { zone: 'body', y: 2.7, r: 1.25 }, { zone: 'leg', y: 0.9, r: 0.75, off: 1.0 }],
    loot: [4, 6], threat: 4,
  },
};

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const byIds = (ids) => ids.filter((i) => ITEMS[i]);

const TIERS = {
  scav: {
    weapons: ['p17', 'm1911', 'mp133', 'pps43', 'akm', 'mosin', 'ak74n', 'umc45', 'mp9n', 'r870', 's12k'],
    armor: [null, null, 'ar_paca', 'ar_6b2', 'ar_press'], helmet: [null, null, 'hm_ssh68', 'hm_work', 'hm_6b47'],
    rig: ['rig_scav', 'rig_bank', 'rig_belt', null], backpack: [null, 'bp_duffle', 'bp_day', 'bp_scav', 'bp_sling'],
    meds: ['bandage', 'medkit_ai2', 'painkiller', 'medkit_car'], ammoTier: 0, modChance: 0.1, extraLoot: [1, 3],
  },
  raider1: {
    weapons: ['ak74n', 'akm', 'mp9n', 'umc45', 'r870', 'svds', 'm4a1', 'r700', 'stg77'],
    armor: ['ar_zhuk3', 'ar_6b23', 'ar_paca', 'ar_trooper'], helmet: ['hm_6b47', 'hm_ssh68', 'hm_tc800', null],
    rig: ['rig_alpha', 'rig_micro', 'rig_bank'], backpack: ['bp_scav', 'bp_assault', 'bp_day'],
    meds: ['medkit_salewa', 'bandage', 'medkit_ifak', 'painkiller', 'splint', 'tourniquet'], ammoTier: 1, modChance: 0.45, extraLoot: [0, 2],
  },
  raider2: {
    weapons: ['m4a1', 'hx416', 'ak15', 'skrl', 'mcxb', 'asval', 'px90', 'mx7', 'sa58', 'm14ebr', 'bm1014', 'rpk16'],
    armor: ['ar_trooper', 'ar_6b13', 'ar_iotv', 'ar_slick'], helmet: ['hm_tc800', 'hm_ulach', 'hm_vector', 'hm_exfil'],
    rig: ['rig_thunder', 'rig_mmac', 'rig_alpha', 'rig_avs'], backpack: ['bp_trizip', 'bp_beta2', 'bp_assault', 'bp_attack'],
    meds: ['medkit_ifak', 'medkit_afak', 'tourniquet', 'splint', 'ibuprofen', 'stim_propital', 'surgkit'], ammoTier: 2, modChance: 0.8, extraLoot: [0, 1],
  },
  boss: {
    weapons: ['pkp', 'sa58', 'as12', 'm249'],
    armor: ['ar_6b43', 'ar_fort'], helmet: ['hm_altyn', 'hm_bomb'],
    rig: ['rig_raider'], backpack: ['bp_raider'],
    meds: ['medkit_grizzly', 'stim_etg', 'stim_sj6', 'medkit_afak'], ammoTier: 3, modChance: 1, extraLoot: [3, 5],
  },
  guard: {
    weapons: ['hx416', 'ak15', 'sa58', 'sr25m', 'asval', 'bm1014'],
    armor: ['ar_iotv', 'ar_6b13', 'ar_slick', 'ar_fort'], helmet: ['hm_exfil', 'hm_ulach', 'hm_raider'],
    rig: ['rig_thunder', 'rig_mmac'], backpack: ['bp_beta2', 'bp_trizip'],
    meds: ['medkit_afak', 'stim_propital', 'tourniquet'], ammoTier: 2, modChance: 0.9, extraLoot: [1, 2],
  },
};

export function bestAmmo(caliber, tier, rng) {
  const list = ammoForCaliber(caliber).filter((a) => !a.loot.includes('machine') || caliber === 'arc').sort((a, b) => a.rarity - b.rarity);
  if (!list.length) return null;
  const maxR = Math.min(list.length - 1, tier + (rng() < 0.3 ? 1 : 0));
  const cands = list.filter((a) => a.rarity <= maxR + 0);
  return pick(rng, cands.length ? cands : list).id;
}

export function randomMods(wdef, rng, chance) {
  const mods = {};
  for (const slot of wdef.weapon.slots) {
    if (rng() > chance) continue;
    const opts = ITEM_LIST.filter((m) => m.cat === 'mod' && m.mod.slot === slot && modFits(wdef, m) && m.rarity <= 3);
    if (opts.length) mods[slot] = pick(rng, opts).id;
  }
  return mods;
}

export function generateLoadout(tierName, rng) {
  const T = TIERS[tierName];
  const inv = newActorInv();
  const wid = pick(rng, byIds(T.weapons));
  const wdef = ITEMS[wid];
  const ammoId = bestAmmo(wdef.weapon.caliber, T.ammoTier, rng);
  const slot = wdef.weapon.class === 'pistol' ? 'holster' : 'primary';
  inv.equip[slot] = createItem(wid, { ammoId, mods: randomMods(wdef, rng, T.modChance) });
  if (slot === 'primary' && rng() < 0.4) {
    const pid = pick(rng, ['p17', 'm1911', 'sg26', 'mk23']);
    inv.equip.holster = createItem(pid, { ammoId: bestAmmo(ITEMS[pid].weapon.caliber, T.ammoTier, rng) });
  }
  const a = pick(rng, T.armor), h = pick(rng, T.helmet), r = pick(rng, T.rig), b = pick(rng, T.backpack);
  if (r) inv.equip.rig = createItem(r);
  if (a && !(inv.equip.rig && ITEMS[inv.equip.rig.id].armor)) inv.equip.armor = createItem(a, { dur: Math.round(ITEMS[a].armor.dur * (0.6 + rng() * 0.4)) });
  if (h) inv.equip.helmet = createItem(h, { dur: Math.round(ITEMS[h].armor.dur * (0.6 + rng() * 0.4)) });
  if (b) inv.equip.backpack = createItem(b);
  // 予備弾薬
  const mags = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < mags; i++) {
    const n = Math.min(ITEMS[ammoId].stack, wdef.weapon.mag);
    autoInsert(inv, createItem(ammoId, { count: n }));
  }
  if (inv.equip.holster && slot === 'primary') {
    const pa = inv.equip.holster.mag.ammo;
    autoInsert(inv, createItem(pa, { count: ITEMS[inv.equip.holster.id].weapon.mag }));
  }
  // 医薬品（止血手段は必ず持たせる）
  autoInsert(inv, createItem(tierName === 'scav' ? 'bandage' : rng() < 0.5 ? 'bandage_army' : 'bandage'));
  if (tierName !== 'scav') autoInsert(inv, createItem('tourniquet'));
  const nm = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < nm; i++) autoInsert(inv, createItem(pick(rng, T.meds)));
  if (rng() < 0.5) autoInsert(inv, createItem(pick(rng, ['water', 'can_beef', 'chocolate', 'crackers', 'juice'])));
  if (tierName !== 'scav' && rng() < 0.5) autoInsert(inv, createItem(pick(rng, ['gr_f1', 'gr_rgd5', 'gr_m67', 'gr_flash'])));
  // 戦利品
  const [l0, l1] = T.extraLoot;
  const n = l0 + Math.floor(rng() * (l1 - l0 + 1));
  for (let i = 0; i < n; i++) {
    const def = pickLootItem(rng, { junk: 2, residential: 2, industrial: 2, valuable: tierName === 'boss' ? 4 : 0.3, tech: 1 }, ['barter', 'valuable', 'money', 'key', 'food', 'intel'], tierName === 'boss' ? 2 : 1);
    if (def) autoInsert(inv, lootInstance(rng, def));
  }
  if (tierName === 'boss') autoInsert(inv, createItem('key_armory'));
  for (const it of allItemsShallow(inv)) it.fir = true;
  return inv;
}

function allItemsShallow(inv) {
  const out = [];
  const walk = (it) => { out.push(it); if (it.grids) for (const g of it.grids) for (const c of g.items) walk(c); if (it.mods) for (const m of Object.values(it.mods)) if (m) out.push(m); };
  for (const s of Object.keys(inv.equip)) if (inv.equip[s]) walk(inv.equip[s]);
  for (const it of inv.pockets.items) walk(it);
  return out;
}

const SCAV_NAMES = ['ヴァシリ', 'ミーシャ', 'ボリス', 'ゴーシャ', 'イゴール', 'サーシャ', 'コーリャ', 'ペーチャ', 'トーリャ', 'ヴォーヴァ', 'ジェーニャ', 'スラーヴァ', 'ユーラ', 'リョーハ', 'セリョーガ', 'アントン'];
const RAIDER_NAMES = ['Ghost_77', 'クロウ', 'NightOwl', 'レイヴン', 'Viper', 'ハウンド', 'Spectre', 'タロン', 'Nomad', 'シャドウ', 'Reaper', 'ブレイズ', 'Wolfpack', 'ストーム', 'Kestrel', 'ファング', 'Rook', 'ヴォルト', 'Echo-6', 'マーベリック', 'Jackal', 'サイレンス', 'Hydra', 'ローニン'];
export function botName(kind, rng) {
  if (kind === 'scav') return pick(rng, SCAV_NAMES) + ' (スカブ)';
  if (kind === 'boss') return '司令官グロム';
  if (kind === 'guard') return 'グロムの護衛';
  return pick(rng, RAIDER_NAMES);
}

// 機械の残骸ルート
export function machineLoot(mtype, rng) {
  const M = MACHINES[mtype];
  const items = [];
  const n = M.loot[0] + Math.floor(rng() * (M.loot[1] - M.loot[0] + 1));
  for (let i = 0; i < n; i++) {
    const def = pickLootItem(rng, { machine: 5, tech: 1 }, ['machine', 'barter', 'ammo', 'grenade', 'weapon'], 1 + M.threat * 0.25);
    if (def) items.push(lootInstance(rng, def));
  }
  return items;
}
