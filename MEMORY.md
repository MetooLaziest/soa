# MEMORY.md - 长期记忆

## 🚀 阿里云轻量应用服务器（IoT/AI玩偶控制项目）

- **实例ID**：e0db4fbb0e4a4856b60ca9e8569537bf
- **实例名称**：Ubuntu-SOA
- **公网IP**：47.98.103.151
- **SSH/SFTP 端口**：22
- **用户名**：root
- **密码**：123ASDasd!@#
- **说明**：用于控制 IoT 设备和 AI 玩偶的项目服务器
- **状态**：已录入，待连接测试

---

## 🔑 核心工作资料

### FTP 服务器信息
- **主机**：119.45.18.22
- **用户名**：Metoo
- **密码**：123asdl;'123ASDl;'
- **说明**：服务器下有 nginx 文件夹，整个网页项目在里面
- **关键文件**：
- `productsfuture.html` - 发布会内容页面（需基于现有样式维护）

### 腾讯文档 - 视频号发布会选题管理
- **文档链接**：https://docs.qq.com/smartsheet/DQkpaQWVQb3FORXFR
- **文档 ID**：DQkpaQWVQb3FORXFR
- **Sheet ID**：t00i2h
- **字段**：选题名称、状态（未发布/已发布）、概念摘要、视频号链接
- **用途**：管理视频号发布会选题，维护选题信息

### 网页项目
- **域名**：http://www.metooshow.com/
- **发布会页面**：http://www.metooshow.com/productsfuture.html
- **FTP路径**：119.45.18.22/nginx/html/
- **已发布产品视频号**：千里餐桌、智能香薰机、看护机器人noma、蓝牙麦克风下巴贴、冰箱守卫、吼叫对战平台、3D成像游戏王对站台、穿搭助手（麦吉衣柜）

## 当前项目与关注

- E-Pet数字生命项目持续迭代，已上线NFC型号架构、AI对话、双页面(旧版/epet/ + React新版/epet1/)，支持多宠物藏品库展示、树屋场景桌面环绕移动动画
- E-Pet数字生命项目，三宠物(团子糯糯/海浪沫沫/糖心莓莓)已定位为型号(NFC范围)而非实例，数据库架构已完成models+model_id_ranges+nfc_to_model三表重构
- E-Pet AI对话功能已接入(千问DashScope kimi-k2.6)，每只宠物有独立system prompt配置，对话路由/api/epet/:id/chat已上线
- E-Pet epet1新项目采用React+TypeScript+Vite+PixiJS v8重构，部署在/epet1/路径，与旧版/epet/并行
- E-Pet 1数字生命项目正式立项，数据库14张表+6只宠物+后端8个路由+前端React+PixiJS全栈部署
- E-Pet新版(epet1)已上线，支持藏品库/旅行/明信片/漂流瓶/商店/AI对话/小游戏7个完整功能模块
- E-Pet1已建立3个测试用户数据，庭院2只+藏品1只的模式已跑通全链路

## 经验与决策

- NFC标签扫码业务流程：物理ID查model_id_ranges得型号→查pets表判断是否激活→无则创建记录，pets表主键用nfc字段而非自增id
- E-Pet1游客模式下前端固定user_id=2，正式版改用手机号登录
- 唯一约束不区分软删除标志，软删除后需物理清理占坑记录以避免冲突
