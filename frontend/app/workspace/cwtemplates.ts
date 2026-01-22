// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

/**
 * Layout templates for Liatrio Code sessions.
 * Each template defines a block configuration that can be applied to new session tabs.
 */

/**
 * Content captured from a block for template serialization
 */
export interface CWBlockContent {
    contentType: "terminal" | "web" | "preview";
    data64?: string; // base64-encoded content (gzip compressed)
    compressed?: boolean; // true if gzip compressed
    size?: number; // original size in bytes
    truncated?: boolean; // true if content was truncated
    url?: string; // for web blocks - current URL
    filePath?: string; // for preview blocks
}

export interface CWLayoutTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    thumbnail?: string;
    layout: CWLayoutNode;
    hasContent?: boolean; // quick indicator for UI
    contentVersion?: number; // format versioning (start at 1)
    totalContentSize?: number; // total bytes of content
}

export interface CWLayoutNode {
    type: "block" | "split";
    direction?: "horizontal" | "vertical";
    ratio?: number; // For splits: 0-1, percentage of first child
    blockType?: string; // For blocks: the view type (term, preview, etc.)
    blockMeta?: Record<string, any>; // Additional block metadata
    children?: CWLayoutNode[];
    content?: CWBlockContent; // optional block content for saving terminal output, etc.
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
 * Terminal + File Browser - TUI-style layout (default)
 * Best for: General development with file navigation
 * Layout: 60% terminal | 40% file browser
 */
export const TEMPLATE_TERMINAL_FILEBROWSER: CWLayoutTemplate = {
    id: "terminal-filebrowser",
    name: "Terminal + File Browser",
    description: "TUI-style layout with file navigation",
    icon: "folder-tree",
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
                blockMeta: {
                    "file:path": ".",
                },
            },
        ],
    },
};

/**
 * Terminal + Web - Terminal on left, web view on right
 * Best for: Previewing web content alongside terminal
 * Layout: 60% terminal | 40% web
 */
export const TEMPLATE_TERMINAL_WEB: CWLayoutTemplate = {
    id: "terminal-web",
    name: "Terminal + Web",
    description: "Terminal with web preview side-by-side",
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
                blockType: "web",
            },
        ],
    },
};

/**
 * Full IDE - 3-pane layout
 * Best for: Full development environment
 * Layout: File browser (left) | Terminal (center) | Web (right)
 */
export const TEMPLATE_FULL_IDE: CWLayoutTemplate = {
    id: "full-ide",
    name: "Full IDE",
    description: "File browser, terminal, and web preview",
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
                        blockType: "web",
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
    TEMPLATE_TERMINAL_FILEBROWSER,
    TEMPLATE_TERMINAL_WEB,
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
    content?: CWBlockContent; // Content to restore after block creation
}

/**
 * Get a shortened path for display (last 2 path components)
 */
function getShortPath(fullPath: string): string {
    const parts = fullPath.split('/');
    return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : fullPath;
}

/**
 * Block info collected during tree traversal
 */
interface CollectedBlock {
    blockDef: BlockDef;
    columnIndex: number; // Which column this block belongs to (for horizontal ordering)
    rowIndex: number; // Position within column (0 = top/primary, 1+ = stacked below)
    splitAction?: "splitright" | "splitdown";
    content?: CWBlockContent; // Content to restore after block creation
}

/**
 * Recursively collect blocks from the layout tree
 * Returns blocks grouped by their column position
 */
function collectBlocksFromTree(
    node: CWLayoutNode,
    worktreePath?: string,
    sessionInfo?: CWSessionInfo,
    columnStart: number = 0,
    rowOffset: number = 0
): { blocks: CollectedBlock[], columnCount: number } {
    if (node.type === "block") {
        const meta: Record<string, any> = {
            view: node.blockType,
            controller: node.blockType === "term" ? "shell" : undefined,
            ...node.blockMeta,
        };

        if (node.blockType === "term" && worktreePath) {
            meta["cmd:cwd"] = worktreePath;
        }

        if (node.blockType === "preview" && worktreePath && node.blockMeta?.["file:path"] === ".") {
            meta["file:path"] = worktreePath;
        }

        if (node.blockType === "term" && sessionInfo) {
            meta["frame:title"] = sessionInfo.branchName || sessionInfo.name;
            if (worktreePath) {
                meta["frame:text"] = getShortPath(worktreePath);
            }
        }

        return {
            blocks: [{
                blockDef: { meta },
                columnIndex: columnStart,
                rowIndex: rowOffset,
                content: node.content, // Pass through content for restoration
            }],
            columnCount: 1,
        };
    }

    if (node.type === "split" && node.children && node.children.length >= 2) {
        const isHorizontal = node.direction === "horizontal";

        if (isHorizontal) {
            // Horizontal split: children go into different columns
            const firstResult = collectBlocksFromTree(node.children[0], worktreePath, sessionInfo, columnStart, 0);
            const secondResult = collectBlocksFromTree(node.children[1], worktreePath, sessionInfo, columnStart + firstResult.columnCount, 0);

            return {
                blocks: [...firstResult.blocks, ...secondResult.blocks],
                columnCount: firstResult.columnCount + secondResult.columnCount,
            };
        } else {
            // Vertical split: children stack in the same column
            const firstResult = collectBlocksFromTree(node.children[0], worktreePath, sessionInfo, columnStart, rowOffset);
            // Find the max row in first result to know where second starts
            const maxRow = Math.max(...firstResult.blocks.map(b => b.rowIndex));
            const secondResult = collectBlocksFromTree(node.children[1], worktreePath, sessionInfo, columnStart, maxRow + 1);

            return {
                blocks: [...firstResult.blocks, ...secondResult.blocks],
                columnCount: Math.max(firstResult.columnCount, secondResult.columnCount),
            };
        }
    }

    return {
        blocks: [{
            blockDef: { meta: { view: "term", controller: "shell" } },
            columnIndex: columnStart,
            rowIndex: rowOffset,
        }],
        columnCount: 1,
    };
}

/**
 * Flatten a layout node into creation instructions
 * Creates blocks in order: all row-0 blocks first (establishes columns), then row-1+, etc.
 */
function flattenLayoutNode(
    node: CWLayoutNode,
    worktreePath?: string,
    baseIndex: number = 0,
    sessionInfo?: CWSessionInfo
): BlockCreationInstruction[] {
    // Collect all blocks with column/row info
    const { blocks } = collectBlocksFromTree(node, worktreePath, sessionInfo);

    // Sort: first by rowIndex (primary blocks first), then by columnIndex
    blocks.sort((a, b) => {
        if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
        return a.columnIndex - b.columnIndex;
    });

    // Build instructions with correct split targets
    const result: BlockCreationInstruction[] = [];
    const columnToBlockIndex = new Map<number, number>(); // Maps column -> index of its primary (row 0) block

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const instruction: BlockCreationInstruction = {
            blockDef: block.blockDef,
            content: block.content, // Pass through content for restoration
        };

        if (i > 0) {
            if (block.rowIndex === 0) {
                // Primary block in a new column - split right from previous column's primary block
                const prevColumnPrimaryIndex = columnToBlockIndex.get(block.columnIndex - 1);
                if (prevColumnPrimaryIndex !== undefined) {
                    instruction.splitAction = "splitright";
                    instruction.relativeTo = prevColumnPrimaryIndex;
                }
            } else {
                // Stacked block - split down from this column's primary block
                const columnPrimaryIndex = columnToBlockIndex.get(block.columnIndex);
                if (columnPrimaryIndex !== undefined) {
                    instruction.splitAction = "splitdown";
                    instruction.relativeTo = columnPrimaryIndex;
                }
            }
        }

        // Track primary blocks for each column
        if (block.rowIndex === 0) {
            columnToBlockIndex.set(block.columnIndex, baseIndex + i);
        }

        result.push(instruction);
    }

    return result;
}

/**
 * Session info for frame title display
 */
export interface CWSessionInfo {
    name: string;
    branchName: string;
}

/**
 * Options for capturing a layout as a template
 */
export interface CaptureLayoutOptions {
    includeContent?: boolean;
    maxTerminalLines?: number;
}

/**
 * Options for applying a layout template
 */
export interface ApplyLayoutTemplateOptions {
    template: CWLayoutTemplate;
    tabId: string;
    worktreePath?: string;
    autoStartClaude?: boolean;
    createBlockFn?: (data: CommandCreateBlockData) => Promise<ORef>;
    sessionInfo?: CWSessionInfo;
}

/**
 * Apply a layout template to create blocks in a tab
 *
 * @param template - The layout template to apply
 * @param tabId - The tab ID to create blocks in
 * @param worktreePath - Optional worktree path for terminal/file browser blocks
 * @param createBlockFn - Optional custom function to create blocks
 * @param autoStartClaude - Whether to auto-start Claude Code in terminal
 * @param sessionInfo - Optional session info for frame title display
 * @returns Promise resolving to array of created block IDs
 */
export async function applyLayoutTemplate(
    template: CWLayoutTemplate,
    tabId: string,
    worktreePath?: string,
    createBlockFn?: (data: CommandCreateBlockData) => Promise<ORef>,
    autoStartClaude?: boolean,
    sessionInfo?: CWSessionInfo
): Promise<string[]> {
    console.log("[applyLayoutTemplate] Template layout:", JSON.stringify(template.layout, null, 2));

    const instructions = flattenLayoutNode(template.layout, worktreePath, 0, sessionInfo);
    console.log("[applyLayoutTemplate] Flattened instructions:", instructions.map((inst, i) => ({
        index: i,
        blockType: inst.blockDef.meta?.view,
        splitAction: inst.splitAction,
        relativeTo: inst.relativeTo
    })));

    const createdBlockIds: string[] = [];
    let firstTermBlockId: string | null = null;

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
            let blockId: string;
            if (createBlockFn) {
                const oref = await createBlockFn(createData);
                // Extract block ID from ORef (format: "block:uuid")
                blockId = oref.startsWith("block:") ? oref.slice(6) : oref;
            } else {
                // Dynamic import to avoid circular dependencies
                const { RpcApi } = await import("@/app/store/wshclientapi");
                const { TabRpcClient } = await import("@/app/store/wshrpcutil");
                const oref = await RpcApi.CreateBlockCommand(TabRpcClient, createData);
                // Extract block ID from ORef (format: "block:uuid")
                blockId = oref.startsWith("block:") ? oref.slice(6) : oref;
            }
            createdBlockIds.push(blockId);

            // Track the first terminal block for auto-start
            if (!firstTermBlockId && instruction.blockDef.meta?.view === "term") {
                firstTermBlockId = blockId;
            }

            // Restore content if present
            if (instruction.content) {
                try {
                    const { restoreBlockContent } = await import("./cwtemplate-content");
                    // Small delay to ensure block is initialized
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await restoreBlockContent(blockId, instruction.content);
                    console.log(`[applyLayoutTemplate] Restored content to block ${blockId}`);
                } catch (contentErr) {
                    console.warn(`[applyLayoutTemplate] Failed to restore content to block ${blockId}:`, contentErr);
                    // Don't throw - content restoration failure shouldn't prevent layout application
                }
            }
        } catch (err) {
            console.error(`[applyLayoutTemplate] Failed to create block ${i}:`, err);
            throw err;
        }
    }

    // Auto-start Claude Code if enabled and we have a terminal block
    if (autoStartClaude && firstTermBlockId) {
        try {
            const { RpcApi } = await import("@/app/store/wshclientapi");
            const { TabRpcClient } = await import("@/app/store/wshrpcutil");

            // Small delay to ensure terminal is initialized
            await new Promise(resolve => setTimeout(resolve, 500));

            // Send "claude" command to the terminal
            await RpcApi.ControllerInputCommand(TabRpcClient, {
                blockid: firstTermBlockId,
                inputdata64: btoa("claude\n"),
            });
            console.log("[applyLayoutTemplate] Auto-started Claude Code in block:", firstTermBlockId);
        } catch (err) {
            console.error("[applyLayoutTemplate] Failed to auto-start Claude Code:", err);
            // Don't throw - auto-start failure shouldn't prevent the layout from being applied
        }
    }

    return createdBlockIds;
}

/**
 * Apply a template to an existing tab by removing current blocks and creating new ones.
 * Preserves the working directory from existing terminal blocks.
 *
 * @param template - The template to apply
 * @param tabId - The tab to apply the template to
 * @returns Promise resolving to array of created block IDs
 */
export async function applyTemplateToExistingTab(
    template: CWLayoutTemplate,
    tabId: string
): Promise<string[]> {
    const { RpcApi } = await import("@/app/store/wshclientapi");
    const { TabRpcClient } = await import("@/app/store/wshrpcutil");
    const { globalStore } = await import("@/app/store/jotaiStore");
    const WOS = await import("@/app/store/wos");
    const { getLayoutModelForStaticTab } = await import("@/layout/index");

    // Get current tab data
    const tabORef = WOS.makeORef("tab", tabId);
    const tabAtom = WOS.getWaveObjectAtom<Tab>(tabORef);
    const tabData = globalStore.get(tabAtom);

    if (!tabData) {
        console.error("[applyTemplateToExistingTab] Tab not found:", tabId);
        throw new Error("Tab not found");
    }

    // Get the layout model for proper cleanup
    const layoutModel = getLayoutModelForStaticTab();

    // Collect existing blocks info to extract working directory
    const existingBlockIds = tabData.blockids || [];
    let worktreePath: string | undefined;

    // Find the first terminal block's working directory to preserve it
    for (const blockId of existingBlockIds) {
        try {
            const blockInfo = await RpcApi.BlockInfoCommand(TabRpcClient, blockId);
            if (blockInfo?.block?.meta) {
                const viewType = blockInfo.block.meta.view;
                const cwd = blockInfo.block.meta["cmd:cwd"];

                // Get cwd from terminal blocks
                if (viewType === "term" && cwd) {
                    worktreePath = cwd;
                    console.log("[applyTemplateToExistingTab] Preserving worktree path:", worktreePath);
                    break;
                }
            }
        } catch (err) {
            console.warn(`[applyTemplateToExistingTab] Failed to get block info for ${blockId}:`, err);
        }
    }

    // If no terminal cwd found, try to get path from file browser blocks
    if (!worktreePath) {
        for (const blockId of existingBlockIds) {
            try {
                const blockInfo = await RpcApi.BlockInfoCommand(TabRpcClient, blockId);
                if (blockInfo?.block?.meta) {
                    const viewType = blockInfo.block.meta.view;
                    const filePath = blockInfo.block.meta["file:path"];

                    if (viewType === "preview" && filePath && filePath !== ".") {
                        worktreePath = filePath;
                        console.log("[applyTemplateToExistingTab] Using file browser path:", worktreePath);
                        break;
                    }
                }
            } catch (err) {
                // Ignore errors for individual blocks
            }
        }
    }

    // IMPORTANT: We must create at least one new block BEFORE deleting all old blocks.
    // If we delete all blocks first, the backend will auto-delete the empty tab,
    // then auto-delete the empty workspace, and close the window.

    // Get the template instructions first
    console.log("[applyTemplateToExistingTab] Template being applied:", template.name);
    console.log("[applyTemplateToExistingTab] Template layout:", JSON.stringify(template.layout, null, 2));

    const instructions = flattenLayoutNode(template.layout, worktreePath);
    console.log("[applyTemplateToExistingTab] Generated", instructions.length, "instructions:",
        instructions.map((inst, i) => ({
            index: i,
            blockType: inst.blockDef.meta?.view,
            splitAction: inst.splitAction,
            relativeTo: inst.relativeTo
        }))
    );

    if (instructions.length === 0) {
        console.error("[applyTemplateToExistingTab] Template has no blocks");
        throw new Error("Template has no blocks");
    }

    // Create the FIRST block from the new template before deleting anything
    console.log("[applyTemplateToExistingTab] Creating first block to prevent tab deletion");
    const firstInstruction = instructions[0];
    const firstCreateData: CommandCreateBlockData = {
        tabid: tabId,
        blockdef: firstInstruction.blockDef,
        magnified: false,
        focused: true,
    };

    let firstBlockId: string;
    try {
        const oref = await RpcApi.CreateBlockCommand(TabRpcClient, firstCreateData);
        // Extract block ID from ORef (format: "block:uuid")
        firstBlockId = oref.startsWith("block:") ? oref.slice(6) : oref;
        console.log("[applyTemplateToExistingTab] Created first block:", firstBlockId);

        // Restore content for first block if present
        if (firstInstruction.content) {
            try {
                const { restoreBlockContent } = await import("./cwtemplate-content");
                await new Promise(resolve => setTimeout(resolve, 100));
                await restoreBlockContent(firstBlockId, firstInstruction.content);
                console.log(`[applyTemplateToExistingTab] Restored content to first block ${firstBlockId}`);
            } catch (contentErr) {
                console.warn(`[applyTemplateToExistingTab] Failed to restore content to first block:`, contentErr);
            }
        }
    } catch (err) {
        console.error("[applyTemplateToExistingTab] Failed to create first block:", err);
        throw err;
    }

    // Small delay to ensure the block is registered
    await new Promise(resolve => setTimeout(resolve, 100));

    // NOW delete existing blocks (the tab won't be deleted because we have the new block)
    // IMPORTANT: Only delete the OLD blocks we captured earlier, NOT the new block we just created
    console.log("[applyTemplateToExistingTab] Deleting", existingBlockIds.length, "existing blocks");

    for (const blockId of existingBlockIds) {
        try {
            await RpcApi.DeleteBlockCommand(TabRpcClient, { blockid: blockId });
        } catch (err) {
            console.warn(`[applyTemplateToExistingTab] Failed to delete block ${blockId}:`, err);
        }
    }

    // Wait for layout to settle after deletions
    await new Promise(resolve => setTimeout(resolve, 200));

    // Create the remaining blocks from the template
    const createdBlockIds: string[] = [firstBlockId];

    for (let i = 1; i < instructions.length; i++) {
        const instruction = instructions[i];
        const createData: CommandCreateBlockData = {
            tabid: tabId,
            blockdef: instruction.blockDef,
            magnified: false,
            focused: false,
        };

        // If this block needs to split from another, set the target
        if (instruction.splitAction && createdBlockIds.length > 0) {
            const targetIndex = instruction.relativeTo ?? createdBlockIds.length - 1;
            createData.targetblockid = createdBlockIds[targetIndex];
            createData.targetaction = instruction.splitAction;
        }

        try {
            const oref = await RpcApi.CreateBlockCommand(TabRpcClient, createData);
            // Extract block ID from ORef (format: "block:uuid")
            const blockId = oref.startsWith("block:") ? oref.slice(6) : oref;
            createdBlockIds.push(blockId);

            // Restore content if present
            if (instruction.content) {
                try {
                    const { restoreBlockContent } = await import("./cwtemplate-content");
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await restoreBlockContent(blockId, instruction.content);
                    console.log(`[applyTemplateToExistingTab] Restored content to block ${blockId}`);
                } catch (contentErr) {
                    console.warn(`[applyTemplateToExistingTab] Failed to restore content to block ${blockId}:`, contentErr);
                }
            }
        } catch (err) {
            console.error(`[applyTemplateToExistingTab] Failed to create block ${i}:`, err);
            throw err;
        }
    }

    console.log("[applyTemplateToExistingTab] Applied template:", template.id, "created", createdBlockIds.length, "blocks");
    return createdBlockIds;
}

/**
 * Generate a unique ID for a custom template
 */
export function generateTemplateId(): string {
    return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Capture the current tab layout and convert it to a template
 *
 * @param tabId - The tab ID to capture
 * @param name - Template name
 * @param description - Template description
 * @param icon - Icon name (FontAwesome)
 * @param options - Optional capture options including content capture
 * @returns A CWLayoutTemplate representing the current layout
 */
export async function captureCurrentLayoutAsTemplate(
    tabId: string,
    name: string,
    description: string,
    icon: string,
    options: CaptureLayoutOptions = {}
): Promise<CWLayoutTemplate> {
    const { RpcApi } = await import("@/app/store/wshclientapi");
    const { TabRpcClient } = await import("@/app/store/wshrpcutil");
    const { globalStore } = await import("@/app/store/jotaiStore");
    const WOS = await import("@/app/store/wos");

    // Get tab data to get layout state
    const tabORef = WOS.makeORef("tab", tabId);
    const tabAtom = WOS.getWaveObjectAtom<Tab>(tabORef);
    const tabData = globalStore.get(tabAtom);

    if (!tabData) {
        // Return a simple terminal-only template as fallback
        return {
            id: generateTemplateId(),
            name,
            description,
            icon,
            layout: {
                type: "block",
                blockType: "term",
            },
        };
    }

    // Get the layout state which contains the actual tree structure
    const layoutStateORef = WOS.makeORef("layout", tabData.layoutstate);
    const layoutStateAtom = WOS.getWaveObjectAtom<LayoutState>(layoutStateORef);
    const layoutState = globalStore.get(layoutStateAtom);

    // Note: The property is 'rootnode' (lowercase) from Go JSON serialization
    if (!layoutState?.rootnode) {
        console.warn("[captureLayout] No rootnode found in layoutState:", layoutState);
        // Fallback to terminal-only
        return {
            id: generateTemplateId(),
            name,
            description,
            icon,
            layout: {
                type: "block",
                blockType: "term",
            },
        };
    }

    // Build a map of blockId -> block meta for looking up block types
    const blockMetaMap: Map<string, any> = new Map();
    const blockIds = tabData.blockids || [];

    for (const blockId of blockIds) {
        try {
            const blockInfo = await RpcApi.BlockInfoCommand(TabRpcClient, blockId);
            if (blockInfo?.block?.meta) {
                blockMetaMap.set(blockId, blockInfo.block.meta);
            }
        } catch (err) {
            console.warn(`[captureLayout] Failed to get block info for ${blockId}:`, err);
        }
    }

    // Log the raw Wave layout tree for debugging
    console.log("[captureLayout] Raw Wave rootnode:", JSON.stringify(layoutState.rootnode, null, 2));
    console.log("[captureLayout] Block meta map:", Array.from(blockMetaMap.entries()));

    // Convert the Wave layout tree to our CWLayoutNode format
    // If includeContent is true, capture content for each block
    const layout = await convertLayoutNodeToCWLayoutAsync(
        layoutState.rootnode,
        blockMetaMap,
        options.includeContent ?? false,
        options.maxTerminalLines
    );

    console.log("[captureLayout] Converted CWLayout:", JSON.stringify(layout, null, 2));

    // Calculate total content size if content was captured
    let totalContentSize = 0;
    let hasContent = false;

    if (options.includeContent) {
        const { calculateTotalContentSize } = await import("./cwtemplate-content");
        const contents = collectContentsFromLayout(layout);
        totalContentSize = calculateTotalContentSize(contents);
        hasContent = contents.some((c) => c != null);
    }

    const template: CWLayoutTemplate = {
        id: generateTemplateId(),
        name,
        description,
        icon,
        layout,
    };

    // Add content metadata if content was captured
    if (options.includeContent) {
        template.hasContent = hasContent;
        template.contentVersion = 1;
        template.totalContentSize = totalContentSize;
    }

    return template;
}

/**
 * Recursively collect all content objects from a layout tree
 */
function collectContentsFromLayout(node: CWLayoutNode): (CWBlockContent | null | undefined)[] {
    const contents: (CWBlockContent | null | undefined)[] = [];

    if (node.type === "block") {
        contents.push(node.content);
    } else if (node.children) {
        for (const child of node.children) {
            contents.push(...collectContentsFromLayout(child));
        }
    }

    return contents;
}

/**
 * Convert a Wave LayoutNode tree to a CWLayoutNode tree (async version with content capture)
 * This preserves the actual split structure including vertical stacks
 * Note: Go JSON serialization uses lowercase property names (flexdirection, not flexDirection)
 */
async function convertLayoutNodeToCWLayoutAsync(
    node: any,
    blockMetaMap: Map<string, any>,
    includeContent: boolean,
    maxTerminalLines?: number
): Promise<CWLayoutNode> {
    // Leaf node - has data with blockId (Go uses lowercase: blockid)
    const blockId = node.data?.blockid || node.data?.blockId;
    if (blockId) {
        const meta = blockMetaMap.get(blockId);
        return blockMetaToLayoutNodeAsync(blockId, meta, includeContent, maxTerminalLines);
    }

    // Split node - has children
    if (node.children && node.children.length > 0) {
        // Determine direction from flexDirection (Go uses lowercase: flexdirection)
        // Row = horizontal split, Column = vertical split (stack)
        const flexDir = node.flexdirection || node.flexDirection;
        const isHorizontal = flexDir === "row";

        if (node.children.length === 1) {
            // Single child - recurse into it
            return convertLayoutNodeToCWLayoutAsync(node.children[0], blockMetaMap, includeContent, maxTerminalLines);
        }

        if (node.children.length === 2) {
            // Binary split - calculate ratio from sizes
            const totalSize = node.children[0].size + node.children[1].size;
            const ratio = node.children[0].size / totalSize;

            const [child1, child2] = await Promise.all([
                convertLayoutNodeToCWLayoutAsync(node.children[0], blockMetaMap, includeContent, maxTerminalLines),
                convertLayoutNodeToCWLayoutAsync(node.children[1], blockMetaMap, includeContent, maxTerminalLines),
            ]);

            return {
                type: "split",
                direction: isHorizontal ? "horizontal" : "vertical",
                ratio: ratio,
                children: [child1, child2],
            };
        }

        // More than 2 children - create nested binary splits
        return buildNestedSplitsAsync(node.children, isHorizontal, blockMetaMap, includeContent, maxTerminalLines);
    }

    // Fallback to terminal block
    return { type: "block", blockType: "term" };
}

/**
 * Build nested binary splits from an array of children (async version)
 */
async function buildNestedSplitsAsync(
    children: any[],
    isHorizontal: boolean,
    blockMetaMap: Map<string, any>,
    includeContent: boolean,
    maxTerminalLines?: number
): Promise<CWLayoutNode> {
    if (children.length === 0) {
        return { type: "block", blockType: "term" };
    }

    if (children.length === 1) {
        return convertLayoutNodeToCWLayoutAsync(children[0], blockMetaMap, includeContent, maxTerminalLines);
    }

    if (children.length === 2) {
        const totalSize = children[0].size + children[1].size;
        const ratio = children[0].size / totalSize;

        const [child1, child2] = await Promise.all([
            convertLayoutNodeToCWLayoutAsync(children[0], blockMetaMap, includeContent, maxTerminalLines),
            convertLayoutNodeToCWLayoutAsync(children[1], blockMetaMap, includeContent, maxTerminalLines),
        ]);

        return {
            type: "split",
            direction: isHorizontal ? "horizontal" : "vertical",
            ratio: ratio,
            children: [child1, child2],
        };
    }

    // For 3+ children, create a nested structure
    const firstChild = children[0];
    const restChildren = children.slice(1);

    const totalSize = children.reduce((sum, c) => sum + c.size, 0);
    const firstRatio = firstChild.size / totalSize;

    const [convertedFirst, convertedRest] = await Promise.all([
        convertLayoutNodeToCWLayoutAsync(firstChild, blockMetaMap, includeContent, maxTerminalLines),
        buildNestedSplitsAsync(restChildren, isHorizontal, blockMetaMap, includeContent, maxTerminalLines),
    ]);

    return {
        type: "split",
        direction: isHorizontal ? "horizontal" : "vertical",
        ratio: firstRatio,
        children: [convertedFirst, convertedRest],
    };
}

/**
 * Convert block metadata to a CWLayoutNode (async version with content capture)
 */
async function blockMetaToLayoutNodeAsync(
    blockId: string,
    meta: any,
    includeContent: boolean,
    maxTerminalLines?: number
): Promise<CWLayoutNode> {
    const viewType = meta?.view || "term";
    const node: CWLayoutNode = {
        type: "block",
        blockType: viewType,
    };

    // Preserve relevant metadata
    const blockMeta: Record<string, any> = {};

    // For file browser, preserve the path type but not the actual path
    if (viewType === "preview" && meta?.["file:path"]) {
        blockMeta["file:path"] = ".";
    }

    // For web blocks, preserve the URL
    if (viewType === "web" && meta?.url) {
        blockMeta.url = meta.url;
    }

    if (Object.keys(blockMeta).length > 0) {
        node.blockMeta = blockMeta;
    }

    // Capture content if requested
    if (includeContent) {
        try {
            const { captureBlockContent } = await import("./cwtemplate-content");
            const content = await captureBlockContent(blockId, viewType, meta, { maxTerminalLines });
            if (content) {
                node.content = content;
            }
        } catch (err) {
            console.warn(`[blockMetaToLayoutNodeAsync] Failed to capture content for block ${blockId}:`, err);
        }
    }

    return node;
}

/**
 * Convert a Wave LayoutNode tree to a CWLayoutNode tree
 * This preserves the actual split structure including vertical stacks
 * Note: Go JSON serialization uses lowercase property names (flexdirection, not flexDirection)
 */
function convertLayoutNodeToCWLayout(
    node: any, // Using any because Go JSON uses lowercase props
    blockMetaMap: Map<string, any>
): CWLayoutNode {
    // Leaf node - has data with blockId (Go uses lowercase: blockid)
    const blockId = node.data?.blockid || node.data?.blockId;
    if (blockId) {
        const meta = blockMetaMap.get(blockId);
        return blockMetaToLayoutNode(meta);
    }

    // Split node - has children
    if (node.children && node.children.length > 0) {
        // Determine direction from flexDirection (Go uses lowercase: flexdirection)
        // Row = horizontal split, Column = vertical split (stack)
        const flexDir = node.flexdirection || node.flexDirection;
        const isHorizontal = flexDir === "row";

        if (node.children.length === 1) {
            // Single child - recurse into it
            return convertLayoutNodeToCWLayout(node.children[0], blockMetaMap);
        }

        if (node.children.length === 2) {
            // Binary split - calculate ratio from sizes
            const totalSize = node.children[0].size + node.children[1].size;
            const ratio = node.children[0].size / totalSize;

            return {
                type: "split",
                direction: isHorizontal ? "horizontal" : "vertical",
                ratio: ratio,
                children: [
                    convertLayoutNodeToCWLayout(node.children[0], blockMetaMap),
                    convertLayoutNodeToCWLayout(node.children[1], blockMetaMap),
                ],
            };
        }

        // More than 2 children - create nested binary splits
        // This handles cases like 3+ stacked blocks
        return buildNestedSplits(node.children, isHorizontal, blockMetaMap);
    }

    // Fallback to terminal block
    return { type: "block", blockType: "term" };
}

/**
 * Build nested binary splits from an array of children
 * Converts [A, B, C] into a tree structure that preserves the linear arrangement
 */
function buildNestedSplits(
    children: any[], // Using any because Go JSON uses lowercase props
    isHorizontal: boolean,
    blockMetaMap: Map<string, any>
): CWLayoutNode {
    if (children.length === 0) {
        return { type: "block", blockType: "term" };
    }

    if (children.length === 1) {
        return convertLayoutNodeToCWLayout(children[0], blockMetaMap);
    }

    if (children.length === 2) {
        const totalSize = children[0].size + children[1].size;
        const ratio = children[0].size / totalSize;

        return {
            type: "split",
            direction: isHorizontal ? "horizontal" : "vertical",
            ratio: ratio,
            children: [
                convertLayoutNodeToCWLayout(children[0], blockMetaMap),
                convertLayoutNodeToCWLayout(children[1], blockMetaMap),
            ],
        };
    }

    // For 3+ children, create a nested structure
    // First child vs rest of children
    const firstChild = children[0];
    const restChildren = children.slice(1);

    // Calculate sizes
    const totalSize = children.reduce((sum, c) => sum + c.size, 0);
    const firstRatio = firstChild.size / totalSize;

    return {
        type: "split",
        direction: isHorizontal ? "horizontal" : "vertical",
        ratio: firstRatio,
        children: [
            convertLayoutNodeToCWLayout(firstChild, blockMetaMap),
            buildNestedSplits(restChildren, isHorizontal, blockMetaMap),
        ],
    };
}

/**
 * Convert block metadata to a CWLayoutNode
 */
function blockMetaToLayoutNode(meta: any): CWLayoutNode {
    const viewType = meta?.view || "term";
    const node: CWLayoutNode = {
        type: "block",
        blockType: viewType,
    };

    // Preserve relevant metadata
    const blockMeta: Record<string, any> = {};

    // For file browser, preserve the path type but not the actual path
    if (viewType === "preview" && meta?.["file:path"]) {
        // Use "." to indicate current directory (will be resolved at apply time)
        blockMeta["file:path"] = ".";
    }

    if (Object.keys(blockMeta).length > 0) {
        node.blockMeta = blockMeta;
    }

    return node;
}
