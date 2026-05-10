#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

interface ShardManifest {
  readonly include?: Shard[];
}

interface Shard {
  readonly shardIndex: number;
  readonly shardTotal: number;
  readonly estimatedDurationMs: number;
  readonly tests: ShardTest[];
}

interface ShardTest {
  readonly file: string;
  readonly title: string;
  readonly tags?: string[];
}

const SHARD_MANIFEST = process.env.SHARD_MANIFEST ?? 'shard-matrix.json';
const SHARD_INDEX = Number(process.env.SHARD_INDEX);

if (!Number.isInteger(SHARD_INDEX) || SHARD_INDEX < 1) {
  throw new Error('SHARD_INDEX must be a positive integer.');
}

function readManifest(filePath: string): ShardManifest {
  if (!existsSync(filePath)) {
    throw new Error(`Shard manifest not found: ${filePath}`);
  }

  return JSON.parse(readFileSync(filePath, 'utf8')) as ShardManifest;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeTitlePattern(test: ShardTest): string {
  const tags = (test.tags ?? [])
    .filter(Boolean)
    .map((tag) => String(tag).replace(/^@/, ''));
  const tagLookaheads = tags
    .map((tag) => `(?=.*(?:^|\\s)@?${escapeRegExp(tag)}\\b)`)
    .join('');

  return `${tagLookaheads}(?:^|.*\\s)${escapeRegExp(test.title.trim())}\\s*(?=\\s+@|$)`;
}

function main(): void {
  const manifest = readManifest(SHARD_MANIFEST);
  const shard = (manifest.include ?? []).find((candidate) => candidate.shardIndex === SHARD_INDEX);

  if (!shard) {
    throw new Error(`Shard ${SHARD_INDEX} not found in ${SHARD_MANIFEST}.`);
  }

  if (!shard.tests.length) {
    console.log(`Shard ${SHARD_INDEX} has no tests.`);
    return;
  }

  const files = [...new Set(shard.tests.map((test) => test.file))];
  const grep = shard.tests.map(makeTitlePattern).join('|');
  const args = [
    'playwright',
    'test',
    ...files,
    '--grep',
    grep,
    ...process.argv.slice(2),
  ];

  console.log(`Running shard ${SHARD_INDEX}/${shard.shardTotal}: ${shard.tests.length} tests, about ${Math.round(shard.estimatedDurationMs / 1000)}s`);

  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

main();

