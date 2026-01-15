// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import clsx from "clsx";
import React from "react";
import { CW_LAYOUT_TEMPLATES, CWLayoutTemplate, DEFAULT_TEMPLATE } from "./cwtemplates";
import "./layouttemplateselector.scss";

interface LayoutTemplateSelectorProps {
    selectedTemplateId?: string;
    onSelectTemplate: (template: CWLayoutTemplate) => void;
    showDefault?: boolean;
}

export const LayoutTemplateSelector: React.FC<LayoutTemplateSelectorProps> = ({
    selectedTemplateId,
    onSelectTemplate,
    showDefault = true,
}) => {
    const effectiveSelectedId = selectedTemplateId || DEFAULT_TEMPLATE.id;

    return (
        <div className="layout-template-selector">
            {showDefault && (
                <div className="template-section-label">Layout Templates</div>
            )}
            <div className="template-grid">
                {CW_LAYOUT_TEMPLATES.map((template) => (
                    <div
                        key={template.id}
                        className={clsx("template-card", {
                            selected: template.id === effectiveSelectedId,
                        })}
                        onClick={() => onSelectTemplate(template)}
                    >
                        <div className="template-thumbnail">
                            <TemplateThumbnail template={template} />
                        </div>
                        <div className="template-info">
                            <div className="template-name">
                                <i className={`fa fa-${template.icon}`} />
                                {template.name}
                            </div>
                            <div className="template-description">
                                {template.description}
                            </div>
                        </div>
                        {template.id === DEFAULT_TEMPLATE.id && (
                            <div className="template-badge">Default</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface TemplateThumbnailProps {
    template: CWLayoutTemplate;
}

const TemplateThumbnail: React.FC<TemplateThumbnailProps> = ({ template }) => {
    // Render a visual representation of the layout
    return (
        <div className="thumbnail-container">
            <LayoutNodeThumbnail node={template.layout} />
        </div>
    );
};

interface LayoutNodeThumbnailProps {
    node: CWLayoutTemplate["layout"];
}

const LayoutNodeThumbnail: React.FC<LayoutNodeThumbnailProps> = ({ node }) => {
    if (node.type === "block") {
        const blockClass = node.blockType || "term";
        return (
            <div className={clsx("thumbnail-block", blockClass)}>
                <i className={`fa fa-${getBlockIcon(node.blockType)}`} />
            </div>
        );
    }

    if (node.type === "split" && node.children) {
        const ratio = node.ratio || 0.5;
        const firstSize = `${ratio * 100}%`;
        const secondSize = `${(1 - ratio) * 100}%`;
        const isHorizontal = node.direction === "horizontal";

        return (
            <div
                className={clsx("thumbnail-split", {
                    horizontal: isHorizontal,
                    vertical: !isHorizontal,
                })}
            >
                {node.children.map((child, index) => (
                    <div
                        key={index}
                        className="thumbnail-split-child"
                        style={{
                            [isHorizontal ? "width" : "height"]:
                                index === 0 ? firstSize : secondSize,
                        }}
                    >
                        <LayoutNodeThumbnail node={child} />
                    </div>
                ))}
            </div>
        );
    }

    return null;
};

function getBlockIcon(blockType?: string): string {
    switch (blockType) {
        case "term":
            return "terminal";
        case "preview":
            return "file";
        case "web":
            return "globe";
        default:
            return "square";
    }
}

export default LayoutTemplateSelector;
