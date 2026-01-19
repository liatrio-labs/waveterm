// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"testing"
)

func TestValidateAPIKeyFormat(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		wantErr bool
	}{
		{
			name:    "valid user key",
			key:     "ap_user_abc123xyz890",
			wantErr: false,
		},
		{
			name:    "valid team key",
			key:     "ap_team_abc123xyz890",
			wantErr: false,
		},
		{
			name:    "empty key",
			key:     "",
			wantErr: true,
		},
		{
			name:    "invalid prefix",
			key:     "invalid_key_format",
			wantErr: true,
		},
		{
			name:    "wrong prefix ap_admin",
			key:     "ap_admin_abc123xyz",
			wantErr: true,
		},
		{
			name:    "too short user key",
			key:     "ap_user_abc",
			wantErr: true,
		},
		{
			name:    "too short team key",
			key:     "ap_team_abc",
			wantErr: true,
		},
		{
			name:    "just user prefix",
			key:     "ap_user_",
			wantErr: true,
		},
		{
			name:    "just team prefix",
			key:     "ap_team_",
			wantErr: true,
		},
		{
			name:    "minimum valid user key",
			key:     "ap_user_12345678",
			wantErr: false,
		},
		{
			name:    "minimum valid team key",
			key:     "ap_team_12345678",
			wantErr: false,
		},
		{
			name:    "long valid key",
			key:     "ap_user_verylongkeyvalue12345678901234567890",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAPIKeyFormat(tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAPIKeyFormat(%q) error = %v, wantErr %v", tt.key, err, tt.wantErr)
			}
		})
	}
}

func TestMaskAPIKey(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		expected string
	}{
		{
			name:     "user key",
			key:      "ap_user_abc123xyz890",
			expected: "ap_user_***",
		},
		{
			name:     "team key",
			key:      "ap_team_abc123xyz890",
			expected: "ap_team_***",
		},
		{
			name:     "empty key",
			key:      "",
			expected: "",
		},
		{
			name:     "unknown format long",
			key:      "unknown_key_format",
			expected: "unknow***",
		},
		{
			name:     "unknown format short",
			key:      "abc",
			expected: "***",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MaskAPIKey(tt.key)
			if result != tt.expected {
				t.Errorf("MaskAPIKey(%q) = %q, want %q", tt.key, result, tt.expected)
			}
		})
	}
}

func TestIsValidTaskStatus(t *testing.T) {
	validStatuses := []string{
		TaskStatusPlanned,
		TaskStatusPending,
		TaskStatusInitializing,
		TaskStatusProcessing,
		TaskStatusCompleted,
		TaskStatusError,
		TaskStatusTimedOut,
		TaskStatusStopped,
		TaskStatusAwaitingFeedback,
	}

	for _, status := range validStatuses {
		t.Run("valid_"+status, func(t *testing.T) {
			if !isValidTaskStatus(status) {
				t.Errorf("isValidTaskStatus(%q) should return true", status)
			}
		})
	}

	invalidStatuses := []string{
		"invalid",
		"unknown",
		"PENDING",
		"Complete",
		"",
	}

	for _, status := range invalidStatuses {
		t.Run("invalid_"+status, func(t *testing.T) {
			if isValidTaskStatus(status) {
				t.Errorf("isValidTaskStatus(%q) should return false", status)
			}
		})
	}
}

func TestAPIKeyConstants(t *testing.T) {
	if PlatformAPIKeyName != "PLATFORM_API_KEY" {
		t.Errorf("PlatformAPIKeyName should be 'PLATFORM_API_KEY', got '%s'", PlatformAPIKeyName)
	}

	if APIKeyPrefixUser != "ap_user_" {
		t.Errorf("APIKeyPrefixUser should be 'ap_user_', got '%s'", APIKeyPrefixUser)
	}

	if APIKeyPrefixTeam != "ap_team_" {
		t.Errorf("APIKeyPrefixTeam should be 'ap_team_', got '%s'", APIKeyPrefixTeam)
	}
}

func TestTaskStatusConstants(t *testing.T) {
	expectedStatuses := map[string]string{
		"TaskStatusPlanned":          "planned",
		"TaskStatusPending":          "pending",
		"TaskStatusInitializing":     "initializing",
		"TaskStatusProcessing":       "processing",
		"TaskStatusCompleted":        "completed",
		"TaskStatusError":            "error",
		"TaskStatusTimedOut":         "timed_out",
		"TaskStatusStopped":          "stopped",
		"TaskStatusAwaitingFeedback": "awaiting_feedback",
	}

	actualStatuses := map[string]string{
		"TaskStatusPlanned":          TaskStatusPlanned,
		"TaskStatusPending":          TaskStatusPending,
		"TaskStatusInitializing":     TaskStatusInitializing,
		"TaskStatusProcessing":       TaskStatusProcessing,
		"TaskStatusCompleted":        TaskStatusCompleted,
		"TaskStatusError":            TaskStatusError,
		"TaskStatusTimedOut":         TaskStatusTimedOut,
		"TaskStatusStopped":          TaskStatusStopped,
		"TaskStatusAwaitingFeedback": TaskStatusAwaitingFeedback,
	}

	for name, expected := range expectedStatuses {
		actual, ok := actualStatuses[name]
		if !ok {
			t.Errorf("missing constant %s", name)
			continue
		}
		if actual != expected {
			t.Errorf("%s should be '%s', got '%s'", name, expected, actual)
		}
	}
}
