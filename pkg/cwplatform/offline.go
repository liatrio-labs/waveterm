// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// OfflineQueue manages queued updates when offline
type OfflineQueue struct {
	updates []QueuedUpdate
	mutex   sync.Mutex
}

// QueuedUpdate represents a single update waiting to be sent
type QueuedUpdate struct {
	TaskID    string    `json:"taskId"`
	Field     string    `json:"field"`
	Value     string    `json:"value"`
	Timestamp time.Time `json:"timestamp"`
	Retries   int       `json:"retries"`
}

// TaskCache holds cached task data for offline access
type TaskCache struct {
	Projects    []Project            `json:"projects,omitempty"`
	Products    map[string][]Product `json:"products,omitempty"` // projectId -> products
	Specs       map[string][]Spec    `json:"specs,omitempty"`    // productId -> specs
	Tasks       map[string][]Task    `json:"tasks,omitempty"`    // specId -> tasks
	LastUpdated time.Time            `json:"lastUpdated"`
	mutex       sync.RWMutex
}

// PlatformConfig holds platform configuration settings
type PlatformConfig struct {
	Enabled           bool   `json:"enabled"`
	BaseURL           string `json:"baseUrl"`
	DisplayMode       string `json:"displayMode"`       // sidebar, tab, floating
	PollInterval      int    `json:"pollInterval"`      // milliseconds
	AutoInjectContext bool   `json:"autoInjectContext"`
}

// DefaultPlatformConfig returns the default platform configuration
func DefaultPlatformConfig() PlatformConfig {
	return PlatformConfig{
		Enabled:           false,
		BaseURL:           DefaultBaseURL,
		DisplayMode:       "sidebar",
		PollInterval:      30000,
		AutoInjectContext: true,
	}
}

// --- OfflineQueue Methods ---

// NewOfflineQueue creates a new offline queue
func NewOfflineQueue() *OfflineQueue {
	return &OfflineQueue{
		updates: make([]QueuedUpdate, 0),
	}
}

// Enqueue adds an update to the queue
func (q *OfflineQueue) Enqueue(update QueuedUpdate) {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if update.Timestamp.IsZero() {
		update.Timestamp = time.Now()
	}

	// Check for duplicate (same taskID and field)
	for i, existing := range q.updates {
		if existing.TaskID == update.TaskID && existing.Field == update.Field {
			q.updates[i] = update // Replace with newer value
			return
		}
	}

	q.updates = append(q.updates, update)
}

// Flush sends all queued updates and clears successful ones
func (q *OfflineQueue) Flush(ctx context.Context, client *PlatformClient) error {
	q.mutex.Lock()
	updates := make([]QueuedUpdate, len(q.updates))
	copy(updates, q.updates)
	q.mutex.Unlock()

	if len(updates) == 0 {
		return nil
	}

	var lastErr error
	var failed []QueuedUpdate

	for _, update := range updates {
		var err error
		switch update.Field {
		case "status":
			err = client.UpdateTaskStatus(ctx, update.TaskID, update.Value)
		default:
			err = fmt.Errorf("unknown field: %s", update.Field)
		}

		if err != nil {
			lastErr = err
			update.Retries++
			if update.Retries < 3 {
				failed = append(failed, update)
			}
		}
	}

	q.mutex.Lock()
	q.updates = failed
	q.mutex.Unlock()

	return lastErr
}

// GetQueuedCount returns the number of pending updates
func (q *OfflineQueue) GetQueuedCount() int {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	return len(q.updates)
}

// Clear removes all queued updates
func (q *OfflineQueue) Clear() {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	q.updates = make([]QueuedUpdate, 0)
}

// --- Connection Detection ---

// connectionCache holds cached connection status
var (
	connectionCache    ConnectionStatus
	connectionCacheTTL = 30 * time.Second
	connectionMutex    sync.RWMutex
)

// CheckConnection tests the connection to the platform
func (c *PlatformClient) CheckConnection(ctx context.Context) ConnectionStatus {
	connectionMutex.RLock()
	if time.Since(connectionCache.LastChecked) < connectionCacheTTL {
		status := connectionCache
		connectionMutex.RUnlock()
		return status
	}
	connectionMutex.RUnlock()

	// Perform actual check
	err := c.Ping(ctx)

	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	connectionCache.LastChecked = time.Now()
	connectionCache.BaseURL = c.baseURL
	if err != nil {
		connectionCache.Connected = false
		connectionCache.OfflineMode = true
		connectionCache.Error = err.Error()
	} else {
		connectionCache.Connected = true
		connectionCache.OfflineMode = false
		connectionCache.Error = ""
	}

	return connectionCache
}

// InvalidateConnectionCache forces the next check to actually ping
func InvalidateConnectionCache() {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()
	connectionCache.LastChecked = time.Time{}
}

// --- TaskCache Methods ---

// NewTaskCache creates a new task cache
func NewTaskCache() *TaskCache {
	return &TaskCache{
		Products: make(map[string][]Product),
		Specs:    make(map[string][]Spec),
		Tasks:    make(map[string][]Task),
	}
}

// SetProjects caches the project list
func (tc *TaskCache) SetProjects(projects []Project) {
	tc.mutex.Lock()
	defer tc.mutex.Unlock()
	tc.Projects = projects
	tc.LastUpdated = time.Now()
}

// GetProjects returns cached projects
func (tc *TaskCache) GetProjects() []Project {
	tc.mutex.RLock()
	defer tc.mutex.RUnlock()
	return tc.Projects
}

// SetProducts caches products for a project
func (tc *TaskCache) SetProducts(projectID string, products []Product) {
	tc.mutex.Lock()
	defer tc.mutex.Unlock()
	tc.Products[projectID] = products
	tc.LastUpdated = time.Now()
}

// GetProducts returns cached products for a project
func (tc *TaskCache) GetProducts(projectID string) ([]Product, bool) {
	tc.mutex.RLock()
	defer tc.mutex.RUnlock()
	products, ok := tc.Products[projectID]
	return products, ok
}

// SetSpecs caches specs for a product
func (tc *TaskCache) SetSpecs(productID string, specs []Spec) {
	tc.mutex.Lock()
	defer tc.mutex.Unlock()
	tc.Specs[productID] = specs
	tc.LastUpdated = time.Now()
}

// GetSpecs returns cached specs for a product
func (tc *TaskCache) GetSpecs(productID string) ([]Spec, bool) {
	tc.mutex.RLock()
	defer tc.mutex.RUnlock()
	specs, ok := tc.Specs[productID]
	return specs, ok
}

// SetTasks caches tasks for a spec
func (tc *TaskCache) SetTasks(specID string, tasks []Task) {
	tc.mutex.Lock()
	defer tc.mutex.Unlock()
	tc.Tasks[specID] = tasks
	tc.LastUpdated = time.Now()
}

// GetTasks returns cached tasks for a spec
func (tc *TaskCache) GetTasks(specID string) ([]Task, bool) {
	tc.mutex.RLock()
	defer tc.mutex.RUnlock()
	tasks, ok := tc.Tasks[specID]
	return tasks, ok
}

// Invalidate clears all cached data
func (tc *TaskCache) Invalidate() {
	tc.mutex.Lock()
	defer tc.mutex.Unlock()
	tc.Projects = nil
	tc.Products = make(map[string][]Product)
	tc.Specs = make(map[string][]Spec)
	tc.Tasks = make(map[string][]Task)
	tc.LastUpdated = time.Time{}
}

// IsStale returns true if cache is older than the given duration
func (tc *TaskCache) IsStale(maxAge time.Duration) bool {
	tc.mutex.RLock()
	defer tc.mutex.RUnlock()
	return time.Since(tc.LastUpdated) > maxAge
}
