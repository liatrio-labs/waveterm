// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/greggcoppen/claudewave/app/pkg/cwplatform"
	"github.com/greggcoppen/claudewave/app/pkg/cwworktree"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc/wshclient"
	"golang.org/x/term"
)

var platformStatusJSON bool

var platformCmd = &cobra.Command{
	Use:   "platform",
	Short: "Agentic Platform integration",
	Long:  "Commands for integrating with the Agentic Development Platform at agenticteam.dev",
}

var platformLoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with the Agentic Platform",
	Long: `Authenticate with the Agentic Platform by providing your API key.

You can get your API key from the platform at https://agenticteam.dev/settings/api-keys

The API key will be stored securely in the Wave secret store.`,
	Args:    cobra.NoArgs,
	RunE:    platformLoginRun,
	PreRunE: preRunSetupRpcClient,
}

var platformLogoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Remove stored API key",
	Long:  "Remove the stored platform API key from the Wave secret store.",
	Args:  cobra.NoArgs,
	RunE:  platformLogoutRun,
	PreRunE: preRunSetupRpcClient,
}

var platformStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show platform connection status",
	Long:  "Display the current platform connection status and authenticated user information.",
	Args:  cobra.NoArgs,
	RunE:  platformStatusRun,
	PreRunE: preRunSetupRpcClient,
}

var platformProjectsCmd = &cobra.Command{
	Use:   "projects",
	Short: "List available projects",
	Long:  "List all projects accessible to the authenticated user on the platform.",
	Args:  cobra.NoArgs,
	RunE:  platformProjectsRun,
	PreRunE: preRunSetupRpcClient,
}

var platformLinkCmd = &cobra.Command{
	Use:   "link <taskId>",
	Short: "Link current worktree to a platform task",
	Long: `Associate the current worktree with a platform task.

This creates a link between your local development environment and a task
on the Agentic Platform, enabling context injection and status synchronization.

The task association is stored in .parallel-workstation/task.json.`,
	Args:    cobra.ExactArgs(1),
	RunE:    platformLinkRun,
	PreRunE: preRunSetupRpcClient,
}

var platformUnlinkCmd = &cobra.Command{
	Use:   "unlink",
	Short: "Remove task association from current worktree",
	Long:  "Remove the link between the current worktree and its associated platform task.",
	Args:  cobra.NoArgs,
	RunE:  platformUnlinkRun,
	PreRunE: preRunSetupRpcClient,
}

var platformContextCmd = &cobra.Command{
	Use:   "context",
	Short: "Display context for linked task",
	Long: `Display the context that would be injected into a Claude Code session.

This shows the task description, specification content, and sub-tasks that would
be provided to Claude Code when starting a session on this worktree.`,
	Args:    cobra.NoArgs,
	RunE:    platformContextRun,
	PreRunE: preRunSetupRpcClient,
}

var platformUpdateStatusCmd = &cobra.Command{
	Use:   "update-status <status>",
	Short: "Update the status of the linked task",
	Long: `Update the status of the platform task linked to the current worktree.

Valid statuses: planned, pending, initializing, processing, completed, error, timed_out, stopped, awaiting_feedback

Example:
  wsh platform update-status processing
  wsh platform update-status completed`,
	Args:    cobra.ExactArgs(1),
	RunE:    platformUpdateStatusRun,
	PreRunE: preRunSetupRpcClient,
}

var platformProjectsJSON bool
var platformLinkForce bool
var platformContextJSON bool

func init() {
	rootCmd.AddCommand(platformCmd)
	platformCmd.AddCommand(platformLoginCmd)
	platformCmd.AddCommand(platformLogoutCmd)
	platformCmd.AddCommand(platformStatusCmd)
	platformCmd.AddCommand(platformProjectsCmd)
	platformCmd.AddCommand(platformLinkCmd)
	platformCmd.AddCommand(platformUnlinkCmd)
	platformCmd.AddCommand(platformContextCmd)
	platformCmd.AddCommand(platformUpdateStatusCmd)

	platformStatusCmd.Flags().BoolVar(&platformStatusJSON, "json", false, "Output in JSON format")
	platformProjectsCmd.Flags().BoolVar(&platformProjectsJSON, "json", false, "Output in JSON format")
	platformLinkCmd.Flags().BoolVar(&platformLinkForce, "force", false, "Force link even if task has active session")
	platformContextCmd.Flags().BoolVar(&platformContextJSON, "json", false, "Output raw context data in JSON format")
}

func platformLoginRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("platform:login", rtnErr == nil)
	}()

	// Check if already logged in
	existingKey, err := getStoredAPIKey()
	if err == nil && existingKey != "" {
		WriteStdout("You are already logged in. Use 'wsh platform logout' first to change accounts.\n")
		return nil
	}

	WriteStdout("Enter your Agentic Platform API key: ")

	// Read API key (hidden input if terminal)
	var apiKey string
	if term.IsTerminal(int(syscall.Stdin)) {
		keyBytes, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			return fmt.Errorf("reading API key: %w", err)
		}
		apiKey = string(keyBytes)
		WriteStdout("\n") // Add newline after hidden input
	} else {
		// Non-interactive mode
		reader := bufio.NewReader(os.Stdin)
		line, err := reader.ReadString('\n')
		if err != nil {
			return fmt.Errorf("reading API key: %w", err)
		}
		apiKey = strings.TrimSpace(line)
	}

	// Validate format
	if err := cwplatform.ValidateAPIKeyFormat(apiKey); err != nil {
		return fmt.Errorf("invalid API key format: %w", err)
	}

	// Store the API key
	if err := storeAPIKey(apiKey); err != nil {
		return fmt.Errorf("storing API key: %w", err)
	}

	// Validate by fetching user info
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client := cwplatform.NewClient(apiKey)
	user, err := client.GetCurrentUser(ctx)
	if err != nil {
		// Remove the stored key if validation fails
		deleteStoredAPIKey()
		return fmt.Errorf("validating API key: %w", err)
	}

	WriteStdout("Successfully authenticated as: %s (%s)\n", user.Name, user.Email)
	return nil
}

func platformLogoutRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("platform:logout", rtnErr == nil)
	}()

	// Check if logged in
	existingKey, err := getStoredAPIKey()
	if err != nil || existingKey == "" {
		WriteStdout("Not currently logged in.\n")
		return nil
	}

	// Delete the API key
	if err := deleteStoredAPIKey(); err != nil {
		return fmt.Errorf("removing API key: %w", err)
	}

	WriteStdout("Successfully logged out from Agentic Platform.\n")
	return nil
}

func platformStatusRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("platform:status", rtnErr == nil)
	}()

	status := &platformStatusOutput{
		Connected:   false,
		BaseURL:     cwplatform.DefaultBaseURL,
		LastChecked: time.Now().Format(time.RFC3339),
	}

	// Check if API key is stored
	apiKey, err := getStoredAPIKey()
	if err != nil || apiKey == "" {
		status.Error = "Not logged in. Run 'wsh platform login' to authenticate."
		return outputPlatformStatus(status)
	}

	status.APIKeyConfigured = true

	// Try to fetch user info
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client := cwplatform.NewClient(apiKey)
	user, err := client.GetCurrentUser(ctx)
	if err != nil {
		status.Error = fmt.Sprintf("Connection error: %v", err)
		status.OfflineMode = true
		return outputPlatformStatus(status)
	}

	status.Connected = true
	status.User = &platformUserOutput{
		ID:    user.ID,
		Name:  user.Name,
		Email: user.Email,
	}

	// Check for task association in current directory
	cwd, err := os.Getwd()
	if err == nil {
		if assoc, err := cwworktree.GetTaskAssociation(cwd); err == nil && assoc != nil {
			status.TaskAssociation = &platformTaskAssocOutput{
				TaskID:    assoc.TaskID,
				TaskTitle: assoc.TaskTitle,
				SpecID:    assoc.SpecID,
				SpecName:  assoc.SpecName,
				LinkedBy:  assoc.LinkedBy,
			}
		}
	}

	return outputPlatformStatus(status)
}

type platformStatusOutput struct {
	Connected        bool                      `json:"connected"`
	OfflineMode      bool                      `json:"offlineMode,omitempty"`
	BaseURL          string                    `json:"baseUrl"`
	APIKeyConfigured bool                      `json:"apiKeyConfigured"`
	User             *platformUserOutput       `json:"user,omitempty"`
	TaskAssociation  *platformTaskAssocOutput  `json:"taskAssociation,omitempty"`
	Error            string                    `json:"error,omitempty"`
	LastChecked      string                    `json:"lastChecked"`
}

type platformUserOutput struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type platformTaskAssocOutput struct {
	TaskID     string `json:"taskId"`
	TaskTitle  string `json:"taskTitle,omitempty"`
	TaskStatus string `json:"taskStatus,omitempty"`
	SpecID     string `json:"specId,omitempty"`
	SpecName   string `json:"specName,omitempty"`
	LinkedBy   string `json:"linkedBy,omitempty"`
}

func outputPlatformStatus(status *platformStatusOutput) error {
	if platformStatusJSON {
		jsonBytes, err := json.MarshalIndent(status, "", "  ")
		if err != nil {
			return fmt.Errorf("marshaling status: %w", err)
		}
		WriteStdout("%s\n", string(jsonBytes))
		return nil
	}

	// Human-readable output
	WriteStdout("Agentic Platform Status\n")
	WriteStdout("=======================\n")
	WriteStdout("Base URL: %s\n", status.BaseURL)

	if !status.APIKeyConfigured {
		WriteStdout("Status: Not configured\n")
		WriteStdout("\nRun 'wsh platform login' to authenticate.\n")
		return nil
	}

	if status.Connected {
		WriteStdout("Status: Connected\n")
		if status.User != nil {
			WriteStdout("User: %s (%s)\n", status.User.Name, status.User.Email)
		}
	} else if status.OfflineMode {
		WriteStdout("Status: Offline\n")
		WriteStdout("Error: %s\n", status.Error)
	} else {
		WriteStdout("Status: Disconnected\n")
		if status.Error != "" {
			WriteStdout("Error: %s\n", status.Error)
		}
	}

	// Show task association if present
	if status.TaskAssociation != nil {
		WriteStdout("\nTask Association\n")
		WriteStdout("----------------\n")
		WriteStdout("Task: %s\n", status.TaskAssociation.TaskTitle)
		if status.TaskAssociation.SpecName != "" {
			WriteStdout("Spec: %s\n", status.TaskAssociation.SpecName)
		}
		WriteStdout("Linked by: %s\n", status.TaskAssociation.LinkedBy)
	}

	return nil
}

// Helper functions to interact with secret store via RPC

func getStoredAPIKey() (string, error) {
	resp, err := wshclient.GetSecretsCommand(RpcClient, []string{cwplatform.PlatformAPIKeyName}, &wshrpc.RpcOpts{Timeout: 2000})
	if err != nil {
		return "", err
	}
	value, ok := resp[cwplatform.PlatformAPIKeyName]
	if !ok {
		return "", nil
	}
	return value, nil
}

func storeAPIKey(apiKey string) error {
	secrets := map[string]*string{cwplatform.PlatformAPIKeyName: &apiKey}
	return wshclient.SetSecretsCommand(RpcClient, secrets, &wshrpc.RpcOpts{Timeout: 2000})
}

func deleteStoredAPIKey() error {
	var nilValue *string = nil
	secrets := map[string]*string{cwplatform.PlatformAPIKeyName: nilValue}
	return wshclient.SetSecretsCommand(RpcClient, secrets, &wshrpc.RpcOpts{Timeout: 2000})
}

func platformProjectsRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("platform:projects", rtnErr == nil)
	}()

	// Check if logged in
	apiKey, err := getStoredAPIKey()
	if err != nil || apiKey == "" {
		return fmt.Errorf("not logged in. Run 'wsh platform login' to authenticate")
	}

	// Fetch projects
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client := cwplatform.NewClient(apiKey)
	projects, err := client.GetProjects(ctx)
	if err != nil {
		return fmt.Errorf("fetching projects: %w", err)
	}

	if platformProjectsJSON {
		jsonBytes, err := json.MarshalIndent(projects, "", "  ")
		if err != nil {
			return fmt.Errorf("marshaling projects: %w", err)
		}
		WriteStdout("%s\n", string(jsonBytes))
		return nil
	}

	// Human-readable output
	if len(projects) == 0 {
		WriteStdout("No projects found.\n")
		return nil
	}

	WriteStdout("Projects\n")
	WriteStdout("========\n")
	for _, p := range projects {
		WriteStdout("  %s  %s\n", p.ID, p.Name)
		if p.Description != "" {
			WriteStdout("         %s\n", p.Description)
		}
	}

	return nil
}

func platformLinkRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("platform:link", rtnErr == nil)
	}()

	taskID := args[0]

	// Check if logged in
	apiKey, err := getStoredAPIKey()
	if err != nil || apiKey == "" {
		return fmt.Errorf("not logged in. Run 'wsh platform login' to authenticate")
	}

	// Get current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("getting current directory: %w", err)
	}

	// Check if already linked to a different task
	existingAssoc, err := cwworktree.GetTaskAssociation(cwd)
	if err == nil && existingAssoc != nil && existingAssoc.TaskID != taskID {
		if !platformLinkForce {
			WriteStdout("This worktree is already linked to task '%s'.\n", existingAssoc.TaskID)
			WriteStdout("Use --force to override the existing association.\n")
			return nil
		}
	}

	// Fetch task details from platform
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client := cwplatform.NewClient(apiKey)
	task, spec, err := client.GetTaskWithSpec(ctx, taskID)
	if err != nil {
		return fmt.Errorf("fetching task details: %w", err)
	}

	// Create the association
	assoc := &cwworktree.TaskAssociation{
		TaskID:      task.ID,
		SpecID:      spec.ID,
		TaskTitle:   task.Title,
		SpecName:    spec.Name,
		SpecContent: spec.Content,
		LinkedBy:    "manual",
	}

	if err := cwworktree.SetTaskAssociation(cwd, assoc); err != nil {
		return fmt.Errorf("saving task association: %w", err)
	}

	// Also notify the platform via RPC (for tracking active sessions)
	linkData := wshrpc.CommandPlatformLinkData{
		TaskID:      taskID,
		WorktreeDir: cwd,
		Force:       platformLinkForce,
	}
	if err := wshclient.PlatformLinkCommand(RpcClient, linkData, &wshrpc.RpcOpts{Timeout: 5000}); err != nil {
		// Log but don't fail - local association is the primary record
		WriteStderr("Warning: could not notify platform: %v\n", err)
	}

	WriteStdout("Successfully linked to task: %s\n", task.Title)
	WriteStdout("Spec: %s\n", spec.Name)
	return nil
}

func platformUnlinkRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("platform:unlink", rtnErr == nil)
	}()

	// Get current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("getting current directory: %w", err)
	}

	// Check if there's an existing association
	existingAssoc, err := cwworktree.GetTaskAssociation(cwd)
	if err != nil || existingAssoc == nil {
		WriteStdout("No task association found for this worktree.\n")
		return nil
	}

	// Clear the local association
	if err := cwworktree.ClearTaskAssociation(cwd); err != nil {
		return fmt.Errorf("clearing task association: %w", err)
	}

	// Notify the platform via RPC
	unlinkData := wshrpc.CommandPlatformUnlinkData{
		WorktreeDir: cwd,
	}
	if err := wshclient.PlatformUnlinkCommand(RpcClient, unlinkData, &wshrpc.RpcOpts{Timeout: 5000}); err != nil {
		// Log but don't fail
		WriteStderr("Warning: could not notify platform: %v\n", err)
	}

	WriteStdout("Successfully unlinked from task: %s\n", existingAssoc.TaskTitle)
	return nil
}

func platformContextRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("platform:context", rtnErr == nil)
	}()

	// Get current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("getting current directory: %w", err)
	}

	// Check for task association
	assoc, err := cwworktree.GetTaskAssociation(cwd)
	if err != nil || assoc == nil {
		WriteStdout("No task linked to this worktree.\n")
		WriteStdout("Use 'wsh platform link <taskId>' to link a task.\n")
		return nil
	}

	// Check if logged in
	apiKey, err := getStoredAPIKey()
	if err != nil || apiKey == "" {
		return fmt.Errorf("not logged in. Run 'wsh platform login' to authenticate")
	}

	// Generate context
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client := cwplatform.NewClient(apiKey)
	contextData, err := client.GenerateContext(ctx, assoc.TaskID)
	if err != nil {
		return fmt.Errorf("generating context: %w", err)
	}

	if platformContextJSON {
		jsonBytes, err := json.MarshalIndent(contextData, "", "  ")
		if err != nil {
			return fmt.Errorf("marshaling context: %w", err)
		}
		WriteStdout("%s\n", string(jsonBytes))
		return nil
	}

	// Format and print the context prompt
	prompt := cwplatform.FormatContextPrompt(contextData)
	WriteStdout("%s", prompt)
	return nil
}

func platformUpdateStatusRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("platform:update-status", rtnErr == nil)
	}()

	newStatus := args[0]

	// Validate status
	if !cwplatform.IsValidTaskStatus(newStatus) {
		return fmt.Errorf("invalid status '%s'. Valid statuses: planned, pending, initializing, processing, completed, error, timed_out, stopped, awaiting_feedback", newStatus)
	}

	// Get current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("getting current directory: %w", err)
	}

	// Check for task association
	assoc, err := cwworktree.GetTaskAssociation(cwd)
	if err != nil || assoc == nil {
		return fmt.Errorf("no task linked to this worktree. Use 'wsh platform link <taskId>' first")
	}

	// Check if logged in
	apiKey, err := getStoredAPIKey()
	if err != nil || apiKey == "" {
		return fmt.Errorf("not logged in. Run 'wsh platform login' to authenticate")
	}

	// Update status via platform API
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client := cwplatform.NewClient(apiKey)
	if err := client.UpdateTaskStatus(ctx, assoc.TaskID, newStatus); err != nil {
		return fmt.Errorf("updating task status: %w", err)
	}

	WriteStdout("Task status updated to '%s'\n", newStatus)
	return nil
}
