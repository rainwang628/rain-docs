# Windows 上安装和使用 Claude Code

> 适用环境：Windows PowerShell，本地代理软件提供 HTTP 或混合代理端口。本文示例电脑的端口是 **7897**；其他电脑应先查看自己的代理软件设置，不要照抄端口。

## 开始前确认

先打开代理软件，选择可用节点，并确认它的 **HTTP 或混合代理端口**。只设置环境变量不会启动代理软件。下面所有命令都在 **PowerShell** 中执行；命令提示符 CMD、WSL 的语法不同。

本文使用 `http://127.0.0.1:7897`。虽然变量名是 `HTTPS_PROXY`，值仍以 `http://` 开头：前者表示 HTTPS 网站的请求走代理，后者表示连接本地 HTTP 代理的协议。

## 第一步 下载并安装 Claude Code

先在 PowerShell 中让当前窗口通过代理联网：

```powershell
$env:HTTP_PROXY  = 'http://127.0.0.1:7897'
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'
```

检查本地端口是否能连接：

```powershell
Test-NetConnection 127.0.0.1 -Port 7897
```

`TcpTestSucceeded` 应为 `True`。然后在**同一个 PowerShell 窗口**执行 Anthropic 官方 Windows 安装命令：

```powershell
irm https://claude.ai/install.ps1 | iex
```

安装器会获取版本并下载 Claude Code。安装结束后运行：

```powershell
claude --version
```

如果提示找不到 `claude`，先关掉当前 PowerShell，重新打开再试；若仍找不到，再检查安装目录是否已加入 PATH。下载过程中若出现 `downloads.claude.ai: ECONNREFUSED`，先确认代理软件仍在运行、端口填的是 HTTP 或混合端口，并用下面的命令检查下载地址：

```powershell
Invoke-WebRequest 'https://downloads.claude.ai/claude-code-releases/latest' -Proxy 'http://127.0.0.1:7897'
```

## 第二步 启动并验证日常使用

在已设置代理变量的 PowerShell 窗口运行：

```powershell
claude
```

首次启动时按屏幕提示选择主题并登录。能显示版本号只证明安装完成；还应确认 Claude 能进入交互界面并正常连接服务。

若提示 `Failed to connect to api.anthropic.com: ECONNREFUSED`，先检查本地代理而不是反复重装：

```powershell
Test-NetConnection 127.0.0.1 -Port 7897
curl.exe -I -x http://127.0.0.1:7897 https://api.anthropic.com/
```

如果本机端口连接被拒绝，检查代理软件是否已启动，以及端口是否仍为 **7897**。如果第二条返回 HTTP 状态码，说明请求已经通过代理到达远端；`401` 或 `404` 不是本地端口连接失败，也不代表已经登录成功。

## 第三步 在新窗口自动设置代理

直接输入 `$env:...` 只对当前 PowerShell 窗口及其子进程有效。本文采用 **当前用户的 PowerShell profile**，让每次打开 PowerShell 时重新设置代理变量。

先查看执行策略：

```powershell
Get-ExecutionPolicy -List
```

如果打开 PowerShell 时提示 `profile.ps1 cannot be loaded because running scripts is disabled on this system`，在个人电脑上可运行下面的命令，使当前用户编写的本地配置文件可以执行；无需修改整台电脑的 `LocalMachine` 策略：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

按提示确认。如果 `MachinePolicy` 或 `UserPolicy` 由组织策略设定并覆盖此设置，应遵循组织要求，不要继续尝试绕过。

创建并打开当前用户、所有 PowerShell 主机共用的 profile（已有文件时不会清空）：

```powershell
$profilePath = $PROFILE.CurrentUserAllHosts
New-Item -ItemType Directory -Path (Split-Path $profilePath) -Force | Out-Null
if (-not (Test-Path $profilePath)) { New-Item -ItemType File -Path $profilePath | Out-Null }
notepad $profilePath
```

在打开的文件中加入以下两行并保存；如果已经有代理配置，直接把端口改为正确值，避免重复或互相覆盖：

```powershell
$env:HTTP_PROXY  = 'http://127.0.0.1:7897'
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'
```

完全关闭并重新打开 PowerShell，确认值和实际使用情况：

```powershell
Get-ChildItem Env:*PROXY* | Format-Table Name,Value -AutoSize
claude
```

新开的窗口应显示 `http://127.0.0.1:7897`，且 Claude 能正常进入交互界面。**PowerShell profile 只负责设置地址，代理软件仍须保持运行。** 如果从编辑器内置终端启动，还需要确认该终端会加载同一份 PowerShell profile；必要时重启编辑器。

## 常见问题速查

| 现象 | 优先检查 |
| --- | --- |
| `downloads.claude.ai: ECONNREFUSED` | 安装窗口是否设置了代理；代理软件是否运行；下载域名能否经本地代理访问。 |
| `api.anthropic.com: ECONNREFUSED` | 本地端口是否在监听；代理软件节点是否可用；当前窗口继承的代理地址。 |
| `127.0.0.1:7897 Connection refused` | 本地代理未启动，或者实际端口并非 7897。 |
| profile 被执行策略阻止 | 查看 `Get-ExecutionPolicy -List`；个人电脑使用 `CurrentUser RemoteSigned`。 |
| 新窗口变量仍是旧端口 | 检查 profile 及 Windows 用户环境变量中是否留有旧值，修改后重新打开终端。 |

## 给 AI 助手的结构化摘要

```yaml
topic: Install and use Claude Code on Windows PowerShell with a local proxy
platform: Windows PowerShell
proxy_type: HTTP or mixed
local_port_for_this_pc: 7897
proxy_url: http://127.0.0.1:7897
ordered_steps:
  - start proxy software and verify its actual HTTP or mixed port
  - set HTTP_PROXY and HTTPS_PROXY in PowerShell
  - run the official installer: irm https://claude.ai/install.ps1 | iex
  - verify claude --version and then launch claude
  - use CurrentUserAllHosts PowerShell profile for new sessions
  - if profile is blocked, inspect policy and set CurrentUser RemoteSigned on a personal computer
verified_result: user confirmed Claude Code works with the corrected port
important_distinctions:
  - HTTPS_PROXY may use an http:// URL for a local HTTP proxy
  - a local port refusal happens before the request reaches Anthropic
  - environment variables do not start the proxy software
  - installation success does not prove runtime API connectivity
```

## 官方参考

- [Claude Code 安装说明](https://code.claude.com/docs/en/setup)
- [Claude Code 网络配置](https://code.claude.com/docs/en/network-config)
- [PowerShell profile](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_profiles)
- [PowerShell 执行策略](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies)
