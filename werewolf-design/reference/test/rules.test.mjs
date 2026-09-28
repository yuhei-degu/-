import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../rng.mjs";
import {
  ROLE, dealRoles, inspect, nightZeroWhite, checkWinner, tally, resolveDayVote,
  resolveAttack, isValidGuard, resolveNight, parseTarget, targetOrFallback,
} from "../rules.mjs";

const IDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
const mk = (roles, dead = []) => IDS.map((id, n) => ({ id, name: `P${n + 1}`, role: roles[n], alive: !dead.includes(id) }));
const V = ROLE.VILLAGER, W = ROLE.WOLF, M = ROLE.MADMAN, S = ROLE.SEER, MD = ROLE.MEDIUM, K = ROLE.KNIGHT;

test("配役：人狼は必ず2人、伏せ札は人狼以外で、出方は村人約50%・他は約12.5%", () => {
  const rng = createRng(1);
  const count = {};
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const { roles, hiddenCard } = dealRoles(IDS, rng);
    const dealt = Object.values(roles);
    assert.equal(dealt.length, 9);
    assert.equal(dealt.filter((r) => r === W).length, 2);
    assert.notEqual(hiddenCard, W);
    count[hiddenCard] = (count[hiddenCard] || 0) + 1;
  }
  assert.ok(Math.abs(count[V] / N - 0.5) < 0.02);
  for (const r of [M, S, MD, K]) assert.ok(Math.abs(count[r] / N - 0.125) < 0.015, r);
});

test("配役：9人以外は開始しない", () => {
  assert.throws(() => dealRoles(IDS.slice(0, 8), createRng(1)));
});

test("占い・霊媒：狂人は人間と出る", () => {
  assert.equal(inspect(W), "人狼");
  assert.equal(inspect(M), "人間");
});

test("夜0：人狼と占い師本人は選ばれない。占い師が伏せ札なら何もしない", () => {
  const players = mk([S, W, W, M, V, V, V, V, MD]);
  const rng = createRng(3);
  for (let i = 0; i < 200; i++) {
    const r = nightZeroWhite(players, rng);
    assert.ok(!["a", "b", "c"].includes(r.targetId));
  }
  assert.equal(nightZeroWhite(mk([V, W, W, M, V, V, V, K, MD]), rng), null);
});

test("勝利判定：狂人は人間側に数え、人狼が同数以上で人狼の勝ち", () => {
  const roles = [W, W, M, S, MD, K, V, V, V];
  assert.equal(checkWinner(mk(roles)), null);
  assert.equal(checkWinner(mk(roles, ["a", "b"])), "村陣営");
  // 人狼2・狂人1・村人1 → 2 >= 2 で人狼の勝ち
  assert.equal(checkWinner(mk(roles, ["d", "e", "f", "g", "h"])), "人狼陣営");
  // 人狼2・狂人1・村人2 → 続行
  assert.equal(checkWinner(mk(roles, ["d", "e", "f", "g"])), null);
});

test("集計：死亡者の票・自分への票・候補外への票は数えない", () => {
  const r = tally({ a: "b", b: "b", c: "z", d: "b", x: "b" }, ["a", "b", "c", "d"], ["a", "b", "c", "d"]);
  assert.deepEqual(r.counts, { b: 2 });
  assert.deepEqual(r.top, ["b"]);
});

test("昼の投票：同票なら同票者だけで1回再投票、それでも同票なら処刑なし", async () => {
  const players = mk([W, W, M, S, MD, K, V, V, V], ["i"]);
  const calls = [];
  const collect = async (voters, candidates) => {
    calls.push(candidates);
    // 1回目：a に4票、b に4票 / 2回目：また4対4
    return Object.fromEntries(voters.map((v, n) => [v, n % 2 ? "b" : "a"]).map(([v, t]) => [v, v === t ? (t === "a" ? "b" : "a") : t]));
  };
  const r = await resolveDayVote(players, collect);
  assert.equal(calls.length, 2);
  assert.deepEqual([...calls[1]].sort(), ["a", "b"]);
  assert.equal(r.executed, null);
});

test("昼の投票：再投票で決まれば処刑", async () => {
  const players = mk([W, W, M, S, MD, K, V, V, V]);
  let round = 0;
  const collect = async (voters) => {
    round++;
    if (round === 1) return Object.fromEntries(voters.map((v, n) => [v, n < 4 ? "i" : n < 8 ? "h" : "g"]).map(([v, t]) => [v, v === t ? "a" : t]));
    return Object.fromEntries(voters.map((v) => [v, v === "i" ? "h" : "i"]));
  };
  const r = await resolveDayVote(players, collect);
  assert.equal(r.executed, "i");
});

test("襲撃：人狼や死亡者は狙えず、割れたら希望先から抽選", () => {
  const players = mk([W, W, M, S, MD, K, V, V, V], ["g"]);
  const rng = createRng(5);
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(resolveAttack(players, { a: "d", b: "e" }, rng));
  assert.deepEqual([...seen].sort(), ["d", "e"]);
  for (let i = 0; i < 200; i++) {
    const t = resolveAttack(players, { a: "b", b: "g" }, rng); // 仲間と死亡者 → 無効
    assert.ok(!["a", "b", "g"].includes(t));
  }
});

test("襲撃：人狼が1人でも動く", () => {
  const players = mk([W, W, M, S, MD, K, V, V, V], ["a"]);
  assert.equal(resolveAttack(players, { b: "d" }, createRng(1)), "d");
});

test("護衛：自分と前夜と同じ人は守れず、当たれば誰も死なない", () => {
  const players = mk([W, W, M, S, MD, K, V, V, V]);
  assert.equal(isValidGuard(players, "f", "f", null), false);
  assert.equal(isValidGuard(players, "f", "d", "d"), false);
  assert.equal(isValidGuard(players, "f", "d", "e"), true);
  assert.equal(resolveNight({ attackedId: "d", guardedId: "d" }), null);
  assert.equal(resolveNight({ attackedId: "d", guardedId: "e" }), "d");
});

test("壊れた応答：名前が1人に決まらなければ候補からランダム", () => {
  const cands = [{ id: "a", name: "ホリエ" }, { id: "b", name: "別班" }];
  assert.equal(parseTarget("ホリエに投票します", cands), "a");
  assert.equal(parseTarget("ホリエか別班か迷う", cands), null);
  assert.equal(parseTarget("", cands), null);
  assert.ok(["a", "b"].includes(targetOrFallback(undefined, cands, createRng(1))));
});
