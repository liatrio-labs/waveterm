// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwplugins

import _ "embed"

// EmbeddedPluginsJSON contains the bundled plugin registry.
// This is used as a fallback when the file cannot be found at runtime.
//
//go:embed plugins.json
var EmbeddedPluginsJSON []byte
