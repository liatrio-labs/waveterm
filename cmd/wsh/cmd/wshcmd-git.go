// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc/wshclient"
)

var gitCmd = &cobra.Command{
	Use:   "git",
	Short: "Git operations for Liatrio Wave",
	Long:  "Commands for viewing git status, staging/unstaging files, and creating PRs",
}

var gitStatusCmd = &cobra.Command{
	Use:     "status [path]",
	Short:   "Show git status for a directory",
	Args:    cobra.MaximumNArgs(1),
	RunE:    gitStatusRun,
	PreRunE: preRunSetupRpcClient,
}

var gitStageCmd = &cobra.Command{
	Use:     "stage <file>",
	Short:   "Stage a file for commit",
	Args:    cobra.ExactArgs(1),
	RunE:    gitStageRun,
	PreRunE: preRunSetupRpcClient,
}

var gitUnstageCmd = &cobra.Command{
	Use:     "unstage <file>",
	Short:   "Unstage a file",
	Args:    cobra.ExactArgs(1),
	RunE:    gitUnstageRun,
	PreRunE: preRunSetupRpcClient,
}

var gitStageAllCmd = &cobra.Command{
	Use:     "stage-all [path]",
	Short:   "Stage all changes",
	Args:    cobra.MaximumNArgs(1),
	RunE:    gitStageAllRun,
	PreRunE: preRunSetupRpcClient,
}

var gitUnstageAllCmd = &cobra.Command{
	Use:     "unstage-all [path]",
	Short:   "Unstage all changes",
	Args:    cobra.MaximumNArgs(1),
	RunE:    gitUnstageAllRun,
	PreRunE: preRunSetupRpcClient,
}

var gitPRCmd = &cobra.Command{
	Use:     "pr",
	Short:   "Create a GitHub pull request",
	RunE:    gitPRRun,
	PreRunE: preRunSetupRpcClient,
}

var gitAuthCmd = &cobra.Command{
	Use:   "auth",
	Short: "Manage GitHub authentication",
}

var gitAuthSetCmd = &cobra.Command{
	Use:     "set <token>",
	Short:   "Set GitHub personal access token",
	Args:    cobra.ExactArgs(1),
	RunE:    gitAuthSetRun,
	PreRunE: preRunSetupRpcClient,
}

var gitAuthStatusCmd = &cobra.Command{
	Use:     "status",
	Short:   "Check GitHub authentication status",
	RunE:    gitAuthStatusRun,
	PreRunE: preRunSetupRpcClient,
}

var gitPRTitle string
var gitPRBody string
var gitPRBase string
var gitOutputJSON bool

func init() {
	rootCmd.AddCommand(gitCmd)
	gitCmd.AddCommand(gitStatusCmd)
	gitCmd.AddCommand(gitStageCmd)
	gitCmd.AddCommand(gitUnstageCmd)
	gitCmd.AddCommand(gitStageAllCmd)
	gitCmd.AddCommand(gitUnstageAllCmd)
	gitCmd.AddCommand(gitPRCmd)
	gitCmd.AddCommand(gitAuthCmd)

	gitAuthCmd.AddCommand(gitAuthSetCmd)
	gitAuthCmd.AddCommand(gitAuthStatusCmd)

	// PR flags
	gitPRCmd.Flags().StringVar(&gitPRTitle, "title", "", "PR title (required)")
	gitPRCmd.Flags().StringVar(&gitPRBody, "body", "", "PR description")
	gitPRCmd.Flags().StringVar(&gitPRBase, "base", "main", "Base branch to merge into")
	gitPRCmd.MarkFlagRequired("title")

	// Common flags
	gitStatusCmd.Flags().BoolVar(&gitOutputJSON, "json", false, "Output as JSON")
}

func getCurrentDir() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current directory: %v", err)
	}
	return cwd, nil
}

func gitStatusRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("git:status", rtnErr == nil)
	}()

	var dirPath string
	if len(args) > 0 {
		dirPath = args[0]
	} else {
		var err error
		dirPath, err = getCurrentDir()
		if err != nil {
			return err
		}
	}

	data := wshrpc.CommandGitDirectoryStatusData{
		DirPath: dirPath,
	}

	result, err := wshclient.GitDirectoryStatusCommand(RpcClient, data, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("failed to get git status: %v", err)
	}

	if gitOutputJSON {
		output, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal JSON: %v", err)
		}
		fmt.Println(string(output))
		return nil
	}

	// Human-readable output
	fmt.Printf("On branch %s\n", result.Branch)
	if result.Ahead > 0 || result.Behind > 0 {
		fmt.Printf("Your branch is %d commits ahead, %d commits behind origin/%s\n", result.Ahead, result.Behind, result.Branch)
	}
	fmt.Println()

	if len(result.Files) == 0 {
		fmt.Println("Nothing to commit, working tree clean")
		return nil
	}

	// Group files by staged/unstaged
	var staged, unstaged []wshrpc.GitFileStatusData
	for _, f := range result.Files {
		if f.IsStaged {
			staged = append(staged, f)
		} else {
			unstaged = append(unstaged, f)
		}
	}

	if len(staged) > 0 {
		fmt.Println("Changes to be committed:")
		for _, f := range staged {
			relPath := strings.TrimPrefix(f.Path, result.RepoRoot+"/")
			fmt.Printf("  %s: %s\n", f.Status, relPath)
		}
		fmt.Println()
	}

	if len(unstaged) > 0 {
		fmt.Println("Changes not staged for commit:")
		for _, f := range unstaged {
			relPath := strings.TrimPrefix(f.Path, result.RepoRoot+"/")
			fmt.Printf("  %s: %s\n", f.Status, relPath)
		}
		fmt.Println()
	}

	return nil
}

func gitStageRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("git:stage", rtnErr == nil)
	}()

	filePath := args[0]

	// Get repo path from current directory
	repoPath, err := getCurrentDir()
	if err != nil {
		return err
	}

	// Make filePath absolute if relative
	if !strings.HasPrefix(filePath, "/") {
		filePath = repoPath + "/" + filePath
	}

	data := wshrpc.CommandGitStageFileData{
		RepoPath: repoPath,
		FilePath: filePath,
	}

	err = wshclient.GitStageFileCommand(RpcClient, data, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("failed to stage file: %v", err)
	}

	fmt.Printf("Staged: %s\n", filePath)
	return nil
}

func gitUnstageRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("git:unstage", rtnErr == nil)
	}()

	filePath := args[0]

	// Get repo path from current directory
	repoPath, err := getCurrentDir()
	if err != nil {
		return err
	}

	// Make filePath absolute if relative
	if !strings.HasPrefix(filePath, "/") {
		filePath = repoPath + "/" + filePath
	}

	data := wshrpc.CommandGitStageFileData{
		RepoPath: repoPath,
		FilePath: filePath,
	}

	err = wshclient.GitUnstageFileCommand(RpcClient, data, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("failed to unstage file: %v", err)
	}

	fmt.Printf("Unstaged: %s\n", filePath)
	return nil
}

func gitStageAllRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("git:stage-all", rtnErr == nil)
	}()

	var repoPath string
	if len(args) > 0 {
		repoPath = args[0]
	} else {
		var err error
		repoPath, err = getCurrentDir()
		if err != nil {
			return err
		}
	}

	data := wshrpc.CommandGitStageAllData{
		RepoPath: repoPath,
	}

	err := wshclient.GitStageAllCommand(RpcClient, data, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("failed to stage all: %v", err)
	}

	fmt.Println("All changes staged")
	return nil
}

func gitUnstageAllRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("git:unstage-all", rtnErr == nil)
	}()

	var repoPath string
	if len(args) > 0 {
		repoPath = args[0]
	} else {
		var err error
		repoPath, err = getCurrentDir()
		if err != nil {
			return err
		}
	}

	data := wshrpc.CommandGitStageAllData{
		RepoPath: repoPath,
	}

	err := wshclient.GitUnstageAllCommand(RpcClient, data, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("failed to unstage all: %v", err)
	}

	fmt.Println("All changes unstaged")
	return nil
}

func gitPRRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("git:pr", rtnErr == nil)
	}()

	repoPath, err := getCurrentDir()
	if err != nil {
		return err
	}

	data := wshrpc.CommandGitHubPRCreateData{
		RepoPath:   repoPath,
		Title:      gitPRTitle,
		Body:       gitPRBody,
		BaseBranch: gitPRBase,
	}

	result, err := wshclient.GitHubCreatePRCommand(RpcClient, data, &wshrpc.RpcOpts{Timeout: 30000})
	if err != nil {
		return fmt.Errorf("failed to create PR: %v", err)
	}

	fmt.Printf("Pull request #%d created successfully!\n", result.Number)
	fmt.Printf("URL: %s\n", result.HTMLURL)
	return nil
}

func gitAuthSetRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("git:auth:set", rtnErr == nil)
	}()

	token := args[0]

	data := wshrpc.CommandGitHubAuthData{
		Token: token,
	}

	err := wshclient.GitHubAuthCommand(RpcClient, data, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("failed to set GitHub token: %v", err)
	}

	fmt.Println("GitHub token saved successfully")
	return nil
}

func gitAuthStatusRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("git:auth:status", rtnErr == nil)
	}()

	result, err := wshclient.GitHubAuthStatusCommand(RpcClient, &wshrpc.RpcOpts{Timeout: 10000})
	if err != nil {
		return fmt.Errorf("failed to check auth status: %v", err)
	}

	if result.Configured {
		fmt.Println("GitHub authentication: configured")
	} else {
		fmt.Println("GitHub authentication: not configured")
		fmt.Println("Run 'wsh git auth set <token>' to configure")
	}
	return nil
}
