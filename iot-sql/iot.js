/**
 * IoT 设备控制模块 - API 路由
 * 用于绑定 ESP32 中控板并下发指令
 * 
 * 演示模式：固定 API Key 鉴权，无需 JWT
 */
import express from 'express';
import { query } from '../db/pool.js';
import mqtt from 'mqtt';

const router = express.Router();

// MQTT 配置
const MQTT_BROKER = 'mqtt://127.0.0.1:1883';
const MQTT_USER = 'esp32_device';
const MQTT_PASS = 'iot2026pass';

// 创建 MQTT 客户端（用于发布指令）
const mqttClient = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: 'iot-server-' + Math.random().toString(16).substr(2, 8)
});

mqttClient.on('connect', () => {
  console.log('[MQTT] Connected to broker for publishing');
});

mqttClient.on('error', (err) => {
  console.error('[MQTT] Publish error:', err.message);
});

// 固定 API Key（演示用）
const DEMO_API_KEY = 'iot-demo-2026';

// 简单 API Key 鉴权中间件
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (apiKey === DEMO_API_KEY) {
    req.user = { userId: 'demo-user', role: 'admin' };
    return next();
  }
  // 演示模式：允许无鉴权访问控制接口、模板和日志
  if (req.path === '/control' || req.path === '/templates' || req.path === '/logs') {
    req.user = { userId: 'demo-user', role: 'admin' };
    return next();
  }
  res.status(401).json({ error: '无效的 API Key', hint: '使用 x-api-key 请求头或 apiKey 查询参数' });
};

router.use(apiKeyAuth);

// ====== 设备绑定 ======

// 绑定新设备
router.post('/bind', async (req, res) => {
  try {
    const { sn, deviceName, deviceType, location } = req.body;
    if (!sn) return res.status(400).json({ error: 'SN 不能为空' });

    const userId = req.user.userId;

    // 检查设备是否已存在
    const existing = await query('SELECT id FROM iot_devices WHERE sn = $1', [sn]);
    if (existing.rows.length > 0) {
      // 设备已存在，更新用户绑定
      await query(
        `UPDATE iot_devices SET user_id = $1, device_name = $2, location = $3, status = 'online', updated_at = NOW() WHERE sn = $4`,
        [userId, deviceName || 'ESP32中控', location, sn]
      );
      return res.json({ success: true, message: '设备绑定已更新', sn });
    }

    // 新建设备
    await query(
      `INSERT INTO iot_devices (user_id, sn, device_name, device_type, location, status)
       VALUES ($1, $2, $3, $4, $5, 'online')`,
      [userId, sn, deviceName || 'ESP32中控', deviceType || 'esp32', location]
    );

    res.json({ success: true, message: '设备绑定成功', sn });
  } catch (error) {
    console.error('IoT bind error:', error);
    res.status(500).json({ error: '绑定设备失败' });
  }
});

// 解绑设备
router.post('/unbind', async (req, res) => {
  try {
    const { sn } = req.body;
    if (!sn) return res.status(400).json({ error: 'SN 不能为空' });

    const userId = req.user.userId;

    // 检查设备是否属于该用户
    const existing = await query(
      'SELECT id FROM iot_devices WHERE sn = $1 AND user_id = $2',
      [sn, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '设备不存在或不属于您' });
    }

    // 删除设备
    await query('DELETE FROM iot_devices WHERE sn = $1 AND user_id = $2', [sn, userId]);

    res.json({ success: true, message: '设备已解绑' });
  } catch (error) {
    console.error('IoT unbind error:', error);
    res.status(500).json({ error: '解绑设备失败' });
  }
});

// ====== 设备列表 ======

// 获取用户的所有 IoT 设备
router.get('/devices', async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await query(
      `SELECT id, sn, device_name, device_type, location, status, last_heartbeat, metadata, created_at
       FROM iot_devices WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ devices: result.rows });
  } catch (error) {
    console.error('IoT devices error:', error);
    res.status(500).json({ error: '获取设备列表失败' });
  }
});

// 获取单个设备详情
router.get('/devices/:sn', async (req, res) => {
  try {
    const { sn } = req.params;
    const userId = req.user.userId;

    const result = await query(
      'SELECT * FROM iot_devices WHERE sn = $1 AND user_id = $2',
      [sn, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '设备不存在' });
    }
    res.json({ device: result.rows[0] });
  } catch (error) {
    console.error('IoT device error:', error);
    res.status(500).json({ error: '获取设备详情失败' });
  }
});

// ====== 统一设备控制接口 ======

/**
 * PUT /api/iot/control
 * 统一智能家居控制接口
 * 
 * 请求体:
 * - deviceMac: string (必填) - ESP32 中控 MAC 地址
 * - deviceType: string (必填) - 透传设备类型
 * - deviceGroup: string (可选) - 设备组别，空值为全组别
 * - command: string (必填) - 指令
 * - commandNote: string (可选) - 指令备注，透传参数
 */
router.put('/control', async (req, res) => {
  try {
    const { deviceMac, deviceType, deviceGroup, command, commandNote } = req.body;
    
    // 参数校验
    if (!deviceMac) {
      return res.status(400).json({ 
        success: false, 
        error: 'deviceMac 不能为空',
        errorCode: 'MISSING_DEVICE_MAC'
      });
    }
    if (!deviceType) {
      return res.status(400).json({ 
        success: false, 
        error: 'deviceType 不能为空',
        errorCode: 'MISSING_DEVICE_TYPE'
      });
    }
    if (!command) {
      return res.status(400).json({ 
        success: false, 
        error: 'command 不能为空',
        errorCode: 'MISSING_COMMAND'
      });
    }

    // 验证设备类型
    const validDeviceTypes = ['light', 'curtain', 'tv', 'vacuum', 'bath', 'purifier', 'ac'];
    if (!validDeviceTypes.includes(deviceType)) {
      return res.status(400).json({ 
        success: false, 
        error: `无效的设备类型，支持的类型: ${validDeviceTypes.join(', ')}`,
        errorCode: 'INVALID_DEVICE_TYPE',
        supportedTypes: validDeviceTypes
      });
    }

    // 验证指令
    const validCommands = {
      light: ['on', 'off'],
      curtain: ['on', 'off'],
      tv: ['on', 'off'],
      vacuum: ['start', 'stop'],
      bath: ['start'],
      purifier: ['on', 'off'],
      ac: ['on', 'off']
    };
    
    if (!validCommands[deviceType].includes(command)) {
      return res.status(400).json({ 
        success: false, 
        error: `设备 ${deviceType} 不支持指令 ${command}`,
        errorCode: 'INVALID_COMMAND',
        supportedCommands: validCommands[deviceType]
      });
    }

    const userId = req.user.userId;

    // 演示模式：跳过中控设备检查，直接执行指令
    // 生产环境需要取消注释以下代码
    /*
    const controllerResult = await query(
      'SELECT id, status FROM iot_devices WHERE sn = $1 AND user_id = $2',
      [deviceMac, userId]
    );
    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: '中控设备不存在或不属于您',
        errorCode: 'CONTROLLER_NOT_FOUND'
      });
    }

    const controller = controllerResult.rows[0];
    if (controller.status !== 'online') {
      return res.status(400).json({ 
        success: false, 
        error: '中控设备离线，无法执行指令',
        errorCode: 'CONTROLLER_OFFLINE'
      });
    }
    */

    // 查询设备映射配置
    const mappingResult = await query(
      `SELECT * FROM iot_device_mapping 
       WHERE controller_mac = $1 AND device_type = $2 
       AND (device_group = $3 OR (device_group IS NULL AND $3 IS NULL))
       AND is_active = TRUE`,
      [deviceMac, deviceType, deviceGroup || null]
    );

    // 如果没有精确匹配，尝试查找全组配置
    let targetMapping = mappingResult.rows[0];
    if (!targetMapping && deviceGroup) {
      const globalResult = await query(
        `SELECT * FROM iot_device_mapping 
         WHERE controller_mac = $1 AND device_type = $2 AND device_group IS NULL
         AND is_active = TRUE`,
        [deviceMac, deviceType]
      );
      targetMapping = globalResult.rows[0];
    }

    // 记录控制日志
    const logResult = await query(
      `INSERT INTO iot_control_logs (controller_mac, device_type, device_group, command, command_note, user_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
      [deviceMac, deviceType, deviceGroup || null, command, commandNote || null, userId]
    );
    const logId = logResult.rows[0].id;

    // 构建发送给 ESP32 的指令
    const instruction = {
      logId,
      deviceType,
      deviceGroup: deviceGroup || 'all',
      command,
      commandNote: commandNote || null,
      deviceCode: targetMapping?.device_code || null,
      timestamp: new Date().toISOString()
    };

    // 通过 MQTT 发布指令到 ESP32
    const mqttTopic = `iot/${deviceMac}/command`;
    const mqttPayload = JSON.stringify(instruction);
    
    mqttClient.publish(mqttTopic, mqttPayload, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] Publish failed:', err.message);
      } else {
        console.log(`[MQTT] Published to ${mqttTopic}:`, mqttPayload);
      }
    });

    // 更新日志状态为已发送
    await query(
      `UPDATE iot_control_logs SET status = 'sent' WHERE id = $1`,
      [logId]
    );

    // 返回成功
    res.status(200).json({
      success: true,
      message: '指令已下发',
      data: {
        logId,
        deviceMac,
        deviceType,
        deviceGroup: deviceGroup || 'all',
        command,
        commandNote: commandNote || null,
        timestamp: instruction.timestamp
      }
    });

  } catch (error) {
    console.error('IoT control error:', error);
    res.status(500).json({ 
      success: false, 
      error: '执行指令失败',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

// ====== 设备映射管理 ======

// 获取中控下的设备映射列表
router.get('/mapping/:mac', async (req, res) => {
  try {
    const { mac } = req.params;
    const userId = req.user.userId;

    // 验证中控归属
    const controllerResult = await query(
      'SELECT id FROM iot_devices WHERE sn = $1 AND user_id = $2',
      [mac, userId]
    );
    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ error: '中控设备不存在' });
    }

    const result = await query(
      `SELECT * FROM iot_device_mapping WHERE controller_mac = $1 ORDER BY device_type, sort_order`,
      [mac]
    );
    res.json({ mappings: result.rows });
  } catch (error) {
    console.error('IoT mapping error:', error);
    res.status(500).json({ error: '获取设备映射失败' });
  }
});

// 添加设备映射
router.post('/mapping', async (req, res) => {
  try {
    const { controllerMac, deviceType, deviceGroup, deviceName, deviceCode, sortOrder } = req.body;
    const userId = req.user.userId;

    // 验证中控归属
    const controllerResult = await query(
      'SELECT id FROM iot_devices WHERE sn = $1 AND user_id = $2',
      [controllerMac, userId]
    );
    if (controllerResult.rows.length === 0) {
      return res.status(404).json({ error: '中控设备不存在' });
    }

    const result = await query(
      `INSERT INTO iot_device_mapping (controller_mac, device_type, device_group, device_name, device_code, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [controllerMac, deviceType, deviceGroup || null, deviceName, deviceCode, sortOrder || 0]
    );
    res.json({ success: true, mapping: result.rows[0] });
  } catch (error) {
    console.error('IoT mapping add error:', error);
    res.status(500).json({ error: '添加设备映射失败' });
  }
});

// 删除设备映射
router.delete('/mapping/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM iot_device_mapping WHERE id = $1', [id]);
    res.json({ success: true, message: '设备映射已删除' });
  } catch (error) {
    console.error('IoT mapping delete error:', error);
    res.status(500).json({ error: '删除设备映射失败' });
  }
});

// ====== 指令模板 ======

// 获取支持的设备类型和指令
router.get('/templates', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM iot_command_templates ORDER BY device_type, command'
    );
    
    // 按设备类型分组
    const templates = {};
    for (const row of result.rows) {
      if (!templates[row.device_type]) {
        templates[row.device_type] = [];
      }
      templates[row.device_type].push({
        command: row.command,
        commandName: row.command_name,
        description: row.description
      });
    }
    
    res.json({ templates });
  } catch (error) {
    console.error('IoT templates error:', error);
    res.status(500).json({ error: '获取指令模板失败' });
  }
});

// ====== 控制日志 ======

// 获取控制日志
router.get('/logs', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deviceMac, limit = 50 } = req.query;

    let sql = `
      SELECT * FROM iot_control_logs 
      WHERE user_id = $1
    `;
    const params = [userId];

    if (deviceMac) {
      sql += ' AND controller_mac = $2';
      params.push(deviceMac);
    }

    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await query(sql, params);
    res.json({ logs: result.rows });
  } catch (error) {
    console.error('IoT logs error:', error);
    res.status(500).json({ error: '获取控制日志失败' });
  }
});

// ====== 指令下发（旧接口，保留兼容）======

router.post('/send', async (req, res) => {
  try {
    const { sn, command, payload } = req.body;
    if (!sn || !command) return res.status(400).json({ error: 'SN 和 command 不能为空' });

    const userId = req.user.userId;

    const deviceResult = await query(
      'SELECT id, status FROM iot_devices WHERE sn = $1 AND user_id = $2',
      [sn, userId]
    );
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: '设备不存在' });
    }

    const device = deviceResult.rows[0];
    if (device.status !== 'online') {
      return res.status(400).json({ error: '设备离线，无法执行指令' });
    }

    const cmdResult = await query(
      `INSERT INTO iot_commands (device_id, command, payload, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [device.id, command, JSON.stringify(payload || {})]
    );

    await query(
      `UPDATE iot_commands SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [cmdResult.rows[0].id]
    );

    res.json({
      success: true,
      message: '指令已下发',
      commandId: cmdResult.rows[0].id,
      sn,
      command
    });
  } catch (error) {
    console.error('IoT send error:', error);
    res.status(500).json({ error: '下发指令失败' });
  }
});

// ====== 命令历史 ======

router.get('/commands', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sn, status, limit = 50 } = req.query;

    let sql = `
      SELECT c.*, d.sn, d.device_name
      FROM iot_commands c
      JOIN iot_devices d ON c.device_id = d.id
      WHERE d.user_id = $1
    `;
    const params = [userId];

    if (sn) {
      sql += ' AND d.sn = $2';
      params.push(sn);
    }
    if (status) {
      sql += ` AND c.status = $${params.length + 1}`;
      params.push(status);
    }

    sql += ' ORDER BY c.created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await query(sql, params);
    res.json({ commands: result.rows });
  } catch (error) {
    console.error('IoT commands error:', error);
    res.status(500).json({ error: '获取命令历史失败' });
  }
});

export default router;
