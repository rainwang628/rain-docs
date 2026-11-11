# 网速慢，我怪错了对象：一次 macOS 后台流量排查

**一句话结论**：装插件装到怀疑人生，顺手打开 Clash 看了一眼——真正吃掉带宽的是命令行里下载的 27 MB，而那九条看着最碍眼的 Adobe 连接，总量只有它的三分之一；更离谱的是，我在 Creative Cloud 里关掉的那个「登录时启动」开关，改的根本不是我以为的那一层。

## 一、引子：装个插件装到怀疑人生

今天晚上在装 dsh-pet。一个插件，按理说几十秒的事，进度条却走得跟拨号上网一样，一格一格地挪。第一反应当然是网络问题——机场节点是不是又抽了？带宽是不是被限速了？

与其猜，不如看。Clash Verge 的连接面板是现成的，打开就是一张表：主机、下载量、上传量、实时速度、链路、命中的规则。

扫一眼，火气就上来了。

## 二、第一眼的"嫌疑人"

面板上有九条一模一样的记录，全是 `ccmdls.adobe.com:443`，全部指向同一条代理链路（一个海外节点），速率从 39 KB/s 到 8 KB/s 不等，进程名那一列被窗口宽度截断了。

九条并发连接，都走代理，都在动。观感上这就是罪魁祸首。

但同一张表的第一行，还有另一条记录，被我第一眼略过了：

| 主机 | 下载量 | 速度 | 链路 | 规则 |
|---|---|---|---|---|
| `repo.huaweicloud.com:443` | **27.1 MB** | **221 KB/s** | DIRECT | GeolP(cn) |
| `ccmdls.adobe.com:443` ×9 | 合计 **9.5 MB** | 合计 ~164 KB/s | 海外节点 | DomainSuffix(adobe.com) |

27.1 MB 对 9.5 MB。221 KB/s 对加起来 164 KB/s。

**单看带宽，那条"直连、走国内、看着人畜无害"的华为云连接，一条就顶掉了九条 Adobe 的总和。**

这里有个很容易混淆的点：占**代理流量**和占**总带宽**是两件事。Adobe 那九条走的是付费节点，流量是实打实要计费的，看着心疼；但真正把下行带宽吃掉的是那条 DIRECT。如果只是"感觉慢"，后者才是主因；如果是"机场流量跑得飞快"，前者才是。

至于华为云那 27 MB 是谁拉起来的——我查了 npm registry、`~/.npmrc`、pip 配置、Shell 的 rc 文件，没有任何地方配了华为云镜像。它可能是某个安装脚本里硬编码的国内 CDN，也可能就是 dsh-pet 安装过程的一部分。**没能定位到归属**，而等我去查的时候那个进程已经消失了，多半是一次性下载跑完了。这条留作悬案。

## 三、`ccmdls.adobe.com` 到底是什么

`ccmdls` = Creative Cloud Media Download Service。Adobe Creative Cloud 桌面端的下载 CDN，负责拉应用安装包和更新包。

它有几个特点，凑在一起就很容易被误判成"偷跑"：

- **多线程**。一次开十几条并发连接是它的正常工作模式，不是异常行为。
- **后台常驻**。不需要你打开 Photoshop，Creative Cloud 的守护进程自己就会去检查、去预下载。
- **不容易被用户感知**。它不弹窗、不占前台，只在网络面板里留下一排记录。

所以从用户视角看，它就是"我没动它，它自己在跑"。

## 四、动手：先杀一轮

判断清楚之后就是清理。先把能看到的全找出来：

| PID | 进程 |
|---|---|
| 1511 / 1652 | Creative Cloud 主程序 + helper |
| 1581 / 2710 | Adobe Desktop Service |
| 1536 | AdobeIPCBroker |
| 1660 | Core Sync |
| 7361 | ACCFinderSync（Finder 扩展） |

一整套，齐活。

先试优雅退出：

```bash
osascript -e 'quit app "Creative Cloud"'
# 0:25: execution error: Creative Cloud got an error: A privilege violation occurred. (-10004)
```

被拒了——终端没有自动化（Automation）权限，AppleScript 管不到它。那就直接发信号。

有意思的是，在发出退出请求之后的**四秒钟内**，系统里多出了 6 个新的 `Creative` 进程（16306 到 16355）。这不像是在退出，倒像是在派生下载 worker。最后是 `kill -TERM` 连着打了几轮，连新生的带老的一起端掉，才算清空。

但真正麻烦的不是"怎么杀"，而是**为什么杀了之后它还会自己站起来**。

## 五、它为什么会自己起来

`~/Library/LaunchAgents` 里干净得很，一个 Adobe 的都没有。我一开始还以为是自己看漏了，结果 `ls` 出来只有 Google 的三个更新器、Steam 的清理脚本、Clash Verge，以及我自己的两个服务。

Adobe 的东西全在系统级：

```
/Library/LaunchAgents/com.adobe.AdobeCreativeCloud.plist
/Library/LaunchAgents/com.adobe.ccxprocess.plist
/Library/LaunchDaemons/com.adobe.acc.installer.v2.plist
```

打开看，第一个长这样：

```xml
<key>ProgramArguments</key>
<array>
  <string>.../Creative Cloud.app/Contents/MacOS/Creative Cloud</string>
  <string>--showwindow=false</string>
  <string>--onOSstartup=true</string>
</array>
<key>RunAtLoad</key>
<true/>
```

`--onOSstartup=true`、`--showwindow=false`、`RunAtLoad` 为真——开机就拉起来，而且不显示窗口。第二个 `ccxprocess` 更直接，参数写着 `--openAtBoot`。

注意这两个文件的所有者是 `root:wheel`。这意味着**普通用户改不了它**，也意味着后面那个开关只能另想办法。

## 六、核心发现：你关掉的那个开关，是假的

既然 Creative Cloud 的设置里有开关，那就在里面关。界面很配合地给了两个，我都关了：

- General → `Launch Creative Cloud at login` → 关
- Apps → `Auto-update` → 关

然后界面上弹出一条黄色警告：

> Adobe Creative Cloud login items must be turned on for some settings to work. To make this change, go to system settings and then refresh this dialog.

翻译成人话：**你的系统把 Adobe 的后台项拦住了，所以这个对话框改不动东西。**

看到这句话就该警惕了。于是回到命令行验证——果然，`plist` 一个字节都没变：

```
-rw-r--r--  1 root  wheel  661 Jun 23 17:11  com.adobe.AdobeCreativeCloud.plist
RunAtLoad => true
```

修改时间还是 6 月 23 日。**界面上的"关"，没有写进这个文件。**

那它写到哪去了？macOS 从 Ventura 开始，后台项的开关不再直接写 plist，而是记在系统的 BTM（Background Task Management）数据库里。用 `sfltool dumpbtm` 能看到这个库——不需要 sudo 就能读：

```
Name: Adobe Creative Cloud
Type: developer (0x20)
Disposition: [disabled, allowed, notified]
```

上层这一条是 `disabled`，符合预期。但往下翻两个子项，就不对了：

```
Name: Creative Cloud                 (8.com.adobe.AdobeCreativeCloud)
Disposition: [enabled, disallowed, notified]
Generation: 19

Name: Creative Cloud Content Manager (8.com.adobe.ccxprocess)
Disposition: [enabled, disallowed, notified]
Generation: 11
```

再去 launchd 自己的 override 数据库里对一遍：

```bash
launchctl print-disabled gui/$(id -u)
```

```
"com.adobe.AdobeCreativeCloud" => enabled
```

于是三层的状态摆在一起，是这样的：

| 层 | 记录位置 | 状态 |
|---|---|---|
| plist 文件 | `/Library/LaunchAgents/*.plist` | `RunAtLoad = true`，未被修改 |
| BTM（系统设置里那个"允许在后台"） | 系统数据库 | 父项 `disabled` |
| launchd override | `disabled.501.plist` | **`enabled`** |

**三层，三个答案。** 用户看的是第一层体现出来的表象（开关是灰的/关的），决策实际由第三层做，而第二层还在中间拦着，导致前两层谁也没法和对方同步。这就是为什么界面上"已经关了"，重启后照样会起来。

那两个 `Generation: 19` / `11` 也很说明问题——这个计数每次重新注册都会涨，涨到十几，说明它们被反复重新注册过很多轮。

## 七、真正生效的一行

关键在于：launchd 的 override 数据库属于**用户自己的 domain**，改它不需要 root：

```bash
launchctl disable gui/$(id -u)/com.adobe.AdobeCreativeCloud
launchctl disable gui/$(id -u)/com.adobe.ccxprocess
```

再查就对了：

```
"com.adobe.AdobeCreativeCloud" => disabled
"com.adobe.ccxprocess"         => disabled
```

这个状态写入 `/var/db/com.apple.xpc.launchd/disabled.501.plist`，重启后依然有效。而且是可逆的——哪天想恢复：

```bash
launchctl enable gui/$(id -u)/com.adobe.AdobeCreativeCloud
```

不用重装、不用改系统文件、不用 sudo。**这比"删除 plist"好得多**：删了下次更新又给你装回来，而 disable 是一条持续生效的表态。

## 八、收尾与残留

清完之后的状态：

```
进程 0 个 | 外连 0 条
com.adobe.AdobeCreativeCloud => disabled
com.adobe.ccxprocess         => disabled
```

还剩一个没处理，因为它在系统级、需要 root：

```
/Library/LaunchDaemons/com.adobe.acc.installer.v2.plist
→ /Library/PrivilegedHelperTools/com.adobe.acc.installer.v2
BTM: [enabled, disallowed, notified]   Last Use: 2026-11-11 22:43:49
```

这是以 root 运行的特权助手。它有可能把上面两个 agent 重新注册回来（`Generation` 一直涨，很难说跟它无关）。要处理得自己输密码：

```bash
sudo launchctl disable system/com.adobe.acc.installer.v2
```

我暂时留着它了——先观察一轮重启。**毕竟"杀掉"和"重启后不复现"是两件事，只有后者才算验收。**

## 九、几条可复用的原则

这次排查里有几个坑，值得单独记下来：

**1. 别用观感判断谁在占带宽，看数字。**
九条醒目的代理连接加起来 9.5 MB，被一条不起眼的直连单挑——27.1 MB。前者扎眼是因为它"不该在"，后者隐形是因为它"看着合理"。

**2. 区分"占代理流量"和"占带宽"。**
两个指标，两套优化目标。走直连的下载不会消耗你的机场配额，但一样会把你的下行带宽吃干净。

**3. 杀完要看有没有 respawn，别急着宣布胜利。**
我这轮里，第一次清完之后 `Core Sync` 还在（我的匹配规则漏了它），`AdobeIPCBroker` 更是被杀掉后自己又起了一次。进程管理器里看着空，不代表真的空。

**4. 关了 UI 开关，一定回命令行验一遍。**
`RunAtLoad` 还是不是 true？plist 的 mtime 有没有变？`launchctl print-disabled` 怎么说？UI 呈现的是它以为的状态，不是系统实际的状态。这次要不是多查了一步，我会一直以为已经关了。

**5. macOS 的后台项是三层结构，不是一层。**
plist 文件、BTM 数据库、launchd override。三层会打架，而且打架的时候没有任何提示——只有那条"login items must be turned on"的横幅，看着像是让你去打开，实际是在告诉你"我这层被拦了，别指望我"。

## 附：日常复查用的一行命令

```bash
echo "进程 $(pgrep -f 'Adobe|Creative Cloud|Core Sync|CCXProcess' | wc -l | tr -d ' ') | 外连 $(lsof -nP -i TCP -sTCP:ESTABLISHED | grep -ci 'adobe')"
launchctl print-disabled gui/$(id -u) | grep -i adobe
```

正常状态应该是 `进程 0 | 外连 0`，加两行 `disabled`。

最后补一句：如果哪天你发现某个 Adobe 应用自己打开了（Photoshop、Illustrator、InDesign），它顺带拉起 Creative Cloud 和 Desktop Service 是正常行为，不算"偷偷自启"。判断标准得是**重启之后它还活着**，而不是"现在它在运行"。

排查时间：2026-11-12 凌晨，macOS + Clash Verge Rev。文中命令在用户级 domain 内均可免 sudo 执行，系统级项需 root 权限。
