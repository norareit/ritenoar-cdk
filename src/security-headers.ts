import { Duration } from 'aws-cdk-lib';
import { HeadersFrameOption, HeadersReferrerPolicy, ResponseSecurityHeadersBehavior } from 'aws-cdk-lib/aws-cloudfront';

const maxAge = Duration.seconds(31536000);
const frameOption = HeadersFrameOption.SAMEORIGIN;
const referrerPolicy = HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN;

/** The security headers of every answer a site's origin gives, for a `ResponseHeadersPolicy`. */
export const securityHeadersBehavior: ResponseSecurityHeadersBehavior = {
  strictTransportSecurity: { accessControlMaxAge: maxAge, override: true },
  contentTypeOptions: { override: true },
  frameOptions: { frameOption, override: true },
  referrerPolicy: { referrerPolicy, override: true },
};

// The redirects of the clean URLs function are answered by the distribution without the response headers policy, so
// the function carries these values itself. They are made from the same constants as the behavior above.
export const securityHeaderValues: Readonly<Record<string, string>> = {
  'strict-transport-security': `max-age=${maxAge.toSeconds()}`,
  'x-content-type-options': 'nosniff',
  'x-frame-options': frameOption,
  'referrer-policy': referrerPolicy,
};
