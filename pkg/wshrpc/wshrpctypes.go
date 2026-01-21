// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// types and methods for wsh rpc calls
package wshrpc

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/greggcoppen/claudewave/app/pkg/aiusechat/uctypes"
	"github.com/greggcoppen/claudewave/app/pkg/telemetry/telemetrydata"
	"github.com/greggcoppen/claudewave/app/pkg/vdom"
	"github.com/greggcoppen/claudewave/app/pkg/waveobj"
	"github.com/greggcoppen/claudewave/app/pkg/wconfig"
	"github.com/greggcoppen/claudewave/app/pkg/wps"
)

type RespOrErrorUnion[T any] struct {
	Response T
	Error    error
}

type WshRpcInterface interface {
	AuthenticateCommand(ctx context.Context, data string) (CommandAuthenticateRtnData, error)
	AuthenticateTokenCommand(ctx context.Context, data CommandAuthenticateTokenData) (CommandAuthenticateRtnData, error)
	AuthenticateTokenVerifyCommand(ctx context.Context, data CommandAuthenticateTokenData) (CommandAuthenticateRtnData, error) // (special) validates token without binding, root router only
	DisposeCommand(ctx context.Context, data CommandDisposeData) error
	RouteAnnounceCommand(ctx context.Context) error   // (special) announces a new route to the main router
	RouteUnannounceCommand(ctx context.Context) error // (special) unannounces a route to the main router
	SetPeerInfoCommand(ctx context.Context, peerInfo string) error
	GetJwtPublicKeyCommand(ctx context.Context) (string, error) // (special) gets the public JWT signing key

	MessageCommand(ctx context.Context, data CommandMessageData) error
	GetMetaCommand(ctx context.Context, data CommandGetMetaData) (waveobj.MetaMapType, error)
	SetMetaCommand(ctx context.Context, data CommandSetMetaData) error
	ControllerInputCommand(ctx context.Context, data CommandBlockInputData) error
	ControllerStopCommand(ctx context.Context, blockId string) error
	ControllerResyncCommand(ctx context.Context, data CommandControllerResyncData) error
	ControllerAppendOutputCommand(ctx context.Context, data CommandControllerAppendOutputData) error
	ResolveIdsCommand(ctx context.Context, data CommandResolveIdsData) (CommandResolveIdsRtnData, error)
	CreateBlockCommand(ctx context.Context, data CommandCreateBlockData) (waveobj.ORef, error)
	CreateSubBlockCommand(ctx context.Context, data CommandCreateSubBlockData) (waveobj.ORef, error)
	DeleteBlockCommand(ctx context.Context, data CommandDeleteBlockData) error
	DeleteSubBlockCommand(ctx context.Context, data CommandDeleteBlockData) error
	WaitForRouteCommand(ctx context.Context, data CommandWaitForRouteData) (bool, error)

	EventPublishCommand(ctx context.Context, data wps.WaveEvent) error
	EventSubCommand(ctx context.Context, data wps.SubscriptionRequest) error
	EventUnsubCommand(ctx context.Context, data string) error
	EventUnsubAllCommand(ctx context.Context) error
	EventReadHistoryCommand(ctx context.Context, data CommandEventReadHistoryData) ([]*wps.WaveEvent, error)

	FileRestoreBackupCommand(ctx context.Context, data CommandFileRestoreBackupData) error
	GetTempDirCommand(ctx context.Context, data CommandGetTempDirData) (string, error)
	WriteTempFileCommand(ctx context.Context, data CommandWriteTempFileData) (string, error)
	StreamTestCommand(ctx context.Context) chan RespOrErrorUnion[int]
	StreamWaveAiCommand(ctx context.Context, request WaveAIStreamRequest) chan RespOrErrorUnion[WaveAIPacketType]
	StreamCpuDataCommand(ctx context.Context, request CpuDataRequest) chan RespOrErrorUnion[TimeSeriesData]
	TestCommand(ctx context.Context, data string) error
	SetConfigCommand(ctx context.Context, data MetaSettingsType) error
	SetConnectionsConfigCommand(ctx context.Context, data ConnConfigRequest) error
	GetFullConfigCommand(ctx context.Context) (wconfig.FullConfigType, error)
	GetWaveAIModeConfigCommand(ctx context.Context) (wconfig.AIModeConfigUpdate, error)

	// Liatrio Code config commands
	CWConfigGetCommand(ctx context.Context) (*wconfig.CWConfigType, error)
	CWConfigSetCommand(ctx context.Context, data CommandCWConfigSetData) error
	CWConfigGetProjectCommand(ctx context.Context, data CommandCWConfigGetProjectData) (*wconfig.CWConfigType, error)

	// Liatrio Code worktree commands
	WorktreeCreateCommand(ctx context.Context, data CommandWorktreeCreateData) (*WorktreeInfoData, error)
	WorktreeDeleteCommand(ctx context.Context, data CommandWorktreeDeleteData) error
	WorktreeListCommand(ctx context.Context, data CommandWorktreeListData) ([]WorktreeInfoData, error)
	WorktreeSyncCommand(ctx context.Context, data CommandWorktreeSyncData) error
	WorktreeMergeCommand(ctx context.Context, data CommandWorktreeMergeData) error
	WorktreeRenameCommand(ctx context.Context, data CommandWorktreeRenameData) error
	WorktreeStatusCommand(ctx context.Context, data CommandWorktreeStatusData) (*WorktreeStatusData, error)
	WorktreeArchiveCommand(ctx context.Context, data CommandWorktreeArchiveData) (*ArchivedSessionData, error)
	WorktreeRestoreCommand(ctx context.Context, data CommandWorktreeRestoreData) (*WorktreeInfoData, error)
	WorktreeArchiveListCommand(ctx context.Context, data CommandWorktreeArchiveListData) ([]ArchivedSessionData, error)
	WorktreeArchiveDeleteCommand(ctx context.Context, data CommandWorktreeArchiveDeleteData) error

	// Liatrio Code web session commands
	WebSessionListCommand(ctx context.Context, data CommandWebSessionListData) ([]WebSessionData, error)
	WebSessionCreateCommand(ctx context.Context, data CommandWebSessionCreateData) (*WebSessionData, error)
	WebSessionUpdateCommand(ctx context.Context, data CommandWebSessionUpdateData) error
	WebSessionDeleteCommand(ctx context.Context, data CommandWebSessionDeleteData) error

	// Liatrio Code process monitoring commands
	ProcessMetricsCommand(ctx context.Context, data CommandProcessMetricsData) (*ProcessMetricsData, error)
	ProcessMetricsBatchCommand(ctx context.Context, data CommandProcessMetricsBatchData) (map[int32]*ProcessMetricsData, error)

	// Liatrio Code platform integration commands
	PlatformStatusCommand(ctx context.Context) (*PlatformStatusData, error)
	PlatformTeamsCommand(ctx context.Context) (*PlatformTeamsData, error)
	PlatformProjectsCommand(ctx context.Context, data CommandPlatformProjectsData) (*PlatformProjectsData, error)
	PlatformProductsCommand(ctx context.Context, data CommandPlatformProductsData) (*PlatformProductsData, error)
	PlatformPRDsCommand(ctx context.Context, data CommandPlatformPRDsData) (*PlatformPRDsData, error)
	PlatformSpecsCommand(ctx context.Context, data CommandPlatformSpecsData) (*PlatformSpecsData, error)
	PlatformTasksCommand(ctx context.Context, data CommandPlatformTasksData) (*PlatformTasksData, error)
	PlatformTaskDetailCommand(ctx context.Context, data CommandPlatformTaskDetailData) (*PlatformTaskDetailData, error)
	PlatformLinkCommand(ctx context.Context, data CommandPlatformLinkData) error
	PlatformUnlinkCommand(ctx context.Context, data CommandPlatformUnlinkData) error
	PlatformUpdateStatusCommand(ctx context.Context, data CommandPlatformUpdateStatusData) error

	// Liatrio Code git commands
	GitDirectoryStatusCommand(ctx context.Context, data CommandGitDirectoryStatusData) (*GitDirectoryStatusData, error)
	GitFileDiffCommand(ctx context.Context, data CommandGitFileDiffData) (*GitFileDiffData, error)
	GitStageFileCommand(ctx context.Context, data CommandGitStageFileData) error
	GitUnstageFileCommand(ctx context.Context, data CommandGitStageFileData) error
	GitStageAllCommand(ctx context.Context, data CommandGitStageAllData) error
	GitUnstageAllCommand(ctx context.Context, data CommandGitStageAllData) error
	GitHubAuthCommand(ctx context.Context, data CommandGitHubAuthData) error
	GitHubAuthStatusCommand(ctx context.Context) (*GitHubAuthStatusData, error)
	GitHubCreatePRCommand(ctx context.Context, data CommandGitHubPRCreateData) (*GitHubPRResponseData, error)
	GitHubGetPRCommand(ctx context.Context, data CommandGitHubGetPRData) (*GitHubPRStatusData, error)
	GitHubGetPRByBranchCommand(ctx context.Context, data CommandGitHubGetPRByBranchData) (*GitHubPRStatusData, error)
	GitHubMergePRCommand(ctx context.Context, data CommandGitHubMergePRData) error
	GitPushBranchCommand(ctx context.Context, data CommandGitPushBranchData) error

	BlockInfoCommand(ctx context.Context, blockId string) (*BlockInfoData, error)
	BlocksListCommand(ctx context.Context, data BlocksListRequest) ([]BlocksListEntry, error)
	WaveInfoCommand(ctx context.Context) (*WaveInfoData, error)
	WshActivityCommand(ct context.Context, data map[string]int) error
	ActivityCommand(ctx context.Context, data ActivityUpdate) error
	RecordTEventCommand(ctx context.Context, data telemetrydata.TEvent) error
	GetVarCommand(ctx context.Context, data CommandVarData) (*CommandVarResponseData, error)
	SetVarCommand(ctx context.Context, data CommandVarData) error
	PathCommand(ctx context.Context, data PathCommandData) (string, error)
	SendTelemetryCommand(ctx context.Context) error
	FetchSuggestionsCommand(ctx context.Context, data FetchSuggestionsData) (*FetchSuggestionsResponse, error)
	DisposeSuggestionsCommand(ctx context.Context, widgetId string) error
	GetTabCommand(ctx context.Context, tabId string) (*waveobj.Tab, error)

	// connection functions
	ConnStatusCommand(ctx context.Context) ([]ConnStatus, error)
	WslStatusCommand(ctx context.Context) ([]ConnStatus, error)
	ConnEnsureCommand(ctx context.Context, data ConnExtData) error
	ConnReinstallWshCommand(ctx context.Context, data ConnExtData) error
	ConnConnectCommand(ctx context.Context, connRequest ConnRequest) error
	ConnDisconnectCommand(ctx context.Context, connName string) error
	ConnListCommand(ctx context.Context) ([]string, error)
	ConnListAWSCommand(ctx context.Context) ([]string, error)
	WslListCommand(ctx context.Context) ([]string, error)
	WslDefaultDistroCommand(ctx context.Context) (string, error)
	DismissWshFailCommand(ctx context.Context, connName string) error
	ConnUpdateWshCommand(ctx context.Context, remoteInfo RemoteInfo) (bool, error)
	FindGitBashCommand(ctx context.Context, rescan bool) (string, error)

	// eventrecv is special, it's handled internally by WshRpc with EventListener
	EventRecvCommand(ctx context.Context, data wps.WaveEvent) error

	// remotes
	WshRpcRemoteFileInterface
	RemoteStreamCpuDataCommand(ctx context.Context) chan RespOrErrorUnion[TimeSeriesData]
	RemoteGetInfoCommand(ctx context.Context) (RemoteInfo, error)
	RemoteInstallRcFilesCommand(ctx context.Context) error

	// emain
	WebSelectorCommand(ctx context.Context, data CommandWebSelectorData) ([]string, error)
	NotifyCommand(ctx context.Context, notificationOptions WaveNotificationOptions) error
	FocusWindowCommand(ctx context.Context, windowId string) error
	ElectronEncryptCommand(ctx context.Context, data CommandElectronEncryptData) (*CommandElectronEncryptRtnData, error)
	ElectronDecryptCommand(ctx context.Context, data CommandElectronDecryptData) (*CommandElectronDecryptRtnData, error)
	NetworkOnlineCommand(ctx context.Context) (bool, error)

	// secrets
	GetSecretsCommand(ctx context.Context, names []string) (map[string]string, error)
	GetSecretsNamesCommand(ctx context.Context) ([]string, error)
	SetSecretsCommand(ctx context.Context, secrets map[string]*string) error
	GetSecretsLinuxStorageBackendCommand(ctx context.Context) (string, error)

	WorkspaceListCommand(ctx context.Context) ([]WorkspaceInfoData, error)
	GetUpdateChannelCommand(ctx context.Context) (string, error)

	// terminal
	VDomCreateContextCommand(ctx context.Context, data vdom.VDomCreateContext) (*waveobj.ORef, error)
	VDomAsyncInitiationCommand(ctx context.Context, data vdom.VDomAsyncInitiationRequest) error

	// ai
	AiSendMessageCommand(ctx context.Context, data AiMessageData) error
	WaveAIEnableTelemetryCommand(ctx context.Context) error
	GetWaveAIChatCommand(ctx context.Context, data CommandGetWaveAIChatData) (*uctypes.UIChat, error)
	GetWaveAIRateLimitCommand(ctx context.Context) (*uctypes.RateLimitInfo, error)
	WaveAIToolApproveCommand(ctx context.Context, data CommandWaveAIToolApproveData) error
	WaveAIAddContextCommand(ctx context.Context, data CommandWaveAIAddContextData) error
	WaveAIGetToolDiffCommand(ctx context.Context, data CommandWaveAIGetToolDiffData) (*CommandWaveAIGetToolDiffRtnData, error)

	// screenshot
	CaptureBlockScreenshotCommand(ctx context.Context, data CommandCaptureBlockScreenshotData) (string, error)

	// rtinfo
	GetRTInfoCommand(ctx context.Context, data CommandGetRTInfoData) (*waveobj.ObjRTInfo, error)
	SetRTInfoCommand(ctx context.Context, data CommandSetRTInfoData) error

	// terminal
	TermGetScrollbackLinesCommand(ctx context.Context, data CommandTermGetScrollbackLinesData) (*CommandTermGetScrollbackLinesRtnData, error)

	// file
	WshRpcFileInterface

	// builder
	WshRpcBuilderInterface

	// proc
	VDomRenderCommand(ctx context.Context, data vdom.VDomFrontendUpdate) chan RespOrErrorUnion[*vdom.VDomBackendUpdate]
	VDomUrlRequestCommand(ctx context.Context, data VDomUrlRequestData) chan RespOrErrorUnion[VDomUrlRequestResponse]

	// streams
	StreamDataCommand(ctx context.Context, data CommandStreamData) error
	StreamDataAckCommand(ctx context.Context, data CommandStreamAckData) error

	// Liatrio Code plugin commands
	PluginListAvailableCommand(ctx context.Context) ([]PluginData, error)
	PluginListInstalledCommand(ctx context.Context, data CommandPluginListData) ([]InstalledPluginData, error)
	PluginEnableCommand(ctx context.Context, data CommandPluginEnableData) (*InstalledPluginData, error)
	PluginDisableCommand(ctx context.Context, data CommandPluginDisableData) error
	PluginConfigureCommand(ctx context.Context, data CommandPluginConfigureData) error
	PluginGetCategoriesCommand(ctx context.Context) ([]PluginCategoryData, error)
}

// for frontend
type WshServerCommandMeta struct {
	CommandType string `json:"commandtype"`
}

type RpcOpts struct {
	Timeout    int64  `json:"timeout,omitempty"`
	NoResponse bool   `json:"noresponse,omitempty"`
	Route      string `json:"route,omitempty"`

	StreamCancelFn func(context.Context) error `json:"-"` // this is an *output* parameter, set by the handler
}

type RpcContext struct {
	SockName string `json:"sockname,omitempty"` // the domain socket name
	RouteId  string `json:"routeid"`            // the routeid from the jwt
	BlockId  string `json:"blockid,omitempty"`  // blockid for this rpc
	Conn     string `json:"conn,omitempty"`     // the conn name
	IsRouter bool   `json:"isrouter,omitempty"` // if this is for a sub-router
}

type CommandAuthenticateRtnData struct {
	// these fields are only set when doing a token swap
	Env            map[string]string `json:"env,omitempty"`
	InitScriptText string            `json:"initscripttext,omitempty"`
	RpcContext     *RpcContext       `json:"rpccontext,omitempty"`
}

type CommandAuthenticateTokenData struct {
	Token string `json:"token"`
}

type CommandDisposeData struct {
	RouteId string `json:"routeid"`
	// auth token travels in the packet directly
}

type CommandMessageData struct {
	Message string `json:"message"`
}

type CommandGetMetaData struct {
	ORef waveobj.ORef `json:"oref"`
}

type CommandSetMetaData struct {
	ORef waveobj.ORef        `json:"oref"`
	Meta waveobj.MetaMapType `json:"meta"`
}

type CommandResolveIdsData struct {
	BlockId string   `json:"blockid"`
	Ids     []string `json:"ids"`
}

type CommandResolveIdsRtnData struct {
	ResolvedIds map[string]waveobj.ORef `json:"resolvedids"`
}

type CommandCreateBlockData struct {
	TabId         string               `json:"tabid"`
	BlockDef      *waveobj.BlockDef    `json:"blockdef"`
	RtOpts        *waveobj.RuntimeOpts `json:"rtopts,omitempty"`
	Magnified     bool                 `json:"magnified,omitempty"`
	Ephemeral     bool                 `json:"ephemeral,omitempty"`
	Focused       bool                 `json:"focused,omitempty"`
	TargetBlockId string               `json:"targetblockid,omitempty"`
	TargetAction  string               `json:"targetaction,omitempty"` // "replace", "splitright", "splitdown", "splitleft", "splitup"
}

type CommandCreateSubBlockData struct {
	ParentBlockId string            `json:"parentblockid"`
	BlockDef      *waveobj.BlockDef `json:"blockdef"`
}

type CommandControllerResyncData struct {
	ForceRestart bool                 `json:"forcerestart,omitempty"`
	TabId        string               `json:"tabid"`
	BlockId      string               `json:"blockid"`
	RtOpts       *waveobj.RuntimeOpts `json:"rtopts,omitempty"`
}

type CommandControllerAppendOutputData struct {
	BlockId string `json:"blockid"`
	Data64  string `json:"data64"`
}

type CommandBlockInputData struct {
	BlockId     string            `json:"blockid"`
	InputData64 string            `json:"inputdata64,omitempty"`
	SigName     string            `json:"signame,omitempty"`
	TermSize    *waveobj.TermSize `json:"termsize,omitempty"`
}

type CommandWaitForRouteData struct {
	RouteId string `json:"routeid"`
	WaitMs  int    `json:"waitms"`
}

type CommandDeleteBlockData struct {
	BlockId string `json:"blockid"`
}

type CommandEventReadHistoryData struct {
	Event    string `json:"event"`
	Scope    string `json:"scope"`
	MaxItems int    `json:"maxitems"`
}

type WaveAIStreamRequest struct {
	ClientId string                    `json:"clientid,omitempty"`
	Opts     *WaveAIOptsType           `json:"opts"`
	Prompt   []WaveAIPromptMessageType `json:"prompt"`
}

type WaveAIPromptMessageType struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

type WaveAIOptsType struct {
	Model      string `json:"model"`
	APIType    string `json:"apitype,omitempty"`
	APIToken   string `json:"apitoken"`
	OrgID      string `json:"orgid,omitempty"`
	APIVersion string `json:"apiversion,omitempty"`
	BaseURL    string `json:"baseurl,omitempty"`
	ProxyURL   string `json:"proxyurl,omitempty"`
	MaxTokens  int    `json:"maxtokens,omitempty"`
	MaxChoices int    `json:"maxchoices,omitempty"`
	TimeoutMs  int    `json:"timeoutms,omitempty"`
}

type WaveAIPacketType struct {
	Type         string           `json:"type"`
	Model        string           `json:"model,omitempty"`
	Created      int64            `json:"created,omitempty"`
	FinishReason string           `json:"finish_reason,omitempty"`
	Usage        *WaveAIUsageType `json:"usage,omitempty"`
	Index        int              `json:"index,omitempty"`
	Text         string           `json:"text,omitempty"`
	Error        string           `json:"error,omitempty"`
}

type WaveAIUsageType struct {
	PromptTokens     int `json:"prompt_tokens,omitempty"`
	CompletionTokens int `json:"completion_tokens,omitempty"`
	TotalTokens      int `json:"total_tokens,omitempty"`
}

type CpuDataRequest struct {
	Id    string `json:"id"`
	Count int    `json:"count"`
}

type CpuDataType struct {
	Time  int64   `json:"time"`
	Value float64 `json:"value"`
}

type CommandFileRestoreBackupData struct {
	BackupFilePath    string `json:"backupfilepath"`
	RestoreToFileName string `json:"restoretofilename"`
}

type CommandGetTempDirData struct {
	FileName string `json:"filename,omitempty"`
}

type CommandWriteTempFileData struct {
	FileName string `json:"filename"`
	Data64   string `json:"data64"`
}

type ConnRequest struct {
	Host       string               `json:"host"`
	Keywords   wconfig.ConnKeywords `json:"keywords,omitempty"`
	LogBlockId string               `json:"logblockid,omitempty"`
}

type RemoteInfo struct {
	ClientArch    string `json:"clientarch"`
	ClientOs      string `json:"clientos"`
	ClientVersion string `json:"clientversion"`
	Shell         string `json:"shell"`
}

const (
	TimeSeries_Cpu = "cpu"
)

type TimeSeriesData struct {
	Ts     int64              `json:"ts"`
	Values map[string]float64 `json:"values"`
}

type MetaSettingsType struct {
	waveobj.MetaMapType
}

func (m *MetaSettingsType) UnmarshalJSON(data []byte) error {
	var metaMap waveobj.MetaMapType
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := decoder.Decode(&metaMap); err != nil {
		return err
	}
	*m = MetaSettingsType{MetaMapType: metaMap}
	return nil
}

func (m MetaSettingsType) MarshalJSON() ([]byte, error) {
	return json.Marshal(m.MetaMapType)
}

type ConnConfigRequest struct {
	Host        string              `json:"host"`
	MetaMapType waveobj.MetaMapType `json:"metamaptype"`
}

type ConnStatus struct {
	Status        string `json:"status"`
	WshEnabled    bool   `json:"wshenabled"`
	Connection    string `json:"connection"`
	Connected     bool   `json:"connected"`
	HasConnected  bool   `json:"hasconnected"` // true if it has *ever* connected successfully
	ActiveConnNum int    `json:"activeconnnum"`
	Error         string `json:"error,omitempty"`
	WshError      string `json:"wsherror,omitempty"`
	NoWshReason   string `json:"nowshreason,omitempty"`
	WshVersion    string `json:"wshversion,omitempty"`
}

type WebSelectorOpts struct {
	All   bool `json:"all,omitempty"`
	Inner bool `json:"inner,omitempty"`
}

type CommandWebSelectorData struct {
	WorkspaceId string           `json:"workspaceid"`
	BlockId     string           `json:"blockid"`
	TabId       string           `json:"tabid"`
	Selector    string           `json:"selector"`
	Opts        *WebSelectorOpts `json:"opts,omitempty"`
}

type BlockInfoData struct {
	BlockId     string         `json:"blockid"`
	TabId       string         `json:"tabid"`
	WorkspaceId string         `json:"workspaceid"`
	Block       *waveobj.Block `json:"block"`
	Files       []*FileInfo    `json:"files"`
}

type WaveNotificationOptions struct {
	Title  string `json:"title,omitempty"`
	Body   string `json:"body,omitempty"`
	Silent bool   `json:"silent,omitempty"`
}

type VDomUrlRequestData struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    []byte            `json:"body,omitempty"`
}

type VDomUrlRequestResponse struct {
	StatusCode int               `json:"statuscode,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       []byte            `json:"body,omitempty"`
}

type WaveInfoData struct {
	Version   string `json:"version"`
	ClientId  string `json:"clientid"`
	BuildTime string `json:"buildtime"`
	ConfigDir string `json:"configdir"`
	DataDir   string `json:"datadir"`
}

type WorkspaceInfoData struct {
	WindowId      string             `json:"windowid"`
	WorkspaceData *waveobj.Workspace `json:"workspacedata"`
}

type BlocksListRequest struct {
	WindowId    string `json:"windowid,omitempty"`
	WorkspaceId string `json:"workspaceid,omitempty"`
}

type BlocksListEntry struct {
	WindowId    string              `json:"windowid"`
	WorkspaceId string              `json:"workspaceid"`
	TabId       string              `json:"tabid"`
	BlockId     string              `json:"blockid"`
	Meta        waveobj.MetaMapType `json:"meta"`
}

type AiMessageData struct {
	Message string `json:"message,omitempty"`
}

type CommandGetWaveAIChatData struct {
	ChatId string `json:"chatid"`
}

type CommandWaveAIToolApproveData struct {
	ToolCallId string `json:"toolcallid"`
	Approval   string `json:"approval,omitempty"`
}

type AIAttachedFile struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Size   int    `json:"size"`
	Data64 string `json:"data64"`
}

type CommandWaveAIAddContextData struct {
	Files   []AIAttachedFile `json:"files,omitempty"`
	Text    string           `json:"text,omitempty"`
	Submit  bool             `json:"submit,omitempty"`
	NewChat bool             `json:"newchat,omitempty"`
}

type CommandWaveAIGetToolDiffData struct {
	ChatId     string `json:"chatid"`
	ToolCallId string `json:"toolcallid"`
}

type CommandWaveAIGetToolDiffRtnData struct {
	OriginalContents64 string `json:"originalcontents64"`
	ModifiedContents64 string `json:"modifiedcontents64"`
}

type CommandCaptureBlockScreenshotData struct {
	BlockId string `json:"blockid"`
}

type CommandVarData struct {
	Key      string `json:"key"`
	Val      string `json:"val,omitempty"`
	Remove   bool   `json:"remove,omitempty"`
	ZoneId   string `json:"zoneid"`
	FileName string `json:"filename"`
}

type CommandVarResponseData struct {
	Key    string `json:"key"`
	Val    string `json:"val"`
	Exists bool   `json:"exists"`
}

type PathCommandData struct {
	PathType     string `json:"pathtype"`
	Open         bool   `json:"open"`
	OpenExternal bool   `json:"openexternal"`
	TabId        string `json:"tabid"`
}

type ActivityDisplayType struct {
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	DPR      float64 `json:"dpr"`
	Internal bool    `json:"internal,omitempty"`
}

type ActivityUpdate struct {
	FgMinutes           int                   `json:"fgminutes,omitempty"`
	ActiveMinutes       int                   `json:"activeminutes,omitempty"`
	OpenMinutes         int                   `json:"openminutes,omitempty"`
	WaveAIFgMinutes     int                   `json:"waveaifgminutes,omitempty"`
	WaveAIActiveMinutes int                   `json:"waveaiactiveminutes,omitempty"`
	NumTabs             int                   `json:"numtabs,omitempty"`
	NewTab              int                   `json:"newtab,omitempty"`
	NumBlocks           int                   `json:"numblocks,omitempty"`
	NumWindows          int                   `json:"numwindows,omitempty"`
	NumWS               int                   `json:"numws,omitempty"`
	NumWSNamed          int                   `json:"numwsnamed,omitempty"`
	NumSSHConn          int                   `json:"numsshconn,omitempty"`
	NumWSLConn          int                   `json:"numwslconn,omitempty"`
	NumMagnify          int                   `json:"nummagnify,omitempty"`
	TermCommandsRun     int                   `json:"termcommandsrun,omitempty"`
	NumPanics           int                   `json:"numpanics,omitempty"`
	NumAIReqs           int                   `json:"numaireqs,omitempty"`
	Startup             int                   `json:"startup,omitempty"`
	Shutdown            int                   `json:"shutdown,omitempty"`
	SetTabTheme         int                   `json:"settabtheme,omitempty"`
	BuildTime           string                `json:"buildtime,omitempty"`
	Displays            []ActivityDisplayType `json:"displays,omitempty"`
	Renderers           map[string]int        `json:"renderers,omitempty"`
	Blocks              map[string]int        `json:"blocks,omitempty"`
	WshCmds             map[string]int        `json:"wshcmds,omitempty"`
	Conn                map[string]int        `json:"conn,omitempty"`
}

type ConnExtData struct {
	ConnName   string `json:"connname"`
	LogBlockId string `json:"logblockid,omitempty"`
}

type FetchSuggestionsData struct {
	SuggestionType string `json:"suggestiontype"`
	Query          string `json:"query"`
	WidgetId       string `json:"widgetid"`
	ReqNum         int    `json:"reqnum"`
	FileCwd        string `json:"file:cwd,omitempty"`
	FileDirOnly    bool   `json:"file:dironly,omitempty"`
	FileConnection string `json:"file:connection,omitempty"`
}

type FetchSuggestionsResponse struct {
	ReqNum      int              `json:"reqnum"`
	Suggestions []SuggestionType `json:"suggestions"`
}

type SuggestionType struct {
	Type         string `json:"type"`
	SuggestionId string `json:"suggestionid"`
	Display      string `json:"display"`
	SubText      string `json:"subtext,omitempty"`
	Icon         string `json:"icon,omitempty"`
	IconColor    string `json:"iconcolor,omitempty"`
	IconSrc      string `json:"iconsrc,omitempty"`
	MatchPos     []int  `json:"matchpos,omitempty"`
	SubMatchPos  []int  `json:"submatchpos,omitempty"`
	Score        int    `json:"score,omitempty"`
	FileMimeType string `json:"file:mimetype,omitempty"`
	FilePath     string `json:"file:path,omitempty"`
	FileName     string `json:"file:name,omitempty"`
	UrlUrl       string `json:"url:url,omitempty"`
}

type CommandGetRTInfoData struct {
	ORef waveobj.ORef `json:"oref"`
}

type CommandSetRTInfoData struct {
	ORef   waveobj.ORef   `json:"oref"`
	Data   map[string]any `json:"data" tstype:"ObjRTInfo"`
	Delete bool           `json:"delete,omitempty"`
}

type CommandTermGetScrollbackLinesData struct {
	LineStart   int  `json:"linestart"`
	LineEnd     int  `json:"lineend"`
	LastCommand bool `json:"lastcommand"`
}

type CommandTermGetScrollbackLinesRtnData struct {
	TotalLines  int      `json:"totallines"`
	LineStart   int      `json:"linestart"`
	Lines       []string `json:"lines"`
	LastUpdated int64    `json:"lastupdated"`
}

type CommandElectronEncryptData struct {
	PlainText string `json:"plaintext"`
}

type CommandElectronEncryptRtnData struct {
	CipherText     string `json:"ciphertext"`
	StorageBackend string `json:"storagebackend"` // only returned for linux
}

type CommandElectronDecryptData struct {
	CipherText string `json:"ciphertext"`
}

type CommandElectronDecryptRtnData struct {
	PlainText      string `json:"plaintext"`
	StorageBackend string `json:"storagebackend"` // only returned for linux
}

type CommandStreamData struct {
	Id     int64  `json:"id"`  // streamid
	Seq    int64  `json:"seq"` // start offset (bytes)
	Data64 string `json:"data64,omitempty"`
	Eof    bool   `json:"eof,omitempty"`   // can be set with data or without
	Error  string `json:"error,omitempty"` // stream terminated with error
}

type CommandStreamAckData struct {
	Id     int64  `json:"id"`               // streamid
	Seq    int64  `json:"seq"`              // next expected byte
	RWnd   int64  `json:"rwnd"`             // receive window size
	Fin    bool   `json:"fin,omitempty"`    // observed end-of-stream (eof or error)
	Delay  int64  `json:"delay,omitempty"`  // ack delay in microseconds (from when data was received to when we sent out ack -- monotonic clock)
	Cancel bool   `json:"cancel,omitempty"` // used to cancel the stream
	Error  string `json:"error,omitempty"`  // reason for cancel (may only be set if cancel is true)
}

type StreamMeta struct {
	Id            int64  `json:"id"`   // streamid
	RWnd          int64  `json:"rwnd"` // initial receive window size
	ReaderRouteId string `json:"readerrouteid"`
	WriterRouteId string `json:"writerrouteid"`
}

// Liatrio Code config command types
type CommandCWConfigSetData struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

type CommandCWConfigGetProjectData struct {
	ProjectPath string `json:"projectpath"`
}

// Liatrio Code worktree command types
type CommandWorktreeCreateData struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
	BranchName  string `json:"branchname,omitempty"`
}

type CommandWorktreeDeleteData struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
	Force       bool   `json:"force,omitempty"`
}

type CommandWorktreeListData struct {
	ProjectPath string `json:"projectpath"`
}

type CommandWorktreeSyncData struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
}

type CommandWorktreeMergeData struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
	Squash      bool   `json:"squash,omitempty"`
}

type CommandWorktreeRenameData struct {
	ProjectPath   string `json:"projectpath"`
	SessionName   string `json:"sessionname"`
	NewBranchName string `json:"newbranchname"`
}

type CommandWorktreeStatusData struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
}

type WorktreeInfoData struct {
	Path       string `json:"path"`
	BranchName string `json:"branchname"`
	IsClean    bool   `json:"isclean"`
	CommitHash string `json:"commithash"`
	SessionID  string `json:"sessionid,omitempty"`
}

type WorktreeStatusData struct {
	BranchName       string   `json:"branchname"`
	UncommittedFiles []string `json:"uncommittedfiles"`
	StagedFiles      []string `json:"stagedfiles"`
	Ahead            int      `json:"ahead"`
	Behind           int      `json:"behind"`
	IsClean          bool     `json:"isclean"`
}

// Liatrio Code worktree archive command types
type CommandWorktreeArchiveData struct {
	ProjectPath string `json:"projectpath"`
	SessionName string `json:"sessionname"`
	Force       bool   `json:"force,omitempty"`
}

type CommandWorktreeRestoreData struct {
	ProjectPath string `json:"projectpath"`
	SessionID   string `json:"sessionid"`
}

type CommandWorktreeArchiveListData struct {
	ProjectPath string `json:"projectpath"`
}

type CommandWorktreeArchiveDeleteData struct {
	ProjectPath string `json:"projectpath"`
	SessionID   string `json:"sessionid"`
}

type ArchivedSessionData struct {
	SessionID        string `json:"sessionid"`
	BranchName       string `json:"branchname"`
	ArchivedAt       int64  `json:"archivedat"`
	OriginalPath     string `json:"originalpath"`
	ArchivePath      string `json:"archivepath"`
	UncommittedCount int    `json:"uncommittedcount"`
	CommitHash       string `json:"commithash"`
}

// Liatrio Code web session command types
type CommandWebSessionListData struct {
	ProjectPath string `json:"projectpath"`
}

type CommandWebSessionCreateData struct {
	ProjectPath       string `json:"projectpath"`
	Description       string `json:"description"`
	Source            string `json:"source"` // "handoff" or "manual"
	OriginSession     int    `json:"originsession,omitempty"`
	OriginBranch      string `json:"originbranch,omitempty"`
	OriginWorkingDir  string `json:"originworkingdir,omitempty"`
}

type CommandWebSessionUpdateData struct {
	ProjectPath string `json:"projectpath"`
	SessionID   string `json:"sessionid"`
	Status      string `json:"status,omitempty"` // "active", "completed", "unknown"
	Description string `json:"description,omitempty"`
}

type CommandWebSessionDeleteData struct {
	ProjectPath string `json:"projectpath"`
	SessionID   string `json:"sessionid"`
}

type WebSessionData struct {
	ID               string `json:"id"`
	Description      string `json:"description"`
	Timestamp        string `json:"timestamp"`
	Source           string `json:"source"` // "handoff" or "manual"
	OriginSession    int    `json:"originsession,omitempty"`
	OriginBranch     string `json:"originbranch,omitempty"`
	OriginWorkingDir string `json:"originworkingdir,omitempty"`
	Status           string `json:"status"` // "active", "completed", "unknown"
}

// Liatrio Code process monitoring types
type CommandProcessMetricsData struct {
	PID int32 `json:"pid"`
}

type CommandProcessMetricsBatchData struct {
	PIDs []int32 `json:"pids"`
}

type ProcessMetricsData struct {
	PID        int32   `json:"pid"`
	CPUPercent float64 `json:"cpupercent"`
	MemoryMB   float64 `json:"memorymb"`
	MemoryRSS  uint64  `json:"memoryrss"`
	Running    bool    `json:"running"`
	Name       string  `json:"name,omitempty"`
}

// Liatrio Code platform integration types

type CommandPlatformStatusData struct {
	// No parameters needed
}

type PlatformStatusData struct {
	Connected        bool               `json:"connected"`
	OfflineMode      bool               `json:"offlineMode,omitempty"`
	BaseURL          string             `json:"baseUrl"`
	APIKeyConfigured bool               `json:"apiKeyConfigured"`
	User             *PlatformUserData  `json:"user,omitempty"`
	Error            string             `json:"error,omitempty"`
}

type PlatformUserData struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type CommandPlatformTeamsData struct {
	// No parameters needed
}

type PlatformTeamsData struct {
	Teams []PlatformTeamData `json:"teams"`
}

type PlatformTeamData struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug,omitempty"`
}

type CommandPlatformProjectsData struct {
	TeamID string `json:"teamId,omitempty"` // Optional team filter
}

type PlatformProjectsData struct {
	Projects []PlatformProjectData `json:"projects"`
}

type PlatformProjectData struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type CommandPlatformProductsData struct {
	ProjectID string `json:"projectId"`
}

type PlatformProductsData struct {
	Products []PlatformProductData `json:"products"`
}

type PlatformProductData struct {
	ID          string `json:"id"`
	ProjectID   string `json:"projectId"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type CommandPlatformPRDsData struct {
	ProductID string `json:"productId"`
}

type PlatformPRDsData struct {
	PRDs []PlatformPRDData `json:"prds"`
}

type PlatformPRDData struct {
	ID          string `json:"id"`
	ProductID   string `json:"productId"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Status      string `json:"status,omitempty"`
}

type CommandPlatformSpecsData struct {
	PRDID string `json:"prdId"`
}

type PlatformSpecsData struct {
	Specs []PlatformSpecData `json:"specs"`
}

type PlatformSpecData struct {
	ID     string `json:"id"`
	PRDID  string `json:"prdId"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

type CommandPlatformTasksData struct {
	SpecID string `json:"specId"`
}

type PlatformTasksData struct {
	Tasks []PlatformTaskData `json:"tasks"`
}

type PlatformTaskData struct {
	ID                  string                `json:"id"`
	SpecID              string                `json:"specId"`
	Title               string                `json:"title"`
	Description         string                `json:"description,omitempty"`
	Status              string                `json:"status"`
	Progress            int                   `json:"progress,omitempty"`
	CheckpointMode      bool                  `json:"checkpointMode"`
	Model               string                `json:"model,omitempty"`
	SelectedAgent       string                `json:"selectedAgent,omitempty"`
	SelectedModel       string                `json:"selectedModel,omitempty"`
	RepoURL             string                `json:"repoUrl,omitempty"`
	BranchName          string                `json:"branchName,omitempty"`
	PRNumber            int                   `json:"prNumber,omitempty"`
	PRURL               string                `json:"prUrl,omitempty"`
	SandboxURL          string                `json:"sandboxUrl,omitempty"`
	SandboxHealthStatus string                `json:"sandboxHealthStatus,omitempty"`
	SubTasks            []PlatformSubTaskData `json:"subTasks,omitempty"`
	Logs                []PlatformTaskLogData `json:"logs,omitempty"`
	CreatedAt           string                `json:"createdAt,omitempty"`
	UpdatedAt           string                `json:"updatedAt,omitempty"`
}

type PlatformTaskLogData struct {
	Type      string `json:"type"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp,omitempty"`
}

type PlatformSubTaskData struct {
	ID     string `json:"id"`
	TaskID string `json:"taskId"`
	Title  string `json:"title"`
	Status string `json:"status"`
}

type CommandPlatformTaskDetailData struct {
	TaskID string `json:"taskId"`
}

type PlatformTaskDetailData struct {
	Task PlatformTaskData `json:"task"`
	Spec PlatformSpecData `json:"spec"`
}

type CommandPlatformLinkData struct {
	TaskID      string `json:"taskId"`
	WorktreeDir string `json:"worktreeDir,omitempty"`
	Force       bool   `json:"force,omitempty"`
}

type CommandPlatformUnlinkData struct {
	WorktreeDir string `json:"worktreeDir,omitempty"`
}

type CommandPlatformUpdateStatusData struct {
	TaskID string `json:"taskId"`
	Status string `json:"status"`
}

// Liatrio Code Git command types

type CommandGitDirectoryStatusData struct {
	DirPath string `json:"dirpath"`
}

type GitFileStatusData struct {
	Path           string `json:"path"`
	Status         string `json:"status"`
	IndexStatus    string `json:"indexstatus"`
	WorktreeStatus string `json:"worktreestatus"`
	IsStaged       bool   `json:"isstaged"`
	OldPath        string `json:"oldpath,omitempty"`
}

type GitDirectoryStatusData struct {
	RepoRoot string                       `json:"reporoot"`
	Branch   string                       `json:"branch"`
	Files    map[string]GitFileStatusData `json:"files"`
	Ahead    int                          `json:"ahead"`
	Behind   int                          `json:"behind"`
}

type CommandGitFileDiffData struct {
	RepoPath string `json:"repopath"`
	FilePath string `json:"filepath"`
	Staged   bool   `json:"staged,omitempty"`
}

type GitFileDiffData struct {
	Path      string `json:"path"`
	Original  string `json:"original"`
	Modified  string `json:"modified"`
	IsNew     bool   `json:"isnew"`
	IsDeleted bool   `json:"isdeleted"`
	IsBinary  bool   `json:"isbinary"`
}

type CommandGitStageFileData struct {
	RepoPath string `json:"repopath"`
	FilePath string `json:"filepath"`
}

type CommandGitStageAllData struct {
	RepoPath string `json:"repopath"`
}

type CommandGitHubPRCreateData struct {
	RepoPath   string `json:"repopath"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	BaseBranch string `json:"basebranch,omitempty"`
}

type GitHubPRResponseData struct {
	Number  int    `json:"number"`
	URL     string `json:"url"`
	HTMLURL string `json:"htmlurl"`
}

type CommandGitHubAuthData struct {
	Token string `json:"token"`
}

type GitHubAuthStatusData struct {
	Configured bool `json:"configured"`
}

type CommandGitHubGetPRData struct {
	RepoOwner string `json:"repoowner"`
	RepoName  string `json:"reponame"`
	PRNumber  int    `json:"prnumber"`
}

type CommandGitHubGetPRByBranchData struct {
	RepoPath   string `json:"repopath"`
	HeadBranch string `json:"headbranch,omitempty"` // If empty, uses current branch
}

type CommandGitHubMergePRData struct {
	RepoOwner   string `json:"repoowner"`
	RepoName    string `json:"reponame"`
	PRNumber    int    `json:"prnumber"`
	MergeMethod string `json:"mergemethod,omitempty"` // "merge", "squash", or "rebase"
}

type CommandGitPushBranchData struct {
	RepoPath    string `json:"repopath"`
	SetUpstream bool   `json:"setupstream,omitempty"`
}

type GitHubPRStatusData struct {
	Number    int    `json:"number"`
	State     string `json:"state"`     // "open", "closed"
	Merged    bool   `json:"merged"`
	Mergeable *bool  `json:"mergeable"` // nil if unknown/pending
	HTMLURL   string `json:"htmlurl"`
	Title     string `json:"title"`
	HeadRef   string `json:"headref"`
	BaseRef   string `json:"baseref"`
}

// Liatrio Code plugin command types
type CommandPluginListData struct {
	ProjectPath string `json:"projectpath,omitempty"`
}

type CommandPluginEnableData struct {
	ProjectPath string `json:"projectpath"`
	PluginID    string `json:"pluginid"`
}

type CommandPluginDisableData struct {
	ProjectPath string `json:"projectpath"`
	PluginID    string `json:"pluginid"`
}

type CommandPluginConfigureData struct {
	ProjectPath string                 `json:"projectpath"`
	PluginID    string                 `json:"pluginid"`
	Config      map[string]interface{} `json:"config"`
}

type PluginData struct {
	ID               string                  `json:"id"`
	Name             string                  `json:"name"`
	Description      string                  `json:"description"`
	Category         string                  `json:"category"`
	Author           string                  `json:"author"`
	Source           string                  `json:"source"`
	Path             string                  `json:"path"`
	Version          string                  `json:"version,omitempty"`
	Official         bool                    `json:"official"`
	Liatrio          bool                    `json:"liatrio,omitempty"`
	Featured         bool                    `json:"featured,omitempty"`
	RequiresPlatform bool                    `json:"requiresPlatform,omitempty"`
	Commands         []string                `json:"commands,omitempty"`
	Skills           []string                `json:"skills,omitempty"`
	Agents           []string                `json:"agents,omitempty"`
	Hooks            []string                `json:"hooks,omitempty"`
	Tags             []string                `json:"tags,omitempty"`
	ConfigFields     []PluginConfigFieldData `json:"configFields,omitempty"`
}

type PluginConfigFieldData struct {
	Key         string      `json:"key"`
	Label       string      `json:"label"`
	Type        string      `json:"type"`
	Default     interface{} `json:"default,omitempty"`
	Description string      `json:"description,omitempty"`
	Required    bool        `json:"required,omitempty"`
	Options     []string    `json:"options,omitempty"`
	Min         *float64    `json:"min,omitempty"`
	Max         *float64    `json:"max,omitempty"`
}

type InstalledPluginData struct {
	PluginID    string                 `json:"pluginId"`
	Enabled     bool                   `json:"enabled"`
	InstalledAt int64                  `json:"installedAt,omitempty"`
	Config      map[string]interface{} `json:"config,omitempty"`
}

type PluginCategoryData struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Description string `json:"description,omitempty"`
}

type PluginResultData struct {
	Success bool       `json:"success"`
	Message string     `json:"message,omitempty"`
	Plugin  PluginData `json:"plugin,omitempty"`
}
