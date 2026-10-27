/**
 * LLM Fingerprint host plugin.
 *
 * A fingerprint record is one paper-protocol capture of one provider/model
 * route at one time: 40 cells x 30 repetitions by default. The fingerprint is
 * the per-cell empirical answer distribution. Any two records compare with the
 * same operation and the same decision cutoff.
 *
 * The same service methods serve three callers: agent tools, the web API used
 * by the panel, and the panel's polling reads. There is one implementation of
 * every operation.
 */
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CELLS,
  CUTOFF,
  PAPER_REFERENCE,
  PROMPTS,
  RELEASED_DATA_REFERENCE,
  allCellIds,
  buildFingerprint,
  cellById,
  compareFingerprints,
  normalizeAnswer,
  topAnswerOf,
} from './core.js';

export const inject = ['llm', 'tools', 'webServer'];

const CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_TOKENS = 16;
const TEMPERATURE = 1.0;
const DEFAULT_REPS = 30;
const API_PREFIX = '/llm-fingerprint/api';

function resolveDataDir(config) {
  const configured = config && typeof config.dataDir === 'string' && config.dataDir.trim();
  const base = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.resolve(configured || path.join(base, 'llm-fingerprint'));
}

function nowUtc() {
  return new Date().toISOString();
}

function checkpointPaths(root, id) {
  const dir = path.join(root, 'checkpoints', id);
  return {
    dir,
    meta: path.join(dir, 'meta.json'),
    responses: path.join(dir, 'responses.jsonl'),
    fingerprint: path.join(dir, 'fingerprint.json'),
  };
}

function assertRecordId(id) {
  if (typeof id !== 'string' || !/^cp-[0-9A-Za-z-]+$/.test(id)) {
    throw new Error('invalid record id');
  }
  return id;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  if (!existsSync(file)) return [];
  const records = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // A torn trailing line is ignored; the next append starts on its own line.
    }
  }
  return records;
}

function ensureTrailingNewline(file) {
  if (!existsSync(file) || statSync(file).size === 0) return;
  const text = readFileSync(file, 'utf8');
  if (!text.endsWith('\n')) appendFileSync(file, '\n');
}

function writeMeta(file, meta) {
  writeFileSync(file, `${JSON.stringify(meta, null, 2)}\n`);
}

function addUsage(total, usage) {
  if (!usage) return total;
  total.inputTokens += Number(usage.inputTokens ?? 0);
  total.outputTokens += Number(usage.outputTokens ?? 0);
  total.cacheReadTokens += Number(usage.cacheReadTokens ?? 0);
  total.cacheWriteTokens += Number(usage.cacheWriteTokens ?? 0);
  total.reasoningTokens += Number(usage.reasoningTokens ?? 0);
  return total;
}

function aggregateUsage(records) {
  const total = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
  };
  for (const record of records) addUsage(total, record.usage);
  return total;
}

async function pool(items, limit, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

/** Effort ids that mean the model answers without reasoning. `minimal` still reasons, so it is not one. */
const DISABLED_EFFORTS = ['off', 'none', 'disabled'];

function effortIsDisabled(effort) {
  return effort != null && DISABLED_EFFORTS.includes(String(effort).toLowerCase());
}

function chooseReasoningEffort(info, requested, { requireDisabled = false } = {}) {
  const efforts = info?.reasoning?.efforts ?? [];
  const ids = efforts.map((effort) => String(effort.id));
  if (requested) {
    if (!ids.includes(requested)) {
      throw new Error(`reasoningEffort "${requested}" is not available; available: ${ids.join(', ') || '(none)'}`);
    }
    if (requireDisabled && !effortIsDisabled(requested)) {
      throw new Error(`the paper protocol requires reasoning disabled; reasoningEffort "${requested}" cannot be used for a capture. Use off/none/disabled.`);
    }
    return requested;
  }
  const off = efforts.find((effort) => effortIsDisabled(effort.id));
  if (off) return String(off.id);
  return requireDisabled ? null : (efforts[0] ? String(efforts[0].id) : null);
}

/** Paper protocol needs a direct single-pass completion; a reasoning model without off cannot provide one. */
function supportsPaperProtocol(info) {
  if (!info?.reasoning) return true;
  return (info.reasoning.efforts ?? []).some((effort) => effortIsDisabled(effort.id));
}

async function providerInfo(ctx, provider) {
  const providers = ctx.llm.listProviders();
  const found = providers.find((entry) => entry.id === provider);
  if (!found) {
    throw new Error(`unknown provider "${provider}"; available: ${providers.map((entry) => entry.id).join(', ') || '(none)'}`);
  }
  return found;
}

async function modelInfo(ctx, provider, model) {
  await providerInfo(ctx, provider);
  return ctx.llm.resolveModelInfo(provider, model);
}

const COMPARABLE_REASONING_POLICIES = new Set(['disabled', 'none']);

/**
 * Fingerprints only compare inside one measurement protocol: the same prompt
 * battery and reasoning actually disabled. Returns the refusal message, or null.
 */
export function comparabilityError(metaA, metaB) {
  const versionA = metaA?.promptVersion ?? null;
  const versionB = metaB?.promptVersion ?? null;
  if (versionA !== versionB) {
    return `records use different prompt versions (${versionA ?? 'unknown'} vs ${versionB ?? 'unknown'}); fingerprints from different prompt batteries are not comparable`;
  }
  for (const [label, meta] of [['A', metaA], ['B', metaB]]) {
    const policy = meta?.reasoningPolicy ?? null;
    if (policy !== null && !COMPARABLE_REASONING_POLICIES.has(policy)) {
      return `record ${label} was captured with reasoning policy "${policy}"; only records with reasoning disabled are comparable`;
    }
  }
  return null;
}

function adapterMetadata(info) {
  return {
    provider: info.provider,
    id: info.id,
    name: info.name,
    context: info.context ?? null,
    defaultMaxTokens: info.defaultMaxTokens ?? null,
    reasoning: info.reasoning ?? null,
    inputModalities: info.inputModalities ?? null,
  };
}

async function callModel(ctx, options, signal) {
  const { provider, model, system, prompt, reasoningEffort, sessionId = randomUUID() } = options;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([timeout, signal]) : timeout;
  const started = Date.now();
  let text = '';
  let reasoning = '';
  let usage = null;
  let finish = null;
  const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }];
  const request = {
    provider,
    model,
    system,
    messages,
    temperature: TEMPERATURE,
    maxTokens: MAX_TOKENS,
    sessionId,
    signal: combined,
  };
  if (reasoningEffort) request.reasoningEffort = reasoningEffort;

  for await (const chunk of ctx.llm.stream(request)) {
    if (chunk.type === 'text-delta') text += chunk.text;
    else if (chunk.type === 'reasoning-delta') reasoning += chunk.text;
    else if (chunk.type === 'block-end' && chunk.block?.type === 'text' && !text) text = chunk.block.text;
    else if (chunk.type === 'usage') usage = chunk.usage;
    else if (chunk.type === 'finish') finish = chunk.reason;
  }

  if (!finish) throw Object.assign(new Error('model stream ended without a finish chunk'), { code: 'NO_FINISH' });
  if (finish.kind === 'error') {
    const failure = finish.failure ?? {};
    throw Object.assign(new Error(failure.message ?? 'model request failed'), {
      code: failure.code ?? 'MODEL_ERROR',
      status: failure.status,
    });
  }
  if (finish.kind === 'aborted') {
    const failure = finish.failure ?? {};
    throw Object.assign(new Error(failure.message ?? 'model request aborted'), {
      code: failure.code ?? 'ABORTED',
      status: failure.status,
    });
  }

  return { text, reasoning, usage, finish, sessionId, latencyMs: Date.now() - started };
}

function retryable(error) {
  const code = String(error?.code ?? '');
  const status = Number(error?.status ?? 0);
  return code === 'RATE_LIMIT'
    || code === 'TIMEOUT'
    || code === 'OVERLOADED'
    || code === 'NETWORK'
    || code === 'ABORTED'
    || code === 'NO_FINISH'
    || status === 408
    || status === 429
    || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, attempts = 3, aborted = () => false) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (aborted() || attempt === attempts - 1 || !retryable(error)) throw error;
      await sleep(Math.min(30_000, 2000 * 2 ** attempt));
    }
  }
  throw last;
}

async function runOne(ctx, meta, cellId, rep, reasoningEffort, signal) {
  const cell = cellById(cellId);
  if (!cell) throw new Error(`unknown cell "${cellId}"`);
  const requestUtc = nowUtc();
  const sessionId = randomUUID();
  const result = await withRetry(
    () => callModel(ctx, {
      provider: meta.provider,
      model: meta.model,
      sessionId,
      system: PROMPTS.system_prompts[cell.lang],
      prompt: cell.task.prompts[cell.lang],
      reasoningEffort,
    }, signal),
    3,
    () => signal?.aborted === true,
  );
  const normalized = normalizeAnswer(result.text, cell.task, cell.lang);
  const reasoningLeak = result.reasoning.length > 0 || Number(result.usage?.reasoningTokens ?? 0) > 0;
  return {
    key: `${cellId}#${rep}`,
    cell: cellId,
    task: cell.taskId,
    lang: cell.lang,
    rep,
    provider: meta.provider,
    model: meta.model,
    requestUtc,
    sessionId: result.sessionId,
    latencyMs: result.latencyMs,
    raw: result.text,
    normalized: normalized.normalized,
    answerClass: reasoningLeak ? 'post_reasoning' : normalized.answerClass,
    reasoningChars: result.reasoning.length,
    reasoningTokens: Number(result.usage?.reasoningTokens ?? 0),
    finish: result.finish,
    usage: result.usage ?? null,
  };
}

async function runCheckpoint(ctx, root, meta, reasoningEffort, signal) {
  const paths = checkpointPaths(root, meta.id);
  mkdirSync(paths.dir, { recursive: true });
  ensureTrailingNewline(paths.responses);

  const existing = readJsonl(paths.responses);
  const existingKeys = new Set(existing.map((record) => record.key));
  const pending = [];
  for (const cellId of meta.cells) {
    for (let rep = 0; rep < meta.reps; rep += 1) {
      const key = `${cellId}#${rep}`;
      if (!existingKeys.has(key)) pending.push({ cellId, rep });
    }
  }

  meta.status = 'running';
  meta.startedAt = nowUtc();
  meta.completedRequests = existingKeys.size;
  writeMeta(paths.meta, meta);

  let completed = existingKeys.size;
  let attempted = completed;
  let fatalRequestError = null;
  await pool(pending, CONCURRENCY, async ({ cellId, rep }) => {
    if (fatalRequestError || signal?.aborted) return;
    try {
      const record = await runOne(ctx, meta, cellId, rep, reasoningEffort, signal);
      appendFileSync(paths.responses, `${JSON.stringify(record)}\n`);
      completed += 1;
      meta.completedRequests = completed;
      addUsage(meta.usage, record.usage);
      if (record.answerClass === 'post_reasoning') meta.reasoningLeakResponses += 1;
    } catch (error) {
      if (signal?.aborted) {
        fatalRequestError = 'capture was aborted because the plugin was unloaded; partial responses are kept';
        return;
      }
      if (/MissingSessionID/.test(String(error?.message ?? error))) {
        fatalRequestError = String(error?.message ?? error);
      }
      meta.failedRequests += 1;
      if (meta.errors.length < 20) {
        meta.errors.push({
          key: `${cellId}#${rep}`,
          message: String(error?.message ?? error),
          code: error?.code ?? null,
        });
      }
    }
    attempted += 1;
    if (attempted % 10 === 0) writeMeta(paths.meta, meta);
  });

  const records = readJsonl(paths.responses);
  meta.completedAt = nowUtc();
  meta.completedRequests = completed;
  meta.usage = aggregateUsage(records);
  if (!fatalRequestError && signal?.aborted) {
    fatalRequestError = 'capture was aborted because the plugin was unloaded; partial responses are kept';
  }
  if (fatalRequestError) {
    meta.status = 'failed';
    meta.fatalError = fatalRequestError;
    writeMeta(paths.meta, meta);
    return;
  }
  if (records.length === 0) {
    meta.status = 'failed';
    meta.fatalError = 'no successful responses';
    writeMeta(paths.meta, meta);
    return;
  }

  const fingerprint = buildFingerprint(meta, records);
  meta.cellsIncluded = fingerprint.cellsIncluded;
  meta.validRate = fingerprint.validRate;
  meta.splitHalfScore = fingerprint.splitHalf.score;
  meta.warnings = [...new Set([...(meta.warnings ?? []), ...fingerprint.warnings])];
  meta.status = meta.failedRequests > 0 ? 'completed_with_failures' : 'completed';
  writeFileSync(paths.fingerprint, `${JSON.stringify(fingerprint, null, 2)}\n`);
  writeMeta(paths.meta, meta);
}

function launchCheckpoint(ctx, root, meta, reasoningEffort, signal) {
  return runCheckpoint(ctx, root, meta, reasoningEffort, signal).catch((error) => {
    const paths = checkpointPaths(root, meta.id);
    try {
      mkdirSync(paths.dir, { recursive: true });
      meta.status = 'failed';
      meta.completedAt = nowUtc();
      meta.fatalError = String(error?.stack ?? error);
      writeMeta(paths.meta, meta);
    } catch {
      // The runner error is already reflected in the tool result path.
    }
  });
}

/**
 * A record still marked queued/running has no runner in this process: either the
 * host restarted or the plugin was unloaded mid-capture. Mark it failed, keep the
 * partial responses, and make it deletable instead of leaving it running forever.
 */
function recoverInterruptedRecords(root) {
  const dir = path.join(root, 'checkpoints');
  if (!existsSync(dir)) return 0;
  let recovered = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const paths = checkpointPaths(root, entry.name);
    if (!existsSync(paths.meta)) continue;
    let meta;
    try {
      meta = readJson(paths.meta);
    } catch {
      continue;
    }
    if (!['queued', 'running'].includes(meta.status)) continue;
    const records = readJsonl(paths.responses);
    meta.status = 'failed';
    meta.completedAt = meta.completedAt ?? nowUtc();
    meta.fatalError = 'capture was interrupted by a host restart or plugin unload; partial responses are kept';
    if (records.length > 0) {
      try {
        const fingerprint = buildFingerprint(meta, records);
        meta.cellsIncluded = fingerprint.cellsIncluded;
        meta.validRate = fingerprint.validRate;
        meta.splitHalfScore = fingerprint.splitHalf.score;
        meta.warnings = [...new Set([...(meta.warnings ?? []), ...fingerprint.warnings])];
        writeFileSync(paths.fingerprint, `${JSON.stringify(fingerprint, null, 2)}\n`);
      } catch {
        // Keep the record deletable even when its partial data cannot be aggregated.
      }
    }
    writeMeta(paths.meta, meta);
    recovered += 1;
  }
  return recovered;
}

function checkpointSummary(meta) {
  return {
    id: meta.id,
    provider: meta.provider,
    providerName: meta.providerName ?? meta.provider,
    model: meta.model,
    modelName: meta.modelName ?? meta.model,
    status: meta.status,
    createdAt: meta.createdAt,
    startedAt: meta.startedAt ?? null,
    completedAt: meta.completedAt ?? null,
    cells: Array.isArray(meta.cells) ? meta.cells.length : 0,
    reps: meta.reps,
    totalRequests: meta.totalRequests,
    completedRequests: meta.completedRequests ?? 0,
    failedRequests: meta.failedRequests ?? 0,
    cellsIncluded: meta.cellsIncluded ?? null,
    validRate: meta.validRate ?? null,
    splitHalfScore: meta.splitHalfScore ?? null,
    reasoningEffort: meta.reasoningEffort ?? null,
    reasoningPolicy: meta.reasoningPolicy ?? null,
    warnings: meta.warnings ?? [],
  };
}

function listCheckpointSummaries(root) {
  const dir = path.join(root, 'checkpoints');
  if (!existsSync(dir)) return [];
  const checkpoints = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(dir, entry.name, 'meta.json');
    if (!existsSync(metaPath)) continue;
    try {
      checkpoints.push(checkpointSummary(readJson(metaPath)));
    } catch {
      // A half-written meta from an interrupted process is skipped.
    }
  }
  checkpoints.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return checkpoints;
}

function createService(ctx, root, lifetimeSignal) {
  const active = new Set();

  async function listTargets() {
    const providers = ctx.llm.listProviders();
    const result = [];
    for (const provider of providers) {
      let models = [];
      let error = null;
      try {
        models = await ctx.llm.listModels(provider.id);
      } catch (cause) {
        error = String(cause?.message ?? cause);
      }
      const entries = [];
      for (const model of models) {
        let efforts = [];
        let defaultEffort = null;
        let modelError = null;
        let paperCompatible = false;
        try {
          const info = await ctx.llm.resolveModelInfo(provider.id, model.id);
          efforts = (info.reasoning?.efforts ?? []).map((effort) => ({
            id: effort.id,
            name: effort.name ?? effort.id,
          }));
          defaultEffort = info.reasoning?.defaultEffort ?? null;
          paperCompatible = supportsPaperProtocol(info);
        } catch (cause) {
          modelError = String(cause?.message ?? cause);
        }
        entries.push({
          id: model.id,
          name: model.name ?? model.id,
          inputModalities: model.inputModalities ?? null,
          efforts,
          defaultEffort,
          paperCompatible,
          error: modelError,
        });
      }
      result.push({ id: provider.id, name: provider.name, models: entries, error });
    }
    return { providers: result };
  }

  async function probe(args, signal) {
    if (!args || typeof args.provider !== 'string' || typeof args.model !== 'string') {
      throw new Error('probe requires provider and model');
    }
    const info = await modelInfo(ctx, args.provider, args.model);
    const effort = chooseReasoningEffort(info, args.reasoningEffort);
    const requested = Array.isArray(args.cells) && args.cells.length > 0
      ? [...new Set(args.cells)]
      : ['num100-random:en', 'num100-random:zh'];
    for (const cellId of requested) {
      if (!cellById(cellId)) throw new Error(`unknown cell "${cellId}"`);
    }
    const reps = Math.max(1, Math.min(5, Number(args.reps ?? 3)));
    const jobs = [];
    for (const cellId of requested) for (let rep = 0; rep < reps; rep += 1) jobs.push({ cellId, rep });
    const responses = [];
    await pool(jobs, 2, async ({ cellId, rep }) => {
      const cell = cellById(cellId);
      try {
        const result = await callModel(ctx, {
          provider: args.provider,
          model: args.model,
          system: PROMPTS.system_prompts[cell.lang],
          prompt: cell.task.prompts[cell.lang],
          reasoningEffort: effort,
        }, signal);
        const normalized = normalizeAnswer(result.text, cell.task, cell.lang);
        const reasoningLeak = result.reasoning.length > 0 || Number(result.usage?.reasoningTokens ?? 0) > 0;
        responses.push({
          cell: cellId,
          lang: cell.lang,
          rep,
          sessionId: result.sessionId,
          raw: result.text,
          normalized: normalized.normalized,
          answerClass: reasoningLeak ? 'post_reasoning' : normalized.answerClass,
          reasoningChars: result.reasoning.length,
          reasoningTokens: Number(result.usage?.reasoningTokens ?? 0),
          finish: result.finish,
          usage: result.usage ?? null,
          latencyMs: result.latencyMs,
        });
      } catch (error) {
        responses.push({
          cell: cellId,
          lang: cell.lang,
          rep,
          error: String(error?.message ?? error),
          code: error?.code ?? null,
          status: error?.status ?? null,
        });
      }
    });
    responses.sort((a, b) => a.cell.localeCompare(b.cell) || a.rep - b.rep);
    const successful = responses.filter((entry) => !entry.error);
    const valid = successful.filter((entry) => entry.answerClass === 'valid');
    const reasoning = successful.filter((entry) => entry.answerClass === 'post_reasoning');
    const errors = responses.filter((entry) => entry.error);
    const summary = {
      protocolCompliant: errors.length === 0 && successful.length > 0 && valid.length === successful.length && reasoning.length === 0,
      responses: responses.length,
      successful: successful.length,
      valid: valid.length,
      reasoningLeak: reasoning.length,
      errors: errors.length,
      note: 'A full capture also needs every cell to reach >=10 valid samples.',
    };
    const probeId = `probe-${nowUtc().replace(/[-:.]/g, '').slice(0, 15)}-${randomUUID().slice(0, 8)}`;
    const probeDir = path.join(root, 'probes');
    mkdirSync(probeDir, { recursive: true });
    const logPath = path.join(probeDir, `${probeId}.json`);
    writeFileSync(logPath, `${JSON.stringify({
      probeId,
      createdAt: nowUtc(),
      provider: args.provider,
      model: args.model,
      modelInfo: adapterMetadata(info),
      efforts: info.reasoning?.efforts ?? [],
      reasoningEffort: effort,
      cells: requested,
      reps,
      sessionPolicy: 'new-per-sample-reuse-on-retry',
      summary,
      responses,
    }, null, 2)}\n`);
    return {
      probeId,
      provider: args.provider,
      model: args.model,
      modelName: info.name,
      efforts: info.reasoning?.efforts ?? [],
      reasoningEffort: effort,
      reasoningDisabled: effortIsDisabled(effort),
      summary,
      responses,
      logPath,
    };
  }

  async function startCheckpoint(args) {
    if (!args || typeof args.provider !== 'string' || typeof args.model !== 'string') {
      throw new Error('a fingerprint record requires provider and model');
    }
    const info = await modelInfo(ctx, args.provider, args.model);
    if (!supportsPaperProtocol(info)) {
      throw new Error('this model cannot disable reasoning; the paper protocol needs a direct single-pass answer. Choose a model that advertises an off/none reasoning effort.');
    }
    const effort = chooseReasoningEffort(info, args.reasoningEffort, { requireDisabled: true });
    if (info.reasoning && !effortIsDisabled(effort)) {
      throw new Error('the paper protocol requires reasoning disabled; no off/none/disabled effort is available on this route.');
    }
    const cells = Array.isArray(args.cells) && args.cells.length > 0 ? [...new Set(args.cells)] : allCellIds();
    for (const cellId of cells) {
      if (!cellById(cellId)) throw new Error(`unknown cell "${cellId}"`);
    }
    const reps = Math.max(1, Math.min(100, Number(args.reps ?? DEFAULT_REPS)));
    const id = `cp-${nowUtc().replace(/[-:.]/g, '').slice(0, 15)}-${randomUUID().slice(0, 8)}`;
    const provider = await providerInfo(ctx, args.provider);
    const warnings = [];
    const meta = {
      id,
      provider: args.provider,
      providerName: provider.name,
      model: args.model,
      modelName: info.name,
      createdAt: nowUtc(),
      status: 'queued',
      promptVersion: PROMPTS.version,
      cutoff: CUTOFF,
      cells,
      reps,
      totalRequests: cells.length * reps,
      completedRequests: 0,
      failedRequests: 0,
      reasoningEffort: effort,
      reasoningPolicy: effort == null ? 'none' : effortIsDisabled(effort) ? 'disabled' : 'least-available',
      reasoningLeakResponses: 0,
      modelInfo: adapterMetadata(info),
      request: { temperature: TEMPERATURE, maxTokens: MAX_TOKENS, systemPrompt: 'per-cell', sessionPolicy: 'new-per-sample-reuse-on-retry' },
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 },
      errors: [],
      warnings,
    };
    const paths = checkpointPaths(root, id);
    mkdirSync(paths.dir, { recursive: true });
    writeMeta(paths.meta, meta);
    const task = launchCheckpoint(ctx, root, meta, effort, lifetimeSignal);
    active.add(id);
    task.finally(() => active.delete(id)).catch(() => {});
    return {
      recordId: id,
      status: 'started',
      provider: args.provider,
      model: args.model,
      cells: cells.length,
      reps,
      totalRequests: meta.totalRequests,
      reasoningEffort: effort,
      reasoningDisabled: effortIsDisabled(effort),
      warnings,
      dataDir: paths.dir,
    };
  }

  async function listCheckpoints() {
    return { checkpoints: listCheckpointSummaries(root) };
  }

  async function getCheckpoint(checkpointId) {
    if (!checkpointId || typeof checkpointId !== 'string') throw new Error('record id is required');
    assertRecordId(checkpointId);
    const paths = checkpointPaths(root, checkpointId);
    if (!existsSync(paths.meta)) throw new Error(`unknown fingerprint record "${checkpointId}"`);
    const meta = readJson(paths.meta);
    // Old records stored `tau` at capture time; the cutoff is a comparison-time
    // policy, so the API reports the current one instead of a stale stamp.
    const { tau: _legacyTau, ...checkpoint } = meta;
    const result = {
      checkpoint: { ...checkpoint, cutoff: CUTOFF },
      cutoff: CUTOFF,
      cutoffSource: 'released split-half impostor 1st percentile',
      fingerprint: null,
    };
    if (existsSync(paths.fingerprint)) {
      const fingerprint = readJson(paths.fingerprint);
      const { tau: _legacyFingerprintTau, ...rest } = fingerprint;
      result.fingerprint = {
        cellCount: rest.cellCount,
        cellsIncluded: rest.cellsIncluded,
        validRate: rest.validRate,
        splitHalf: rest.splitHalf,
        totals: rest.totals,
        cutoff: CUTOFF,
        cutoffSource: result.cutoffSource,
        paperReference: PAPER_REFERENCE,
        releasedDataReference: RELEASED_DATA_REFERENCE,
        warnings: rest.warnings,
        cells: Object.entries(rest.cells ?? {}).map(([cell, value]) => ({
          cell,
          ...value,
          ...topAnswerOf(value.distribution),
        })),
      };
    }
    return result;
  }

  async function compare(a, b) {
    if (!a || !b || typeof a !== 'string' || typeof b !== 'string') throw new Error('two record ids are required');
    assertRecordId(a);
    assertRecordId(b);
    const pathsA = checkpointPaths(root, a);
    const pathsB = checkpointPaths(root, b);
    if (!existsSync(pathsA.fingerprint)) throw new Error(`record "${a}" has no completed fingerprint`);
    if (!existsSync(pathsB.fingerprint)) throw new Error(`record "${b}" has no completed fingerprint`);
    const fingerprintA = readJson(pathsA.fingerprint);
    const fingerprintB = readJson(pathsB.fingerprint);
    const metaA = readJson(pathsA.meta);
    const metaB = readJson(pathsB.meta);
    const blocker = comparabilityError(
      { promptVersion: metaA.promptVersion ?? fingerprintA.promptVersion, reasoningPolicy: metaA.reasoningPolicy ?? null },
      { promptVersion: metaB.promptVersion ?? fingerprintB.promptVersion, reasoningPolicy: metaB.reasoningPolicy ?? null },
    );
    if (blocker) throw new Error(blocker);
    const result = {
      a: {
        id: fingerprintA.checkpointId,
        provider: fingerprintA.provider,
        model: fingerprintA.model,
        createdAt: fingerprintA.createdAt,
        cellsIncluded: fingerprintA.cellsIncluded,
      },
      b: {
        id: fingerprintB.checkpointId,
        provider: fingerprintB.provider,
        model: fingerprintB.model,
        createdAt: fingerprintB.createdAt,
        cellsIncluded: fingerprintB.cellsIncluded,
      },
      ...compareFingerprints(fingerprintA, fingerprintB),
    };
    const sessionA = metaA.request?.sessionPolicy ?? null;
    const sessionB = metaB.request?.sessionPolicy ?? null;
    if (sessionA !== sessionB) {
      result.warnings = [...result.warnings, `session policy differs (A ${sessionA ?? 'unrecorded'} / B ${sessionB ?? 'unrecorded'}); routing or caching may differ`];
    }
    return result;
  }

  async function deleteCheckpoint(recordId) {
    if (!recordId || typeof recordId !== 'string') throw new Error('record id is required');
    assertRecordId(recordId);
    const paths = checkpointPaths(root, recordId);
    if (!existsSync(paths.meta)) throw new Error(`unknown fingerprint record "${recordId}"`);
    if (active.has(recordId)) {
      throw new Error('record is still running; wait for it to finish before deleting');
    }
    rmSync(paths.dir, { recursive: true, force: true });
    return { deleted: true, recordId };
  }

  return { listTargets, probe, startCheckpoint, listCheckpoints, getCheckpoint, compare, deleteCheckpoint };
}

function toolOutput() {
  return {
    schema: { type: 'object', additionalProperties: true },
    render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  };
}

function toolDefinitions(service) {
  return [
    {
      name: 'llm_fingerprint_list_models',
      description: 'List the provider routes and models configured in this DSH profile, including each model\'s reasoning efforts and paperCompatible flag. paperCompatible=false means the model cannot disable reasoning, so a paper-protocol capture is refused. Use this before a capture to find the exact provider id and model id. Sends no model requests.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: toolOutput(),
      execute: () => service.listTargets(),
    },
    {
      name: 'llm_fingerprint_probe',
      description: 'Send a few of the paper\'s one-word probes to one provider/model route and report whether the protocol is usable. Use 2 cells x 3 reps before a full capture. Checks one-word validity, reasoning leakage, finish reason, and usage. Does not create a fingerprint record.',
      parameters: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider route id from llm_fingerprint_list_models.' },
          model: { type: 'string', description: 'Model id served by that provider route.' },
          cells: { type: 'array', description: 'Optional cell ids, e.g. "num100-random:en". Defaults to two English/Chinese number cells.', items: { type: 'string' } },
          reps: { type: 'integer', description: 'Repetitions per cell, 1-5. Default 3.' },
          reasoningEffort: { type: 'string', description: 'Optional effort id from the model metadata. Omit to use the least available effort.' },
        },
        required: ['provider', 'model'],
        additionalProperties: false,
      },
      output: toolOutput(),
      execute: (args, exec) => service.probe(args, exec.signal),
    },
    {
      name: 'llm_fingerprint_capture',
      description: 'Start one paper-protocol fingerprint capture in the background and return immediately. One record is one fingerprint of one provider/model at one time: 40 cells x 30 repetitions by default. Refuses models that cannot disable reasoning (paperCompatible=false) and rejects an explicit non-off reasoningEffort. Poll llm_fingerprint_get_record for progress and the split-half consistency. Compare any two completed records with llm_fingerprint_compare.',
      parameters: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider route id from llm_fingerprint_list_models.' },
          model: { type: 'string', description: 'Model id served by that provider route.' },
          cells: { type: 'array', description: 'Optional cell ids. Omit for the full 40-cell paper battery.', items: { type: 'string' } },
          reps: { type: 'integer', description: 'Repetitions per cell. Default 30.' },
          reasoningEffort: { type: 'string', description: 'Optional effort id. Omit to use the least available effort.' },
        },
        required: ['provider', 'model'],
        additionalProperties: false,
      },
      output: toolOutput(),
      execute: (args) => service.startCheckpoint(args),
    },
    {
      name: 'llm_fingerprint_get_record',
      description: 'Read one fingerprint record: status, request progress, valid rate, cells included, split-half consistency, usage, warnings, and the current comparison cutoff. Use it to poll a capture started by llm_fingerprint_capture.',
      parameters: {
        type: 'object',
        properties: {
          recordId: { type: 'string', description: 'Record id returned by llm_fingerprint_capture.' },
        },
        required: ['recordId'],
        additionalProperties: false,
      },
      output: toolOutput(),
      execute: (args) => service.getCheckpoint(args.recordId),
    },
    {
      name: 'llm_fingerprint_compare',
      description: 'Compare any two completed fingerprint records. score is the mean base-2 JSD over cells with >=10 valid samples on both sides; the cutoff is 0.280, the 1st percentile of different-model distances in the released trials (about 1% of different models fall below it). verdict is consistent (score <= cutoff) or inconsistent (score > cutoff) only when all 40 cells qualify and both records used 30 repetitions per cell; otherwise it is insufficient_evidence and verdictReason says why. Records captured with a different prompt version or with reasoning not disabled are refused. relation reports whether both records share a target.',
      parameters: {
        type: 'object',
        properties: {
          recordA: { type: 'string', description: 'First record id.' },
          recordB: { type: 'string', description: 'Second record id.' },
        },
        required: ['recordA', 'recordB'],
        additionalProperties: false,
      },
      output: toolOutput(),
      execute: (args) => service.compare(args.recordA, args.recordB),
    },
    {
      name: 'llm_fingerprint_delete_record',
      description: 'Permanently delete one finished fingerprint record and all its raw responses. This cannot be undone; only call it when the user explicitly asks to delete a record. A record that is still running is refused.',
      parameters: {
        type: 'object',
        properties: {
          recordId: { type: 'string', description: 'Record id to delete.' },
        },
        required: ['recordId'],
        additionalProperties: false,
      },
      output: toolOutput(),
      execute: (args) => service.deleteCheckpoint(args.recordId),
    },
  ];
}

function sendJson(res, status, value) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(`${JSON.stringify(value)}\n`);
}

async function readRequestBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('request body too large');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('invalid JSON body');
  }
}

/**
 * Authenticate one HTTP API request with the Harness Connection fence.
 * The same check the official Web routes use: Host/Origin/Sec-Fetch-Site plus a
 * live signed browser session or API peer. Returns true when the response is owned.
 */
function rejectUnauthenticated(ctx, req, res) {
  const connection = ctx.get('connection');
  if (!connection) {
    sendJson(res, 503, { error: 'web connection authentication is unavailable; the fingerprint HTTP API is disabled' });
    return true;
  }
  const rejection = connection.requestRejection(req);
  if (rejection === undefined) return false;
  res.statusCode = rejection;
  res.setHeader('Cache-Control', 'no-store');
  res.end();
  return true;
}

async function handleApi(ctx, req, res, service) {
  if (rejectUnauthenticated(ctx, req, res)) return;
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname.replace(/^\/llm-fingerprint\/api/, '') || '/';
  try {
    if (req.method === 'GET' && pathname === '/targets') {
      sendJson(res, 200, await service.listTargets());
      return;
    }
    if (req.method === 'GET' && pathname === '/checkpoints') {
      sendJson(res, 200, await service.listCheckpoints());
      return;
    }
    if (req.method === 'POST' && pathname === '/checkpoints') {
      sendJson(res, 200, await service.startCheckpoint(await readRequestBody(req)));
      return;
    }
    if (req.method === 'POST' && pathname === '/probe') {
      sendJson(res, 200, await service.probe(await readRequestBody(req)));
      return;
    }
    if (req.method === 'POST' && pathname === '/compare') {
      const body = await readRequestBody(req);
      sendJson(res, 200, await service.compare(body.a, body.b));
      return;
    }
    const match = pathname.match(/^\/checkpoints\/([^/]+)$/);
    if (req.method === 'GET' && match) {
      sendJson(res, 200, await service.getCheckpoint(decodeURIComponent(match[1])));
      return;
    }
    if (req.method === 'DELETE' && match) {
      sendJson(res, 200, await service.deleteCheckpoint(decodeURIComponent(match[1])));
      return;
    }
    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    sendJson(res, 400, { error: String(error?.message ?? error) });
  }
}

export function apply(ctx, config = {}) {
  const root = resolveDataDir(config);
  mkdirSync(path.join(root, 'checkpoints'), { recursive: true });
  mkdirSync(path.join(root, 'probes'), { recursive: true });

  recoverInterruptedRecords(root);
  const lifetime = new AbortController();
  ctx.effect(() => () => { lifetime.abort(); }, 'llm-fingerprint: abort running captures');
  const service = createService(ctx, root, lifetime.signal);
  for (const definition of toolDefinitions(service)) {
    ctx.effect(() => ctx.tools.register(definition), `llm-fingerprint: ${definition.name}`);
  }
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: (req, res) => handleApi(ctx, req, res, service),
    }),
    'llm-fingerprint: http api',
  );
}
