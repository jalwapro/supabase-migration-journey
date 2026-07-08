/**
 * Server functions for sending email.
 * `sendEmail` is admin-gated (requires signed-in admin).
 * For system-triggered sends (OTP, receipts), import sendMailServer directly
 * from within another authenticated server fn / server route.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
});

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    // admin-only
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc(
      "has_role",
      { _user_id: context.userId, _role: "admin" },
    );
    if (roleErr || !isAdmin) {
      throw new Error("Forbidden: admin only");
    }

    const { sendMailServer } = await import("@/lib/email.server");
    const result = await sendMailServer({
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    });
    return result;
  });
