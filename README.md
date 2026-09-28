# AI競作アリーナ

同じお題を複数のAIに**別々に**作らせ、できあがった作品を1画面に並べて同時に再生するツールです。画面を録画すればそのまま比較動画になります。

最初のお題は `meteor`（隕石から無傷で身を守る。避ける・逃げる・隠れるのは禁止）です。

## 必要なもの（すべて無料で動きます）

- Node.js 18 以上（外部パッケージは不要なので `npm install` も要りません）
- 次のどちらか、または両方
  - **ローカルLLM（完全無料）**：[Ollama](https://ollama.com) をインストールしてモデルを取得します
    ```
    ollama pull qwen2.5-coder:14b
    ollama pull gemma3:12b
    ollama pull llama3.1:8b
    ```
  - **無料枠のあるクラウドAPI**：Google AI Studio（Gemini）、Groq、OpenRouter の `:free` モデルなど。無料枠の条件は変わるので、各サービスで確認してください。

## 使い方

```bash
cp .env.example .env        # クラウドAPIを使う場合だけキーを記入
# config.json で使う参加者を enabled: true にする
npm run generate meteor     # 全員に同時に出題 → works/meteor/ に保存
npm run serve               # http://localhost:5173/viewer/?topic=meteor
```

観戦画面の操作:

| 操作 | 内容 |
|---|---|
| `▶ 同時スタート` / `R` / スペース | 全作品を頭から同時に再生し直す |
| `縦/横` | 16:9（YouTube向け）と 9:16（ショート動画向け）を切り替える。`?layout=portrait` でも縦になる |
| `H` | ボタン類を隠す（録画用） |

## 新しいお題を追加する

`prompts/<ID>.md` を作り、`npm run generate <ID>` を実行します。観戦画面に表示するお題名は `viewer/index.html` の `TITLES` に追加します。

## ファイル構成

```
config.json        参加するAIの一覧（OpenAI互換APIならどこでも追加できます）
prompts/*.md       お題（全員に同じ文面を送ります）
generate.mjs       全員に同時に出題し、HTMLを取り出して保存
works/<ID>/        生成された作品、生の応答（*.raw.txt）、manifest.json
viewer/index.html  作品をタイル状に並べて同時に再生する観戦画面
serve.mjs          依存なしの静的サーバー
```

AIが書いたコードは `sandbox="allow-scripts"` の iframe の中だけで実行されます。
