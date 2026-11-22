
async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName =
    process.env.BREVO_SENDER_NAME || 'DGEP';

  if (!apiKey || !senderEmail) {
    throw new Error('Brevo email configuration is missing');
  }

  const response = await fetch(
    'https://api.brevo.com/v3/smtp/email',
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(20000),
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Brevo API error:', response.status, result);
    throw new Error(
      result.message || `Brevo email failed: HTTP ${response.status}`
    );
  }

  console.log('Brevo email accepted:', result.messageId);

  return result;
}

module.exports = { sendEmail };
