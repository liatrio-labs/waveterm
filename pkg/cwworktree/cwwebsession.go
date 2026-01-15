// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwworktree

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// WebSession represents a tracked web session
type WebSession struct {
	ID               string `json:"id"`
	Description      string `json:"description"`
	Timestamp        string `json:"timestamp"`
	Source           string `json:"source"` // "handoff" or "manual"
	OriginSession    int    `json:"origin_session,omitempty"`
	OriginBranch     string `json:"branch,omitempty"`
	OriginWorkingDir string `json:"working_dir,omitempty"`
	Status           string `json:"status,omitempty"` // "active", "completed", "unknown"
}

// WebSessionsFile represents the JSON file structure
type WebSessionsFile struct {
	Sessions []WebSession `json:"sessions"`
	NextID   int          `json:"next_id"`
}

var webSessionMutex sync.Mutex

// getWebSessionsFilePath returns the path to the web sessions JSON file
func getWebSessionsFilePath(projectPath string) string {
	return filepath.Join(projectPath, ".parallel-workstation", "web-sessions.json")
}

// ensureWebSessionsFile creates the web sessions file if it doesn't exist
func ensureWebSessionsFile(projectPath string) error {
	filePath := getWebSessionsFilePath(projectPath)
	dir := filepath.Dir(filePath)

	// Create directory if it doesn't exist
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		// Create initial file
		initial := WebSessionsFile{
			Sessions: []WebSession{},
			NextID:   1,
		}
		data, err := json.MarshalIndent(initial, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal initial data: %w", err)
		}
		if err := os.WriteFile(filePath, data, 0644); err != nil {
			return fmt.Errorf("failed to write initial file: %w", err)
		}
	}

	return nil
}

// readWebSessionsFile reads the web sessions from the JSON file
func readWebSessionsFile(projectPath string) (*WebSessionsFile, error) {
	if err := ensureWebSessionsFile(projectPath); err != nil {
		return nil, err
	}

	filePath := getWebSessionsFilePath(projectPath)
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read web sessions file: %w", err)
	}

	var wsFile WebSessionsFile
	if err := json.Unmarshal(data, &wsFile); err != nil {
		return nil, fmt.Errorf("failed to parse web sessions file: %w", err)
	}

	return &wsFile, nil
}

// writeWebSessionsFile writes the web sessions to the JSON file
func writeWebSessionsFile(projectPath string, wsFile *WebSessionsFile) error {
	filePath := getWebSessionsFilePath(projectPath)
	data, err := json.MarshalIndent(wsFile, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal web sessions: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write web sessions file: %w", err)
	}

	return nil
}

// WebSessionListParams contains parameters for listing web sessions
type WebSessionListParams struct {
	ProjectPath string
}

// WebSessionList returns all tracked web sessions for a project
func WebSessionList(params WebSessionListParams) ([]WebSession, error) {
	webSessionMutex.Lock()
	defer webSessionMutex.Unlock()

	wsFile, err := readWebSessionsFile(params.ProjectPath)
	if err != nil {
		return nil, err
	}

	// Set default status for sessions without one
	for i := range wsFile.Sessions {
		if wsFile.Sessions[i].Status == "" {
			wsFile.Sessions[i].Status = "active"
		}
	}

	return wsFile.Sessions, nil
}

// WebSessionCreateParams contains parameters for creating a web session
type WebSessionCreateParams struct {
	ProjectPath      string
	Description      string
	Source           string // "handoff" or "manual"
	OriginSession    int
	OriginBranch     string
	OriginWorkingDir string
}

// WebSessionCreate creates a new web session entry
func WebSessionCreate(params WebSessionCreateParams) (*WebSession, error) {
	webSessionMutex.Lock()
	defer webSessionMutex.Unlock()

	wsFile, err := readWebSessionsFile(params.ProjectPath)
	if err != nil {
		return nil, err
	}

	// Generate new session ID
	sessionID := fmt.Sprintf("web-%d", wsFile.NextID)
	wsFile.NextID++

	// Create new session
	session := WebSession{
		ID:               sessionID,
		Description:      params.Description,
		Timestamp:        time.Now().UTC().Format(time.RFC3339),
		Source:           params.Source,
		OriginSession:    params.OriginSession,
		OriginBranch:     params.OriginBranch,
		OriginWorkingDir: params.OriginWorkingDir,
		Status:           "active",
	}

	// Default source to "manual" if not specified
	if session.Source == "" {
		session.Source = "manual"
	}

	// Default description
	if session.Description == "" {
		session.Description = "Web session"
	}

	wsFile.Sessions = append(wsFile.Sessions, session)

	if err := writeWebSessionsFile(params.ProjectPath, wsFile); err != nil {
		return nil, err
	}

	return &session, nil
}

// WebSessionUpdateParams contains parameters for updating a web session
type WebSessionUpdateParams struct {
	ProjectPath string
	SessionID   string
	Status      string // "active", "completed", "unknown"
	Description string
}

// WebSessionUpdate updates an existing web session
func WebSessionUpdate(params WebSessionUpdateParams) error {
	webSessionMutex.Lock()
	defer webSessionMutex.Unlock()

	wsFile, err := readWebSessionsFile(params.ProjectPath)
	if err != nil {
		return err
	}

	found := false
	for i := range wsFile.Sessions {
		if wsFile.Sessions[i].ID == params.SessionID {
			if params.Status != "" {
				wsFile.Sessions[i].Status = params.Status
			}
			if params.Description != "" {
				wsFile.Sessions[i].Description = params.Description
			}
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("web session not found: %s", params.SessionID)
	}

	return writeWebSessionsFile(params.ProjectPath, wsFile)
}

// WebSessionDeleteParams contains parameters for deleting a web session
type WebSessionDeleteParams struct {
	ProjectPath string
	SessionID   string
}

// WebSessionDelete removes a web session from tracking
func WebSessionDelete(params WebSessionDeleteParams) error {
	webSessionMutex.Lock()
	defer webSessionMutex.Unlock()

	wsFile, err := readWebSessionsFile(params.ProjectPath)
	if err != nil {
		return err
	}

	found := false
	newSessions := make([]WebSession, 0, len(wsFile.Sessions))
	for _, session := range wsFile.Sessions {
		if session.ID == params.SessionID {
			found = true
			continue
		}
		newSessions = append(newSessions, session)
	}

	if !found {
		return fmt.Errorf("web session not found: %s", params.SessionID)
	}

	wsFile.Sessions = newSessions

	return writeWebSessionsFile(params.ProjectPath, wsFile)
}

// WebSessionGetByID returns a specific web session by ID
func WebSessionGetByID(projectPath string, sessionID string) (*WebSession, error) {
	webSessionMutex.Lock()
	defer webSessionMutex.Unlock()

	wsFile, err := readWebSessionsFile(projectPath)
	if err != nil {
		return nil, err
	}

	for _, session := range wsFile.Sessions {
		if session.ID == sessionID {
			if session.Status == "" {
				session.Status = "active"
			}
			return &session, nil
		}
	}

	return nil, fmt.Errorf("web session not found: %s", sessionID)
}
