import ApiError from '../utils/ApiError.js';

export async function sendInvoiceReminder({ to, invoiceNumber, amount, currency, dueDate }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new ApiError(503, 'Email reminders are not configured. Add RESEND_API_KEY and REMINDER_FROM_EMAIL to the API environment.');
  }

  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
  const due = dueDate ? new Date(dueDate).toLocaleDateString('en-IN') : 'not provided';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Invoice ${invoiceNumber} needs payment follow-up`,
      text: [
        `This is a reminder to follow up on approved invoice ${invoiceNumber}.`,
        `Amount: ${formattedAmount}`,
        `Due date: ${due}`,
        'Please sign in to the Accounts Payable workspace to review the invoice.',
        'This reminder does not initiate or record a payment.',
      ].join('\n'),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(502, result.message || 'The email provider could not send this reminder. Check the sender setup and try again.');
  return result.id;
}
