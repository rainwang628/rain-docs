# Claude Code + DeepSeek 增加截图视觉能力：Windows 自动读取微信截图

> 适用环境：Windows + Claude Code + CC Switch，主模型使用 DeepSeek。通过 Vision Bridge MCP 调用 Gemini 视觉模型，实现“截图 → Claude Code 直接理解 → 继续处理代码”。

## 最终效果

配置完成后，日常只需要：使用微信 `Alt+A`、`Win + Shift + S` 或复制任意图片，然后回到 Claude Code 输入“看截图”。

```text
微信 Alt+A / Win+Shift+S / 复制图片
                ↓
          Windows 剪贴板
                ↓
     watch_screenshot.ps1
                ↓
C:\Users\rumor\.claude\latest.png
                ↓
       Claude Code：“看截图”
                ↓
        vision-bridge MCP
                ↓
      Gemini（负责识图）
                ↓
       DeepSeek 继续处理代码
```

DeepSeek 继续作为 Claude Code 的主力模型，Gemini 只承担图片理解，不需要为了看截图切换整个会话的模型。

## 一、准备 Node.js

Vision Bridge 通过 `npx` 启动，因此 Windows 需要安装 Node.js。

```powershell
winget install OpenJS.NodeJS.LTS
```

重新打开 PowerShell 后检查：

```powershell
node --version
npx --version
```

## 二、在 CC Switch 配置 Vision Bridge

进入 **CC Switch → MCP 服务器管理 → 添加 MCP → 自定义**。名称填写 `vision-bridge`，显示名称填写 `Vision Bridge`，只启用到 Claude。

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "mcp-vision-bridge"],
  "env": {
    "VISION_PROVIDER": "gemini",
    "VISION_GEMINI_API_KEY": "替换成自己的 Gemini API Key",
    "VISION_MODEL": "gemini-3.5-flash-lite",
    "NODE_USE_ENV_PROXY": "1"
  }
}
```

如果电脑需要通过本地代理访问 Google API，`NODE_USE_ENV_PROXY=1` 很重要，它可以让 Node 的网络请求使用已经设置的 `HTTP_PROXY / HTTPS_PROXY`。本文环境使用的本地代理是 `http://127.0.0.1:7897`。

**不要把自己的 Gemini API Key 写进 GitHub、公开文档或 CLAUDE.md。**

配置完成后重新打开 Claude Code，输入 `/mcp`，确认 `vision-bridge` 已连接。

## 三、告诉 Claude Code 怎么处理截图

编辑全局配置：

```text
C:\Users\rumor\.claude\CLAUDE.md
```

加入：

```markdown
## Screenshot handling

When I say "看截图", "看下截图", "看一下截图", "看刚才截图", "看最新截图" or "screenshot", use the vision-bridge MCP tool to analyze C:\Users\rumor\.claude\latest.png and continue the current task based on the visual result.

Always use vision-bridge for screenshots. Do not read the image directly, run OCR, use Python/PIL/ImageMagick, convert the image, or search the Screenshots directory.
```

以后说“看截图”，Claude Code 就会调用 Vision Bridge，而不是自行尝试 OCR、Python 或扫描截图目录。

## 四、让微信截图自动变成 latest.png

创建：

```text
C:\Users\rumor\.claude\ps1_scripts\watch_screenshot.ps1
```

内容：

```powershell
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$target = "C:\Users\rumor\.claude\latest.png"
$lastHash = ""

while ($true) {
    try {
        if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
            $image = [System.Windows.Forms.Clipboard]::GetImage()

            if ($null -ne $image) {
                $stream = New-Object System.IO.MemoryStream
                $image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
                $bytes = $stream.ToArray()

                $sha256 = [System.Security.Cryptography.SHA256]::Create()
                $hashBytes = $sha256.ComputeHash($bytes)
                $hash = [System.BitConverter]::ToString($hashBytes)

                if ($hash -ne $lastHash) {
                    [System.IO.File]::WriteAllBytes($target, $bytes)
                    $lastHash = $hash
                }

                $sha256.Dispose()
                $stream.Dispose()
                $image.Dispose()
            }
        }
    }
    catch {
    }

    Start-Sleep -Milliseconds 500
}
```

脚本每 0.5 秒检查一次 Windows 剪贴板。只要出现新的图片，就自动覆盖 `C:\Users\rumor\.claude\latest.png`。因此微信截图、Windows 截图以及浏览器复制图片都可以使用同一套流程。

## 五、让脚本静默运行

创建：

```text
C:\Users\rumor\.claude\ps1_scripts\start_screenshot_watcher.vbs
```

内容：

```vbscript
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\rumor\.claude\ps1_scripts\watch_screenshot.ps1""", 0, False
```

其中 `-STA` 用于保证 Windows Clipboard API 正常工作。

可先用 Win+R 执行：

```text
wscript.exe "C:\Users\rumor\.claude\ps1_scripts\start_screenshot_watcher.vbs"
```

然后微信截一张图，确认 `C:\Users\rumor\.claude\latest.png` 已自动更新。

## 六、设置 Windows 自动启动

运行：

```text
taskschd.msc
```

进入任务计划程序，选择“创建任务”。

| 项目 | 设置 |
| --- | --- |
| 名称 | `Claude Screenshot Watcher` |
| 运行方式 | 仅当用户登录时运行 |
| 触发器 | 登录时 |
| 操作 | 启动程序 |
| 程序 | `wscript.exe` |
| 参数 | `"C:\Users\rumor\.claude\ps1_scripts\start_screenshot_watcher.vbs"` |
| Start in | 留空 |
| 重复实例 | 不启动新实例 |

笔记本建议取消“只有在计算机使用交流电源时才启动此任务”。

最终验证：重启 Windows，登录后不要手动运行任何脚本，直接截图。如果 `latest.png` 自动更新，说明后台自动启动成功。

## 七、日常使用

以后无需再关心 MCP、文件路径或 PowerShell：

```text
微信 Alt+A / Win+Shift+S
          ↓
         截图
          ↓
      回 Claude Code
          ↓
        看截图
```

Claude Code 会自动读取 `latest.png`，调用 Vision Bridge，由 Gemini 理解图片，再把视觉结果交给当前 DeepSeek 主模型继续分析和修改代码。

