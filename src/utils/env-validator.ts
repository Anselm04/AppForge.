/**
 * Environment Variable Validator
 * Runtime validation for environment variables
 */

export interface EnvConfig {
  NODE_ENV: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  REDIS_URL?: string;
  SENTRY_DSN?: string;
  VITE_SENTRY_DSN?: string;
  DATABASE_URL?: string;
  SUPABASE_DB_URL?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnv(config: Partial<EnvConfig> = process.env as any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = config.NODE_ENV === 'production';
  
  // NODE_ENV validation
  if (!config.NODE_ENV) {
    errors.push('NODE_ENV is not set. Set to development, staging, or production.');
  } else if (!['development', 'staging', 'production', 'test'].includes(config.NODE_ENV)) {
    warnings.push(`NODE_ENV is "${config.NODE_ENV}". Expected: development, staging, production, or test.`);
  }
  
  // Database validation (required)
  if (!config.SUPABASE_URL && !config.DATABASE_URL && !config.SUPABASE_DB_URL) {
    if (isProduction) {
      errors.push('Database connection required: Set SUPABASE_URL, DATABASE_URL, or SUPABASE_DB_URL');
    } else {
      warnings.push('No database connection configured.');
    }
  } else {
    const dbUrl = config.SUPABASE_URL || config.DATABASE_URL || config.SUPABASE_DB_URL;
    if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('https://')) {
      errors.push('Invalid database URL format. Expected postgresql:// or https://');
    }
  }
  
  // Stripe validation (optional)
  if (config.STRIPE_SECRET_KEY && !config.STRIPE_SECRET_KEY.startsWith('sk_')) {
    errors.push('Invalid STRIPE_SECRET_KEY format. Should start with sk_');
  }
  if (config.STRIPE_SECRET_KEY?.includes('sk_test_') && isProduction) {
    errors.push('Test Stripe key (sk_test_) used in production environment');
  }
  if (config.STRIPE_WEBHOOK_SECRET && !config.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    errors.push('Invalid STRIPE_WEBHOOK_SECRET format. Should start with whsec_');
  }
  
  // Redis validation (optional)
  if (config.REDIS_URL && !config.REDIS_URL.startsWith('redis://') && !config.REDIS_URL.startsWith('rediss://')) {
    errors.push('Invalid REDIS_URL format. Expected redis:// or rediss://');
  }
  
  // Security warnings
  const weakSecrets = ['password', 'secret', 'changeme', '123456', 'admin'];
  Object.entries(config).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length < 16) {
      if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')) {
        if (weakSecrets.some(weak => value.toLowerCase().includes(weak))) {
          warnings.push(`Weak secret detected for ${key}. Use a strong, randomly generated value.`);
        }
      }
    }
  });
  
  return { valid: errors.length === 0, errors, warnings };
}

export function validateEnvOrThrow(config: Partial<EnvConfig> = process.env as any): void {
  const result = validateEnv(config);
  if (!result.valid) {
    console.error('❌ Environment validation failed:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    throw new Error('Environment validation failed');
  }
  if (result.warnings.length > 0 && isProduction) {
    console.warn('⚠️ Environment warnings in production:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }
}

export function getEnvSummary(config: Partial<EnvConfig> = process.env as any): string {
  return [
    'Environment Configuration:',
    `  NODE_ENV: ${config.NODE_ENV || '❌ Not set'}`,
    `  Supabase: ${config.SUPABASE_URL ? '✅' : '❌'}`,
    `  Stripe: ${config.STRIPE_SECRET_KEY ? '✅' : '❌'}`,
    `  Redis: ${config.REDIS_URL ? '✅' : '❌'}`,
    `  Sentry: ${config.SENTRY_DSN ? '✅' : '❌'}`,
  ].join('\n');
}

export default { validateEnv, validateEnvOrThrow, getEnvSummary };
