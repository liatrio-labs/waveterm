// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

/**
 * Platform View Model
 * Registers TaskPanel as a Wave block type for viewing platform tasks
 */

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { WOS } from "@/store/global";
import { atom } from "jotai";
import * as React from "react";
import { TaskPanel } from "./TaskPanel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { refreshPlatformData } from "@/app/store/platformatoms";

// ============================================================================
// View Model
// ============================================================================

class PlatformViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    viewText: jotai.Atom<string>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "platform";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);

        this.viewIcon = atom("fa-cloud");
        this.viewName = atom("Platform");
        this.viewText = atom("Agentic Platform Tasks");
    }

    get viewComponent(): ViewComponent {
        return PlatformView;
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        return [
            {
                label: "Refresh Tasks",
                click: async () => {
                    // Trigger full platform data refresh using configured teamId
                    try {
                        await refreshPlatformData();
                    } catch (err) {
                        console.error("[Platform] Refresh failed:", err);
                    }
                },
            },
            {
                label: "Platform Settings",
                click: () => {
                    // Open settings view with platform category
                    // This will be implemented when settings category is added
                },
            },
        ];
    }
}

// ============================================================================
// View Component
// ============================================================================

interface PlatformViewProps {
    model: PlatformViewModel;
    blockRef: React.RefObject<HTMLDivElement>;
}

function PlatformView({ model, blockRef }: PlatformViewProps) {
    const handleConnectClick = async () => {
        // Prompt user to run wsh platform login
        console.log("[Platform] Connect clicked - user should run 'wsh platform login'");
    };

    const handleLinkToWorktree = async (taskId: string) => {
        try {
            await RpcApi.PlatformLinkCommand(TabRpcClient, {
                taskid: taskId,
                worktreedir: "",
                force: false,
            });
        } catch (err) {
            console.error("[Platform] Link failed:", err);
        }
    };

    return (
        <div className="platform-view" ref={blockRef}>
            <TaskPanel
                onConnectClick={handleConnectClick}
                onLinkToWorktree={handleLinkToWorktree}
            />
        </div>
    );
}

export { PlatformViewModel };
