/**
 * Environment Validation CLI
 * Usage: npx tsx scripts/validate-env.ts [--file=.env] [--strict]
 */

import { validateEnv, getEnvSummary } from '../src/utils/env-validator';
import { readFileSync } from 'fs';
import { parse } from 'dotenv';

function parseArgs(): { file: string; strict: boolean } {
  const args = process.argv.slice(2);
  let file = '.env';
  let strict = false;
  
  args.forEach(arg => {
    if (arg.startsWith('--file=')) file = arg.split('=')[1];
    else if (arg === '--strict') strict = true;
  });
  
  return { file, strict };
}

function loadEnvFile(filePath: string): Record<string, string> {
  try {
    return parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`❌ Failed to load ${filePath}: ${error}`);
    process.exit(1);
  }
}

async function main() {
  const { file, strict } = parseArgs();
  console.log(`🔍 Validating environment from ${file}...\n`);
  
  const envConfig = loadEnvFile(file);
  const result = validateEnv(envConfig);
  
  console.log(getEnvSummary(envConfig));
  console.log('');
  
  if (result.errors.length > 0) {
    console.error('❌ Errors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️ Warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  if (result.valid) {
    console.log('✅ Environment validation passed!');
    process.exit(result.warnings.length > 0 && strict ? 1 : 0);
  } else {
    console.error('\n❌ Environment validation failed');
    process.exit(1);
  }
}

main();
