// Installs the committed HEAD of this repository into a scratch CDK app as a git dependency, which runs the clone,
// `prepare` and pack that a `github:` install by tag runs, and checks what the app then gets.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  throw new Error(`e2e/install.mjs: ${message}`);
}

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function installedVersion(name) {
  return JSON.parse(readFileSync(join(repository, 'node_modules', name, 'package.json'), 'utf8')).version;
}

function checkSingleCopy(app, name) {
  const paths = run('npm', ['ls', name, '--all', '--parseable'], app).trim().split('\n');
  const own = join(app, 'node_modules', name);
  if (paths.length !== 1 || paths[0] !== own) {
    fail(`${name} is installed at ${paths.join(', ')}, expected only ${own}`);
  }
  if (existsSync(join(app, 'node_modules', '@ritenoar', 'cdk', 'node_modules', name))) {
    fail(`@ritenoar/cdk installed a copy of ${name} of its own`);
  }
}

const appSource = `import { App, Stack } from 'aws-cdk-lib';
import {
  Distribution,
  FunctionEventType,
  ResponseHeadersPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CleanUrlsFunction, securityHeadersBehavior } from '@ritenoar/cdk';

const app = new App();
const stack = new Stack(app, 'Site');
const cleanUrls = new CleanUrlsFunction(stack, 'CleanUrls', { canonicalHost: 'example.com', securityHeaders: true });
new CleanUrlsFunction(stack, 'Plain');
new Distribution(stack, 'Distribution', {
  defaultBehavior: {
    origin: new HttpOrigin('example.com'),
    functionAssociations: [{ function: cleanUrls, eventType: FunctionEventType.VIEWER_REQUEST }],
    responseHeadersPolicy: new ResponseHeadersPolicy(stack, 'Headers', { securityHeadersBehavior }),
  },
});
console.log(JSON.stringify(app.synth().getStackByName('Site').template));
`;

function checkTemplate(template) {
  const resources = Object.values(template.Resources);
  const ofType = (type) => resources.filter((resource) => resource.Type === type);
  const functions = ofType('AWS::CloudFront::Function');
  if (functions.length !== 2 || functions.some((fn) => fn.Properties.FunctionConfig.Runtime !== 'cloudfront-js-2.0')) {
    fail('expected two AWS::CloudFront::Function resources on cloudfront-js-2.0');
  }
  if (ofType('AWS::CloudFront::ResponseHeadersPolicy').length !== 1) {
    fail('expected one AWS::CloudFront::ResponseHeadersPolicy resource');
  }
  const [distribution] = ofType('AWS::CloudFront::Distribution');
  const associations = distribution?.Properties.DistributionConfig.DefaultCacheBehavior.FunctionAssociations ?? [];
  if (!associations.some((association) => association.EventType === 'viewer-request')) {
    fail('the default behavior of the distribution has no viewer-request function association');
  }
}

function main() {
  if (run('git', ['status', '--porcelain', '--untracked-files=no'], repository).trim() !== '') {
    fail('a tracked file has a change, and this test installs the committed HEAD. Commit it first');
  }
  const commit = run('git', ['rev-parse', 'HEAD'], repository).trim();
  const app = mkdtempSync(join(tmpdir(), 'ritenoar-cdk-e2e-'));
  try {
    writeFileSync(
      join(app, 'package.json'),
      JSON.stringify({
        name: 'scratch-app',
        private: true,
        dependencies: {
          'aws-cdk-lib': installedVersion('aws-cdk-lib'),
          constructs: installedVersion('constructs'),
          '@ritenoar/cdk': `git+file://${repository}#${commit}`,
        },
        devDependencies: { typescript: installedVersion('typescript'), '@types/node': installedVersion('@types/node') },
      }),
    );
    run('npm', ['install'], app);
    for (const file of ['dist/index.js', 'dist/index.d.ts', 'edge/clean-urls.js']) {
      if (!existsSync(join(app, 'node_modules', '@ritenoar', 'cdk', file))) {
        fail(`${file} is missing from the installed package, so prepare did not run`);
      }
    }
    checkSingleCopy(app, 'aws-cdk-lib');
    checkSingleCopy(app, 'constructs');

    writeFileSync(join(app, 'app.ts'), appSource);
    run(
      join(app, 'node_modules', '.bin', 'tsc'),
      ['--strict', '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'node', '--skipLibCheck', 'app.ts'],
      app,
    );
    checkTemplate(JSON.parse(run('node', ['app.js'], app)));
    console.log(`e2e/install.mjs: passed on ${commit}`);
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
