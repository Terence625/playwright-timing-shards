# Playwright Timing-Balanced Shards

This example shows how to replace Playwright's native file-count sharding with a timing-balanced shard manifest built from the previous run's merged JSON report.

Playwright's built-in `--shard=1/4` is simple and reliable, but it does not know that one test file may take 30 seconds while another takes 3 minutes. This example keeps Playwright as the test runner and only adds a small scheduling layer before the test jobs start.

## How It Works

1. A previous successful workflow run uploads `merged-results.json` as the `merged-json-report` artifact.
2. The next workflow run downloads that report.
3. `npm run test:list` writes the current test list to `test-list.json`.
4. `npm run build-shards` combines current tests with historical durations and writes `shard-matrix.json`.
5. Each matrix job runs `npm run run-shard` for its assigned tests.
6. If there is no previous timing report, the workflow falls back to Playwright's native `--shard=<index>/<total>`.

## Local Usage

Install dependencies:

```sh
npm install
```

Run the suite normally:

```sh
npm test
```

Generate a current test list:

```sh
npm run test:list
```

Build a shard manifest from an existing merged report:

```sh
SHARD_COUNT=4 \
TEST_RESULTS_FILE=test-results/merged-results.json \
TEST_LIST_FILE=test-list.json \
npm run build-shards
```

Run one generated shard:

```sh
SHARD_INDEX=1 npm run run-shard
```

Pass extra Playwright args after `--`:

```sh
SHARD_INDEX=1 npm run run-shard -- --headed
```

## Script Summary

### `scripts/build-shards.ts`

Reads Playwright JSON output and creates `shard-matrix.json`.

Important environment variables:

- `TEST_RESULTS_FILE`: previous merged Playwright JSON report. Defaults to `test-results/merged-results.json`.
- `TEST_LIST_FILE`: current Playwright test list. Recommended in CI so deleted tests are excluded and new tests are included.
- `SHARD_COUNT`: number of shards. Defaults to `4`.
- `DURATION_STRATEGY`: `max`, `sum`, or `last`. Defaults to `max`.

The script:

- matches current tests to old timings by project, file, describe path, and title
- gives new tests duration `0`
- logs deleted tests and excludes them
- assigns slowest tests first to the currently lightest shard

### `scripts/run-shard.ts`

Reads `shard-matrix.json` and runs the selected shard.

Important environment variables:

- `SHARD_INDEX`: required shard number.
- `SHARD_MANIFEST`: optional manifest path. Defaults to `shard-matrix.json`.

The runner passes the shard's files to Playwright, then narrows within those files using `--grep`.

## GitHub Actions

The example workflow is in `.github/workflows/playwright.yml`.

### `build-shard-manifest`

Finds the latest successful workflow run that contains the stable `merged-json-report` artifact, downloads it, builds `shard-matrix.json`, and uploads that manifest for the matrix jobs.

### `test`

Runs a 4-way matrix.

If `shard-matrix.json` exists:

```sh
npm run run-shard -- --reporter=blob
```

If not:

```sh
npm test -- --shard=<index>/4 --reporter=blob
```

### `merge-reports`

Downloads all blob reports, merges them into an HTML report and `merged-results.json`, then uploads:

- `playwright-report`
- `merged-json-report`

The timing report uses a stable artifact name with `overwrite: true`, so reruns do not leave ambiguous `attempt-1`, `attempt-2`, etc. artifacts for future runs.

## Retry Behavior

The `merge-reports` job uploads reports even if some test shards failed. Its final step fails the merge job when the matrix failed:

```yaml
- name: Keep failed tests retryable
  if: ${{ needs.test.result == 'failure' }}
  run: exit 1
```

That means GitHub's **Re-run failed jobs** reruns the failed shards and reruns `merge-reports`. Successful shard blob reports from the earlier attempt remain available, failed shard blob reports are overwritten, and the final successful merge overwrites `merged-json-report`.

## Notes

- This is intentionally not a Playwright replacement. It only decides which tests each shard should run.
- Keep `TEST_LIST_FILE` enabled in CI so renamed or deleted tests are handled correctly.
- If your suite has multiple projects, the project name is part of the timing identity.
