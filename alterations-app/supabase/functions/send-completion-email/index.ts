// Supabase Edge Function: send-completion-email
//
// Triggered by a Database Webhook on the `alterations` table (UPDATE event).
// When a ticket's `completed` flips from false to true, emails the
// salesperson so they know to notify the customer.
//
// Required secrets (set via Supabase Dashboard -> Edge Functions -> Secrets,
// or `supabase secrets set`):
//   RESEND_API_KEY  - API key from https://resend.com
//   RESEND_FROM     - optional, e.g. "Boyds Alterations <alerts@boydsphila.com>"
//                     Defaults to Resend's shared test sender, which can only
//                     deliver to the email address the Resend account was
//                     signed up with until a sending domain is verified.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Boyds Alterations <onboarding@resend.dev>";
const SALESPERSON_EMAIL_DOMAIN = "boydsphila.com";

function emailForSalesperson(name: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const firstInitial = parts[0][0]?.toLowerCase().replace(/[^a-z]/g, "");
  const lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, "");
  if (!firstInitial || !lastName) return null;

  return `${firstInitial}${lastName}@${SALESPERSON_EMAIL_DOMAIN}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.json();
  const record = payload.record;
  const oldRecord = payload.old_record;

  const justCompleted = record?.completed === true && oldRecord?.completed !== true;
  if (!justCompleted) {
    return new Response(JSON.stringify({ skipped: "not a completion transition" }), { status: 200 });
  }

  const toEmail = emailForSalesperson(record.salesperson);
  if (!toEmail) {
    return new Response(
      JSON.stringify({ skipped: `no derivable email for salesperson "${record.salesperson}"` }),
      { status: 200 },
    );
  }

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }

  const items = [record.item_1, record.item_2, record.item_3, record.item_4].filter(Boolean);

  const subject = `Ready for pickup: ${record.customer_name} (Tag #${record.hanger_tag_number})`;
  const html = `
    <p>Hi,</p>
    <p>The alteration below is complete and ready for pickup at <strong>${record.destination_store}</strong>.</p>
    <table cellpadding="4" cellspacing="0">
      <tr><td><strong>Customer</strong></td><td>${record.customer_name}</td></tr>
      <tr><td><strong>Hanger tag #</strong></td><td>${record.hanger_tag_number}</td></tr>
      <tr><td><strong>Store</strong></td><td>${record.destination_store}</td></tr>
      <tr><td><strong>Date sold</strong></td><td>${formatDate(record.date_sold)}</td></tr>
      <tr><td><strong>Date due</strong></td><td>${formatDate(record.date_due)}</td></tr>
      ${record.fitter ? `<tr><td><strong>Fitter</strong></td><td>${record.fitter}</td></tr>` : ""}
      ${items.length ? `<tr><td><strong>Items</strong></td><td>${items.join(", ")}</td></tr>` : ""}
    </table>
    <p>— Boyds Alterations</p>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [toEmail],
      subject,
      html,
    }),
  });

  const resendResult = await resendResponse.json();

  if (!resendResponse.ok) {
    console.error("Resend error:", resendResult);
    return new Response(JSON.stringify({ error: resendResult }), { status: 502 });
  }

  return new Response(JSON.stringify({ sent_to: toEmail, resend: resendResult }), { status: 200 });
});
