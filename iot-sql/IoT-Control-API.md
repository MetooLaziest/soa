# IoT 智能家居控制接口文档

## 概述

本文档定义了 IoT 智能家居控制系统的统一控制接口，用于 ESP32 中控板与云端服务的对接。

**基础信息：**
- 基础 URL: `https://soa.laziestlife.com/api/iot`
- 认证方式: **演示模式（无需认证）**
- 数据格式: JSON
- 字符编码: UTF-8

---

## 演示模式说明

当前为演示模式，控制接口（`/control`）、模板接口（`/templates`）、日志接口（`/logs`）**无需认证**，可直接调用。

其他接口需要 API Key 认证：
- 请求头：`x-api-key: iot-demo-2026`
- 或查询参数：`?apiKey=iot-demo-2026`

---

## 统一设备控制接口

### PUT /api/iot/control

统一智能家居控制接口，所有设备控制操作均通过此接口完成。

#### 请求方式
```
PUT /api/iot/control
Content-Type: application/json
```

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| deviceMac | string | **是** | ESP32 中控 MAC 地址，格式：`XX:XX:XX:XX:XX:XX` |
| deviceType | string | **是** | 透传设备类型，见[设备类型枚举](#设备类型枚举) |
| deviceGroup | string | 否 | 设备组别，空值表示全组别，见[设备组别枚举](#设备组别枚举) |
| command | string | **是** | 控制指令，见[指令枚举](#指令枚举) |
| commandNote | string | 否 | 指令备注，透传参数（如设置空调温度等） |

#### 设备类型枚举

| 值 | 说明 | 支持指令 |
|----|------|----------|
| `light` | 灯 | on, off |
| `curtain` | 窗帘 | on, off |
| `tv` | 电视 | on, off |
| `vacuum` | 扫地机 | start, stop |
| `bath` | 洗澡水 | start |
| `purifier` | 净化器 | on, off |
| `ac` | 空调 | on, off (可通过 `commandNote` 设置温度) |

#### 设备组别枚举

| 值 | 说明 |
|----|------|
| `bedroom` | 卧室 |
| `livingroom` | 客厅 |
| `kitchen` | 厨房 |
| `bathroom` | 卫生间 |
| `study` | 书房 |
| `balcony` | 阳台 |
| `null` (空) | 全组别 |

#### 指令枚举

| 值 | 说明 |
|----|------|
| `on` | 开启（灯、窗帘、电视、净化器、空调） |
| `off` | 关闭（灯、窗帘、电视、净化器、空调） |
| `start` | 启动（扫地机、洗澡水） |
| `stop` | 停止（扫地机） |

---

#### 请求示例

##### 示例 1：开灯（客厅灯）
```json
{
  "deviceMac": "AA:BB:CC:DD:EE:FF",
  "deviceType": "light",
  "deviceGroup": "livingroom",
  "command": "on"
}
```

##### 示例 2：关灯（全屋灯）
```json
{
  "deviceMac": "AA:BB:CC:DD:EE:FF",
  "deviceType": "light",
  "command": "off"
}
```

##### 示例 3：开窗帘（卧室）
```json
{
  "deviceMac": "AA:BB:CC:DD:EE:FF",
  "deviceType": "curtain",
  "deviceGroup": "bedroom",
  "command": "on"
}
```

##### 示例 4：启动扫地机
```json
{
  "deviceMac": "AA:BB:CC:DD:EE:FF",
  "deviceType": "vacuum",
  "command": "start"
}
```

##### 示例 5：开电视（带透传参数）
```json
{
  "deviceMac": "AA:BB:CC:DD:EE:FF",
  "deviceType": "tv",
  "deviceGroup": "livingroom",
  "command": "on",
  "commandNote": "channel=5"
}
```

##### 示例 6：放洗澡水
```json
{
  "deviceMac": "AA:BB:CC:DD:EE:FF",
  "deviceType": "bath",
  "command": "start",
  "commandNote": "temperature=38"
}
```

##### 示例 7：开空调（设置温度）
```json
{
  "deviceMac": "AA:BB:CC:DD:EE:FF",
  "deviceType": "ac",
  "command": "on",
  "commandNote": "temperature=24"
}
```

##### 示例 8：关空调
```json
{
  "deviceMac": "AA:BB:CC:DD:EE:FF",
  "deviceType": "ac",
  "command": "off"
}
```

---

#### 响应说明

##### 成功响应 (HTTP 200)
```json
{
  "success": true,
  "message": "指令已下发",
  "data": {
    "logId": 123,
    "deviceMac": "AA:BB:CC:DD:EE:FF",
    "deviceType": "light",
    "deviceGroup": "livingroom",
    "command": "on",
    "commandNote": null,
    "timestamp": "2026-05-15T03:30:00.000Z"
  }
}
```

##### 错误响应 (HTTP 400/404/500)
```json
{
  "success": false,
  "error": "错误描述",
  "errorCode": "ERROR_CODE"
}
```

#### 错误码说明

| HTTP状态码 | errorCode | 说明 |
|------------|-----------|------|
| 400 | `MISSING_DEVICE_MAC` | deviceMac 参数为空 |
| 400 | `MISSING_DEVICE_TYPE` | deviceType 参数为空 |
| 400 | `MISSING_COMMAND` | command 参数为空 |
| 400 | `INVALID_DEVICE_TYPE` | 无效的设备类型 |
| 400 | `INVALID_COMMAND` | 设备不支持该指令 |
| 400 | `CONTROLLER_OFFLINE` | 中控设备离线 |
| 401 | - | 未授权，缺少 Token |
| 404 | `CONTROLLER_NOT_FOUND` | 中控设备不存在 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 辅助接口

### GET /api/iot/templates

获取支持的设备类型和指令列表。

#### 请求示例
```
GET /api/iot/templates
```

#### 响应示例
```json
{
  "templates": {
    "light": [
      { "command": "on", "commandName": "开灯", "description": "打开灯光" },
      { "command": "off", "commandName": "关灯", "description": "关闭灯光" }
    ],
    "curtain": [
      { "command": "on", "commandName": "开窗帘", "description": "打开窗帘" },
      { "command": "off", "commandName": "关窗帘", "description": "关闭窗帘" }
    ],
    "tv": [
      { "command": "on", "commandName": "开电视", "description": "打开电视" },
      { "command": "off", "commandName": "关电视", "description": "关闭电视" }
    ],
    "vacuum": [
      { "command": "start", "commandName": "启动扫地机", "description": "启动扫地机器人" },
      { "command": "stop", "commandName": "停止扫地机", "description": "停止扫地机器人" }
    ],
    "bath": [
      { "command": "start", "commandName": "放洗澡水", "description": "开始放洗澡水" }
    ],
    "purifier": [
      { "command": "on", "commandName": "开净化器", "description": "打开空气净化器" },
      { "command": "off", "commandName": "关净化器", "description": "关闭空气净化器" }
    ],
    "ac": [
      { "command": "on", "commandName": "开空调", "description": "打开空调，可通过 commandNote 设置温度" },
      { "command": "off", "commandName": "关空调", "description": "关闭空调" }
    ]
  }
}
```

---

### GET /api/iot/logs

获取控制日志。

#### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| deviceMac | string | 否 | 过滤指定中控 |
| limit | number | 否 | 返回条数，默认 50 |

#### 响应示例
```json
{
  "logs": [
    {
      "id": 123,
      "controller_mac": "AA:BB:CC:DD:EE:FF",
      "device_type": "light",
      "device_group": "livingroom",
      "command": "on",
      "command_note": null,
      "status": "sent",
      "created_at": "2026-05-15T03:30:00.000Z"
    }
  ]
}
```

---

## ESP32 端对接说明

### MQTT 订阅

ESP32 需订阅以下 Topic 接收指令：

```
iot/{deviceMac}/command
```

### 指令格式

ESP32 收到的 JSON 消息格式：

```json
{
  "logId": 123,
  "deviceType": "light",
  "deviceGroup": "livingroom",
  "command": "on",
  "commandNote": null,
  "deviceCode": "IR_CODE_001",
  "timestamp": "2026-05-15T03:30:00.000Z"
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| logId | 日志 ID，用于上报执行结果 |
| deviceType | 设备类型 |
| deviceGroup | 设备组别 |
| command | 指令 |
| commandNote | 透传参数 |
| deviceCode | 设备编码（红外码/RF码等） |
| timestamp | 时间戳 |

### 执行结果上报

ESP32 执行指令后，通过以下 Topic 上报结果：

```
iot/{deviceMac}/response
```

消息格式：
```json
{
  "logId": 123,
  "status": "success",
  "message": "执行成功"
}
```

---

## 快速测试命令

### cURL 测试

```bash
# 获取支持的设备类型和指令
curl -s https://soa.laziestlife.com/api/iot/templates

# 开灯（客厅）
curl -X PUT https://soa.laziestlife.com/api/iot/control \
  -H "Content-Type: application/json" \
  -d '{"deviceMac":"AA:BB:CC:DD:EE:FF","deviceType":"light","deviceGroup":"livingroom","command":"on"}'

# 关灯（全屋）
curl -X PUT https://soa.laziestlife.com/api/iot/control \
  -H "Content-Type: application/json" \
  -d '{"deviceMac":"AA:BB:CC:DD:EE:FF","deviceType":"light","command":"off"}'

# 开窗帘（卧室）
curl -X PUT https://soa.laziestlife.com/api/iot/control \
  -H "Content-Type: application/json" \
  -d '{"deviceMac":"AA:BB:CC:DD:EE:FF","deviceType":"curtain","deviceGroup":"bedroom","command":"on"}'

# 启动扫地机
curl -X PUT https://soa.laziestlife.com/api/iot/control \
  -H "Content-Type: application/json" \
  -d '{"deviceMac":"AA:BB:CC:DD:EE:FF","deviceType":"vacuum","command":"start"}'

# 放洗澡水（带温度参数）
curl -X PUT https://soa.laziestlife.com/api/iot/control \
  -H "Content-Type: application/json" \
  -d '{"deviceMac":"AA:BB:CC:DD:EE:FF","deviceType":"bath","command":"start","commandNote":"temperature=38"}'

# 开空调（设置温度）
curl -X PUT https://soa.laziestlife.com/api/iot/control \
  -H "Content-Type: application/json" \
  -d '{"deviceMac":"AA:BB:CC:DD:EE:FF","deviceType":"ac","command":"on","commandNote":"temperature=24"}'

# 关空调
curl -X PUT https://soa.laziestlife.com/api/iot/control \
  -H "Content-Type: application/json" \
  -d '{"deviceMac":"AA:BB:CC:DD:EE:FF","deviceType":"ac","command":"off"}'

# 查看控制日志
curl -s https://soa.laziestlife.com/api/iot/logs?limit=10
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-15 | 初始版本，定义统一控制接口 |
| v1.1 | 2026-05-18 | 新增空调控制说明，补充 commandNote 温度参数示例 |

---

## 联系方式

技术支持：[您的联系方式]
