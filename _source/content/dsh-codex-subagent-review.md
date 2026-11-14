# DSH 会话里让 Codex 复审方案：原生子任务的装法与代价

> 记录日期：2026-11-15。环境：Apple Silicon macOS、DeepSeek Harness 0.2.2-rc.3、dsh-codex-subscription 3.2.16、ChatGPT 订阅登录。
>
> 目标：DSH 会话进行到一半时，能自动把方案交给 Codex 复审，并把它的反对意见带回来。本文记录实际走通的装法、踩过的坑、以及这件事的真实成本——**一次简短审阅大约吃掉 4% 的订阅额度**，不是随手能调的。

## 最终结果

- 插件「Codex 订阅」的子任务后端切到 Codex 后，会话里的 `subagent` 已经路由到订阅模型：发一句自检，回的是「我是基于 GPT-6 的 Codex」。
- 插件自带 `codex-cli 0.167.0` 的平台二进制补齐，`--version` 输出正好是插件要求的 `codex-cli 0.167.0`。
- 官方 bundle 的入口被停用、包保留，避免两套 Codex 混用时报 400。
- 一次审阅的实测量级：3.9k / 7.7k / 14k tokens（带联网搜索那一次最高），按额度看约 4%。

## 一、先分清三个「Codex 组件」

这套东西最容易绕晕的地方，是同一台机器上会同时存在三份和 Codex 有关的包，各自职责不同：

| 组件 | 内容 | 体积 | 作用 |
| --- | --- | --- | --- |
| `dsh-codex-subscription` | 插件本体 | ~2.9 MB | 登录订阅、模型选择、出图、连接器 |
| `@deepseek-ai/dsh-subagent-codex` | 官方 bundle + 内置 `@openai/codex` 0.153.4 | 228 KB + 275 MB | 「官方 Codex 独立子任务」适配器 |
| `dsh-codex-subtask-cli` | 别名指向 `@openai/codex@0.167.0` | 366 MB 平台二进制 | 插件实际执行时用的 CLI |

关键点：插件**不执行**官方 bundle 里那份 0.153.4，它只用适配器包做运行时校验，真正的子进程是插件自己那份 0.167.0。所以适配器包必须装着、不能卸，而它的入口又最好停用（见第四节）。

## 二、三种失败，原因不同

### 1. 没配模型：父会话的模型名被原样发给 Codex

官方 bundle 的 provider 没有默认 `model`，不配就继承父会话，于是把 `deepseek-flash` 当模型名发给 Codex，直接 400。这不是配置写错，是缺省行为。

### 2. 内置 CLI 太老：认不出账号里的新模型

同一份 0.153.4，实测结果：

```text
-m gpt-6.1-terra → 400 model_not_found: The 'gpt-6.1-terra' model is not supported when using Codex with a ChatGPT account
-m gpt-5.6-luna  → 正常返回
```

也就是说给 bundle 配 `model: gpt-5.6-luna` 能救活，但模型档位被锁死在这一档。要跟账号里的 6.x 对齐，只能等 bundle 升级内置 CLI，或改用插件那套 0.167.0。

### 3. 最隐蔽的一种：安装被中断，界面却说装好了

插件的「准备 CLI」走 pnpm 装 `dsh-codex-subtask-cli`。这次安装跑到 `resolved 150, downloaded 2, added 1` 就没了下文——没有 `Done in`，因为中途重启了 DSH。

结果是**清单和锁文件都写好了，平台二进制没落地**。于是：

- 插件的静态检查（依赖声明、包版本）全部通过，界面显示「已安装」；
- 真正调用时，wrapper 用 `require.resolve('@openai/codex-darwin-arm64')` 解析到 bundle 带进来的那份 0.153.4，吐出 `codex-cli 0.153.4`；
- 插件启动子进程时严格比对 `codex-cli 0.167.0`，不匹配就拒绝运行。

**这就是「装好了但报错」的全部真相**：不是版本冲突，是安装只完成了三分之二。

判断方法很简单：

```bash
ls ~/.dsh/profiles/desktop/node_modules/dsh-codex-subtask-cli/node_modules/@openai/
ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" \
  ~/.dsh/profiles/desktop/node_modules/dsh-codex-subtask-cli/bin/codex.js --version
```

目录为空、或版本号不是 0.167.0，就是没装完。

## 三、补装：用 DSH 自带的 pnpm 续上

系统里没有全局 node / pnpm，但 DSH 自带了一份（与插件管理器同版本 11.28.5），可以用 Electron 的 node 模式跑：

```bash
cd ~/.dsh/profiles/desktop
ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" \
  ~/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.cjs \
  add --save-exact --ignore-scripts dsh-codex-subtask-cli@npm:@openai/codex@0.167.0
```

本次耗时 2 分 34 秒，下载 366 MB，结束后 0.167.0 的平台包正确嵌套在 `dsh-codex-subtask-cli/node_modules/@openai/` 下。补完后 `package.json` 与 `pnpm-lock.yaml` 都没有变化——它们本来就是完整的，缺的只是 `node_modules`。

补装前建议把两份文件各留一份备份，`pnpm add` 会重新计算依赖树，出问题好回退。

## 四、停用官方 bundle 的入口，但保留包

两套并存时，`subagent_codex` 那个工具会带着 0.153.4 冒出来，调用即 400。在 profile 的 `cordis.patch.yml` 末尾加两条即可（`disabled` 只停入口，不影响包被解析）：

```yaml
- id: subagent-codex
  disabled: true
- id: tool-subagent-codex
  disabled: true
```

注意两点：id 补丁是**整体替换** config，不要在这两条里再写别的配置；以后重装这个 bundle，补丁仍然生效，要恢复就删掉这两条。

## 五、验证与成本

验证只要一句：

```text
subagent → 「你是什么模型？」
返回：我是基于 GPT-6 的 Codex
```

成本要单独说，因为它决定了用法：

| 场景 | tokens | 备注 |
| --- | --- | --- |
| 一句自检 | 3.9k | 不含工具调用 |
| 一次短问 + 联网搜索 | 7.7k | 会自己去搜资料 |
| 一次带代码/配置的审阅 | 14k | 实测约占订阅额度 4% |

结论很直接：**这不该每轮都调**。只在方案定稿、不可逆操作、多步长任务、或自己确实拿不准的时候调用一次；把问题合并成一次问完，比连问三次省得多。它的系统提示本身就不小，短问题也要几 k tokens 起步。

## 六、升级时会咬人的地方

- 适配器包必须与 DSH 版本**完全一致**。DSH 换版本（例如升到 0.2.3 系）后，适配器可能直接失配，插件 3.2.16 也不支持 0.2.3 及预发布版。
- 插件要求的 CLI 版本是**写死**的。插件升级后如果要求变成别的版本，旧的别名会失效，而且**启动时不报错，只有选了 Codex 去调用时才会失败**。
- 平台包是可选依赖，任何一次中断、跳过或切换机器架构，都可能重演第二节第三种失败。
- 停用补丁是长期生效的；上游若改名或复用同名 ID，补丁可能失效或误禁。

## 七、回滚

1. 删掉 `cordis.patch.yml` 末尾那两条 `disabled`。
2. 需要彻底退回时，移除 `dsh-codex-subtask-cli` 别名，恢复 `package.json` 与 `pnpm-lock.yaml` 的备份。
3. 插件设置里把「子任务后端」切回 DSH，普通对话和出图不受影响。

## 未解决

- 适配器与 CLI 的协议版本需要人工对齐，没有自动跟随机制；DSH 或插件任一升级后，都得重新验一次 `--version` 与一次真实调用。
- 这套只在 macOS + 应用内自带 pnpm 的组合下验证过；其他平台的 pnpm 位置和平台包名不同。

## 复发处理

出现「界面显示已装、调用就报错」时，先跑第二节的两条命令看 wrapper 的真实版本，再决定是补装还是回滚；不要先怀疑模型或权限。
