// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwmonitor

import (
	"fmt"

	"github.com/shirou/gopsutil/v4/process"
)

// ProcessMetrics contains resource usage metrics for a process
type ProcessMetrics struct {
	PID        int32   `json:"pid"`
	CPUPercent float64 `json:"cpupercent"`
	MemoryMB   float64 `json:"memorymb"`
	MemoryRSS  uint64  `json:"memoryrss"`
	Running    bool    `json:"running"`
	Name       string  `json:"name,omitempty"`
}

// GetProcessMetrics retrieves CPU and memory metrics for a given PID
func GetProcessMetrics(pid int32) (*ProcessMetrics, error) {
	if pid <= 0 {
		return &ProcessMetrics{PID: pid, Running: false}, nil
	}

	p, err := process.NewProcess(pid)
	if err != nil {
		// Process doesn't exist
		return &ProcessMetrics{PID: pid, Running: false}, nil
	}

	// Check if process is running
	running, err := p.IsRunning()
	if err != nil || !running {
		return &ProcessMetrics{PID: pid, Running: false}, nil
	}

	metrics := &ProcessMetrics{
		PID:     pid,
		Running: true,
	}

	// Get process name
	name, err := p.Name()
	if err == nil {
		metrics.Name = name
	}

	// Get CPU percent (this may return 0 on first call, needs time to measure)
	cpuPercent, err := p.CPUPercent()
	if err == nil {
		metrics.CPUPercent = cpuPercent
	}

	// Get memory info
	memInfo, err := p.MemoryInfo()
	if err == nil && memInfo != nil {
		metrics.MemoryRSS = memInfo.RSS
		metrics.MemoryMB = float64(memInfo.RSS) / (1024 * 1024)
	}

	return metrics, nil
}

// GetProcessMetricsBatch retrieves metrics for multiple PIDs
func GetProcessMetricsBatch(pids []int32) (map[int32]*ProcessMetrics, error) {
	result := make(map[int32]*ProcessMetrics)

	for _, pid := range pids {
		metrics, err := GetProcessMetrics(pid)
		if err != nil {
			// Log error but continue with other PIDs
			fmt.Printf("Error getting metrics for PID %d: %v\n", pid, err)
			result[pid] = &ProcessMetrics{PID: pid, Running: false}
		} else {
			result[pid] = metrics
		}
	}

	return result, nil
}

// FindClaudeCodeProcesses finds all running Claude Code processes
func FindClaudeCodeProcesses() ([]*ProcessMetrics, error) {
	var results []*ProcessMetrics

	processes, err := process.Processes()
	if err != nil {
		return nil, fmt.Errorf("failed to list processes: %w", err)
	}

	for _, p := range processes {
		name, err := p.Name()
		if err != nil {
			continue
		}

		// Look for "claude" process name
		if name == "claude" || name == "claude-code" {
			metrics, err := GetProcessMetrics(p.Pid)
			if err == nil && metrics.Running {
				results = append(results, metrics)
			}
		}
	}

	return results, nil
}
