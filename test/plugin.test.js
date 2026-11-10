import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { apply, inject } from '../index.js';

const FINGERPRINT_TOOLS = [
  'llm_fingerprint_list_models',
  'llm_fingerprint_probe',
  'llm_fingerprint_capture',
  'llm_fingerprint_get_record',
  'llm_fingerprint_compare',
  'llm_fingerprint_delete_record',
];

/** A minimal HTTP response the plugin's sendJson understands. */
function fakeResponse() {
  return {
    headersSent: false,
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(text = '') {
      this.headersSent = true;
      this.body = text;
    },
  };
}

/** A minimal HTTP request, including the async body iteration readRequestBody uses. */
function fakeRequest(method, path, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  return {
    method,
    url: path,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

/**
 * Apply the plugin to a fake host and expose the registered HTTP API plus the
 * agent-tool side effects, so the panel-facing routes can be exercised directly.
 *
 * The fake config editor mimics the Loader's volatile-only path: it writes the
 * row config and notifies the plugin through `loader/volatile-update` instead of
 * reloading it, which is what a `.volatile()` field gets in a real profile.
 */
function boot(options = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'dsh-fingerprint-test-'));
  if (options.legacySettings !== undefined) {
    writeFileSync(join(dataDir, 'settings.json'), `${JSON.stringify(options.legacySettings, null, 2)}\n`);
  }

  const toolsAvailable = options.toolsAvailable !== false;
  const configEditorAvailable = options.configEditorAvailable !== false;
  const state = { tools: options.enabled === true };
  const config = { dataDir, tools: { get: () => state.tools } };
  const entry = {
    options: { id: 'llm-fingerprint', name: 'dsh-fingerprint', config: {} },
    fiber: { uid: 'fingerprint-plugin' },
  };
  const listeners = [];
  const registered = [];
  const disposed = [];
  const routes = [];

  const toolsService = {
    register(definition) {
      registered.push(definition.name);
      return () => {
        disposed.push(definition.name);
      };
    },
  };

  const configEditor = {
    entries() {
      return [entry];
    },
    async edit(target, change) {
      const next = change(structuredClone(target.options.config ?? {}), {});
      target.options.config = next;
      if (typeof next.tools === 'boolean') state.tools = next.tools;
      for (const listener of listeners) await listener([['tools']]);
    },
  };

  const ctx = {
    fiber: { uid: 'fingerprint-plugin' },
    logger: { warn() {} },
    effect(fn) {
      return fn();
    },
    on(event, handler) {
      if (event === 'loader/volatile-update') listeners.push(handler);
      return () => {
        const index = listeners.indexOf(handler);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    get(name) {
      if (name === 'connection') return { requestRejection: () => undefined };
      if (name === 'tools') return toolsAvailable ? toolsService : undefined;
      if (name === 'configEditor') return configEditorAvailable ? configEditor : undefined;
      return undefined;
    },
    llm: {},
    webServer: {
      register(definition) {
        routes.push(definition);
        return () => {};
      },
    },
    inject(dependencies, callback) {
      const cleanups = [];
      const childCtx = {
        tools: toolsService,
        effect(fn) {
          const cleanup = fn();
          cleanups.push(cleanup);
          return cleanup;
        },
      };
      callback(childCtx);
      return {
        async dispose() {
          for (const cleanup of cleanups.splice(0)) cleanup();
        },
      };
    },
  };

  apply(ctx, config);
  const settingsFile = join(dataDir, 'settings.json');
  const handler = routes.find((route) => route.path === '/llm-fingerprint/api').handler;

  async function call(method, path, body) {
    const res = fakeResponse();
    await handler(fakeRequest(method, `/llm-fingerprint/api${path}`, body), res);
    return {
      status: res.statusCode,
      body: res.body ? JSON.parse(res.body) : null,
      raw: res.body,
    };
  }

  return {
    registered,
    disposed,
    routes,
    settingsFile,
    entry,
    call,
    dispose() {
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

test('static dependencies do not require the tools service', () => {
  assert.deepEqual(inject, ['llm', 'webServer']);
});

test('the default config keeps agent tools off', async () => {
  const app = boot();
  try {
    assert.deepEqual(app.registered, []);
    assert.equal(existsSync(app.settingsFile), false);
    const { status, body } = await app.call('GET', '/settings');
    assert.equal(status, 200);
    assert.deepEqual(body.tools, { enabled: false, available: true, editable: true });
  } finally {
    app.dispose();
  }
});

test('the panel switch writes the row config and registers the six agent tools', async () => {
  const app = boot();
  try {
    const { status, body } = await app.call('POST', '/settings/tools', { enabled: true });
    assert.equal(status, 200);
    assert.deepEqual(body.tools, { enabled: true, available: true, editable: true });
    assert.deepEqual(app.registered, FINGERPRINT_TOOLS);
    assert.deepEqual(app.entry.options.config, { tools: true });
    assert.equal(existsSync(app.settingsFile), false);
    const after = await app.call('GET', '/settings');
    assert.deepEqual(after.body.tools, { enabled: true, available: true, editable: true });
  } finally {
    app.dispose();
  }
});

test('turning the switch off unregisters the agent tools immediately', async () => {
  const app = boot();
  try {
    await app.call('POST', '/settings/tools', { enabled: true });
    const { status, body } = await app.call('POST', '/settings/tools', { enabled: false });
    assert.equal(status, 200);
    assert.deepEqual(body.tools, { enabled: false, available: true, editable: true });
    assert.deepEqual(app.disposed, FINGERPRINT_TOOLS);
    assert.deepEqual(app.entry.options.config, { tools: false });
  } finally {
    app.dispose();
  }
});

test('an enabled row config registers the agent tools at mount', () => {
  const app = boot({ enabled: true });
  try {
    assert.deepEqual(app.registered, FINGERPRINT_TOOLS);
    assert.deepEqual(app.disposed, []);
  } finally {
    app.dispose();
  }
});

test('a legacy settings.json is not read', async () => {
  const app = boot({ legacySettings: { tools: true } });
  try {
    assert.deepEqual(app.registered, []);
    const { body } = await app.call('GET', '/settings');
    assert.equal(body.tools.enabled, false);
  } finally {
    app.dispose();
  }
});

test('enabling is refused without the tools service', async () => {
  const app = boot({ toolsAvailable: false });
  try {
    const { status, body } = await app.call('POST', '/settings/tools', { enabled: true });
    assert.equal(status, 400);
    assert.match(body.error, /tools service is unavailable/i);
    assert.deepEqual(app.registered, []);
    assert.deepEqual(app.entry.options.config, {});
  } finally {
    app.dispose();
  }
});

test('the switch is read-only without the config editor', async () => {
  const app = boot({ configEditorAvailable: false });
  try {
    const current = await app.call('GET', '/settings');
    assert.deepEqual(current.body.tools, { enabled: false, available: true, editable: false });
    const { status, body } = await app.call('POST', '/settings/tools', { enabled: true });
    assert.equal(status, 400);
    assert.match(body.error, /configEditor service is unavailable/i);
    assert.deepEqual(app.registered, []);
    assert.deepEqual(app.entry.options.config, {});
  } finally {
    app.dispose();
  }
});

test('a non-boolean switch value is rejected', async () => {
  const app = boot();
  try {
    const { status, body } = await app.call('POST', '/settings/tools', { enabled: 'yes' });
    assert.equal(status, 400);
    assert.match(body.error, /enabled must be a boolean/i);
    assert.deepEqual(app.registered, []);
    assert.deepEqual(app.entry.options.config, {});
  } finally {
    app.dispose();
  }
});
