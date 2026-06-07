# 🤖 AI Companion Robot Server

WebSocket 服务端，支持 ESP32 等硬件设备的语音对话。

## 功能特性

- **WebSocket 长连接**：设备保持与服务器的实时连接
- **ASR 语音识别**：音频 → 文字 (Tencent/火山引擎/讯飞)
- **LLM 对话**：Kimi/OpenAI 智能对话
- **TTS 语音合成**：文字 → 音频播放 (Tencent/火山引擎/讯飞)
- **会话管理**：多设备对话上下文
- **Redis 存储**：(可选) Redis 会话持久化

## 快速开始

### 1. 安装依赖

```bash
cd ai-companion-server
npm install
```

### 2. 配置

复制并编辑配置文件：

```bash
cp .env.example .env
```

填写你的 API 密钥：

```env
# 优先 Tencent
AI_PROVIDER=tencent
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key

# LLM (Kimi)
LLM_PROVIDER=kimi
KIMI_API_KEY=your_kimi_api_key
```

### 3. 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 4. 测试

```bash
# Health check
curl http://localhost:8081/health

# WebSocket test (需要 ws client)
# 连接 ws://localhost:8080
```

## ESP32 设备协议

### 连接流程

```
设备                    服务器
  |                       |
  |---- WebSocket ------->|
  |<---- welcome --------|
  |                       |
  |---- register -------->|
  |<---- registered ------|
  |                       |
```

### 消息格式

#### 设备 → 服务器

```json
// 注册
{ "type": "register", "payload": { "deviceId": "device-001" } }

// 上传音频
{ "type": "audio", "payload": { "audio": "base64_encoded_pcm" } }

// 重置会话
{ "type": "reset" }
```

#### 服务器 → 设备

```json
// 欢迎
{ "type": "welcome", "clientId": "xxx", "message": "Connected" }

// 注册确认
{ "type": "registered", "deviceId": "device-001" }

// ASR 结果
{ "type": "asr", "text": "识别的文字" }

// LLM 回复
{ "type": "llm", "text": "AI的回复" }

// TTS 音频
{ "type": "audio", "audio": "base64_encoded_mp3", "format": "mp3" }

// 错误
{ "type": "error", "message": "错误信息" }
```

## 目录结构

```
ai-companion-server/
├── .env.example     # 环境变量模板
├── package.json
└── src/
    ├── index.js    # 入口
    ├── config.js  # 配置
    ├── asr/      # 语音识别
    │   ├── processor.js
    │   ├── tencent.js
    │   └── volcengine.js
    ├── tts/      # 语音合成
    │   ├── processor.js
    │   ├── tencent.js
    │   └── volcengine.js
    ├── llm/      # 对话模型
    │   ├── chat.js
    │   ├── kimi.js
    │   └── openai.js
    ├── websocket/
    │   └── server.js
    └── storage/
        ├── redis.js
        └── session.js
```

## 部署

### 本地部署

```bash
PORT=8080 HOST=0.0.0.0 npm start
```

### 服务器部署

1. 上传代码到服务器
2. 配置 .env
3. 使用 PM2 运行

```bash
npm install -g pm2
pm2 start src/index.js --name ai-companion
pm2 save
pm2 startup
```

### Docker (可选)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

## 云服务配置

### Tencent Cloud (优先)

| 服务 | 说明 |
|------|------|
| ASR | 语音识别 - 16k_zh |
| TTS | 语音合成 - 基础音色 101001 |
| 配置 | SecretId/SecretKey |

### 火山引擎 (备选)

| 服务 | 说明 |
|------|------|
| ASR | 豆包语音识别 2.0 |
| TTS | Seed-TTS |
| 配置 | API Key |

### 讯飞语音 (备选)

| 服务 | 说明 |
|------|------|
| ASR | iat |
| TTS | xiaoyan |
| 配置 | AppId/APIKey/APISecret |

### LLM

| 模型 | 说明 |
|------|------|
| Kimi | moonshot-v1-8k (优先) |
| OpenAI | gpt-3.5-turbo (备选) |

## 故障排除

### 连接失败

```bash
# 检查端口
netstat -tlnp | grep 8080

# 检查防火墙
sudo firewall-cmd --list-ports
```

### API 错误

```bash
# 查看日志
tail -f logs/*.log

# 调试模式
LOG_PRETTY=true AI_PROVIDER=debug npm run dev
```

## License

MIT