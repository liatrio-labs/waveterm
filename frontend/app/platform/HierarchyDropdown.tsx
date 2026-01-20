// Copyright 2025, Liatrio
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect } from "react";
import { useAtomValue } from "jotai";
import {
    platformProjectsAtom,
    platformProjectsLoadingAtom,
    platformSelectedProjectIdAtom,
    platformProductsAtom,
    platformProductsLoadingAtom,
    platformSelectedProductIdAtom,
    platformPRDsAtom,
    platformPRDsLoadingAtom,
    platformSelectedPRDIdAtom,
    platformSpecsAtom,
    platformSpecsLoadingAtom,
    platformSelectedSpecIdAtom,
    platformIsAuthenticatedAtom,
    selectPlatformProject,
    selectPlatformProduct,
    selectPlatformPRD,
    selectPlatformSpec,
    loadPlatformProjects,
} from "@/app/store/platformatoms";

import "./HierarchyDropdown.scss";

export const HierarchyDropdown: React.FC = () => {
    const isAuthenticated = useAtomValue(platformIsAuthenticatedAtom);

    const projects = useAtomValue(platformProjectsAtom);
    const projectsLoading = useAtomValue(platformProjectsLoadingAtom);
    const selectedProjectId = useAtomValue(platformSelectedProjectIdAtom);

    const products = useAtomValue(platformProductsAtom);
    const productsLoading = useAtomValue(platformProductsLoadingAtom);
    const selectedProductId = useAtomValue(platformSelectedProductIdAtom);

    const prds = useAtomValue(platformPRDsAtom);
    const prdsLoading = useAtomValue(platformPRDsLoadingAtom);
    const selectedPRDId = useAtomValue(platformSelectedPRDIdAtom);

    const specs = useAtomValue(platformSpecsAtom);
    const specsLoading = useAtomValue(platformSpecsLoadingAtom);
    const selectedSpecId = useAtomValue(platformSelectedSpecIdAtom);

    // Load projects when authenticated
    useEffect(() => {
        if (isAuthenticated && projects.length === 0) {
            loadPlatformProjects();
        }
    }, [isAuthenticated, projects.length]);

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const projectId = e.target.value || null;
        selectPlatformProject(projectId);
    };

    const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const productId = e.target.value || null;
        selectPlatformProduct(productId);
    };

    const handlePRDChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const prdId = e.target.value || null;
        selectPlatformPRD(prdId);
    };

    const handleSpecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const specId = e.target.value || null;
        selectPlatformSpec(specId);
    };

    if (!isAuthenticated) {
        return (
            <div className="hierarchy-dropdown hierarchy-dropdown--disabled">
                <span className="hierarchy-dropdown__message">Connect to browse projects</span>
            </div>
        );
    }

    return (
        <div className="hierarchy-dropdown">
            {/* Project Selector */}
            <div className="hierarchy-dropdown__level">
                <label className="hierarchy-dropdown__label">Project</label>
                <select
                    className="hierarchy-dropdown__select"
                    value={selectedProjectId ?? ""}
                    onChange={handleProjectChange}
                    disabled={projectsLoading}
                >
                    <option value="">
                        {projectsLoading ? "Loading..." : "Select project..."}
                    </option>
                    {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                            {project.name}
                        </option>
                    ))}
                </select>
                {projectsLoading && <span className="hierarchy-dropdown__spinner" />}
            </div>

            {/* Product Selector */}
            <div className="hierarchy-dropdown__level">
                <label className="hierarchy-dropdown__label">Product</label>
                <select
                    className="hierarchy-dropdown__select"
                    value={selectedProductId ?? ""}
                    onChange={handleProductChange}
                    disabled={!selectedProjectId || productsLoading}
                >
                    <option value="">
                        {productsLoading ? "Loading..." : !selectedProjectId ? "Select project first" : "Select product..."}
                    </option>
                    {products.map((product) => (
                        <option key={product.id} value={product.id}>
                            {product.name}
                        </option>
                    ))}
                </select>
                {productsLoading && <span className="hierarchy-dropdown__spinner" />}
            </div>

            {/* PRD Selector */}
            <div className="hierarchy-dropdown__level">
                <label className="hierarchy-dropdown__label">PRD</label>
                <select
                    className="hierarchy-dropdown__select"
                    value={selectedPRDId ?? ""}
                    onChange={handlePRDChange}
                    disabled={!selectedProductId || prdsLoading}
                >
                    <option value="">
                        {prdsLoading ? "Loading..." : !selectedProductId ? "Select product first" : "Select PRD..."}
                    </option>
                    {prds.map((prd) => (
                        <option key={prd.id} value={prd.id}>
                            {prd.name}
                        </option>
                    ))}
                </select>
                {prdsLoading && <span className="hierarchy-dropdown__spinner" />}
            </div>

            {/* Spec Selector */}
            <div className="hierarchy-dropdown__level">
                <label className="hierarchy-dropdown__label">Spec</label>
                <select
                    className="hierarchy-dropdown__select"
                    value={selectedSpecId ?? ""}
                    onChange={handleSpecChange}
                    disabled={!selectedPRDId || specsLoading}
                >
                    <option value="">
                        {specsLoading ? "Loading..." : !selectedPRDId ? "Select PRD first" : "Select spec..."}
                    </option>
                    {specs.map((spec) => (
                        <option key={spec.id} value={spec.id}>
                            {spec.name}
                        </option>
                    ))}
                </select>
                {specsLoading && <span className="hierarchy-dropdown__spinner" />}
            </div>
        </div>
    );
};
