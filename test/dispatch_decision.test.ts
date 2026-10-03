import assert from "node:assert/strict";
import test from "node:test";
import { dispatchRequestSchema, shouldArmRecharge } from "../src/dispatch_workflow.js";

const dispatchedOrder = dispatchRequestSchema.parse({
  workOrderId: "WO-1842",
  dispatchStatus: "dispatched",
  photos: [{ objectKey: "work-orders/WO-1842/arrival.jpg", capturedAt: "2026-09-29T08:30:00.000Z" }],
  technician: { name: "Mina", followUp: "Confirm pressure after valve replacement" },
  dispatcherEmail: "dispatch@example.com",
  triggerBalance: 20,
  rechargeAmount: 100
});

test("arms recharge for a dispatched work order at the balance threshold", () => {
  assert.equal(shouldArmRecharge(dispatchedOrder, 20), true);
});

test("leaves recharge unchanged when the same work order has enough balance", () => {
  assert.equal(shouldArmRecharge(dispatchedOrder, 20.01), false);
});
