import { Function as CloudFrontFunction, FunctionCode, FunctionRuntime } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { securityHeaderValues } from './security-headers';

export interface CleanUrlsFunctionProps {
  /**
   * The host that `www.` followed by it redirects to, such as `example.com`. No host is redirected when it is left
   * out.
   */
  readonly canonicalHost?: string;
  /**
   * Whether the function's redirects carry the security headers of `securityHeadersBehavior`. They are `false` when
   * left out.
   */
  readonly securityHeaders?: boolean;
}

const hostName = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// Holds from src/ under ts-jest and from dist/ when installed, since edge/ sits beside both.
const sourcePath = join(__dirname, '..', 'edge', 'clean-urls.js');

/**
 * A CloudFront Function for the viewer requests of a distribution. It serves an extensionless path from its `.html`
 * file and redirects a `.html` path to its extensionless form.
 */
export class CleanUrlsFunction extends CloudFrontFunction {
  constructor(scope: Construct, id: string, props: CleanUrlsFunctionProps = {}) {
    const { canonicalHost, securityHeaders = false } = props;
    if (canonicalHost !== undefined && !hostName.test(canonicalHost)) {
      throw new Error(
        `CleanUrlsFunction: canonicalHost must be a host name such as example.com, got "${canonicalHost}"`,
      );
    }
    super(scope, id, {
      code: FunctionCode.fromInline(declarations(canonicalHost, securityHeaders) + readFileSync(sourcePath, 'utf8')),
      runtime: FunctionRuntime.JS_2_0,
    });
  }
}

function declarations(canonicalHost: string | undefined, securityHeaders: boolean): string {
  const headers = securityHeaders ? headerObjects() : {};
  return `var canonicalHost = ${JSON.stringify(canonicalHost ?? null)};\nvar securityHeaders = ${JSON.stringify(headers)};\n`;
}

function headerObjects(): Record<string, { value: string }> {
  return Object.fromEntries(Object.entries(securityHeaderValues).map(([name, value]) => [name, { value }]));
}
