"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type EmailCheckResult =
  | { flow: "password" }
  | { flow: "otp-first-time" }
  | { flow: "not-found" };

async function findUserByEmail(email: string) {
  const admin = getAdminClient();
  const normalized = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const user = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (user) return user;
    if (data.users.length < perPage) return null;
  }

  return null;
}

export async function checkEmailFlow(email: string): Promise<EmailCheckResult> {
  const admin = getAdminClient();
  const user = await findUserByEmail(email);
  if (!user) return { flow: "not-found" };

  // Auto-confirm unconfirmed users (seeded, or signed up but not yet clicked email)
  if (!user.email_confirmed_at) {
    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
  }

  // password_set: true  → set by seeder or completeFirstTimePassword
  // identities.length > 0 → user signed up normally via signUp()
  const hasPassword =
    user.app_metadata?.password_set === true ||
    (Array.isArray(user.identities) && user.identities.length > 0);

  return hasPassword ? { flow: "password" } : { flow: "otp-first-time" };
}

export async function completeFirstTimePassword(password: string, email: string) {
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Verify your OTP before setting a password.");

  if (user.email?.toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error("Session email does not match.");
  }

  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { ...user.app_metadata, password_set: true },
  });

  if (error) throw new Error(error.message);

  return { role: data.user?.user_metadata?.role ?? user.user_metadata?.role };
}
