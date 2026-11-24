# @ritenoar/cdk

What the static sites of ritenoar.com, norareit.com and agentrite.dev share in their AWS CDK infrastructure, kept
once. Each site is a private S3 bucket behind a CloudFront distribution.

## What the package holds

* `CleanUrlsFunction`, a construct for a CloudFront Function on the `cloudfront-js-2.0` runtime that a site
  associates with the viewer requests of its distribution. It answers each request as follows, first match first:
    1. With a `canonicalHost`, a request for `www.<canonicalHost>` is a 301 redirect to
       `https://<canonicalHost><path>`
    2. A path ending in `.html` is a 301 redirect to the same path without `.html` and without a final `/index`, with
       `/` in place of an empty result: `/docs/quickstart.html` to `/docs/quickstart`, `/docs/index.html` to `/docs`
       and `/index.html` to `/`
    3. A path other than `/` whose last segment is not empty and holds no dot is passed to the origin with `.html`
       appended, so `/docs/quickstart` asks the bucket for `/docs/quickstart.html`
    4. Every other request is passed to the origin unchanged

  Both redirects keep the query string: `/oled.html?mode=smoke` redirects to `/oled?mode=smoke`, and a parameter given
  more than once or without a value is kept as it was.

  Its props are `canonicalHost`, a host name such as `example.com` that is checked when the construct is made, and
  `securityHeaders`, which is `false` when left out.
* `securityHeadersBehavior`, the `ResponseSecurityHeadersBehavior` a site gives its response headers policies. It
  holds `Strict-Transport-Security` with a `max-age` of 31536000 seconds, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN` and `Referrer-Policy: strict-origin-when-cross-origin`, each with `override` set.

A redirect of the function is answered by the distribution itself, outside its response headers policy. With
`securityHeaders: true` each redirect therefore carries the same four headers, made from the same definition as
`securityHeadersBehavior`, so that a redirect and every other answer of a site send the same values.

## Installing

The repository is public, so a site installs it by a git tag with no credentials:

```sh
npm install github:norareit/ritenoar-cdk#v0.1.0
```

The package compiles itself when it is installed. A site keeps `aws-cdk-lib` and `constructs` as its own dependencies,
which the package takes as peer dependencies (`aws-cdk-lib` `^2.150.0` and `constructs` `^10.0.0`) and does not
install a copy of. Recent npm versions warn that the package's `prepare` script is not covered by `allowScripts`. The
script still runs.

To move a site to a newer release, change the tag in its `package.json` and run `npm install`, which updates its
lockfile. The lockfile holds the commit a tag resolved to, so `npm ci` installs that commit even if a tag is moved.

## Using the exports

A site with security headers and a canonical host:

```ts
import { Distribution, FunctionEventType, ResponseHeadersPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CleanUrlsFunction, securityHeadersBehavior } from '@ritenoar/cdk';

const cleanUrls = new CleanUrlsFunction(this, 'CleanUrls', {
  canonicalHost: 'example.com',
  securityHeaders: true,
});

new Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: S3BucketOrigin.withOriginAccessControl(bucket),
    functionAssociations: [{ function: cleanUrls, eventType: FunctionEventType.VIEWER_REQUEST }],
    responseHeadersPolicy: new ResponseHeadersPolicy(this, 'Headers', { securityHeadersBehavior }),
  },
});
```

A site with neither:

```ts
import { Distribution, FunctionEventType } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CleanUrlsFunction } from '@ritenoar/cdk';

new Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: S3BucketOrigin.withOriginAccessControl(bucket),
    functionAssociations: [
      { function: new CleanUrlsFunction(this, 'CleanUrls'), eventType: FunctionEventType.VIEWER_REQUEST },
    ],
  },
});
```

## Releasing

A release is a git tag `v<version>` on a commit whose `package.json` holds that version. A unit sets the new `version`
in `package.json`. Once it is merged, the tag `v<version>` is made on the merge commit on `master` and pushed with
`git push origin v<version>`. A tag is not moved once pushed. The first release is `v0.1.0`.

## Developing

* `npm ci` installs the dependencies and builds the package through `prepare`
* `npm test` runs the unit tests
* `npm run test:e2e` installs the committed `HEAD` into a scratch CDK app and synthesizes a stack with both exports
* `npm run check-changes` checks the change records
