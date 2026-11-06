# Mac 使用经验（持续更新）

> 本文作为 Mac 日常使用经验的长期记录。以后遇到新的 macOS 操作、快捷键、触控板或 Terminal 问题，统一追加到本文，不另建零散的 Mac 技巧文章。
>
> 当前记录环境：Apple M4、macOS Sequoia 15.6.1、English 系统界面、zsh；本次主要使用 MacBook 触控板，没有外接鼠标。系统升级完成后，再补充升级后的版本和界面差异。

## 一、Mac 与 Windows 常用快捷键对照

Mac 的很多常用快捷键使用 **Command（⌘）**，不要把它和 Windows 的 Ctrl 直接等同。

| 操作 | macOS 快捷键 | 说明 |
| --- | --- | --- |
| 复制 | `⌘ + C` | 复制当前选中内容 |
| 粘贴 | `⌘ + V` | 粘贴 |
| 全选 | `⌘ + A` | 全选 |
| 保存 | `⌘ + S` | 保存 |
| 关闭当前窗口 | `⌘ + W` | Window |
| 退出当前应用 | `⌘ + Q` | Quit |
| 新建窗口 | `⌘ + N` | New |
| 新建标签页 | `⌘ + T` | Tab |

**Terminal 里的特殊区别：**

- `Command + C`：复制选中的终端文字。
- `Control + C`：向正在运行的命令发送中断信号，常用于停止程序。
- `exit`：退出当前 Shell，不等于退出 Terminal 应用。
- `quit`：不是 zsh 内置退出命令，通常会提示 `command not found`。

## 二、Terminal：Shell、退出与提示符

### 1. 确认当前 Shell

macOS Terminal 默认使用 zsh。查看当前 Shell：

```zsh
echo $0
```

本次输出为：

```text
-zsh
```

### 2. 理解 exit 与 Process completed

在 Terminal 输入：

```zsh
exit
```

会结束当前 Shell 会话。Terminal 窗口可能仍然保留，并显示类似 `Process completed` 的状态，这通常表示 Shell 进程已经结束，不是报错。

- `⌘ + W`：关闭当前 Terminal 窗口。
- `⌘ + Q`：退出 Terminal 应用。
- `⌘ + N`：新建终端窗口。

如果希望 Shell 退出后窗口自动关闭，可在 Terminal 的 Settings → Profiles → Shell 中查看 **When the shell exits** 选项。

### 3. 自定义终端提示符

本次使用下面的 zsh 命令，把当前终端提示符临时改为更简洁的形式：

```zsh
PROMPT='rain@MacBook %1~ %# '
```

效果类似：

```text
rain@MacBook ~ %
```

这条命令只改变当前 Shell 会话的提示符；如果希望每次打开终端都生效，需要把设置写入 zsh 配置文件（通常是 `~/.zshrc`）。本次只验证了当前会话效果，没有把它记录为已完成的永久配置。

## 三、Mac 截图

| 快捷键 | 功能 |
| --- | --- |
| `⌘ + ⇧ + 3` | 截取整个屏幕 |
| `⌘ + ⇧ + 4` | 用鼠标或触控板框选区域 |
| `⌘ + ⇧ + 4` 后按空格 | 截取指定窗口 |
| `⌘ + ⇧ + 5` | 打开截图与屏幕录制工具栏 |

截图默认保存到桌面。截图时同时按住 **Control**，可以将截图复制到剪贴板，而不是只保存为文件。

## 四、没有鼠标时使用触控板

### 1. 选择 Terminal 里的文字

可以用触控板完成文字选择：

1. 将指针移动到文字起点。
2. 按下触控板并保持按下状态。
3. 拖动到文字终点。
4. 松开触控板，完成选择。

也可以在系统辅助功能中开启三指拖移，减少持续按压触控板的需要。

### 2. 开启三指拖移

macOS Sequoia 英文界面中的设置路径：

**System Settings → Accessibility → Pointer Control → Trackpad Options**

在弹出的选项中：

1. 开启 **Use trackpad for dragging**。
2. 在拖移方式中选择 **Three Finger Drag**。

这样可以用三根手指在触控板上移动来拖动窗口、文件或选择文字。该设置在本次对话中作为操作指引提供，是否已开启需要在 Mac 上实际确认。

## 五、调整双指滚动方向

macOS 默认的 **Natural scrolling** 与很多 Windows 用户习惯的方向相反。

在触控板上调整的预期路径：

**System Settings → Trackpad → Scroll & Zoom → Natural scrolling**

关闭 **Natural scrolling** 后，双指向上滑动时，页面会向下移动，更接近常见的 Windows 触控板习惯。

本次使用 macOS Sequoia 15.6.1 时，尚未在实际设置页面确认该开关的位置。如果页面中没有看到，可在 System Settings 左侧搜索框输入 **Natural scrolling**；不要把 Trackpad 与 Mouse 的设置入口混淆。

## 六、Xcode 与 Command Line Tools 的区别

安装 Homebrew 时，macOS 可能提示安装 **Command Line Tools for Xcode**：

- **Command Line Tools**：提供 Git、Clang、编译工具和相关 SDK，是很多开发工具的基础依赖。
- **Xcode**：苹果完整的集成开发环境，包含代码编辑器、模拟器和更完整的开发工具链。

本次安装的是 Command Line Tools，不是完整 Xcode。仅为了安装 Homebrew 和 Claude Code，通常不需要额外下载完整 Xcode。

## 七、系统版本记录

本次操作时系统为 **macOS Sequoia 15.6.1**，系统界面语言为 English。后续如果完成系统升级，再把升级后的 macOS 版本、设置入口变化和兼容性检查补充到这里；未实际完成的升级不作为已验证经验记录。

---

## 后续追加记录

后续新的 Mac 使用经验按主题追加到对应章节，必要时增加新章节，并同步更新网站上的 Markdown 原文和文章页面。尽量记录：

- 适用的 macOS 版本和设备；
- 英文系统菜单的准确名称与路径；
- 可复用的快捷键或命令；
- 已验证的结果，以及尚未验证的部分。
