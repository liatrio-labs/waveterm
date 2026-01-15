// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshrpc

import (
	"context"
	"fmt"
	"log"
	"reflect"
	"strings"
)

type WshRpcMethodDecl struct {
	Command                 string
	CommandType             string
	MethodName              string
	CommandDataType         reflect.Type
	DefaultResponseDataType reflect.Type
}

var contextRType = reflect.TypeOf((*context.Context)(nil)).Elem()
var wshRpcInterfaceRType = reflect.TypeOf((*WshRpcInterface)(nil)).Elem()

func getWshCommandType(method reflect.Method) string {
	if method.Type.NumOut() == 1 {
		outType := method.Type.Out(0)
		if outType.Kind() == reflect.Chan {
			return RpcType_ResponseStream
		}
	}
	return RpcType_Call
}

func getWshMethodResponseType(commandType string, method reflect.Method) (reflect.Type, error) {
	switch commandType {
	case RpcType_ResponseStream:
		if method.Type.NumOut() != 1 {
			return nil, fmt.Errorf("method %q has invalid number of return values for response stream", method.Name)
		}
		outType := method.Type.Out(0)
		if outType.Kind() != reflect.Chan {
			return nil, fmt.Errorf("method %q has invalid return type %s for response stream", method.Name, outType)
		}
		elemType := outType.Elem()
		if !strings.HasPrefix(elemType.Name(), "RespOrErrorUnion") {
			return nil, fmt.Errorf("method %q has invalid return element type %s for response stream (should be RespOrErrorUnion)", method.Name, elemType)
		}
		respField, found := elemType.FieldByName("Response")
		if !found {
			return nil, fmt.Errorf("method %q has invalid return element type %s for response stream (missing Response field)", method.Name, elemType)
		}
		return respField.Type, nil
	case RpcType_Call:
		if method.Type.NumOut() > 1 {
			return method.Type.Out(0), nil
		}
		return nil, nil
	default:
		return nil, fmt.Errorf("unsupported command type %q", commandType)
	}
}

func generateWshCommandDecl(method reflect.Method) (*WshRpcMethodDecl, error) {
	if method.Type.NumIn() == 0 || method.Type.In(0) != contextRType {
		return nil, fmt.Errorf("method %q does not have context as first argument", method.Name)
	}
	cmdStr := method.Name
	decl := &WshRpcMethodDecl{}
	// remove Command suffix
	if !strings.HasSuffix(cmdStr, "Command") {
		return nil, fmt.Errorf("method %q does not have Command suffix", cmdStr)
	}
	cmdStr = cmdStr[:len(cmdStr)-len("Command")]
	decl.Command = strings.ToLower(cmdStr)
	decl.CommandType = getWshCommandType(method)
	decl.MethodName = method.Name
	var cdataType reflect.Type
	if method.Type.NumIn() > 1 {
		cdataType = method.Type.In(1)
	}
	decl.CommandDataType = cdataType
	responseType, err := getWshMethodResponseType(decl.CommandType, method)
	if err != nil {
		return nil, err
	}
	decl.DefaultResponseDataType = responseType
	return decl, nil
}

func MakeMethodMapForImpl(impl any, declMap map[string]*WshRpcMethodDecl) map[string]reflect.Method {
	rtype := reflect.TypeOf(impl)
	rtnMap := make(map[string]reflect.Method)
	for midx := 0; midx < rtype.NumMethod(); midx++ {
		method := rtype.Method(midx)
		if !strings.HasSuffix(method.Name, "Command") {
			continue
		}
		commandName := strings.ToLower(method.Name[:len(method.Name)-len("Command")])
		decl := declMap[commandName]
		if decl == nil {
			log.Printf("WARNING: method %q does not match a command method", method.Name)
			continue
		}
		rtnMap[commandName] = method
	}
	return rtnMap

}

// GenerateWshCommandDeclMap generates a map of command declarations from the interface.
// It logs errors for invalid methods but continues processing other methods.
func GenerateWshCommandDeclMap() map[string]*WshRpcMethodDecl {
	rtype := wshRpcInterfaceRType
	rtnMap := make(map[string]*WshRpcMethodDecl)
	for midx := 0; midx < rtype.NumMethod(); midx++ {
		method := rtype.Method(midx)
		decl, err := generateWshCommandDecl(method)
		if err != nil {
			// Log the error instead of panicking
			log.Printf("ERROR: Failed to generate command declaration for method %q: %v", method.Name, err)
			continue
		}
		rtnMap[decl.Command] = decl
	}
	return rtnMap
}
