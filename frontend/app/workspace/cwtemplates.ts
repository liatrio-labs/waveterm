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
}

/**
 * Get a shortened path for display (last 2 path components)
 */
function getShortPath(fullPath: string): string {
    const parts = fullPath.split('/');
    return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : fullPath;
}

/**
 * Flatten a layout node into creation instructions
 * This handles nested splits by converting them into sequential block creations
 *
 * @param node - The layout node to flatten
 * @param worktreePath - Optional worktree path for terminal/file browser blocks
 * @param baseIndex - The base index in the overall instructions array (for relativeTo references)
 * @param sessionInfo - Optional session info for frame title display
 * @returns Array of creation instructions with correct relativeTo indices
 */
function flattenLayoutNode(
    node: CWLayoutNode,
    worktreePath?: string,
    baseIndex: number = 0,
    sessionInfo?: CWSessionInfo
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

        // Add frame metadata for terminal blocks if session info provided
        if (node.blockType === "term" && sessionInfo) {
            meta["frame:title"] = sessionInfo.branchName || sessionInfo.name;
            if (worktreePath) {
                meta["frame:text"] = getShortPath(worktreePath);
            }
        }

        return [{ blockDef: { meta } }];
    }

    if (node.type === "split" && node.children && node.children.length >= 2) {
        const instructions: BlockCreationInstruction[] = [];
        const isHorizontal = node.direction === "horizontal";

        // First child becomes the base block(s)
        const firstChildInstructions = flattenLayoutNode(node.children[0], worktreePath, baseIndex, sessionInfo);
        instructions.push(...firstChildInstructions);

        // Track the index of the last block in the first child group - this is the split target
        const firstChildLastBlockIndex = baseIndex + firstChildInstructions.length - 1;

        // Second child splits from the last block of the first child
        const secondChildBaseIndex = baseIndex + firstChildInstructions.length;
        const secondChildInstructions = flattenLayoutNode(node.children[1], worktreePath, secondChildBaseIndex, sessionInfo);

        if (secondChildInstructions.length > 0) {
            // The first instruction of the second child gets the split action
            // It should split from the last block of the first child
            secondChildInstructions[0].splitAction = isHorizontal ? "splitright" : "splitdown";
            secondChildInstructions[0].relativeTo = firstChildLastBlockIndex;
        }
        instructions.push(...secondChildInstructions);

        return instructions;
    }

    // Fallback to terminal block
    return [{ blockDef: { meta: { view: "term", controller: "shell" } } }];
}

/**
 * Session info for frame title display
 */
export interface CWSessionInfo {
    name: string;
    branchName: string;
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
                blockId = oref.oid;
            } else {
                // Dynamic import to avoid circular dependencies
                const { RpcApi } = await import("@/app/store/wshclientapi");
                const { TabRpcClient } = await import("@/app/store/wshrpcutil");
                const oref = await RpcApi.CreateBlockCommand(TabRpcClient, createData);
                blockId = oref.oid;
            }
            createdBlockIds.push(blockId);

            // Track the first terminal block for auto-start
            if (!firstTermBlockId && instruction.blockDef.meta?.view === "term") {
                firstTermBlockId = blockId;
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
        firstBlockId = oref.oid;
        console.log("[applyTemplateToExistingTab] Created first block:", firstBlockId);
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
            createdBlockIds.push(oref.oid);
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
 * @returns A CWLayoutTemplate representing the current layout
 */
export async function captureCurrentLayoutAsTemplate(
    tabId: string,
    name: string,
    description: string,
    icon: string
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
    const layout = convertLayoutNodeToCWLayout(layoutState.rootnode, blockMetaMap);

    console.log("[captureLayout] Converted CWLayout:", JSON.stringify(layout, null, 2));

    return {
        id: generateTemplateId(),
        name,
        description,
        icon,
        layout,
    };
}

/**
 * Convert a Wave LayoutNode tree to a CWLayoutNode tree
 * This preserves the actual split structure including vertical stacks
 */
function convertLayoutNodeToCWLayout(
    node: LayoutNode,
    blockMetaMap: Map<string, any>
): CWLayoutNode {
    // Leaf node - has data with blockId
    if (node.data?.blockId) {
        const meta = blockMetaMap.get(node.data.blockId);
        return blockMetaToLayoutNode(meta);
    }

    // Split node - has children
    if (node.children && node.children.length > 0) {
        // Determine direction from flexDirection
        // Row = horizontal split, Column = vertical split (stack)
        const isHorizontal = node.flexDirection === "row";

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
    children: LayoutNode[],
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
