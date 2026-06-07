/**
 * 艾瑟拉奇幻谭 - IoT AI 机伴前端类型定义
 * 所有核心业务实体与 API 响应类型
 */

/* ========== 用户与认证 ========== */

/** 用户基本信息 */
export interface User {
  id: number;
  username: string;
  created_at: string;
}

/** 注册/登录请求体 */
export interface AuthPayload {
  username: string;
  password: string;
}

/** 认证成功响应 */
export interface AuthResponse {
  user: User;
  token: string;
}

/* ========== 设备 ========== */

/** 绑定的 IoT 设备 */
export interface Device {
  id: number;
  sn: string;
  device_name: string;
  user_id: number;
  companion_id: number | null;
  bound_at: string;
}

/** 绑定设备请求体 */
export interface BindDevicePayload {
  sn: string;
  deviceName: string;
}

/* ========== 机伴模型 ========== */

/** 机伴（AI 角色）模型 */
export interface CompanionModel {
  id: number;
  name: string;
  description: string;
  avatar_url: string;
  personality: string;
  default_mbti: string;
  created_at: string;
}

/* ========== 剧情系统 ========== */

/** 主剧情框架 */
export interface MainStory {
  id: number;
  title: string;
  description: string;
  start_node_id: number;
  companion_id: number;
  created_at: string;
}

/** 支线剧情 */
export interface SubStory {
  id: number;
  title: string;
  description: string;
  start_node_id: number;
  main_story_id: number;
  trigger_condition: string;
  created_at: string;
}

/** 剧情节点（React Flow 节点） */
export interface StoryNode {
  id: number;
  main_story_id: number;
  title: string;
  content: string;
  node_type: 'dialogue' | 'choice' | 'event' | 'ending';
  position_x: number;
  position_y: number;
  companion_model_id: number | null;
  cg_id: number | null;
  location_id: number | null;
  created_at: string;
}

/** 剧情选项 */
export interface StoryOption {
  id: number;
  node_id: number;
  text: string;
  next_node_id: number | null;
  mbti_effect: Record<string, number>;
  condition: string | null;
  order_index: number;
}

/* ========== 地点 ========== */

/** 场景地点 */
export interface Location {
  id: number;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
}

/* ========== 道具 & CG ========== */

/** 道具/物品 */
export interface Item {
  id: number;
  name: string;
  description: string;
  icon_url: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  effect: string;
  created_at: string;
}

/** CG 图鉴 */
export interface CG {
  id: number;
  title: string;
  image_url: string;
  description: string;
  unlock_condition: string;
  story_node_id: number | null;
  created_at: string;
}

/* ========== 用户进度 & 属性 ========== */

/** 用户剧情进度 */
export interface UserProgress {
  id: number;
  user_id: number;
  sn: string;
  current_node_id: number;
  main_story_id: number;
  completed: boolean;
  updated_at: string;
}

/** 用户物品栏 */
export interface UserInventory {
  id: number;
  user_id: number;
  sn: string;
  item_id: number;
  quantity: number;
  acquired_at: string;
}

/** MBTI 维度 */
export type MBTIDimension = 'E_I' | 'S_N' | 'T_F' | 'J_P';

/** 用户 MBTI 属性 */
export interface MBTI {
  E_I: number;   // 外向-内向，0~100
  S_N: number;   // 感觉-直觉
  T_F: number;   // 思考-情感
  J_P: number;   // 判断-知觉
}

/** 用户完整属性 */
export interface Attributes {
  id: number;
  user_id: number;
  sn: string;
  mbti: MBTI;
  affinity: number;       // 好感度
  trust: number;          // 信任度
  updated_at: string;
}

/* ========== API 通用 ========== */

/** 通用 API 响应包装 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** 通用查询请求体 */
export interface QueryPayload {
  table: string;
  select?: string;
  filters?: Record<string, string | number | boolean>;
  order?: string;
  limit?: number;
}

/** 通用插入请求体 */
export interface InsertPayload {
  table: string;
  rows: Record<string, unknown>[];
}

/** 通用更新请求体 */
export interface UpdatePayload {
  table: string;
  data: Record<string, unknown>;
  filters: Record<string, unknown>;
}

/** 通用删除请求体 */
export interface DeletePayload {
  table: string;
  filters: Record<string, unknown>;
}

/* ========== AI 聊天 ========== */

/** 聊天上下文 */
export interface ChatContext {
  sn?: string;
  nodeId?: number;
  mbti?: MBTI;
  history?: ChatMessage[];
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

/** 聊天请求体 */
export interface ChatPayload {
  message: string;
  context?: ChatContext;
}

/* ========== React Flow 自定义节点 ========== */

/** React Flow 中剧情节点的数据载荷 */
export interface StoryNodeData {
  label: string;
  nodeType: StoryNode['node_type'];
  content: string;
}

/* ========== 管理后台路由项 ========== */

/** 侧边栏导航项 */
export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
}
