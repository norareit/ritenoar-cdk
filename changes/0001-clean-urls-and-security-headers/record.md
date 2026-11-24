---
kind: feature
status: in-progress
timestamp: 2026-11-24T12:00:09Z
---

# Clean URLs function and security headers

## Log

- 2026-11-24T12:00:09Z [Claude Code, anthropic/claude-opus-5-5] as the specifier, wrote the spec. The status is
  `draft`
- 2026-11-24T12:18:18Z [Claude Code, anthropic/claude-opus-5-5] as the specifier, took in item 3 of "Beyond the
  request" at the human's request: every redirect keeps the query string, as requirement 3.6 with a decision, and
  the item is removed from that list. The status is `draft`
- 2026-11-24T12:20:07Z [Claude Code, anthropic/claude-opus-5-5] as the specifier, recorded in the install decision,
  at the human's request, why the repository is public and why a private Bitbucket one was rejected. The status is
  `draft`
- 2026-11-24T12:23:38Z [human] approved the spec. The status is `approved`
- 2026-11-24T12:30:54Z [Claude Code, anthropic/claude-opus-5-5] as the planner, wrote the plan. The status is
  `approved`
- 2026-11-24T12:40:00Z [Claude Code, anthropic/claude-sonnet-5-5] as the implementer, began the work. No review
  findings exist under `.reviews/` for this unit. The status is `in-progress`
- 2026-11-24T13:10:00Z [Claude Code, anthropic/claude-sonnet-5-5] as the implementer, built every task of the plan and
  ticked it. On `6e8d156`, after `rm -rf dist node_modules` and `npm ci`, `npm ci` built `dist/`, `npm test` passed
  (3 suites, 62 tests), `npm run test:e2e` passed and `npm run check-changes` reported no error. The e2e test's install
  printed an npm warning that the `prepare` script is not covered by `allowScripts`; the script ran, and the README
  says so. Not checked: an install from `github:norareit/ritenoar-cdk` over the network, since no tag is pushed, and
  the e2e test's refusal on a changed tracked file. The status stays `in-progress` for the human to set
  `implemented`

## Amendments
