# ESP32 中控板开发对接指南

## 文档说明

本文档面向单片机开发团队，说明 ESP32 中控板如何对接 IoT 智能家居控制平台。

---

## 一、系统架构

```
┌─────────────┐      HTTPS       ┌─────────────┐      MQTT       ┌─────────────┐
│  用户/前端   │ ───────────────> │  云端服务    │ <──────────────> │  ESP32中控  │
└─────────────┘                  └─────────────┘                  └─────────────┘
                                        │
                                        │ 红外/RF/串口
                                        ▼
                                 ┌─────────────┐
                                 │  受控设备   │
                                 │ (灯/窗帘/TV)│
                                 └─────────────┘
```

**工作流程：**
1. 用户通过前端页面发送控制指令
2. 云端接收指令，记录日志，通过 MQTT 推送给 ESP32
3. ESP32 收到指令，执行红外/RF 发射，控制物理设备
4. ESP32 上报执行结果给云端

---

## 二、ESP32 核心职责

### 2.1 主要功能

| 功能 | 说明 |
|------|------|
| **WiFi 连接** | 连接指定 WiFi 热点 |
| **MQTT 订阅** | 订阅 `iot/{MAC}/command` 接收指令 |
| **指令解析** | 解析 JSON 格式的控制指令 |
| **红外发射** | 发射红外信号控制家电 |
| **RF 发射** | 发射射频信号控制设备 |
| **结果上报** | 通过 MQTT 上报执行结果 |
| **心跳保活** | 定期上报在线状态 |

### 2.2 设备类型支持

| 设备类型 | 控制方式 | 说明 |
|----------|----------|------|
| `light` | 红外/RF | 灯光开关 |
| `curtain` | RF | 窗帘电机 |
| `tv` | 红外 | 电视开关 |
| `vacuum` | RF | 扫地机器人 |
| `bath` | RF | 浴缸水阀 |
| `purifier` | 红外/RF | 空气净化器 |

---

## 三、MQTT 对接规范

### 3.1 连接参数

```cpp
// MQTT Broker 配置（待确认）
const char* MQTT_BROKER = "mqtt.soa.laziestlife.com";  // 或云端IP
const int MQTT_PORT = 1883;                             // 或 8883 (TLS)
const char* MQTT_USER = "esp32_device";                 // 设备用户名
const char* MQTT_PASS = "your_password";                // 设备密码
```

### 3.2 订阅主题

ESP32 启动后，订阅以下主题：

```cpp
String subscribeTopic = "iot/" + deviceMac + "/command";
// 示例: iot/AA:BB:CC:DD:EE:FF/command
```

### 3.3 指令消息格式

云端下发的消息格式：

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

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `logId` | number | 日志 ID，**必须回传**用于匹配执行结果 |
| `deviceType` | string | 设备类型：light/curtain/tv/vacuum/bath/purifier |
| `deviceGroup` | string | 设备组别：bedroom/livingroom/kitchen/bathroom/study/balcony |
| `command` | string | 指令：on/off/start/stop |
| `commandNote` | string | 透传参数（如温度等） |
| `deviceCode` | string | 设备编码（红外码/RF码），可直接使用 |
| `timestamp` | string | 时间戳 |

### 3.4 执行结果上报

ESP32 执行完指令后，发布到：

```cpp
String publishTopic = "iot/" + deviceMac + "/response";
// 示例: iot/AA:BB:CC:DD:EE:FF/response
```

消息格式：

```json
{
  "logId": 123,
  "status": "success",
  "message": "执行成功",
  "executedAt": "2026-05-15T03:30:01.000Z"
}
```

**状态枚举：**

| status | 说明 |
|--------|------|
| `success` | 执行成功 |
| `failed` | 执行失败 |
| `timeout` | 设备无响应 |
| `unsupported` | 不支持该设备类型 |

---

## 四、ESP32 代码示例

### 4.1 基础框架（Arduino）

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <IRremote.h>

// WiFi 配置
const char* WIFI_SSID = "YourWiFiSSID";
const char* WIFI_PASS = "YourWiFiPassword";

// MQTT 配置
const char* MQTT_BROKER = "mqtt.soa.laziestlife.com";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "esp32_device";
const char* MQTT_PASS = "your_password";

// 设备 MAC 地址（自动获取）
String deviceMac;

// MQTT 客户端
WiFiClient espClient;
PubSubClient mqtt(espClient);

// 红外发射器
IRsend irsend(4);  // 红外发射引脚

void setup() {
  Serial.begin(115200);
  
  // 获取 MAC 地址
  deviceMac = WiFi.macAddress();
  Serial.println("Device MAC: " + deviceMac);
  
  // 连接 WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // 配置 MQTT
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  
  // 初始化红外
  irsend.begin();
}

void loop() {
  if (!mqtt.connected()) {
    mqttReconnect();
  }
  mqtt.loop();
}

void mqttReconnect() {
  while (!mqtt.connected()) {
    Serial.print("Connecting MQTT...");
    if (mqtt.connect(deviceMac.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println("connected");
      // 订阅指令主题
      String topic = "iot/" + deviceMac + "/command";
      mqtt.subscribe(topic.c_str());
      Serial.println("Subscribed: " + topic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // 解析 JSON
  StaticJsonDocument<512> doc;
  deserializeJson(doc, payload, length);
  
  int logId = doc["logId"];
  String deviceType = doc["deviceType"];
  String deviceGroup = doc["deviceGroup"];
  String command = doc["command"];
  String deviceCode = doc["deviceCode"];
  
  Serial.println("Received command:");
  Serial.println("  logId: " + String(logId));
  Serial.println("  deviceType: " + deviceType);
  Serial.println("  command: " + command);
  
  // 执行指令
  bool success = executeCommand(deviceType, deviceGroup, command, deviceCode);
  
  // 上报结果
  reportResult(logId, success);
}

bool executeCommand(String type, String group, String cmd, String code) {
  if (type == "light") {
    return controlLight(group, cmd);
  } else if (type == "curtain") {
    return controlCurtain(group, cmd);
  } else if (type == "tv") {
    return controlTV(cmd);
  } else if (type == "vacuum") {
    return controlVacuum(cmd);
  } else if (type == "bath") {
    return controlBath(cmd);
  } else if (type == "purifier") {
    return controlPurifier(group, cmd);
  }
  return false;
}

bool controlLight(String group, String cmd) {
  // 根据组别选择红外码
  uint64_t irCode;
  if (group == "livingroom") {
    irCode = (cmd == "on") ? 0xFFA25D : 0xFF629D;  // 示例红外码
  } else if (group == "bedroom") {
    irCode = (cmd == "on") ? 0xFF22DD : 0xFF02FD;
  }
  
  // 发射红外信号
  irsend.sendNEC(irCode);
  return true;
}

void reportResult(int logId, bool success) {
  StaticJsonDocument<256> doc;
  doc["logId"] = logId;
  doc["status"] = success ? "success" : "failed";
  doc["message"] = success ? "执行成功" : "执行失败";
  
  String topic = "iot/" + deviceMac + "/response";
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqtt.publish(topic.c_str(), buffer);
  Serial.println("Result reported: " + String(buffer));
}
```

### 4.2 红外码存储建议

建议使用 SPIFFS 或 EEPROM 存储各设备的红外码：

```cpp
// 红外码配置结构
struct IRCodeConfig {
  String deviceType;
  String deviceGroup;
  uint64_t onCode;
  uint64_t offCode;
};

// 示例配置
IRCodeConfig irCodes[] = {
  {"light", "livingroom", 0xFFA25D, 0xFF629D},
  {"light", "bedroom", 0xFF22DD, 0xFF02FD},
  {"curtain", "bedroom", 0xFFC23D, 0xFFE01F},
  // ... 更多配置
};
```

---

## 五、设备组别映射

ESP32 需要知道每个组别对应的物理设备：

| 组别 | 说明 | 建议映射 |
|------|------|----------|
| `livingroom` | 客厅 | 红外发射器 GPIO 4 |
| `bedroom` | 卧室 | 红外发射器 GPIO 5 |
| `kitchen` | 厨房 | 红外发射器 GPIO 12 |
| `bathroom` | 卫生间 | RF 发射器 GPIO 13 |
| `study` | 书房 | 红外发射器 GPIO 14 |
| `balcony` | 阳台 | RF 发射器 GPIO 15 |

---

## 六、测试验证

### 6.1 测试步骤

1. **烧录程序** - 将代码烧录到 ESP32
2. **查看串口** - 确认 WiFi 和 MQTT 连接成功
3. **记录 MAC** - 从串口输出获取设备 MAC 地址
4. **前端测试** - 在测试页面录入 MAC 地址
5. **发送指令** - 通过前端发送控制指令
6. **观察结果** - 确认 ESP32 收到指令并执行

### 6.2 调试命令

使用 MQTT 客户端工具（如 MQTTX）模拟下发指令：

```json
// 主题: iot/AA:BB:CC:DD:EE:FF/command
{
  "logId": 1,
  "deviceType": "light",
  "deviceGroup": "livingroom",
  "command": "on",
  "deviceCode": "IR_CODE_001",
  "timestamp": "2026-05-15T03:30:00.000Z"
}
```

---

## 七、常见问题

### Q1: MQTT 连接失败？

检查：
- WiFi 是否连接成功
- MQTT Broker 地址和端口是否正确
- 用户名密码是否正确
- 防火墙是否放行端口

### Q2: 收不到指令？

检查：
- 订阅主题是否正确：`iot/{MAC}/command`
- MAC 地址格式是否正确（大写，冒号分隔）
- MQTT 连接是否保持

### Q3: 红外发射无效？

检查：
- 红外发射器接线是否正确
- 红外码是否匹配设备
- 发射距离和角度是否合适

---

## 八、交付清单

开发完成后，请提供：

1. ✅ ESP32 固件代码（Arduino/PlatformIO 工程）
2. ✅ 红外码配置文件
3. ✅ 接线说明文档
4. ✅ 测试报告（各设备控制结果）

---

## 九、联系方式

技术支持：lintingrui@foxmail.com
接口文档：https://soa.laziestlife.com/api/iot/templates
