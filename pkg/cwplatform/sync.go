// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// SessionState represents the state of a local session
type SessionState string

const (
	SessionStateStarted   SessionState = "started"
	SessionStateRunning   SessionState = "running"
	SessionStateIdle      SessionState = "idle"
	SessionStateError     SessionState = "error"
	SessionStateCompleted SessionState = "completed"
	SessionStateStopped   SessionState = "stopped"
)

// SyncStatus represents the current synchronization status
type SyncStatus struct {
	LastSyncTime    time.Time `json:"lastSyncTime"`
	IsSyncing       bool      `json:"isSyncing"`
	PendingUpdates  int       `json:"pendingUpdates"`
	LastError       string    `json:"lastError,omitempty"`
	IsOffline       bool      `json:"isOffline"`
}

// StatusUpdate represents a pending status update
type StatusUpdate struct {
	TaskID    string    `json:"taskId"`
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Retries   int       `json:"retries"`
}

// StatusSyncer handles bidirectional status synchronization
type StatusSyncer struct {
	client        *PlatformClient
	pendingMutex  sync.Mutex
	pending       []StatusUpdate
	lastSync      time.Time
	isSyncing     bool
	isOffline     bool
}

// NewStatusSyncer creates a new status syncer
func NewStatusSyncer(client *PlatformClient) *StatusSyncer {
	return &StatusSyncer{
		client:  client,
		pending: make([]StatusUpdate, 0),
	}
}

// MapSessionStateToTaskStatus maps local session state to platform task status
func MapSessionStateToTaskStatus(state SessionState) string {
	switch state {
	case SessionStateStarted, SessionStateRunning:
		return TaskStatusProcessing
	case SessionStateIdle:
		return TaskStatusPending // Optional: could keep current
	case SessionStateError:
		return TaskStatusError
	case SessionStateCompleted:
		return "" // Don't auto-update, let user mark complete
	case SessionStateStopped:
		return "" // Don't auto-update on stop
	default:
		return ""
	}
}

// PushStatusUpdate queues a status update for the platform
func (s *StatusSyncer) PushStatusUpdate(taskID, status string) error {
	if taskID == "" || status == "" {
		return fmt.Errorf("taskID and status are required")
	}

	s.pendingMutex.Lock()
	defer s.pendingMutex.Unlock()

	// Check if there's already a pending update for this task
	for i, update := range s.pending {
		if update.TaskID == taskID {
			// Update the existing entry
			s.pending[i].Status = status
			s.pending[i].Timestamp = time.Now()
			return nil
		}
	}

	// Add new update
	s.pending = append(s.pending, StatusUpdate{
		TaskID:    taskID,
		Status:    status,
		Timestamp: time.Now(),
		Retries:   0,
	})

	return nil
}

// FlushUpdates sends all pending status updates to the platform
func (s *StatusSyncer) FlushUpdates(ctx context.Context) error {
	s.pendingMutex.Lock()
	if len(s.pending) == 0 {
		s.pendingMutex.Unlock()
		return nil
	}

	// Copy pending updates
	updates := make([]StatusUpdate, len(s.pending))
	copy(updates, s.pending)
	s.isSyncing = true
	s.pendingMutex.Unlock()

	var lastErr error
	var failed []StatusUpdate

	for _, update := range updates {
		err := s.client.UpdateTaskStatus(ctx, update.TaskID, update.Status)
		if err != nil {
			lastErr = err
			update.Retries++
			if update.Retries < 3 {
				failed = append(failed, update)
			}
		}
	}

	s.pendingMutex.Lock()
	s.isSyncing = false
	s.lastSync = time.Now()

	// Keep only failed updates (that haven't exceeded retries)
	s.pending = failed

	if lastErr != nil {
		s.isOffline = true
	} else {
		s.isOffline = false
	}
	s.pendingMutex.Unlock()

	return lastErr
}

// GetSyncStatus returns the current sync status
func (s *StatusSyncer) GetSyncStatus() SyncStatus {
	s.pendingMutex.Lock()
	defer s.pendingMutex.Unlock()

	return SyncStatus{
		LastSyncTime:   s.lastSync,
		IsSyncing:      s.isSyncing,
		PendingUpdates: len(s.pending),
		IsOffline:      s.isOffline,
	}
}

// GetPendingCount returns the number of pending updates
func (s *StatusSyncer) GetPendingCount() int {
	s.pendingMutex.Lock()
	defer s.pendingMutex.Unlock()
	return len(s.pending)
}

// MarkOffline sets the syncer to offline mode
func (s *StatusSyncer) MarkOffline() {
	s.pendingMutex.Lock()
	defer s.pendingMutex.Unlock()
	s.isOffline = true
}

// MarkOnline sets the syncer to online mode
func (s *StatusSyncer) MarkOnline() {
	s.pendingMutex.Lock()
	defer s.pendingMutex.Unlock()
	s.isOffline = false
}

// IsOffline returns whether the syncer is in offline mode
func (s *StatusSyncer) IsOffline() bool {
	s.pendingMutex.Lock()
	defer s.pendingMutex.Unlock()
	return s.isOffline
}

// DetectStatusConflict checks if local status differs from platform
func DetectStatusConflict(localStatus, platformStatus string) bool {
	if localStatus == "" || platformStatus == "" {
		return false
	}
	return localStatus != platformStatus
}
