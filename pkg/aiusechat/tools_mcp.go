// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/greggcoppen/claudewave/app/pkg/aiusechat/uctypes"
	"github.com/greggcoppen/claudewave/app/pkg/cwmcp"
)

// MCPToolInfo represents a tool discovered from an MCP server
type MCPToolInfo struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	InputSchema map[string]any `json:"inputSchema,omitempty"`
}

// JSONRPCRequest represents a JSON-RPC 2.0 request
type JSONRPCRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

// JSONRPCResponse represents a JSON-RPC 2.0 response
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

// JSONRPCError represents a JSON-RPC 2.0 error
type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// MCPToolsListResult represents the result of tools/list
type MCPToolsListResult struct {
	Tools []MCPToolInfo `json:"tools"`
}

// MCPToolCallResult represents the result of tools/call
type MCPToolCallResult struct {
	Content []MCPToolCallContent `json:"content"`
	IsError bool                 `json:"isError,omitempty"`
}

// MCPToolCallContent represents content in a tool call result
type MCPToolCallContent struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// GenerateMCPToolDefinitions discovers and generates tool definitions for workspace-enabled MCP servers
func GenerateMCPToolDefinitions(ctx context.Context, workspaceId string) ([]uctypes.ToolDefinition, error) {
	if workspaceId == "" {
		log.Printf("[tools_mcp] No workspace ID provided, skipping MCP tools")
		return nil, nil
	}

	// Check if Hub is available
	resolver := cwmcp.GetResolver()
	if !resolver.IsHubAvailable() {
		log.Printf("[tools_mcp] MCP Hub is not available, skipping MCP tools")
		return nil, nil
	}

	// Get enabled MCP servers for workspace
	enabledServers, err := cwmcp.GetWorkspaceEnabledMCPServers(ctx, workspaceId)
	if err != nil {
		log.Printf("[tools_mcp] Error getting workspace MCP servers: %v", err)
		return nil, nil
	}

	if len(enabledServers) == 0 {
		log.Printf("[tools_mcp] No MCP servers enabled for workspace %s", workspaceId)
		return nil, nil
	}

	log.Printf("[tools_mcp] Found %d enabled MCP servers for workspace %s: %v", len(enabledServers), workspaceId, enabledServers)

	var tools []uctypes.ToolDefinition

	// Get available Hub servers
	hubServers := resolver.GetAvailableHubServers()
	log.Printf("[tools_mcp] Available Hub servers: %v", hubServers)
	hubServerSet := make(map[string]bool)
	for _, s := range hubServers {
		hubServerSet[s] = true
	}

	// For each enabled server that's running in the Hub, fetch its tools
	for _, serverName := range enabledServers {
		if !hubServerSet[serverName] {
			log.Printf("[tools_mcp] Server %s is enabled but not running in Hub", serverName)
			continue // Server not running in Hub
		}

		hubURL, err := resolver.GetHubEndpoint(serverName)
		if err != nil {
			log.Printf("[tools_mcp] Error getting Hub endpoint for %s: %v", serverName, err)
			continue
		}

		// Fetch tools from this MCP server
		serverTools, err := fetchMCPServerTools(hubURL)
		if err != nil {
			log.Printf("[tools_mcp] Error fetching tools from %s: %v", serverName, err)
			continue
		}

		log.Printf("[tools_mcp] Fetched %d tools from %s", len(serverTools), serverName)

		// Create tool definitions for each tool
		for _, tool := range serverTools {
			toolDef := makeMCPToolDefinition(serverName, hubURL, tool)
			tools = append(tools, toolDef)
		}
	}

	log.Printf("[tools_mcp] Generated %d total MCP tools for Wave AI", len(tools))
	return tools, nil
}

// fetchMCPServerTools calls tools/list on an MCP server to discover available tools
func fetchMCPServerTools(hubURL string) ([]MCPToolInfo, error) {
	request := JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "tools/list",
	}

	reqBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", hubURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	// MCP Streamable HTTP requires both Accept types
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("server returned status %d: %s", resp.StatusCode, string(body))
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse SSE format: "event: message\ndata: {...json...}"
	jsonData := extractJSONFromSSE(string(body))
	if jsonData == "" {
		return nil, fmt.Errorf("no JSON data found in SSE response")
	}

	var jsonResp JSONRPCResponse
	if err := json.Unmarshal([]byte(jsonData), &jsonResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if jsonResp.Error != nil {
		return nil, fmt.Errorf("MCP error: %s", jsonResp.Error.Message)
	}

	var result MCPToolsListResult
	if err := json.Unmarshal(jsonResp.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tools list: %w", err)
	}

	return result.Tools, nil
}

// extractJSONFromSSE extracts JSON data from SSE format response
func extractJSONFromSSE(body string) string {
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "data: ") {
			return strings.TrimPrefix(line, "data: ")
		}
	}
	// If no SSE format, try parsing as plain JSON
	if strings.HasPrefix(strings.TrimSpace(body), "{") {
		return strings.TrimSpace(body)
	}
	return ""
}

// makeMCPToolDefinition creates a tool definition for an MCP server tool
func makeMCPToolDefinition(serverName, hubURL string, tool MCPToolInfo) uctypes.ToolDefinition {
	// Create a unique tool name combining server and tool name
	toolName := fmt.Sprintf("mcp_%s_%s", serverName, tool.Name)

	// Build input schema - ensure it has required fields for OpenAI compatibility
	inputSchema := tool.InputSchema
	if inputSchema == nil {
		inputSchema = map[string]any{}
	}

	// Ensure schema has "type": "object" (required by OpenAI)
	if _, hasType := inputSchema["type"]; !hasType {
		inputSchema["type"] = "object"
	}

	// Ensure schema has "properties" (required by OpenAI)
	if _, hasProps := inputSchema["properties"]; !hasProps {
		inputSchema["properties"] = map[string]any{}
	}

	// Remove $schema field as it's not needed and can cause issues
	delete(inputSchema, "$schema")

	return uctypes.ToolDefinition{
		Name:        toolName,
		DisplayName: fmt.Sprintf("%s (%s)", tool.Name, serverName),
		Description: tool.Description,
		ToolLogName: fmt.Sprintf("mcp:%s:%s", serverName, tool.Name),
		InputSchema: inputSchema,
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			return fmt.Sprintf("calling %s tool from %s MCP server", tool.Name, serverName)
		},
		ToolAnyCallback: makeMCPToolCallback(hubURL, tool.Name),
	}
}

// makeMCPToolCallback creates an HTTP proxy callback for an MCP tool
func makeMCPToolCallback(hubURL, toolName string) func(any, *uctypes.UIMessageDataToolUse) (any, error) {
	return func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
		// Build MCP tools/call request
		request := JSONRPCRequest{
			JSONRPC: "2.0",
			ID:      1,
			Method:  "tools/call",
			Params: map[string]any{
				"name":      toolName,
				"arguments": input,
			},
		}

		reqBody, err := json.Marshal(request)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		req, err := http.NewRequestWithContext(ctx, "POST", hubURL, bytes.NewReader(reqBody))
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		// MCP Streamable HTTP requires both Accept types
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json, text/event-stream")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to make request to MCP server: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("MCP server returned status %d: %s", resp.StatusCode, string(body))
		}

		// Read response body
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read response: %w", err)
		}

		// Parse SSE format if needed
		jsonData := extractJSONFromSSE(string(body))
		if jsonData == "" {
			return nil, fmt.Errorf("no JSON data found in response")
		}

		var jsonResp JSONRPCResponse
		if err := json.Unmarshal([]byte(jsonData), &jsonResp); err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}

		if jsonResp.Error != nil {
			return nil, fmt.Errorf("MCP error: %s", jsonResp.Error.Message)
		}

		var result MCPToolCallResult
		if err := json.Unmarshal(jsonResp.Result, &result); err != nil {
			return nil, fmt.Errorf("failed to unmarshal tool result: %w", err)
		}

		// Check if the tool returned an error
		if result.IsError {
			// Extract error text from content
			for _, content := range result.Content {
				if content.Type == "text" {
					return nil, fmt.Errorf("MCP tool error: %s", content.Text)
				}
			}
			return nil, fmt.Errorf("MCP tool returned an error")
		}

		// Extract text content from result
		var textContent []string
		for _, content := range result.Content {
			if content.Type == "text" {
				textContent = append(textContent, content.Text)
			}
		}

		// Return the text content
		if len(textContent) == 1 {
			// Try to parse as JSON for structured output
			var jsonResult any
			if err := json.Unmarshal([]byte(textContent[0]), &jsonResult); err == nil {
				return jsonResult, nil
			}
			return textContent[0], nil
		}
		if len(textContent) > 1 {
			return textContent, nil
		}

		return result, nil
	}
}
