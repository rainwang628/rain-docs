# Mac（Apple Silicon）安装 Claude Code 与 CC Switch

> 记录日期：2026-11-06。实际操作环境：Apple M4、macOS Sequoia 15.6.1、zsh，系统界面语言为 English。
>
> 本文记录本次已经走通的本地安装流程。Claude 官方服务的登录与 API 可用性受网络出口和服务地区支持影响；安装 CLI 成功不等于登录一定成功。

## 最终结果

- Homebrew 已安装，M4（Apple Silicon）的安装位置为 `/opt/homebrew`。
- 已修复 Homebrew 的 PATH，终端可以继续使用 `brew`。
- Claude Code 已通过 Homebrew Cask 安装。
- CC Switch 已通过 Homebrew Tap / Cask 安装并完成配置。
- 本文不记录 API Key、访问令牌等敏感信息。

## 一、安装 Homebrew 及 Xcode Command Line Tools

Homebrew 是 macOS 常用的软件包管理工具。安装过程中，系统可能提示安装 **Command Line Tools for Xcode**。这是编译器、Git 等命令行开发组件，不等于完整的 Xcode IDE；本次 Claude Code 安装不需要下载完整 Xcode。

Homebrew 官方安装命令：

```zsh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Apple Silicon（M 系列，包括 M4）默认安装目录：

```text
/opt/homebrew
```

## 二、修复 Homebrew 的 PATH

本次安装后第一次执行 `command -v brew` 没有输出，随后发现 Homebrew 实际安装在 `/opt/homebrew`，只是尚未加入当前 zsh 环境的 PATH。

先检查芯片架构和 Homebrew 文件：

```zsh
uname -m
ls -l /opt/homebrew/bin/brew
```

M4 通常返回 `arm64`。确认文件存在后，将 Homebrew 环境加入登录 Shell 配置：

```zsh
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

验证：

```zsh
brew --version
command -v brew
```

预期命令路径：

```text
/opt/homebrew/bin/brew
```

**为什么写入 `~/.zprofile`：** macOS Terminal 默认使用 zsh；登录 Shell 启动时会读取该文件。第一条命令负责持久配置，第二条让当前终端立即生效。

如果以后新开终端又提示 `zsh: command not found: brew`，先检查 `~/.zprofile` 是否存在上述配置，再重新打开 Terminal。

## 三、安装 Claude Code

### 1. 先尝试官方安装脚本时遇到的情况

最初尝试：

```zsh
curl -fsSL https://claude.ai/install.sh | bash
```

终端报错：

```text
bash: line 1: syntax error near unexpected token '<'
```

排查时发现，下载请求虽然最终返回 HTTP 200，但最终地址和内容类型分别是：

```text
最终下载地址: https://claude.com/app-unavailable-in-region
内容类型: text/html; charset=utf-8
```

这说明下载到的是地区不可用提示网页，而不是 Shell 安装脚本。HTTP 200 只表示网页请求成功，不代表拿到的就是安装脚本。**不要把 HTML 页面直接通过管道交给 bash 执行。**

可以用下面的方式检查下载结果，而不是直接执行：

```zsh
curl -sSL -o /tmp/claude-test -w '最终状态码: %{http_code}\n最终下载地址: %{url_effective}\n内容类型: %{content_type}\n' https://claude.ai/install.sh
head -n 3 /tmp/claude-test
```

如果最终 URL 是地区不可用页面，或者文件开头是 HTML（例如 `<!DOCTYPE html>`），就不要继续执行该文件。

### 2. 使用 Homebrew Cask 安装

Homebrew 已正常工作后，改用：

```zsh
brew install --cask claude-code
```

安装后检查：

```zsh
claude --version
command -v claude
```

本次已完成 Claude Code 安装。若命令暂时找不到，先重新打开 Terminal，再检查：

```zsh
brew list --cask --versions claude-code
ls -l "$(brew --prefix)/bin/claude"
```

## 四、安装 CC Switch

CC Switch 用于集中管理 Claude Code 等工具的模型供应商与配置。本次使用 Homebrew 安装：

```zsh
brew tap farion1231/ccswitch
brew install --cask cc-switch
```

打开应用：

```zsh
open -a "CC Switch"
```

也可以从 macOS 的 Applications（应用程序）中打开 CC Switch。

本次 CC Switch 已完成安装和配置。后续如果增加新的模型供应商、API 地址或模型版本，应在实际验证后再把具体参数补充到本文；不要把 API Key 或访问令牌写进公开文档。

## 五、安装后的检查清单

```zsh
brew --version
brew --prefix
command -v brew
claude --version
command -v claude
brew list --cask --versions claude-code cc-switch
```

常见情况：

| 现象 | 处理方式 |
| --- | --- |
| `brew: command not found` | M 系列 Mac 检查 `/opt/homebrew/bin/brew` 是否存在，并按本文配置 `~/.zprofile`。 |
| `claude: command not found` | 检查 Cask 是否安装成功、`$(brew --prefix)/bin/claude` 是否存在；重新打开终端后再试。 |
| `bash: syntax error near unexpected token '<'` | 检查下载内容是否被重定向成 HTML，不要把网页当脚本执行。 |
| CLI 已安装，但登录或 API 不可用 | 这是服务访问、账户或网络出口问题，与本地二进制是否安装成功是两件事。 |

## 官方与项目链接

- [Homebrew 官方网站](https://brew.sh/)
- [Claude Code 官方文档](https://code.claude.com/docs/en/setup)
- [CC Switch 项目与下载说明](https://ccswitch.io/download)
- [CC Switch GitHub 仓库](https://github.com/farion1231/cc-switch)
