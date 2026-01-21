// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Utility functions for the Code View pane feature
 */

import { FileViewType, SUPPORTED_IMAGE_TYPES } from "./codeview-types";

/**
 * Text-based application MIME types that should be treated as code
 */
const TEXT_APPLICATION_MIMETYPES = [
    "application/sql",
    "application/x-php",
    "application/x-pem-file",
    "application/x-httpd-php",
    "application/liquid",
    "application/graphql",
    "application/javascript",
    "application/typescript",
    "application/x-javascript",
    "application/x-typescript",
    "application/dart",
    "application/vnd.dart",
    "application/x-ruby",
    "application/wasm",
    "application/x-latex",
    "application/x-sh",
    "application/x-python",
    "application/x-awk",
    "application/json",
    "application/xml",
    "application/yaml",
    "application/toml",
];

/**
 * Common text file extensions that should be treated as editable text
 */
const TEXT_FILE_EXTENSIONS = [
    // Markdown
    ".md", ".mdx", ".markdown",
    // Code
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".py", ".pyw", ".pyi",
    ".rb", ".rake", ".gemspec",
    ".java", ".kt", ".kts", ".scala", ".groovy",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".hh", ".cxx", ".hxx",
    ".cs", ".fs", ".fsx",
    ".go", ".rs", ".swift", ".m", ".mm",
    ".php", ".phtml",
    ".pl", ".pm", ".perl",
    ".r", ".R", ".rmd",
    ".lua", ".tcl", ".awk",
    ".sh", ".bash", ".zsh", ".fish", ".ksh", ".csh",
    ".ps1", ".psm1", ".psd1", ".bat", ".cmd",
    ".sql", ".mysql", ".pgsql",
    ".html", ".htm", ".xhtml",
    ".css", ".scss", ".sass", ".less", ".styl",
    ".xml", ".xsl", ".xslt", ".svg",
    ".json", ".json5", ".jsonc", ".jsonl",
    ".yaml", ".yml",
    ".toml", ".ini", ".cfg", ".conf", ".config",
    ".env", ".env.local", ".env.development", ".env.production",
    ".properties", ".gitignore", ".gitattributes", ".editorconfig",
    ".eslintrc", ".prettierrc", ".babelrc",
    ".dockerfile", ".dockerignore",
    ".makefile", ".cmake",
    ".vue", ".svelte", ".astro",
    ".graphql", ".gql",
    ".proto", ".thrift",
    ".tf", ".tfvars", ".hcl",
    // Plain text
    ".txt", ".text", ".log", ".readme", ".changelog", ".license", ".authors",
];

/**
 * Determines if a MIME type represents a text file
 */
export function isTextFile(mimeType: string | null | undefined): boolean {
    if (!mimeType) {
        return false;
    }
    return (
        mimeType.startsWith("text/") ||
        TEXT_APPLICATION_MIMETYPES.includes(mimeType) ||
        (mimeType.startsWith("application/") &&
            (mimeType.includes("json") || mimeType.includes("yaml") || mimeType.includes("toml"))) ||
        mimeType.includes("xml")
    );
}

/**
 * Determines if a file is a text file by its extension
 */
export function isTextFileByExtension(filePath: string | null | undefined): boolean {
    if (!filePath) {
        return false;
    }
    const lower = filePath.toLowerCase();
    // Check for exact extension matches
    for (const ext of TEXT_FILE_EXTENSIONS) {
        if (lower.endsWith(ext)) {
            return true;
        }
    }
    // Also check for files without extensions that are commonly text (like Makefile, Dockerfile, etc.)
    const fileName = lower.split("/").pop() || "";
    const commonTextFiles = [
        "makefile", "dockerfile", "vagrantfile", "gemfile", "rakefile",
        "procfile", "brewfile", "justfile", "taskfile",
        "readme", "changelog", "license", "authors", "contributing", "todo",
        ".gitignore", ".gitattributes", ".editorconfig", ".npmrc", ".yarnrc",
        ".eslintrc", ".prettierrc", ".babelrc", ".browserslistrc",
    ];
    return commonTextFiles.includes(fileName);
}

/**
 * Determines if a MIME type represents a supported image file
 */
export function isImageFile(mimeType: string | null | undefined): boolean {
    if (!mimeType) {
        return false;
    }
    return SUPPORTED_IMAGE_TYPES.includes(mimeType) || mimeType.startsWith("image/");
}

/**
 * Determines if a MIME type represents a markdown file
 */
export function isMarkdownFile(mimeType: string | null | undefined): boolean {
    if (!mimeType) {
        return false;
    }
    return mimeType.startsWith("text/markdown") || mimeType.startsWith("text/mdx");
}

/**
 * Checks if a file path is a markdown file by extension
 */
export function isMarkdownByExtension(filePath: string | null | undefined): boolean {
    if (!filePath) {
        return false;
    }
    const lower = filePath.toLowerCase();
    return lower.endsWith(".md") || lower.endsWith(".mdx") || lower.endsWith(".markdown");
}

/**
 * Determines the appropriate view type for a file based on its MIME type and/or file path
 * Falls back to extension-based detection if MIME type is not available or unrecognized
 */
export function getFileViewType(mimeType: string | null | undefined, filePath?: string | null): FileViewType {
    // First try MIME type detection
    if (isTextFile(mimeType)) {
        return "text";
    }
    if (isImageFile(mimeType)) {
        return "image";
    }
    // Fall back to extension-based detection
    if (filePath) {
        if (isTextFileByExtension(filePath)) {
            return "text";
        }
        // Check for image extensions as fallback
        const lower = filePath.toLowerCase();
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") ||
            lower.endsWith(".gif") || lower.endsWith(".webp") || lower.endsWith(".svg") ||
            lower.endsWith(".bmp") || lower.endsWith(".ico")) {
            return "image";
        }
    }
    return "unsupported";
}

/**
 * Extracts the filename from a full file path
 */
export function getFileName(filePath: string): string {
    if (!filePath) {
        return "";
    }
    const parts = filePath.split("/");
    return parts[parts.length - 1] || "";
}

/**
 * Extracts the file extension from a file path
 */
export function getFileExtension(filePath: string): string {
    const fileName = getFileName(filePath);
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0) {
        return "";
    }
    return fileName.substring(lastDot + 1).toLowerCase();
}

/**
 * Gets the directory path from a full file path
 */
export function getDirectoryPath(filePath: string): string {
    if (!filePath) {
        return "";
    }
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash === -1) {
        return "";
    }
    return filePath.substring(0, lastSlash) || "/";
}

/**
 * Parses a file path into breadcrumb segments
 */
export function parseBreadcrumbSegments(filePath: string): { path: string; name: string; isFile: boolean }[] {
    if (!filePath) {
        return [];
    }

    const segments: { path: string; name: string; isFile: boolean }[] = [];
    const parts = filePath.split("/").filter(Boolean);

    let currentPath = "";
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath += "/" + part;
        const isLast = i === parts.length - 1;
        segments.push({
            path: currentPath,
            name: part,
            isFile: isLast,
        });
    }

    return segments;
}

/**
 * Generates a unique tab ID
 */
export function generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Gets the appropriate icon class for a file based on MIME type or extension
 */
export function getFileIcon(mimeType: string | null | undefined, fileName?: string): string {
    if (mimeType === "directory") {
        return "folder";
    }
    if (mimeType === "application/pdf") {
        return "file-pdf";
    }
    if (mimeType?.startsWith("image/")) {
        return "image";
    }
    if (mimeType?.startsWith("video/")) {
        return "film";
    }
    if (mimeType?.startsWith("audio/")) {
        return "headphones";
    }
    if (isMarkdownFile(mimeType) || (fileName && isMarkdownByExtension(fileName))) {
        return "file-lines";
    }
    if (mimeType === "text/csv") {
        return "file-csv";
    }
    if (isTextFile(mimeType)) {
        return "file-code";
    }
    return "file";
}

/**
 * Truncates a file path for display, keeping the filename and showing ellipsis for long paths
 */
export function truncatePath(filePath: string, maxLength: number = 50): string {
    if (!filePath || filePath.length <= maxLength) {
        return filePath;
    }

    const fileName = getFileName(filePath);
    if (fileName.length >= maxLength - 3) {
        return "..." + fileName.substring(fileName.length - (maxLength - 3));
    }

    const remainingLength = maxLength - fileName.length - 4; // 4 for ".../""
    const dirPath = getDirectoryPath(filePath);

    if (dirPath.length <= remainingLength) {
        return filePath;
    }

    return "..." + dirPath.substring(dirPath.length - remainingLength) + "/" + fileName;
}

/**
 * Navigate a file browser block to the specified path.
 * This function finds a file browser (directory) block and updates its path.
 */
export async function navigateFileBrowserToPath(
    path: string,
    connection: string = ""
): Promise<boolean> {
    // Import dynamically to avoid circular dependencies
    const { getAllBlockComponentModels } = await import("@/app/store/global");
    const { ObjectService } = await import("@/app/store/services");
    const WOS = await import("@/app/store/wos");

    const allBCMs = getAllBlockComponentModels();

    // Find a file browser (directory) block
    for (const bcm of allBCMs) {
        if (bcm?.viewModel?.viewType === "preview") {
            const viewModel = bcm.viewModel as any;
            // Check if this is a directory preview
            if (viewModel.blockId) {
                try {
                    const oref = WOS.makeORef("block", viewModel.blockId);
                    await ObjectService.UpdateObjectMeta(oref, {
                        file: path,
                        connection: connection || undefined,
                    });
                    return true;
                } catch (err) {
                    console.error("[CodeView] Failed to navigate file browser:", err);
                }
            }
        }
    }

    return false;
}
