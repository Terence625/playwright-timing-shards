#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

interface PlaywrightReport {
  readonly suites?: PlaywrightSuite[];
}

interface PlaywrightSuite {
  readonly title?: string;
  readonly file?: string;
  readonly specs?: PlaywrightSpec[];
  readonly suites?: PlaywrightSuite[];
}

interface PlaywrightSpec {
  readonly title?: string;
  readonly file?: string;
  readonly tags?: string[];
  readonly tests?: PlaywrightTest[];
}

interface PlaywrightTest {
  readonly projectName?: string;
  readonly results?: PlaywrightTestResult[];
}

interface PlaywrightTestResult {
  readonly duration?: number;
}

interface WalkState {
  readonly projectName: string;
  readonly file: string;
  readonly describePath: string[];
}

interface ShardEntry {
  readonly projectName: string;
  readonly file: string;
  readonly describePath: string[];
  readonly title: string;
  readonly tags: string[];
  readonly duration: number;
}

interface Shard {
  readonly shardIndex: number;
  readonly shardTotal: number;
  estimatedDurationMs: number;
  readonly tests: ShardEntry[];
}

interface ShardManifest {
  readonly include: Shard[];
}

type DurationStrategy = 'max' | 'sum' | 'last';

const TEST_RESULTS_FILE = process.env.TEST_RESULTS_FILE ?? 'test-results/merged-results.json';
const TEST_LIST_FILE = process.env.TEST_LIST_FILE;
const SHARD_COUNT = Number(process.env.SHARD_COUNT ?? '4');
const DURATION_STRATEGY = parseDurationStrategy(process.env.DURATION_STRATEGY);

if (!Number.isInteger(SHARD_COUNT) || SHARD_COUNT < 1) {
  throw new Error('SHARD_COUNT must be a positive integer.');
}

function parseDurationStrategy(value: string | undefined): DurationStrategy {
  if (value === 'sum' || value === 'last' || value === 'max') {
    return value;
  }

  return 'max';
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function isRunnableSpec(file: string | undefined): file is string {
  return typeof file === 'string' && /\.(spec|test)\.[cm]?[jt]s$/.test(file);
}

function duration(results: readonly PlaywrightTestResult[] | undefined): number {
  const durations = (results ?? []).map((result) => Number(result.duration ?? 0));
  if (!durations.length) {
    return 0;
  }

  if (DURATION_STRATEGY === 'sum') {
    return durations.reduce((total, value) => total + value, 0);
  }

  if (DURATION_STRATEGY === 'last') {
    return durations[durations.length - 1];
  }

  return Math.max(...durations);
}

function testKey(entry: ShardEntry): string {
  return `${entry.projectName}|||${entry.file}|||${entry.describePath.join(' > ')}|||${entry.title.trim()}`;
}

function walkSuite(suite: PlaywrightSuite | undefined, state: WalkState, entries: ShardEntry[]): void {
  if (!suite) {
    return;
  }

  const title = suite.title ?? '';
  const isFileSuite = Boolean(suite.file) && title === suite.file;
  const describePath = title && !isFileSuite && title !== state.projectName && title !== state.file
    ? [...state.describePath, title]
    : state.describePath;

  for (const spec of suite.specs ?? []) {
    const file = spec.file ?? suite.file ?? state.file;
    if (!isRunnableSpec(file)) {
      continue;
    }

    for (const test of spec.tests ?? []) {
      entries.push({
        projectName: test.projectName ?? state.projectName,
        file,
        describePath,
        title: spec.title ?? '',
        tags: spec.tags ?? [],
        duration: duration(test.results),
      });
    }
  }

  for (const child of suite.suites ?? []) {
    walkSuite(child, {
      projectName: state.projectName || child.title || '',
      file: child.file ?? state.file,
      describePath,
    }, entries);
  }
}

function collectEntries(report: PlaywrightReport): ShardEntry[] {
  const entries: ShardEntry[] = [];

  for (const suite of report.suites ?? []) {
    walkSuite(suite, {
      projectName: suite.title ?? '',
      file: suite.file ?? '',
      describePath: [],
    }, entries);
  }

  return entries;
}

function mergeCurrentTestList(timedEntries: readonly ShardEntry[], testListFile: string): ShardEntry[] {
  if (!existsSync(testListFile)) {
    throw new Error(`Test list file not found: ${testListFile}`);
  }

  const currentEntries = collectEntries(readJsonFile<PlaywrightReport>(testListFile));
  const timingByKey = new Map(timedEntries.map((entry) => [testKey(entry), entry]));
  const currentKeys = new Set<string>();

  const shardEntries = currentEntries.map((entry) => {
    const key = testKey(entry);
    currentKeys.add(key);

    const timingEntry = timingByKey.get(key);
    if (!timingEntry) {
      console.warn(`[new] ${key} has no timing data yet, using duration 0`);
    }

    return {
      ...entry,
      duration: timingEntry?.duration ?? 0,
    };
  });

  for (const entry of timedEntries) {
    const key = testKey(entry);
    if (!currentKeys.has(key)) {
      console.warn(`[removed] ${key} is not present in ${testListFile}`);
    }
  }

  return shardEntries;
}

function assignGreedy(entries: readonly ShardEntry[], shardCount: number): Shard[] {
  const shards = Array.from({ length: shardCount }, (_, index): Shard => ({
    shardIndex: index + 1,
    shardTotal: shardCount,
    estimatedDurationMs: 0,
    tests: [],
  }));

  for (const entry of [...entries].sort((a, b) => b.duration - a.duration)) {
    shards.sort((a, b) => a.estimatedDurationMs - b.estimatedDurationMs);
    shards[0].tests.push(entry);
    shards[0].estimatedDurationMs += entry.duration;
  }

  return shards.sort((a, b) => a.shardIndex - b.shardIndex);
}

function main(): void {
  if (!existsSync(TEST_RESULTS_FILE)) {
    throw new Error(`Timing file not found: ${TEST_RESULTS_FILE}`);
  }

  const timedEntries = collectEntries(readJsonFile<PlaywrightReport>(TEST_RESULTS_FILE));
  const shardEntries = TEST_LIST_FILE
    ? mergeCurrentTestList(timedEntries, TEST_LIST_FILE)
    : timedEntries;

  if (!shardEntries.length) {
    throw new Error('No runnable tests found.');
  }

  const manifest: ShardManifest = { include: assignGreedy(shardEntries, SHARD_COUNT) };
  writeFileSync('shard-matrix.json', `${JSON.stringify(manifest, null, 2)}\n`);
}

main();

