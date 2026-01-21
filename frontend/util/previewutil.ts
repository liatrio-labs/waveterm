import { createBlock, getApi } from "@/app/store/global";
import {
    canOpenInCodeView,
    openFileInNewCodeView,
    openFileInExistingCodeView,
    openFileReplaceWithCodeView,
} from "@/app/store/cwcodeviewstate";
import { makeNativeLabel } from "./platformutil";
import { fireAndForget } from "./util";
import { formatRemoteUri } from "./waveutil";

export function addOpenMenuItems(menu: ContextMenuItem[], conn: string, finfo: FileInfo): ContextMenuItem[] {
    if (!finfo) {
        return menu;
    }
    menu.push({
        type: "separator",
    });
    if (!conn) {
        // TODO:  resolve correct host path if connection is WSL
        // if the entry is a directory, reveal it in the file manager, if the entry is a file, reveal its parent directory
        menu.push({
            label: makeNativeLabel(true),
            click: () => {
                getApi().openNativePath(finfo.isdir ? finfo.path : finfo.dir);
            },
        });
        // if the entry is a file, open it in the default application
        if (!finfo.isdir) {
            menu.push({
                label: makeNativeLabel(false),
                click: () => {
                    getApi().openNativePath(finfo.path);
                },
            });
        }
    } else {
        menu.push({
            label: "Download File",
            click: () => {
                const remoteUri = formatRemoteUri(finfo.path, conn);
                getApi().downloadFile(remoteUri);
            },
        });
    }
    menu.push({
        type: "separator",
    });
    if (!finfo.isdir) {
        menu.push({
            label: "Open Preview in New Block",
            click: () =>
                fireAndForget(async () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "preview",
                            file: finfo.path,
                            connection: conn,
                        },
                    };
                    await createBlock(blockDef);
                }),
        });

        // Add "Open in Code View" option for text files and images
        if (canOpenInCodeView(finfo)) {
            menu.push({
                label: "Open in Code View",
                submenu: [
                    {
                        label: "Open in Existing Code View",
                        click: () => openFileInExistingCodeView(finfo.path, conn),
                    },
                    {
                        label: "New Code View Block",
                        click: () => openFileInNewCodeView(finfo.path, conn),
                    },
                    {
                        label: "Replace Current Block",
                        click: () => openFileReplaceWithCodeView(finfo.path, conn),
                    },
                ],
            });
        }
    }
    // TODO: improve behavior as we add more connection types
    if (!conn?.startsWith("aws:")) {
        menu.push({
            label: "Open Terminal Here",
            click: () => {
                const termBlockDef: BlockDef = {
                    meta: {
                        controller: "shell",
                        view: "term",
                        "cmd:cwd": finfo.isdir ? finfo.path : finfo.dir,
                        connection: conn,
                    },
                };
                fireAndForget(() => createBlock(termBlockDef));
            },
        });
    }
    return menu;
}
