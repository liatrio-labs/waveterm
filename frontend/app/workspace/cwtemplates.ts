// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

/**
 * Layout templates for Liatrio Code sessions.
 * Each template defines a block configuration that can be applied to new session tabs.
 */

export interface CWLayoutTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    thumbnail?: string;
    layout: CWLayoutNode;
}

export interface CWLayoutNode {
    type: "block" | "split";
    direction?: "horizontal" | "vertical";
    ratio?: number; // For splits: 0-1, percentage of first child
    blockType?: string; // For blocks: the view type (term, preview, etc.)
    blockMeta?: Record<string, any>; // Additional block metadata
    children?: CWLayoutNode[];
}

/**
 * Terminal Only - Single terminal block
 * Best for: Simple terminal tasks, quick commands
 */
export const TEMPLATE_TERMINAL_ONLY: CWLayoutTemplate = {
    id: "terminal-only",
    name: "Terminal Only",
    description: "Single terminal for focused command-line work",
    icon: "terminal",
    layout: {
        type: "block",
        blockType: "term",
    },
};

/**
 * Terminal + Preview - Terminal on left, preview on right
 * Best for: Working with files that need preview (markdown, HTML)
 */
export const TEMPLATE_TERMINAL_PREVIEW: CWLayoutTemplate = {
    id: "terminal-preview",
    name: "Terminal + Preview",
    description: "Terminal with file preview side-by-side",
    icon: "columns",
    layout: {
        type: "split",
        direction: "horizontal",
        ratio: 0.6,
        children: [
            {
                type: "block",
                blockType: "term",
            },
            {
                type: "block",
                blockType: "preview",
            },
        ],
    },
};

/**
 * Terminal + File Browser - TUI-style layout (default)
 * Best for: General development with file navigation
 * Layout: 40% file browser | 60% terminal
 */
export const TEMPLATE_TERMINAL_FILEBROWSER: CWLayoutTemplate = {
    id: "terminal-filebrowser",
    name: "Terminal + File Browser",
    description: "TUI-style layout with file navigation (default)",
    icon: "folder-tree",
    layout: {
        type: "split",
        direction: "horizontal",
        ratio: 0.4,
        children: [
            {
                type: "block",
                blockType: "preview",
                blockMeta: {
                    "file:path": ".",
                },
            },
            {
                type: "block",
                blockType: "term",
            },
        ],
    },
};

/**
 * Full IDE - 3-pane layout
 * Best for: Full development environment
 * Layout: File browser (left) | Terminal (center) | Preview (right)
 */
export const TEMPLATE_FULL_IDE: CWLayoutTemplate = {
    id: "full-ide",
    name: "Full IDE",
    description: "3-pane IDE-style layout",
    icon: "window-restore",
    layout: {
        type: "split",
        direction: "horizontal",
        ratio: 0.25,
        children: [
            {
                type: "block",
                blockType: "preview",
                blockMeta: {
                    "file:path": ".",
                },
            },
            {
                type: "split",
                direction: "horizontal",
                ratio: 0.6,
                children: [
                    {
                        type: "block",
                        blockType: "term",
                    },
                    {
                        type: "block",
                        blockType: "preview",
                    },
                ],
            },
        ],
    },
};

/**
 * All available templates
 */
export const CW_LAYOUT_TEMPLATES: CWLayoutTemplate[] = [
    TEMPLATE_TERMINAL_ONLY,
    TEMPLATE_TERMINAL_PREVIEW,
    TEMPLATE_TERMINAL_FILEBROWSER,
    TEMPLATE_FULL_IDE,
];

/**
 * Default template for new sessions
 */
export const DEFAULT_TEMPLATE = TEMPLATE_TERMINAL_FILEBROWSER;

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): CWLayoutTemplate | undefined {
    return CW_LAYOUT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get the default template
 */
export function getDefaultTemplate(): CWLayoutTemplate {
    return DEFAULT_TEMPLATE;
}

/**
 * Convert a layout template node to a block definition
 * This creates the block definitions that can be used with CreateBlockCommand
 */
export function templateNodeToBlockDef(
    node: CWLayoutNode,
    worktreePath?: string
): BlockDef | BlockDef[] {
    if (node.type === "block") {
        const meta: Record<string, any> = {
            view: node.blockType,
            ...node.blockMeta,
        };

        // Add worktree path as cwd for terminal blocks
        if (node.blockType === "term" && worktreePath) {
            meta["cmd:cwd"] = worktreePath;
        }

        // Add worktree path for file browser preview blocks
        if (node.blockType === "preview" && worktreePath && node.blockMeta?.["file:path"] === ".") {
            meta["file:path"] = worktreePath;
        }

        return { meta };
    }

    // For splits, return array of block defs (layout system will handle positioning)
    if (node.type === "split" && node.children) {
        const blocks: BlockDef[] = [];
        for (const child of node.children) {
            const childDefs = templateNodeToBlockDef(child, worktreePath);
            if (Array.isArray(childDefs)) {
                blocks.push(...childDefs);
            } else {
                blocks.push(childDefs);
            }
        }
        return blocks;
    }

    return { meta: { view: "term" } };
}

/**
 * Get all block definitions from a template
 */
export function getTemplateBlockDefs(template: CWLayoutTemplate, worktreePath?: string): BlockDef[] {
    const defs = templateNodeToBlockDef(template.layout, worktreePath);
    return Array.isArray(defs) ? defs : [defs];
}

/**
 * Get the primary block definition (first terminal) from a template
 */
export function getTemplatePrimaryBlockDef(template: CWLayoutTemplate, worktreePath?: string): BlockDef {
    const defs = getTemplateBlockDefs(template, worktreePath);
    // Return the first terminal block, or the first block if no terminal
    const termBlock = defs.find((d) => d.meta?.view === "term");
    return termBlock || defs[0] || { meta: { view: "term" } };
}

/**
 * Represents a block creation instruction with split positioning
 */
interface BlockCreationInstruction {
    blockDef: BlockDef;
    splitAction?: "splitright" | "splitdown" | "splitleft" | "splitup";
    relativeTo?: number; // Index of block to split from
}

/**
 * Flatten a layout node into creation instructions
 * This handles nested splits by converting them into sequential block creations
 */
function flattenLayoutNode(
    node: CWLayoutNode,
    worktreePath?: string,
    parentDirection?: "horizontal" | "vertical"
): BlockCreationInstruction[] {
    if (node.type === "block") {
        const meta: Record<string, any> = {
            view: node.blockType,
            controller: node.blockType === "term" ? "shell" : undefined,
            ...node.blockMeta,
        };

        // Add worktree path as cwd for terminal blocks
        if (node.blockType === "term" && worktreePath) {
            meta["cmd:cwd"] = worktreePath;
        }

        // Add worktree path for file browser preview blocks
        if (node.blockType === "preview" && worktreePath && node.blockMeta?.["file:path"] === ".") {
            meta["file:path"] = worktreePath;
        }

        return [{ blockDef: { meta } }];
    }

    if (node.type === "split" && node.children && node.children.length >= 2) {
        const instructions: BlockCreationInstruction[] = [];
        const isHorizontal = node.direction === "horizontal";

        // First child becomes the base block
        const firstChildInstructions = flattenLayoutNode(node.children[0], worktreePath, node.direction);
        instructions.push(...firstChildInstructions);

        // Second child splits from the first
        const secondChildInstructions = flattenLayoutNode(node.children[1], worktreePath, node.direction);
        if (secondChildInstructions.length > 0) {
            // The first instruction of the second child gets the split action
            secondChildInstructions[0].splitAction = isHorizontal ? "splitright" : "splitdown";
            secondChildInstructions[0].relativeTo = 0; // Split from the first block in this group
        }
        instructions.push(...secondChildInstructions);

        return instructions;
    }

    // Fallback to terminal block
    return [{ blockDef: { meta: { view: "term", controller: "shell" } } }];
}

/**
 * Apply a layout template to create blocks in a tab
 *
 * @param template - The layout template to apply
 * @param tabId - The tab ID to create blocks in
 * @param worktreePath - Optional worktree path for terminal cwd and file browser
 * @param createBlockFn - Function to create a block (abstracted for testing)
 * @returns Promise resolving to array of created block IDs
 */
export async function applyLayoutTemplate(
    template: CWLayoutTemplate,
    tabId: string,
    worktreePath?: string,
    createBlockFn?: (data: CommandCreateBlockData) => Promise<ORef>
): Promise<string[]> {
    const instructions = flattenLayoutNode(template.layout, worktreePath);
    const createdBlockIds: string[] = [];

    for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        const createData: CommandCreateBlockData = {
            tabid: tabId,
            blockdef: instruction.blockDef,
            magnified: false,
            focused: i === 0, // Focus the first block
        };

        // If this block needs to split from another, set the target
        if (instruction.splitAction && createdBlockIds.length > 0) {
            const targetIndex = instruction.relativeTo ?? createdBlockIds.length - 1;
            createData.targetblockid = createdBlockIds[targetIndex];
            createData.targetaction = instruction.splitAction;
        }

        try {
            if (createBlockFn) {
                const oref = await createBlockFn(createData);
                createdBlockIds.push(oref.oid);
            } else {
                // Dynamic import to avoid circular dependencies
                const { RpcApi } = await import("@/app/store/wshclientapi");
                const { TabRpcClient } = await import("@/app/store/wshrpcutil");
                const oref = await RpcApi.CreateBlockCommand(TabRpcClient, createData);
                createdBlockIds.push(oref.oid);
            }
        } catch (err) {
            console.error(`[applyLayoutTemplate] Failed to create block ${i}:`, err);
            throw err;
        }
    }

    return createdBlockIds;
}
