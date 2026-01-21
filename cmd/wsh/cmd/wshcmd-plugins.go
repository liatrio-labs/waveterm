// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc/wshclient"
)

var pluginCmd = &cobra.Command{
	Use:   "plugin",
	Short: "Plugin management for Claude Code",
	Long:  "Commands for managing Claude Code plugins in projects",
}

var pluginListCmd = &cobra.Command{
	Use:     "list [project-path]",
	Short:   "List plugins (available or installed for a project)",
	Args:    cobra.MaximumNArgs(1),
	RunE:    pluginListRun,
	PreRunE: preRunSetupRpcClient,
}

var pluginEnableCmd = &cobra.Command{
	Use:     "enable <project-path> <plugin-id>",
	Short:   "Enable a plugin for a project",
	Args:    cobra.ExactArgs(2),
	RunE:    pluginEnableRun,
	PreRunE: preRunSetupRpcClient,
}

var pluginDisableCmd = &cobra.Command{
	Use:     "disable <project-path> <plugin-id>",
	Short:   "Disable a plugin for a project",
	Args:    cobra.ExactArgs(2),
	RunE:    pluginDisableRun,
	PreRunE: preRunSetupRpcClient,
}

var pluginInfoCmd = &cobra.Command{
	Use:     "info <plugin-id>",
	Short:   "Show detailed information about a plugin",
	Args:    cobra.ExactArgs(1),
	RunE:    pluginInfoRun,
	PreRunE: preRunSetupRpcClient,
}

var pluginCategoriesCmd = &cobra.Command{
	Use:     "categories",
	Short:   "List plugin categories",
	Args:    cobra.NoArgs,
	RunE:    pluginCategoriesRun,
	PreRunE: preRunSetupRpcClient,
}

var pluginConfigureCmd = &cobra.Command{
	Use:     "configure <project-path> <plugin-id> <key=value>...",
	Short:   "Configure a plugin for a project",
	Args:    cobra.MinimumNArgs(3),
	RunE:    pluginConfigureRun,
	PreRunE: preRunSetupRpcClient,
}

var pluginListInstalled bool
var pluginListOfficial bool
var pluginListLiatrio bool
var pluginListCategory string

func init() {
	rootCmd.AddCommand(pluginCmd)
	pluginCmd.AddCommand(pluginListCmd)
	pluginCmd.AddCommand(pluginEnableCmd)
	pluginCmd.AddCommand(pluginDisableCmd)
	pluginCmd.AddCommand(pluginInfoCmd)
	pluginCmd.AddCommand(pluginCategoriesCmd)
	pluginCmd.AddCommand(pluginConfigureCmd)

	pluginListCmd.Flags().BoolVar(&pluginListInstalled, "installed", false, "List installed plugins for the project")
	pluginListCmd.Flags().BoolVar(&pluginListOfficial, "official", false, "List only official Anthropic plugins")
	pluginListCmd.Flags().BoolVar(&pluginListLiatrio, "liatrio", false, "List only Liatrio plugins")
	pluginListCmd.Flags().StringVar(&pluginListCategory, "category", "", "Filter by category")
}

func pluginListRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("plugin:list", rtnErr == nil)
	}()

	// If project path provided with --installed, list installed plugins
	if len(args) > 0 && pluginListInstalled {
		projectPath := args[0]
		commandData := wshrpc.CommandPluginListData{
			ProjectPath: projectPath,
		}

		installed, err := wshclient.PluginListInstalledCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 5000})
		if err != nil {
			return fmt.Errorf("listing installed plugins: %w", err)
		}

		jsonBytes, err := json.MarshalIndent(installed, "", "  ")
		if err != nil {
			return fmt.Errorf("marshaling result: %w", err)
		}
		WriteStdout("%s\n", string(jsonBytes))
		return nil
	}

	// Otherwise, list available plugins
	plugins, err := wshclient.PluginListAvailableCommand(RpcClient, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("listing available plugins: %w", err)
	}

	// Apply filters
	var filtered []wshrpc.PluginData
	for _, p := range plugins {
		if pluginListOfficial && !p.Official {
			continue
		}
		if pluginListLiatrio && !p.Liatrio {
			continue
		}
		if pluginListCategory != "" && p.Category != pluginListCategory {
			continue
		}
		filtered = append(filtered, p)
	}

	jsonBytes, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling result: %w", err)
	}
	WriteStdout("%s\n", string(jsonBytes))
	return nil
}

func pluginEnableRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("plugin:enable", rtnErr == nil)
	}()

	commandData := wshrpc.CommandPluginEnableData{
		ProjectPath: args[0],
		PluginID:    args[1],
	}

	installed, err := wshclient.PluginEnableCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("enabling plugin: %w", err)
	}

	WriteStdout("plugin %q enabled\n", installed.PluginID)
	return nil
}

func pluginDisableRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("plugin:disable", rtnErr == nil)
	}()

	commandData := wshrpc.CommandPluginDisableData{
		ProjectPath: args[0],
		PluginID:    args[1],
	}

	err := wshclient.PluginDisableCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("disabling plugin: %w", err)
	}

	WriteStdout("plugin %q disabled\n", args[1])
	return nil
}

func pluginInfoRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("plugin:info", rtnErr == nil)
	}()

	pluginID := args[0]

	plugins, err := wshclient.PluginListAvailableCommand(RpcClient, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("listing plugins: %w", err)
	}

	for _, p := range plugins {
		if p.ID == pluginID {
			jsonBytes, err := json.MarshalIndent(p, "", "  ")
			if err != nil {
				return fmt.Errorf("marshaling result: %w", err)
			}
			WriteStdout("%s\n", string(jsonBytes))
			return nil
		}
	}

	return fmt.Errorf("plugin %q not found", pluginID)
}

func pluginCategoriesRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("plugin:categories", rtnErr == nil)
	}()

	categories, err := wshclient.PluginGetCategoriesCommand(RpcClient, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("listing categories: %w", err)
	}

	jsonBytes, err := json.MarshalIndent(categories, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling result: %w", err)
	}
	WriteStdout("%s\n", string(jsonBytes))
	return nil
}

func pluginConfigureRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("plugin:configure", rtnErr == nil)
	}()

	projectPath := args[0]
	pluginID := args[1]
	configArgs := args[2:]

	// Parse key=value pairs
	config := make(map[string]interface{})
	for _, arg := range configArgs {
		parts := strings.SplitN(arg, "=", 2)
		if len(parts) != 2 {
			return fmt.Errorf("invalid config format %q, expected key=value", arg)
		}
		config[parts[0]] = parts[1]
	}

	commandData := wshrpc.CommandPluginConfigureData{
		ProjectPath: projectPath,
		PluginID:    pluginID,
		Config:      config,
	}

	err := wshclient.PluginConfigureCommand(RpcClient, commandData, &wshrpc.RpcOpts{Timeout: 5000})
	if err != nil {
		return fmt.Errorf("configuring plugin: %w", err)
	}

	WriteStdout("plugin %q configured\n", pluginID)
	return nil
}
