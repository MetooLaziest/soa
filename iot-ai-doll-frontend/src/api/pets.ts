/**
 * 宠物实体管理 API
 * pets 表 CRUD + RAG 关联
 */
import client from './client';

export interface Pet {
  nfc: string;
  display_name: string;
  monster_type: string;
  model_id: number;
  hunger: number;
  is_visible: boolean;
  display_order: number;
  last_interact_at: string;
  last_feed_at: string;
  total_feeds: number;
  total_pets: number;
  total_poops: number;
  total_cleans: number;
  system_prompt: string;
  rag_kb_ids?: number[];
  model_name?: string;
  model_temperature?: number;
}

export interface Model {
  model_id: number;
  name: string;
  description: string;
  system_prompt: string;
  temperature?: number;
  rag_kb_ids?: number[];
}

/** 获取所有宠物实体列表 */
export async function getPets(): Promise<{ pets: Pet[] }> {
  const res = await client.get('/admin/pets');
  return res.data;
}

/** 获取单个宠物详情 */
export async function getPet(nfc: string): Promise<{ pet: Pet }> {
  const res = await client.get(`/admin/pets/${nfc}`);
  return res.data;
}

/**
 * updatePetSystemPrompt 已移除 — 后端 admin-pets.js 不处理 system_prompt_layers 字段
 * 5层提示词编辑请使用 Companions.tsx 的 LayerEditModal → PUT /epet1/admin/pet-models/:id/layers
 */

/** 获取宠物 RAG 关联 */
export async function getPetRAGs(nfc: string): Promise<{ data: Array<{ id: number; name: string }> }> {
  const res = await client.get(`/admin/pets/${nfc}/rags`);
  return res.data;
}

/** 更新宠物 RAG 关联 */
export async function updatePetRAGs(nfc: string, ragIds: number[]): Promise<void> {
  await client.post(`/admin/pets/${nfc}/rags`, { rag_ids: ragIds });
}

/** 获取所有 RAG 知识库列表 */
export async function getRAGKnowledgeBases(): Promise<{ data: Array<{ id: number; name: string; description?: string }>; count: number }> {
  const res = await client.get('/admin/rag-kbs');
  return res.data;
}

/** 获取所有宠物型号（models） */
export async function getModels(): Promise<{ models: Model[] }> {
  const res = await client.get('/admin/models');
  return res.data;
}


// ============ 设备 SN（模板选择 → 创建实体）======== ====
export interface DeviceModel {
  model_id: number;
  name: string;
  description: string;
}

export interface Device {
  device_sn: string;
  model_id: number;
  display_name: string;
  model_name: string;
  is_visible: boolean;
  created_at: string;
}

/** 获取可选模板列表 */
export async function getAvailableModels(): Promise<DeviceModel[]> {
  const res = await client.get('/admin/devices/models');
  return res.data.models || [];
}

/** 获取设备 SN 列表 */
export async function getDevices(): Promise<Device[]> {
  const res = await client.get('/admin/devices');
  return res.data.devices || [];
}

/** 创建设备 SN（= 创建宠物实体）*/
export async function createDevice(device_sn: string, model_id: number, display_name?: string): Promise<void> {
  await client.post('/admin/devices', { device_sn, model_id, display_name });
}

/** 删除设备 SN */
export async function deleteDevice(device_sn: string): Promise<void> {
  await client.delete(`/admin/devices/${device_sn}`);
}

/** 更新设备 SN（model_id / is_visible / display_name）*/
export async function updateDevice(nfc: string, data: { model_id?: number; is_visible?: boolean; display_name?: string }): Promise<void> {
  await client.put(`/admin/devices/${nfc}`, data);
}
