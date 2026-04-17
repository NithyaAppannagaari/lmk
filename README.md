# lmk

A personalized developer news feed in your terminal.

```
🧠 LLM  ──────────────────────────────────────────

  • Mistral drops Codestral 2 — Apache 2.0, 22B params
    Outperforms DeepSeek-Coder-V2 on HumanEval. Self-hostable.
    github.com

  • Cognition raises $175M Series B at $2B valuation
    Doubles down on fully autonomous software engineering agents.
    axios.com

  ────────────────────────────────────────────────
  2 items · personalized · 12m ago
```

## Install

Requires **Node.js v18+** ([nodejs.org](https://nodejs.org)).

```bash
curl -fsSL https://raw.githubusercontent.com/NithyaAppannagaari/lmk/main/install.sh | bash
```

## Usage

```bash
lmk auth login        # create your account (just an email, no password)

lmk                   # all categories
lmk --llm             # LLM and AI ecosystem
lmk --defi            # DeFi and on-chain finance
lmk --quant           # prediction markets, algo trading news
lmk --general         # developer tooling, OSS, infra
lmk --llm --quant     # can query for multiple categories at once

lmk --chat            # tell lmk what you want to learn to improve future results
```

## Personalization

`lmk --chat` takes a one-line description of what you're interested in and uses it to rerank your feed on every future run:

```
What do you want to learn about?
> RAG pipelines, vector databases, inference optimization

✔ Got it. Your next lmk run will reflect this.
```

Run it as many times as you want. Recent inputs are weighted more heavily. Results improve with each update.

## Auth

```bash
lmk auth login        # authenticate with your email
lmk auth whoami       # show current account
lmk auth logout       # clear local credentials
```

Using the same email always returns the same account and restores your personalization history.

## How it works

- News is ingested every hour from Hacker News, TechCrunch, arXiv, The Defiant, CoinDesk, and more
- Each item is scored for signal quality (0–1) using Claude
- Your `--chat` inputs are embedded and stored as a preference vector
- On every `lmk` run, items are ranked by: `0.5 × signal_score + 0.5 × cosine_similarity(item, your_interests)`

## Uninstall

```bash
npm uninstall -g cli
rm -rf ~/.lmk
```
