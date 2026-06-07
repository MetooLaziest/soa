# Agent 间通信实现方案

**时间**: 2026-05-07 22:39
**目标**: 了解如何让多个 Agent 之间共享资料和对话

---

## 核心发现

### 当前环境状态
- 当前仅有 `main` Agent 运行
- 会话 ID: `agent:main:main`
- 无其他活跃 Agent

---

## Agent 间通信的三种方式

### 1. `sessions_spawn` - 生成子 Agent
**用途**: 生成临时子 Agent 执行特定任务
**特点**:
- 继承父 Agent 工作目录
- 执行完毕返回结果
- 适合一次性任务

**示例**:
```
sessions_spawn(task="分析数据", runtime="subagent")
```

### 2. `sessions_send` - 跨会话通信
**用途**: 向其他持久化会话发送消息
**前提**: 需要有其他活跃会话
**示例**:
```
sessions_send(sessionKey="agent:xxx:xxx", message="分享资料")
```

### 3. `subagents` - 子 Agent 管理
**用途**: 查看、指导、终止子 Agent
**操作**:
- `action="list"` - 列出子 Agent
- `action="steer"` - 发送指令
- `action="kill"` - 终止

---

## 实现步骤

### 创建新 Agent
1. 配置文件位置: `~/.qclaw/agents/`
2. 创建新的 agent 配置
3. 通过不同渠道启动会话

### 协作场景
- **分工协作**: 不同 Agent 负责不同任务（数据分析、写作等）
- **信息聚合**: 不同 Agent 监控不同信息源
- **工作流编排**: Agent 链式处理任务

---

## 待办事项
- [ ] 确认用户的协作需求
- [ ] 设计具体的多 Agent 工作流
- [ ] 配置新的 Agent（如需要）
