# GitHub Pages + Supabase：给个人网站增加跨设备购买记录

原本只有文章展示的个人网站，这次增加了一个可以手工登记、修改和保存购买记录的功能。网页继续放在 GitHub Pages，记录保存到 Supabase；手机和电脑登录同一个网站账号，就能维护同一份数据。

本文整理最终方案、配置方法和实际遇到的账号问题。完成重新登录后，云端保存已恢复正常。

## 一、为什么需要云端数据库

购买记录需要随时新增，也要能在另一台设备上继续维护。本机版把记录放在浏览器的 localStorage 中，适合单个浏览器使用；换设备、换浏览器或清除站点数据后，不能直接读取原来的记录。

GitHub Pages 提供静态网页托管，可以运行浏览器中的 JavaScript，但没有随站点提供可写的数据库。可以让网页连接外部服务，把展示页面和数据存储分别交给 GitHub Pages 与 Supabase。

| 组件 | 在本项目中负责什么 |
| --- | --- |
| GitHub Pages | 发布页面、样式和前端代码 |
| Supabase Auth | 网站邮箱登录与账号身份验证 |
| Supabase PostgreSQL | 保存购买明细 |
| 数据库行级权限（RLS） | 限制每个账号只能维护自己的记录 |
| 浏览器 | 展示记录、处理输入、调用云端接口 |

网页代码可以公开，实际购买记录留在数据库中，不随文章或代码提交到公开仓库。

## 二、最终实现了哪些功能

- 新增、修改和删除购买记录，字段包含日期、美元金额、人民币实付和备注。
- 自动计算累计美元、累计人民币投入和平均购汇成本。
- 使用邮箱和独立的网站密码登录。
- 登录后读取云端记录，也可以点击“刷新云端”获取最新数据。
- 将原来本机版的记录导入云端，保留本机原记录。
- 导出、导入 JSON 备份，以及打印或保存 PDF。
- 保留购汇计划展示，计划只有实际执行并登记后才计入汇总。

平均购汇成本的计算方式是：

```text
平均购汇成本 = 累计人民币实付 ÷ 累计购入美元
```

人民币实付填写实际扣款金额，购入美元填写实际到账金额。这个页面统计购买成本，没有实现卖出后的剩余持仓核算。

## 三、Supabase 的配置步骤

### 1. 创建项目并取得前端配置

创建 Supabase 项目后，取得 Project URL 和 Publishable key。前端配置的形式如下，示例值需要替换为自己的项目配置：

```javascript
window.RAIN_USD_CLOUD = {
  url: 'https://your-project.supabase.co',
  publishableKey: 'sb_publishable_your_public_key'
};
```

Publishable key 可以用于浏览器。它标识访问项目的应用，用户登录身份和数据库权限仍需另外验证。Secret key、service_role key 和数据库密码不能放进网页或公开仓库。

### 2. 创建表与账号权限

本项目的表名为 `public.usd_purchases`。`user_id` 关联 Supabase 登录用户的 `auth.users(id)`，用于明确每条记录属于哪个账号。

关键字段如下：

| 字段 | 含义 |
| --- | --- |
| id | 购买记录的唯一 ID |
| user_id | 记录所属的网站账号 ID |
| purchase_date | 实际购买日期 |
| usd / cny | 美元金额 / 人民币实付 |
| note | 备注 |
| revision | 修改版本标识，用于检测其他设备的变更 |
| created_at | 创建时间 |

建表时还设置金额范围、备注长度和 RLS。未登录用户没有表的读写权限；登录用户的查询、新增、修改、删除都需要满足 `auth.uid() = user_id`。

完整脚本见[本网站使用的建表与权限 SQL](https://rainwang628.github.io/rain-docs/usd-cloud-schema.sql)。这是首次初始化脚本，已经建表后不要整份重复执行；修改现有数据库应使用单独的迁移脚本。

### 3. 设置登录跳转地址

在 Authentication 的 URL Configuration 中配置：

```text
Site URL
https://rainwang628.github.io/rain-docs/

Redirect URLs
https://rainwang628.github.io/rain-docs/tools/usd-cloud/
```

自己的站点需要替换成对应地址。项目型 GitHub Pages 带有仓库路径，这里不能遗漏 `/rain-docs/`。

### 4. 准备网站账号

首次创建账号可以在 Authentication → Users 中添加用户，设置自己的邮箱和独立的网站密码。如果邮箱已经存在，应保留原账号，使用已有密码登录，或通过网页的“设置／忘记网站密码”入口完成密码设置。

网站登录密码、Google 密码、GitHub 密码、Supabase 控制台登录方式和数据库密码是不同用途的凭据。维护这份购买记录只需要网站账号；设置网站密码不会修改其他平台的密码。

## 四、遇到的三个报错及处理方式

### 1. email rate limit exceeded

最初使用邮件登录链接，发送邮件时出现了额度限制。Supabase 默认邮件服务有每小时 2 封的限制，密码恢复邮件也会受邮件服务限制。

最终把日常登录改成邮箱加网站密码，登录时不再请求发送邮件。首次设置密码或忘记密码时才走邮件验证；如果额度已经用完，需要等待恢复，或配置自定义 SMTP。此前收到的登录链接仍有效时，也可以打开链接，登录后设置网站密码。

### 2. A user with this email address has already been registered

这个提示表示邮箱对应的账号已经存在，不能再按新用户创建。

正确做法是保留已有用户，完成密码设置后登录。重复注册不是解决登录问题的方法，删除后重建账号还会改变账号 ID。

### 3. violates foreign key constraint usd_purchases_user_id_fkey

这次实际遇到的原因是重新创建了用户，而网页仍持有旧用户的登录会话。即使新旧账号使用同一邮箱，账号 ID 也不同；旧 ID 已不在 `auth.users` 中，新记录引用它时就会被外键拒绝。

处理方式是退出网站账号，再用重新创建的账号登录，然后保存。用户完成这一操作后，云端保存恢复正常。

Supabase 删除用户后不会立即让浏览器自动退出，因此不能把页面仍显示“已登录”当成账号仍存在的证明。网页也补上了保存前的 `getUser()` 验证、清晰的报错提示，以及退出和重新登录时保留未保存输入的处理。

这里的输入保留发生在当前页面中，不等于刷新或关闭页面后仍能恢复。尚未保存的内容，应先保存成功或另行记下再刷新。

如果重新登录后仍然出现同一外键报错，还需要检查实际数据库外键是否指向 `auth.users(id)`，以及写入的 `user_id` 是否来自当前登录用户。不要直接删除外键或关闭 RLS 来消除错误。

## 五、日常使用与跨设备维护

1. 在手机或电脑打开[美元购汇记录 · 云端版](https://rainwang628.github.io/rain-docs/tools/usd-cloud/)，登录同一网站账号。
2. 填写购买日期、实际到账美元、人民币实付，确认后保存。
3. 换设备后打开页面，或点击“刷新云端”，读取数据库中的最新记录。
4. 定期导出 JSON 备份；需要查看或分享整理好的记录时，可打印为 PDF。

目前通过打开页面和手动刷新读取最新数据，没有实现其他设备修改后自动实时推送。两台设备同时修改同一条记录时，修改和删除会检查 revision；发现记录已变化则阻止覆盖，要求刷新后重试。

本机迁移和备份导入按记录 ID 去重，只新增尚不存在的记录，不覆盖云端已有记录。若同一笔交易在两处被独立创建成不同 ID，仍需手工核对重复项。

## 六、这次改造的经验

静态网站也可以提供跨设备的数据维护功能：页面继续由 GitHub Pages 发布，账号和数据交给外部云服务。实施时，账号身份、表的外键关系、访问权限和登录状态需要一起考虑。

对已有账号优先修复登录方式。删除并重建用户会改变身份 ID，本项目的外键还设置了 `ON DELETE CASCADE`，删除账号会连带删除其购买记录，因此不能把删号重建作为日常排障手段。

本次已确认重新登录后的云端保存正常。跨设备读取、权限隔离和并发修改保护属于当前实现；新增设备时仍应登录同一账号，实际检查记录能否读取和维护。

## 官方参考

- [GitHub Pages 的静态托管说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Supabase API key 的用途与权限](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase 邮箱密码登录与密码恢复](https://supabase.com/docs/guides/auth/passwords)
- [Supabase 用户管理与删除后的登录状态](https://supabase.com/docs/guides/auth/managing-user-data)
