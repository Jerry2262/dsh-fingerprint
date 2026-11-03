import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
 */
function boot(options = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'dsh-fingerprint-test-'));
  if (options.persisted !== undefined) {
    writeFileSync(join(dataDir, 'settings.json'), `${JSON.stringify(options.persisted, null, 2)}\n`);
  }

  const toolsAvailable = options.toolsAvailable !== false;
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

  const ctx = {
    effect(fn) {
      return fn();
    },
    get(name) {
      if (name === 'connection') return { requestRejection: () => undefined };
      if (name === 'tools') return toolsAvailable ? toolsService : undefined;
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

  apply(ctx, { dataDir });
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
    call,
    dispose() {
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

test('static dependencies do not require the tools service', () => {
  assert.deepEqual(inject, ['llm', 'webServer']);
});

test('the default settings keep agent tools off', async () => {
  const app = boot();
  try {
    assert.deepEqual(app.registered, []);
    assert.equal(existsSync(app.settingsFile), false);
    const { status, body } = await app.call('GET', '/settings');
    assert.equal(status, 200);
    assert.deepEqual(body.tools, { enabled: false, available: true });
  } finally {
    app.dispose();
  }
});

test('the panel switch registers the six agent tools and persists the choice', async () => {
  const app = boot();
  try {
    const { status, body } = await app.call('POST', '/settings/tools', { enabled: true });
    assert.equal(status, 200);
    assert.deepEqual(body.tools, { enabled: true, available: true });
    assert.deepEqual(app.registered, FINGERPRINT_TOOLS);
    assert.deepEqual(JSON.parse(readFileSync(app.settingsFile, 'utf8')), { tools: true });
    const after = await app.call('GET', '/settings');
    assert.deepEqual(after.body.tools, { enabled: true, available: true });
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
    assert.deepEqual(body.tools, { enabled: false, available: true });
    assert.deepEqual(app.disposed, FINGERPRINT_TOOLS);
    assert.deepEqual(JSON.parse(readFileSync(app.settingsFile, 'utf8')), { tools: false });
  } finally {
    app.dispose();
  }
});

test('a persisted on setting registers the agent tools at mount', () => {
  const app = boot({ persisted: { tools: true } });
  try {
    assert.deepEqual(app.registered, FINGERPRINT_TOOLS);
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
    assert.equal(existsSync(app.settingsFile), false);
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
  } finally {
    app.dispose();
  }
});
