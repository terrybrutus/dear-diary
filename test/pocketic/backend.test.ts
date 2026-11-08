import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;
let canisterId: CanisterFixture<_SERVICE>["canisterId"];

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  ({ actor, canisterId } = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  }));
});

afterAll(async () => {
  await pic?.tearDown();
});

it("answers the base scaffolding reads instead of trapping", async () => {
  await expect(actor.getApiDoc()).resolves.toEqual(expect.any(String));
  await expect(actor.schema()).resolves.toEqual(expect.any(String));
  await expect(actor.getCallerUserRole()).resolves.toBeDefined();
  await expect(actor.isCallerAdmin()).resolves.toEqual(expect.any(Boolean));
});

it("initializes access control and reports the first signed-in caller as admin", async () => {
  const alice = createIdentity("alice");
  actor.setIdentity(alice);
  await actor._initialize_access_control();
  await expect(actor.isCallerAdmin()).resolves.toBe(true);
  await expect(actor.getCallerUserRole()).resolves.toEqual({ admin: null });
});
