// Copyright 2025, Gregg Coppen
// SPDX-License-Identifier: Apache-2.0

package tiltservice

import (
	"context"

	"github.com/greggcoppen/claudewave/app/pkg/cwtilt"
)

type TiltService struct{}

var TiltServiceInstance = &TiltService{}

func (ts *TiltService) Start(ctx context.Context) error {
	manager := cwtilt.GetTiltManager()
	return manager.Start(ctx)
}

func (ts *TiltService) Stop(ctx context.Context) error {
	manager := cwtilt.GetTiltManager()
	return manager.Stop(ctx)
}

func (ts *TiltService) Status(ctx context.Context) *cwtilt.HubStatus {
	manager := cwtilt.GetTiltManager()
	return manager.GetHubStatus()
}
