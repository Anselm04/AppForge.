const prices = { starter: process.env.STRIPE_PRICE_STARTER, builder: process.env.STRIPE_PRICE_BUILDER, studio: process.env.STRIPE_PRICE_STUDIO };

async function appUser(token) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  const user = await appUser(token);
  const price = prices[req.body?.plan];
  if (!user?.id || !user.email || !price) return res.status(401).json({ error: 'Sign in and choose a valid plan.' });
  const appUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (!appUrl || !process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Checkout is not configured yet.' });
  const body = new URLSearchParams({
    mode: 'subscription',
    customer_email: user.email,
    client_reference_id: user.id,
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    payment_method_collection: 'if_required',
    'subscription_data[trial_period_days]': '7',
    'subscription_data[trial_settings][end_behavior][missing_payment_method]': 'pause',
    'subscription_data[metadata][appforge_user_id]': user.id,
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancelled`,
  });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const session = await response.json();
  return response.ok ? res.status(200).json({ url: session.url }) : res.status(500).json({ error: session.error?.message || 'Unable to start checkout.' });
}
