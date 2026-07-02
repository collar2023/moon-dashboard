# moon-dashboard 部署进展

> 双月湾海边仪表盘 - Open-Meteo + OpenWeatherMap + Sunrise-Sunset 三 API 聚合
> 部署目标域名:`moon.460001.xyz`
> 最后更新:2026-07-01

## 已完成

### 1. 项目骨架
- 目录:`/home/ubuntu/workers/moon-dashboard/`
- 文件结构:
  ```
  moon-dashboard/
  ├── wrangler.toml       # Worker 配置 (route + KV)
  ├── .dev.vars           # 本地开发 secret (不进 git)
  ├── .gitignore          # 含 .dev.vars
  ├── src/
  │   ├── index.js        # 路由 + 缓存 + 抽取数据
  │   ├── cache.js        # KV 缓存工具
  │   └── apis/
  │       ├── windy.js    # Open-Meteo 适配器 (免 Key 真实预报)
  │       ├── owm.js      # OWM 2.5(免费)
  │       └── astro.js    # Sunrise-Sunset
  └── public/
      └── index.html      # 精美玻璃拟态天气仪表盘前端 (含水上户外指数卡片)
  ```

### 2. Cloudflare 资源
- **Worker**:`moon-dashboard` (已部署)
- **KV namespace**:`CACHE_KV` id `17d70e1fc9fb495c8db45d6db0a2bc32`
- **Custom domain**:`moon.460001.xyz` (已绑定)

### 3. API 适配状态

| API | 适配层 | 状态 | 备注 |
|-----|--------|------|------|
| Sunrise-Sunset | `apis/astro.js` | ✅ 正常 | 日出日落时间及各项曙光时间获取正常 |
| OpenWeatherMap | `apis/owm.js` | ✅ 正常 | 24 小时预报与天气情况获取正常 |
| Open-Meteo | `apis/windy.js` | ✅ 正常 | **数据源替换**: 原 Windy API 因免费 Key 混淆限制，已切换为无限制的 Open-Meteo |

### 4. 前端优化与决策逻辑升级
- **精简界面布局**：去除了原先占用多余空间的 `当前位置` 卡片，页面布局更为清爽紧凑；主标题与页面 title 从“海边仪表盘”更新为**“天气仪表盘”**。
- **水上户外指数扩展**：在“水上户外指数”卡片中，并排引入了 **游泳下海**、**浮潜观光**、**户外海钓** 三个大热水上项目的出行适宜度智能推荐。
- **异地天气对比**：在最底部增加了“异地天气对比”板块，实时展示并对比**惠东双月湾**、**湖南浏阳**、**昆明太平**以及**墨西哥坎昆**四个地点的经纬度坐标、当前天气、温度与湿度。
- **科学合理的决策逻辑**：
  - **游泳**：限制浪高 < 0.6m、风速 < 5m/s、气温 $23^\circ\text{C} \sim 34^\circ\text{C}$，且暴雨/强风时显示具体危险源。
  - **浮潜**：增加水下能见度评估，引入云量判断（云量 < 60% 保证水下光线），对强风、高海浪（浪高 > 0.8m 导致水下浑浊）给出不宜警示。
  - **海钓**：结合溶氧量需求，海面静水（浪高 < 0.3m）反而不易钓鱼（评定为“尚可”），唯有微波微风时最宜下钩（“爆护狂咬”）；细化气温极限，低于 $12^\circ\text{C}$ 提示 `气温过低`，高于 $35^\circ\text{C}$ 提示 `酷暑不咬钩`。
- **安全防崩溃逻辑**：加入了对 Open-Meteo 数据源返回 null/undefined 的校验。在 API 发生抖动或数据空置时，自动展示占位符 `--`，防止 JavaScript 崩溃导致卡死。

## 验证与调试

- **本地开发验证**: 通过 `npx wrangler dev --port 8788` 运行，所有接口逻辑验证成功。
- **部署验证**: 执行 `npx wrangler deploy` 已将最新版本部署至线上，并通过删除 `CACHE_KV` 远程缓存使更新即时生效。
- **线上地址**: [moon.460001.xyz](https://moon.460001.xyz)

## 调试命令速查

```bash
# 本地 dev
npx wrangler dev --port 8788

# 部署
npx wrangler deploy

# 清除 KV 缓存
npx wrangler kv key delete --binding CACHE_KV --remote "now:22.6:114.9"
npx wrangler kv key delete --binding CACHE_KV --remote "forecast:22.6:114.9:hourly"
npx wrangler kv key delete --binding CACHE_KV --remote "astro:22.6:114.9:today"
```
