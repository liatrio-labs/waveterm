// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cwplatform

import (
	"testing"
	"time"
)

func TestOfflineQueue_Enqueue(t *testing.T) {
	q := NewOfflineQueue()

	// Enqueue first update
	q.Enqueue(QueuedUpdate{
		TaskID: "task1",
		Field:  "status",
		Value:  "processing",
	})

	if q.GetQueuedCount() != 1 {
		t.Errorf("expected 1 queued update, got %d", q.GetQueuedCount())
	}

	// Enqueue different task
	q.Enqueue(QueuedUpdate{
		TaskID: "task2",
		Field:  "status",
		Value:  "pending",
	})

	if q.GetQueuedCount() != 2 {
		t.Errorf("expected 2 queued updates, got %d", q.GetQueuedCount())
	}
}

func TestOfflineQueue_Enqueue_Deduplication(t *testing.T) {
	q := NewOfflineQueue()

	// Enqueue first update
	q.Enqueue(QueuedUpdate{
		TaskID: "task1",
		Field:  "status",
		Value:  "processing",
	})

	// Enqueue same task/field with different value
	q.Enqueue(QueuedUpdate{
		TaskID: "task1",
		Field:  "status",
		Value:  "completed",
	})

	// Should still be 1 (deduplicated)
	if q.GetQueuedCount() != 1 {
		t.Errorf("expected 1 queued update (deduplicated), got %d", q.GetQueuedCount())
	}

	// The value should be updated to the newer one
	q.mutex.Lock()
	if q.updates[0].Value != "completed" {
		t.Errorf("expected value 'completed', got '%s'", q.updates[0].Value)
	}
	q.mutex.Unlock()
}

func TestOfflineQueue_Clear(t *testing.T) {
	q := NewOfflineQueue()

	q.Enqueue(QueuedUpdate{TaskID: "task1", Field: "status", Value: "processing"})
	q.Enqueue(QueuedUpdate{TaskID: "task2", Field: "status", Value: "pending"})

	if q.GetQueuedCount() != 2 {
		t.Fatalf("expected 2 queued updates before clear, got %d", q.GetQueuedCount())
	}

	q.Clear()

	if q.GetQueuedCount() != 0 {
		t.Errorf("expected 0 queued updates after clear, got %d", q.GetQueuedCount())
	}
}

func TestTaskCache_Projects(t *testing.T) {
	cache := NewTaskCache()

	projects := []Project{
		{ID: "p1", Name: "Project 1"},
		{ID: "p2", Name: "Project 2"},
	}

	cache.SetProjects(projects)
	cached := cache.GetProjects()

	if len(cached) != 2 {
		t.Errorf("expected 2 cached projects, got %d", len(cached))
	}

	if cached[0].ID != "p1" {
		t.Errorf("expected first project ID 'p1', got '%s'", cached[0].ID)
	}
}

func TestTaskCache_Products(t *testing.T) {
	cache := NewTaskCache()

	products := []Product{
		{ID: "prod1", ProjectID: "p1", Name: "Product 1"},
	}

	cache.SetProducts("p1", products)

	// Should find cached products
	cached, ok := cache.GetProducts("p1")
	if !ok {
		t.Error("expected to find cached products for project p1")
	}
	if len(cached) != 1 {
		t.Errorf("expected 1 cached product, got %d", len(cached))
	}

	// Should not find for different project
	_, ok = cache.GetProducts("p2")
	if ok {
		t.Error("did not expect to find cached products for project p2")
	}
}

func TestTaskCache_Invalidate(t *testing.T) {
	cache := NewTaskCache()

	cache.SetProjects([]Project{{ID: "p1", Name: "Project 1"}})
	cache.SetProducts("p1", []Product{{ID: "prod1", ProjectID: "p1", Name: "Product 1"}})

	cache.Invalidate()

	if len(cache.GetProjects()) != 0 {
		t.Error("expected projects to be cleared after invalidate")
	}

	_, ok := cache.GetProducts("p1")
	if ok {
		t.Error("expected products to be cleared after invalidate")
	}
}

func TestTaskCache_IsStale(t *testing.T) {
	cache := NewTaskCache()

	// Empty cache should be stale
	if !cache.IsStale(time.Minute) {
		t.Error("empty cache should be considered stale")
	}

	// Cache with recent update should not be stale
	cache.SetProjects([]Project{{ID: "p1", Name: "Project 1"}})

	if cache.IsStale(time.Minute) {
		t.Error("recently updated cache should not be stale with 1 minute max age")
	}

	// Cache should be stale with very short max age
	if !cache.IsStale(time.Nanosecond) {
		t.Error("cache should be stale with nanosecond max age")
	}
}

func TestDefaultPlatformConfig(t *testing.T) {
	config := DefaultPlatformConfig()

	if config.Enabled {
		t.Error("expected default config to be disabled")
	}

	if config.BaseURL != DefaultBaseURL {
		t.Errorf("expected default base URL '%s', got '%s'", DefaultBaseURL, config.BaseURL)
	}

	if config.DisplayMode != "sidebar" {
		t.Errorf("expected default display mode 'sidebar', got '%s'", config.DisplayMode)
	}

	if config.PollInterval != 30000 {
		t.Errorf("expected default poll interval 30000, got %d", config.PollInterval)
	}

	if !config.AutoInjectContext {
		t.Error("expected default auto inject context to be true")
	}
}

func TestConnectionStatus(t *testing.T) {
	// Reset cache before test
	InvalidateConnectionCache()

	connectionMutex.Lock()
	connectionCache.Connected = true
	connectionCache.LastChecked = time.Now()
	connectionMutex.Unlock()

	connectionMutex.RLock()
	status := connectionCache
	connectionMutex.RUnlock()

	if !status.Connected {
		t.Error("expected connected status to be true")
	}
}
