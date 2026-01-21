// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwskills

import _ "embed"

// EmbeddedSkillsJSON contains the bundled skill registry.
// This is used as a fallback when the file cannot be found at runtime.
//
//go:embed skills.json
var EmbeddedSkillsJSON []byte
