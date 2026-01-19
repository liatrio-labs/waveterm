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

var platformProjectsJSON bool

func init() {
	rootCmd.AddCommand(platformCmd)
	platformCmd.AddCommand(platformLoginCmd)
	platformCmd.AddCommand(platformLogoutCmd)
	platformCmd.AddCommand(platformStatusCmd)
	platformCmd.AddCommand(platformProjectsCmd)

	platformStatusCmd.Flags().BoolVar(&platformStatusJSON, "json", false, "Output in JSON format")
	platformProjectsCmd.Flags().BoolVar(&platformProjectsJSON, "json", false, "Output in JSON format")
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

	return outputPlatformStatus(status)
}

type platformStatusOutput struct {
	Connected        bool                `json:"connected"`
	OfflineMode      bool                `json:"offlineMode,omitempty"`
	BaseURL          string              `json:"baseUrl"`
	APIKeyConfigured bool                `json:"apiKeyConfigured"`
	User             *platformUserOutput `json:"user,omitempty"`
	Error            string              `json:"error,omitempty"`
	LastChecked      string              `json:"lastChecked"`
}

type platformUserOutput struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
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
