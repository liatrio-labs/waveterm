// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"fmt"
	"os"
	"reflect"
	"strings"

	"github.com/greggcoppen/claudewave/app/pkg/gogen"
	"github.com/greggcoppen/claudewave/app/pkg/util/utilfn"
	"github.com/greggcoppen/claudewave/app/pkg/waveobj"
	"github.com/greggcoppen/claudewave/app/pkg/wconfig"
	"github.com/greggcoppen/claudewave/app/pkg/wshrpc"
)

const WshClientFileName = "pkg/wshrpc/wshclient/wshclient.go"
const WaveObjMetaConstsFileName = "pkg/waveobj/metaconsts.go"
const SettingsMetaConstsFileName = "pkg/wconfig/metaconsts.go"

func GenerateWshClient() error {
	fmt.Fprintf(os.Stderr, "generating wshclient file to %s\n", WshClientFileName)
	var buf strings.Builder
	gogen.GenerateBoilerplate(&buf, "wshclient", []string{
		"github.com/greggcoppen/claudewave/app/pkg/telemetry/telemetrydata",
		"github.com/greggcoppen/claudewave/app/pkg/wshutil",
		"github.com/greggcoppen/claudewave/app/pkg/wshrpc",
		"github.com/greggcoppen/claudewave/app/pkg/wconfig",
		"github.com/greggcoppen/claudewave/app/pkg/waveobj",
		"github.com/greggcoppen/claudewave/app/pkg/wps",
		"github.com/greggcoppen/claudewave/app/pkg/vdom",
		"github.com/greggcoppen/claudewave/app/pkg/util/iochan/iochantypes",
		"github.com/greggcoppen/claudewave/app/pkg/aiusechat/uctypes",
	})
	wshDeclMap := wshrpc.GenerateWshCommandDeclMap()
	for _, key := range utilfn.GetOrderedMapKeys(wshDeclMap) {
		methodDecl := wshDeclMap[key]
		if methodDecl.CommandType == wshrpc.RpcType_ResponseStream {
			gogen.GenMethod_ResponseStream(&buf, methodDecl)
		} else if methodDecl.CommandType == wshrpc.RpcType_Call {
			gogen.GenMethod_Call(&buf, methodDecl)
		} else {
			panic("unsupported command type " + methodDecl.CommandType)
		}
	}
	buf.WriteString("\n")
	written, err := utilfn.WriteFileIfDifferent(WshClientFileName, []byte(buf.String()))
	if !written {
		fmt.Fprintf(os.Stderr, "no changes to %s\n", WshClientFileName)
	}
	return err
}

func GenerateWaveObjMetaConsts() error {
	fmt.Fprintf(os.Stderr, "generating waveobj meta consts file to %s\n", WaveObjMetaConstsFileName)
	var buf strings.Builder
	gogen.GenerateBoilerplate(&buf, "waveobj", []string{})
	gogen.GenerateMetaMapConsts(&buf, "MetaKey_", reflect.TypeOf(waveobj.MetaTSType{}), false)
	buf.WriteString("\n")
	written, err := utilfn.WriteFileIfDifferent(WaveObjMetaConstsFileName, []byte(buf.String()))
	if !written {
		fmt.Fprintf(os.Stderr, "no changes to %s\n", WaveObjMetaConstsFileName)
	}
	return err
}

func GenerateSettingsMetaConsts() error {
	fmt.Fprintf(os.Stderr, "generating settings meta consts file to %s\n", SettingsMetaConstsFileName)
	var buf strings.Builder
	gogen.GenerateBoilerplate(&buf, "wconfig", []string{})
	gogen.GenerateMetaMapConsts(&buf, "ConfigKey_", reflect.TypeOf(wconfig.SettingsType{}), false)
	buf.WriteString("\n")
	written, err := utilfn.WriteFileIfDifferent(SettingsMetaConstsFileName, []byte(buf.String()))
	if !written {
		fmt.Fprintf(os.Stderr, "no changes to %s\n", SettingsMetaConstsFileName)
	}
	return err
}

func main() {
	err := GenerateWshClient()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error generating wshclient: %v\n", err)
		return
	}
	err = GenerateWaveObjMetaConsts()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error generating waveobj meta consts: %v\n", err)
		return
	}
	err = GenerateSettingsMetaConsts()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error generating settings meta consts: %v\n", err)
		return
	}
}
