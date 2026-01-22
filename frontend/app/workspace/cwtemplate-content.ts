// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

/**
 * Template content capture and compression utilities.
 * Handles serializing and compressing block content for template storage.
 */

import pako from "pako";
import { fetchWaveFile } from "@/store/global";
import { arrayToBase64, base64ToArray } from "@/util/util";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import type { CWBlockContent } from "./cwtemplates";

// Constants
const MAX_CONTENT_PER_BLOCK = 128 * 1024; // 128KB compressed max per block
const MAX_TOTAL_CONTENT = 512 * 1024; // 512KB total max per template
const MAX_TERMINAL_LINES = 2000; // Default max lines to capture
const TERM_CACHE_FILENAME = "cache:term:full";

/**
 * Compress data using gzip and return base64-encoded result
 */
export function compressContent(data: Uint8Array): { data64: string; originalSize: number; compressedSize: number } {
    const compressed = pako.gzip(data);
    const data64 = arrayToBase64(compressed);
    return {
        data64,
        originalSize: data.length,
        compressedSize: compressed.length,
    };
}

/**
 * Decompress base64-encoded gzip data
 */
export function decompressContent(data64: string): Uint8Array {
    const compressed = base64ToArray(data64);
    return pako.ungzip(compressed);
}

/**
 * Truncate text to a maximum number of lines
 */
export function truncateToLines(text: string, maxLines: number): { text: string; truncated: boolean } {
    const lines = text.split("\n");
    if (lines.length <= maxLines) {
        return { text, truncated: false };
    }
    // Keep the last maxLines lines (most recent content)
    const truncatedLines = lines.slice(-maxLines);
    return {
        text: truncatedLines.join("\n"),
        truncated: true,
    };
}

/**
 * Options for capturing block content
 */
export interface CaptureContentOptions {
    maxTerminalLines?: number;
    maxContentSize?: number;
}

/**
 * Capture terminal content from a block
 *
 * @param blockId - The block ID to capture content from
 * @param options - Capture options (max lines, etc.)
 * @returns CWBlockContent or null if no content available
 */
export async function captureTerminalContent(
    blockId: string,
    options: CaptureContentOptions = {}
): Promise<CWBlockContent | null> {
    const maxLines = options.maxTerminalLines ?? MAX_TERMINAL_LINES;
    const maxSize = options.maxContentSize ?? MAX_CONTENT_PER_BLOCK;

    try {
        // Fetch the terminal cache file
        const { data, fileInfo } = await fetchWaveFile(blockId, TERM_CACHE_FILENAME);

        if (!data || data.length === 0) {
            console.log(`[captureTerminalContent] No cached content for block ${blockId}`);
            return null;
        }

        // Convert to text and truncate if needed
        const decoder = new TextDecoder();
        const text = decoder.decode(data);
        const { text: truncatedText, truncated } = truncateToLines(text, maxLines);

        // Compress the content
        const encoder = new TextEncoder();
        const textBytes = encoder.encode(truncatedText);
        const { data64, originalSize, compressedSize } = compressContent(textBytes);

        // Check if content exceeds max size
        if (compressedSize > maxSize) {
            console.warn(
                `[captureTerminalContent] Content for block ${blockId} exceeds max size (${compressedSize} > ${maxSize}), truncating further`
            );
            // Try to reduce content to fit
            const reductionRatio = maxSize / compressedSize;
            const newMaxLines = Math.floor(maxLines * reductionRatio * 0.9); // 90% to account for compression variance
            if (newMaxLines < 100) {
                console.warn(`[captureTerminalContent] Cannot reduce content enough, skipping`);
                return null;
            }
            return captureTerminalContent(blockId, { ...options, maxTerminalLines: newMaxLines });
        }

        console.log(
            `[captureTerminalContent] Captured ${originalSize} bytes (${compressedSize} compressed) from block ${blockId}`
        );

        return {
            contentType: "terminal",
            data64,
            compressed: true,
            size: originalSize,
            truncated,
        };
    } catch (err) {
        console.error(`[captureTerminalContent] Failed to capture content for block ${blockId}:`, err);
        return null;
    }
}

/**
 * Capture web block content (URL only for now)
 *
 * @param blockId - The block ID
 * @param currentUrl - The current URL to capture
 * @returns CWBlockContent with URL
 */
export function captureWebContent(blockId: string, currentUrl?: string): CWBlockContent | null {
    if (!currentUrl) {
        return null;
    }

    return {
        contentType: "web",
        url: currentUrl,
    };
}

/**
 * Capture preview block content (file path only)
 *
 * @param blockId - The block ID
 * @param filePath - The current file path
 * @returns CWBlockContent with file path
 */
export function capturePreviewContent(blockId: string, filePath?: string): CWBlockContent | null {
    if (!filePath) {
        return null;
    }

    return {
        contentType: "preview",
        filePath,
    };
}

/**
 * Capture content from a block based on its type
 *
 * @param blockId - The block ID
 * @param blockType - The type of block (term, web, preview)
 * @param blockMeta - Block metadata
 * @param options - Capture options
 * @returns CWBlockContent or null
 */
export async function captureBlockContent(
    blockId: string,
    blockType: string,
    blockMeta?: Record<string, any>,
    options: CaptureContentOptions = {}
): Promise<CWBlockContent | null> {
    switch (blockType) {
        case "term":
            return captureTerminalContent(blockId, options);
        case "web":
            return captureWebContent(blockId, blockMeta?.url);
        case "preview":
            return capturePreviewContent(blockId, blockMeta?.["file:path"]);
        default:
            console.log(`[captureBlockContent] Unsupported block type: ${blockType}`);
            return null;
    }
}

/**
 * Restore terminal content to a block
 *
 * @param blockId - The target block ID
 * @param content - The content to restore
 */
export async function restoreTerminalContent(blockId: string, content: CWBlockContent): Promise<void> {
    if (content.contentType !== "terminal" || !content.data64) {
        console.warn("[restoreTerminalContent] Invalid content type or missing data");
        return;
    }

    try {
        // Decompress the content
        let dataBytes: Uint8Array;
        if (content.compressed) {
            dataBytes = decompressContent(content.data64);
        } else {
            dataBytes = base64ToArray(content.data64);
        }

        // Write to the terminal cache file using FileWriteCommand
        const data64 = arrayToBase64(dataBytes);
        await RpcApi.FileWriteCommand(TabRpcClient, {
            info: {
                path: `wfs://${blockId}/${TERM_CACHE_FILENAME}`,
            },
            data64,
        });

        console.log(`[restoreTerminalContent] Restored ${dataBytes.length} bytes to block ${blockId}`);
    } catch (err) {
        console.error(`[restoreTerminalContent] Failed to restore content to block ${blockId}:`, err);
        throw err;
    }
}

/**
 * Restore content to a block based on its type
 *
 * @param blockId - The target block ID
 * @param content - The content to restore
 */
export async function restoreBlockContent(blockId: string, content: CWBlockContent): Promise<void> {
    switch (content.contentType) {
        case "terminal":
            await restoreTerminalContent(blockId, content);
            break;
        case "web":
            // Web content is handled via metadata (url) during block creation
            // No additional restoration needed
            break;
        case "preview":
            // Preview content is handled via metadata (file:path) during block creation
            // No additional restoration needed
            break;
        default:
            console.warn(`[restoreBlockContent] Unknown content type: ${content.contentType}`);
    }
}

/**
 * Calculate the total content size in a template
 *
 * @param contents - Array of content objects
 * @returns Total compressed size in bytes
 */
export function calculateTotalContentSize(contents: (CWBlockContent | null | undefined)[]): number {
    let total = 0;
    for (const content of contents) {
        if (content?.data64) {
            // Calculate approximate byte size from base64 (base64 adds ~33% overhead)
            total += Math.ceil(content.data64.length * 0.75);
        }
    }
    return total;
}

/**
 * Validate that total content size is within limits
 *
 * @param totalSize - Total content size in bytes
 * @returns { valid: boolean, message?: string }
 */
export function validateContentSize(totalSize: number): { valid: boolean; message?: string } {
    if (totalSize > MAX_TOTAL_CONTENT) {
        return {
            valid: false,
            message: `Total content size (${formatBytes(totalSize)}) exceeds maximum (${formatBytes(MAX_TOTAL_CONTENT)})`,
        };
    }
    return { valid: true };
}

/**
 * Format bytes as human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Export constants for external use
export { MAX_CONTENT_PER_BLOCK, MAX_TOTAL_CONTENT, MAX_TERMINAL_LINES };
