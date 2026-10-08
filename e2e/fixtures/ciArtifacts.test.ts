import * as fs from 'fs';
import * as path from 'path';

/**
 * The smoke job must upload what Playwright writes on failure. Playwright's
 * folders are dot-directories, which actions/upload-artifact (v4.4+) skips
 * unless `include-hidden-files: true` - this keeps the workflow and the
 * Playwright config in step.
 */
const root = path.join(__dirname, '../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const config = fs.readFileSync(path.join(root, 'e2e/playwright.config.ts'), 'utf8');

/** The `with:` block of the upload-artifact step in the smoke job. */
function uploadStep(): string {
  const smoke = workflow.slice(workflow.indexOf('\n  smoke:'));
  const start = smoke.indexOf('actions/upload-artifact@');
  expect(start).toBeGreaterThan(-1);
  const rest = smoke.slice(start);
  const next = rest.indexOf('\n      - ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('CI failure artifacts', () => {
  it('upload the folders Playwright actually writes, hidden ones included', () => {
    const outputDir = config.match(/outputDir:\s*'\.\/([^']+)'/)?.[1];
    const reportDir = config.match(/outputFolder:\s*'\.\/([^']+)'/)?.[1];
    expect(outputDir).toBe('.results');
    expect(reportDir).toBe('.report');
    const step = uploadStep();
    expect(step).toContain(`e2e/${outputDir}`);
    expect(step).toContain(`e2e/${reportDir}`);
    expect(step).toMatch(/include-hidden-files:\s*true/);
  });

  it('run when the smoke suite fails (or times out) and keep what failures need', () => {
    const smoke = workflow.slice(workflow.indexOf('\n  smoke:'));
    const before = smoke.slice(0, smoke.indexOf('actions/upload-artifact@'));
    expect(before.slice(before.lastIndexOf('- if:'))).toMatch(/- if: failure\(\) \|\| cancelled\(\)/);
    expect(config).toMatch(/screenshot:\s*'only-on-failure'/);
    expect(config).toMatch(/trace:\s*'retain-on-failure'/);
  });
});
