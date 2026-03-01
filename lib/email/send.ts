import { Resend } from 'resend';

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

export async function sendDigestEmail(
  subject: string,
  html: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const resend = getResendClient();
    const buyerEmail = process.env.BUYER_EMAIL || 'jpsthesecond@gmail.com';

    const { data, error } = await resend.emails.send({
      from: 'DealFlow <onboarding@resend.dev>',
      to: buyerEmail,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Send failed:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Sent successfully. ID: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Email] Exception:', msg);
    return { success: false, error: msg };
  }
}
