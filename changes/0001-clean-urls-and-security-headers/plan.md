# Clean URLs function and security headers

## Approach

The repository becomes a TypeScript npm package whose sources are in `src/`, compiled to `dist/` by a `prepare`
script, so that a git install builds it. The compiled output is ignored, and `files` in `package.json` ships `dist/`
and `edge/`.

The security headers are defined in `src/security-headers.ts` from three constants: the `max-age`, the frame option and
the referrer policy. The module exports `securityHeadersBehavior`, the `ResponseSecurityHeadersBehavior`, and an
internal `securityHeaderValues`, a record of lowercase header name to header value, made from the same constants. Only
`securityHeadersBehavior` is exported from the package's index.

The function's source is `edge/clean-urls.js`, based on agentrite.dev's copy (`agentrite-website/cdk/edge/clean-urls.js`),
with its safe `endsWith`. It names two variables it does not declare, `canonicalHost` (a string or `null`) and
`securityHeaders` (an object of `{ value }` per header name, empty when none are sent). The construct
`CleanUrlsFunction` extends `cloudfront.Function` and takes the props `canonicalHost?: string` and
`securityHeaders?: boolean`, the latter `false` when left out. It reads `edge/clean-urls.js` from
`path.join(__dirname, '..', 'edge', 'clean-urls.js')`, which holds from `src/` under ts-jest and from `dist/` when
installed, puts the two declarations ahead of it with `JSON.stringify` for their values, and passes the text to
`FunctionCode.fromInline` with `FunctionRuntime.JS_2_0`. Because it extends `cloudfront.Function`, a site passes it as
the `function` of a viewer request association like any other function.

The redirects keep the query string by rebuilding it from `request.querystring`, the object the `cloudfront-js-2.0`
runtime gives: one field per parameter name with a `value`, and a `multiValue` array of `{ value }` when the name is
given more than once, in which the first value is repeated. The runtime passes values on as received, so they are
joined without being encoded again. Each value is written as `name=value`, and an empty value as the bare `name`, as
the runtime cannot tell `?flag` from `?flag=`. The parameters are joined with `&` and prefixed with `?`. An empty
object gives no `?`. The values of a name given more than once stay together and in order, which can move them
relative to other names. That keeps every parameter and value, which is what requirement 3.6 asks for.

The behavior tests run the source as the construct deploys it: a helper synthesizes a stack holding the construct with
the props of the case, takes `FunctionCode` from the `AWS::CloudFront::Function` resource of the template and
evaluates it with `vm.runInNewContext`, as agentrite.dev's `test/load-handler.ts` does with the file.

The end-to-end test installs the package into a scratch CDK app as a git dependency of the committed `HEAD`, through
`git+file://`, which runs the same clone, `prepare` and pack that a `github:` install by tag does, with no network
access to GitHub. It compiles a TypeScript stack that imports both exports from `@ritenoar/cdk`, synthesizes it, and
checks that `aws-cdk-lib` and `constructs` are each installed once, at the app's own top level.

The peer ranges are `^2.150.0` for `aws-cdk-lib` and `^10.0.0` for `constructs`, the ranges the three sites declare,
which admit the versions their lockfiles hold today: `aws-cdk-lib` 2.248.0, 2.275.0 and 2.277.0, and `constructs`
10.6.0 and 10.8.1. The development dependencies on the same two are the current releases, `^2.278.0` and `^10.8.1`.

## Files

- `package.json`: name, version `0.1.0`, `main`, `types`, `files`, the scripts `build`, `prepare`, `test` and
  `test:e2e` next to the existing `check-changes`, peer and development dependencies, and the jest configuration
- `package-lock.json`: updated by `npm install`
- `.gitignore`: ignores `dist/`
- `tsconfig.json`: strict type checking of `src/`, `test/` and nothing emitted, for the editor and ts-jest
- `tsconfig.build.json`: extends `tsconfig.json`, compiles `src/` alone to `dist/` with declarations
- `src/index.ts`: exports `CleanUrlsFunction`, `CleanUrlsFunctionProps` and `securityHeadersBehavior`
- `src/security-headers.ts`: the header constants, `securityHeadersBehavior` and `securityHeaderValues`
- `src/clean-urls-function.ts`: the `CleanUrlsFunction` construct and its props
- `edge/clean-urls.js`: the function's source
- `test/deployed-handler.ts`: synthesizes the construct and returns the deployed handler and the function resource
- `test/security-headers.test.ts`: the values of the exported behavior
- `test/clean-urls-function.test.ts`: the behavior of the function and the resource the construct makes
- `test/security-headers-agreement.test.ts`: the redirect headers against the exported behavior
- `e2e/install.mjs`: the end-to-end install test
- `README.md`: new, the package's documentation
- `AGENTS.md`: the project's commands, under "Specific to this project"

## Tasks

### The package

- [x] Set `package.json` to the name `@ritenoar/cdk` and the version `0.1.0`, with `main` set to `dist/index.js`,
  `types` to `dist/index.d.ts` and `files` to `["dist", "edge"]` (R1, R8)
- [x] Add the scripts `"build": "tsc -p tsconfig.build.json"`, `"prepare": "npm run build"` and `"test": "jest"`,
  keeping `check-changes` (R1, R6)
- [x] Add `peerDependencies` of `"aws-cdk-lib": "^2.150.0"` and `"constructs": "^10.0.0"`, and install as development
  dependencies `aws-cdk-lib@^2.278.0`, `constructs@^10.8.1`, `typescript@^5`, `jest@^29`, `ts-jest@^29`,
  `@types/jest@^29` and `@types/node`, which updates `package-lock.json`. No `dependencies` are added (R2)
- [x] Add the jest configuration to `package.json`: `testEnvironment` `node`, `testMatch`
  `["<rootDir>/test/**/*.test.ts"]` and the `ts-jest` transform with `tsconfig.json` (R6)
- [x] Write `tsconfig.json` with `strict`, `target` `ES2020`, `module` `commonjs`, `lib` `["es2020"]`, `types`
  `["node", "jest"]`, `noEmit` and `include` `["src", "test"]`, and `tsconfig.build.json` extending it with
  `noEmit` false, `declaration` true, `rootDir` `src`, `outDir` `dist`, `types` `["node"]` and `include` `["src"]` (R1)
- [x] Add `dist/` to `.gitignore` (R1)
- [x] Write `src/index.ts` with no exports yet, and check that `npm run build` writes `dist/index.js` and
  `dist/index.d.ts` (R1)

### The security headers

- [x] Write `test/security-headers.test.ts`: `securityHeadersBehavior` equals, as a whole, a
  `strictTransportSecurity` of `accessControlMaxAge` `Duration.seconds(31536000)` and `override` true with no
  `includeSubdomains` or `preload`, `contentTypeOptions` with `override` true, `frameOptions` of
  `HeadersFrameOption.SAMEORIGIN` with `override` true and `referrerPolicy` of
  `HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN` with `override` true, comparing the duration by
  `toSeconds()`; and a `ResponseHeadersPolicy` given it synthesizes `SecurityHeadersConfig` with
  `AccessControlMaxAgeSec` 31536000, `FrameOption` `SAMEORIGIN` and `ReferrerPolicy`
  `strict-origin-when-cross-origin`, each `Override` true, and no `XSSProtection` or `ContentSecurityPolicy`. Run it
  and see it fail (R4)
- [x] Write `src/security-headers.ts` with the constants `maxAge` (`Duration.seconds(31536000)`), `frameOption` and
  `referrerPolicy`, and from them `securityHeadersBehavior` and `securityHeaderValues`, the record
  `strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN` and
  `referrer-policy: strict-origin-when-cross-origin`, with a comment that the function's redirects take their headers
  from `securityHeaderValues` because they are answered outside the response headers policy. Export
  `securityHeadersBehavior` from `src/index.ts`. Run the test and see it pass (R4, R5)

### The clean URLs function

- [x] Write `test/deployed-handler.ts`: `deployedFunction(props)` makes an `App` and a `Stack`, adds a
  `CleanUrlsFunction` with the props, and returns the single `AWS::CloudFront::Function` resource of
  `Template.fromStack`; `deployedHandler(props)` evaluates its `Properties.FunctionCode` with
  `runInNewContext(code + '\nthis.handler = handler;', context)` and returns the handler; and the types of the event,
  with `uri`, `headers` and `querystring`, and of a redirect, with `statusCode`, `statusDescription` and `headers` (R6)
- [x] Write `test/clean-urls-function.test.ts`, each case built with `querystring` `{}` unless it is about the query
  string, and the behavior cases run for both a construct with `canonicalHost: 'example.com'` and
  `securityHeaders: true` and one with no props (R3, R5, R6):
    - [x] The resource has `FunctionConfig.Runtime` `cloudfront-js-2.0`, and its `FunctionCode` holds the text of
      `edge/clean-urls.js` unchanged (R3, R6)
    - [x] With the canonical host, a request to `www.example.com` for `/`, for `/docs/quickstart` and for
      `/docs/quickstart.html` is a 301 to `https://example.com` followed by the same path, the last showing the host
      rule comes first; a request to `example.com` and one to `other.example.com` are not host redirects. Without the
      canonical host, a request to `www.example.com` for `/docs/quickstart` is served `/docs/quickstart.html` (R3.1)
    - [x] `/docs/quickstart.html` is a 301 to `/docs/quickstart`, `/docs/index.html` to `/docs`, `/index.html` to `/`,
      `/a.html.html` to `/a.html` and `/abcd.html` to `/abcd`, each with `statusDescription` `Moved Permanently` (R3.2)
    - [x] `/docs/quickstart` is passed on as `/docs/quickstart.html` and `/abc` as `/abc.html` (R3.3)
    - [x] `/`, `/docs/`, `/style.css` and `/docs/v1.2` are passed on unchanged (R3.4)
    - [x] `/a`, `/a.htm`, `/x/index` and `/.html` are answered without throwing: `/a` passed on as `/a.html`, `/a.htm`
      unchanged, `/x/index` as `/x/index.html` and `/.html` a 301 to `/` (R3.5)
    - [x] `/oled.html` with `querystring` `{ mode: { value: 'smoke' } }` is a 301 to `/oled?mode=smoke`; with the
      canonical host, `www.example.com/a` with `{ x: { value: '1' } }` is a 301 to `https://example.com/a?x=1`; a
      parameter given twice, `{ tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] } }`, gives
      `?tag=a&tag=b`; a parameter without a value, `{ flag: { value: '' } }`, gives `?flag`; an encoded value,
      `{ q: { value: 'a%20b' } }`, gives `?q=a%20b`; two parameters give both, joined by `&`; and `querystring` `{}`
      gives a `location` with no `?` (R3.6)
    - [x] With `securityHeaders: true`, each redirect of the cases above carries exactly `location` and the four
      headers `strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff`,
      `x-frame-options: SAMEORIGIN` and `referrer-policy: strict-origin-when-cross-origin`; with no props, it carries
      only `location` (R5)
    - [x] A `canonicalHost` that is empty or holds anything but lowercase letters, digits, `.` and `-`, such as
      `https://example.com` or `example.com/`, throws an error naming `canonicalHost` and the value given (R3.1)
- [x] Write `test/security-headers-agreement.test.ts`: the headers of a redirect of the function deployed with
  `securityHeaders: true`, apart from `location`, equal the header values made from `securityHeadersBehavior` in the
  test itself: `strict-transport-security` from `max-age=` and `strictTransportSecurity.accessControlMaxAge.toSeconds()`,
  `x-content-type-options` `nosniff` because `contentTypeOptions` is set, `x-frame-options` from
  `frameOptions.frameOption` and `referrer-policy` from `referrerPolicy.referrerPolicy` (R5, R6)
- [x] Run the tests and see them fail on the missing construct (R6)
- [x] Write `edge/clean-urls.js` from agentrite.dev's copy: a header comment that `canonicalHost` and `securityHeaders`
  are declared ahead of the source by `src/clean-urls-function.ts` and why the redirects carry the headers; `redirect`
  copying `securityHeaders` onto the `location` header; `endsWith` unchanged; a `queryString(querystring)` that
  rebuilds the query string as the approach says; and `handler` checking `canonicalHost !== null` and the host header
  against `'www.' + canonicalHost` first, then the `.html` rule, then `/`, then the last segment rule, with both
  redirects appending `queryString(request.querystring)` (R3, R5)
- [x] Write `src/clean-urls-function.ts`: `CleanUrlsFunctionProps` with `canonicalHost?: string` and
  `securityHeaders?: boolean`, each with a doc comment; `CleanUrlsFunction extends cloudfront.Function`, whose
  constructor checks `canonicalHost` against `/^[a-z0-9-]+(\.[a-z0-9-]+)+$/` and throws
  `CleanUrlsFunction: canonicalHost must be a host name such as example.com, got "<value>"` when it fails, reads the
  source, declares `var canonicalHost = <JSON or null>;` and `var securityHeaders = <JSON>;` ahead of it, the latter
  made from `securityHeaderValues` as `{ value }` per name when `securityHeaders` is true and `{}` otherwise, and calls
  `super` with `FunctionCode.fromInline` and `FunctionRuntime.JS_2_0`. Export the construct and its props from
  `src/index.ts`. Run the tests and see them pass (R3, R5)

### End to end

- [x] Write `e2e/install.mjs`, run by `"test:e2e": "node e2e/install.mjs"` in `package.json`. It exits non-zero with a
  message on the first failed check, and removes its scratch directory in a `finally` (R1, R2):
    - [x] Refuse to run when `git status --porcelain` shows a change to a tracked file, since it installs the
      committed `HEAD`, and read that commit with `git rev-parse HEAD`
    - [x] Make a scratch directory with `mkdtemp` under the system temporary directory, and write its `package.json`
      with the dependencies `aws-cdk-lib` and `constructs` at the exact versions installed in this repository's
      `node_modules`, `@ritenoar/cdk` as `git+file://<repository root>#<commit>`, and `typescript` as a development
      dependency at the version installed here
    - [x] Run `npm install` there with no other arguments, and check that `node_modules/@ritenoar/cdk/dist/index.js`,
      `dist/index.d.ts` and `edge/clean-urls.js` exist, which shows `prepare` ran
    - [x] Check that `npm ls aws-cdk-lib --all --parseable` and `npm ls constructs --all --parseable` each print one
      path, the app's own `node_modules/aws-cdk-lib` and `node_modules/constructs`, and that
      `node_modules/@ritenoar/cdk/node_modules` holds neither
    - [x] Write `app.ts`, a stack with a `Distribution` on an `HttpOrigin('example.com')` whose default behavior
      associates `new CleanUrlsFunction(this, 'CleanUrls', { canonicalHost: 'example.com', securityHeaders: true })`
      with `FunctionEventType.VIEWER_REQUEST` and has a `ResponseHeadersPolicy` with `securityHeadersBehavior`, both
      imported with `import { CleanUrlsFunction, securityHeadersBehavior } from '@ritenoar/cdk'`, and a second
      `CleanUrlsFunction` with no props, printing `JSON.stringify` of the stack's template from `app.synth()`
    - [x] Compile it with the scratch app's `tsc` under `strict`, run it with `node`, and check that the template
      holds two `AWS::CloudFront::Function` resources on `cloudfront-js-2.0`, one `ResponseHeadersPolicy` and a
      distribution whose default behavior has a `viewer-request` function association
- [x] Commit, then run `npm run test:e2e` and see it pass (R1, R2)

### Documentation

- [x] Write `README.md` (R7, R8):
    - [x] What the package holds: the `CleanUrlsFunction` construct and its rules, the query string kept on both
      redirects, and `securityHeadersBehavior`, with the four header values and why the function's redirects carry
      them themselves
    - [x] How a site installs it: `npm install github:norareit/ritenoar-cdk#v0.1.0`, with `aws-cdk-lib` and
      `constructs` as the site's own dependencies, and how a site moves to a newer tag
    - [x] How a stack uses each export, with one example for a site with `securityHeaders: true`, a `canonicalHost`
      and a response headers policy of `securityHeadersBehavior`, and one for a site with neither, each associating the
      function with `FunctionEventType.VIEWER_REQUEST`
    - [x] How a new version is released: a unit sets the new `version` in `package.json`, and once it is merged a
      `v<version>` tag is made on the merge commit on `master` and pushed with `git push origin v<version>`. A tag is
      not moved once pushed, and the first release is `v0.1.0`
    - [x] How the package is developed: `npm ci`, `npm test`, `npm run test:e2e` and `npm run check-changes`
- [x] Under "Specific to this project" in `AGENTS.md`, list the commands: `npm ci` builds the package through
  `prepare`, `npm test` runs the unit tests, `npm run test:e2e` runs the end-to-end install test against the committed
  `HEAD`, and `npm run build` compiles to `dist/` (R6, R1)

## Verification

- [x] `npm ci` installs and builds with no error
- [x] `npm run build` writes `dist/index.js`, `dist/index.d.ts` and the declarations of both modules
- [x] `npm test` passes
- [x] `npm run test:e2e` passes on the last commit
- [x] `npm run check-changes` passes on the last commit

## Commit Points

- [x] `feature-0001 Plan the clean URLs function and security headers`: this plan and its log entry
- [x] `feature-0001 Make the package`: the tasks of "The package"
- [x] `feature-0001 Export the security headers`: the tasks of "The security headers"
- [x] `feature-0001 Add the clean URLs function`: the tasks of "The clean URLs function"
- [x] `feature-0001 Test the install end to end`: the tasks of "End to end"
- [x] `feature-0001 Document the package`: the tasks of "Documentation"
