const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_APP_URL'];

export function requireEnv(...names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

export function appEnv() {
  return requireEnv(...required);
}

export function billingEnv() {
  return requireEnv(...required, 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_STARTER', 'STRIPE_PRICE_BUILDER', 'STRIPE_PRICE_STUDIO');
}

export function publicAppUrl() {
  const { PUBLIC_APP_URL } = appEnv();
  return PUBLIC_APP_URL.replace(/\/$/, '');
}
