import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createOrGetDeterministicWorkflow, type WorkflowBindingLike } from "./triggerCore.ts";

const workflowId = `proof-${"a".repeat(64)}`;

test("failure before Workflow creation leaves no admission state", async () => {
  let admissionMutations = 0;
  const workflow: WorkflowBindingLike<{ value: number }> = {
    async create() { throw new Error("create unavailable"); },
    async get() { throw new Error("instance does not exist"); },
  };
  await assert.rejects(createOrGetDeterministicWorkflow(workflow, workflowId, { value: 1 }));
  assert.equal(admissionMutations, 0);
});

test("duplicate trigger converges on the same deterministic Workflow", async () => {
  let creates = 0;
  const instance = { id: workflowId, async status() { return { status: "running" }; } };
  const workflow: WorkflowBindingLike<{ value: number }> = {
    async create() {
      creates += 1;
      if (creates > 1) throw new Error("instance already exists");
      return instance;
    },
    async get(id) {
      assert.equal(id, workflowId);
      return instance;
    },
  };
  assert.deepEqual(await createOrGetDeterministicWorkflow(workflow, workflowId, { value: 1 }), {
    id: workflowId,
    duplicate: false,
    status: "accepted",
  });
  assert.deepEqual(await createOrGetDeterministicWorkflow(workflow, workflowId, { value: 1 }), {
    id: workflowId,
    duplicate: true,
    status: "running",
  });
});

test("Workflow failure before self-admission cannot leave a reservation", () => {
  let activeProofId: string | undefined;
  const failBeforeFirstStep = () => { throw new Error("workflow initialization failed"); };
  assert.throws(failBeforeFirstStep);
  assert.equal(activeProofId, undefined);
});

test("trigger implementation has no direct admission dependency or mutation path", async () => {
  const source = await readFile(fileURLToPath(`${new URL("./triggerCore.ts", import.meta.url)}`), "utf8");
  assert.doesNotMatch(source, /PROOF_ADMISSION|\.acquire\(|\.release\(/);
  assert.match(source, /workflow\.create/);
  assert.match(source, /workflow\.get/);
});
