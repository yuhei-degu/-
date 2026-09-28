import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../rng.mjs";
import { createTraitState, directivesFor, postProcess, replaceNumbers } from "../traits.mjs";

const always = () => 0;      // 確率判定がすべて当たる
const never = () => 0.9999;  // すべて外れる

test("数字の置換：プレイヤー番号・日数・票数は壊さない", () => {
  const out = replaceNumbers("3番の人に2票、2日目に5回言った No.7", always);
  assert.ok(out.startsWith("3番の人に2票、2日目に"));
  assert.ok(out.includes("No.7"));
  assert.ok(!out.includes("5回"));
});

test("寝落ち：当たると10文字で切れてzzz、外れると原文のまま", () => {
  const text = "占い結果です。ホリエさんは人狼でした。";
  assert.equal(postProcess({ traitId: "sleeper", playerId: "s", text }, createTraitState(), always), "占い結果です。ホリエ…zzz");
  assert.equal(postProcess({ traitId: "sleeper", playerId: "s", text }, createTraitState(), never), text);
});

test("1試合1回の特性は2回目以降は発動しない", () => {
  const state = createTraitState();
  const ctx = { traitId: "hiroyuki", playerId: "h", accused: true, accuserName: "タカダ" };
  assert.equal(directivesFor(ctx, state, always).prompt.length, 1);
  assert.equal(directivesFor(ctx, state, always).prompt.length, 0);
  const rino = { traitId: "rino", playerId: "r", accused: true, accuserName: "別班" };
  assert.equal(directivesFor(rino, state, always).flatteredName, "別班");
  assert.equal(directivesFor(rino, state, always).flatteredName, undefined);
});

test("多動力：2回話した次の周回はスキップ", () => {
  const state = createTraitState();
  const ctx = { traitId: "horie", playerId: "ho" };
  assert.equal(directivesFor(ctx, state, always).speakTwice, true);
  assert.equal(directivesFor(ctx, state, always).skip, "時間の無駄。");
  assert.equal(directivesFor(ctx, state, never).speakTwice, undefined);
});

test("シードが同じなら発動結果も同じ（再現できる）", () => {
  const run = (seed) => {
    const rng = createRng(seed), state = createTraitState();
    return Array.from({ length: 50 }, () => postProcess({ traitId: "sleeper", playerId: "s", text: "あいうえおかきくけこさしすせそ" }, state, rng));
  };
  assert.deepEqual(run(42), run(42));
});

test("発動した特性は観戦用に1回だけ記録される", () => {
  const state = createTraitState();
  postProcess({ traitId: "sleeper", playerId: "s", text: "あいうえおかきくけこさしす" }, state, always);
  postProcess({ traitId: "sleeper", playerId: "s", text: "あいうえおかきくけこさしす" }, state, always);
  assert.deepEqual(state.triggered, [{ playerId: "s", traitId: "sleeper", traitName: "寝落ち" }]);
});

test("迷ゼリフは処刑されるときだけ", () => {
  const state = createTraitState();
  assert.equal(directivesFor({ traitId: "giorno", playerId: "g", executing: false }, state, always).prompt.length, 0);
  assert.equal(directivesFor({ traitId: "giorno", playerId: "g", executing: true }, state, always).prompt.length, 1);
});
