/**
 * Backend API client (visual design §8/§9 as amended by §12). Talks to
 * VisualRegressionController + the SystemTest environment endpoint using the SAME
 * conventions as src/services/httpService.ts: `Authorization: Bearer <token>`,
 * `x-company-id: <ActiveCompanyId>`, and the Result envelope
 * `{success, statusCode, message, reasonCode, data}` (camelCase, enums as numbers).
 *
 * Every refusal surfaces as an ApiError carrying the server's reasonCode, so the CLI
 * can print named reasons instead of raw stacks (§12.4/§12.5).
 */
'use strict';

const log = require('./log');

class ApiError extends Error {
  constructor(message, { reasonCode = null, statusCode = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.reasonCode = reasonCode;
    this.statusCode = statusCode;
  }
}

class ApiClient {
  constructor(apiUrl) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.token = null;
    this.companyId = null;
  }

  headers(extra = {}) {
    const h = { 'Accept-Language': 'en', ...extra };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    if (this.companyId) h['x-company-id'] = this.companyId;
    return h;
  }

  /** JSON request → envelope.data, or throws ApiError with the envelope's reason. */
  async requestJson(method, path, body = null) {
    const url = `${this.apiUrl}/api${path}`;
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: this.headers(body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ApiError(
        `Unable to reach the API at ${this.apiUrl} (${err.message}). Check that the backend is running.`,
        { reasonCode: 'VISUAL_API_UNREACHABLE' }
      );
    }

    let envelope = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        envelope = await res.json();
      } catch {
        envelope = null;
      }
    }

    if (!envelope || typeof envelope !== 'object') {
      if (!res.ok) {
        throw new ApiError(`HTTP ${res.status} from ${method} ${path}`, {
          statusCode: res.status,
        });
      }
      return null;
    }

    if (envelope.success === false || (envelope.statusCode && envelope.statusCode >= 400)) {
      throw new ApiError(envelope.message || `HTTP ${envelope.statusCode} from ${method} ${path}`, {
        reasonCode: envelope.reasonCode || null,
        statusCode: envelope.statusCode || res.status,
      });
    }

    return envelope.data !== undefined ? envelope.data : envelope;
  }

  /** POST /api/AppUsers/Login {userName, password} → data.token (§12.8). */
  async login(userName, password) {
    const data = await this.requestJson('POST', '/AppUsers/Login', { userName, password });
    if (!data || !data.token) {
      throw new ApiError('Login succeeded but no token was returned.', {
        reasonCode: 'VISUAL_AUTH_FAILED',
      });
    }
    // The bearer token authenticates every later call — never let it print.
    log.registerSecret(data.token);
    this.token = data.token;
    return data;
  }

  /** GET /api/SystemTest/environment — provisioned/registered framework companies (§6). */
  environment() {
    return this.requestJson('GET', '/SystemTest/environment');
  }

  /** GET /api/VisualRegression/dataset-state — the "demo" pre-flight check (§6). */
  datasetState() {
    return this.requestJson('GET', '/VisualRegression/dataset-state');
  }

  /** GET /api/VisualRegression/scenarios?level=&moduleKey= — the capture plan (§12.5). */
  scenarios(levelValue, moduleKey) {
    const q = new URLSearchParams({ level: String(levelValue) });
    if (moduleKey) q.set('moduleKey', moduleKey);
    return this.requestJson('GET', `/VisualRegression/scenarios?${q}`);
  }

  /** POST /api/VisualRegression/runs → {runId, level, totalCaptures}. */
  createRun(moduleKey, levelValue) {
    return this.requestJson('POST', '/VisualRegression/runs', {
      moduleKey: moduleKey || null,
      level: levelValue,
    });
  }

  heartbeat(runId) {
    return this.requestJson('POST', `/VisualRegression/runs/${runId}/heartbeat`);
  }

  completeRun(runId) {
    return this.requestJson('POST', `/VisualRegression/runs/${runId}/complete`);
  }

  abortRun(runId) {
    return this.requestJson('POST', `/VisualRegression/runs/${runId}/abort`);
  }

  /** GET /api/VisualRegression/baselines?scenarioKey=&viewport= (history included). */
  baselines(scenarioKey, viewport) {
    const q = new URLSearchParams();
    if (scenarioKey) q.set('scenarioKey', scenarioKey);
    if (viewport) q.set('viewport', viewport);
    return this.requestJson('GET', `/VisualRegression/baselines?${q}`);
  }

  /** GET /api/VisualRegression/files/{id} → PNG bytes (company-scoped, §12.1). */
  async downloadFile(fileId) {
    const url = `${this.apiUrl}/api/VisualRegression/files/${fileId}`;
    const res = await fetch(url, { headers: this.headers() });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || contentType.includes('application/json')) {
      let reasonCode = null;
      let message = `HTTP ${res.status} downloading file ${fileId}`;
      if (contentType.includes('application/json')) {
        try {
          const envelope = await res.json();
          reasonCode = envelope.reasonCode || null;
          message = envelope.message || message;
        } catch {
          /* keep defaults */
        }
      }
      throw new ApiError(message, { reasonCode, statusCode: res.status });
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * POST multipart /api/VisualRegression/runs/{id}/results — field names match the
   * backend's VisualResultForm exactly; enums travel as their numeric values.
   */
  async ingestResult(runId, payload) {
    const form = new FormData();
    form.set('ScenarioKey', payload.scenarioKey);
    form.set('Viewport', payload.viewport);
    form.set('Platform', payload.platform);
    if (payload.browserVersion) form.set('BrowserVersion', payload.browserVersion);
    if (payload.baselineId) form.set('BaselineId', payload.baselineId);
    if (payload.baselineFileSha256) form.set('BaselineFileSha256', payload.baselineFileSha256);
    form.set('DiffPixelRatio', payload.diffPixelRatio.toFixed(6));
    form.set('FunctionalStatus', String(payload.functionalStatus));
    form.set('RenderFailed', payload.renderFailed ? 'true' : 'false');
    form.set('DimensionMismatch', payload.dimensionMismatch ? 'true' : 'false');
    if (payload.jsErrorsJson) form.set('JsErrorsJson', payload.jsErrorsJson);
    if (payload.failedAssertionsJson) form.set('FailedAssertionsJson', payload.failedAssertionsJson);
    if (payload.missingCriticalSelectorsJson)
      form.set('MissingCriticalSelectorsJson', payload.missingCriticalSelectorsJson);
    if (payload.durationMs != null) form.set('DurationMs', String(payload.durationMs));
    if (payload.currentPng) {
      form.set(
        'Current',
        new Blob([payload.currentPng], { type: 'image/png' }),
        `${payload.scenarioKey}_${payload.viewport}_current.png`
      );
    }
    if (payload.diffPng) {
      form.set(
        'Diff',
        new Blob([payload.diffPng], { type: 'image/png' }),
        `${payload.scenarioKey}_${payload.viewport}_diff.png`
      );
    }

    const url = `${this.apiUrl}/api/VisualRegression/runs/${runId}/results`;
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: this.headers(), body: form });
    } catch (err) {
      throw new ApiError(`Unable to submit result: ${err.message}`, {
        reasonCode: 'VISUAL_API_UNREACHABLE',
      });
    }

    let envelope = null;
    try {
      envelope = await res.json();
    } catch {
      /* fall through */
    }
    if (!envelope || envelope.success === false || (envelope.statusCode && envelope.statusCode >= 400)) {
      throw new ApiError(
        (envelope && envelope.message) || `HTTP ${res.status} submitting result`,
        {
          reasonCode: (envelope && envelope.reasonCode) || null,
          statusCode: (envelope && envelope.statusCode) || res.status,
        }
      );
    }
    return envelope.data;
  }
}

module.exports = { ApiClient, ApiError };
