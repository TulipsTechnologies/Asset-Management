/**
 * CLI argument + environment parsing (visual design §9 as amended by §12.7):
 *
 *   npm run visual -- --level smoke|regression|full [--module <moduleKey>]
 *     [--scenario <key>] [--base-url <frontend>] [--api-url <backend>]
 *
 * Env: VISUAL_USER / VISUAL_PASSWORD (required, masked in ALL output),
 * VISUAL_REVIEW_POLICY (strict|warn — warn downgrades ReviewRequired to a warning
 * exit, §4), VISUAL_COMPANY_ID (optional explicit registered-company override).
 */
'use strict';

const LEVELS = { smoke: 1, regression: 2, full: 3 };

function parseArgs(argv) {
  const options = {
    level: 'regression',
    module: null,
    scenario: null,
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:5199',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };
    switch (arg) {
      case '--level':
        options.level = next().toLowerCase();
        break;
      case '--module':
        options.module = next();
        break;
      case '--scenario':
        options.scenario = next();
        break;
      case '--base-url':
        options.baseUrl = next().replace(/\/+$/, '');
        break;
      case '--api-url':
        options.apiUrl = next().replace(/\/+$/, '');
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!(options.level in LEVELS)) {
    throw new Error(`--level must be one of smoke|regression|full (got "${options.level}")`);
  }
  options.levelValue = LEVELS[options.level];

  const user = process.env.VISUAL_USER;
  const password = process.env.VISUAL_PASSWORD;
  if (!user || !password) {
    throw new Error('VISUAL_USER and VISUAL_PASSWORD environment variables are required.');
  }
  options.user = user;
  options.password = password;

  const policy = (process.env.VISUAL_REVIEW_POLICY || 'strict').toLowerCase();
  if (policy !== 'strict' && policy !== 'warn') {
    throw new Error(`VISUAL_REVIEW_POLICY must be "strict" or "warn" (got "${policy}")`);
  }
  options.reviewPolicy = policy;

  options.companyIdOverride = process.env.VISUAL_COMPANY_ID || null;

  return options;
}

module.exports = { parseArgs, LEVELS };
