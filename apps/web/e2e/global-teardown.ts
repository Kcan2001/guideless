import { createClient } from "@supabase/supabase-js";

/**
 * Removes everything the end-to-end run created.
 *
 * Not optional tidiness. These specs sign travelers up and book seats, and without this the
 * leftovers accumulate across runs until they break unrelated tests: a filled 14-seat departure
 * turned every booking spec into "Departure is sold out", and abandoned Trip Builder drafts broke a
 * pgTAP test that had assumed it was the only writer. Test data that outlives its test becomes
 * somebody else's flake.
 *
 * Only addresses this suite generates are touched, and only on a stack that handed us a service
 * key, which is the local one.
 */
export default async function globalTeardown(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let removed = 0;
    // Page through, because a full run creates dozens of accounts.
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      const ours = data.users.filter((u) => (u.email ?? "").endsWith("@example.com"));
      for (const u of ours) {
        // Drafts and bookings hold seats, so they go before the account that owns them.
        await admin.from("builder_drafts").delete().eq("user_id", u.id);
        await admin.from("bookings").delete().eq("customer_id", u.id);
        await admin.auth.admin.deleteUser(u.id);
        removed += 1;
      }
      if (data.users.length < 200) break;
    }
    if (removed) console.log(`e2e teardown: removed ${removed} test account(s)`);
  } catch (err) {
    // Never fail a green run over cleanup; report it so it can be fixed.
    console.warn("e2e teardown could not finish:", (err as Error)?.message ?? err);
  }
}
