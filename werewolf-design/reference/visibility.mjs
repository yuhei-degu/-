// 誰に何を見せるかをここだけで決める。AI向けと観戦者向けは必ずこの関数を通して作る
import { ROLE, DECK } from "./rules.mjs";

// ゲーム状態の形（参照用）
// game = {
//   players: [{ id, name, role, alive, deathCause }],
//   hiddenCard, finished, winner,
//   publicLog: [{ type: "speech"|"system"|"vote", day, speakerId?, text?, ballots? }],
//   wolfChat: [{ day, speakerId, text }],        // 人狼と観戦者だけ
//   innerVoices: [{ day, speakerId, text }],     // 観戦者だけ
//   privateResults: { [playerId]: [{ day, kind, targetId, result }] }, // 本人だけ
//   triggeredTraits: [{ playerId, traitName }],  // 観戦者だけ
// }

const nameOf = (game, id) => game.players.find((p) => p.id === id)?.name ?? "?";

// AIの発言はデータとして渡す。命令文を混ぜられても指示として読まれないよう、改行を潰して引用符で囲む
export function quoteSpeech(text, max = 200) {
  const flat = String(text ?? "").replace(/[\r\n]+/g, " ").slice(0, max);
  return JSON.stringify(flat);
}

function publicLogFor(game) {
  return game.publicLog.map((e) => {
    if (e.type === "speech") return { type: "speech", day: e.day, speaker: nameOf(game, e.speakerId), text: e.text };
    if (e.type === "vote") return { type: "vote", day: e.day, ballots: Object.fromEntries(Object.entries(e.ballots).map(([f, t]) => [nameOf(game, f), nameOf(game, t)])) };
    return { type: "system", day: e.day, text: e.text };
  });
}

// AIプレイヤー1人に渡してよい情報
export function aiContext(game, playerId) {
  const me = game.players.find((p) => p.id === playerId);
  const ctx = {
    you: { name: me.name, role: me.role, alive: me.alive },
    players: game.players.map((p) => ({ name: p.name, alive: p.alive })), // 役職と死因の詳細は含めない
    deck: [...DECK], // 公開の10枚。伏せ札がどれかは含めない
    publicLog: publicLogFor(game),
    myResults: (game.privateResults[playerId] ?? []).map((r) => ({ ...r, target: nameOf(game, r.targetId) })),
  };
  if (me.role === ROLE.WOLF) {
    ctx.partners = game.players.filter((p) => p.role === ROLE.WOLF && p.id !== playerId).map((p) => p.name);
    ctx.wolfChat = game.wolfChat.map((c) => ({ day: c.day, speaker: nameOf(game, c.speakerId), text: c.text }));
  }
  return ctx;
}

// 観戦画面に送ってよい情報。決着前は役職と伏せ札を送らない（ブラウザの開発者ツールで見えてしまうため）
export function spectatorView(game) {
  const view = {
    finished: game.finished,
    winner: game.finished ? game.winner : null,
    players: game.players.map((p) => ({
      id: p.id, name: p.name, alive: p.alive, deathCause: p.deathCause ?? null,
      ...(game.finished ? { role: p.role } : {}),
    })),
    deck: [...DECK],
    hiddenCard: game.finished ? game.hiddenCard : null,
    publicLog: publicLogFor(game),
    // 密談と心の声は観戦者向けの演出。人狼2人は観戦者にわかるが、残り8枚の内訳は推測できないので伏せ札は漏れない
    wolfChat: game.wolfChat.map((c) => ({ day: c.day, speaker: nameOf(game, c.speakerId), text: c.text })),
    innerVoices: game.innerVoices.map((v) => ({ day: v.day, speaker: nameOf(game, v.speakerId), text: v.text })),
    triggeredTraits: game.triggeredTraits.map((t) => ({ name: nameOf(game, t.playerId), trait: t.traitName })),
  };
  return view;
}
