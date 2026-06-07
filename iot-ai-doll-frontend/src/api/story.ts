/**
 * 剧情 & 进度 & 物品栏 & 属性 API
 */
import client from './client';
import type { StoryNode, UserProgress, UserInventory, Attributes, QueryPayload } from '../types';

/** 获取剧情节点 */
export function getStoryNode(nodeId: number) {
  return client.get<StoryNode>(`/db/story/node/${nodeId}`);
}

/** 保存进度 */
export function saveProgress(data: Partial<UserProgress>) {
  return client.post<UserProgress>('/db/story/progress', data);
}

/** 获取进度 */
export function getProgress(sn: string) {
  return client.get<UserProgress>(`/db/story/progress/${sn}`);
}

/** 获取物品栏 */
export function getInventory(sn: string) {
  return client.get<UserInventory[]>(`/db/inventory/${sn}`);
}

/** 获取 MBTI 属性 */
export function getAttributes(sn: string) {
  return client.get<Attributes>(`/db/attributes/${sn}`);
}

/** 通用查询（需 JWT） */
export function query<T = unknown>(payload: QueryPayload) {
  return client.post<T[]>('/db/query', payload);
}
