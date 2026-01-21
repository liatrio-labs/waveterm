import { fireAndForget, makeIconClass } from "@/util/util";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { memo, useEffect, useRef, useState } from "react";
import { Button } from "../element/button";
import { Input } from "../element/input";
import { atoms, globalStore } from "../store/global";
import { ObjectService, WorkspaceService } from "../store/services";
import { makeORef } from "../store/wos";
import "./workspaceeditor.scss";

interface ColorSelectorProps {
    colors: string[];
    selectedColor?: string;
    onSelect: (color: string) => void;
    className?: string;
}

const ColorSelector = memo(({ colors, selectedColor, onSelect, className }: ColorSelectorProps) => {
    const handleColorClick = (color: string) => {
        onSelect(color);
    };

    return (
        <div className={clsx("color-selector", className)}>
            {colors.map((color) => (
                <div
                    key={color}
                    className={clsx("color-circle", { selected: selectedColor === color })}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorClick(color)}
                />
            ))}
        </div>
    );
});

interface IconSelectorProps {
    icons: string[];
    selectedIcon?: string;
    onSelect: (icon: string) => void;
    className?: string;
}

const IconSelector = memo(({ icons, selectedIcon, onSelect, className }: IconSelectorProps) => {
    const handleIconClick = (icon: string) => {
        onSelect(icon);
    };

    return (
        <div className={clsx("icon-selector", className)}>
            {icons.map((icon) => {
                const iconClass = makeIconClass(icon, true);
                return (
                    <i
                        key={icon}
                        className={clsx(iconClass, "icon-item", { selected: selectedIcon === icon })}
                        onClick={() => handleIconClick(icon)}
                    />
                );
            })}
        </div>
    );
});

interface BackgroundPreset {
    key: string;
    name: string;
    bg?: string;
    opacity?: number;
}

interface BackgroundSelectorProps {
    presets: BackgroundPreset[];
    selectedBg?: string;
    onSelect: (presetKey: string) => void;
    className?: string;
}

const BackgroundSelector = memo(({ presets, selectedBg, onSelect, className }: BackgroundSelectorProps) => {
    return (
        <div className={clsx("background-selector", className)}>
            {presets.map((preset) => {
                const isSelected = selectedBg === preset.bg;
                const bgStyle: React.CSSProperties = preset.bg
                    ? { background: preset.bg, opacity: preset.opacity ?? 0.85 }
                    : {};
                return (
                    <div
                        key={preset.key}
                        className={clsx("background-item", { selected: isSelected })}
                        style={bgStyle}
                        onClick={() => onSelect(preset.key)}
                        title={preset.name}
                    >
                        {!preset.bg && <span className="none-label">None</span>}
                    </div>
                );
            })}
        </div>
    );
});

interface WorkspaceEditorProps {
    workspaceId: string;
    title: string;
    icon: string;
    color: string;
    currentBg?: string;
    currentOpacity?: number;
    focusInput: boolean;
    onTitleChange: (newTitle: string) => void;
    onColorChange: (newColor: string) => void;
    onIconChange: (newIcon: string) => void;
    onDeleteWorkspace: () => void;
}
const WorkspaceEditorComponent = ({
    workspaceId,
    title,
    icon,
    color,
    currentBg,
    currentOpacity,
    focusInput,
    onTitleChange,
    onColorChange,
    onIconChange,
    onDeleteWorkspace,
}: WorkspaceEditorProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const fullConfig = useAtomValue(atoms.fullConfigAtom);

    const [colors, setColors] = useState<string[]>([]);
    const [icons, setIcons] = useState<string[]>([]);
    const [bgPresets, setBgPresets] = useState<BackgroundPreset[]>([]);
    const [opacity, setOpacity] = useState<number>(currentOpacity ?? 0.5);

    useEffect(() => {
        fireAndForget(async () => {
            const colors = await WorkspaceService.GetColors();
            const icons = await WorkspaceService.GetIcons();
            setColors(colors);
            setIcons(icons);
        });
    }, []);

    useEffect(() => {
        // Load background presets from config
        const presets: BackgroundPreset[] = [
            { key: "default", name: "None", bg: undefined, opacity: undefined },
        ];
        const presetKeys: string[] = [];
        for (const key in fullConfig?.presets ?? {}) {
            if (key.startsWith("bg@")) {
                presetKeys.push(key);
            }
        }
        presetKeys.sort((a, b) => {
            const aOrder = fullConfig.presets[a]["display:order"] ?? 0;
            const bOrder = fullConfig.presets[b]["display:order"] ?? 0;
            return aOrder - bOrder;
        });
        for (const key of presetKeys) {
            const preset = fullConfig.presets[key];
            if (preset) {
                presets.push({
                    key,
                    name: preset["display:name"] ?? key,
                    bg: preset["bg"],
                    opacity: preset["bg:opacity"],
                });
            }
        }
        setBgPresets(presets);
    }, [fullConfig]);

    useEffect(() => {
        if (focusInput && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [focusInput]);

    // Update local opacity when prop changes
    useEffect(() => {
        if (currentOpacity !== undefined) {
            setOpacity(currentOpacity);
        }
    }, [currentOpacity]);

    const handleBackgroundSelect = (presetKey: string) => {
        const oref = makeORef("workspace", workspaceId);
        if (presetKey === "default") {
            // Clear background by setting bg:* to true (clears all bg properties)
            fireAndForget(() => ObjectService.UpdateObjectMeta(oref, { "bg:*": true }));
        } else {
            const preset = fullConfig?.presets?.[presetKey];
            if (preset) {
                // Apply the preset and update local opacity
                const presetOpacity = preset["bg:opacity"] ?? 0.5;
                setOpacity(presetOpacity);
                fireAndForget(() => ObjectService.UpdateObjectMeta(oref, preset));
            }
        }
    };

    const handleOpacityChange = (newOpacity: number) => {
        setOpacity(newOpacity);
        const oref = makeORef("workspace", workspaceId);
        fireAndForget(() => ObjectService.UpdateObjectMeta(oref, { "bg:opacity": newOpacity }));
    };

    const hasBackground = !!currentBg;

    return (
        <div className="workspace-editor">
            <Input
                ref={inputRef}
                className={clsx("py-[3px]", { error: title === "" })}
                onChange={onTitleChange}
                value={title}
                autoFocus
                autoSelect
            />
            <ColorSelector selectedColor={color} colors={colors} onSelect={onColorChange} />
            <IconSelector selectedIcon={icon} icons={icons} onSelect={onIconChange} />
            <div className="background-section">
                <div className="section-label">Background</div>
                <BackgroundSelector
                    presets={bgPresets}
                    selectedBg={currentBg}
                    onSelect={handleBackgroundSelect}
                />
                {hasBackground && (
                    <div className="opacity-slider-container">
                        <label className="opacity-label">Opacity</label>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={opacity}
                            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                            className="opacity-slider"
                        />
                        <span className="opacity-value">{Math.round(opacity * 100)}%</span>
                    </div>
                )}
            </div>
            <div className="delete-ws-btn-wrapper">
                <Button className="ghost red text-[12px] bold" onClick={onDeleteWorkspace}>
                    Delete workspace
                </Button>
            </div>
        </div>
    );
};

export const WorkspaceEditor = memo(WorkspaceEditorComponent) as typeof WorkspaceEditorComponent;
