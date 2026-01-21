// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwmcp

import _ "embed"

// EmbeddedMCPServersJSON contains the bundled MCP server templates.
// This is used as a fallback when the file cannot be found at runtime.
//
//go:embed mcp-servers.json
var EmbeddedMCPServersJSON []byte
