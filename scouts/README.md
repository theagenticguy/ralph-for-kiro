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

## Where does `scouts/` live?

By default, `scouts/` sits alongside the ralph-for-kiro checkout. That works
for a single-machine setup but means scout data is coupled to the repo clone.
Override with either:

- `--user-dir <path>` CLI flag (e.g. `ralph --user-dir ~/ralph-data scout ls`)
- `RALPH_USER_DIR=<path>` env var (useful in cron entries)
- `$XDG_CONFIG_HOME/ralph-for-kiro/` (auto-detected if the directory exists)

Resolution order is flag → env → XDG → cwd. The cwd fallback keeps existing
setups working without change.

## Making a new scout

Two ways:

**From a built-in template** (recommended for feed-shaped scouts):
```bash
ralph scout init --from-example hn-frontpage my-hn-scout
```
Available templates: `hn-frontpage`.

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

## Running on a schedule

Scouts are a CLI, so any scheduler works — cron, systemd timers, GitHub
Actions `schedule:`, launchd on macOS. Pin `RALPH_USER_DIR` in the entry if
you want scout data to live outside the repo:

```cron
RALPH_USER_DIR=$HOME/ralph-data
0 9 * * * /path/to/ralph-for-kiro scout \
  --concurrency 3 --min-iterations 2 --max-iterations 4 \
  >> $HOME/ralph-data/cron.log 2>&1
```

The scheduler will fail silently if `scouts/` is empty — seed with
`ralph scout init` or `--from-example` once before the first run.
