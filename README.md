# 惠东双月湾 · 天气仪表盘

> 实时聚合海况、天气、天文数据，专为双月湾海边场景设计的 Cloudflare Worker 应用。
> 
> 🌐 线上地址：[moon.460001.xyz](https://moon.460001.xyz)

---

## 项目架构

```
moon-dashboard/
├── src/
│   ├── index.js          # Worker 主入口：路由分发 + 数据聚合 + KV 缓存
│   ├── cache.js          # KV 缓存工具层（TTL 管理）
│   └── apis/
│       ├── windy.js      # Open-Meteo 适配器（气象 + 海浪）
│       ├── owm.js        # OpenWeatherMap 适配器（当前天气 + 预报）
│       └── astro.js      # Sunrise-Sunset 适配器（日出日落）
├── public/
│   └── index.html        # 前端单页应用（原生 JS，无框架）
├── .github/
│   └── workflows/
│       └── review.yml    # CI 代码审查（引用中央工作流）
└── wrangler.toml         # Cloudflare Worker 配置
```

---

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| **运行时** | Cloudflare Workers | 边缘计算，全球低延迟 |
| **缓存** | Cloudflare KV | API 响应缓存，减少外部请求 |
| **静态资源** | Cloudflare Assets | `public/` 目录直接托管 |
| **自定义域名** | `moon.460001.xyz` | 绑定在 Worker 路由上 |
| **前端** | 原生 HTML/CSS/JS | 无框架，单文件，玻璃拟态设计 |

---

## 数据来源

| API | 用途 | 密钥 |
|---|---|---|
| [Open-Meteo](https://open-meteo.com/) | 气象预报 + 海浪数据 | 免费，无需 Key |
| [OpenWeatherMap](https://openweathermap.org/) | 当前天气 + 5 天预报 + 异地对比 | 免费 Key（存于 CF Secret） |
| [Sunrise-Sunset](https://sunrise-sunset.org/api) | 日出日落 + 曙暮光时间 | 免费，无需 Key |

---

## API 接口

| 路径 | 说明 | 缓存 TTL |
|---|---|---|
| `GET /api/now` | 聚合当前天气、海况、日出日落、异地对比 | 10 分钟 |
| `GET /api/forecast?type=hourly` | 未来 48 小时逐小时预报 | 1 小时 |
| `GET /api/forecast?type=daily` | 未来 8 天逐日预报 | 3 小时 |
| `GET /api/astro?date=YYYY-MM-DD` | 指定日期天文数据 | 24 小时 |
| `GET /api/health` | 健康检查 | 无缓存 |

---

## 前端功能

- **当前气象卡片**：温度、风速、阵风、湿度、气压、云量（Open-Meteo）
- **当前天气卡片**：体感温度、天气描述、能见度（OpenWeatherMap）
- **日出日落卡片**：日出日落、民用/天文曙光、日照时长
- **水上户外指数**：基于浪高、风速、气温、降水的智能评分
  - 🏊 **游泳下海**：浪高 < 0.6m，风速 < 5m/s，气温 23–34°C
  - 🤿 **浮潜观光**：浪高 < 0.4m，云量 < 60%，风速 < 4.5m/s
  - 🎣 **户外海钓**：浪高 0.3–0.9m（微波最佳），风速 2–6.5m/s
- **逐小时预报**：未来 24 小时滚动展示
- **异地天气对比**：双月湾 / 湖南浏阳 / 昆明太平 / 墨西哥坎昆

---

## 本地开发

```bash
# 配置本地密钥
echo "OWM_API_KEY=你的key" > .dev.vars

# 启动本地开发服务器
npx wrangler dev --port 8788

# 部署到 Cloudflare
npx wrangler deploy

# 清除 KV 缓存（强制刷新数据）
npx wrangler kv key delete --binding CACHE_KV --remote "now:22.6:114.9"
```

---

## CI 工作流

推送后自动触发四步代码审查（引用 [collar2023/.github](https://github.com/collar2023/.github) 中央工作流）：

```
① JS 语法检查   →   ② ESLint   →   ③ npm audit   →   ④ Gitleaks 密钥扫描
```
