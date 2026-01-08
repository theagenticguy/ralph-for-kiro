#!/usr/bin/env bun
/**
 * @fileoverview CLI entry point for Ralph Wiggum, an iterative loop technique for Kiro CLI.
 * Registers commands: init, loop, and cancel.
 * @module ralph-wiggum
 */
import { Command } from "commander";

import { cancelCommand, initCommand, loopCommand } from "./commands";
import { VERSION } from "./version";

const program = new Command()
	.name("ralph")
	.description("Ralph Wiggum iterative loop technique for Kiro CLI")
	.version(VERSION);

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

program.parse();
