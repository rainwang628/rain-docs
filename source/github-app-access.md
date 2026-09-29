# GitHub App 已连接，但仓库列表为空：安装授权排查

> 适用场景：ChatGPT 中已经连接 GitHub，仍无法列出或操作自己的仓库；断开并重新连接后，也没有出现重新选择 GitHub 账号或仓库的界面。

## 本次结论

**ChatGPT 中显示 GitHub 已连接，不足以证明 GitHub App 已安装到拥有仓库的账号，并获得目标仓库访问权限。** 本次账号是 `tecWang`，目标公开仓库是 `tecWang/rain-docs`。此前连接后查询仓库仍为空；检查 GitHub 的已安装应用时，也没有看到对应安装。完成 GitHub App 的安装和仓库授权后，仓库查询及文件写入恢复正常。

GitHub App 安装时，要选对个人账号或组织，并选择 **All repositories** 或 **Only select repositories**。若使用后者，目标仓库必须在授权范围内。本次最终安装在 `tecWang` 下，授权范围为全部仓库。按需只选特定仓库也可以，但新建仓库以后应再确认其授权状态。

## 排查和处理步骤

1. **确认仓库归属。** 在 GitHub 网页上打开目标仓库，核对 `所有者/仓库名`，例如 `tecWang/rain-docs`，不要只看 ChatGPT 的“已连接”状态。
2. **检查 GitHub App 安装。** 在 GitHub 的 **Settings → Applications → Installed GitHub Apps** 查看应用是否装在仓库所属的个人账号或组织下。这里和 ChatGPT 侧的插件连接是两个不同的检查点。
3. **核对仓库权限。** 打开应用的 **Configure**，核对 **Repository access**。选择全部仓库，或在仅选部分仓库时确保目标仓库已被选中；组织仓库还可能需要组织管理员批准。
4. **回到 ChatGPT 验证。** 让 GitHub 工具列出或搜索目标仓库，再读取一个已知文件。需要发布时，再验证是否有写入权限。一次成功的实际读写比反复重连后的状态提示更能说明问题已解决。

## 这次容易误判的地方

- 断开并重新安装 ChatGPT 插件时，没有重新弹出 GitHub 登录或选仓库界面；**不能据此判断 GitHub 端的安装和仓库授权已经完成**。
- 仓库是公开的，网页能打开，并不等于当前连接可以代表你写入它。
- “等五分钟就能看到新仓库”不能代替检查安装位置和授权范围；本次真正恢复的可验证节点，是 GitHub App 安装授权后，工具成功访问并写入目标仓库。
- GitHub App 仓库授权与 GitHub Pages 网站发布是两件事。工具能上传文件之后，Pages 仍需要在仓库的 Pages 设置中启用和核对。

## 给 AI 助手的结构化摘要

```yaml
topic: GitHub App connected in ChatGPT but target repository unavailable
case:
  account: tecWang
  target_repository: tecWang/rain-docs
  symptom: connected UI but empty repository results; reconnect did not prompt for account or repository selection
  observation: GitHub Installed GitHub Apps initially had no matching installation
  verified_resolution: installed GitHub App under tecWang with all-repositories access; subsequent repository reads and writes succeeded
diagnosis_order:
  - verify the exact repository owner and name
  - inspect Installed GitHub Apps for the repository-owning account or organization
  - inspect Repository access and organization approval if applicable
  - verify repository read and then a permitted write
distinguish: GitHub App access is separate from GitHub Pages deployment
```

## 官方参考

- [GitHub：安装第三方 GitHub App](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party)
- [GitHub：查看和修改已安装的 GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps)
- [OpenAI：在 ChatGPT 中连接和管理应用账号](https://help.openai.com/en/articles/20001494-connecting-and-managing-app-accounts-in-chatgpt)
