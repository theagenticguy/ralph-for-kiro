#!/usr/bin/env bun
/**
 * @fileoverview CLI entry point for Ralph Wiggum, an iterative loop technique for Kiro CLI.
 * Registers commands: init, loop, resume, and cancel.
 * @module ralph-wiggum
 */
import { Command } from "commander";

import {
	cancelCommand,
	initCommand,
	loopCommand,
	resumeCommand,
	scoutInitCommand,
	scoutLsCommand,
	scoutResultsCommand,
	scoutRunCommand,
	scoutStatusCommand,
	scoutTailCommand,
	watchInitCommand,
	watchLsCommand,
	watchResultsCommand,
	watchRunCommand,
} from "./commands";
import { VERSION } from "./version";

const program = new Command()
	.name("ralph")
	.description("Ralph Wiggum iterative loop technique for Kiro CLI")
	.version(VERSION)
	.addHelpText(
		"after",
		`
Common tasks:
  ralph watch init && ralph watch      Kick off a one-off discovery loop
  ralph scout ls                       List configured scouts
  ralph scout --concurrency 3          Run the full fleet in parallel
  ralph scout tail ai-eval             Follow a live scout run
  ralph loop "Build a CLI" -m 20       Run Ralph iteratively on a task

Data:
  scouts/<name>/                       Per-scout manifest + .kiro/ tree
  results/<scout>/pw-YYYYMMDD-HHmm/    Per-run artefacts (iterations/,
                                       summary.md, discovery.json,
                                       status.json)

See 'ralph <cmd> --help' for any subcommand.`,
	);

// Init command
program
	.command("init")
	.description("Initialize Ralph Wiggum in the current project")
	.option("-f, --force", "Overwrite existing files if they exist")
	.action(initCommand);

// Loop command
program
	.command("loop")
	.description("Start a Ralph Wiggum iterative loop")
	.argument("<prompt>", "Task prompt for the loop")
	.option(
		"-n, --min-iterations <number>",
		"Minimum iterations before checking completion",
		"1",
	)
	.option(
		"-m, --max-iterations <number>",
		"Maximum iterations (0 = unlimited)",
		"0",
	)
	.option(
		"-p, --completion-promise <string>",
		"Promise phrase to signal completion",
		"COMPLETE",
	)
	.option("-a, --agent <name>", "Agent name (default: ralph-wiggum)")
	.action(loopCommand);

// Cancel command
program
	.command("cancel")
	.description("Cancel an active Ralph loop")
	.action(cancelCommand);

// Resume command
program
	.command("resume")
	.description("Resume a stopped Ralph loop with context about previous work")
	.option(
		"-n, --min-iterations <number>",
		"Override minimum iterations before checking completion",
	)
	.option(
		"-m, --max-iterations <number>",
		"Override maximum iterations (0 = unlimited)",
	)
	.option(
		"-p, --completion-promise <string>",
		"Override promise phrase to signal completion",
	)
	.option("-a, --agent <name>", "Agent name (default: ralph-wiggum)")
	.action(resumeCommand);

// Watch command (with subcommands)
const watchCmd = program
	.command("watch")
	.description("Discover trending repos through iterative deep research")
	.option(
		"-n, --min-iterations <number>",
		"Minimum iterations before checking completion",
		"3",
	)
	.option("-m, --max-iterations <number>", "Maximum iterations", "10")
	.option("-a, --agent <name>", "Agent name override")
	.option("--manifest <path>", "Path to watch manifest file")
	.option("--scout <name>", "Scout name (namespaces results)")
	.action(watchRunCommand)
	.addHelpText(
		"after",
		`
Examples:
  ralph watch init                       Scaffold .kiro/ + watch-manifest.json
  ralph watch                            Run one discovery loop from the root manifest
  ralph watch -n 2 -m 5                  Shorter loop (2-5 iterations)
  ralph watch ls                         List recent watch runs
  ralph watch results                    Show most recent watch run`,
	);

watchCmd
	.command("init")
	.description("Initialize watch configuration (agent, steering, manifest)")
	.option("-f, --force", "Overwrite existing files")
	.action(watchInitCommand);

watchCmd
	.command("results")
	.description("Show results for a watch run")
	.argument("[id]", "Task ID (defaults to most recent)")
	.action(watchResultsCommand);

watchCmd
	.command("ls")
	.description("List recent watch runs")
	.action(watchLsCommand);

// Scout command (fleet of focused watchers).
// The parent action runs scouts; `run` is also registered below as an
// explicit alias so `ralph scout run --name X` doesn't silently 404 on
// the commander argument parser (it used to error with "too many
// arguments for 'scout'" — a real AX cliff we hit during sparring).
const scoutCmd = program
	.command("scout")
	.description("Manage a fleet of focused discovery scouts")
	.option("-n, --min-iterations <number>", "Minimum iterations per scout", "3")
	.option("-m, --max-iterations <number>", "Maximum iterations per scout", "10")
	.option("--name <name>", "Run a specific scout only")
	.option("-a, --agent <name>", "Agent name override")
	.option(
		"-c, --concurrency <number>",
		"Max scouts to run in parallel (default 1 = sequential)",
		"1",
	)
	.action(scoutRunCommand)
	.addHelpText(
		"after",
		`
Examples:
  ralph scout ls                         List every scout on disk
  ralph scout                            Run every scout sequentially
  ralph scout --name ai-eval             Run just one scout
  ralph scout run --name ai-eval         Same — 'run' is an explicit alias
  ralph scout --concurrency 3            Fleet in parallel, 3 workers
  ralph scout tail ai-eval               Stream in-flight iteration sidecars
  ralph scout status                     One-line summary of each scout's last run
  ralph scout init hn-frontpage \\
    -t "ai-agents,llm-tooling"          Scaffold a new scout`,
	);

// Explicit `run` alias so `ralph scout run [flags]` works as expected.
// Forwards to the parent action with the merged option set.
scoutCmd
	.command("run")
	.description("Alias for `ralph scout [options]` — runs the fleet")
	.option("-n, --min-iterations <number>", "Minimum iterations per scout", "3")
	.option("-m, --max-iterations <number>", "Maximum iterations per scout", "10")
	.option("--name <name>", "Run a specific scout only")
	.option("-a, --agent <name>", "Agent name override")
	.option(
		"-c, --concurrency <number>",
		"Max scouts to run in parallel (default 1 = sequential)",
		"1",
	)
	.action(scoutRunCommand);

scoutCmd
	.command("ls")
	.description("List all available scouts")
	.action(scoutLsCommand);

scoutCmd
	.command("results")
	.description("Show results across scouts")
	.argument("[name]", "Scout name (defaults to all)")
	.action(scoutResultsCommand);

scoutCmd
	.command("init")
	.description("Scaffold a new scout")
	.argument("<name>", "Scout name (becomes directory name)")
	.option("-t, --topics <topics>", "Comma-separated topics")
	.option("-l, --languages <langs>", "Comma-separated languages")
	.option("-f, --force", "Overwrite existing scout")
	.action(scoutInitCommand);

scoutCmd
	.command("status")
	.description("One-line-per-scout fleet summary of the latest run")
	.action(scoutStatusCommand);

scoutCmd
	.command("tail")
	.description("Follow a scout's in-flight run by watching iteration sidecars")
	.argument("<name>", "Scout name to tail")
	.option(
		"-i, --interval <ms>",
		"Poll interval in milliseconds (default 2000)",
		"2000",
	)
	.action(scoutTailCommand);

program.parse();
