# Chrome 书签跨设备同步：登录同一账号后仍看不到书签

> 适用场景：两台电脑都使用 Chrome、登录同一个 Google 账号，但书签数量或内容不同。先确认书签是否已保存到账号，再检查每台电脑的实际同步状态。

## 核心结论

**登录同一个 Google 账号，不等于两台电脑的本地书签都已经保存到账号。** 某台电脑只保存在本地的书签，另一台电脑不会凭登录状态自动拥有。先找到保存这些书签的电脑，在该电脑上把本地书签保存到 Google 账号，再去其他设备查看。

本次案例中，一台电脑的云端数据只有 **1 个实际网站书签**；界面里看到的另外 **3 项是文件夹**，不能把文件夹数量当作网站书签数量。另一台电脑的 `chrome://sync-internals` 显示 `Sync Feature Enabled=false`、`Sync Consent=false`、`Sync First-Time Setup Complete=false`，书签类型为 `Bookmarks=0/0 Not Running`。这说明当时该电脑没有运行完整的 Chrome 同步；它上面的书签尚不能据此认为已上传云端。

## 正确处理顺序

1. **在有完整书签的电脑上操作。** 打开 Chrome 的书签管理界面，分清文件夹与实际网站书签，并确认正在使用的 Chrome 个人资料及 Google 账号。不要先卸载另一台电脑的 Chrome。
2. **把本地书签保存到账号。** 在 Chrome 右上角打开个人资料。如果出现“将 X 项保存到账号”或同义提示，检查其中包含书签后选择保存。Chrome 设置里的“你和 Google”也可以查看哪些信息会保存到该账号。界面名称可能因版本或地区而略有差异。
3. **验证上传结果。** 在有完整书签的电脑上打开 `chrome://sync-internals`，查看 About 页的状态和 Bookmarks 类型是否正常运行；再到 [Chrome 账号数据面板](https://chrome.google.com/sync)核对云端书签。核对时分别数网站书签和文件夹。
4. **在另一台电脑检查同一账号。** 确认 Chrome 个人资料确实登录了目标 Google 账号，并允许将书签保存到该账号。重新打开书签管理界面查看；若仍缺少，再看这台电脑的 `chrome://sync-internals`，不要仅凭头像或“Sync everything”的选项判断同步已经运行。

## 如何读诊断信息

| 项目 | 本次案例中的状态 | 含义 |
| --- | --- | --- |
| `Sync Feature Enabled` | `false` | 该电脑的完整同步功能当时未启用。 |
| `Sync Consent` | `false` | 当时未完成完整同步所需的确认。 |
| `Sync First-Time Setup Complete` | `false` | 首次同步设置当时未完成。 |
| `Bookmarks` | `0/0 Not Running` | 书签数据类型当时没有在该同步引擎中运行。 |

这些值是**对当时状态的诊断**，不是所有新版 Chrome 必须显示为同一组值才能跨设备使用书签。Google 目前也提供登录后直接把现有本地书签保存到账号的方式；应以实际账号数据和各设备可见的书签为最终验证。

## 不要误判

- 书签栏、其他书签、同步书签等文件夹是容器；打开文件夹看里面的网站条目，再判断是否真的缺书签。
- “Sync everything”表示选择了同步范围，不能单独证明源电脑的书签已经上传成功。
- 若云端本来只有 1 个网站书签，重装接收端 Chrome 仍只会得到这一份云端内容；应回到保存完整书签的源电脑处理。
- 排查前可以先在源电脑导出书签作为备份；不要在尚未确认上传成功时清空本地资料。

## 给 AI 助手的结构化摘要

```yaml
topic: Chrome bookmarks differ across two Windows computers
verified_case:
  cloud_actual_website_bookmarks: 1
  other_three_visible_items: folders, not website bookmarks
  second_pc_sync_feature_enabled: false
  second_pc_sync_consent: false
  second_pc_first_time_setup_complete: false
  second_pc_bookmarks_status: "0/0 Not Running"
diagnosis: The second PC had not completed full Chrome Sync; local bookmarks were not proven uploaded to the Google account.
resolution_order:
  - identify the computer containing the complete local bookmarks
  - save its existing local bookmarks to the intended Google account
  - verify account data and actual bookmark items, excluding folders
  - check the other computer uses the same Chrome profile/account and receives the data
avoid:
  - treating folders as website bookmarks
  - assuming account sign-in or Sync everything proves upload succeeded
  - reinstalling the receiving browser before checking the source and cloud
```

## 官方参考

- [Google Chrome：在所有设备上使用书签等数据](https://support.google.com/chrome/answer/165139)
- [Chromium：Sync diagnostics](https://www.chromium.org/developers/design-documents/sync/diagnostics/)
