# 饮食管理模块（2026-10-18）

## 当前状态
代码已添加到 `tools/nutrition/`，但**数据库表尚未创建**。只有在现有 Supabase 项目的 SQL Editor 执行仓库根目录 `nutrition-schema.sql` 后，网页才能保存数据。

## 首次启用
1. 打开现有网站使用的 Supabase 项目 → SQL Editor。
2. 打开仓库中的 `nutrition-schema.sql`，复制全文并执行一次。
3. 用网站主人账号登录个人网站，进入「我的模块 → 饮食管理」。
4. 新增食物库条目，再按日期和餐次记录饮食；也可以在「ChatGPT 快速导入」粘贴 JSON。

不要把 Supabase secret / service role 密钥放进 GitHub Pages 或聊天。此模块沿用网站现有的 publishable key 和 Auth，RLS 只允许 owner 读写。

## ChatGPT 快速导入格式
```json
{
  "meal_date": "2026-10-18",
  "meal_type": "breakfast",
  "items": [
    {
      "food_name": "巴比牛肉包",
      "brand": "巴比",
      "amount_g": 110,
      "kcal": 223.3,
      "protein_g": 7.26,
      "fat_g": 5.83,
      "sodium_mg": 462,
      "carbs_g": null,
      "note": "按已核实的包装营养标签折算"
    }
  ]
}
```
- `meal_type`：breakfast / lunch / dinner / snack。
- `items` 可以包含多个食物；顶层也可传一个餐次对象的数组。
- 所有营养数值都表示**本次食用份量的实际值**，而不是每100g；未知填 `null`，不要猜测。
- 导入会检查同日期、餐次、名称、重量的疑似重复条目，发现重复时中止导入；更正历史数据请在网页上编辑原记录。
- 食物库每个条目可以设置基准重量（通常100g）；选择后自动按重量折算，但可手动修正。
- 历史记录会冻结食用当时的营养数据；修改食物库不会追溯修改。

## 当前边界
- ChatGPT 目前不能直接通过现有 GitHub 连接器访问 Supabase 表；快速导入需要复制 JSON 到网页。
- 当前版本不自动将食物库标签照片上传到 Supabase Storage。
- 网站不存储体重，也不发送邮件。周报仍在 ChatGPT 对话中完成；要使用数据库作为周报依据，需要另行建立可授权的读取连接。
- 页面采用懒加载模块，避免首页为了饮食数据库等待加载。
