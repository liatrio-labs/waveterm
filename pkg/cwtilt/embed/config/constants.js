// Central configuration defaults for MCP Hub scripts
// Values can be overridden via environment variables.

function getNumberEnv(key, fallback) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${key} must be a number. Received "${value}".`);
  }

  return parsed;
}

const ports = {
  caddyPublic: getNumberEnv('CADDY_PUBLIC_PORT', 9101),
  caddyAdmin: getNumberEnv('CADDY_ADMIN_PORT', 9102),
  inspectorUi: getNumberEnv('MCP_INSPECTOR_UI_PORT', 9103),
  inspectorProxy: getNumberEnv('MCP_INSPECTOR_PROXY_PORT', 9104),
  tiltUi: getNumberEnv('TILT_UI_PORT', 10350),
};

const loadCaddy = {
  maxRetries: getNumberEnv('LOAD_CADDY_MAX_RETRIES', 5),
  retryDelayMs: getNumberEnv('LOAD_CADDY_RETRY_DELAY_MS', 1000),
};

module.exports = {
  ports,
  loadCaddy,
};
