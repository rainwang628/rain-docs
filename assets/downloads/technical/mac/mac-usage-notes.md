# Mac 使用经验（持续更新）

> 本文作为 Mac 日常使用经验的长期记录。以后遇到新的 macOS 操作、快捷键、触控板或 Terminal 问题，统一追加到本文，不另建零散的 Mac 技巧文章。
>
> 当前记录环境：Apple M4、macOS 27.2（Build 26B123）、English 系统界面、zsh；本次主要使用 MacBook 触控板，没有外接鼠标。系统已于 2026 年 11 月 6 日晚从 macOS Sequoia 15.6.1 升级到 27.2，升级前的记录保留原文，并在系统版本记录里注明对应版本。

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

## 七、Finder：在当前文件夹打开终端

在 Finder 里定位到某个目录后，想直接让终端停在该目录，有三条路，按启动成本从低到高：

| 方式 | 操作 | 说明 |
| --- | --- | --- |
| 右键服务 | 在文件夹上右键 → **Services** → **New Terminal at Folder** | 系统自带，零依赖 |
| 拖拽 | 把文件夹拖到 Dock 上的 **Terminal** 图标 | 会新开一个窗口并自动 `cd` |
| 命令 | `open -a Terminal .` | 在已有终端里对当前目录开新窗口 |

如果右键菜单里没有 **New Terminal at Folder**，去 **System Settings → Keyboard → Keyboard Shortcuts → Services → Files and Folders** 勾选它。在终端里想补全路径，输入 `cd ` 后把文件夹拖进窗口即可。

### 1. Go2Shell：Finder 工具栏按钮

右键服务每次要展开两层菜单，用得多了嫌慢，于是装了 **Go2Shell**：它会在 Finder 工具栏加一个 `>_` 按钮，点一下就在当前目录打开终端。

安装步骤（dmg 版）：

1. 打开 `Go2Shell.dmg`，把 **Go2Shell.app** 拖进 `/Applications`。
2. 打开 Go2Shell，点窗口里的 **Install Go2Shell**，把按钮注册进 Finder 工具栏。
3. 或者按住 **Command**，把 `Go2Shell.app` 直接拖到 Finder 工具栏上。
4. 在其偏好设置里可以选择按钮打开的是 **Terminal** 还是 **iTerm**。

注意两点：

- **重复安装会出现两个 `>_` 按钮**（点了 Install 又拖了一次就会这样）。删掉多余的那个：按住 **Command** 把它拖出工具栏，图标会“噗”一下消失；拖不动就在工具栏空白处右键 → **Customize Toolbar…** 拖出多余的图标再点 **Done**。
- Go2Shell 是免费的老工具，更新不勤，macOS 大版本升级后如果按钮失效，重装一次通常就能恢复。

本次验证环境：macOS 27.2（Build 26B123）、Apple 芯片、English 界面，Go2Shell v2.5。

## 八、安装 dmg 软件后的挂载卷

双击 `.dmg` 后，Finder 会把它当成一块磁盘挂载，桌面出现一个卷图标（白色磁盘、带向下箭头），`/Volumes/` 下也多一个同名目录。这**只是安装镜像被挂载了，不代表软件已装好**，把里面的 `.app` 拖进 `/Applications` 才算完成。

装完后这个卷没有自动消失，需要手动推出，三种方式等价：

- 在卷图标上右键 → **Eject “Go2Shell v2.5”**；
- 把卷图标拖到废纸篓（等于推出，不会删掉任何文件）；
- 选中后按 **Command + E**。

命令行：

```zsh
diskutil eject "/Volumes/Go2Shell v2.5"
```

`hdiutil detach` 也能用，但 macOS 会提示已废弃，建议改用 `diskutil eject`。

推出后还有两件收尾：

1. **确认 App 真的在**：`ls -d /Applications/Go2Shell.app` 有输出才算装好，没有输出说明只挂载了没拖过去。
2. **删掉安装包**：卷退出后 `~/Downloads/Go2Shell.dmg` 就没用了，可以直接删除。

两个容易踩的点：

- 桌面那个图标看着像“软件装出来的东西”，其实只是挂载卷，删了不会卸载软件；反过来，**直接在卷里双击运行 App 而不拖进 `/Applications`**，一推出卷 App 就打不开了。
- 想确认到底挂了什么，用 `ls /Volumes`，或用 `hdiutil info` 看 `image-path` 和挂载点。

## 九、系统版本记录

| 时间 | 系统版本 | 说明 |
| --- | --- | --- |
| 2026-11-06 之前 | macOS Sequoia 15.6.1（Build 未记录） | 第一至六节在此版本上记录 |
| 2026-11-06 晚 | macOS 27.2（Build 26B123） | 完成系统升级；第七、八节在此版本验证 |

系统界面语言为 English。升级后第七、八节的操作路径（Finder 工具栏、挂载卷推出）与 15.6.1 上一致，没有遇到入口变化。

需要区别对待的是第四、五节：触控板三指拖移和滚动方向的设置页面只在 15.6.1 上确认过，**升级到 27.2 后尚未逐项复验**。如果要按文中的路径去找，先在 **System Settings** 的搜索框里搜关键词（如 Natural scrolling、Three Finger Drag）更稳，找不到再按前一节的旧路径对照。

后续再遇到系统升级，继续往这张表里追加一行，并注明受影响的章节。

---

## 后续追加记录

后续新的 Mac 使用经验按主题追加到对应章节，必要时增加新章节，并同步更新网站上的 Markdown 原文和文章页面。尽量记录：

- 适用的 macOS 版本和设备；
- 英文系统菜单的准确名称与路径；
- 可复用的快捷键或命令；
- 已验证的结果，以及尚未验证的部分。
