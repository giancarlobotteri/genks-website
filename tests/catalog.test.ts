import assert from "node:assert/strict";
import test from "node:test";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultFilters, filterBeats } from "../src/lib/catalog.ts";
import { formatTime } from "../src/lib/format.ts";
import { mockBeats } from "../src/data/mock/beats.ts";
import { mockLicenses } from "../src/data/mock/licenses.ts";

test("unpublished music never appears in public search, even when saved", () => {
  const unpublished = { ...mockBeats[0], status: "draft" as const };
  assert.deepEqual(
    filterBeats([unpublished], { ...defaultFilters, favoritesOnly: true }, [
      unpublished.id,
    ]),
    [],
  );
});

test("search is case-insensitive, trims whitespace and combines with genre and tempo", () => {
  const matches = filterBeats(mockBeats, {
    ...defaultFilters,
    query: "  ChRoMe  ",
    genre: "Trap",
    bpm: "140plus",
  });
  assert.deepEqual(
    matches.map((beat) => beat.slug),
    ["chrome-hearts"],
  );
  assert.equal(
    filterBeats(mockBeats, {
      ...defaultFilters,
      query: "chrome",
      genre: "Afro",
    }).length,
    0,
  );
});

test("tempo groups have no overlap or gaps at their boundaries", () => {
  const boundaries = [119, 120, 139, 140].map((bpm) => ({
    ...mockBeats[0],
    bpm,
  }));
  const tempos = (bpm: string) =>
    filterBeats(boundaries, { ...defaultFilters, bpm }).map((beat) => beat.bpm);
  assert.deepEqual(tempos("under120"), [119]);
  assert.deepEqual(tempos("120to139"), [120, 139]);
  assert.deepEqual(tempos("140plus"), [140]);
});

test("saved-only view intersects with mood and key filters", () => {
  const saved = mockBeats.map((beat) => beat.id);
  const matches = filterBeats(
    mockBeats,
    { ...defaultFilters, favoritesOnly: true, mood: "Melodic", key: "D min" },
    saved,
  );
  assert.deepEqual(
    matches.map((beat) => beat.slug),
    ["low-tide"],
  );
  assert.equal(
    filterBeats(mockBeats, { ...defaultFilters, favoritesOnly: true }, [])
      .length,
    0,
  );
});

test("every initial catalog cover and enabled license resolves", () => {
  const slugs = new Set();
  for (const beat of mockBeats) {
    assert.equal(slugs.has(beat.slug), false, `Duplicate slug ${beat.slug}`);
    slugs.add(beat.slug);
    assert.equal(beat.isDemo, false);
    for (const resource of [beat.cover]) {
      assert.ok(
        statSync(
          fileURLToPath(new URL(`../public${resource}`, import.meta.url)),
        ).size > 0,
        resource,
      );
    }
    for (const id of beat.licenseIds)
      assert.ok(
        mockLicenses.some((license) => license.id === id),
        id,
      );
  }
});

test("player time labels handle missing metadata and duration boundaries", () => {
  assert.equal(formatTime(NaN), "0:00");
  assert.equal(formatTime(Infinity), "0:00");
  assert.equal(formatTime(-1), "0:00");
  assert.equal(formatTime(59.9), "0:59");
  assert.equal(formatTime(60), "1:00");
});
