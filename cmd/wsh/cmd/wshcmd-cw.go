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
	Short: "Liatrio Code commands",
	Long:  "Commands for Liatrio Code configuration and management",
}

var cwConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Liatrio Code configuration commands",
}

var cwConfigGetCmd = &cobra.Command{
	Use:     "get",
	Short:   "Get Liatrio Code configuration",
	Args:    cobra.NoArgs,
	RunE:    cwConfigGetRun,
	PreRunE: preRunSetupRpcClient,
}

var cwConfigSetCmd = &cobra.Command{
	Use:     "set <key> <value>",
	Short:   "Set a Liatrio Code configuration value",
	Args:    cobra.ExactArgs(2),
	RunE:    cwConfigSetRun,
	PreRunE: preRunSetupRpcClient,
}

var cwConfigGetProjectCmd = &cobra.Command{
	Use:     "get-project <path>",
	Short:   "Get project-specific Liatrio Code configuration",
	Args:    cobra.ExactArgs(1),
	RunE:    cwConfigGetProjectRun,
	PreRunE: preRunSetupRpcClient,
}

func init() {
	rootCmd.AddCommand(cwCmd)
	cwCmd.AddCommand(cwConfigCmd)
	cwConfigCmd.AddCommand(cwConfigGetCmd)
	cwConfigCmd.AddCommand(cwConfigSetCmd)
	cwConfigCmd.AddCommand(cwConfigGetProjectCmd)
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
