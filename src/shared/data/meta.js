// トレーダー・クラフト・クエスト・ハイドアウト
export const TRADERS = [
  {
    id: 'borov', name: 'ボロフ', title: '軍需商人', color: '#b0502a', portrait: 'soldier',
    desc: '元軍需将校。武器と弾薬なら何でも揃える。',
    sells: ['weapon', 'ammo', 'grenade'], buys: { weapon: 0.62, ammo: 0.55, grenade: 0.6, mod: 0.5 },
  },
  {
    id: 'eva', name: 'エヴァ', title: '装備商', color: '#3a7ab0', portrait: 'merc',
    desc: 'PMC 崩れの装備商。防具とバッグの目利き。',
    sells: ['armor', 'helmet', 'rig', 'backpack'], buys: { armor: 0.65, helmet: 0.65, rig: 0.65, backpack: 0.65, textile: 0.6 },
  },
  {
    id: 'mira', name: 'ミラ', title: '医師', color: '#3ab07a', portrait: 'doctor',
    desc: '港湾区に残った最後の医師。医薬品と食料を扱う。',
    sells: ['med', 'food'], buys: { med: 0.7, food: 0.65, medical_supplies: 0.75, chemical: 0.6, food_ingredient: 0.6 },
  },
  {
    id: 'yan', name: 'ヤン', title: '技師', color: '#c0a030', portrait: 'mechanic',
    desc: '機械いじりの天才。MOD と電子部品、ARC パーツを高く買う。',
    sells: ['mod'], buys: { mod: 0.7, electronics: 0.75, tools: 0.7, energy: 0.7, machine: 0.8, building: 0.6, intel: 0.7 },
  },
  {
    id: 'luka', name: 'ルカ', title: '古物商', color: '#8a5ab0', portrait: 'fence',
    desc: '何でも買い取る闇商人。鍵や貴重品の取引もする。',
    sells: ['key', 'secure_small'], buys: { '*': 0.55, valuable: 0.78, household: 0.65, flammable: 0.6 },
  },
];

// 売値計算（トレーダーごと）
export function traderBuyRate(trader, def) {
  const b = trader.buys;
  return b[def.sub] ?? b[def.cat] ?? b['*'] ?? 0;
}

// プレイヤーレベルに応じた販売上限レア度
export function traderMaxRarity(level) {
  if (level >= 18) return 4;
  if (level >= 11) return 3;
  if (level >= 5) return 2;
  return 1;
}

export const RECIPES = [
  // 医療
  { id: 'r_bandage', station: 'medstation', time: 60, out: [['bandage', 2]], in: [['gauze_roll', 1], ['disinfectant', 1]], lvl: 1 },
  { id: 'r_salewa', station: 'medstation', time: 240, out: [['medkit_salewa', 1]], in: [['saline_bag', 1], ['gauze_roll', 2], ['syringe_pack', 1]], lvl: 1 },
  { id: 'r_ifak', station: 'medstation', time: 300, out: [['medkit_ifak', 1]], in: [['surgical_gloves', 1], ['gauze_roll', 2], ['antibiotics_pack', 1]], lvl: 1 },
  { id: 'r_propital', station: 'medstation', time: 600, out: [['stim_propital', 1]], in: [['syringe_pack', 1], ['reagent_vials', 1], ['vitamin_jar', 1]], lvl: 2 },
  { id: 'r_etg', station: 'medstation', time: 900, out: [['stim_etg', 1]], in: [['cryo_vial', 1], ['syringe_pack', 2], ['reagent_vials', 1]], lvl: 2 },
  { id: 'r_grizzly', station: 'medstation', time: 1200, out: [['medkit_grizzly', 1]], in: [['surgical_tools', 1], ['saline_bag', 2], ['antibiotics_pack', 1], ['gauze_roll', 3]], lvl: 2 },
  { id: 'r_surg', station: 'medstation', time: 1200, out: [['surgkit', 1]], in: [['surgical_tools', 1], ['disinfectant', 2], ['surgical_gloves', 1]], lvl: 2 },
  // 弾薬
  { id: 'r_545bs', station: 'workbench', time: 600, out: [['a545_bs', 60]], in: [['gunpowder_pack', 2], ['a545_ps', 60], ['steel_sheet', 1]], lvl: 1 },
  { id: 'r_556a1', station: 'workbench', time: 600, out: [['a556_m855a1', 60]], in: [['gunpowder_pack', 2], ['a556_m855', 60], ['bolts', 4]], lvl: 1 },
  { id: 'r_762bp', station: 'workbench', time: 700, out: [['a762_bp', 60]], in: [['gunpowder_pack', 2], ['a762_ps', 60], ['steel_sheet', 1]], lvl: 2 },
  { id: 'r_m61', station: 'workbench', time: 900, out: [['a762n_m61', 40]], in: [['gunpowder_pack', 3], ['a762n_m80', 40], ['torque_wrench', 1]], lvl: 2 },
  { id: 'r_9ap', station: 'workbench', time: 400, out: [['a9_ap', 60]], in: [['gunpowder_pack', 1], ['a9_pst', 60], ['screws', 5]], lvl: 1 },
  { id: 'r_slug', station: 'workbench', time: 300, out: [['a12_ap20', 20]], in: [['gunpowder_pack', 1], ['a12_buck', 20], ['nuts_washers', 4]], lvl: 1 },
  { id: 'r_f1', station: 'workbench', time: 400, out: [['gr_f1', 2]], in: [['gunpowder_pack', 2], ['nails', 10], ['metal_pipe', 1]], lvl: 1 },
  { id: 'r_flash', station: 'workbench', time: 300, out: [['gr_flash', 2]], in: [['magnesium_rod', 2], ['gunpowder_pack', 1]], lvl: 1 },
  { id: 'r_supp', station: 'workbench', time: 1200, out: [['sup_556', 1]], in: [['metal_pipe', 2], ['steel_sheet', 1], ['hand_drill', 1], ['gun_oil', 1]], lvl: 2 },
  { id: 'r_scope', station: 'workbench', time: 900, out: [['sight_acog', 1]], in: [['camera_lens', 1], ['aluminum_sheet', 1], ['precision_screwdriver', 1]], lvl: 2 },
  { id: 'r_nv', station: 'workbench', time: 1800, out: [['sight_nv', 1]], in: [['camera_lens', 1], ['vacuum_tube', 2], ['lithium_cell', 1], ['circuit_board', 2]], lvl: 3 },
  { id: 'r_thermal', station: 'workbench', time: 2400, out: [['sight_thermal', 1]], in: [['thermal_sensor', 1], ['camera_lens', 1], ['microcontroller', 1], ['military_battery', 1]], lvl: 3 },
  // ARC 技術
  { id: 'r_cell', station: 'arc_lab', time: 300, out: [['arc_cell', 24]], in: [['arc_power_cell', 2], ['arc_wiring_harness', 1]], lvl: 1 },
  { id: 'r_cell_oc', station: 'arc_lab', time: 600, out: [['arc_cell_oc', 24]], in: [['arc_power_cell_charged', 2], ['plasma_capacitor', 1]], lvl: 2 },
  { id: 'r_emp', station: 'arc_lab', time: 600, out: [['gr_emp', 2]], in: [['arc_magnet_coil', 1], ['capacitor_pack', 2], ['wasp_drive_core', 1]], lvl: 1 },
  { id: 'r_ag_patch', station: 'arc_lab', time: 600, out: [['ag_patch', 1]], in: [['wasp_drive_core', 1], ['arc_magnet_coil', 1]], lvl: 1 },
  { id: 'r_ag_module', station: 'arc_lab', time: 1800, out: [['ag_module', 1]], in: [['ag_patch', 2], ['plasma_capacitor', 1]], lvl: 2 },
  { id: 'r_ag_core', station: 'arc_lab', time: 5400, out: [['ag_core', 1]], in: [['ag_module', 2], ['neural_matrix', 1], ['arc_alloy_refined', 2]], lvl: 2 },
  { id: 'r_alloy', station: 'arc_lab', time: 400, out: [['arc_alloy_refined', 1]], in: [['arc_alloy', 3], ['arc_scrap', 2]], lvl: 1 },
  { id: 'r_pulse', station: 'arc_lab', time: 3600, out: [['arc_pulse', 1]], in: [['arc_alloy_refined', 3], ['plasma_capacitor', 2], ['optic_sensor_array', 1], ['servo_heavy', 2], ['neural_matrix', 1]], lvl: 2 },
  { id: 'r_lance', station: 'arc_lab', time: 5400, out: [['arc_lance', 1]], in: [['sentinel_targeting_unit', 1], ['sentinel_reactor', 1], ['arc_alloy_refined', 4], ['quantum_processor', 1]], lvl: 3 },
  { id: 'r_slayer', station: 'arc_lab', time: 5400, out: [['ar_slayer', 1]], in: [['sentinel_armor_plate', 4], ['aramid_fabric', 3], ['arc_alloy_refined', 3]], lvl: 3 },
  // 生活
  { id: 'r_water', station: 'kitchen', time: 300, out: [['water', 2]], in: [['empty_bottle', 2], ['air_filter', 1]], lvl: 1 },
  { id: 'r_ration', station: 'kitchen', time: 600, out: [['ration_arc', 2]], in: [['flour_sack', 1], ['honey_jar', 1], ['salt_pack', 1]], lvl: 1 },
  { id: 'r_mre', station: 'kitchen', time: 400, out: [['mre', 1]], in: [['can_beef', 1], ['crackers', 1], ['chocolate', 1]], lvl: 1 },
  { id: 'r_coffee', station: 'kitchen', time: 200, out: [['energy_drink', 2]], in: [['instant_coffee', 1], ['sugar_bag', 1], ['water', 1]], lvl: 1 },
  // 装備
  { id: 'r_raidbag', station: 'tailor', time: 1800, out: [['bp_raid', 1]], in: [['canvas_fabric', 3], ['paracord', 2], ['ripstop_nylon', 2]], lvl: 1 },
  { id: 'r_raider_rig', station: 'tailor', time: 1500, out: [['rig_raider', 1]], in: [['leather_hide', 2], ['paracord', 2], ['canvas_fabric', 1]], lvl: 1 },
  { id: 'r_raider_mask', station: 'tailor', time: 2000, out: [['hm_raider', 1]], in: [['steel_sheet', 2], ['leather_hide', 1], ['welding_mask', 1]], lvl: 2 },
  { id: 'r_cargo', station: 'tailor', time: 3000, out: [['bp_raider', 1]], in: [['aramid_fabric', 2], ['ripstop_nylon', 3], ['steel_cable', 1], ['sleeping_bag', 1]], lvl: 2 },
  // 金策
  { id: 'r_crypto', station: 'server', time: 7200, out: [['crypto_coin', 1]], in: [['gpu', 1], ['power_supply', 1]], lvl: 1, keep: ['gpu'] },
  { id: 'r_gold', station: 'workbench', time: 1800, out: [['gold_ingot', 1]], in: [['gold_chain', 2], ['gold_ring', 2], ['gold_coin', 2]], lvl: 2 },
  { id: 'r_beta', station: 'workbench', time: 3600, out: [['sc_beta', 1]], in: [['sc_alpha', 1], ['steel_sheet', 2], ['padlock', 2], ['military_cable', 1]], lvl: 2 },
  { id: 'r_gamma', station: 'workbench', time: 7200, out: [['sc_gamma', 1]], in: [['sc_beta', 1], ['arc_alloy_refined', 2], ['bunker_cipher', 1], ['luxury_watch', 1]], lvl: 3 },
  { id: 'r_kappa', station: 'workbench', time: 10800, out: [['sc_kappa', 1]], in: [['sc_gamma', 1], ['golden_statue', 1], ['quantum_processor', 1], ['classified_folder', 1]], lvl: 3 },
];

export const STATIONS = {
  workbench: { name: 'ワークベンチ', icon: '🔧', costs: [[['bolts', 4], ['screws', 4]], [['hand_drill', 1], ['steel_sheet', 2]], [['torque_wrench', 1], ['circuit_board', 3], ['power_supply', 1]]], money: [20000, 120000, 400000] },
  medstation: { name: '医療ステーション', icon: '✚', costs: [[['gauze_roll', 2]], [['stethoscope', 1], ['saline_bag', 2]], [['defib_pad', 1], ['surgical_tools', 1]]], money: [15000, 90000, 300000] },
  arc_lab: { name: 'ARC 研究台', icon: '⚛', costs: [[['arc_scrap', 3], ['arc_wiring_harness', 1]], [['arc_alloy_refined', 2], ['optic_sensor_array', 1]], [['neural_matrix', 1], ['plasma_capacitor', 2]]], money: [50000, 200000, 600000] },
  kitchen: { name: 'キッチン', icon: '🍲', costs: [[['cooking_pot', 1]]], money: [10000] },
  tailor: { name: '裁縫台', icon: '✂', costs: [[['sewing_kit', 1], ['canvas_fabric', 1]], [['aramid_fabric', 1], ['paracord', 2]]], money: [25000, 150000] },
  server: { name: 'マイニングラック', icon: '⛏', costs: [[['power_supply', 1], ['cooling_fan', 2], ['circuit_board', 2]]], money: [80000] },
  stash: { name: '倉庫拡張', icon: '▦', costs: [[['steel_sheet', 2], ['bolts', 4]], [['steel_sheet', 4], ['hinge', 4], ['padlock', 2]], [['aluminum_sheet', 4], ['steel_cable', 2]]], money: [60000, 250000, 800000], rows: [10, 16, 24] },
};

// クエスト
// type: kill { target: 'scav'|'raider'|'machine'|'boss'|mtype }, find { item, count (FIR) }, extract { ex }, survive, loot_value
export const QUESTS = [
  { id: 'q1', trader: 'borov', name: '初陣', desc: 'レイドから生還せよ。', obj: [{ type: 'survive', count: 1, text: 'レイドから脱出する' }], reward: { money: 30000, xp: 800, items: [['a545_bt', 60]] } },
  { id: 'q2', trader: 'borov', name: '害虫駆除', desc: '港湾区に巣食うスカブを片付けろ。', obj: [{ type: 'kill', target: 'scav', count: 8, text: 'スカブを倒す' }], reward: { money: 60000, xp: 1500, items: [['ak15', 1]] }, req: ['q1'] },
  { id: 'q3', trader: 'yan', name: '機械仕掛けの脅威', desc: 'ARC のドローンを撃墜し、その部品を持ち帰れ。', obj: [{ type: 'kill', target: 'machine', count: 5, text: 'ARC 機械を破壊する' }, { type: 'find', item: 'wasp_drive_core', count: 2, text: 'ワスプの駆動コアを納品（レイド内入手）' }], reward: { money: 80000, xp: 2000, items: [['gr_emp', 2]], unlockStation: 'arc_lab' }, req: ['q1'] },
  { id: 'q4', trader: 'mira', name: '医療物資の確保', desc: '薬局の倉庫に残された医療品を回収してほしい。', obj: [{ type: 'find', item: 'saline_bag', count: 2, text: '生理食塩水バッグを納品' }, { type: 'find', item: 'medkit_salewa', count: 1, text: 'サレワ救急キットを納品' }], reward: { money: 50000, xp: 1200, items: [['medkit_ifak', 2], ['key_pharmacy', 1]] }, req: ['q1'] },
  { id: 'q5', trader: 'eva', name: '装備の目利き', desc: '良質な防具を手に入れてこい。', obj: [{ type: 'find', item: 'aramid_fabric', count: 2, text: 'アラミド繊維を納品' }], reward: { money: 70000, xp: 1500, items: [['ar_trooper', 1]] }, req: ['q1'] },
  { id: 'q6', trader: 'yan', name: '電子の宝', desc: 'GPU を探してくれ。計算資源が必要だ。', obj: [{ type: 'find', item: 'gpu', count: 1, text: 'グラフィックカードを納品' }, { type: 'find', item: 'circuit_board', count: 3, text: '回路基板を納品' }], reward: { money: 220000, xp: 3000, unlockStation: 'server' }, req: ['q3'] },
  { id: 'q7', trader: 'borov', name: '同業者', desc: '他のレイダーは脅威だ。数を減らせ。', obj: [{ type: 'kill', target: 'raider', count: 5, text: 'レイダーを倒す' }], reward: { money: 150000, xp: 4000, items: [['hx416', 1], ['a556_m995', 60]] }, req: ['q2'] },
  { id: 'q8', trader: 'borov', name: '司令官', desc: '軍事基地を牛耳る司令官グロムを始末しろ。', obj: [{ type: 'kill', target: 'boss', count: 1, text: '司令官グロムを倒す' }], reward: { money: 400000, xp: 8000, items: [['key_bunker', 1]] }, req: ['q7'] },
  { id: 'q9', trader: 'yan', name: '巨人殺し', desc: 'センチネルを倒せる者はそういない。証拠を持ってこい。', obj: [{ type: 'kill', target: 'sentinel', count: 1, text: 'センチネルを破壊する' }, { type: 'find', item: 'sentinel_targeting_unit', count: 1, text: 'センチネル照準ユニットを納品' }], reward: { money: 500000, xp: 9000, items: [['arc_cell_oc', 48]] }, req: ['q3'] },
  { id: 'q10', trader: 'luka', name: '海の向こう', desc: '埠頭のボートから脱出してみせろ。', obj: [{ type: 'extract', ex: 'boat', count: 1, text: '埠頭 小型ボートから脱出' }], reward: { money: 60000, xp: 1500, items: [['key_dock', 1]] }, req: ['q1'] },
  { id: 'q11', trader: 'luka', name: '研究所の秘密', desc: '研究所の機密データを手に入れろ。', obj: [{ type: 'find', item: 'research_notes', count: 2, text: '研究ノートを納品' }, { type: 'find', item: 'encrypted_drive', count: 1, text: '暗号化ドライブを納品' }], reward: { money: 300000, xp: 6000, items: [['card_blue', 1]] }, req: ['q10'] },
  { id: 'q12', trader: 'mira', name: '飢えた人々', desc: '避難民のために食料を集めてほしい。', obj: [{ type: 'find', item: 'can_beef', count: 3, text: '牛肉の缶詰を納品' }, { type: 'find', item: 'water', count: 3, text: '飲料水を納品' }], reward: { money: 60000, xp: 1800, unlockStation: 'kitchen' }, req: ['q4'] },
  { id: 'q13', trader: 'eva', name: '仕立て屋', desc: '布地を集めれば、もっと良いバッグを作ってやれる。', obj: [{ type: 'find', item: 'canvas_fabric', count: 3, text: '帆布を納品' }, { type: 'find', item: 'paracord', count: 2, text: 'パラコードを納品' }], reward: { money: 80000, xp: 2000, unlockStation: 'tailor' }, req: ['q5'] },
  { id: 'q14', trader: 'luka', name: '黄金郷', desc: '持ち帰った貴重品の総額で実力を示せ。', obj: [{ type: 'loot_value', count: 500000, text: '1 回のレイドで 500,000 C 以上を持ち帰る' }], reward: { money: 200000, xp: 5000, items: [['sc_beta', 1]] }, req: ['q10'] },
];

export const XP_LEVELS = [];
for (let i = 0, acc = 0; i < 40; i++) { XP_LEVELS.push(acc); acc += 1000 + i * 650; }
export function levelFromXp(xp) {
  let l = 1;
  for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i]) l = i + 1;
  return l;
}
