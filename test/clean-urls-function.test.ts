import { readFileSync } from 'fs';
import { join } from 'path';
import { CleanUrlsFunctionProps } from '../src';
import { deployedFunction, deployedHandler, FunctionEvent, Redirect } from './deployed-handler';

const host = 'example.com';
const withEverything: CleanUrlsFunctionProps = { canonicalHost: host, securityHeaders: true };
const expectedSecurityHeaders = {
  'strict-transport-security': { value: 'max-age=31536000' },
  'x-content-type-options': { value: 'nosniff' },
  'x-frame-options': { value: 'SAMEORIGIN' },
  'referrer-policy': { value: 'strict-origin-when-cross-origin' },
};

function requestFor(
  uri: string,
  options: { host?: string; querystring?: FunctionEvent['request']['querystring'] } = {},
): FunctionEvent {
  const headers: FunctionEvent['request']['headers'] = options.host ? { host: { value: options.host } } : {};
  return { request: { uri, headers, querystring: options.querystring ?? {} } };
}

describe('CleanUrlsFunction resource', () => {
  test('is on the cloudfront-js-2.0 runtime and holds the source unchanged', () => {
    const source = readFileSync(join(__dirname, '..', 'edge', 'clean-urls.js'), 'utf8');
    const resource = deployedFunction(withEverything);

    expect(resource.Properties.FunctionConfig.Runtime).toBe('cloudfront-js-2.0');
    expect(resource.Properties.FunctionCode).toContain(source);
  });

  test.each(['', 'https://example.com', 'example.com/', 'Example.com', 'localhost'])(
    'rejects the canonical host %p',
    (canonicalHost) => {
      expect(() => deployedFunction({ canonicalHost })).toThrow(
        `CleanUrlsFunction: canonicalHost must be a host name such as example.com, got "${canonicalHost}"`,
      );
    },
  );
});

describe.each([
  ['with a canonical host and security headers', withEverything],
  ['with no props', undefined],
])('CleanUrlsFunction behavior %s', (_name, props) => {
  const handler = deployedHandler(props);
  const redirectOf = (event: FunctionEvent) => handler(event) as Redirect;
  const locationOf = (event: FunctionEvent) => redirectOf(event).headers.location.value;

  test.each([
    ['/docs/quickstart.html', '/docs/quickstart'],
    ['/docs/index.html', '/docs'],
    ['/index.html', '/'],
    ['/a.html.html', '/a.html'],
    ['/abcd.html', '/abcd'],
    ['/.html', '/'],
  ])('redirects %s to %s', (uri, location) => {
    const redirect = redirectOf(requestFor(uri));

    expect(redirect.statusCode).toBe(301);
    expect(redirect.statusDescription).toBe('Moved Permanently');
    expect(redirect.headers.location.value).toBe(location);
  });

  test.each([
    ['/docs/quickstart', '/docs/quickstart.html'],
    ['/abc', '/abc.html'],
    ['/a', '/a.html'],
    ['/x/index', '/x/index.html'],
  ])('passes %s to the origin as %s', (uri, passed) => {
    expect(handler(requestFor(uri))).toMatchObject({ uri: passed });
  });

  test.each(['/', '/docs/', '/style.css', '/docs/v1.2', '/a.htm'])('passes %s on unchanged', (uri) => {
    expect(handler(requestFor(uri))).toMatchObject({ uri });
  });

  test.each([
    ['one parameter', { mode: { value: 'smoke' } }, '/oled?mode=smoke'],
    ['two parameters', { a: { value: '1' }, b: { value: '2' } }, '/oled?a=1&b=2'],
    [
      'a parameter given twice',
      { tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] } },
      '/oled?tag=a&tag=b',
    ],
    ['a parameter without a value', { flag: { value: '' } }, '/oled?flag'],
    ['an encoded value', { q: { value: 'a%20b' } }, '/oled?q=a%20b'],
    ['no parameters', {}, '/oled'],
  ])('keeps the query string of the .html redirect with %s', (_case, querystring, location) => {
    expect(locationOf(requestFor('/oled.html', { querystring }))).toBe(location);
  });

  test('has no ? in the location of a request without a query string', () => {
    expect(locationOf(requestFor('/oled.html'))).not.toContain('?');
  });

  test('carries the security headers only when asked to', () => {
    const headers = redirectOf(requestFor('/oled.html')).headers;

    expect(headers).toEqual(
      props?.securityHeaders
        ? { location: { value: '/oled' }, ...expectedSecurityHeaders }
        : { location: { value: '/oled' } },
    );
  });
});

describe('CleanUrlsFunction host redirect', () => {
  const handler = deployedHandler(withEverything);
  const redirectOf = (event: FunctionEvent) => handler(event) as Redirect;

  test.each([
    ['/', 'https://example.com/'],
    ['/docs/quickstart', 'https://example.com/docs/quickstart'],
    ['/docs/quickstart.html', 'https://example.com/docs/quickstart.html'],
  ])('redirects www.example.com for %s to %s, before the .html rule', (uri, location) => {
    const redirect = redirectOf(requestFor(uri, { host: `www.${host}` }));

    expect(redirect.statusCode).toBe(301);
    expect(redirect.headers.location.value).toBe(location);
    expect(redirect.headers).toMatchObject(expectedSecurityHeaders);
  });

  test('keeps the query string', () => {
    const event = requestFor('/a', { host: `www.${host}`, querystring: { x: { value: '1' } } });

    expect(redirectOf(event).headers.location.value).toBe('https://example.com/a?x=1');
  });

  test.each([host, `other.${host}`])('does not redirect %s', (requestHost) => {
    expect(handler(requestFor('/docs/quickstart', { host: requestHost }))).toMatchObject({
      uri: '/docs/quickstart.html',
    });
  });

  test('does not redirect www without a canonical host', () => {
    const withoutHost = deployedHandler();

    expect(withoutHost(requestFor('/docs/quickstart', { host: `www.${host}` }))).toMatchObject({
      uri: '/docs/quickstart.html',
    });
  });
});
