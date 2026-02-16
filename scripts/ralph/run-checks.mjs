import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');

console.log('=== Running edge function tests ===');
try {
  const testResult = execSync(
    'npx vitest run tests/unit/edge-functions/parse-recipe.test.ts --reporter=verbose 2>&1',
    { cwd: projectRoot, encoding: 'utf8', timeout: 120000 }
  );
  console.log(testResult);
} catch (e) {
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log('Test exit code:', e.status);
}

console.log('\n=== Running npm build ===');
try {
  const buildResult = execSync('npm run build 2>&1', {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 120000
  });
  console.log(buildResult);
} catch (e) {
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log('Build exit code:', e.status);
}
