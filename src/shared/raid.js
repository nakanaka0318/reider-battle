// レイドシミュレーション（ホスト権威）。オンラインでは Node サーバー、オフラインではブラウザ内で動作する。
import { buildMap } from './map.js';
import { World } from './world.js';
import { makeRng, dirFromYawPitch, vdist, vnorm } from './math.js';
import { ITEMS, createItem, weaponStats, pickLootItem, lootInstance, CONTAINERS, modFits, itemValue, slotAccepts } from './items.js';
import { newGrid, autoInsert, autoEquipOrInsert, moveItem, findItem, removeItem, countAmmo, takeAmmo, allItems, rootWeight, newActorInv } from './inventory.js';
import { newHealth, damageHuman, humanZone, humanHeight, HUMAN_R, rayCylinder, raySphere, tickHealth, applyMed, totalHp, TOTAL_HP, PARTS, applyPartDamage } from './combat.js';
import { MACHINES, generateLoadout, botName, machineLoot } from './bots.js';
import { applyOp } from './invops.js';
import { aiThink, aiUpdate, initAI, aiOnDamage, aiOnNoise } from './ai.js';

export const TICK = 1 / 30;
const HUMAN_KINDS = new Set(['player', 'raider', 'scav', 'boss', 'guard']);

export class Raid {
  constructor(opts = {}) {
    this.opts = {
      mode: 'pvpve', timeOfDay: 'day', duration: 30 * 60, raiders: 6, scavs: 1, machines: 1, seed: (Math.random() * 1e9) | 0,
      ...opts,
    };
    this.seed = this.opts.seed;
    this.rng = makeRng(this.seed);
    this.map = buildMap(1337);
    this.world = new World(this.map);
    this.time = 0;
    this.timeLeft = this.opts.duration;
    this.actors = new Map();
    this.nextId = 1;
    this.containers = new Map();
    for (const c of this.map.containers) this.containers.set(c.id, { ...c, root: null, looted: false });
    this.ground = new Map();
    this.grenades = [];
    this.smokes = [];
    this.noises = [];
    this.clients = new Map();
    this.events = [];
    this.feed = [];
    this.ended = false;
    this.unlocked = new Set();
    this.extracts = this.map.extracts.map((e) => ({ ...e, open: e.type !== 'switch' && (e.type !== 'random' || this.rng() < (e.chance ?? 0.5)) }));
    this.pathBudget = 0;
    this.spawnPoints = this.genSpawnPoints();
    this.spawnLoose();
    this.spawnNPCs();
    this.lateSpawns = [];
    this.nextScavWave = 300 + this.rng() * 120;
  }

  // ---------------------------------------------------------------- 生成
  // マップ外周に沿って、危険地帯から離れたスポーン候補を作る
  genSpawnPoints() {
    const out = [];
    const H = this.map.half - 14;
    const ok = (x, z) => {
      if (!this.world.walkable(x, z)) return false;
      for (const zn of this.map.scavZones) if (Math.hypot(zn.x - x, zn.z - z) < zn.r + 32) return false;
      for (const zn of this.map.machineZones) if (Math.hypot(zn.x - x, zn.z - z) < zn.r + (zn.heavy ? 60 : 12)) return false;
      if (z > this.map.water.z - 8) return false;
      return true;
    };
    for (let t = -H; t <= H; t += 12) {
      for (const [x, z] of [[t, -H], [t, Math.min(H, this.map.water.z - 10)], [-H, t], [H, t]]) {
        if (!ok(x, z)) continue;
        out.push({ x, z, yaw: Math.atan2(x, z) }); // 中心を向く
      }
    }
    return out.length >= 6 ? out : this.map.spawns;
  }

  spawnLoose() {
    const rng = this.rng;
    for (const s of this.map.loose) {
      if (rng() > 0.42) continue;
      const def = pickLootItem(rng, s.tags, null, 1);
      if (!def || def.cat === 'secure') continue;
      if (def.w * def.h > 6) continue;
      this.addGround(lootInstance(rng, def), s.x + (rng() - 0.5) * 0.3, s.y, s.z + (rng() - 0.5) * 0.3, false);
    }
  }

  addGround(item, x, y, z, broadcast = true) {
    const id = 'g' + (this.nextId++);
    const g = { id, item, x, y, z, rot: Math.random() * 6.28 };
    this.ground.set(id, g);
    if (broadcast) this.emit({ t: 'gadd', g: groundMsg(g) });
    return g;
  }

  spawnNPCs() {
    const rng = this.rng, o = this.opts;
    // スカブ
    for (const z of this.map.scavZones) {
      const n = Math.round(z.n * o.scavs);
      for (let i = 0; i < n; i++) {
        const p = this.randomPointIn(z.x, z.z, z.r);
        if (p) this.spawnBot('scav', p, { zone: z });
      }
      if (z.boss && rng() < 0.75) {
        const p = this.randomPointIn(-94, -138, 6) || { x: -94, z: -138 };
        const boss = this.spawnBot('boss', p, { zone: { x: -94, z: -140, r: 25 } });
        for (let k = 0; k < 2; k++) {
          const q = this.randomPointIn(p.x, p.z, 6) || p;
          this.spawnBot('guard', q, { zone: { x: -94, z: -140, r: 25 }, leader: boss.id });
        }
      }
    }
    // ARC 機械
    for (const z of this.map.machineZones) {
      const n = Math.round(z.n * o.machines);
      for (let i = 0; i < n; i++) {
        const p = this.randomPointIn(z.x, z.z, z.r);
        if (!p) continue;
        const t = rng() < 0.55 ? 'wasp' : rng() < 0.6 ? 'tick' : 'hornet';
        this.spawnMachine(t, p, z);
      }
      for (let i = 0; i < Math.round((z.heavy || 0) * Math.min(1, o.machines)); i++) {
        const p = this.randomPointIn(z.x, z.z, z.r * 0.6);
        if (p) this.spawnMachine('sentinel', p, z);
      }
    }
    // AI レイダー（オフラインは全員 NPC）
    const spawns = [...this.spawnPoints].sort(() => rng() - 0.5);
    const usedSp = [];
    const farSpawn = () => {
      let best = spawns[0], bd = -1;
      for (const s of spawns) {
        let md = 1e9;
        for (const u of usedSp) md = Math.min(md, Math.hypot(u.x - s.x, u.z - s.z));
        for (const z of this.map.scavZones) md = Math.min(md, (Math.hypot(z.x - s.x, z.z - s.z) - z.r) * 1.5);
        for (const z of this.map.machineZones) if (z.heavy) md = Math.min(md, (Math.hypot(z.x - s.x, z.z - s.z) - z.r - 60) * 1.5);
        md += rng() * 15;
        if (md > bd) { bd = md; best = s; }
      }
      usedSp.push(best);
      return best;
    };
    for (let i = 0; i < o.raiders; i++) {
      const sp = farSpawn();
      const tier = rng() < 0.35 ? 'raider1' : rng() < 0.8 ? 'raider2' : 'raider2';
      const delay = i < Math.ceil(o.raiders * 0.5) ? 0 : 45 + rng() * 420;
      const spawn = () => {
        const p = this.world.nearestWalkable(sp.x + (rng() - 0.5) * 6, sp.z + (rng() - 0.5) * 6, 8) || sp;
        this.spawnBot('raider', p, { tier, yaw: sp.yaw });
      };
      if (delay === 0) spawn(); else (this.lateSpawnsInit ||= []).push({ t: delay, fn: spawn });
    }
  }

  randomPointIn(x, z, r) {
    for (let i = 0; i < 30; i++) {
      const a = this.rng() * Math.PI * 2, d = Math.sqrt(this.rng()) * r;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (this.world.walkable(px, pz)) return { x: px, z: pz };
    }
    return null;
  }

  newActor(kind, props) {
    const id = 'a' + (this.nextId++);
    const a = {
      id, kind, name: props.name || kind, team: props.team || kind,
      pos: { x: props.x, y: props.y ?? this.world.groundAt(props.x, props.z, 50, 0.2, 100), z: props.z },
      yaw: props.yaw ?? this.rng() * Math.PI * 2, pitch: 0, crouch: false, sprint: false, ads: false, moving: false, lean: 0,
      slot: 'primary', phys: { vy: 0, onGround: true }, alive: true, light: false,
      w: { nextShot: 0, reloadUntil: 0, useUntil: 0, useItem: null, mode: 0, charge: 0 },
      stats: { kills: 0, pmcKills: 0, scavKills: 0, machineKills: 0, damage: 0, shots: 0, hits: 0, looted: 0 },
      spawnT: this.time,
      gearSig: '', lastHurt: -99, extractT: 0, extractId: null,
      ...props.extra,
    };
    this.actors.set(id, a);
    return a;
  }

  spawnBot(kind, p, opts = {}) {
    const rng = this.rng;
    const tier = kind === 'scav' ? 'scav' : kind === 'boss' ? 'boss' : kind === 'guard' ? 'guard' : opts.tier || 'raider1';
    const inv = generateLoadout(tier, rng);
    const a = this.newActor(kind, { x: p.x, z: p.z, yaw: opts.yaw, name: botName(kind, rng), team: kind === 'guard' || kind === 'boss' || kind === 'scav' ? 'scav' : 'raider_' + this.nextId });
    a.inv = inv;
    a.health = newHealth();
    if (kind === 'boss') { a.health.hp.thorax = 140; a.health.hp.head = 45; a.hpMax = { thorax: 140, head: 45 }; }
    a.slot = inv.equip.primary ? 'primary' : 'holster';
    initAI(this, a, { ...opts, tier });
    this.emitActorInfo(a);
    return a;
  }

  spawnMachine(mtype, p, zone) {
    const M = MACHINES[mtype];
    const a = this.newActor('machine', { x: p.x, z: p.z, name: M.name, team: 'machine' });
    a.mtype = mtype;
    a.mhp = { ...M.hp };
    a.pos.y = this.world.groundAt(p.x, p.z, 50, 0.2, 100) + (M.fly || 0);
    a.lootRoot = null;
    initAI(this, a, { zone });
    this.emitActorInfo(a);
    return a;
  }

  // ---------------------------------------------------------------- クライアント
  addClient(cid, profile, send) {
    // 他のプレイヤー・NPC から最も離れたスポーン地点を選ぶ
    const others = [...this.actors.values()].filter((a) => a.alive);
    const spawns = [...this.spawnPoints].sort(() => this.rng() - 0.5);
    let sp = spawns[0], best = -1;
    for (const s of spawns) {
      let md = 1e9;
      for (const u of others) {
        const w = u.kind === 'player' || u.kind === 'raider' ? 1 : u.mtype === 'sentinel' ? 2.5 : 1.6;
        md = Math.min(md, Math.hypot(u.pos.x - s.x, u.pos.z - s.z) / w);
      }
      md += this.rng() * 10;
      if (md > best) { best = md; sp = s; }
    }
    const p = this.world.nearestWalkable(sp.x, sp.z, 6) || sp;
    const a = this.newActor('player', { x: p.x, z: p.z, yaw: sp.yaw, name: profile.name || 'プレイヤー', team: 'player_' + cid });
    a.inv = profile.inv || newActorInv();
    a.health = newHealth();
    if (profile.health) { a.health.energy = profile.health.energy ?? 100; a.health.hydration = profile.health.hydration ?? 100; }
    a.slot = a.inv.equip.primary ? 'primary' : a.inv.equip.secondary ? 'secondary' : 'holster';
    a.cid = cid;
    const c = { cid, actorId: a.id, send, viewing: null, invDirty: true, knownInfo: new Set(), level: profile.level || 1 };
    this.clients.set(cid, c);
    for (const it of allItems(a.inv)) delete it.fir;
    send({
      t: 'welcome', you: a.id, seed: this.seed, mode: this.opts.mode, timeOfDay: this.opts.timeOfDay, duration: this.opts.duration,
      timeLeft: this.timeLeft, pos: a.pos, yaw: a.yaw,
      extracts: this.extracts.map((e) => ({ id: e.id, name: e.name, x: e.x, z: e.z, r: e.r, type: e.type, open: e.open, cost: e.cost, key: e.key, desc: e.desc })),
      doors: Object.values(this.world.doors).map((d) => ({ id: d.id, open: d.open, locked: d.locked && !this.unlocked.has(d.id) ? d.locked : null })),
      ground: [...this.ground.values()].map(groundMsg),
      looted: [...this.containers.values()].filter((x) => x.looted).map((x) => x.id),
      bodies: [...this.actors.values()].filter((x) => !x.alive).map((x) => x.id),
      gates: this.extracts.filter((e) => e.type === 'switch' && e.open).map((e) => e.id),
    });
    for (const o of this.actors.values()) this.sendActorInfo(c, o);
    // 途中参加者には死体も含めた全アクターの状態を送る
    send({ t: 'snap', time: r2(this.time), left: r2(this.timeLeft), a: [...this.actors.values()].map((o) => this.snapEntry(o)), n: [], ev: [] });
    this.emit({ t: 'feed', msg: `${a.name} がレイドに参加した`, kind: 'join' });
    return a;
  }

  removeClient(cid) {
    const c = this.clients.get(cid);
    if (!c) return;
    const a = this.actors.get(c.actorId);
    if (a && a.alive && !a.extracted) {
      // 切断：その場で死亡扱い（装備は残る）
      this.kill(a, null, 'disconnect');
    }
    this.clients.delete(cid);
  }

  emit(ev) { this.events.push(ev); }
  sendTo(a, msg) {
    if (!a.cid) return;
    const c = this.clients.get(a.cid);
    if (c) c.send(msg);
  }

  actorInfo(a) {
    const e = a.inv?.equip || {};
    const w = e[a.slot];
    return {
      t: 'ainfo', id: a.id, kind: a.kind, mtype: a.mtype, name: a.name, team: a.team,
      helmet: e.helmet?.id || null, armor: e.armor?.id || null, rig: e.rig?.id || null, backpack: e.backpack?.id || null,
      weapon: w?.id || null, mods: w?.mods ? Object.fromEntries(Object.entries(w.mods).map(([k, v]) => [k, v?.id])) : null,
      primary: e.primary?.id || null, holster: e.holster?.id || null,
    };
  }
  emitActorInfo(a) {
    const info = this.actorInfo(a);
    a.gearSig = JSON.stringify(info);
    this.emit(info);
  }
  sendActorInfo(c, a) { c.send(this.actorInfo(a)); }

  // クライアントからのメッセージ
  handle(cid, msg) {
    const c = this.clients.get(cid);
    if (!c) return;
    const a = this.actors.get(c.actorId);
    if (!a) return;
    if (!a.alive || a.extracted) return;
    switch (msg.t) {
      case 'state': {
        const [x, y, z] = msg.p;
        const d = Math.hypot(x - a.pos.x, z - a.pos.z);
        if (d < 15) { a.pos.x = x; a.pos.y = y; a.pos.z = z; }
        a.yaw = msg.yaw; a.pitch = msg.pitch;
        a.crouch = !!msg.c; a.sprint = !!msg.s; a.ads = !!msg.ads; a.moving = !!msg.m; a.lean = msg.l || 0;
        a.light = !!msg.light;
        if (msg.slot && msg.slot !== a.slot && ['primary', 'secondary', 'holster'].includes(msg.slot)) { a.slot = msg.slot; a.w.reloadUntil = 0; }
        if (a.moving) {
          const nl = a.sprint ? 22 : a.crouch ? 4 : 10;
          if (this.time - (a.lastStepNoise || 0) > 0.6) { a.lastStepNoise = this.time; this.noise(a.pos, nl, a, 'step'); }
          if (a.w.useItem && a.sprint) this.cancelUse(a);
        }
        break;
      }
      case 'fire': {
        const o = { x: msg.o[0], y: msg.o[1], z: msg.o[2] };
        if (vdist(o, { x: a.pos.x, y: a.pos.y + 1.5, z: a.pos.z }) > 3) return;
        this.fireWeapon(a, o, vnorm({ x: msg.d[0], y: msg.d[1], z: msg.d[2] }));
        break;
      }
      case 'reload': this.startReload(a, msg.ammo); break;
      case 'mode': {
        const w = a.inv.equip[a.slot];
        if (w) { const modes = ITEMS[w.id].weapon.modes; a.w.mode = (a.w.mode + 1) % modes.length; }
        break;
      }
      case 'use': this.startUse(a, msg.uid); break;
      case 'cancelUse': this.cancelUse(a); break;
      case 'interact': this.interact(a, c, msg); break;
      case 'inv': this.invOp(a, c, msg); break;
      case 'drop': {
        const it = removeItem(a.inv, msg.uid);
        if (it) {
          const f = dirFromYawPitch(a.yaw, 0);
          this.addGround(it, a.pos.x + f.x * 0.8, this.world.groundAt(a.pos.x + f.x * 0.8, a.pos.z + f.z * 0.8, a.pos.y + 0.5), a.pos.z + f.z * 0.8);
          this.markDirty(a);
        }
        break;
      }
      case 'pickup': this.pickup(a, msg.id); break;
      case 'throw': this.throwGrenade(a, msg); break;
      case 'closeLoot': c.viewing = null; break;
      case 'unload': {
        const f = findItem(a.inv, msg.uid);
        if (f?.item?.mag && f.item.mag.count > 0) {
          const ammoIt = createItem(f.item.mag.ammo, { count: f.item.mag.count });
          f.item.mag.count = 0;
          if (!autoInsert(a.inv, ammoIt)) this.addGround(ammoIt, a.pos.x, a.pos.y, a.pos.z);
          this.markDirty(a);
        }
        break;
      }
      case 'ping': c.send({ t: 'pong', ts: msg.ts }); break;
      case 'chat': this.emit({ t: 'feed', msg: `${a.name}: ${String(msg.text).slice(0, 80)}`, kind: 'chat' }); break;
    }
  }

  markDirty(a) {
    if (!a.cid) return;
    const c = this.clients.get(a.cid);
    if (c) c.invDirty = true;
  }

  // ---------------------------------------------------------------- 射撃
  fireWeapon(a, o, dir) {
    const w = a.inv.equip[a.slot];
    if (!w || !w.mag) return false;
    if (this.time < a.w.nextShot - 0.02 || this.time < a.w.reloadUntil) return false;
    if (a.w.useItem) this.cancelUse(a);
    const def = ITEMS[w.id], st = weaponStats(w);
    if (w.mag.count <= 0) { this.emit({ t: 'dry', id: a.id }); a.w.nextShot = this.time + 0.25; return false; }
    w.mag.count--;
    a.w.nextShot = this.time + 60 / st.rpm;
    a.stats.shots++;
    const adef = ITEMS[w.mag.ammo];
    const ammo = adef.ammo;
    const ends = [];
    let hitAny = null;
    const pellets = ammo.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      let d = dir;
      if (pellets > 1) {
        const sp = st.spread * 9 * Math.PI / 180;
        d = vnorm({ x: dir.x + (this.rng() - 0.5) * sp, y: dir.y + (this.rng() - 0.5) * sp, z: dir.z + (this.rng() - 0.5) * sp });
      }
      const r = this.traceShot(a, o, d, ammo, def.weapon.dmgMul, { weapon: def.name });
      ends.push([+(r.end.x.toFixed(2)), +(r.end.y.toFixed(2)), +(r.end.z.toFixed(2)), r.kind, r.n ? [r.n.x, r.n.y, r.n.z] : null]);
      if (r.actor) hitAny = r;
    }
    this.emit({ t: 'shot', id: a.id, o: [o.x, o.y, o.z], e: ends, cal: def.weapon.caliber, cls: def.weapon.class, sup: st.suppressed, tr: ammo.tracer, w: def.id });
    this.noise(o, st.suppressed ? 45 : def.weapon.class === 'sniper' ? 260 : 170, a, 'shot');
    if (hitAny) a.stats.hits++;
    if (a.cid && w.mag.count === 0) this.markDirty(a);
    return true;
  }

  // 弾道（ヒットスキャン）
  traceShot(shooter, o, d, ammo, dmgMul = 1, meta = {}) {
    const maxR = 500;
    const wh = this.world.raycast(o, d, maxR, { ignoreInvisible: true });
    let bestT = wh ? wh.t : maxR, best = null;
    for (const t of this.actors.values()) {
      if (t === shooter || !t.alive || t.extracted) continue;
      if (shooter.kind === 'machine' && t.kind === 'machine') continue;
      const dx = t.pos.x - o.x, dz = t.pos.z - o.z;
      if (dx * dx + dz * dz > (bestT + 5) ** 2) continue;
      if (t.kind === 'machine') {
        const M = MACHINES[t.mtype];
        for (const s of M.shapes) {
          const centers = [];
          if (s.off) { for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) centers.push({ x: t.pos.x + sx * s.off, y: t.pos.y + s.y, z: t.pos.z + sz * s.off }); }
          else if (s.back) { const f = dirFromYawPitch(t.yaw, 0); centers.push({ x: t.pos.x - f.x * s.back, y: t.pos.y + s.y, z: t.pos.z - f.z * s.back }); }
          else centers.push({ x: t.pos.x, y: t.pos.y + s.y, z: t.pos.z });
          for (const c of centers) {
            const th = raySphere(o, d, c, s.r, bestT);
            if (th !== null && th < bestT) { bestT = th; best = { actor: t, zone: s.zone }; }
          }
          if (best && best.actor === t) break; // 内側の形状を優先
        }
      } else {
        const h = humanHeight(t);
        const th = rayCylinder(o, d, t.pos.x, t.pos.z, t.pos.y, t.pos.y + h, HUMAN_R, bestT);
        if (th !== null && th < bestT) { bestT = th; best = { actor: t, zone: null }; }
      }
    }
    const end = { x: o.x + d.x * bestT, y: o.y + d.y * bestT, z: o.z + d.z * bestT };
    if (best) {
      const t = best.actor;
      const zone = best.zone || humanZone(t, end);
      const falloff = Math.max(0.55, 1 - bestT / 700);
      const res = this.hurt(t, zone, { ...ammo, damage: ammo.damage * falloff }, shooter, { dmgMul, dir: d, weapon: meta.weapon });
      return { end, kind: t.kind === 'machine' ? (res.blocked ? 'armor_m' : 'metal_hit') : res.blocked ? 'armor' : 'flesh', actor: t };
    }
    let kind = 'world';
    if (wh?.box) kind = MAT_KIND[wh.box.mat] || 'concrete';
    else if (wh?.ground) kind = 'dirt';
    return { end, kind, n: wh?.normal };
  }

  hostile(a, b) {
    if (a === b || !a.alive || !b.alive) return false;
    if (a.kind === 'machine' || b.kind === 'machine') return a.kind !== b.kind;
    if (a.team === b.team) return false;
    return true;
  }

  // ダメージ適用
  hurt(t, zone, ammo, attacker, opts = {}) {
    if (!t.alive) return { dmg: 0 };
    let res;
    if (t.kind === 'machine') {
      const M = MACHINES[t.mtype];
      const cls = M.armor[zone] ?? 2;
      let dmg = ammo.damage * (opts.dmgMul || 1);
      const p = opts.explosive ? 1 : Math.max(0.03, Math.min(0.98, 0.5 + (ammo.pen - cls * 10) / 18));
      let blocked = false;
      if (this.rng() > p) { dmg *= cls >= 4 ? 0.04 : 0.1; blocked = true; }
      if (zone === 'core') dmg *= 1.6;
      if (opts.emp) dmg = opts.emp;
      t.mhp[zone] = Math.max(0, (t.mhp[zone] ?? 0) - dmg);
      if (zone === 'leg') t.mhp.body -= dmg * 0.3;
      const killed = t.mhp.core <= 0 || t.mhp.body <= 0;
      res = { dmg, zone, blocked, killed };
    } else {
      res = damageHuman(t, zone, ammo, this.rng, opts);
    }
    t.lastHurt = this.time;
    if (attacker) {
      attacker.stats.damage += res.dmg;
      this.sendTo(attacker, { t: 'hitmark', zone: res.zone, kill: res.killed, blocked: res.blocked, armor: res.armorHit, machine: t.kind === 'machine', dmg: Math.round(res.dmg) });
    }
    if (t.cid) {
      this.sendTo(t, { t: 'hurt', zone: res.zone, dmg: Math.round(res.dmg), blocked: res.blocked, from: attacker ? [attacker.pos.x, attacker.pos.z] : null, bleed: res.bleed, fracture: res.fracture, armor: res.armorHit });
      this.markDirty(t);
    }
    if (t.ai) aiOnDamage(this, t, attacker);
    if (res.killed) this.kill(t, attacker, opts.weapon, zone);
    return res;
  }

  kill(t, killer, weapon, zone) {
    if (!t.alive) return;
    t.alive = false;
    t.deathTime = this.time;
    t.w.useItem = null;
    if (killer && killer !== t) {
      killer.stats.kills++;
      (killer.stats.killList ||= []).push(t.kind === 'machine' ? t.mtype : t.kind);
      if (t.kind === 'machine') killer.stats.machineKills++;
      else if (t.kind === 'scav' || t.kind === 'guard') killer.stats.scavKills++;
      else killer.stats.pmcKills++;
      if (t.kind === 'boss') killer.stats.bossKills = (killer.stats.bossKills || 0) + 1;
    }
    if (t.kind === 'machine') {
      t.lootRoot = { grid: newGrid(5, 4) };
      for (const it of machineLoot(t.mtype, this.rng)) autoInsert(t.lootRoot, it);
      // 地面に落下
      t.pos.y = this.world.groundAt(t.pos.x, t.pos.z, t.pos.y + 0.5, 0.3, 100);
      const M = MACHINES[t.mtype];
      if (t.mtype === 'tick' && !t.exploded) this.explode(t.pos, M.explode.radius * 0.8, M.explode.dmg * 0.6, t, 'frag');
    } else {
      t.lootRoot = t.inv;
    }
    const wname = weapon === 'disconnect' ? '切断' : weapon || '';
    this.emit({ t: 'death', id: t.id, killer: killer?.id || null, kname: killer?.name || '', vname: t.name, weapon: wname, head: zone === 'head', pos: [t.pos.x, t.pos.y, t.pos.z], yaw: t.yaw });
    this.feed.push({ k: killer?.name || '', v: t.name, w: wname });
    if (t.cid) {
      // セキュアコンテナはプレイヤーに残る
      const sec = t.inv.equip.secure;
      t.inv.equip.secure = null;
      this.sendTo(t, { t: 'died', killer: killer?.name || (weapon === 'bleed' ? '出血' : '不明'), killerKind: killer?.kind || null, weapon: wname, zone, secure: sec, stats: t.stats, health: { energy: t.health.energy, hydration: t.health.hydration } });
    }
  }

  // ---------------------------------------------------------------- 装填・使用
  startReload(a, preferAmmo) {
    const w = a.inv.equip[a.slot];
    if (!w?.mag || this.time < a.w.reloadUntil) return false;
    const def = ITEMS[w.id];
    const cap = weaponStats(w).capacity;
    const avail = countAmmo(a.inv, def.weapon.caliber);
    let ammoId = preferAmmo && avail[preferAmmo] ? preferAmmo : avail[w.mag.ammo] ? w.mag.ammo : null;
    if (!ammoId) {
      // 最も貫通力の高い弾
      let best = null;
      for (const id of Object.keys(avail)) if (!best || ITEMS[id].ammo.pen > ITEMS[best].ammo.pen) best = id;
      ammoId = best;
    }
    if (!ammoId) { this.sendTo(a, { t: 'msg', text: '予備弾薬がない' }); return false; }
    if (w.mag.count >= cap && w.mag.ammo === ammoId) return false;
    const tube = def.weapon.pump || def.weapon.bolt;
    let time = def.weapon.reload * (1.25 - weaponStats(w).ergo / 200);
    if (tube) time = 0.6 + 0.42 * (cap - (w.mag.ammo === ammoId ? w.mag.count : 0));
    a.w.reloadUntil = this.time + time;
    a.w.reloadAmmo = ammoId;
    a.w.reloadSlot = a.slot;
    this.emit({ t: 'reload', id: a.id, dur: time });
    this.noise(a.pos, 8, a, 'reload');
    return true;
  }
  finishReload(a) {
    const w = a.inv.equip[a.w.reloadSlot];
    a.w.reloadUntil = 0;
    if (!w?.mag || a.w.reloadSlot !== a.slot) return;
    const cap = weaponStats(w).capacity;
    const ammoId = a.w.reloadAmmo;
    if (w.mag.ammo !== ammoId && w.mag.count > 0) {
      const back = createItem(w.mag.ammo, { count: w.mag.count });
      if (!autoInsert(a.inv, back)) this.addGround(back, a.pos.x, a.pos.y, a.pos.z);
      w.mag.count = 0;
    }
    w.mag.ammo = ammoId;
    const need = cap - w.mag.count;
    const got = takeAmmo(a.inv, ammoId, need);
    w.mag.count += got;
    this.markDirty(a);
  }

  startUse(a, uid) {
    const f = findItem(a.inv, uid);
    if (!f) return;
    const def = ITEMS[f.item.id];
    if (!def.med) return;
    a.w.useItem = uid;
    a.w.useUntil = this.time + def.med.use;
    a.w.reloadUntil = 0;
    this.emit({ t: 'use', id: a.id, item: def.id, dur: def.med.use });
  }
  cancelUse(a) {
    if (!a.w.useItem) return;
    a.w.useItem = null;
    this.emit({ t: 'useEnd', id: a.id, cancel: true });
  }
  finishUse(a) {
    const uid = a.w.useItem;
    a.w.useItem = null;
    const f = findItem(a.inv, uid);
    if (!f) return;
    const def = ITEMS[f.item.id];
    const used = applyMed(a, f.item);
    if (used || def.cat === 'food') {
      if (f.item.uses != null && f.item.uses > 1) f.item.uses--;
      else removeItem(a.inv, uid);
    }
    this.emit({ t: 'useEnd', id: a.id });
    this.markDirty(a);
  }

  // ---------------------------------------------------------------- インタラクト
  interact(a, c, msg) {
    const near = (x, y, z, r = 2.6) => Math.hypot(a.pos.x - x, (a.pos.y + 1) - y, a.pos.z - z) < r + 0.6;
    if (msg.kind === 'container') {
      const ct = this.containers.get(msg.id);
      if (!ct || !near(ct.x, ct.y + 0.5, ct.z, 3)) return;
      this.ensureContainer(ct);
      if (!ct.looted) { ct.looted = true; this.emit({ t: 'looted', id: ct.id }); }
      c.viewing = { root: ct.id };
      c.send({ t: 'loot', root: ct.id, kind: 'container', name: CONTAINERS[ct.type]?.name || ct.type, inv: clone(ct.root) });
      this.noise(a.pos, 6, a, 'loot');
    } else if (msg.kind === 'body') {
      const b = this.actors.get(msg.id);
      if (!b || b.alive || !b.lootRoot || !near(b.pos.x, b.pos.y + 0.5, b.pos.z, 3)) return;
      c.viewing = { root: b.id };
      c.send({ t: 'loot', root: b.id, kind: b.kind === 'machine' ? 'container' : 'body', name: b.kind === 'machine' ? `${b.name}の残骸` : b.name, inv: clone(b.lootRoot) });
    } else if (msg.kind === 'door') {
      const d = this.world.doors[msg.id];
      if (!d) return;
      const cx = d.x, cz = d.z;
      if (!near(cx, d.y0 + 1, cz, 2.8)) return;
      if (d.locked && !this.unlocked.has(d.id)) {
        const key = allItems(a.inv).find((it) => ITEMS[it.id].key?.door === d.locked);
        if (!key) { this.sendTo(a, { t: 'msg', text: `施錠されている（${d.name || '扉'}）`, warn: true }); this.emit({ t: 'doorLocked', id: d.id }); return; }
        this.unlocked.add(d.id);
        this.world.unlockDoorNav(d.id);
        this.sendTo(a, { t: 'msg', text: `${ITEMS[key.id].name} で解錠した` });
      }
      this.world.setDoor(d.id, !d.open);
      this.emit({ t: 'door', id: d.id, open: d.open, unlocked: true, by: a.id });
      this.noise(a.pos, 10, a, 'door');
    } else if (msg.kind === 'ground') {
      this.pickup(a, msg.id);
    } else if (msg.kind === 'switch') {
      const s = this.map.switches.find((x) => x.id === msg.id);
      if (!s || !near(s.x, s.y, s.z, 2.5)) return;
      const ex = this.extracts.find((e) => e.id === s.extract);
      if (ex && !ex.open) {
        ex.open = true;
        this.world.setGate(ex.id, true);
        this.emit({ t: 'gate', id: ex.id });
        this.emit({ t: 'feed', msg: '工場の裏ゲートに電源が入った…', kind: 'world' });
        this.noise({ x: s.x, y: s.y, z: s.z }, 80, a, 'alarm');
      }
    } else if (msg.kind === 'extract') {
      const ex = this.extracts.find((e) => e.id === msg.id);
      if (!ex || ex.type !== 'pay' || !near(ex.x, a.pos.y + 1, ex.z, ex.r + 2)) return;
      if (a.extractPaid === ex.id) return;
      let need = ex.cost;
      const money = allItems(a.inv).filter((it) => it.id === 'credits');
      const have = money.reduce((s, it) => s + it.count, 0);
      if (have < need) { this.sendTo(a, { t: 'msg', text: `クレジットが足りない（必要: ${need.toLocaleString()} C、所持: ${have.toLocaleString()} C）`, warn: true }); return; }
      for (const it of money) {
        const k = Math.min(need, it.count);
        it.count -= k; need -= k;
        if (it.count <= 0) removeItem(a.inv, it.uid);
        if (need <= 0) break;
      }
      a.extractPaid = ex.id;
      this.markDirty(a);
      this.sendTo(a, { t: 'msg', text: '運転手に支払った。車の脱出エリアで待機せよ。' });
    }
  }

  ensureContainer(ct) {
    if (ct.root) return ct.root;
    const C = CONTAINERS[ct.type] || CONTAINERS.crate;
    ct.root = { grid: newGrid(C.grid[0], C.grid[1]) };
    const n = C.count[0] + Math.floor(this.rng() * (C.count[1] - C.count[0] + 1));
    for (let i = 0; i < n; i++) {
      const def = pickLootItem(this.rng, C.tags, C.cats || null, C.bias || 1);
      if (!def) continue;
      autoInsert(ct.root, lootInstance(this.rng, def));
    }
    return ct.root;
  }

  resolveRoot(a, c, ref) {
    if (ref === 'self') return a.inv;
    const ct = this.containers.get(ref);
    if (ct) {
      if (Math.hypot(ct.x - a.pos.x, ct.z - a.pos.z) > 4) return null;
      return this.ensureContainer(ct);
    }
    const b = this.actors.get(ref);
    if (b && !b.alive && b.lootRoot && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < 4) return b.lootRoot;
    return null;
  }

  invOp(a, c, msg) {
    const src = this.resolveRoot(a, c, msg.src);
    const dst = this.resolveRoot(a, c, msg.dst);
    if (!src || !dst) return;
    const f = findItem(src, msg.uid);
    if (!f) return;
    const ok = applyOp(src, dst, msg);
    if (src !== a.inv || dst !== a.inv) {
      if (src !== a.inv && dst === a.inv) a.stats.looted += itemValue(f.item);
      if (dst === a.inv) f.item.fir = f.item.fir ?? true;
    }
    this.markDirty(a);
    // 閲覧中の全員に更新を送信
    for (const ref of [msg.src, msg.dst]) {
      if (ref === 'self') continue;
      const root = ref === msg.src ? src : dst;
      for (const cc of this.clients.values()) {
        if (cc.viewing?.root === ref) cc.send({ t: 'lootUpd', root: ref, inv: clone(root) });
      }
    }
    if (!ok) this.sendTo(a, { t: 'invFail' });
    // 装備変更 → 見た目の更新
    if (a.inv.equip[a.slot] == null) a.slot = a.inv.equip.primary ? 'primary' : a.inv.equip.secondary ? 'secondary' : 'holster';
  }

  pickup(a, gid) {
    const g = this.ground.get(gid);
    if (!g) return;
    if (Math.hypot(g.x - a.pos.x, g.z - a.pos.z) > 3.2 || Math.abs(g.y - a.pos.y) > 2.6) return;
    const res = autoEquipOrInsert(a.inv, g.item);
    if (!res) { this.sendTo(a, { t: 'msg', text: '空きスペースがない', warn: true }); return; }
    if (res === 'equip') this.sendTo(a, { t: 'msg', text: `${ITEMS[g.item.id].name} を装備した` });
    if (g.item.fir === undefined) g.item.fir = true;
    a.stats.looted += itemValue(g.item);
    this.ground.delete(gid);
    this.emit({ t: 'gdel', id: gid, by: a.id });
    this.markDirty(a);
    this.sendTo(a, { t: 'picked', item: g.item.id, count: g.item.count });
  }

  // ---------------------------------------------------------------- 投擲物
  throwGrenade(a, msg) {
    const f = findItem(a.inv, msg.uid);
    if (!f || ITEMS[f.item.id].cat !== 'grenade') return;
    const def = ITEMS[f.item.id];
    removeItem(a.inv, msg.uid);
    this.markDirty(a);
    const d = vnorm({ x: msg.d[0], y: msg.d[1], z: msg.d[2] });
    const pw = Math.max(6, Math.min(20, msg.power || 16));
    const g = { id: 'n' + (this.nextId++), def: def.id, pos: { x: msg.o[0], y: msg.o[1], z: msg.o[2] }, vel: { x: d.x * pw, y: d.y * pw + 2.5, z: d.z * pw }, fuse: def.grenade.fuse, owner: a.id };
    this.grenades.push(g);
    this.emit({ t: 'nade', id: g.id, def: def.id, p: [g.pos.x, g.pos.y, g.pos.z], v: [g.vel.x, g.vel.y, g.vel.z] });
  }
  throwBotGrenade(a, target) {
    const it = allItems(a.inv).find((i) => ITEMS[i.id].cat === 'grenade' && ITEMS[i.id].grenade.type === 'frag');
    if (!it) return false;
    const o = { x: a.pos.x, y: a.pos.y + 1.6, z: a.pos.z };
    const dx = target.x - o.x, dz = target.z - o.z, dist = Math.hypot(dx, dz);
    const pw = Math.min(20, Math.sqrt(dist * 22 / Math.sin(2 * 0.6)) * 0.95);
    const dir = { x: (dx / dist) * Math.cos(0.6), y: Math.sin(0.6), z: (dz / dist) * Math.cos(0.6) };
    this.throwGrenade(a, { uid: it.uid, o: [o.x, o.y, o.z], d: [dir.x, dir.y - 0.15, dir.z], power: pw });
    return true;
  }

  updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      // 物理
      const steps = 2;
      for (let s = 0; s < steps; s++) {
        const h = dt / steps;
        g.vel.y -= 18 * h;
        const sp = Math.hypot(g.vel.x, g.vel.y, g.vel.z);
        if (sp > 0.05) {
          const d = { x: g.vel.x / sp, y: g.vel.y / sp, z: g.vel.z / sp };
          const hit = this.world.raycast(g.pos, d, sp * h + 0.08, { ignoreInvisible: false });
          if (hit && hit.t <= sp * h + 0.08) {
            const n = hit.normal;
            const vn = g.vel.x * n.x + g.vel.y * n.y + g.vel.z * n.z;
            g.vel.x = (g.vel.x - 2 * vn * n.x) * 0.45; g.vel.y = (g.vel.y - 2 * vn * n.y) * 0.35; g.vel.z = (g.vel.z - 2 * vn * n.z) * 0.45;
            g.pos.x = hit.point.x + n.x * 0.06; g.pos.y = hit.point.y + n.y * 0.06; g.pos.z = hit.point.z + n.z * 0.06;
            if (Math.abs(vn) > 2) this.emit({ t: 'bounce', p: [g.pos.x, g.pos.y, g.pos.z] });
          } else {
            g.pos.x += g.vel.x * h; g.pos.y += g.vel.y * h; g.pos.z += g.vel.z * h;
          }
        }
      }
      if (g.fuse <= 0) {
        this.grenades.splice(i, 1);
        const def = ITEMS[g.def].grenade;
        const owner = this.actors.get(g.owner);
        if (def.type === 'frag') this.explode(g.pos, def.radius, def.damage, owner, 'frag');
        else if (def.type === 'flash') this.flash(g.pos, def.radius, owner);
        else if (def.type === 'smoke') { this.smokes.push({ x: g.pos.x, y: g.pos.y, z: g.pos.z, r: def.radius, t: 35 }); this.emit({ t: 'smoke', p: [g.pos.x, g.pos.y, g.pos.z], r: def.radius }); }
        else if (def.type === 'emp') this.explode(g.pos, def.radius, def.damage, owner, 'emp');
        this.emit({ t: 'nadeEnd', id: g.id });
      }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) { this.smokes[i].t -= dt; if (this.smokes[i].t <= 0) this.smokes.splice(i, 1); }
  }

  explode(p, radius, damage, owner, type) {
    this.emit({ t: 'boom', p: [p.x, p.y, p.z], r: radius, type });
    this.noise(p, 200, owner, 'boom');
    for (const t of this.actors.values()) {
      if (!t.alive) continue;
      const c = { x: t.pos.x, y: t.pos.y + (t.kind === 'machine' ? 0.3 : 1.0), z: t.pos.z };
      const d = vdist(p, c);
      if (d > radius) continue;
      if (!this.world.lineOfSight({ x: p.x, y: p.y + 0.3, z: p.z }, c)) continue;
      const f = Math.pow(1 - d / radius, 1.1);
      if (type === 'emp') {
        if (t.kind === 'machine') { this.hurt(t, 'body', { damage: 1, pen: 99 }, owner, { emp: damage * (0.4 + f), explosive: true, weapon: 'EMP' }); t.stunUntil = this.time + 4; }
        continue;
      }
      if (t.kind === 'machine') { this.hurt(t, 'body', { damage: damage * f, pen: 40 }, owner, { explosive: true, weapon: '爆発' }); continue; }
      // 人間：複数部位に分散
      const parts = ['thorax', 'stomach', 'legL', 'legR', 'armL', 'armR', 'head'];
      const n = 3;
      for (let k = 0; k < n && t.alive; k++) {
        const z = parts[Math.floor(this.rng() * (k === 0 ? 6 : 7))];
        this.hurt(t, z, { damage: damage * f / n * 1.4, pen: 25, armorDmg: 0.3 }, owner, { explosive: k > 0, weapon: '爆発' });
      }
      if (t.cid) this.sendTo(t, { t: 'shake', s: f });
    }
  }

  flash(p, radius, owner) {
    this.emit({ t: 'boom', p: [p.x, p.y, p.z], r: radius, type: 'flash' });
    for (const t of this.actors.values()) {
      if (!t.alive || t.kind === 'machine') continue;
      const eye = { x: t.pos.x, y: t.pos.y + 1.6, z: t.pos.z };
      const d = vdist(p, eye);
      if (d > radius || !this.world.lineOfSight(p, eye)) continue;
      const f = dirFromYawPitch(t.yaw, t.pitch);
      const to = vnorm({ x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z });
      const facing = f.x * to.x + f.y * to.y + f.z * to.z;
      const s = (1 - d / radius) * (0.4 + 0.6 * Math.max(0, facing));
      t.flashUntil = this.time + 1 + s * 5;
      if (t.cid) this.sendTo(t, { t: 'flashed', s });
    }
    void owner;
  }

  noise(p, radius, src, kind) {
    this.noises.push({ x: p.x, y: p.y, z: p.z, r: radius, src: src?.id, t: this.time, kind });
    for (const a of this.actors.values()) {
      if (!a.ai || !a.alive || a === src) continue;
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
      if (d < radius) aiOnNoise(this, a, p, src, kind, d / radius);
    }
  }

  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      const age = 35 - s.t;
      const r = s.r * Math.min(1, age / 3) * (s.t < 5 ? s.t / 5 : 1);
      // 線分と球
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const L2 = dx * dx + dy * dy + dz * dz;
      let t = ((s.x - a.x) * dx + (s.y + 1.5 - a.y) * dy + (s.z - a.z) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + dx * t - s.x, py = a.y + dy * t - (s.y + 1.5), pz = a.z + dz * t - s.z;
      if (px * px + py * py + pz * pz < r * r) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- 脱出
  updateExtracts(dt) {
    for (const a of this.actors.values()) {
      if (!a.alive || a.extracted || (a.kind !== 'player' && a.kind !== 'raider')) continue;
      if (a.ai && a.ai.state !== 'extract') continue;
      let inZone = null;
      for (const e of this.extracts) {
        if (!e.open) continue;
        if (Math.hypot(a.pos.x - e.x, a.pos.z - e.z) > e.r) continue;
        if (e.type === 'pay' && a.extractPaid !== e.id) continue;
        if (e.type === 'key' && !allItems(a.inv).some((it) => it.id === e.key)) continue;
        inZone = e; break;
      }
      if (inZone) {
        if (a.extractId !== inZone.id) { a.extractId = inZone.id; a.extractT = 0; }
        a.extractT += dt;
        if (a.extractT >= 8) this.extractActor(a, inZone);
      } else { a.extractId = null; a.extractT = 0; }
    }
  }

  extractActor(a, e) {
    a.extracted = true;
    a.alive = false;
    this.emit({ t: 'extracted', id: a.id, name: a.name, ex: e.name });
    this.emit({ t: 'feed', msg: `${a.name} が「${e.name}」から脱出した`, kind: 'extract' });
    if (a.cid) {
      for (const it of allItems(a.inv)) if (it.fir === undefined) delete it.fir;
      this.sendTo(a, { t: 'extractOk', ex: e.name, exId: e.id, inv: clone(a.inv), stats: a.stats, health: { energy: a.health.energy, hydration: a.health.hydration } });
    }
    this.actors.delete(a.id);
  }

  // ---------------------------------------------------------------- メインループ
  tick(dt = TICK) {
    if (this.ended) return;
    this.time += dt;
    this.timeLeft -= dt;
    this.pathBudget = 6;
    if (this.lateSpawnsInit) {
      for (let i = this.lateSpawnsInit.length - 1; i >= 0; i--) {
        const s = this.lateSpawnsInit[i];
        if (this.time >= s.t) { s.fn(); this.lateSpawnsInit.splice(i, 1); }
      }
    }
    // スカブの増援
    if (this.time > this.nextScavWave && this.opts.scavs > 0) {
      this.nextScavWave = this.time + 240 + this.rng() * 180;
      const alive = [...this.actors.values()].filter((a) => a.alive && a.kind === 'scav').length;
      if (alive < 22) {
        const z = this.map.scavZones[Math.floor(this.rng() * this.map.scavZones.length)];
        for (let i = 0; i < 2 + Math.floor(this.rng() * 2); i++) { const p = this.randomPointIn(z.x, z.z, z.r); if (p) this.spawnBot('scav', p, { zone: z }); }
      }
    }
    for (const a of this.actors.values()) {
      if (!a.alive) continue;
      // 装填・使用
      if (a.w.reloadUntil && this.time >= a.w.reloadUntil) this.finishReload(a);
      if (a.w.useItem && this.time >= a.w.useUntil) this.finishUse(a);
      if (a.health && HUMAN_KINDS.has(a.kind)) {
        if (tickHealth(a, dt)) { this.kill(a, null, 'bleed'); continue; }
      }
      if (a.ai) {
        a.ai.thinkT -= dt;
        if (a.ai.thinkT <= 0) { a.ai.thinkT = 0.2 + this.rng() * 0.08; aiThink(this, a); }
        aiUpdate(this, a, dt);
      }
    }
    this.updateGrenades(dt);
    this.updateExtracts(dt);
    // 古いノイズを削除
    if (this.noises.length > 200) this.noises.splice(0, this.noises.length - 200);
    // 死体の装備変化
    for (const a of this.actors.values()) {
      if (!a.alive || a.kind === 'machine') continue;
      if (a.cid) {
        const info = this.actorInfo(a);
        const sig = JSON.stringify(info);
        if (sig !== a.gearSig) { a.gearSig = sig; this.emit(info); }
      }
    }
    if (this.timeLeft <= 0) {
      this.ended = true;
      for (const c of this.clients.values()) {
        const a = this.actors.get(c.actorId);
        if (a && a.alive && !a.extracted) {
          a.alive = false;
          const sec = a.inv.equip.secure;
          c.send({ t: 'died', killer: 'MIA（時間切れ）', mia: true, secure: sec, stats: a.stats, health: { energy: a.health.energy, hydration: a.health.hydration } });
        }
      }
    }
  }

  snapEntry(a) {
    let f = 0;
    if (a.crouch) f |= 1; if (a.sprint) f |= 2; if (a.ads) f |= 4; if (!a.alive) f |= 8;
    if (a.moving) f |= 16; if (a.light) f |= 32; if (this.time < a.w.reloadUntil) f |= 64; if (a.w.useItem) f |= 128;
    if (a.w.charge > 0) f |= 256; if (a.ai?.alerted) f |= 512;
    return [a.id, r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), r3(a.yaw), r3(a.pitch), f, a.slot === 'primary' ? 0 : a.slot === 'secondary' ? 1 : 2];
  }

  // スナップショット（全クライアント共通）と個別データ
  flush() {
    const acts = [];
    for (const a of this.actors.values()) {
      if (!a.alive && this.time - a.deathTime > 0.5 && a.snapDead) continue;
      acts.push(this.snapEntry(a));
      if (!a.alive) a.snapDead = true;
    }
    const nades = this.grenades.map((g) => [g.id, r2(g.pos.x), r2(g.pos.y), r2(g.pos.z)]);
    const evs = this.events;
    this.events = [];
    const snap = { t: 'snap', time: r2(this.time), left: r2(this.timeLeft), a: acts, n: nades, ev: evs };
    for (const c of this.clients.values()) {
      c.send(snap);
      const a = this.actors.get(c.actorId);
      if (!a) continue;
      if (a.alive) {
        const w = a.inv.equip[a.slot];
        c.send({
          t: 'self', hp: a.health.hp, bleed: a.health.bleed, frac: a.health.fracture, dest: a.health.destroyed, pain: r2(a.health.pain),
          en: r2(a.health.energy), hy: r2(a.health.hydration), stims: a.health.stims.map((s) => [s.t | 0]),
          mag: w?.mag ? [w.mag.count, w.mag.ammo] : null, reload: this.time < a.w.reloadUntil ? r2(a.w.reloadUntil - this.time) : 0,
          use: a.w.useItem ? r2(a.w.useUntil - this.time) : 0, mode: a.w.mode, ext: a.extractId ? [a.extractId, r2(a.extractT)] : null,
          wt: r2(rootWeight(a.inv)), paid: a.extractPaid || null,
        });
      }
      if (c.invDirty && a.inv) { c.invDirty = false; c.send({ t: 'inv', inv: clone(a.inv) }); }
    }
  }
}

const MAT_KIND = {
  concrete: 'concrete', brick: 'concrete', plaster: 'concrete', cliff: 'concrete', rock: 'concrete', stair: 'concrete', concrete_floor: 'concrete', roof: 'concrete', hesco: 'dirt', sandbag: 'dirt', tile: 'concrete', lab_floor: 'concrete',
  metal: 'metal', metal_wall: 'metal', container: 'metal', car: 'metal', fence: 'metal', arc_metal: 'metal', door: 'wood', glass_dark: 'glass',
  wood: 'wood', wood_wall: 'wood', crate: 'wood', wood_floor: 'wood', tree: 'wood', fabric: 'cloth', tarp: 'cloth', rubber: 'cloth', carpet: 'cloth', container_obj: 'wood',
};
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function groundMsg(g) { return { id: g.id, item: g.item.id, count: g.item.count, x: r2(g.x), y: r2(g.y), z: r2(g.z), rot: r2(g.rot) }; }
export { totalHp, TOTAL_HP, PARTS, applyPartDamage };
