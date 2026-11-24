import { securityHeadersBehavior } from '../src';
import { deployedHandler, Redirect } from './deployed-handler';

test('the headers of a redirect agree with securityHeadersBehavior', () => {
  const handler = deployedHandler({ securityHeaders: true });
  const { location, ...headers } = (handler({ request: { uri: '/a.html', headers: {}, querystring: {} } }) as Redirect)
    .headers;
  const { strictTransportSecurity, contentTypeOptions, frameOptions, referrerPolicy } = securityHeadersBehavior;

  expect(location.value).toBe('/a');
  expect(headers).toEqual({
    'strict-transport-security': { value: `max-age=${strictTransportSecurity!.accessControlMaxAge.toSeconds()}` },
    'x-content-type-options': { value: contentTypeOptions ? 'nosniff' : undefined },
    'x-frame-options': { value: frameOptions!.frameOption },
    'referrer-policy': { value: referrerPolicy!.referrerPolicy },
  });
});
