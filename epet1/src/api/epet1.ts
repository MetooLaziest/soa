/**
 * E-Pet 1 API 客户端
 * 对接后端 /api/epet1/* 路由
 */

const BASE = '/api/epet1';

// ─── 基础类型 ───────────────────────────────────────────────

export interface PetModel {
  id: number;
  name: string;
  description: string;
  image_url: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  nfc_range_start: string;
  nfc_range_end: string;
  mbti: string;
  personality_template: string;
  is_active: boolean;
  display_order: number;
}

export interface PetInstance {
  id: number;
  user_id: number;
  pet_model_id: number;
  nickname: string;
  growth_level: number;
  total_interactions: number;
  total_travels: number;
  total_postcards: number;
  is_in_yard: boolean;
  yard_position: number | null;
  emotion_value: number;
  last_interact_at: string;
  pet_model?: PetModel;
}

export interface YardPet extends PetInstance {
  petState: 'idle' | 'happy' | 'sleeping' | 'traveling';
  animClass: string;
}

export interface Postcard {
  id: number;
  name: string;
  image_url: string;
  rarity: 'N' | 'R' | 'SR' | 'SSR' | 'UR';
  scene_desc: string;
  obtained: boolean;
  count: number;
}

export interface DriftBottle {
  id: number;
  sender_nickname: string;
  message: string;
  reward_type: 'emotion' | 'fragment';
  reward_amount: number;
  reward_name: string;
  created_at: string;
}

export interface ShopItem {
  id: number;
  name: string;
  desc: string;
  price_emotion: number;
  stock: number;
  icon: string;
}

export interface TravelRecord {
  id: number;
  pet_instance_id: number;
  pet_nickname: string;
  pet_model_id: number;
  started_at: string;
  duration_hours: number;
  status: 'traveling' | 'returned';
  postcard?: {
    id: number;
    name: string;
    rarity: string;
    image_url: string;
  };
}

export interface GameType {
  id: string;
  name: string;
  desc: string;
  icon: string;
  min_level: number;
}

// ─── API 请求函数 ────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

// ─── 用户 ────────────────────────────────────────────────────

/** 获取当前用户（演示阶段固定 user_id=2，正式版本改为手机号登录） */
const DEMO_USER_ID = 2;

export async function getOrCreateUser(): Promise<{ user_id: number; emotion_points: number }> {
  // TODO: 正式版本替换为手机号登录逻辑
  const res = await get<any>(`/user/${DEMO_USER_ID}`);
  return { user_id: DEMO_USER_ID, emotion_points: res.user?.emotion_points || 0 };
}

// ─── 宠物 ────────────────────────────────────────────────────

/** 获取所有宠物型号 */
export async function fetchPetModels(): Promise<PetModel[]> {
  const res = await get<any>('/pet/models');
  return res.models || [];
}

/** 获取用户在庭院里的宠物 */
export async function fetchYardPets(userId: number): Promise<PetInstance[]> {
  const res = await get<any>(`/pet/yard/${userId}`);
  return res.pets || [];
}

/** 获取用户所有宠物实例（藏品库） */
export async function fetchUserPets(userId: number): Promise<PetInstance[]> {
  const res = await get<any>(`/pet/instances/${userId}`);
  return res.pets || [];
}

/** NFC 激活宠物 */
export async function activatePet(userId: number, nfcId: string): Promise<PetInstance> {
  const res = await post<any>('/pet/activate', { user_id: userId, nfc_id: nfcId });
  return res.pet_instance;
}

/** 添加宠物到庭院 */
export async function addToYard(userId: number, petId: number): Promise<void> {
  await post(`/pet/yard/add`, { user_id: userId, pet_instance_id: petId });
}

/** 从庭院移除 */
export async function removeFromYard(userId: number, petId: number): Promise<void> {
  await post(`/pet/yard/remove`, { user_id: userId, pet_instance_id: petId });
}

/** 互动（抚摸/喂食/清洁）*/
export async function interactPet(
  userId: number,
  petId: number,
  action: 'pet' | 'feed' | 'clean'
): Promise<{ emotion_reward: number; new_emotion: number }> {
  const res = await post<any>('/pet/interact', { user_id: userId, pet_instance_id: petId, action });
  return { emotion_reward: res.emotion_reward || 0, new_emotion: res.new_emotion };
}

// ─── 出游 ────────────────────────────────────────────────────

/** 开始出游 */
export async function startTravel(userId: number, petId: number): Promise<TravelRecord> {
  const res = await post<any>('/travel/start', { user_id: userId, pet_instance_id: petId });
  return res.record;
}

/** 获取出游状态 */
export async function fetchTravelStatus(userId: number): Promise<TravelRecord | null> {
  const res = await get<any>(`/travel/${userId}`);
  const records = res.records || [];
  return records.find((r: any) => r.status === 'traveling') || null;
}

/** 获取所有旅行中的宠物 ID */
export async function fetchTravelingPetIds(userId: number): Promise<number[]> {
  const res = await get<any>(`/travel/${userId}`);
  const records = res.records || [];
  return records.filter((r: any) => r.status === 'traveling').map((r: any) => Number(r.pet_instance_id));
}

/** 领取归来奖励 */
export async function claimTravelReward(userId: number, recordId: number): Promise<{ postcard: Postcard }> {
  const res = await post<any>(`/travel/${recordId}/claim`, { user_id: userId });
  return res;
}

// ─── 明信片 ─────────────────────────────────────────────────

/** 用户明信片收藏 */
export async function fetchPostcards(userId: number): Promise<Postcard[]> {
  const res = await get<any>(`/postcard/${userId}`);
  return res.postcards || [];
}

/** 抽取明信片（出游归来）*/
export async function drawPostcard(userId: number): Promise<{ postcard: Postcard; emotion_reward: number }> {
  const res = await post<any>(`/postcard/draw`, { user_id: userId });
  return { postcard: res.postcard, emotion_reward: res.emotion_reward || 0 };
}

// ─── 漂流瓶 ─────────────────────────────────────────────────

/** 获取我的漂流瓶 */
export async function fetchDriftBottles(userId: number): Promise<DriftBottle[]> {
  const res = await get<any>(`/drift/${userId}`);
  return res.bottles || [];
}

/** 投放漂流瓶 */
export async function sendDriftBottle(userId: number, message: string): Promise<{ cost: number }> {
  const res = await post<any>('/drift', { user_id: userId, message });
  return { cost: res.cost || 5 };
}

/** 捡瓶子 */
export async function pickupDriftBottle(userId: number): Promise<DriftBottle | null> {
  const res = await post<any>('/drift/pickup', { user_id: userId });
  return res.bottle || null;
}

// ─── 商店 ───────────────────────────────────────────────────

/** 商店物品列表 */
export async function fetchShopItems(): Promise<ShopItem[]> {
  const res = await get<any>('/shop/items');
  return res.items || [];
}

/** 购买物品 */
export async function buyItem(
  userId: number,
  itemId: number
): Promise<{ success: boolean; remaining_emotion: number }> {
  const res = await post<any>('/shop/buy', { user_id: userId, item_id: itemId });
  return { success: res.success, remaining_emotion: res.remaining_emotion };
}

// ─── 对话 ─────────────────────────────────────────────────

/** 发送对话消息（支持文字消息 / 抚摸触摸）*/
export async function sendChatMessage(
  userId: number,
  petId: number,
  message?: string,
  touchArea?: string
): Promise<{ reply: string }> {
  const body: any = { user_id: userId, pet_instance_id: petId };
  if (message) body.message = message;
  if (touchArea) body.touch_area = touchArea;
  const res = await post<any>('/chat', body);
  return { reply: res.reply };
}

// ─── 小游戏 ─────────────────────────────────────────────────

/** 可玩游戏列表 */
export async function fetchGameTypes(): Promise<GameType[]> {
  const res = await get<any>('/game/types');
  return res.games || [];
}

/** 上报成绩 */
export async function recordGameScore(
  userId: number,
  gameType: string,
  score: number,
  petId?: number
): Promise<{ emotion_reward: number }> {
  const res = await post<any>('/game/record', {
    user_id: userId,
    game_type: gameType,
    score,
    pet_instance_id: petId,
  });
  return { emotion_reward: res.emotion_reward || 3 };
}
