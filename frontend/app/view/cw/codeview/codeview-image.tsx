// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

/**
 * Code View Image - Image preview component for the Code View pane
 */

import { Button } from "@/app/element/button";
import { getWebServerEndpoint } from "@/util/endpoints";
import { formatRemoteUri } from "@/util/waveutil";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";

interface CodeViewImageProps {
    filePath: string;
    connection: string;
    mimeType: string;
}

function ImageZoomControls() {
    const { zoomIn, zoomOut, resetTransform } = useControls();

    return (
        <div className="codeview-image-controls">
            <Button onClick={() => zoomIn()} title="Zoom In" className="py-1 px-[5px]">
                <i className="fa-sharp fa-plus" />
            </Button>
            <Button onClick={() => zoomOut()} title="Zoom Out" className="py-1 px-[5px]">
                <i className="fa-sharp fa-minus" />
            </Button>
            <Button onClick={() => resetTransform()} title="Reset Zoom" className="py-1 px-[5px]">
                <i className="fa-sharp fa-rotate-left" />
            </Button>
        </div>
    );
}

export function CodeViewImage({ filePath, connection, mimeType }: CodeViewImageProps) {
    // Build streaming URL for the image
    const remotePath = formatRemoteUri(filePath, connection);
    const usp = new URLSearchParams();
    usp.set("path", remotePath);
    if (connection) {
        usp.set("connection", connection);
    }
    const streamingUrl = `${getWebServerEndpoint()}/wave/stream-file?${usp.toString()}`;

    // SVG files can be displayed directly
    if (mimeType === "image/svg+xml") {
        return (
            <div className="codeview-image-container">
                <TransformWrapper initialScale={1} centerOnInit pinch={{ step: 10 }}>
                    {() => (
                        <>
                            <ImageZoomControls />
                            <TransformComponent wrapperClass="!h-full !w-full">
                                <img
                                    src={streamingUrl}
                                    alt={filePath}
                                    className="codeview-image"
                                />
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            </div>
        );
    }

    // Standard image display with zoom controls
    return (
        <div className="codeview-image-container">
            <TransformWrapper initialScale={1} centerOnInit pinch={{ step: 10 }}>
                {() => (
                    <>
                        <ImageZoomControls />
                        <TransformComponent wrapperClass="!h-full !w-full">
                            <img
                                src={streamingUrl}
                                alt={filePath}
                                className="codeview-image"
                            />
                        </TransformComponent>
                    </>
                )}
            </TransformWrapper>
        </div>
    );
}
