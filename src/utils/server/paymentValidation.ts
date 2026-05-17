import { z } from "zod";

export const createRazorpayOrderSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be greater than zero.")
    .max(500000, "Amount exceeds allowed limit."),
  receipt: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{3,64}$/, "Invalid receipt value.")
    .optional(),
});

export const verifyRazorpayPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1, "Missing razorpay_order_id."),
  razorpay_payment_id: z.string().trim().min(1, "Missing razorpay_payment_id."),
  razorpay_signature: z.string().trim().min(1, "Missing razorpay_signature."),
});

export const razorpayWebhookEnvelopeSchema = z.object({
  event: z.string().min(1),
});

export const getZodErrorMessage = (error: z.ZodError) => {
  const firstIssue = error.issues[0];
  return firstIssue?.message || "Invalid request payload.";
};
