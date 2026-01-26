#!/usr/bin/env node

// PATCH MCP routes into Caddy's configuration
// This script updates only the routes array for the MCP Hub server

const { ports, loadCaddy } = require('../config/constants');

const url = `http://localhost:${ports.caddyAdmin}/config/apps/http/servers/srv0/routes`;
const headers = { "Content-Type": "application/json" };

// Grab JSON routes array from first CLI argument
const data = process.argv[2];
if (!data) {
  console.error("Usage: node scripts/load_caddy.js '<json-routes-array>'");
  process.exit(1);
}

// Validate it's proper JSON
let parsedData;
try {
  parsedData = JSON.parse(data);
  if (!Array.isArray(parsedData)) {
    throw new Error("Data must be a JSON array");
  }
} catch (err) {
  console.error("Error: argument must be a valid JSON array:", err.message);
  process.exit(1);
}

console.log(`---\nPATCHing ${parsedData.length} MCP routes to ${url}\n---\n`);

// Retry configuration
const maxRetries = loadCaddy.maxRetries;
const retryDelay = loadCaddy.retryDelayMs;

// Main async function
(async function () {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers,
        body: data,
      });

      const responseText = await res.text();

      if (res.ok) {
        console.log(`Successfully loaded Caddy config (attempt ${attempt}/${maxRetries})`);
        console.log(`Response: ${res.status} ${res.statusText}`);
        if (responseText) {
          console.log(responseText);
        }
        process.exit(0);
      } else {
        throw new Error(`${res.status} ${res.statusText}: ${responseText}`);
      }
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`Failed to load Caddy config after ${maxRetries} attempts`);
        console.error(`Last error: ${err.message}`);
        process.exit(1);
      } else {
        console.log(`Attempt ${attempt}/${maxRetries} failed, retrying in 1s...`);
        console.log(`   Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
})();
