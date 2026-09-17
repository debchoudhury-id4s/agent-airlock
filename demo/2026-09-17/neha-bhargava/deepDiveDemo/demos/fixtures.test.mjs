import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFixture, fixtureManifest } from "./fixtures.mjs";

test("named fixture identity is pinned and unexpected content is never rewritten", () => {
  assert.deepEqual(Object.keys(fixtureManifest), ["clean", "secret", "pii", "label", "header-log"]);
  for (const name of Object.keys(fixtureManifest)) {
    assert.match(fixtureManifest[name].sha256, /^[a-f0-9]{64}$/);
    assert.throws(() => validateFixture(name, Buffer.from("unexpected content")), /fixture-content-changed/);
  }
  assert.throws(() => validateFixture("constructor", Buffer.from("unexpected")), /unknown-fixture/);
});
