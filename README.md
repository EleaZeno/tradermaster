
# TraderMaster - 经济模拟游戏

## 项目介绍
EcoTycoon AI (TraderMaster) 是一个基于React和TypeScript的复杂经济模拟游戏，玩家可以在虚拟世界中创建公司、进行商品交易、投资股票、制定经济政策等。

## 核心功能
- **市场经济系统**：真实的供需机制和限价订单簿 (Limit Order Book)
- **企业管理**：创建和管理不同行业的公司，设定工资与价格
- **金融市场**：股票、商品和期货交易，实时K线图
- **银行系统**：央行货币政策 (泰勒规则) 和通胀控制
- **人口模拟**：AI驱动的居民行为 (基于效用函数与消费倾向)
- **政府政策**：税收、财政政策和社会福利调节
- **AI助手**：智能市场分析和经济建议 (Gemini AI)

## 技术架构
- **前端框架**：React 18 + TypeScript 5.2
- **构建工具**：Vite 5.1
- **样式框架**：Tailwind CSS 3.4
- **状态管理**：Zustand 4.5 + Immer 10.0
- **数据可视化**：Recharts 2.12
- **开发工具**：ESLint, Prettier, Husky, Vitest

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   复制 `.env.example` 为 `.env.local` 并设置 `GEMINI_API_KEY` (可选，用于AI功能)。

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **运行测试**
   ```bash
   npm run test
   ```

## 经济概念
- **供需关系**：所有商品价格由市场限价订单簿 (LOB) 撮合决定。
- **生产函数**：采用 Cobb-Douglas 生产函数模拟产出 (Y = A * K^α * L^β)。
- **货币政策**：央行根据泰勒规则 (Taylor Rule) 自动调节利率以控制通胀。
- **验证实验室**：内置经济学模型校准 (如菲利普斯曲线验证)。

## 贡献
欢迎提交 Pull Request 来改进游戏机制或修复 Bug。

## 许可证
MIT
