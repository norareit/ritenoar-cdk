# Clean URLs function and security headers

## Context

The owner hosts three static sites on AWS with CDK: agentrite.dev, norareit.com and ritenoar.com. Each is a private
S3 bucket behind a CloudFront distribution. agentrite.dev and norareit.com each hold their own copy of a CloudFront
Function, `cdk/edge/clean-urls.js`, that serves an extensionless path from its `.html` file and redirects a `.html`
path to its extensionless form. ritenoar.com is about to gain a third copy. Both existing sites also define the same
four security headers in a `security-headers.ts` of their own, and give the same values a second time to the
function, whose redirects are answered outside the distribution's response headers policy and so must carry the
headers themselves.

The copies have already drifted. agentrite.dev's function redirects `www.agentrite.dev` to `agentrite.dev` and holds
a safe `endsWith` of its own; norareit.com's has no host redirect and has the headers prepended to its source by the
stack. Each site tests the function and the agreement of the two header sets separately.

This project, `@ritenoar/cdk`, is where what the sites share in their infrastructure is kept once. Its first unit
makes the package itself and moves the function and the security headers into it.

## Requirements

1. The repository is an npm package named `@ritenoar/cdk`. A CDK app in TypeScript installs it from the public GitHub
   repository `norareit/ritenoar-cdk` by a git tag, as `github:norareit/ritenoar-cdk#v<version>`, with nothing
   more than `npm install` and no credentials, and imports from it with `import { ... } from '@ritenoar/cdk'`
2. The package declares `aws-cdk-lib` and `constructs` as peer dependencies, with ranges that admit the versions the
   three sites use today, and does not install a copy of either of its own for the app that uses it
3. The package exports a construct for the clean URLs function, a CloudFront Function on the `cloudfront-js-2.0`
   runtime that a site associates with the viewer requests of its distribution. The function answers each request
   as follows:
    1. When the construct is given a canonical host and the request's host is that host prefixed with `www.`, it
       answers with a 301 redirect to `https://<canonical host><path>`, before any rule below
    2. A path that ends in `.html` is answered with a 301 redirect to the same path without `.html`, and without a
       final `/index` left after that, with `/` in place of an empty result. So `/docs/quickstart.html` redirects to
       `/docs/quickstart`, `/docs/index.html` to `/docs` and `/index.html` to `/`
    3. A path other than `/` whose last segment is not empty and holds no dot is passed to the origin with `.html`
       appended, so `/docs/quickstart` asks the bucket for `/docs/quickstart.html`
    4. Every other request, `/`, a path ending in `/` and a path whose last segment holds a dot, is passed to the
       origin unchanged
    5. A path shorter than a suffix it is compared with, such as `/a` against `.html`, is handled by the rules above
       without error
    6. Each redirect of rules 1 and 2 keeps the request's query string: its `location` holds the same parameters with
       the same values, a parameter given more than once and one without a value included. So
       `/oled.html?mode=smoke` redirects to `/oled?mode=smoke`, and `www.<canonical host>/a?x=1` to
       `https://<canonical host>/a?x=1`. A request without a query string is redirected to a `location` with no `?`
4. The package exports the security headers once, as the `ResponseSecurityHeadersBehavior` a site gives its response
   headers policies: `Strict-Transport-Security` with a `max-age` of 31536000 seconds and no `includeSubDomains` or
   `preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` and
   `Referrer-Policy: strict-origin-when-cross-origin`, each with `override` set. These are the values both sites send
   today
5. When the clean URLs construct is told to send the security headers, every redirect the function answers carries
   exactly the headers of requirement 4, with the same values, taken from the same definition in the package. When it
   is not, a redirect carries only its `location`
6. The function's behavior in requirements 3 and 5 is covered by unit tests that run the function's source as the
   construct deploys it, and the agreement of requirement 5 is covered by a test that compares the function's
   headers with the exported behavior
7. The README says what the package holds, how a site installs it at a tag, how a site's stack uses each export, with
   an example for a site with security headers and a canonical host and one for a site with neither, and how a new
   version is released
8. A release is a git tag `v<version>` on a commit whose `package.json` holds that version. The first release is
   `v0.1.0`

## Decisions

- **Agentrite.dev's function is the base.** It is the newer of the two and has the two things norareit.com's lacks:
  the host redirect and an `endsWith` that is safe for a path shorter than the suffix. The host redirect becomes an
  option, since norareit.com and ritenoar.com do not have one today
- **The construct owns both the function and its headers, and a site chooses only whether to send them.** Both sites
  send the same four headers, and the reason they are defined twice in each site is that the function needs them as
  source text. One definition in the package, from which both the policy's behavior and the function's text are
  made, removes the drift that each site now guards with a test of its own. Rejected: letting a site pass headers of
  its own, which no site needs and which would bring the second definition back
- **The canonical host is given, not derived.** A site states the host it redirects to, such as `agentrite.dev`, and
  `www.` is the only alias redirected. A site that wants no host redirect leaves it out. Rejected: redirecting any
  host other than the canonical one, which would also catch the CloudFront domain the stacks output for use before
  DNS cuts over
- **Installed from git by a tag, not from a registry.** The repository is public, so `npm install` fetches it
  without credentials, on the host and in the sandbox. A registry would add an npm organization and a token to
  publish with, for a package with one owner and three users. A tag pins each site to a release, and moving a site
  to a newer one is a change to its `package.json` and lockfile, as for any dependency
- **The package is TypeScript, compiled when it is installed.** npm runs a git dependency's `prepare` script after
  installing its development dependencies, so the compiled JavaScript and type declarations are made on install and
  are not committed. Rejected: committing the compiled output, which can disagree with the source it was built from;
  shipping TypeScript sources alone, which the sites' `ts-node` and `tsc` do not compile inside `node_modules`
- **`aws-cdk-lib` and `constructs` are peer dependencies.** A construct made with one copy of `aws-cdk-lib` cannot be
  added to a stack made with another, so the package must use the site's copy. They are also development
  dependencies here, so that the package builds and its tests run on their own
- **The function's source stays a plain JavaScript file in the package.** The `cloudfront-js-2.0` runtime takes a
  script with a `handler` function and no modules, and the sites' tests already load it that way. What the
  construct adds to it, the canonical host and the headers, is declared ahead of that source, as norareit.com does
  for its headers, so that the tested source and the deployed source are the same text
- **The query string survives every redirect.** Both sites drop it today, so a page that reads it, such as
  ritenoar.com's coming `/oled?mode=smoke`, loses its parameters when it is asked for by its `.html` path or on the
  `www.` host. Keeping it on the host redirect as well as on the `.html` one makes the two redirects alike, and the
  same link works whichever form of the URL it was written in. This is a change from what both sites do, made on
  purpose, and a site that moves onto the package gains it. Rejected: keeping it on the `.html` redirect alone, which
  would leave the `www.` form of the same link broken
- **Only the function and the headers move in this unit.** They are what has drifted and what ritenoar.com is about
  to copy. The rest of the three site stacks is also alike and is listed below as an option, since moving it touches
  every resource of three deployed stacks

## Non-goals

- Moving any of the three sites onto the package. Each site does that in a unit of its own, in its own repository
- A construct for the whole static site: the bucket, the distribution, the certificate, the DNS records and the
  deployment
- The font caching policy that agentrite.dev and norareit.com share
- A content security policy, or `includeSubDomains` or `preload` on `Strict-Transport-Security`
- Publishing to the npm registry
- Continuous integration for this repository

## Beyond the request

1. **A construct for the whole static site.** It would cost a construct that makes the private bucket with origin
   access control, the distribution with its error responses, the A records for the apex and `www`, the bucket
   deployment and the two outputs, with options for what differs: the domain, the error page, extra behaviors and
   extra records. Each site's move onto it would replace its stack's resources with resources of new logical IDs
   unless the construct keeps the old ones, which makes the move a careful deploy. Without it, the three
   `site-stack.ts` files stay near copies of one another and drift as the functions did
2. **The font caching policy.** It would cost one exported policy, or a helper, that repeats the security headers and
   adds a year of `Cache-Control` for files whose URL changes with their content, as both sites now define
   separately. Without it, two sites keep a copy each
