import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CUTOFF,
  PAPER_REFERENCE,
  RELEASED_DATA_REFERENCE,
  buildFingerprint,
  compareFingerprints,
  jsdCounts,
  topAnswerOf,
} from '../core.js';
import { comparabilityError } from '../index.js';

const cells = (answer = '42') => Object.fromEntries(
  Array.from({ length: 40 }, (_, index) => [
    `cell-${index}`,
    { valid: 30, distribution: { [answer]: 30 }, task: 'task', lang: 'en' },
  ]),
);

function fingerprint(overrides = {}) {
  return {
    provider: 'provider',
    model: 'model',
    promptVersion: '1.0.0',
    cellCount: 40,
    reps: 30,
    validRate: 1,
    splitHalf: { score: 0.05 },
    cells: cells(),
    ...overrides,
  };
}

test('identical fingerprints fall below the cutoff', () => {
  const result = compareFingerprints(fingerprint(), fingerprint());
  assert.equal(result.score, 0);
  assert.equal(result.cutoff, CUTOFF);
  assert.equal(result.cutoff, 0.28);
  assert.equal(result.verdict, 'consistent');
});

test('a full-battery score of 1 is above the cutoff', () => {
  const result = compareFingerprints(fingerprint(), fingerprint({ cells: cells('7') }));
  assert.equal(result.score, 1);
  assert.equal(result.verdict, 'inconsistent');
});

test('partial batteries never produce a verdict', () => {
  const partial = fingerprint();
  delete partial.cells['cell-0'];
  partial.cellCount = 39;
  const result = compareFingerprints(partial, fingerprint());
  assert.equal(result.coverage.cellsUsed, 39);
  assert.equal(result.verdict, 'insufficient_evidence');
  assert.equal(result.verdictReason, 'partial_battery');
});

test('repetition counts other than 30 never produce a verdict', () => {
  const result = compareFingerprints(fingerprint({ reps: 10 }), fingerprint());
  assert.equal(result.verdict, 'insufficient_evidence');
  assert.equal(result.verdictReason, 'repetitions');
});

test('different prompt versions and reasoning-enabled records are refused', () => {
  const base = { promptVersion: '1.0.0', reasoningPolicy: 'disabled' };
  assert.equal(comparabilityError(base, base), null);
  assert.match(comparabilityError(base, { ...base, promptVersion: '1.1.0' }), /different prompt versions/);
  assert.match(comparabilityError(base, { ...base, reasoningPolicy: 'least-available' }), /reasoning policy/);
  assert.equal(comparabilityError(base, { ...base, reasoningPolicy: 'none' }), null);
});

test('duplicate cell ids are collapsed before aggregation', () => {
  const records = Array.from({ length: 20 }, (_, rep) => ({
    cell: 'num100-random:en',
    rep,
    normalized: rep < 12 ? '42' : '7',
    answerClass: 'valid',
  }));
  const result = buildFingerprint({
    id: 'test',
    cells: ['num100-random:en', 'num100-random:en'],
    reps: 20,
    provider: 'provider',
    model: 'model',
    createdAt: '2026-01-01T00:00:00Z',
    promptVersion: '1.0.0',
  }, records);
  assert.equal(result.cellCount, 1);
  assert.equal(result.cellsIncluded, 1);
  assert.equal(result.validRate, 1);
  assert.equal(result.cells['num100-random:en'].valid, 20);
  assert.equal(result.cutoff, CUTOFF);
});

test('the modal answer does not depend on integer key order', () => {
  assert.deepEqual(topAnswerOf({ 42: 2, 7: 1 }), { topAnswer: '42', topShare: 0.6667 });
  assert.deepEqual(topAnswerOf({ 9: 1, 10: 3 }), { topAnswer: '10', topShare: 0.75 });
});

test('JSD is 0 for identical and 1 for disjoint distributions', () => {
  const a = new Map([['42', 30]]);
  const b = new Map([['42', 30]]);
  const c = new Map([['7', 30]]);
  assert.equal(jsdCounts(a, b), 0);
  assert.equal(jsdCounts(a, c), 1);
});

test('paper and recomputed references stay separate', () => {
  assert.equal(PAPER_REFERENCE.impostorMedian, 0.463);
  assert.ok(!('impostorP1' in PAPER_REFERENCE));
  assert.equal(RELEASED_DATA_REFERENCE.impostorP1, 0.28);
  assert.equal(RELEASED_DATA_REFERENCE.impostorTrials, 27060);
});
