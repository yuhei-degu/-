// 9人村のルール判定。AIを呼ばない純粋な関数だけを置く
import { pick, shuffle } from "./rng.mjs";

export const ROLE = {
  WOLF: "人狼",
  MADMAN: "狂人",
  SEER: "占い師",
  MEDIUM: "霊媒師",
  KNIGHT: "騎士",
  VILLAGER: "村人",
};

// 公開される10枚
export const DECK = [
  ROLE.WOLF, ROLE.WOLF, ROLE.MADMAN, ROLE.SEER, ROLE.MEDIUM, ROLE.KNIGHT,
  ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER,
];

// 人狼2枚は必ず配り、残り8枚から1枚を伏せ札にする
export function dealRoles(playerIds, rng) {
  if (playerIds.length !== 9) throw new Error("9人村は9人ちょうどで開始します");
  const others = shuffle(DECK.filter((r) => r !== ROLE.WOLF), rng);
  const hiddenCard = others.pop();
  const hand = shuffle([ROLE.WOLF, ROLE.WOLF, ...others], rng);
  const roles = Object.fromEntries(playerIds.map((id, i) => [id, hand[i]]));
  return { roles, hiddenCard };
}

// 占い・霊媒の結果。狂人は「人間」
export function inspect(role) {
  return role === ROLE.WOLF ? "人狼" : "人間";
}

export const alive = (players) => players.filter((p) => p.alive);
export const isWolf = (p) => p.role === ROLE.WOLF;

// 夜0：占い師にランダムな1人の「人間」を知らせる（狂人も候補に含む）
export function nightZeroWhite(players, rng) {
  const seer = players.find((p) => p.role === ROLE.SEER);
  if (!seer) return null; // 占い師が伏せ札
  const target = pick(players.filter((p) => p.id !== seer.id && !isWolf(p)), rng);
  return { seerId: seer.id, targetId: target.id, result: "人間" };
}

// 勝利判定。処刑の直後と襲撃の直後の両方で呼ぶ
export function checkWinner(players) {
  const living = alive(players);
  const wolves = living.filter(isWolf).length;
  const others = living.length - wolves; // 狂人は人間側の人数に数える
  if (wolves === 0) return "村陣営";
  if (wolves >= others) return "人狼陣営";
  return null;
}

// 有効な投票だけを数える：生存者が、自分以外の候補者に入れた票
export function tally(ballots, voterIds, candidateIds) {
  const counts = {};
  for (const [voter, target] of Object.entries(ballots)) {
    if (!voterIds.includes(voter)) continue;
    if (voter === target || !candidateIds.includes(target)) continue;
    counts[target] = (counts[target] || 0) + 1;
  }
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((id) => counts[id] === max);
  return { counts, top: max === 0 ? [] : top };
}

// 昼の投票。同票なら同票者だけを候補に1回だけ再投票し、それでも同票なら処刑なし
// collectBallots(voterIds, candidateIds) は {voterId: targetId} を返す非同期関数
export async function resolveDayVote(players, collectBallots) {
  const voters = alive(players).map((p) => p.id);
  const first = tally(await collectBallots(voters, voters), voters, voters);
  if (first.top.length === 1) return { executed: first.top[0], rounds: [first] };
  if (first.top.length === 0) return { executed: null, rounds: [first] };
  const second = tally(await collectBallots(voters, first.top), voters, first.top);
  const executed = second.top.length === 1 ? second.top[0] : null;
  return { executed, rounds: [first, second] };
}

// 人狼の襲撃先。一致すればそれ、割れたら希望先から抽選、無効なら人狼以外の生存者から抽選
export function resolveAttack(players, choices, rng) {
  const wolves = alive(players).filter(isWolf).map((p) => p.id);
  const valid = alive(players).filter((p) => !isWolf(p)).map((p) => p.id);
  const wanted = wolves.map((w) => choices[w]).filter((t) => valid.includes(t));
  if (wanted.length === 0) return pick(valid, rng);
  return pick([...new Set(wanted)], rng);
}

// 騎士の護衛先。自分と、前夜と同じ人は守れない
export function isValidGuard(players, knightId, targetId, lastTargetId) {
  const target = players.find((p) => p.id === targetId);
  return Boolean(target && target.alive && targetId !== knightId && targetId !== lastTargetId);
}

// 夜の結果。護衛が当たれば誰も死なない
export function resolveNight({ attackedId, guardedId }) {
  return attackedId && attackedId !== guardedId ? attackedId : null;
}

// AIの自由文から候補者の名前を1人だけ拾う。見つからない・複数あるときは null
export function parseTarget(text, candidates) {
  const hits = candidates.filter((c) => text.includes(c.name));
  return hits.length === 1 ? hits[0].id : null;
}

// 壊れた応答でも試合を止めない：解釈できなければ候補からランダム
export function targetOrFallback(text, candidates, rng) {
  return parseTarget(text || "", candidates) ?? pick(candidates, rng).id;
}
