// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc/wshclient"
)

var cwCmd = &cobra.Command{
	Use:   "cw",
	Short: "Liatrio Wave commands",
	Long:  "Commands for Liatrio Wave configuration and management",
}

var cwConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Liatrio Wave configuration commands",
}

var cwConfigGetCmd = &cobra.Command{
	Use:     "get",
	Short:   "Get Liatrio Wave configuration",
	Args:    cobra.NoArgs,
	RunE:    cwConfigGetRun,
	PreRunE: preRunSetupRpcClient,
}

var cwConfigSetCmd = &cobra.Command{
	Use:     "set <key> <value>",
	Short:   "Set a Liatrio Wave configuration value",
	Args:    cobra.ExactArgs(2),
	RunE:    cwConfigSetRun,
	PreRunE: preRunSetupRpcClient,
}

var cwConfigGetProjectCmd = &cobra.Command{
	Use:     "get-project <path>",
	Short:   "Get project-specific Liatrio Wave configuration",
	Args:    cobra.ExactArgs(1),
	RunE:    cwConfigGetProjectRun,
	PreRunE: preRunSetupRpcClient,
}

// Session commands
var cwSessionCmd = &cobra.Command{
	Use:   "session",
	Short: "Session management commands",
}

var cwSessionStatusHookType string

var cwSessionStatusCmd = &cobra.Command{
	Use:   "status <worktree-path> <status>",
	Short: "Update session status (called by Claude Code hooks)",
	Long: `Update session status to notify the UI when Claude Code state changes.

Status must be one of: idle, running, waiting, error

This command is typically called by Claude Code hooks to notify the app
when a session needs attention (e.g., task completed, waiting for input).

Examples:
  wsh cw session status /path/to/worktree idle --hook-type Stop
  wsh cw session status /path/to/worktree waiting --hook-type PermissionRequest`,
	Args:    cobra.ExactArgs(2),
	RunE:    cwSessionStatusRun,
	PreRunE: preRunSetupRpcClient,
}

func init() {
	rootCmd.AddCommand(cwCmd)
	cwCmd.AddCommand(cwConfigCmd)
	cwConfigCmd.AddCommand(cwConfigGetCmd)
	cwConfigCmd.AddCommand(cwConfigSetCmd)
	cwConfigCmd.AddCommand(cwConfigGetProjectCmd)

	// Session commands
	cwCmd.AddCommand(cwSessionCmd)
	cwSessionStatusCmd.Flags().StringVar(&cwSessionStatusHookType, "hook-type", "", "The hook type that triggered this status update")
	cwSessionCmd.AddCommand(cwSessionStatusCmd)
}

func cwConfigGetRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("cw:config:get", rtnErr == nil)
	}()

	config, err := wshclient.CWConfigGetCommand(RpcClient, &wshrpc.RpcOpts{Timeout: 2000})
	if err != nil {
		return fmt.Errorf("getting CW config: %w", err)
	}

	jsonBytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling config: %w", err)
	}
	WriteStdout("%s\n", string(jsonBytes))
	return nil
}

func cwConfigSetRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("cw:config:set", rtnErr == nil)
	}()

	key := args[0]
	value := args[1]

	// Try to parse value as JSON, fall back to string
	var parsedValue interface{}
	if err := json.Unmarshal([]byte(value), &parsedValue); err != nil {
		parsedValue = value
	}

	commandData := wshrpc.CommandCWConfigSetData{
		Key:   key,
		Value: parsedValue,
	}
	err := wshclient.CWConfigSetCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 2000})
	if err != nil {
		return fmt.Errorf("setting CW config: %w", err)
	}
	WriteStdout("config set\n")
	return nil
}

func cwConfigGetProjectRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("cw:config:get-project", rtnErr == nil)
	}()

	projectPath := args[0]
	commandData := wshrpc.CommandCWConfigGetProjectData{
		ProjectPath: projectPath,
	}
	config, err := wshclient.CWConfigGetProjectCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 2000})
	if err != nil {
		return fmt.Errorf("getting project CW config: %w", err)
	}

	jsonBytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling config: %w", err)
	}
	WriteStdout("%s\n", string(jsonBytes))
	return nil
}

func cwSessionStatusRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("cw:session:status", rtnErr == nil)
	}()

	worktreePath := args[0]
	status := args[1]

	// Validate status
	validStatuses := map[string]bool{"idle": true, "running": true, "waiting": true, "error": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s (must be idle, running, waiting, or error)", status)
	}

	commandData := wshrpc.CommandCWSessionStatusData{
		WorktreePath: worktreePath,
		Status:       status,
		HookType:     cwSessionStatusHookType,
	}
	err := wshclient.CWSessionStatusCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 2000})
	if err != nil {
		return fmt.Errorf("updating session status: %w", err)
	}
	return nil
}
