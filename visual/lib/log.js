/**
 * Masked logger (visual design §12.7): VISUAL_USER / VISUAL_PASSWORD values are
 * replaced with *** in EVERY line this process prints — messages, errors, stacks,
 * URLs — so credentials can never leak into terminal scrollback or CI logs.
 *
 * Every module logs through here; nothing calls console.* directly.
 */
'use strict';

const secrets = [];

/** Registers a secret value to be masked in all subsequent output. */
function registerSecret(value) {
  if (typeof value === 'string' && value.length > 0 && !secrets.includes(value)) {
    secrets.push(value);
  }
}

function maskText(text) {
  let out = String(text);
  for (const secret of secrets) {
    // split/join instead of a RegExp so secret characters are never interpreted.
    out = out.split(secret).join('***');
    // Also mask URL-encoded and JSON-escaped occurrences.
    const encoded = encodeURIComponent(secret);
    if (encoded !== secret) out = out.split(encoded).join('***');
    const jsonEscaped = JSON.stringify(secret).slice(1, -1);
    if (jsonEscaped !== secret) out = out.split(jsonEscaped).join('***');
  }
  return out;
}

function format(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return maskText(a.stack || a.message);
      if (typeof a === 'object' && a !== null) {
        try {
          return maskText(JSON.stringify(a));
        } catch {
          return maskText(String(a));
        }
      }
      return maskText(String(a));
    })
    .join(' ');
}

function info(...args) {
  process.stdout.write(format(args) + '\n');
}

function warn(...args) {
  process.stderr.write('WARN  ' + format(args) + '\n');
}

function error(...args) {
  process.stderr.write('ERROR ' + format(args) + '\n');
}

module.exports = { registerSecret, maskText, info, warn, error };
