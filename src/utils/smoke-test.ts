interface SmokeTestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface SmokeTestReport {
  timestamp: string;
  baseUrl: string;
  tests: SmokeTestResult[];
  passed: number;
  failed: number;
  success: boolean;
}

async function runTest(name: string, baseUrl: string, testFn: () => Promise<void>): Promise<SmokeTestResult> {
  const start = Date.now();
  try {
    await testFn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (error) {
    return { name, passed: false, duration: Date.now() - start, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function runSmokeTests(baseUrl: string): Promise<SmokeTestReport> {
  const tests: SmokeTestResult[] = [];

  tests.push(await runTest('Health endpoint', baseUrl, async () => {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
    const data = await response.json();
    if (data.status !== 'ok') throw new Error(`Health status: ${data.status}`);
  }));

  tests.push(await runTest('API readiness', baseUrl, async () => {
    const response = await fetch(`${baseUrl}/api/auth/health`, { method: 'OPTIONS' });
    if (!response.ok && response.status !== 404) throw new Error(`API check failed: ${response.status}`);
  }));

  tests.push(await runTest('Static assets', baseUrl, async () => {
    const response = await fetch(baseUrl);
    if (!response.ok) throw new Error(`Root page failed: ${response.status}`);
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/html')) throw new Error('Expected HTML content');
  }));

  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  return {
    timestamp: new Date().toISOString(),
    baseUrl,
    tests,
    passed,
    failed,
    success: failed === 0,
  };
}

export function printReport(report: SmokeTestReport): void {
  console.log('\n=== Smoke Test Report ===');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Base URL: ${report.baseUrl}`);
  console.log(`Results: ${report.passed} passed, ${report.failed} failed\n`);

  for (const test of report.tests) {
    const icon = test.passed ? '✓' : '✗';
    console.log(`${icon} ${test.name} (${test.duration}ms)`);
    if (!test.passed && test.error) {
      console.log(`  Error: ${test.error}`);
    }
  }

  console.log(`\nOverall: ${report.success ? 'SUCCESS' : 'FAILED'}\n`);
}

if (process.argv[1]?.includes('smoke-test')) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  runSmokeTests(baseUrl).then(printReport).catch(console.error);
}
