import { z } from "zod";
import type { InfraiClient } from "./infrai_client.js";

export const dispatchRequestSchema = z.object({
  workOrderId: z.string().min(1),
  dispatchStatus: z.enum(["scheduled", "dispatched", "completed"]),
  photos: z.array(z.object({
    objectKey: z.string().min(1),
    capturedAt: z.string().datetime()
  })).min(1),
  technician: z.object({
    name: z.string().min(1),
    followUp: z.string().min(1)
  }),
  dispatcherEmail: z.string().email(),
  triggerBalance: z.number().nonnegative(),
  rechargeAmount: z.number().positive()
}).strict();

export type DispatchRequest = z.infer<typeof dispatchRequestSchema>;

export function shouldArmRecharge(input: DispatchRequest, balance: number): boolean {
  return input.dispatchStatus === "dispatched" && balance <= input.triggerBalance;
}

export async function protectDispatchedWork(
  infrai: InfraiClient,
  input: DispatchRequest
): Promise<{ workOrderId: string; rechargeConfigured: boolean; notificationMessageId: string | null }> {
  const { balance } = await infrai.account.balance();
  if (!shouldArmRecharge(input, balance)) {
    return { workOrderId: input.workOrderId, rechargeConfigured: false, notificationMessageId: null };
  }

  // The same client carries one credential and base URL across account control and email delivery.
  await infrai.account.autorecharge.configure({
    trigger_balance: input.triggerBalance,
    recharge_amount: input.rechargeAmount
  });
  const notification = await infrai.email.send({
    to: input.dispatcherEmail,
    subject: `Recharge protection active for ${input.workOrderId}`,
    html: `<p>${input.technician.name} remains dispatched.</p><p>Follow-up: ${input.technician.followUp}</p><p>Photos recorded: ${input.photos.length}</p>`
  });

  return {
    workOrderId: input.workOrderId,
    rechargeConfigured: true,
    notificationMessageId: notification.message_id
  };
}
