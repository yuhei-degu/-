// 隠し特性。確率判定はすべてここ（コード側）で行い、AIには結果の指示だけを渡す
//
// 流れ：
//   1. 発言の前に directivesFor() で、この発言に付ける指示（プロンプトへの追記）を決める
//   2. AIの発言を受け取ったら postProcess() で表示用の文を加工する
//   3. 投票・襲撃・護衛などの構造化データには特性を一切適用しない
//
// 特性の説明文そのものは、他のAIのプロンプトに入れない

export const TRAIT = {
  hiroyuki: "それってあなたの感想ですよね",
  yaju: "謎の数字",
  takada: "高田健志伝説",
  syamu: "実況スタイル",
  horie: "多動力",
  sleeper: "寝落ち",
  rino: "営業トーク",
  betsuhan: "人格F",
  giorno: "迷ゼリフ",
};

export function createTraitState() {
  return { usedOnce: new Set(), horieSkipNext: false, triggered: [] };
}

function mark(state, playerId, traitId) {
  if (!state.triggered.some((t) => t.playerId === playerId && t.traitId === traitId)) {
    state.triggered.push({ playerId, traitId, traitName: TRAIT[traitId] });
  }
}

// ctx = { traitId, playerId, accused, accuserName, isFirstSpeechOfGame, executing }
// 返り値 = { skip?: string, speakTwice?: boolean, prompt: string[] }
export function directivesFor(ctx, state, rng) {
  const out = { prompt: [] };
  const { traitId, playerId } = ctx;
  const once = (id) => !state.usedOnce.has(id) && (state.usedOnce.add(id), true);

  if (traitId === "hiroyuki" && ctx.accused && once("hiroyuki")) {
    out.prompt.push(`${ctx.accuserName}の疑いを「それってあなたの感想ですよね」と退け、根拠を1つ示すよう求めてください。`);
    out.demandEvidenceFrom = ctx.accuserName; // 次にその人が話すとき「根拠を1つ示すこと」を指示する
    mark(state, playerId, traitId);
  }
  if (traitId === "takada" && rng() < 0.2) {
    out.prompt.push("発言の最後に「ちなみに俺は昔…」から始まる、ありえない武勇伝を1文だけ付けてください。");
    mark(state, playerId, traitId);
  }
  if (traitId === "syamu") {
    if (ctx.isFirstSpeechOfGame) { out.prompt.push("動画実況の挨拶の口調で話し始めてください。"); mark(state, playerId, traitId); }
    else if (ctx.accused) out.prompt.push("疑われて動揺し、急に丁寧語になってください。");
  }
  if (traitId === "horie") {
    if (state.horieSkipNext) { state.horieSkipNext = false; out.skip = "時間の無駄。"; return out; }
    if (rng() < 0.25) { out.speakTwice = true; state.horieSkipNext = true; mark(state, playerId, traitId); }
  }
  if (traitId === "rino" && ctx.accused && once("rino")) {
    out.prompt.push(`${ctx.accuserName}さんを「頭いいですね〜」と持ち上げて、話をそらしてください。`);
    out.flatteredName = ctx.accuserName; // その人の次のプロンプトに「リノに褒められて少し悪い気はしない」と足す
    mark(state, playerId, traitId);
  }
  if (traitId === "betsuhan" && ctx.accused && rng() < 0.4) {
    out.prompt.push("もう一人の人格「F」として、攻撃的で荒い口調で反論してください。");
    out.persona = "F";
    mark(state, playerId, traitId);
  }
  if (traitId === "giorno" && ctx.executing) {
    out.prompt.push("遺言の代わりに、ワザップジョルノ風の意味不明な迷ゼリフを1つだけ言ってください。");
    mark(state, playerId, traitId);
  }
  return out;
}

// 数字の置換から外すもの：プレイヤー番号や日数など、ゲーム進行に関わる数字
const PROTECTED_AFTER = /^(番|人目|日目|日|周|票|人)/;

export function replaceNumbers(text, rng, rate = 0.3) {
  return text.replace(/\d+/g, (num, offset, whole) => {
    const after = whole.slice(offset + num.length);
    const before = whole.slice(Math.max(0, offset - 3), offset);
    if (PROTECTED_AFTER.test(after) || /No\.?$/i.test(before)) return num;
    return rng() < rate ? (rng() < 0.5 ? "114514" : "810") : num;
  });
}

// 表示用の文の加工。返り値の text が広場に流れ、他のAIもこの文を読む
export function postProcess({ traitId, playerId, text }, state, rng) {
  let out = text;
  if (traitId === "yaju") {
    const replaced = replaceNumbers(out, rng);
    if (replaced !== out) mark(state, playerId, traitId);
    out = replaced;
  }
  if (traitId === "sleeper" && rng() < 0.3) {
    out = [...out].slice(0, 10).join("") + "…zzz";
    mark(state, playerId, traitId);
  }
  return out;
}
