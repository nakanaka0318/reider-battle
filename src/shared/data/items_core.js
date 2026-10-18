// コアアイテム：武器・弾薬・MOD・防具・装備・医薬品・食料・投擲物・鍵
// 数値はゲームバランス用（ダメージ・貫通力は Tarkov 風のスケール）

const out = [];
const add = (o) => { out.push(o); return o; };

// ---------------------------------------------------------------- 口径
export const CALIBERS = {
  '9x19': { name: '9x19mm', sound: 'pistol' },
  '45acp': { name: '.45 ACP', sound: 'pistol' },
  '57x28': { name: '5.7x28mm', sound: 'smg' },
  '46x30': { name: '4.6x30mm', sound: 'smg' },
  '545x39': { name: '5.45x39mm', sound: 'rifle' },
  '556x45': { name: '5.56x45mm', sound: 'rifle' },
  '762x39': { name: '7.62x39mm', sound: 'rifle' },
  '762x51': { name: '7.62x51mm', sound: 'heavy' },
  '762x54r': { name: '7.62x54mmR', sound: 'heavy' },
  '338lm': { name: '.338 ラプア', sound: 'sniper' },
  '12g': { name: '12ゲージ', sound: 'shotgun' },
  '9x39': { name: '9x39mm', sound: 'subsonic' },
  'arc': { name: 'ARCエネルギー', sound: 'energy' },
};

// ---------------------------------------------------------------- 武器
// class: pistol smg rifle dmr sniper shotgun lmg
// rpm, mag, modes, recoilV/H（大きいほど暴れる）, ergo(0-100), spread(度), reload(秒), zoom(ADS倍率)
function weapon(id, name, short, cls, cal, o) {
  const size = { pistol: [2, 1], smg: [3, 2], rifle: [4, 2], dmr: [5, 2], sniper: [5, 2], shotgun: [4, 2], lmg: [5, 2] }[cls];
  return add({
    id, name, short, cat: 'weapon', sub: cls,
    w: o.w || size[0], h: o.h || size[1],
    value: o.value, rarity: o.rarity ?? 1, weight: o.weight ?? 3,
    stack: 1, icon: cls, color: o.color || '#3b3f42',
    loot: o.loot || ['military'],
    desc: o.desc || '',
    weapon: {
      class: cls, caliber: cal,
      rpm: o.rpm, mag: o.mag, modes: o.modes || ['semi'],
      recoilV: o.rv, recoilH: o.rh, ergo: o.ergo, spread: o.spread ?? 0.12,
      reload: o.reload ?? 2.4, zoom: o.zoom ?? 1.25, dmgMul: o.dmgMul ?? 1,
      velMul: o.velMul ?? 1, suppressed: !!o.suppressed, bolt: !!o.bolt, pump: !!o.pump,
      slots: o.slots || defaultSlots(cls), model: o.model || {},
      defaultAmmo: o.defaultAmmo,
    },
  });
}
function defaultSlots(cls) {
  switch (cls) {
    case 'pistol': return ['sight', 'muzzle', 'tactical', 'mag'];
    case 'shotgun': return ['sight', 'muzzle', 'grip', 'stock', 'tactical', 'mag'];
    case 'sniper': return ['sight', 'muzzle', 'stock', 'tactical'];
    default: return ['sight', 'muzzle', 'grip', 'stock', 'tactical', 'mag'];
  }
}

// ピストル
weapon('p17', 'ストライカー P17', 'P17', 'pistol', '9x19', { rpm: 450, mag: 17, rv: 0.9, rh: 0.35, ergo: 92, value: 18000, rarity: 0, weight: 0.7, defaultAmmo: 'a9_pst', loot: ['military', 'office', 'residential'], desc: '信頼性の高いポリマーフレームの9mm拳銃。' });
weapon('sg26', 'SG-26 コンパクト', 'SG26', 'pistol', '9x19', { rpm: 420, mag: 15, rv: 0.85, rh: 0.3, ergo: 90, value: 22000, rarity: 1, weight: 0.8, defaultAmmo: 'a9_pst', loot: ['military', 'office'], desc: '軍・警察で広く使われる精度の高い拳銃。', color: '#2c2f33' });
weapon('m1911', 'M1911A1', '1911', 'pistol', '45acp', { rpm: 380, mag: 7, rv: 1.3, rh: 0.4, ergo: 85, value: 20000, rarity: 0, weight: 1.1, defaultAmmo: 'a45_fmj', color: '#5a5b5c', loot: ['residential', 'military'], desc: '100年以上の歴史を持つ.45口径の名銃。一発が重い。' });
weapon('mk23', 'MK-23 ナイトホーク', 'MK23', 'pistol', '45acp', { rpm: 400, mag: 12, rv: 1.15, rh: 0.35, ergo: 80, value: 38000, rarity: 2, weight: 1.2, defaultAmmo: 'a45_fmj', loot: ['military'], desc: '特殊部隊向けの大型.45拳銃。サプレッサー適合。' });
weapon('fs57', 'FS-57 タクティカル', 'FS57', 'pistol', '57x28', { rpm: 480, mag: 20, rv: 0.7, rh: 0.25, ergo: 88, value: 45000, rarity: 2, weight: 0.75, defaultAmmo: 'a57_ss190', loot: ['military'], desc: '高初速の5.7mm弾を使う拳銃。ボディアーマーに有効。', color: '#2e2b26' });
weapon('apb20', 'APB-20 マシンピストル', 'APB', 'pistol', '9x19', { rpm: 750, mag: 20, modes: ['semi', 'auto'], rv: 1.1, rh: 0.6, ergo: 78, value: 34000, rarity: 2, weight: 1.0, defaultAmmo: 'a9_pst', loot: ['military'], desc: 'フルオート射撃可能な拳銃。近距離では侮れない。' });

// SMG
weapon('mp9n', 'MP-9N', 'MP9N', 'smg', '9x19', { rpm: 800, mag: 30, modes: ['semi', 'burst', 'auto'], rv: 0.75, rh: 0.35, ergo: 82, value: 55000, rarity: 1, weight: 2.5, defaultAmmo: 'a9_pst', desc: '世界中で使われるローラーディレイド式SMG。扱いやすい。' });
weapon('umc45', 'UMC-45', 'UMC45', 'smg', '45acp', { rpm: 600, mag: 25, modes: ['semi', 'auto'], rv: 0.95, rh: 0.4, ergo: 80, value: 52000, rarity: 1, weight: 2.3, defaultAmmo: 'a45_fmj', desc: '.45口径のポリマーSMG。ストッピングパワーに優れる。', color: '#222426' });
weapon('px90', 'PX-90', 'PX90', 'smg', '57x28', { rpm: 900, mag: 50, modes: ['semi', 'auto'], rv: 0.55, rh: 0.3, ergo: 75, value: 98000, rarity: 3, weight: 2.6, defaultAmmo: 'a57_ss190', desc: '50連マガジンを持つブルパップPDW。', color: '#3d3a2f', model: { bullpup: true } });
weapon('mx7', 'MX-7 PDW', 'MX7', 'smg', '46x30', { rpm: 950, mag: 40, modes: ['semi', 'auto'], rv: 0.6, rh: 0.3, ergo: 84, value: 90000, rarity: 3, weight: 1.9, defaultAmmo: 'a46_fmj', desc: '小型で高貫通の4.6mm弾を使うPDW。' });
weapon('kv45', 'KV-45 ヴェクトル', 'KV45', 'smg', '45acp', { rpm: 1100, mag: 25, modes: ['semi', 'burst', 'auto'], rv: 0.55, rh: 0.45, ergo: 76, value: 88000, rarity: 3, weight: 2.7, defaultAmmo: 'a45_fmj', desc: '独自の反動軽減機構を持つ超高速連射SMG。' });
weapon('pps43', 'PPS-43 改', 'PPS43', 'smg', '9x19', { rpm: 700, mag: 35, modes: ['auto'], rv: 0.9, rh: 0.5, ergo: 70, value: 26000, rarity: 0, weight: 3.0, defaultAmmo: 'a9_pst', loot: ['military', 'industrial'], desc: '旧式の簡易SMGを9mmに改修したもの。', color: '#4a4134' });

// アサルトライフル
weapon('ak74n', 'AK-74N', 'AK74N', 'rifle', '545x39', { rpm: 650, mag: 30, modes: ['semi', 'auto'], rv: 1.05, rh: 0.5, ergo: 62, value: 70000, rarity: 1, weight: 3.4, defaultAmmo: 'a545_ps', desc: '5.45mm弾を使う定番のアサルトライフル。', color: '#3a2f25', model: { ak: true } });
weapon('akm', 'AKM', 'AKM', 'rifle', '762x39', { rpm: 600, mag: 30, modes: ['semi', 'auto'], rv: 1.45, rh: 0.7, ergo: 58, value: 62000, rarity: 0, weight: 3.6, defaultAmmo: 'a762_ps', desc: '堅牢で強力な7.62x39mmライフル。反動は強め。', color: '#5b3a22', model: { ak: true } });
weapon('ak15', 'AK-15 タクティカル', 'AK15', 'rifle', '545x39', { rpm: 700, mag: 30, modes: ['semi', 'burst', 'auto'], rv: 0.9, rh: 0.4, ergo: 66, value: 120000, rarity: 2, weight: 3.5, defaultAmmo: 'a545_bt', desc: '近代化されたAKプラットフォーム。レール完備。', color: '#2a2a2a', model: { ak: true } });
weapon('m4a1', 'M4A1', 'M4A1', 'rifle', '556x45', { rpm: 800, mag: 30, modes: ['semi', 'auto'], rv: 0.85, rh: 0.4, ergo: 70, value: 110000, rarity: 2, weight: 3.1, defaultAmmo: 'a556_m855', desc: 'モジュール性の高い5.56mmカービン。' });
weapon('hx416', 'HX-416', 'HX416', 'rifle', '556x45', { rpm: 850, mag: 30, modes: ['semi', 'auto'], rv: 0.78, rh: 0.36, ergo: 68, value: 150000, rarity: 3, weight: 3.4, defaultAmmo: 'a556_m855', desc: 'ショートストロークピストン式の高信頼カービン。', color: '#4b4434' });
weapon('stg77', 'STG-77 ブルパップ', 'STG77', 'rifle', '556x45', { rpm: 700, mag: 30, modes: ['semi', 'auto'], rv: 0.8, rh: 0.35, ergo: 72, value: 125000, rarity: 2, weight: 3.6, defaultAmmo: 'a556_m855', desc: 'コンパクトなブルパップ式ライフル。', color: '#56603f', model: { bullpup: true } });
weapon('skrl', 'SKR-L', 'SKR-L', 'rifle', '556x45', { rpm: 600, mag: 30, modes: ['semi', 'auto'], rv: 0.75, rh: 0.3, ergo: 69, value: 140000, rarity: 3, weight: 3.3, defaultAmmo: 'a556_m855', desc: '特殊部隊向けモジュラーライフル。', color: '#8a7550' });
weapon('mcxb', 'MCX-B', 'MCX', 'rifle', '556x45', { rpm: 820, mag: 30, modes: ['semi', 'auto'], rv: 0.72, rh: 0.34, ergo: 74, value: 165000, rarity: 3, weight: 2.9, defaultAmmo: 'a556_m855', desc: '軽量なショートバレルのカービン。', color: '#2b2d2f' });
weapon('asval', 'AS ヴァル', 'ヴァル', 'rifle', '9x39', { rpm: 900, mag: 20, modes: ['semi', 'auto'], rv: 0.8, rh: 0.4, ergo: 72, value: 180000, rarity: 3, weight: 2.5, defaultAmmo: 'a939_sp5', suppressed: true, desc: '一体型サプレッサーを持つ亜音速弾ライフル。静かで強力。', slots: ['sight', 'grip', 'stock', 'tactical', 'mag'] });
weapon('sa58', 'SA-58 バトルライフル', 'SA58', 'rifle', '762x51', { rpm: 700, mag: 20, modes: ['semi', 'auto'], rv: 1.7, rh: 0.75, ergo: 52, value: 175000, rarity: 3, weight: 4.3, defaultAmmo: 'a762n_m80', desc: '7.62x51mm NATO弾をフルオートで撃てるバトルライフル。', color: '#33302a' });

// DMR
weapon('svds', 'SVDS', 'SVDS', 'dmr', '762x54r', { rpm: 300, mag: 10, rv: 2.0, rh: 0.6, ergo: 45, spread: 0.05, zoom: 1.4, value: 160000, rarity: 3, weight: 4.7, defaultAmmo: 'a54r_lps', reload: 2.8, desc: '旧東側の名マークスマンライフル。', color: '#4a3220' });
weapon('m14ebr', 'M14 EBR', 'EBR', 'dmr', '762x51', { rpm: 320, mag: 20, rv: 1.8, rh: 0.55, ergo: 50, spread: 0.05, zoom: 1.4, value: 170000, rarity: 3, weight: 5.0, defaultAmmo: 'a762n_m80', reload: 2.7, desc: 'シャーシ化されたM14。中距離の制圧力に優れる。' });
weapon('sr25m', 'SR-25M', 'SR25', 'dmr', '762x51', { rpm: 330, mag: 20, rv: 1.55, rh: 0.5, ergo: 56, spread: 0.04, zoom: 1.4, value: 220000, rarity: 4, weight: 4.8, defaultAmmo: 'a762n_m80', reload: 2.6, desc: '高精度な7.62mmセミオートライフル。', color: '#3f3a2c' });
weapon('vsk94', 'VSK-94', 'VSK94', 'dmr', '9x39', { rpm: 400, mag: 20, rv: 0.9, rh: 0.4, ergo: 66, spread: 0.07, zoom: 1.35, value: 95000, rarity: 2, weight: 2.8, defaultAmmo: 'a939_sp5', suppressed: true, desc: '一体型サプレッサーの9x39mmマークスマンライフル。', slots: ['sight', 'grip', 'stock', 'tactical', 'mag'] });

// ボルトアクション
weapon('mosin', 'モシン・ナガン', 'モシン', 'sniper', '762x54r', { rpm: 50, mag: 5, rv: 2.6, rh: 0.6, ergo: 40, spread: 0.035, zoom: 1.4, value: 42000, rarity: 0, weight: 4.0, defaultAmmo: 'a54r_lps', reload: 3.6, bolt: true, desc: '100年以上前のボルトアクション。今も一撃は致命的。', color: '#6b4426', loot: ['military', 'residential'] });
weapon('r700', 'R-700 狙撃銃', 'R700', 'sniper', '762x51', { rpm: 55, mag: 5, rv: 2.3, rh: 0.5, ergo: 46, spread: 0.025, zoom: 1.45, value: 120000, rarity: 2, weight: 4.4, defaultAmmo: 'a762n_m80', reload: 3.0, bolt: true, desc: '精度に定評のあるボルトアクションライフル。', color: '#2f3a2c' });
weapon('ax338', 'AX-338', 'AX338', 'sniper', '338lm', { rpm: 45, mag: 10, rv: 3.2, rh: 0.6, ergo: 38, spread: 0.02, zoom: 1.5, value: 380000, rarity: 4, weight: 6.8, defaultAmmo: 'a338_fmj', reload: 3.4, bolt: true, desc: '.338ラプアマグナムの長距離狙撃システム。', color: '#3c4a3a' });
weapon('t5000', 'オルシ T5', 'T5000', 'sniper', '338lm', { rpm: 48, mag: 5, rv: 3.0, rh: 0.55, ergo: 40, spread: 0.02, zoom: 1.5, value: 310000, rarity: 4, weight: 6.2, defaultAmmo: 'a338_fmj', reload: 3.2, bolt: true, desc: '高精度な.338口径ボルトアクション。', color: '#262626' });

// ショットガン
weapon('mp133', 'MP-133', 'MP133', 'shotgun', '12g', { rpm: 70, mag: 6, rv: 2.4, rh: 0.8, ergo: 55, spread: 0.2, value: 24000, rarity: 0, weight: 3.5, defaultAmmo: 'a12_buck', reload: 3.6, pump: true, desc: '安価で頑丈なポンプアクション散弾銃。', color: '#3a2a1e', loot: ['military', 'residential', 'industrial'] });
weapon('r870', 'R-870 ポンプ', 'R870', 'shotgun', '12g', { rpm: 75, mag: 6, rv: 2.3, rh: 0.75, ergo: 58, spread: 0.18, value: 36000, rarity: 1, weight: 3.6, defaultAmmo: 'a12_buck', reload: 3.4, pump: true, desc: '定番のポンプアクション散弾銃。' });
weapon('s12k', 'S-12K セミオート', 'S12K', 'shotgun', '12g', { rpm: 300, mag: 8, rv: 2.0, rh: 0.8, ergo: 50, spread: 0.2, value: 68000, rarity: 2, weight: 3.8, defaultAmmo: 'a12_buck', reload: 2.8, desc: 'AK系の機構を持つマガジン式セミオート散弾銃。', model: { ak: true } });
weapon('bm1014', 'BM-1014', 'BM1014', 'shotgun', '12g', { rpm: 280, mag: 7, rv: 1.9, rh: 0.7, ergo: 56, spread: 0.18, value: 82000, rarity: 3, weight: 3.8, defaultAmmo: 'a12_buck', reload: 3.6, desc: 'ガス圧作動の軍用セミオート散弾銃。' });
weapon('as12', 'AS-12 オート', 'AS12', 'shotgun', '12g', { rpm: 330, mag: 20, modes: ['semi', 'auto'], rv: 1.5, rh: 0.6, ergo: 48, spread: 0.22, value: 210000, rarity: 4, weight: 5.2, defaultAmmo: 'a12_buck', reload: 3.0, desc: '20連ドラムのフルオート散弾銃。近距離最強クラス。', color: '#2d2f2b' });

// LMG
weapon('rpk16', 'RPK-16', 'RPK16', 'lmg', '545x39', { rpm: 700, mag: 95, modes: ['semi', 'auto'], rv: 0.95, rh: 0.45, ergo: 45, value: 190000, rarity: 3, weight: 5.0, defaultAmmo: 'a545_ps', reload: 4.2, desc: '95連ドラムを備えた分隊支援火器。', model: { ak: true } });
weapon('pkp', 'PKP ペチェネグ', 'PKP', 'lmg', '762x54r', { rpm: 650, mag: 100, modes: ['auto'], rv: 1.25, rh: 0.6, ergo: 30, value: 290000, rarity: 4, weight: 8.2, defaultAmmo: 'a54r_lps', reload: 5.5, desc: 'ベルト給弾の汎用機関銃。圧倒的な制圧力。', color: '#2c2c28' });
weapon('m249', 'M-249 SAW', 'M249', 'lmg', '556x45', { rpm: 800, mag: 100, modes: ['auto'], rv: 0.9, rh: 0.5, ergo: 35, value: 260000, rarity: 4, weight: 7.5, defaultAmmo: 'a556_m855', reload: 5.0, desc: '5.56mmベルト給弾の軽機関銃。' });

// ARC 兵器（機械パーツから作る）
weapon('arc_pulse', 'ARCパルスライフル', 'パルス', 'rifle', 'arc', { rpm: 520, mag: 24, modes: ['semi', 'auto'], rv: 0.5, rh: 0.25, ergo: 70, value: 420000, rarity: 5, weight: 3.8, defaultAmmo: 'arc_cell', loot: ['machine'], color: '#1e6e8a', desc: 'ARC機械の動力コアを流用した試作エネルギー兵器。弾道が直進し、装甲に強い。', slots: ['sight', 'grip', 'tactical'] });
weapon('arc_lance', 'ARCランス', 'ランス', 'dmr', 'arc', { rpm: 150, mag: 8, rv: 1.2, rh: 0.3, ergo: 55, spread: 0.02, zoom: 1.5, value: 520000, rarity: 5, weight: 4.5, defaultAmmo: 'arc_cell', loot: ['machine'], color: '#7b2fa0', dmgMul: 2.2, desc: 'センチネルの主砲を小型化した高出力ビーム兵器。', slots: ['sight', 'tactical'] });

// ---------------------------------------------------------------- 弾薬
function ammo(id, name, short, cal, o) {
  const shot = cal === '12g';
  return add({
    id, name, short, cat: 'ammo', sub: cal, w: 1, h: 1,
    value: o.value, rarity: o.rarity ?? 0, weight: 0.012, stack: o.stack || (shot ? 20 : cal === '338lm' ? 30 : 60),
    icon: shot ? 'shell' : 'ammo_box', color: o.color || '#8a7246',
    loot: o.loot || ['military'],
    desc: o.desc || `${CALIBERS[cal].name} 弾。ダメージ ${o.dmg}${o.pellets ? `×${o.pellets}` : ''} / 貫通 ${o.pen}`,
    ammo: { caliber: cal, damage: o.dmg, pen: o.pen, armorDmg: o.ad ?? 0.5, pellets: o.pellets || 1, tracer: !!o.tracer, speed: o.speed || 800, frag: o.frag ?? 0.1 },
    valuePerUnit: true,
  });
}
// value は 1 発あたり
ammo('a9_pst', '9x19mm PST', 'PST', '9x19', { dmg: 54, pen: 20, value: 60, ad: 0.33 });
ammo('a9_ap', '9x19mm AP 6.3', 'AP6.3', '9x19', { dmg: 52, pen: 30, value: 180, rarity: 1, ad: 0.48 });
ammo('a9_rip', '9x19mm RIP', 'RIP', '9x19', { dmg: 102, pen: 2, value: 260, rarity: 2, ad: 0.1, color: '#a9572e', frag: 1 });
ammo('a9_t', '9x19mm グリーントレーサー', 'GT', '9x19', { dmg: 58, pen: 14, value: 70, tracer: true, ad: 0.3, color: '#4f8a3a' });
ammo('a45_fmj', '.45 ACP FMJ', 'FMJ', '45acp', { dmg: 66, pen: 10, value: 90, ad: 0.36 });
ammo('a45_ap', '.45 ACP AP', 'AP', '45acp', { dmg: 66, pen: 38, value: 380, rarity: 2, ad: 0.6 });
ammo('a45_hs', '.45 ハイドラショック', 'HS', '45acp', { dmg: 85, pen: 13, value: 160, rarity: 1, ad: 0.25, frag: 0.6 });
ammo('a57_ss190', '5.7x28mm SS190', 'SS190', '57x28', { dmg: 49, pen: 37, value: 320, rarity: 2, ad: 0.55, tracer: true });
ammo('a57_sb193', '5.7x28mm SB193 亜音速', 'SB193', '57x28', { dmg: 59, pen: 20, value: 160, rarity: 1, ad: 0.4 });
ammo('a57_r37', '5.7x28mm R37.F', 'R37F', '57x28', { dmg: 98, pen: 8, value: 220, rarity: 2, ad: 0.2, frag: 0.9 });
ammo('a46_fmj', '4.6x30mm FMJ SX', 'FMJ', '46x30', { dmg: 43, pen: 40, value: 250, rarity: 1, ad: 0.6 });
ammo('a46_ap', '4.6x30mm AP SX', 'AP SX', '46x30', { dmg: 46, pen: 53, value: 620, rarity: 3, ad: 0.65 });
ammo('a46_act', '4.6x30mm アクション SX', 'ACT', '46x30', { dmg: 65, pen: 18, value: 210, rarity: 1, ad: 0.3 });
ammo('a545_ps', '5.45x39mm PS', 'PS', '545x39', { dmg: 53, pen: 21, value: 80, ad: 0.38 });
ammo('a545_bt', '5.45x39mm BT', 'BT', '545x39', { dmg: 54, pen: 37, value: 230, rarity: 1, ad: 0.48, tracer: true, color: '#a0402d' });
ammo('a545_bs', '5.45x39mm BS', 'BS', '545x39', { dmg: 45, pen: 54, value: 720, rarity: 3, ad: 0.6, color: '#3a3a3a' });
ammo('a545_ppbs', '5.45x39mm PPBS 「イゴルニク」', 'PPBS', '545x39', { dmg: 37, pen: 62, value: 1400, rarity: 4, ad: 0.7, color: '#2a5c7a' });
ammo('a545_hp', '5.45x39mm HP', 'HP', '545x39', { dmg: 76, pen: 9, value: 70, ad: 0.2, frag: 0.5 });
ammo('a556_m855', '5.56x45mm M855', 'M855', '556x45', { dmg: 54, pen: 31, value: 160, rarity: 0, ad: 0.49 });
ammo('a556_m855a1', '5.56x45mm M855A1', 'A1', '556x45', { dmg: 49, pen: 44, value: 520, rarity: 2, ad: 0.52 });
ammo('a556_m995', '5.56x45mm M995', 'M995', '556x45', { dmg: 42, pen: 53, value: 980, rarity: 3, ad: 0.64, color: '#3a3a3a' });
ammo('a556_sost', '5.56x45mm SOST', 'SOST', '556x45', { dmg: 60, pen: 23, value: 210, rarity: 1, ad: 0.36 });
ammo('a556_warm', '5.56x45mm ウォーマゲドン', 'WARM', '556x45', { dmg: 88, pen: 3, value: 140, rarity: 1, ad: 0.1, frag: 0.9, color: '#9c3224' });
ammo('a762_ps', '7.62x39mm PS', 'PS', '762x39', { dmg: 57, pen: 35, value: 150, ad: 0.52 });
ammo('a762_bp', '7.62x39mm BP', 'BP', '762x39', { dmg: 58, pen: 47, value: 650, rarity: 2, ad: 0.63, color: '#3a3a3a' });
ammo('a762_mai', '7.62x39mm MAI AP', 'MAI', '762x39', { dmg: 53, pen: 58, value: 1300, rarity: 4, ad: 0.76, color: '#2a5c7a' });
ammo('a762_hp', '7.62x39mm HP', 'HP', '762x39', { dmg: 80, pen: 15, value: 90, ad: 0.25, frag: 0.4 });
ammo('a762_t45', '7.62x39mm T-45M1 曳光弾', 'T45', '762x39', { dmg: 65, pen: 30, value: 170, ad: 0.45, tracer: true, color: '#4f8a3a' });
ammo('a762n_m80', '7.62x51mm M80', 'M80', '762x51', { dmg: 80, pen: 41, value: 400, rarity: 1, ad: 0.66 });
ammo('a762n_m61', '7.62x51mm M61', 'M61', '762x51', { dmg: 70, pen: 64, value: 1600, rarity: 3, ad: 0.83, color: '#3a3a3a' });
ammo('a762n_m993', '7.62x51mm M993', 'M993', '762x51', { dmg: 67, pen: 70, value: 2600, rarity: 4, ad: 0.85, color: '#2a5c7a' });
ammo('a762n_un', '7.62x51mm ウルトラノスラー', 'UN', '762x51', { dmg: 107, pen: 15, value: 300, rarity: 1, ad: 0.2, frag: 0.7, color: '#9c3224' });
ammo('a54r_lps', '7.62x54mmR LPS', 'LPS', '762x54r', { dmg: 81, pen: 42, value: 350, ad: 0.78 });
ammo('a54r_snb', '7.62x54mmR SNB', 'SNB', '762x54r', { dmg: 75, pen: 62, value: 1500, rarity: 3, ad: 0.87, color: '#3a3a3a' });
ammo('a54r_bs', '7.62x54mmR BS', 'BS', '762x54r', { dmg: 72, pen: 70, value: 2800, rarity: 4, ad: 0.88, color: '#2a5c7a' });
ammo('a54r_t46', '7.62x54mmR T-46M 曳光弾', 'T46M', '762x54r', { dmg: 82, pen: 41, value: 380, rarity: 1, ad: 0.83, tracer: true, color: '#4f8a3a' });
ammo('a338_fmj', '.338 ラプア FMJ', 'FMJ', '338lm', { dmg: 122, pen: 47, value: 1300, rarity: 2, ad: 0.83 });
ammo('a338_ap', '.338 ラプア AP', 'AP', '338lm', { dmg: 115, pen: 79, value: 4200, rarity: 4, ad: 0.95, color: '#2a5c7a' });
ammo('a338_tac', '.338 ラプア TAC-X', 'TAC-X', '338lm', { dmg: 196, pen: 18, value: 1800, rarity: 3, ad: 0.6, color: '#9c3224' });
ammo('a12_buck', '12/70 8.5mm バックショット', '8.5mm', '12g', { dmg: 39, pen: 3, pellets: 8, value: 50, ad: 0.65, color: '#a02a24' });
ammo('a12_mag', '12/70 マグナム バックショット', 'MAG', '12g', { dmg: 50, pen: 2, pellets: 8, value: 90, rarity: 1, ad: 0.26, color: '#2a4fa0' });
ammo('a12_flech', '12/70 フレシェット', 'FLECH', '12g', { dmg: 25, pen: 31, pellets: 8, value: 260, rarity: 2, ad: 0.26, color: '#3a8a8a' });
ammo('a12_slug', '12/70 グリズリー スラッグ', 'SLUG', '12g', { dmg: 180, pen: 12, value: 140, rarity: 1, ad: 0.48, color: '#3a3a3a' });
ammo('a12_ap20', '12/70 AP-20 徹甲スラッグ', 'AP-20', '12g', { dmg: 164, pen: 37, value: 700, rarity: 3, ad: 0.65, color: '#2a5c7a' });
ammo('a939_sp5', '9x39mm SP-5', 'SP-5', '9x39', { dmg: 71, pen: 44, value: 420, rarity: 1, ad: 0.52 });
ammo('a939_sp6', '9x39mm SP-6', 'SP-6', '9x39', { dmg: 58, pen: 46, value: 560, rarity: 2, ad: 0.6 });
ammo('a939_pab', '9x39mm PAB-9', 'PAB-9', '9x39', { dmg: 62, pen: 52, value: 900, rarity: 3, ad: 0.62 });
ammo('a939_bp', '9x39mm BP', 'BP', '9x39', { dmg: 60, pen: 55, value: 1400, rarity: 4, ad: 0.65, color: '#2a5c7a' });
ammo('arc_cell', 'ARCエネルギーセル', 'セル', 'arc', { dmg: 62, pen: 52, value: 900, rarity: 3, ad: 0.9, loot: ['machine'], color: '#2fb6d8', tracer: true, stack: 48 });
ammo('arc_cell_oc', '過充電ARCセル', '過充電', 'arc', { dmg: 88, pen: 64, value: 2400, rarity: 4, ad: 1.0, loot: ['machine'], color: '#c03bd8', tracer: true, stack: 48 });

// ---------------------------------------------------------------- 武器MOD
function mod(id, name, short, slot, o) {
  const iconMap = { sight: o.zoom > 1.6 ? 'scope' : 'reddot', muzzle: o.suppressor ? 'suppressor' : 'muzzle', grip: 'grip', mag: 'mag', stock: 'stock', tactical: o.light ? 'flashlight_mod' : 'laser' };
  return add({
    id, name, short, cat: 'mod', sub: slot, w: o.w || 1, h: o.h || 1,
    value: o.value, rarity: o.rarity ?? 1, weight: o.weight ?? 0.3, stack: 1,
    icon: iconMap[slot], color: o.color || '#2d3034', loot: o.loot || ['military', 'tech'],
    desc: o.desc,
    mod: {
      slot, fits: o.fits || null, calibers: o.calibers || null,
      zoom: o.zoom || 0, reticle: o.reticle || null, recoil: o.recoil || 0, ergo: o.ergo || 0,
      suppressor: !!o.suppressor, magBonus: o.magBonus || 0, spread: o.spread || 0,
      light: !!o.light, laser: !!o.laser, thermal: !!o.thermal, nv: !!o.nv,
    },
  });
}
const LONG = ['rifle', 'dmr', 'sniper', 'lmg', 'smg', 'shotgun'];
mod('sight_rd1', 'リフレックスサイト RD-1', 'RD-1', 'sight', { zoom: 1.35, reticle: 'dot', value: 9000, rarity: 0, desc: '小型のドットサイト。拳銃にも装着可能。', ergo: 1 });
mod('sight_holo', 'ホログラフィックサイト EX3', 'EX3', 'sight', { zoom: 1.4, reticle: 'holo', value: 24000, fits: LONG, desc: '視界の広い軍用ホロサイト。' });
mod('sight_t1', 'コリメーター T-1', 'T-1', 'sight', { zoom: 1.4, reticle: 'dot', value: 18000, fits: LONG, desc: '軽量チューブ型ドットサイト。' });
mod('sight_25x', '2.5倍 プリズムスコープ', '2.5x', 'sight', { zoom: 2.5, reticle: 'chevron', value: 30000, rarity: 2, fits: LONG, desc: '中距離向けのプリズムスコープ。' });
mod('sight_acog', 'TA-4x 戦術スコープ', 'TA4x', 'sight', { zoom: 4, reticle: 'chevron', value: 48000, rarity: 2, fits: LONG, desc: '定番の4倍固定スコープ。', w: 2 });
mod('sight_lpvo', '可変 1-6x LPVO', 'LPVO', 'sight', { zoom: 6, reticle: 'cross', value: 72000, rarity: 3, fits: LONG, desc: '可変倍率のライフルスコープ（6倍）。', w: 2 });
mod('sight_8x', '8倍 狙撃スコープ', '8x', 'sight', { zoom: 8, reticle: 'mil', value: 68000, rarity: 3, fits: ['rifle', 'dmr', 'sniper', 'lmg'], desc: '長距離狙撃用の高倍率スコープ。', w: 2 });
mod('sight_12x', '12倍 長距離スコープ', '12x', 'sight', { zoom: 12, reticle: 'mil', value: 110000, rarity: 4, fits: ['dmr', 'sniper'], desc: '超長距離用の大型スコープ。', w: 2 });
mod('sight_thermal', 'サーマルスコープ T-7', 'T-7', 'sight', { zoom: 2, reticle: 'thermal', thermal: true, value: 260000, rarity: 5, fits: LONG, desc: '熱源を白く映し出すサーマル照準器。暗闇でも敵を捉える。', w: 2, color: '#1f2a33' });
mod('sight_nv', 'ナイトビジョンスコープ NV-3', 'NV-3', 'sight', { zoom: 3, reticle: 'cross', nv: true, value: 150000, rarity: 4, fits: LONG, desc: '暗視増幅機能付きスコープ。', w: 2, color: '#1f3322' });
mod('sup_9', '9mm サプレッサー', 'SUP9', 'muzzle', { suppressor: true, calibers: ['9x19'], recoil: 0.06, ergo: -3, value: 26000, rarity: 2, desc: '9mm用サプレッサー。銃声と閃光を抑える。' });
mod('sup_45', '.45 サプレッサー', 'SUP45', 'muzzle', { suppressor: true, calibers: ['45acp'], recoil: 0.06, ergo: -3, value: 28000, rarity: 2, desc: '.45口径用サプレッサー。' });
mod('sup_57', '5.7/4.6mm サプレッサー', 'SUP57', 'muzzle', { suppressor: true, calibers: ['57x28', '46x30'], recoil: 0.05, ergo: -2, value: 34000, rarity: 2, desc: 'PDW用の小型サプレッサー。' });
mod('sup_545', '5.45 サプレッサー', 'SUP545', 'muzzle', { suppressor: true, calibers: ['545x39'], recoil: 0.08, ergo: -4, value: 42000, rarity: 3, desc: '5.45mm用サプレッサー。' });
mod('sup_556', '5.56 サプレッサー', 'SUP556', 'muzzle', { suppressor: true, calibers: ['556x45'], recoil: 0.08, ergo: -4, value: 48000, rarity: 3, desc: '5.56mm用の軍用サプレッサー。' });
mod('sup_762', '7.62 サプレッサー', 'SUP762', 'muzzle', { suppressor: true, calibers: ['762x39', '762x51', '762x54r'], recoil: 0.1, ergo: -6, value: 62000, rarity: 3, desc: '7.62mm系統に対応する大型サプレッサー。', w: 2 });
mod('sup_338', '.338 サプレッサー', 'SUP338', 'muzzle', { suppressor: true, calibers: ['338lm'], recoil: 0.12, ergo: -7, value: 95000, rarity: 4, desc: '.338ラプア用サプレッサー。', w: 2 });
mod('mz_brake', 'マズルブレーキ', 'ブレーキ', 'muzzle', { recoil: 0.15, ergo: -1, value: 14000, rarity: 1, fits: ['rifle', 'dmr', 'sniper', 'lmg'], desc: '発射ガスを横に逃がし反動を大きく軽減する。' });
mod('mz_comp', 'コンペンセイター', 'コンペン', 'muzzle', { recoil: 0.11, ergo: 0, value: 11000, rarity: 1, fits: ['rifle', 'smg', 'pistol', 'lmg'], desc: '跳ね上がりを抑えるマズルデバイス。' });
mod('mz_hider', 'フラッシュハイダー', 'ハイダー', 'muzzle', { recoil: 0.05, ergo: 1, value: 6000, rarity: 0, fits: ['rifle', 'smg', 'dmr', 'lmg'], desc: '発射炎を抑える。' });
mod('mz_choke', 'ショットガン チョーク', 'チョーク', 'muzzle', { spread: -0.35, recoil: 0.03, value: 8000, rarity: 1, fits: ['shotgun'], desc: '散弾の拡散を絞る。' });
mod('grip_vert', 'バーティカルグリップ', 'VGrip', 'grip', { recoil: 0.07, ergo: 3, value: 7000, rarity: 0, desc: '垂直フォアグリップ。縦反動を抑える。' });
mod('grip_angle', 'アングルドグリップ', 'AGrip', 'grip', { recoil: 0.05, ergo: 6, value: 9000, rarity: 1, desc: '傾斜型グリップ。取り回しが良くなる。' });
mod('grip_stop', 'ハンドストップ', 'HStop', 'grip', { recoil: 0.04, ergo: 4, value: 5000, rarity: 0, desc: 'シンプルなハンドストップ。' });
mod('grip_bipod', 'バイポッド付きグリップ', 'バイポ', 'grip', { recoil: 0.1, ergo: -2, value: 16000, rarity: 2, fits: ['rifle', 'dmr', 'sniper', 'lmg'], desc: '展開式バイポッドを内蔵したグリップ。' });
mod('stock_tac', 'タクティカルストック', 'TStock', 'stock', { recoil: 0.08, ergo: 4, value: 12000, rarity: 1, desc: '調整式のタクティカルストック。' });
mod('stock_prec', '精密ストック', 'PStock', 'stock', { recoil: 0.13, ergo: -2, value: 26000, rarity: 2, fits: ['rifle', 'dmr', 'sniper', 'lmg'], desc: 'チークライザー付きの精密射撃用ストック。' });
mod('stock_light', '軽量スケルトンストック', 'LStock', 'stock', { recoil: 0.05, ergo: 8, value: 15000, rarity: 1, desc: '軽量な骨格型ストック。' });
mod('tac_light', 'タクティカルライト', 'ライト', 'tactical', { light: true, ergo: -1, value: 8000, rarity: 0, desc: '暗所を照らす武器用ライト。[T]で切替。' });
mod('tac_laser', 'レーザーサイト', 'レーザー', 'tactical', { laser: true, spread: -0.25, ergo: -1, value: 14000, rarity: 1, desc: '腰だめ射撃の精度を上げる可視レーザー。' });
mod('tac_lam', 'コンボLAM', 'LAM', 'tactical', { light: true, laser: true, spread: -0.25, ergo: -2, value: 32000, rarity: 3, desc: 'ライトとレーザーの複合ユニット。' });
mod('mag_9_50', '9mm 50連ドラム', '50連', 'mag', { calibers: ['9x19'], magBonus: 20, ergo: -6, value: 24000, rarity: 2, desc: '9mm用ドラムマガジン。' });
mod('mag_45_ext', '.45 拡張マガジン', '拡張', 'mag', { calibers: ['45acp'], magBonus: 10, ergo: -3, value: 15000, rarity: 1, desc: '.45口径用の延長マガジン。' });
mod('mag_545_60', '5.45 60連マガジン', '60連', 'mag', { calibers: ['545x39'], magBonus: 30, ergo: -7, value: 32000, rarity: 2, desc: '4列式の大容量マガジン。' });
mod('mag_556_60', '5.56 60連マガジン', '60連', 'mag', { calibers: ['556x45'], magBonus: 30, ergo: -7, value: 38000, rarity: 2, desc: '4列式の大容量マガジン。' });
mod('mag_762_75', '7.62 75連ドラム', '75連', 'mag', { calibers: ['762x39'], magBonus: 45, ergo: -10, value: 46000, rarity: 3, desc: 'AK用の大型ドラムマガジン。' });
mod('mag_762n_30', '7.62x51 30連マガジン', '30連', 'mag', { calibers: ['762x51'], magBonus: 10, ergo: -4, value: 28000, rarity: 2, desc: 'バトルライフル用の拡張マガジン。' });
mod('mag_12_drum', '12ゲージ ドラム', '12Drum', 'mag', { calibers: ['12g'], magBonus: 8, ergo: -8, value: 42000, rarity: 3, desc: '散弾銃用ドラムマガジン。', fits: ['shotgun'] });

// ---------------------------------------------------------------- 防具
function armor(id, name, short, o) {
  return add({
    id, name, short, cat: 'armor', sub: 'vest', w: o.w || 3, h: o.h || 3,
    value: o.value, rarity: o.rarity ?? 1, weight: o.weight, stack: 1, icon: 'armor', color: o.color || '#4a4f3a',
    loot: o.loot || ['military'], desc: o.desc,
    armor: { cls: o.cls, dur: o.dur, zones: o.zones || ['thorax', 'stomach'], speed: o.speed ?? 0, ergo: o.ergo ?? 0, mat: o.mat || 'aramid' },
  });
}
armor('ar_paca', 'ソフトアーマー PACA', 'PACA', { cls: 2, dur: 50, value: 22000, rarity: 0, weight: 3.5, color: '#3d4a5a', loot: ['military', 'office'], desc: '警察用のソフトアーマー。拳銃弾を防ぐ。' });
armor('ar_press', 'プレスベスト', 'PRESS', { cls: 2, dur: 40, value: 18000, rarity: 0, weight: 3.0, color: '#2a4c8a', loot: ['office', 'residential'], desc: '報道関係者向けの防弾ベスト。' });
armor('ar_6b2', '6B2 防弾ベスト', '6B2', { cls: 2, dur: 60, value: 20000, rarity: 0, weight: 4.0, color: '#56603f', desc: '旧式の軍用ボディアーマー。' });
armor('ar_zhuk3', 'ジューク3 ベスト', 'ZHUK3', { cls: 3, dur: 50, value: 38000, rarity: 1, weight: 5.0, color: '#3f4436', desc: 'クラス3のプレート入りベスト。' });
armor('ar_6b23', '6B23-1 ボディアーマー', '6B23', { cls: 3, dur: 60, value: 46000, rarity: 1, weight: 6.2, color: '#5c6447', speed: 0.02, desc: '軍用の標準ボディアーマー。' });
armor('ar_trooper', 'トルーパー4 キャリア', 'TROOP', { cls: 4, dur: 55, value: 88000, rarity: 2, weight: 6.5, color: '#3b3d33', speed: 0.03, mat: 'ceramic', desc: 'クラス4のセラミックプレートキャリア。' });
armor('ar_iotv', 'IOTV 改良型', 'IOTV', { cls: 4, dur: 75, value: 120000, rarity: 3, weight: 9.5, color: '#7a6a4a', zones: ['thorax', 'stomach', 'armL', 'armR'], speed: 0.06, ergo: -6, mat: 'ceramic', desc: '腕まで保護する重量級ベスト。' });
armor('ar_6b13', '6B13 アサルトアーマー', '6B13', { cls: 4, dur: 60, value: 96000, rarity: 2, weight: 8.0, color: '#4a5a3a', speed: 0.04, mat: 'steel', desc: '耐久性に優れた鋼板入りアーマー。' });
armor('ar_slick', 'スリック プレートキャリア', 'SLICK', { cls: 5, dur: 70, value: 260000, rarity: 4, weight: 6.0, color: '#2a2a2a', zones: ['thorax'], speed: 0.01, mat: 'uhmwpe', desc: '軽量なクラス5キャリア。胸部のみを保護する。', w: 3, h: 3 });
armor('ar_fort', 'フォートレス 重装甲', 'FORT', { cls: 5, dur: 85, value: 300000, rarity: 4, weight: 13.0, color: '#5a5040', zones: ['thorax', 'stomach', 'armL', 'armR'], speed: 0.1, ergo: -12, mat: 'ceramic', desc: '腕部まで覆う重装甲。機動力は落ちる。' });
armor('ar_6b43', '6B43 ザブラロ', 'ZABR', { cls: 6, dur: 85, value: 420000, rarity: 5, weight: 20.0, color: '#3d4a33', zones: ['thorax', 'stomach', 'armL', 'armR'], speed: 0.14, ergo: -18, mat: 'steel', desc: '最高クラスの防護力を持つ重装ボディアーマー。' });
armor('ar_slayer', 'スレイヤー 試作装甲', 'SLAYER', { cls: 6, dur: 100, value: 650000, rarity: 5, weight: 11.0, color: '#1e3a4a', zones: ['thorax', 'stomach'], speed: 0.06, ergo: -6, mat: 'uhmwpe', loot: ['valuable', 'military'], desc: '研究所で開発されたARC合金製の試作アーマー。' });

function helmet(id, name, short, o) {
  return add({
    id, name, short, cat: 'helmet', sub: 'helmet', w: 2, h: 2,
    value: o.value, rarity: o.rarity ?? 1, weight: o.weight, stack: 1, icon: 'helmet', color: o.color || '#4a5040',
    loot: o.loot || ['military'], desc: o.desc,
    armor: { cls: o.cls, dur: o.dur, zones: ['head'], speed: 0, ergo: o.ergo ?? 0, ricochet: o.ric ?? 0.2, mat: o.mat || 'aramid', face: !!o.face },
  });
}
helmet('hm_work', '作業用ヘルメット', '作業帽', { cls: 1, dur: 20, value: 4000, rarity: 0, weight: 0.4, color: '#c8a020', loot: ['industrial'], desc: '工事現場用のヘルメット。気休め程度。' });
helmet('hm_ssh68', 'SSh-68 鉄帽', 'SSh68', { cls: 3, dur: 30, value: 14000, rarity: 0, weight: 1.5, color: '#4c5a3a', mat: 'steel', desc: '旧式の鋼鉄製ヘルメット。' });
helmet('hm_6b47', '6B47 ラトニク', '6B47', { cls: 3, dur: 45, value: 30000, rarity: 1, weight: 1.3, color: '#5c6447', desc: '軍用のアラミドヘルメット。' });
helmet('hm_tc800', 'TC-800 ハイカット', 'TC800', { cls: 4, dur: 30, value: 62000, rarity: 2, weight: 1.2, color: '#3b3d33', ric: 0.3, mat: 'uhmwpe', desc: '軽量な高性能ヘルメット。' });
helmet('hm_ulach', 'ULACH IIIA', 'ULACH', { cls: 4, dur: 50, value: 84000, rarity: 2, weight: 1.6, color: '#2a2a2a', desc: '防御範囲の広い軍用ヘルメット。' });
helmet('hm_vector', 'ベクター 戦術ヘルメット', 'VECTOR', { cls: 4, dur: 40, value: 72000, rarity: 2, weight: 1.3, color: '#6a5a3a', ric: 0.35, desc: 'ヘッドセット対応の戦術ヘルメット。' });
helmet('hm_exfil', 'エクスフィル ボールティック', 'EXFIL', { cls: 5, dur: 40, value: 160000, rarity: 3, weight: 1.4, color: '#1e1e1e', ric: 0.4, mat: 'uhmwpe', desc: '特殊部隊仕様のクラス5ヘルメット。' });
helmet('hm_altyn', 'アルティン 重ヘルメット', 'ALTYN', { cls: 5, dur: 80, value: 210000, rarity: 4, weight: 4.0, color: '#4a5a3a', ergo: -8, face: true, mat: 'titan', desc: 'フェイスシールド付きのチタン製重ヘルメット。' });
helmet('hm_bomb', '爆発物処理ヘルメット', 'EOD', { cls: 6, dur: 45, value: 280000, rarity: 4, weight: 4.5, color: '#3a4a2a', ergo: -12, face: true, mat: 'steel', desc: '視界は悪いが極めて頑丈。' });
helmet('hm_raider', 'レイダー マスクヘルム', 'RAIDER', { cls: 4, dur: 55, value: 120000, rarity: 3, weight: 1.8, color: '#7a2a20', face: true, ric: 0.3, desc: '荒野のレイダーたちが好むマスク一体型ヘルメット。' });

// ---------------------------------------------------------------- リグ / バックパック / セキュアコンテナ
function rig(id, name, short, grids, o) {
  return add({
    id, name, short, cat: 'rig', sub: o.armor ? 'armored_rig' : 'rig', w: o.w || 2, h: o.h || 2,
    value: o.value, rarity: o.rarity ?? 1, weight: o.weight, stack: 1, icon: 'rig', color: o.color || '#4a4f3a',
    loot: o.loot || ['military'], desc: o.desc, grids,
    armor: o.armor || null,
  });
}
rig('rig_scav', 'スカベンジャーベスト', 'スカベ', [[1, 2], [1, 2], [1, 2], [1, 2]], { value: 6000, rarity: 0, weight: 0.6, color: '#5a4a3a', loot: ['industrial', 'residential', 'military'], desc: '簡素なポケット付きベスト。' });
rig('rig_bank', 'バンクロバー チェストリグ', 'バンク', [[1, 2], [1, 2], [2, 2], [1, 1], [1, 1]], { value: 9000, rarity: 0, weight: 0.7, color: '#3a3a3a', desc: '軽量なチェストリグ。' });
rig('rig_micro', 'マイクロ チェストリグ', 'マイクロ', [[1, 2], [1, 2], [1, 2], [1, 1], [1, 1], [1, 1]], { value: 14000, rarity: 1, weight: 0.5, color: '#56603f', desc: '小型で動きを妨げないリグ。' });
rig('rig_alpha', 'アルファ タクティカルリグ', 'アルファ', [[1, 2], [1, 2], [1, 2], [1, 2], [2, 2], [1, 1], [1, 1]], { value: 26000, rarity: 1, weight: 0.9, color: '#6a5a3a', desc: '容量の多い戦術リグ。' });
rig('rig_thunder', 'サンダーボルト リグ', 'サンダ', [[1, 2], [1, 2], [1, 2], [1, 2], [2, 2], [2, 2]], { value: 42000, rarity: 2, weight: 1.1, color: '#2e2e2a', desc: '大型ポーチを持つ高容量リグ。' });
rig('rig_mmac', 'MMAC チェストリグ', 'MMAC', [[1, 2], [1, 2], [1, 2], [1, 2], [1, 2], [1, 2], [1, 1], [1, 1]], { value: 52000, rarity: 2, weight: 1.0, color: '#3b4a5a', desc: '6つのマガジンポーチを持つリグ。' });
rig('rig_belt', 'ベルトAリグ', 'ベルト', [[1, 2], [1, 2], [1, 1], [1, 1], [2, 1]], { value: 11000, rarity: 0, weight: 0.4, color: '#4a3a2a', desc: '腰に巻くタイプの軽量リグ。' });
rig('rig_6b5', '6B5 アーマーリグ', '6B5', [[1, 2], [1, 2], [1, 2], [1, 1], [1, 1]], { value: 74000, rarity: 2, weight: 7.5, color: '#4c5a3a', w: 3, h: 3, armor: { cls: 3, dur: 55, zones: ['thorax', 'stomach'], speed: 0.04, ergo: -4, mat: 'steel' }, desc: '装甲を内蔵したリグ。防具と併用不可。' });
rig('rig_avs', 'AVS アーマーリグ', 'AVS', [[1, 2], [1, 2], [1, 2], [1, 2], [2, 2], [1, 1]], { value: 210000, rarity: 4, weight: 8.0, color: '#7a6a4a', w: 3, h: 3, armor: { cls: 5, dur: 60, zones: ['thorax', 'stomach'], speed: 0.05, ergo: -6, mat: 'ceramic' }, desc: 'クラス5プレート入りのアーマーリグ。' });
rig('rig_raider', 'レイダー ハーネス', 'ハーネス', [[2, 2], [2, 2], [1, 2], [1, 2], [1, 1], [1, 1]], { value: 64000, rarity: 3, weight: 1.2, color: '#7a2a20', desc: 'レイダーが改造した大容量ハーネス。' });

function backpack(id, name, short, gw, gh, o) {
  return add({
    id, name, short, cat: 'backpack', sub: 'backpack', w: o.w, h: o.h,
    value: o.value, rarity: o.rarity ?? 1, weight: o.weight, stack: 1, icon: 'backpack', color: o.color || '#4a4f3a',
    loot: o.loot || ['military', 'residential'], desc: o.desc, grids: [[gw, gh]],
    speed: o.speed || 0,
  });
}
backpack('bp_sling', 'スリングバッグ', 'スリング', 2, 2, { w: 2, h: 2, value: 5000, rarity: 0, weight: 0.3, color: '#3a3a3a', desc: '小さなショルダーバッグ。' });
backpack('bp_duffle', 'ずた袋', 'ずた袋', 3, 3, { w: 3, h: 3, value: 9000, rarity: 0, weight: 0.6, color: '#6a5a3a', loot: ['industrial', 'residential'], desc: '粗末だが容量はそこそこ。' });
backpack('bp_day', 'デイパック', 'デイ', 4, 4, { w: 3, h: 4, value: 18000, rarity: 0, weight: 0.8, color: '#2a4c6a', loot: ['residential', 'office'], desc: '一般的なデイパック。' });
backpack('bp_scav', 'スカベンジャー バックパック', 'スカベ', 4, 5, { w: 4, h: 4, value: 26000, rarity: 1, weight: 1.0, color: '#56603f', desc: '使い込まれた軍用バックパック。' });
backpack('bp_assault', 'アサルトパック', 'アサルト', 5, 5, { w: 4, h: 5, value: 42000, rarity: 1, weight: 1.2, color: '#3b3d33', desc: '戦闘向けの中型バックパック。' });
backpack('bp_trizip', 'トライジップ', 'トライ', 5, 6, { w: 4, h: 5, value: 64000, rarity: 2, weight: 1.6, color: '#7a6a4a', desc: '大容量の3気室バックパック。' });
backpack('bp_beta2', 'ベータ2 バトルパック', 'ベータ2', 6, 6, { w: 5, h: 5, value: 92000, rarity: 3, weight: 2.0, color: '#2e2e2a', speed: 0.02, desc: '大型の軍用バックパック。' });
backpack('bp_raid', 'レイド 長距離リュック', 'レイド', 6, 7, { w: 5, h: 6, value: 140000, rarity: 3, weight: 2.4, color: '#4c5a3a', speed: 0.03, desc: '長期作戦用の超大型リュック。' });
backpack('bp_attack', 'アタック2 リュック', 'アタック', 5, 7, { w: 5, h: 6, value: 120000, rarity: 3, weight: 2.2, color: '#5a5040', speed: 0.025, desc: '縦長の大容量リュック。' });
backpack('bp_raider', 'レイダー カーゴパック', 'カーゴ', 7, 7, { w: 6, h: 6, value: 230000, rarity: 4, weight: 3.0, color: '#7a2a20', speed: 0.04, loot: ['military', 'valuable'], desc: '略奪品を詰め込むための巨大な背負子。' });

function secure(id, name, short, gw, gh, o) {
  return add({
    id, name, short, cat: 'secure', sub: 'secure', w: o.w, h: o.h,
    value: o.value, rarity: o.rarity, weight: 1, stack: 1, icon: 'case', color: o.color,
    loot: [], desc: o.desc + ' 死亡しても中身は失われない。', grids: [[gw, gh]], noLoot: true,
  });
}
secure('sc_alpha', 'セキュアコンテナ アルファ', 'アルファ', 2, 2, { w: 2, h: 2, value: 100000, rarity: 2, color: '#3a3a3a', desc: '2x2の小型セキュアコンテナ。' });
secure('sc_beta', 'セキュアコンテナ ベータ', 'ベータ', 3, 2, { w: 3, h: 2, value: 250000, rarity: 3, color: '#3a4a5a', desc: '3x2のセキュアコンテナ。' });
secure('sc_gamma', 'セキュアコンテナ ガンマ', 'ガンマ', 3, 3, { w: 3, h: 3, value: 600000, rarity: 4, color: '#4a3a5a', desc: '3x3のセキュアコンテナ。' });
secure('sc_kappa', 'セキュアコンテナ カッパ', 'カッパ', 4, 4, { w: 3, h: 4, value: 1500000, rarity: 5, color: '#6a5a20', desc: '4x4の最高級セキュアコンテナ。' });

// ---------------------------------------------------------------- 医薬品
// heal: 合計回復量, rate: 毎秒, bleed/heavy/fracture: 治療可否, pain: 鎮痛秒, use: 使用時間, uses: 使用回数
function med(id, name, short, o) {
  return add({
    id, name, short, cat: 'med', sub: o.sub || 'medkit', w: o.w || 1, h: o.h || 1,
    value: o.value, rarity: o.rarity ?? 0, weight: o.weight ?? 0.2, stack: o.stack || 1, icon: o.icon || 'medkit', color: o.color || '#b03030',
    loot: o.loot || ['medical'], desc: o.desc,
    med: { heal: o.heal || 0, bleed: !!o.bleed, heavy: !!o.heavy, fracture: !!o.fracture, restore: !!o.restore, pain: o.pain || 0, use: o.use || 3, uses: o.uses || 1, stim: o.stim || null, energy: o.energy || 0, hydration: o.hydration || 0 },
  });
}
med('bandage', '包帯', '包帯', { sub: 'bandage', icon: 'bandage', bleed: true, use: 2.5, uses: 2, value: 3000, color: '#e6e0d0', loot: ['medical', 'residential', 'military'], desc: '軽い出血を止める。' });
med('bandage_army', '軍用包帯', '軍包帯', { sub: 'bandage', icon: 'bandage', bleed: true, use: 2, uses: 3, value: 4500, color: '#7a8a5a', loot: ['medical', 'military'], desc: '軽い出血を止める。使用回数が多い。' });
med('tourniquet', '止血帯 CAT', '止血帯', { sub: 'tourniquet', icon: 'tourniquet', heavy: true, use: 3, uses: 1, value: 9000, rarity: 1, color: '#2a2a2a', loot: ['medical', 'military'], desc: '激しい出血を止める。' });
med('hemostat', '止血剤 ジェル', '止血剤', { sub: 'tourniquet', icon: 'syringe', heavy: true, bleed: true, use: 2, uses: 1, value: 22000, rarity: 2, color: '#c86a2a', desc: '全ての出血を止める注入型止血剤。' });
med('splint', '添え木', '添え木', { sub: 'splint', icon: 'splint', fracture: true, use: 5, uses: 1, value: 4000, color: '#a08050', loot: ['medical', 'industrial', 'residential'], desc: '骨折を固定する。' });
med('splint_alu', 'アルミ製スプリント', 'Alスプ', { sub: 'splint', icon: 'splint', fracture: true, use: 4, uses: 5, value: 18000, rarity: 2, color: '#a0a0b0', desc: '繰り返し使える骨折用スプリント。' });
med('medkit_ai2', '応急キット AI-2', 'AI-2', { heal: 100, rate: 30, use: 2, uses: 1, value: 5000, color: '#d04020', loot: ['medical', 'residential', 'military'], desc: '小型の応急キット。HPを100回復。' });
med('medkit_car', '車載救急キット', '車載', { heal: 220, bleed: true, use: 3, uses: 1, w: 2, value: 12000, color: '#c8c8c8', loot: ['medical', 'industrial', 'residential'], desc: 'HPを220回復し、軽い出血を止める。' });
med('medkit_salewa', 'サレワ 救急キット', 'サレワ', { heal: 400, bleed: true, heavy: true, use: 3, uses: 1, h: 2, value: 26000, rarity: 1, color: '#d03a3a', desc: 'HPを400回復し、出血を止める。' });
med('medkit_ifak', 'IFAK 個人救急キット', 'IFAK', { heal: 300, bleed: true, heavy: true, use: 3, uses: 1, value: 30000, rarity: 2, color: '#56603f', loot: ['medical', 'military'], desc: 'コンパクトな軍用救急キット。' });
med('medkit_afak', 'AFAK 戦術救急キット', 'AFAK', { heal: 400, bleed: true, heavy: true, use: 2.5, uses: 1, value: 42000, rarity: 3, color: '#3a3a3a', loot: ['medical', 'military'], desc: '高性能な戦術救急キット。' });
med('medkit_grizzly', 'グリズリー 医療キット', 'グリズ', { heal: 1500, bleed: true, heavy: true, fracture: true, use: 5, uses: 1, w: 2, h: 2, value: 68000, rarity: 3, color: '#7a2a20', desc: 'あらゆる状態異常を治療できる大型医療キット。' });
med('surgkit', 'CMS 外科キット', 'CMS', { sub: 'surgical', icon: 'surgical', restore: true, use: 14, uses: 2, w: 2, h: 1, value: 52000, rarity: 3, color: '#2a6a5a', desc: '破壊された部位を手術で修復する。' });
med('surgkit_surv', 'サバイバル外科キット', 'サバ外', { sub: 'surgical', icon: 'surgical', restore: true, use: 10, uses: 4, w: 3, h: 1, value: 110000, rarity: 4, color: '#3a5a3a', desc: '複数回使える高性能な外科キット。' });
med('painkiller', '鎮痛剤 アナルギン', '鎮痛剤', { sub: 'pills', icon: 'pills', pain: 120, use: 2, uses: 4, value: 6000, color: '#e0e0e0', loot: ['medical', 'residential', 'office'], desc: '痛みを抑える。骨折時の移動ペナルティを一時的に消す。' });
med('ibuprofen', 'イブプロフェン', 'イブ', { sub: 'pills', icon: 'pills', pain: 280, use: 2, uses: 15, value: 18000, rarity: 1, color: '#d06030', loot: ['medical', 'residential'], desc: '長時間効く鎮痛剤。' });
med('morphine', 'モルヒネ注射', 'モルヒネ', { sub: 'stim', icon: 'syringe', pain: 300, use: 1.5, uses: 1, value: 16000, rarity: 1, color: '#c8c8e8', desc: '強力な鎮痛剤。' });
med('stim_propital', 'プロペタル 再生注射', 'プロペ', { sub: 'stim', icon: 'syringe', stim: { regen: 1.5, dur: 240 }, pain: 240, use: 1.5, value: 38000, rarity: 3, color: '#3a8a3a', desc: '4分間HPを徐々に回復させる刺激剤。' });
med('stim_adren', 'アドレナリン注射', 'アドレ', { sub: 'stim', icon: 'syringe', stim: { stamina: 1.6, dur: 60 }, pain: 60, use: 1, value: 22000, rarity: 2, color: '#d0a020', desc: 'スタミナ回復を一時的に大幅に高める。' });
med('stim_etg', 'eTG-c 再生注射', 'eTG', { sub: 'stim', icon: 'syringe', stim: { regen: 6, dur: 60 }, use: 1.5, value: 72000, rarity: 4, color: '#3ac0c0', desc: '1分間急速にHPを回復させる高価な刺激剤。' });
med('stim_sj6', 'SJ6 戦闘刺激剤', 'SJ6', { sub: 'stim', icon: 'syringe', stim: { stamina: 2.2, speed: 0.1, dur: 240 }, use: 1.5, value: 68000, rarity: 4, color: '#c03030', desc: '4分間スタミナと移動速度を大きく強化する。' });
med('stim_obdo', 'OBDOLBOS 混合剤', 'OBDO', { sub: 'stim', icon: 'syringe', stim: { regen: 2, stamina: 1.5, speed: 0.05, dur: 600 }, pain: 600, use: 2, value: 160000, rarity: 5, color: '#8a3ac0', desc: '効果も副作用も未知数の怪しいカクテル。' });

// ---------------------------------------------------------------- 食料
function food(id, name, short, o) {
  return add({
    id, name, short, cat: 'food', sub: o.drink ? 'drink' : 'food', w: o.w || 1, h: o.h || 1,
    value: o.value, rarity: o.rarity ?? 0, weight: o.weight ?? 0.4, stack: 1, icon: o.icon, color: o.color,
    loot: o.loot || ['food', 'residential'], desc: o.desc,
    med: { energy: o.e || 0, hydration: o.hy || 0, use: o.use || 4, uses: 1, heal: 0, stim: o.stim || null },
  });
}
food('water', '飲料水ボトル', '水', { drink: true, hy: 60, value: 6000, icon: 'water', color: '#4a9ad0', h: 2, desc: '0.6Lの飲料水。', loot: ['food', 'residential', 'military', 'industrial'] });
food('juice', 'オレンジジュース', 'ジュース', { drink: true, hy: 45, e: 10, value: 5000, icon: 'bottle', color: '#e09020', h: 2, desc: '甘いジュース。' });
food('energy_drink', 'ハイパーブースト', 'ブースト', { drink: true, hy: 25, e: 20, value: 7000, icon: 'energy_drink', color: '#2ad04a', stim: { stamina: 1.2, dur: 60 }, desc: '一時的にスタミナ回復が早くなるエナジードリンク。' });
food('milk', '濃縮ミルク', 'ミルク', { drink: true, hy: 20, e: 25, value: 4500, icon: 'can', color: '#e8e8e0', desc: '加糖練乳の缶。' });
food('soda', '炭酸水', '炭酸', { drink: true, hy: 35, value: 3000, icon: 'can', color: '#3a6ad0', desc: 'ぬるい炭酸水。' });
food('coffee', '缶コーヒー', 'コーヒー', { drink: true, hy: 20, e: 8, value: 3500, icon: 'can', color: '#6a3a1a', desc: '眠気覚ましの缶コーヒー。' });
food('tea', '緑茶ボトル', '緑茶', { drink: true, hy: 50, value: 4800, icon: 'bottle', color: '#5a8a3a', h: 2, desc: 'ペットボトルの緑茶。' });
food('can_beef', '牛肉の缶詰', '牛肉缶', { e: 55, hy: -8, value: 7000, icon: 'can', color: '#8a3a2a', desc: '大きな牛肉の缶詰。' });
food('can_fish', 'サバの缶詰', 'サバ缶', { e: 40, hy: -5, value: 5000, icon: 'can', color: '#3a6a8a', desc: 'オイル漬けのサバ。' });
food('can_peas', 'えんどう豆の缶詰', '豆缶', { e: 30, hy: -2, value: 3500, icon: 'can', color: '#5a8a2a', desc: '茹でた豆の缶詰。' });
food('crackers', 'アーミークラッカー', 'クラッカ', { e: 20, hy: -5, value: 2500, icon: 'pack', color: '#b09060', desc: '乾燥したクラッカー。' });
food('chocolate', 'チョコバー', 'チョコ', { e: 25, hy: -3, value: 3000, icon: 'bar', color: '#5a2a1a', desc: '甘いチョコレートバー。' });
food('mre', 'MRE 戦闘糧食', 'MRE', { e: 75, hy: -10, value: 18000, rarity: 1, icon: 'mre', color: '#6a6040', h: 2, loot: ['food', 'military'], desc: '軍用の完全食パック。' });
food('jam', 'ジャムの瓶', 'ジャム', { e: 35, hy: -5, value: 5500, icon: 'jar_food', color: '#a02a4a', desc: '自家製ベリージャム。' });
food('bread', '黒パン', 'パン', { e: 30, hy: -8, value: 3000, icon: 'pack', color: '#6a4a2a', desc: '固いライ麦パン。' });
food('noodles', 'インスタント麺', '麺', { e: 28, hy: -10, value: 3200, icon: 'pack', color: '#d06030', desc: 'お湯がなくても食べられなくはない。' });
food('honey', 'ハチミツ', 'ハチミツ', { e: 40, hy: -2, value: 9000, rarity: 1, icon: 'jar_food', color: '#d0a020', desc: '栄養豊富な天然ハチミツ。' });
food('ration_arc', 'レイダー保存食', '保存食', { e: 60, hy: 20, value: 14000, rarity: 2, icon: 'mre', color: '#7a2a20', h: 2, desc: 'レイダーの隠れ家で作られた保存食。水分も補える。' });

// ---------------------------------------------------------------- 投擲物
function grenade(id, name, short, o) {
  return add({
    id, name, short, cat: 'grenade', sub: o.type, w: 1, h: 1,
    value: o.value, rarity: o.rarity ?? 1, weight: 0.5, stack: 1, icon: 'grenade', color: o.color,
    loot: ['military'], desc: o.desc,
    grenade: { type: o.type, fuse: o.fuse ?? 3.5, radius: o.radius ?? 7, damage: o.damage ?? 0, frags: o.frags ?? 0 },
  });
}
grenade('gr_f1', 'F-1 破片手榴弾', 'F-1', { type: 'frag', fuse: 3.6, radius: 9, damage: 160, frags: 50, value: 14000, color: '#4c5a3a', desc: '破片を広範囲に撒き散らす防御用手榴弾。' });
grenade('gr_rgd5', 'RGD-5 手榴弾', 'RGD5', { type: 'frag', fuse: 3.4, radius: 7, damage: 140, frags: 35, value: 11000, color: '#5c6447', desc: '標準的な攻撃用手榴弾。' });
grenade('gr_m67', 'M67 破片手榴弾', 'M67', { type: 'frag', fuse: 4.5, radius: 8, damage: 180, frags: 45, value: 22000, rarity: 2, color: '#3a4a2a', desc: '炸薬量の多い破片手榴弾。' });
grenade('gr_flash', 'フラッシュバン', 'FLASH', { type: 'flash', fuse: 2.0, radius: 12, value: 16000, rarity: 1, color: '#2a2a2a', desc: '強烈な閃光と爆音で視覚と聴覚を奪う。' });
grenade('gr_smoke', 'スモークグレネード', 'SMOKE', { type: 'smoke', fuse: 1.5, radius: 6, value: 8000, rarity: 0, color: '#c8c8c8', desc: '濃い煙幕を展開する。' });
grenade('gr_emp', 'EMPグレネード', 'EMP', { type: 'emp', fuse: 2.5, radius: 10, damage: 220, value: 48000, rarity: 3, color: '#2fb6d8', loot: ['machine'], desc: 'ARC機械の回路を焼き切る電磁パルス弾。人間には無害。' });

// ---------------------------------------------------------------- 鍵・キーカード（マップの扉と対応）
function key(id, name, short, door, o) {
  return add({
    id, name, short, cat: 'key', sub: o.card ? 'keycard' : 'key', w: 1, h: 1,
    value: o.value, rarity: o.rarity ?? 1, weight: 0.05, stack: 1, icon: o.card ? 'keycard' : 'key', color: o.color || (o.card ? '#c03030' : '#b0a080'),
    loot: o.loot || ['office', 'residential', 'industrial'], desc: o.desc, key: { door },
  });
}
key('key_office', '工場事務所の鍵', '事務所', 'factory_office', { value: 18000, rarity: 1, loot: ['industrial', 'office'], desc: '工場2階の事務所を開ける鍵。' });
key('key_control', '制御室の鍵', '制御室', 'control_room', { value: 42000, rarity: 2, loot: ['industrial', 'office'], desc: '工場の制御室の鍵。ゲート電源のスイッチがある。' });
key('key_pharmacy', '薬局 倉庫の鍵', '薬局', 'pharmacy_back', { value: 36000, rarity: 2, loot: ['medical', 'residential'], desc: '薬局の奥にある倉庫の鍵。医療品が眠っている。' });
key('key_market', 'スーパー 金庫室の鍵', '金庫室', 'market_safe', { value: 52000, rarity: 2, loot: ['residential', 'office'], desc: 'スーパーマーケットの金庫室の鍵。' });
key('key_apt12', 'アパート 12号室の鍵', '12号室', 'apt_12', { value: 14000, rarity: 1, loot: ['residential'], desc: '住宅街アパートの一室の鍵。' });
key('key_apt21', 'アパート 21号室の鍵', '21号室', 'apt_21', { value: 16000, rarity: 1, loot: ['residential'], desc: '住宅街アパート2階の部屋の鍵。' });
key('key_gas', 'ガソリンスタンド 事務所の鍵', 'GS事務', 'gas_office', { value: 12000, rarity: 0, loot: ['industrial', 'residential'], desc: 'ガソリンスタンドの事務所の鍵。' });
key('key_motel', 'モーテル 7号室の鍵', 'モーテル', 'motel_7', { value: 20000, rarity: 1, loot: ['residential'], desc: 'モーテルの一室の鍵。誰かが何かを隠していたらしい。' });
key('key_armory', '武器庫の鍵', '武器庫', 'armory', { value: 160000, rarity: 4, loot: ['military'], desc: '軍事基地の武器庫を開ける鍵。' });
key('key_bunker', '指揮バンカーの鍵', 'バンカー', 'bunker', { value: 120000, rarity: 3, loot: ['military'], desc: '地下指揮バンカーの鍵。' });
key('key_dock', '埠頭 倉庫の鍵', '埠頭倉庫', 'dock_ware', { value: 30000, rarity: 1, loot: ['industrial'], desc: '港の倉庫の鍵。' });
key('key_tower', '無線塔 機器室の鍵', '無線塔', 'radio_room', { value: 48000, rarity: 2, loot: ['tech', 'industrial'], desc: '無線塔の機器室の鍵。' });
key('card_blue', 'ブルー キーカード', 'BLUE', 'lab_blue', { card: true, value: 120000, rarity: 3, color: '#2a6ad0', loot: ['tech', 'office'], desc: '研究所 1 階のブルー区画（居住）を開くキーカード。研究員の金庫・武器ケース・研究用ケースがある。' });
key('card_red', 'レッド キーカード', 'RED', 'lab_red', { card: true, value: 380000, rarity: 4, color: '#d02a2a', loot: ['tech', 'valuable'], desc: '研究所の機密保管室を開くキーカード。' });
key('card_black', 'ブラック キーカード', 'BLACK', 'lab_exit', { card: true, value: 260000, rarity: 4, color: '#1a1a1a', loot: ['tech', 'military'], desc: '研究所 2 階のブラック区画（試作兵器庫）を開き、地下エレベーター（脱出口）も起動できるキーカード。' });
key('card_green', 'グリーン キーカード', 'GREEN', 'lab_green', { card: true, value: 90000, rarity: 3, color: '#2ad04a', loot: ['tech', 'medical'], desc: '研究所 1 階のグリーン区画（医療研究）を開くキーカード。研究用ケース・医療ケース・金庫がある。' });

// ---------------------------------------------------------------- 通貨
add({ id: 'credits', name: 'クレジット', short: 'C', cat: 'money', sub: 'money', w: 1, h: 1, value: 1, rarity: 0, weight: 0, stack: 500000, icon: 'money', color: '#c8b060', loot: ['office', 'residential', 'valuable'], desc: 'この地域で流通している通貨。売却額そのまま。', valuePerUnit: true });

export const CORE_ITEMS = out;
