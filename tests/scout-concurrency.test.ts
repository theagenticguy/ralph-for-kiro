import { describe, expect, test } from "bun:test";

/**
 * Black-box test of the concurrency drain pattern used by
 * runScoutsWithConcurrency (src/commands/scout.ts). We can't import that
 * function directly — it's file-private — but the pattern is small enough
 * to replicate and assert here so regressions in the ordering / error
 * handling contract land as test failures rather than production surprises.
 */
async function drainWithConcurrency<T>(
	items: T[],
	concurrency: number,
	task: (item: T) => Promise<boolean>,
): Promise<Array<{ item: T; ok: boolean; error?: string }>> {
	const queue = [...items];
	const results: Array<{ item: T; ok: boolean; error?: string }> = [];
	const workers: Promise<void>[] = [];
	const n = Math.min(concurrency, items.length);

	for (let i = 0; i < n; i++) {
		workers.push(
			(async () => {
				while (queue.length > 0) {
					const item = queue.shift();
					if (item === undefined) break;
					try {
						const ok = await task(item);
						results.push({ item, ok });
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						results.push({ item, ok: false, error: msg });
					}
				}
			})(),
		);
	}

	await Promise.all(workers);

	const ordered: Array<{ item: T; ok: boolean; error?: string }> = [];
	for (const i of items) {
		const r = results.find((x) => x.item === i);
		if (r) ordered.push(r);
	}
	return ordered;
}

describe("concurrency drain pattern", () => {
	test("runs all items with concurrency=1 (sequential)", async () => {
		const items = ["a", "b", "c"];
		const runAt: Array<[string, number]> = [];
		const t0 = Date.now();
		await drainWithConcurrency(items, 1, async (item) => {
			runAt.push([item, Date.now() - t0]);
			await new Promise((r) => setTimeout(r, 50));
			return true;
		});
		// Each start time must be >= previous start time + ~50ms
		for (let i = 1; i < runAt.length; i++) {
			const prev = runAt[i - 1];
			const cur = runAt[i];
			if (!prev || !cur) continue;
			expect(cur[1]).toBeGreaterThanOrEqual(prev[1] + 40);
		}
	});

	test("parallelizes with concurrency=N for N workers", async () => {
		const items = ["a", "b", "c", "d"];
		const t0 = Date.now();
		await drainWithConcurrency(items, 4, async () => {
			await new Promise((r) => setTimeout(r, 50));
			return true;
		});
		const elapsed = Date.now() - t0;
		// All four should finish in ~50ms wall-clock, not 200ms.
		expect(elapsed).toBeLessThan(150);
	});

	test("one failure does not abort the fleet", async () => {
		const items = ["a", "b", "c"];
		const out = await drainWithConcurrency(items, 2, async (item) => {
			if (item === "b") throw new Error("boom");
			return true;
		});
		expect(out.length).toBe(3);
		expect(out.find((x) => x.item === "a")?.ok).toBe(true);
		expect(out.find((x) => x.item === "b")?.ok).toBe(false);
		expect(out.find((x) => x.item === "b")?.error).toBe("boom");
		expect(out.find((x) => x.item === "c")?.ok).toBe(true);
	});

	test("results preserve input order regardless of finish order", async () => {
		const items = ["a", "b", "c"];
		const delays: Record<string, number> = { a: 90, b: 10, c: 50 };
		const out = await drainWithConcurrency(items, 3, async (item) => {
			await new Promise((r) => setTimeout(r, delays[item] ?? 0));
			return true;
		});
		expect(out.map((x) => x.item)).toEqual(["a", "b", "c"]);
	});
});
