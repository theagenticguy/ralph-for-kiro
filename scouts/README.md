# `scouts/` — user data, not source

Everything under `scouts/` except this README is **user data**: your topic
manifests, your watched repos, your discovery history. None of it is
committed to the ralph-for-kiro repo. Think of it the same way you think of
`.git/` — it lives alongside the code but doesn't belong to it.

## Why not commit scouts?

1. **They mutate at runtime.** Every `ralph scout` run appends to
   `scouts/<name>/manifest.json`'s `discoveryLog` and may auto-add repos
   to `watch[]`. Committing them would mean every nightly cron creates a
   dirty tree.
2. **They're personal.** Your `ai-security` watch list doesn't belong to
   someone else who clones ralph-for-kiro.
3. **The `.kiro/` subtree is regenerated.** `ensureScoutKiroTree()`
   rewrites each scout's `.kiro/{agents,steering,hooks,settings}` on
   every run, so any committed copy goes stale immediately.

## Making a new scout

Two ways:

**From an example template** (recommended for feed-shaped scouts):
```bash
# Coming in the follow-up PR per GH issue #TBD —
# `ralph scout init --from-example hn-frontpage`
cp src/data/examples/hn-frontpage-manifest.json \
   scouts/my-hn-scout/manifest.json
mkdir -p scouts/my-hn-scout/.kiro/steering
cp src/data/examples/hn-frontpage-steering.md \
   scouts/my-hn-scout/.kiro/steering/watcher-context.md
```

**From scratch** (repo-watch scouts like ai-eval):
```bash
ralph scout init my-scout \
  --topics "llm-ops,prompt-engineering" \
  --languages "python,typescript"
```

## Running

```bash
ralph scout ls                        # see what exists
ralph scout --name my-scout           # run one
ralph scout --concurrency 3           # run the fleet in parallel
ralph scout tail my-scout             # watch an in-flight run
```

Output lands in `results/<scout-name>/pw-YYYYMMDD-HHmm/` (also gitignored).

## Heads-up on the 4am-CST cron

If you set up a nightly cron, it will fail silently if `scouts/` is empty.
Either seed from an example or have `ralph scout init` run once before the
first cron invocation.
