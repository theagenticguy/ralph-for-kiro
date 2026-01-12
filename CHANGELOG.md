# Changelog

## 1.0.0 (2026-01-12)


### ⚠ BREAKING CHANGES

* Complete rewrite of the Ralph Wiggum CLI

### Features

* bun and json write with better prompts ([ca4c974](https://github.com/theagenticguy/ralph-for-kiro/commit/ca4c974a6221c83b1ad83b9fb98efb4d0bb817bd))
* **ci:** add release-please workflow and GitHub release automation ([#1](https://github.com/theagenticguy/ralph-for-kiro/issues/1)) ([833c8f7](https://github.com/theagenticguy/ralph-for-kiro/commit/833c8f70df31272b97656b7fefb69bd8a455a94a))
* rewrite CLI from Python to TypeScript/Bun 1.3 ([4b6dbdd](https://github.com/theagenticguy/ralph-for-kiro/commit/4b6dbdd547a42e33a2e53be1b2103b935c3f101d))
* tests and readme ([88ef552](https://github.com/theagenticguy/ralph-for-kiro/commit/88ef5523730e45fb4f444302dbd2fdaf474f68b8))
* uber init ([faca3bf](https://github.com/theagenticguy/ralph-for-kiro/commit/faca3bf8cbb987bdf6224cd76a3da9f45d3cf98c))


### Bug Fixes

* **cli:** pass prompt as positional arg + clear stale state on start ([069c005](https://github.com/theagenticguy/ralph-for-kiro/commit/069c005ad369e99a64a2bfc16917c591bcd9bd61))
* **feedback:** sanitize extracted text to remove control characters ([935dd5d](https://github.com/theagenticguy/ralph-for-kiro/commit/935dd5d537419b2d9ac506f89e1816c835c7f7b9))
* **security:** prevent ReDoS in extractTagContent ([#9](https://github.com/theagenticguy/ralph-for-kiro/issues/9)) ([344014d](https://github.com/theagenticguy/ralph-for-kiro/commit/344014dcc956a57b09d9f6309467c74f11885652))
* **session:** add defensive measures against memory corruption ([9456343](https://github.com/theagenticguy/ralph-for-kiro/commit/9456343e945fc51beee58e8f3225c40e4881563d))
* **session:** resolve path before SQLite query + add structured feedback ([db007c8](https://github.com/theagenticguy/ralph-for-kiro/commit/db007c84d16ae08fb84a13bec39b2af54df76212))
* **sqlite:** use bun:sqlite Database class instead of Bun.SQL ([96dfe7c](https://github.com/theagenticguy/ralph-for-kiro/commit/96dfe7ca188659a936d8b10e9d2376e08e245dce))
