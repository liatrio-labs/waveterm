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

var worktreeCmd = &cobra.Command{
	Use:   "worktree",
	Short: "Git worktree management for Liatrio Wave sessions",
	Long:  "Commands for managing git worktrees that back Liatrio Wave sessions",
}

var worktreeCreateCmd = &cobra.Command{
	Use:     "create <project-path> <session-name> [branch-name]",
	Short:   "Create a new worktree for a session",
	Args:    cobra.RangeArgs(2, 3),
	RunE:    worktreeCreateRun,
	PreRunE: preRunSetupRpcClient,
}

var worktreeDeleteCmd = &cobra.Command{
	Use:     "delete <project-path> <session-name>",
	Short:   "Delete a worktree",
	Args:    cobra.ExactArgs(2),
	RunE:    worktreeDeleteRun,
	PreRunE: preRunSetupRpcClient,
}

var worktreeListCmd = &cobra.Command{
	Use:     "list <project-path>",
	Short:   "List all worktrees for a project",
	Args:    cobra.ExactArgs(1),
	RunE:    worktreeListRun,
	PreRunE: preRunSetupRpcClient,
}

var worktreeSyncCmd = &cobra.Command{
	Use:     "sync <project-path> <session-name>",
	Short:   "Sync a worktree with the main branch",
	Args:    cobra.ExactArgs(2),
	RunE:    worktreeSyncRun,
	PreRunE: preRunSetupRpcClient,
}

var worktreeMergeCmd = &cobra.Command{
	Use:     "merge <project-path> <session-name>",
	Short:   "Merge a worktree branch into main",
	Args:    cobra.ExactArgs(2),
	RunE:    worktreeMergeRun,
	PreRunE: preRunSetupRpcClient,
}

var worktreeRenameCmd = &cobra.Command{
	Use:     "rename <project-path> <session-name> <new-branch-name>",
	Short:   "Rename the branch of a worktree",
	Args:    cobra.ExactArgs(3),
	RunE:    worktreeRenameRun,
	PreRunE: preRunSetupRpcClient,
}

var worktreeStatusCmd = &cobra.Command{
	Use:     "status <project-path> <session-name>",
	Short:   "Get detailed status of a worktree",
	Args:    cobra.ExactArgs(2),
	RunE:    worktreeStatusRun,
	PreRunE: preRunSetupRpcClient,
}

var worktreeForce bool
var worktreeSquash bool

func init() {
	rootCmd.AddCommand(worktreeCmd)
	worktreeCmd.AddCommand(worktreeCreateCmd)
	worktreeCmd.AddCommand(worktreeDeleteCmd)
	worktreeCmd.AddCommand(worktreeListCmd)
	worktreeCmd.AddCommand(worktreeSyncCmd)
	worktreeCmd.AddCommand(worktreeMergeCmd)
	worktreeCmd.AddCommand(worktreeRenameCmd)
	worktreeCmd.AddCommand(worktreeStatusCmd)

	worktreeDeleteCmd.Flags().BoolVar(&worktreeForce, "force", false, "Force delete even with uncommitted changes")
	worktreeMergeCmd.Flags().BoolVar(&worktreeSquash, "squash", false, "Squash commits when merging")
}

func worktreeCreateRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("worktree:create", rtnErr == nil)
	}()

	projectPath := args[0]
	sessionName := args[1]
	branchName := ""
	if len(args) > 2 {
		branchName = args[2]
	}

	commandData := wshrpc.CommandWorktreeCreateData{
		ProjectPath: projectPath,
		SessionName: sessionName,
		BranchName:  branchName,
	}

	info, err := wshclient.WorktreeCreateCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("creating worktree: %w", err)
	}

	jsonBytes, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling result: %w", err)
	}
	WriteStdout("%s\n", string(jsonBytes))
	return nil
}

func worktreeDeleteRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("worktree:delete", rtnErr == nil)
	}()

	commandData := wshrpc.CommandWorktreeDeleteData{
		ProjectPath: args[0],
		SessionName: args[1],
		Force:       worktreeForce,
	}

	err := wshclient.WorktreeDeleteCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("deleting worktree: %w", err)
	}
	WriteStdout("worktree deleted\n")
	return nil
}

func worktreeListRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("worktree:list", rtnErr == nil)
	}()

	commandData := wshrpc.CommandWorktreeListData{
		ProjectPath: args[0],
	}

	worktrees, err := wshclient.WorktreeListCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("listing worktrees: %w", err)
	}

	jsonBytes, err := json.MarshalIndent(worktrees, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling result: %w", err)
	}
	WriteStdout("%s\n", string(jsonBytes))
	return nil
}

func worktreeSyncRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("worktree:sync", rtnErr == nil)
	}()

	commandData := wshrpc.CommandWorktreeSyncData{
		ProjectPath: args[0],
		SessionName: args[1],
	}

	err := wshclient.WorktreeSyncCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 60000})
	if err != nil {
		return fmt.Errorf("syncing worktree: %w", err)
	}
	WriteStdout("worktree synced\n")
	return nil
}

func worktreeMergeRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("worktree:merge", rtnErr == nil)
	}()

	commandData := wshrpc.CommandWorktreeMergeData{
		ProjectPath: args[0],
		SessionName: args[1],
		Squash:      worktreeSquash,
	}

	err := wshclient.WorktreeMergeCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 30000})
	if err != nil {
		return fmt.Errorf("merging worktree: %w", err)
	}
	WriteStdout("worktree merged\n")
	return nil
}

func worktreeRenameRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("worktree:rename", rtnErr == nil)
	}()

	commandData := wshrpc.CommandWorktreeRenameData{
		ProjectPath:   args[0],
		SessionName:   args[1],
		NewBranchName: args[2],
	}

	err := wshclient.WorktreeRenameCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("renaming worktree: %w", err)
	}
	WriteStdout("worktree renamed\n")
	return nil
}

func worktreeStatusRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("worktree:status", rtnErr == nil)
	}()

	commandData := wshrpc.CommandWorktreeStatusData{
		ProjectPath: args[0],
		SessionName: args[1],
	}

	status, err := wshclient.WorktreeStatusCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("getting worktree status: %w", err)
	}

	jsonBytes, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling result: %w", err)
	}
	WriteStdout("%s\n", string(jsonBytes))
	return nil
}
