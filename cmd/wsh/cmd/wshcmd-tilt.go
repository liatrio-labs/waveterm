// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"github.com/spf13/cobra"

	"github.com/greggcoppen/claudewave/app/pkg/wshrpc/wshclient"
)

var tiltCmd = &cobra.Command{
	Use:   "tilt",
	Short: "MCP Hub (Tilt) management commands",
	Long:  "Commands for managing the MCP Hub powered by Tilt",
}

var tiltStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the MCP Hub",
	Long:  "Starts the MCP Hub (Tilt) which manages MCP servers",
	RunE:  tiltStartRun,
}

var tiltStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop the MCP Hub",
	Long:  "Stops the MCP Hub (Tilt) and all managed MCP servers",
	RunE:  tiltStopRun,
}

var tiltStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Get MCP Hub status",
	Long:  "Shows the current status of the MCP Hub",
	RunE:  tiltStatusRun,
}

func init() {
	rootCmd.AddCommand(tiltCmd)
	tiltCmd.AddCommand(tiltStartCmd)
	tiltCmd.AddCommand(tiltStopCmd)
	tiltCmd.AddCommand(tiltStatusCmd)
}

func tiltStartRun(cmd *cobra.Command, args []string) error {
	err := wshclient.TiltStartCommand(RpcClient, nil)
	if err != nil {
		return err
	}
	WriteStdout("MCP Hub started successfully\n")
	return nil
}

func tiltStopRun(cmd *cobra.Command, args []string) error {
	err := wshclient.TiltStopCommand(RpcClient, nil)
	if err != nil {
		return err
	}
	WriteStdout("MCP Hub stopped successfully\n")
	return nil
}

func tiltStatusRun(cmd *cobra.Command, args []string) error {
	status, err := wshclient.TiltStatusCommand(RpcClient, nil)
	if err != nil {
		return err
	}
	WriteStdout("MCP Hub Status: %s\n", status.Status)
	if len(status.MCPServers) > 0 {
		WriteStdout("Servers:\n")
		for _, server := range status.MCPServers {
			WriteStdout("  - %s: %s\n", server.Name, server.Status)
		}
	}
	return nil
}
