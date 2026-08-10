export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });

    // If SENDGRID_API_KEY and CONTACT_TO_EMAIL are set, send via SendGrid
    if (process.env.SENDGRID_API_KEY && process.env.CONTACT_TO_EMAIL) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: process.env.CONTACT_TO_EMAIL }] }],
          from: { email: process.env.CONTACT_FROM_EMAIL || 'no-reply@example.com' },
          subject: `Portfolio contact from ${name}`,
          content: [
            { type: 'text/plain', value: `Name: ${name}\nEmail: ${email}\n\n${message}` },
          ],
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('SendGrid error', text);
        return res.status(500).json({ error: 'Email send failed' });
      }
      return res.status(200).json({ ok: true });
    }

    // Fallback: log submission to server logs
    console.log('Contact submission:', { name, email, message });
    return res.status(200).json({ ok: true, note: 'No email provider configured. Set SENDGRID_API_KEY and CONTACT_TO_EMAIL to enable.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
