#!/usr/bin/env node

// Generate index.html from mcp-config.yaml
// This script uses js-yaml via dynamic import

const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const { ports } = require('../config/constants');

const projectRoot = join(__dirname, '..');

// Dynamically load js-yaml
async function loadYAML() {
  const { execSync } = require('child_process');
  const cacheDir = process.env.MCP_CACHE_DIR || join(projectRoot, '.cache');
  const yamlPath = join(cacheDir, 'node_modules', 'js-yaml');

  try {
    const yaml = require(yamlPath);
    return yaml;
  } catch (err) {
    console.log(`Installing js-yaml to ${cacheDir} (one-time setup)...`);
    mkdirSync(cacheDir, { recursive: true });

    try {
      // Use cwd option instead of cd to handle paths with spaces
      execSync(`npm install js-yaml@4.1.0 --no-save --silent`, {
        cwd: cacheDir,
        stdio: 'pipe'
      });
      const yaml = require(yamlPath);
      console.log('js-yaml installed successfully');
      return yaml;
    } catch (installErr) {
      console.error('Failed to install js-yaml:', installErr.message);
      process.exit(1);
    }
  }
}

// Main execution
(async function main() {
  const yaml = await loadYAML();
  const mcpConfigFile = process.env.MCP_CONFIG_FILE || 'mcp-config.yaml';
  const indexHtmlFilePath = process.env.INDEX_HTML_FILE || 'temp/index.html';

  let config;
  try {
    const yamlContent = readFileSync(join(projectRoot, mcpConfigFile), 'utf8');
    config = yaml.load(yamlContent);
  } catch (err) {
    console.error('Error reading mcp-config.yaml:', err.message);
    process.exit(1);
  }

  const html = generateHTML(config);

  const tempDir = join(projectRoot, 'temp');
  try {
    mkdirSync(tempDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error(`Failed to create temp directory: ${err.message}`);
      process.exit(1);
    }
  }

  try {
    writeFileSync(indexHtmlFilePath, html, 'utf8');
    console.log(`Generated ${indexHtmlFilePath} successfully`);
    process.exit(0);
  } catch (err) {
    console.error(`Error writing ${indexHtmlFilePath}:`, err.message);
    process.exit(1);
  }
})();

function generateHTML(config) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Hub - Liatrio Wave</title>
  <style>
${generateCSS()}
  </style>
</head>
<body>
  <div class="container">
${generateOverview()}
${generateInfrastructure(config)}
${generateMCPServers(config)}
${generateTools(config)}
  </div>
</body>
</html>`;
}

function generateCSS() {
  return `    :root {
      --bg-dark: #002b36;
      --bg-medium: #001b20;
      --bg-light: #00242d;
      --bg-hover: #073642;
      --accent-cyan: #20ba31;
      --success-green: #20ba31;
      --warning-yellow: #ffa500;
      --error-red: #ff4444;
      --text-primary: #ffffff;
      --text-secondary: #ccdade;
      --text-muted: #2d4d55;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: "SF Mono", Monaco, "Cascadia Code", Consolas, monospace;
      --border-radius: 4px;
      --border-radius-lg: 8px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg-dark);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.6;
      padding: 24px;
    }

    .container { max-width: 1200px; margin: 0 auto; }

    h1 { font-size: 24px; font-weight: 600; margin-bottom: 16px; }
    h2 { font-size: 18px; font-weight: 600; margin-top: 32px; margin-bottom: 16px; border-bottom: 1px solid var(--bg-light); padding-bottom: 8px; }

    .overview {
      background: var(--bg-medium);
      padding: 24px;
      border-radius: var(--border-radius-lg);
      margin-bottom: 32px;
    }

    .overview p { margin-bottom: 16px; color: var(--text-secondary); }
    .overview a { color: var(--text-secondary); text-decoration: underline; }
    .overview a:hover { color: var(--text-primary); }

    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .service-card {
      background: var(--bg-medium);
      border: 1px solid var(--bg-light);
      border-radius: var(--border-radius-lg);
      padding: 16px;
      transition: all 0.2s ease;
    }

    .service-card:hover { background: var(--bg-hover); }

    .service-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }

    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .status-indicator.enabled {
      background: var(--success-green);
      box-shadow: 0 0 8px var(--success-green);
    }

    .status-indicator.disabled { background: var(--text-muted); }

    .service-name { font-size: 16px; font-weight: 600; font-family: var(--font-mono); }
    .service-port { margin-left: auto; font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); background: rgba(0, 0, 0, 0.2); padding: 2px 8px; border-radius: var(--border-radius); }
    .service-description { color: var(--text-secondary); font-size: 13px; margin-bottom: 8px; min-height: 20px; }

    .proxy-url-section { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
    .proxy-url-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .proxy-url-display { display: flex; align-items: center; gap: 8px; background: rgba(0, 0, 0, 0.2); border-radius: var(--border-radius); padding: 6px 10px; }
    .proxy-url-text { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

    .service-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .service-link { display: inline-block; padding: 4px 12px; background: var(--bg-hover); border: 1px solid var(--text-muted); color: var(--text-secondary); text-decoration: none; border-radius: var(--border-radius); font-size: 12px; transition: all 0.15s ease; }
    .service-link:hover { background: var(--bg-light); border-color: var(--text-secondary); color: var(--text-primary); }

    @media (max-width: 768px) {
      .services-grid { grid-template-columns: 1fr; }
      body { padding: 16px; }
    }`;
}

function generateOverview() {
  return `    <div class="overview">
      <h1>MCP Hub - Liatrio Wave</h1>
      <p><em>Run MCPs locally, manage them centrally</em></p>
      <p>Centralized Model Context Protocol (MCP) server hub for local development. All your Claude Code sessions connect to one shared instance of each MCP server.</p>
      <p>
        <strong>Quick Links:</strong>
        <a href="http://localhost:${ports.tiltUi}/r/(all)/overview" target="_blank">Tilt UI</a> |
        <a href="http://localhost:${ports.inspectorUi}" target="_blank">MCP Inspector</a>
      </p>
    </div>`;
}

function generateInfrastructure(config) {
  const infrastructure = config.infrastructure || {};
  const services = Object.entries(infrastructure);

  if (services.length === 0) return '';

  let html = `    <h2>Infrastructure</h2>\n    <div class="services-grid">\n`;

  for (const [name, service] of services) {
    const enabled = service.enabled !== false;
    const port = service.port || 'N/A';
    const description = service.description || 'Core infrastructure service';

    html += `      <div class="service-card">
        <div class="service-header">
          <div class="status-indicator ${enabled ? 'enabled' : 'disabled'}"></div>
          <div class="service-name">${name}</div>
          <div class="service-port">:${port}</div>
        </div>
        <div class="service-description">${description}</div>
        <div class="service-links">
          <a href="http://localhost:${port}" class="service-link" target="_blank">Open</a>
        </div>
      </div>\n`;
  }

  html += `    </div>\n`;
  return html;
}

function generateMCPServers(config) {
  const mcpServers = config.mcp_servers || {};
  const services = Object.entries(mcpServers);

  if (services.length === 0) return '';

  let html = `    <h2>MCP Servers</h2>\n    <div class="services-grid">\n`;

  for (const [name, service] of services) {
    const enabled = service.enabled !== false;
    const port = service.port || 'N/A';
    const description = service.description || '';

    const caddyProxyUrl = `http://localhost:${ports.caddyPublic}/mcps/${name}/mcp`;
    const inspectorUrl = `http://localhost:${ports.inspectorUi}?MCP_PROXY_PORT=${ports.inspectorProxy}&transport=streamable-http&serverUrl=http://localhost:${ports.caddyPublic}/mcps/${name}/mcp`;

    html += `      <div class="service-card">
        <div class="service-header">
          <div class="status-indicator ${enabled ? 'enabled' : 'disabled'}"></div>
          <div class="service-name">mcp-${name}</div>
          <div class="service-port">:${port}</div>
        </div>
        <div class="service-description">${description}</div>
        <div class="proxy-url-section">
          <div class="proxy-url-label">Caddy URL</div>
          <div class="proxy-url-display">
            <span class="proxy-url-text">${caddyProxyUrl}</span>
          </div>
        </div>
        <div class="service-links">
          <a href="${caddyProxyUrl}" class="service-link" target="_blank">Caddy Proxy</a>
          <a href="http://localhost:${port}/mcp" class="service-link" target="_blank">Direct</a>
          <a href="${inspectorUrl}" class="service-link" target="_blank">Inspector</a>
        </div>
      </div>\n`;
  }

  html += `    </div>\n`;
  return html;
}

function generateTools(config) {
  const tools = config.tools || {};
  const services = Object.entries(tools);

  if (services.length === 0) return '';

  let html = `    <h2>Tools</h2>\n    <div class="services-grid">\n`;

  for (const [name, service] of services) {
    const enabled = service.enabled !== false;
    const port = service.port || 'N/A';
    const description = service.description || 'Development tool';

    html += `      <div class="service-card">
        <div class="service-header">
          <div class="status-indicator ${enabled ? 'enabled' : 'disabled'}"></div>
          <div class="service-name">${name}</div>
          <div class="service-port">:${port}</div>
        </div>
        <div class="service-description">${description}</div>
        <div class="service-links">
          <a href="http://localhost:${port}" class="service-link" target="_blank">Open UI</a>
        </div>
      </div>\n`;
  }

  html += `    </div>\n`;
  return html;
}
