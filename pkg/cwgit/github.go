// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package cwgit

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/greggcoppen/claudewave/app/pkg/secretstore"
)

const (
	// maxResponseBodySize limits the size of HTTP response bodies to prevent DoS
	maxResponseBodySize = 10 * 1024 * 1024 // 10MB
)

// Pre-compiled regexes for URL parsing (avoid recompilation on each call)
var (
	httpsRegex  = regexp.MustCompile(`^https?://([^/]+)/([^/]+)/([^/]+?)(?:\.git)?$`)
	sshRegex    = regexp.MustCompile(`^git@([^:]+):([^/]+)/([^/]+?)(?:\.git)?$`)
	sshURLRegex = regexp.MustCompile(`^ssh://git@([^/]+)/([^/]+)/([^/]+?)(?:\.git)?$`)
)

const (
	// GitHubTokenSecretName is the name used to store the GitHub token in secretstore
	GitHubTokenSecretName = "github_token"

	// GitHubAPIBaseURL is the base URL for GitHub API
	GitHubAPIBaseURL = "https://api.github.com"
)

// GetGitHubToken retrieves the GitHub token from secretstore
func GetGitHubToken() (string, error) {
	token, exists, err := secretstore.GetSecret(GitHubTokenSecretName)
	if err != nil {
		return "", fmt.Errorf("failed to get GitHub token: %w", err)
	}
	if !exists || token == "" {
		return "", ErrGitHubToken
	}
	return token, nil
}

// SetGitHubToken stores the GitHub token in secretstore
func SetGitHubToken(token string) error {
	if token == "" {
		return secretstore.DeleteSecret(GitHubTokenSecretName)
	}
	return secretstore.SetSecret(GitHubTokenSecretName, token)
}

// HasGitHubToken returns true if a GitHub token is configured
func HasGitHubToken() bool {
	token, _ := GetGitHubToken()
	return token != ""
}

// GetRepoInfo parses the remote URL to extract owner and repo information
func GetRepoInfo(repoPath string) (*GitRemoteInfo, error) {
	if err := validatePath(repoPath); err != nil {
		return nil, err
	}

	repoRoot, err := findGitRoot(repoPath)
	if err != nil {
		return nil, err
	}

	// Get the remote origin URL
	remoteURL, err := executeGitCommand(repoRoot, "config", "--get", "remote.origin.url")
	if err != nil || remoteURL == "" {
		return nil, ErrNoRemote
	}

	return parseRemoteURL(remoteURL)
}

// parseRemoteURL parses a git remote URL to extract host, owner, and repo name
// Supports formats:
// - https://github.com/owner/repo.git
// - https://github.com/owner/repo
// - git@github.com:owner/repo.git
// - ssh://git@github.com/owner/repo.git
func parseRemoteURL(url string) (*GitRemoteInfo, error) {
	info := &GitRemoteInfo{
		RemoteURL: url,
	}

	// Try HTTPS format: https://github.com/owner/repo.git
	if matches := httpsRegex.FindStringSubmatch(url); len(matches) == 4 {
		info.Host = matches[1]
		info.Owner = matches[2]
		info.RepoName = strings.TrimSuffix(matches[3], ".git")
		return info, nil
	}

	// Try SSH format: git@github.com:owner/repo.git
	if matches := sshRegex.FindStringSubmatch(url); len(matches) == 4 {
		info.Host = matches[1]
		info.Owner = matches[2]
		info.RepoName = strings.TrimSuffix(matches[3], ".git")
		return info, nil
	}

	// Try SSH URL format: ssh://git@github.com/owner/repo.git
	if matches := sshURLRegex.FindStringSubmatch(url); len(matches) == 4 {
		info.Host = matches[1]
		info.Owner = matches[2]
		info.RepoName = strings.TrimSuffix(matches[3], ".git")
		return info, nil
	}

	return nil, ErrInvalidRemote
}

// CreatePullRequest creates a pull request on GitHub
func CreatePullRequest(repoPath string, req GitHubPRRequest) (*GitHubPRResponse, error) {
	// Get GitHub token
	token, err := GetGitHubToken()
	if err != nil {
		return nil, err
	}

	// If owner/repo not provided, try to get from repo
	if req.RepoOwner == "" || req.RepoName == "" {
		repoInfo, err := GetRepoInfo(repoPath)
		if err != nil {
			return nil, fmt.Errorf("could not determine repo owner/name: %w", err)
		}
		if req.RepoOwner == "" {
			req.RepoOwner = repoInfo.Owner
		}
		if req.RepoName == "" {
			req.RepoName = repoInfo.RepoName
		}
	}

	// If head branch not provided, get current branch
	if req.HeadBranch == "" {
		branch, err := GetCurrentBranch(repoPath)
		if err != nil {
			return nil, fmt.Errorf("could not determine current branch: %w", err)
		}
		req.HeadBranch = branch
	}

	// If base branch not provided, try to determine default branch
	if req.BaseBranch == "" {
		req.BaseBranch = "main" // Default to main
	}

	// Create the PR using GitHub API
	apiURL := fmt.Sprintf("%s/repos/%s/%s/pulls", GitHubAPIBaseURL, req.RepoOwner, req.RepoName)

	payload := map[string]string{
		"title": req.Title,
		"body":  req.Body,
		"head":  req.HeadBranch,
		"base":  req.BaseBranch,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create request with timeout context
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/vnd.github.v3+json")
	httpReq.Header.Set("User-Agent", "Liatrio-Code/1.0")

	client := &http.Client{}

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := readResponseBody(resp)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated {
		var errResp map[string]interface{}
		json.Unmarshal(body, &errResp)
		if msg, ok := errResp["message"].(string); ok {
			return nil, fmt.Errorf("GitHub API error: %s", msg)
		}
		return nil, fmt.Errorf("GitHub API error: status %d", resp.StatusCode)
	}

	var prResp struct {
		Number  int    `json:"number"`
		URL     string `json:"url"`
		HTMLURL string `json:"html_url"`
	}

	if err := json.Unmarshal(body, &prResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &GitHubPRResponse{
		Number:  prResp.Number,
		URL:     prResp.URL,
		HTMLURL: prResp.HTMLURL,
	}, nil
}

// PushCurrentBranch pushes the current branch to origin
func PushCurrentBranch(repoPath string, setUpstream bool) error {
	if err := validatePath(repoPath); err != nil {
		return err
	}

	repoRoot, err := findGitRoot(repoPath)
	if err != nil {
		return err
	}

	branch, err := GetCurrentBranch(repoPath)
	if err != nil {
		return err
	}

	args := []string{"push", "origin", branch}
	if setUpstream {
		args = []string{"push", "-u", "origin", branch}
	}

	_, err = executeGitCommand(repoRoot, args...)
	return err
}

// readResponseBody reads an HTTP response body with a size limit
func readResponseBody(resp *http.Response) ([]byte, error) {
	return io.ReadAll(io.LimitReader(resp.Body, maxResponseBodySize))
}

// GetPullRequest retrieves the status of a pull request from GitHub
func GetPullRequest(repoOwner, repoName string, prNumber int) (*GitHubPRStatusResponse, error) {
	token, err := GetGitHubToken()
	if err != nil {
		return nil, err
	}

	// Validate inputs
	if repoOwner == "" || repoName == "" {
		return nil, fmt.Errorf("repoOwner and repoName are required")
	}
	if prNumber <= 0 {
		return nil, fmt.Errorf("invalid PR number: %d", prNumber)
	}

	apiURL := fmt.Sprintf("%s/repos/%s/%s/pulls/%d",
		GitHubAPIBaseURL,
		url.PathEscape(repoOwner),
		url.PathEscape(repoName),
		prNumber)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Accept", "application/vnd.github.v3+json")
	httpReq.Header.Set("User-Agent", "Liatrio-Code/1.0")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := readResponseBody(resp)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		json.Unmarshal(body, &errResp)
		if msg, ok := errResp["message"].(string); ok {
			return nil, fmt.Errorf("GitHub API error: %s", msg)
		}
		return nil, fmt.Errorf("GitHub API error: status %d", resp.StatusCode)
	}

	var prResp struct {
		Number    int    `json:"number"`
		State     string `json:"state"`
		Merged    bool   `json:"merged"`
		Mergeable *bool  `json:"mergeable"`
		HTMLURL   string `json:"html_url"`
		Title     string `json:"title"`
		Head      struct {
			Ref string `json:"ref"`
		} `json:"head"`
		Base struct {
			Ref string `json:"ref"`
		} `json:"base"`
	}

	if err := json.Unmarshal(body, &prResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &GitHubPRStatusResponse{
		Number:    prResp.Number,
		State:     prResp.State,
		Merged:    prResp.Merged,
		Mergeable: prResp.Mergeable,
		HTMLURL:   prResp.HTMLURL,
		Title:     prResp.Title,
		HeadRef:   prResp.Head.Ref,
		BaseRef:   prResp.Base.Ref,
	}, nil
}

// MergePullRequest merges a pull request on GitHub
func MergePullRequest(repoOwner, repoName string, prNumber int, mergeMethod string) error {
	token, err := GetGitHubToken()
	if err != nil {
		return err
	}

	// Validate inputs
	if repoOwner == "" || repoName == "" {
		return fmt.Errorf("repoOwner and repoName are required")
	}
	if prNumber <= 0 {
		return fmt.Errorf("invalid PR number: %d", prNumber)
	}

	// Default to squash merge if not specified, and validate
	if mergeMethod == "" {
		mergeMethod = "squash"
	}
	switch mergeMethod {
	case "merge", "squash", "rebase":
		// Valid
	default:
		return fmt.Errorf("invalid merge method: %s (must be merge, squash, or rebase)", mergeMethod)
	}

	apiURL := fmt.Sprintf("%s/repos/%s/%s/pulls/%d/merge",
		GitHubAPIBaseURL,
		url.PathEscape(repoOwner),
		url.PathEscape(repoName),
		prNumber)

	payload := map[string]string{
		"merge_method": mergeMethod,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "PUT", apiURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/vnd.github.v3+json")
	httpReq.Header.Set("User-Agent", "Liatrio-Code/1.0")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := readResponseBody(resp)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		json.Unmarshal(body, &errResp)
		if msg, ok := errResp["message"].(string); ok {
			return fmt.Errorf("GitHub API error: %s", msg)
		}
		return fmt.Errorf("GitHub API error: status %d", resp.StatusCode)
	}

	return nil
}

// GetPullRequestByBranch finds a PR by head branch name
func GetPullRequestByBranch(repoOwner, repoName, headBranch string) (*GitHubPRStatusResponse, error) {
	token, err := GetGitHubToken()
	if err != nil {
		return nil, err
	}

	// Validate inputs
	if repoOwner == "" || repoName == "" || headBranch == "" {
		return nil, fmt.Errorf("repoOwner, repoName, and headBranch are required")
	}

	// Search for PRs with this head branch (URL encode parameters)
	apiURL := fmt.Sprintf("%s/repos/%s/%s/pulls?head=%s&state=all",
		GitHubAPIBaseURL,
		url.PathEscape(repoOwner),
		url.PathEscape(repoName),
		url.QueryEscape(repoOwner+":"+headBranch))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Accept", "application/vnd.github.v3+json")
	httpReq.Header.Set("User-Agent", "Liatrio-Code/1.0")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := readResponseBody(resp)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		json.Unmarshal(body, &errResp)
		if msg, ok := errResp["message"].(string); ok {
			return nil, fmt.Errorf("GitHub API error: %s", msg)
		}
		return nil, fmt.Errorf("GitHub API error: status %d", resp.StatusCode)
	}

	var prList []struct {
		Number    int    `json:"number"`
		State     string `json:"state"`
		Merged    bool   `json:"merged"`
		Mergeable *bool  `json:"mergeable"`
		HTMLURL   string `json:"html_url"`
		Title     string `json:"title"`
		Head      struct {
			Ref string `json:"ref"`
		} `json:"head"`
		Base struct {
			Ref string `json:"ref"`
		} `json:"base"`
	}

	if err := json.Unmarshal(body, &prList); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(prList) == 0 {
		return nil, nil // No PR found
	}

	// Return the most recent PR (first in list)
	pr := prList[0]
	return &GitHubPRStatusResponse{
		Number:    pr.Number,
		State:     pr.State,
		Merged:    pr.Merged,
		Mergeable: pr.Mergeable,
		HTMLURL:   pr.HTMLURL,
		Title:     pr.Title,
		HeadRef:   pr.Head.Ref,
		BaseRef:   pr.Base.Ref,
	}, nil
}
