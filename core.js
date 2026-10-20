/**
 * Paper protocol core for LLM Fingerprint.
 *
 * Algorithm source: Bruckner, "One Token Is Enough" (arXiv:2607.10252).
 * Normalization is a direct port of the released `stats/01-normalize.js`
 * (MIT) so fingerprints stay comparable with the published artifact.
 */
import { readFileSync } from 'node:fs';

export const PROMPTS = JSON.parse(readFileSync(new URL('./prompts.json', import.meta.url), 'utf8'));

/** Paper full-battery EER threshold, recomputed from the released split-scores.json. */
export const TAU = 0.356;

export const PAPER_REFERENCE = {
  sameProviderSplitHalfMedian: 0.14,
  crossProviderMedian: 0.227,
  crossModelMedian: 0.489,
  fullBatteryAuc: 0.971,
  fullBatteryEer: 0.073,
};

export const CELLS = PROMPTS.tasks.flatMap((task) =>
  PROMPTS.languages.map((lang) => ({
    id: `${task.id}:${lang}`,
    taskId: task.id,
    lang,
    task,
  })),
);

const CELL_BY_ID = new Map(CELLS.map((cell) => [cell.id, cell]));

export function cellById(id) {
  return CELL_BY_ID.get(id);
}

export function allCellIds() {
  return CELLS.map((cell) => cell.id);
}

const AR_DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};
const ZH_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function zhNumber(s) {
  const m = s.match(/^([零一二两三四五六七八九])?十?([零一二两三四五六七八九])?$/);
  if (!m || (!m[1] && !m[2] && !s.includes('十'))) return null;
  if (!s.includes('十')) return m[1] ? ZH_DIGITS[m[1]] : null;
  return (m[1] ? ZH_DIGITS[m[1]] : 1) * 10 + (m[2] ? ZH_DIGITS[m[2]] : 0);
}

function basicClean(raw) {
  return raw.normalize('NFC')
    .replace(/[«»"“”„'’‘`().,!?。！？、：:;؛؟\[\]{}*_#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const REFUSAL_RE = /(i can.?t|i cannot|i'm sorry|as an ai|не могу|извин|抱歉|无法|لا أستطيع|عذراً|آسف)/i;

const COIN = {
  en: { heads: 'h', tails: 't' },
  ru: { 'орёл': 'h', 'орел': 'h', 'решка': 't' },
  zh: { '正面': 'h', '正': 'h', '反面': 't', '反': 't' },
  ar: { 'صورة': 'h', 'كتابة': 't' },
};

/**
 * Deterministic normalization of one completion.
 * @returns {{normalized: string|null, answerClass: 'valid'|'invalid'|'refusal'|'empty'}}
 */
export function normalizeAnswer(raw, task, lang) {
  const out = { normalized: null, answerClass: 'invalid' };
  if (raw == null || !String(raw).trim()) return { ...out, answerClass: 'empty' };
  if (REFUSAL_RE.test(String(raw))) return { ...out, answerClass: 'refusal' };

  let s = basicClean(String(raw));
  if (!s) return { ...out, answerClass: 'empty' };
  s = s.replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d]);

  if (task.normalize_as === 'integer') {
    let n = null;
    const m = s.match(/-?\d+/);
    if (m) n = Number.parseInt(m[0], 10);
    else if (lang === 'zh') n = zhNumber(s);
    if (n == null || !Number.isFinite(n)) return out;
    const range = String(task.answer_space ?? '').match(/(\d+)-(\d+)/);
    const inRange = !range || (n >= Number(range[1]) && n <= Number(range[2]));
    return { ...out, normalized: String(n), answerClass: inRange ? 'valid' : 'invalid' };
  }

  if (task.normalize_as === 'binary') {
    const w = s.toLowerCase().split(' ')[0];
    const c = COIN[lang]?.[w];
    return c ? { ...out, normalized: c, answerClass: 'valid' } : out;
  }

  const words = s.toLowerCase().split(' ').filter(Boolean);
  if (task.normalize_as === 'word' && words.length > 3) return out;
  const w = words[0];
  if (!w) return { ...out, answerClass: 'empty' };
  if (task.normalize_as === 'grapheme' && [...w].length > 1 && lang !== 'zh') {
    const single = words.find((x) => [...x].length === 1);
    if (!single) return out;
    return { ...out, normalized: single, answerClass: 'valid' };
  }
  return { ...out, normalized: w, answerClass: 'valid' };
}

function countsOf(records) {
  const counts = new Map();
  for (const record of records) {
    if (record.answerClass !== 'valid' || record.normalized == null) continue;
    const key = String(record.normalized);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function countsToObject(counts) {
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function sumCounts(counts) {
  let total = 0;
  for (const value of counts.values()) total += value;
  return total;
}

/** Base-2 Jensen-Shannon divergence between two count maps. */
export function jsdCounts(countsA, countsB) {
  const totalA = sumCounts(countsA);
  const totalB = sumCounts(countsB);
  if (totalA === 0 || totalB === 0) return null;
  const keys = new Set([...countsA.keys(), ...countsB.keys()]);
  let divergence = 0;
  for (const key of keys) {
    const p = (countsA.get(key) ?? 0) / totalA;
    const q = (countsB.get(key) ?? 0) / totalB;
    const m = 0.5 * (p + q);
    if (p > 0) divergence += 0.5 * p * Math.log2(p / m);
    if (q > 0) divergence += 0.5 * q * Math.log2(q / m);
  }
  return Math.max(0, Math.min(1, divergence));
}

function countsFromObject(object) {
  const counts = new Map();
  for (const [key, value] of Object.entries(object ?? {})) counts.set(key, Number(value));
  return counts;
}

function classCounts(records) {
  const result = { valid: 0, invalid: 0, refusal: 0, empty: 0, post_reasoning: 0 };
  for (const record of records) {
    if (Object.hasOwn(result, record.answerClass)) result[record.answerClass] += 1;
    else result.invalid += 1;
  }
  return result;
}

/**
 * Build one checkpoint fingerprint from raw records.
 * Pair distance uses cells with >=10 valid samples on both sides (paper IV-C);
 * split-half genuine uses >=5 valid samples per half (paper split-scores.json).
 */
export function buildFingerprint(meta, records) {
  const cells = {};
  let validTotal = 0;
  let included = 0;
  let reasoningLeak = 0;

  for (const cellId of meta.cells) {
    const cell = cellById(cellId);
    if (!cell) continue;
    const rs = records.filter((record) => record.cell === cellId);
    const classes = classCounts(rs);
    const valid = classes.valid;
    validTotal += valid;
    reasoningLeak += rs.filter((record) => record.answerClass === 'post_reasoning').length;
    const counts = countsOf(rs);
    const distribution = countsToObject(counts);
    const topAnswer = Object.keys(distribution)[0] ?? null;
    const topShare = topAnswer == null ? 0 : distribution[topAnswer] / (valid || 1);
    const isIncluded = valid >= 10;
    if (isIncluded) included += 1;
    cells[cellId] = {
      task: cell.taskId,
      lang: cell.lang,
      n: rs.length,
      valid,
      invalid: classes.invalid,
      refusal: classes.refusal,
      empty: classes.empty,
      postReasoning: classes.post_reasoning,
      distribution,
      topAnswer,
      topShare: Number(topShare.toFixed(4)),
      included: isIncluded,
    };
  }

  let splitSum = 0;
  let splitCells = 0;
  for (const cellId of meta.cells) {
    const rs = records.filter((record) => record.cell === cellId);
    const even = countsOf(rs.filter((record) => record.rep % 2 === 0));
    const odd = countsOf(rs.filter((record) => record.rep % 2 === 1));
    if (sumCounts(even) < 5 || sumCounts(odd) < 5) continue;
    const value = jsdCounts(even, odd);
    if (value == null) continue;
    splitSum += value;
    splitCells += 1;
  }

  const total = records.length;
  const validRate = total === 0 ? 0 : validTotal / total;
  const warnings = [];
  if (validRate < 0.8) warnings.push(`valid rate ${(validRate * 100).toFixed(1)}% is below 80%; fingerprint reliability is limited`);
  if (reasoningLeak > 0) warnings.push(`${reasoningLeak} responses carried a reasoning trace; the paper protocol requires reasoning disabled`);
  if (included < 40) warnings.push(`${included}/40 cells reached >=10 valid samples; comparisons use fewer cells`);

  return {
    checkpointId: meta.id,
    provider: meta.provider,
    model: meta.model,
    createdAt: meta.createdAt,
    completedAt: meta.completedAt ?? null,
    promptVersion: meta.promptVersion,
    reps: meta.reps,
    tau: TAU,
    thresholdSource: 'paper full-battery EER, recomputed from released split-scores.json',
    paperReference: PAPER_REFERENCE,
    cellCount: meta.cells.length,
    cellsIncluded: included,
    validRate: Number(validRate.toFixed(4)),
    totals: {
      responses: total,
      valid: validTotal,
      failedRequests: meta.failedRequests ?? 0,
      reasoningLeak,
      usage: meta.usage ?? null,
    },
    splitHalf: {
      score: splitCells === 0 ? null : Number((splitSum / splitCells).toFixed(4)),
      cellsUsed: splitCells,
      minPerHalf: 5,
    },
    warnings,
    cells,
  };
}

/**
 * Compare any two checkpoints. The operation is identical for two models and
 * for one model/provider before and after; only the relation label differs.
 */
export function compareFingerprints(a, b) {
  const details = [];
  let sum = 0;
  for (const [cellId, cellA] of Object.entries(a.cells ?? {})) {
    const cellB = b.cells?.[cellId];
    if (!cellB) continue;
    if (cellA.valid < 10 || cellB.valid < 10) continue;
    const value = jsdCounts(countsFromObject(cellA.distribution), countsFromObject(cellB.distribution));
    if (value == null) continue;
    sum += value;
    details.push({
      cell: cellId,
      task: cellA.task,
      lang: cellA.lang,
      jsd: Number(value.toFixed(4)),
      validA: cellA.valid,
      validB: cellB.valid,
    });
  }
  details.sort((x, y) => y.jsd - x.jsd);
  const cellsUsed = details.length;
  const score = cellsUsed === 0 ? null : Number((sum / cellsUsed).toFixed(4));
  const verdict = score == null ? 'insufficient_samples' : score <= TAU ? 'consistent' : 'inconsistent';
  const relation = a.provider === b.provider && a.model === b.model ? 'same_target' : 'different_target';
  const warnings = [];
  if (cellsUsed < Math.min(a.cellCount ?? 0, b.cellCount ?? 0)) warnings.push(`only ${cellsUsed} cells had >=10 valid samples on both sides`);
  if ((a.validRate ?? 0) < 0.8 || (b.validRate ?? 0) < 0.8) warnings.push('one checkpoint has valid rate below 80%');
  if ((a.splitHalf?.score ?? 0) > 0.3 || (b.splitHalf?.score ?? 0) > 0.3) warnings.push('split-half genuine score is high; measurement noise may be large');
  if (score != null && Math.abs(score - TAU) < 0.03) warnings.push('score is close to tau; treat the verdict with caution');

  return {
    score,
    tau: TAU,
    verdict,
    relation,
    cellsUsed,
    genuineA: a.splitHalf?.score ?? null,
    genuineB: b.splitHalf?.score ?? null,
    paperReference: PAPER_REFERENCE,
    warnings,
    details,
  };
}
