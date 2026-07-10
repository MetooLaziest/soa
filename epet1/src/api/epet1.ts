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
  video_url?: string;
  rarity: 'N' | 'R' | 'SR' | 'SSR' | 'UR';
  scene_desc: string;
  description?: string;
  obtained: boolean;
  count: number;
  is_new?: boolean;
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
  expected_end_at?: string;
  duration_hours: number;
  dish_rating?: number;
  dish_name?: string;
  status: 'traveling' | 'returned';
  postcard?: {
    id: number;
    name: string;
    rarity: string;
    image_url: string;
    video_url?: string;
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

/** 开始出游 (需要料理) */
export async function startTravel(userId: number, petId: number, dishInventoryId: number): Promise<any> {
  const res = await post<any>('/travel/start', { user_id: userId, pet_instance_id: petId, dish_inventory_id: dishInventoryId });
  return res.travel;
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
  const res = await get<any>(`/postcard/collection/${userId}`);
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
  const res = await post<any>('/shop/buy', { user_id: userId, shop_item_id: itemId });
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

// ─── 家具布置 ─────────────────────────────────────────────

export interface YardFurniture {
  id: number;
  user_id: number;
  shop_item_id: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  name?: string;
  image_url?: string;
  item_category?: string;
}

/** 获取庭院已布置的家具 */
export async function fetchYardFurniture(userId: number): Promise<YardFurniture[]> {
  const res = await get<any>(`/furniture/yard/${userId}`);
  return res.furniture || [];
}

/** 放置家具到庭院 */
export async function placeFurniture(
  userId: number,
  shopItemId: number,
  posX: number,
  posY: number,
  width?: number,
  height?: number
): Promise<YardFurniture> {
  const res = await post<any>('/furniture/place', {
    user_id: userId,
    shop_item_id: shopItemId,
    pos_x: posX,
    pos_y: posY,
    width,
    height,
  });
  return res.furniture;
}

/** 从庭院收回家具 */
export async function removeFurniture(
  userId: number,
  furnitureId: number
): Promise<void> {
  await post('/furniture/remove', { user_id: userId, furniture_id: furnitureId });
}

/** 移动已放置家具 */
export async function moveFurniture(
  userId: number,
  furnitureId: number,
  posX: number,
  posY: number
): Promise<YardFurniture> {
  const res = await post<any>('/furniture/move', {
    user_id: userId,
    furniture_id: furnitureId,
    pos_x: posX,
    pos_y: posY,
  });
  return res.furniture;
}

// ─── 消消乐 (Match3) ────────────────────────────────────────────

export interface Match3Level {
  id: number;
  name: string;
  grid_shape: number[][];
  rows: number;
  cols: number;
  available_icons: number[];
  target_score: number;
  max_moves: number;
}

export interface Match3Icon {
  id: number;
  image_url: string;
  name: string;
}

export interface Match3Record {
  ok: boolean;
  score: number;
  passed: boolean;
}

/** 获取消消乐关卡配置 */
export async function fetchMatch3Level(levelId: number): Promise<Match3Level> {
  const res = await get<any>(`/match3/levels/${levelId}`);
  return res.level || res;
}

/** 获取消消乐图标列表 */
export async function fetchMatch3Icons(): Promise<Match3Icon[]> {
  const res = await get<any>('/match3/icons');
  return res.icons || [];
}

/** 上报消消乐成绩 */
export async function recordMatch3Score(
  userId: number,
  levelId: number,
  score: number,
  passed: boolean,
  movesUsed: number
): Promise<Match3Record> {
  const res = await post<any>('/match3/record', {
    user_id: userId,
    level_id: levelId,
    score,
    passed,
    moves_used: movesUsed,
  });
  return res;
}

/** 检查消消乐是否已通关 */
export async function checkMatch3Passed(userId: number, shopItemId: number): Promise<boolean> {
  try {
    const res = await get<any>(`/match3/check/${userId}/${shopItemId}`);
    return res.passed || false;
  } catch {
    return false;
  }
}

// ─── 料理 (Cooking) ────────────────────────────────────────────

export interface CookingMethod {
  id: number;
  name: string;
  description: string;
  kitchen_bg_url: string;
  img_empty: string;
  img_loaded: string;
  img_0: string;
  img_1: string;
  img_2: string;
  img_3: string;
  img_4: string;
  img_5: string;
  sort_order: number;
}

export interface CookingDish {
  name: string;
  image_url: string;
  description: string;
  rating: number;       // 0=失败, 1=还行, 2=不错, 3=完美
  rating_name: string;
  matched_recipe?: boolean;
}

export interface CookingIngredient {
  id: number;
  name: string;
  image_url: string;
  description: string;
}

/** 获取所有烹饪方式 */
export async function fetchCookingMethods(): Promise<CookingMethod[]> {
  const res = await get<any>('/cooking/methods');
  return res.methods || [];
}

/** 获取可作为食材的 shop_items */
export async function fetchCookingIngredients(): Promise<CookingIngredient[]> {
  const res = await get<any>('/cooking/ingredients');
  return res.ingredients || [];
}

/** 提交料理 */
export async function cookDish(
  userId: number,
  methodId: number,
  ingredients: { shop_item_id: number; quantity: number }[],
  rating: number
): Promise<{ ok: boolean; dish?: CookingDish; error?: string }> {
  const res = await post<any>('/cooking/cook', {
    user_id: userId,
    method_id: methodId,
    ingredients,
    rating,
  });
  return res;
}

// ─── 情绪值掉落 ─────────────────────────────────────────────

export interface EmotionDrop {
  id: number;
  pos_x: number;
  pos_y: number;
  amount: number;
  created_at: string;
}

/** 获取庭院中未收取的情绪值掉落 */
export async function fetchEmotionDrops(userId: number): Promise<EmotionDrop[]> {
  const res = await get<any>(`/emotion-drops?user_id=${userId}`);
  return res.drops || [];
}

/** 收取单个情绪值掉落 */
export async function collectEmotionDrop(
  userId: number,
  dropId: number
): Promise<{ amount: number; new_emotion_points: number }> {
  const res = await post<any>(`/emotion-drops/${dropId}/collect`, { user_id: userId });
  return { amount: res.amount, new_emotion_points: res.new_emotion_points };
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

// ─── 开场视频 ───────────────────────────────────────────────

export interface IntroVideo {
  id: number;
  name: string;
  time_start: string;  // "HH:MM" format
  time_end: string;    // "HH:MM" format
  growth_level: number;
  video_url: string;
  duration_sec: number;
  sort_order: number;
}

/** 获取机伴的所有时间段视频 */
export async function fetchPetVideos(
  petModelId: number,
  growthLevel?: number
): Promise<IntroVideo[]> {
  // 使用 /intro-video 路由获取某 model 的所有视频
  const res = await get<any>(`/intro-video?pet_model_id=${petModelId}`);
  if (!res.videos || res.videos.length === 0) return [];
  
  // 处理视频URL - 转换为完整路径
  const processVideoUrl = (video: IntroVideo): IntroVideo => ({
    ...video,
    video_url: video.video_url && video.video_url.startsWith('http')
      ? video.video_url
      : `https://soa.laziestlife.com${video.video_url}`
  });
  
  // 如果有 growthLevel 参数，优先返回匹配等级的视频，否则返回全部
  if (growthLevel !== undefined) {
    const exactMatch = res.videos
      .filter((v: IntroVideo) => v.growth_level === growthLevel)
      .map(processVideoUrl);
    if (exactMatch.length > 0) return exactMatch;
    // fallback: 返回通用等级(growth_level=0)的视频
    const genericMatch = res.videos
      .filter((v: IntroVideo) => v.growth_level === 0)
      .map(processVideoUrl);
    if (genericMatch.length > 0) return genericMatch;
  }
  
  return res.videos.map(processVideoUrl) || [];
}

// ─── 图标配置 ───────────────────────────────────────────────

export interface IconConfig {
  id: number;
  icon_key: string;
  label: string;
  image_url: string;
  width: number;
  height: number;
}

/** 获取图标配置列表 */
export async function fetchIcons(): Promise<IconConfig[]> {
  const res = await get<any>('/admin/icons');
  const icons = res.icons || [];
  // 将相对路径转换为完整URL
  return icons.map((icon: IconConfig) => ({
    ...icon,
    image_url: icon.image_url && icon.image_url.startsWith('http') 
      ? icon.image_url 
      : icon.image_url 
        ? `https://soa.laziestlife.com${icon.image_url}` 
        : ''
  }));
}

// ─── 用户设置 ───────────────────────────────────────────────

export interface UserSettings {
  home_mode: 'yard' | 'live';
  updated_at: string | null;
}

/** 获取用户首页模式设置 */
export async function fetchUserSettings(userId: number): Promise<UserSettings> {
  const res = await get<any>(`/user/settings/${userId}`);
  return res.settings || { home_mode: 'yard', updated_at: null };
}

/** 更新用户首页模式设置 (admin用) */
export async function updateUserSettings(
  userId: number,
  homeMode: 'yard' | 'live'
): Promise<UserSettings> {
  const res = await post<any>(`/user/settings/${userId}`, { home_mode: homeMode });
  return res.settings;
}

// ─── 藏品库系列 ─────────────────────────────────────────────

export interface PetSeries {
  id: number;
  name: string;
  bannerImageUrl?: string;
  themeColor: string;
  displayOrder: number;
  silhouetteImageUrl?: string;
  backgroundStyle?: Record<string, any>;
  totalCount: number;
  collectedCount: number;
}

export interface SeriesPet {
  modelId: number;
  displayOrder: number;
  modelName: string;
  portraitImageUrl?: string;
  fullImageUrl?: string;
  rarity: string;
  isCollected: boolean;
  growthLevel?: number;
}

export interface SeriesDetail {
  series: PetSeries;
  pets: SeriesPet[];
  progress: {
    total: number;
    collected: number;
  };
}

/** 获取系列列表 */
export async function fetchCollectionSeries(userId: number): Promise<PetSeries[]> {
  const res = await get<any>(`/collection/series?userId=${userId}`);
  return res.series || [];
}

/** 获取系列详情 */
export async function fetchSeriesDetail(userId: number, seriesId: number): Promise<SeriesDetail> {
  const res = await get<any>(`/collection/series/${seriesId}?userId=${userId}`);
  return {
    series: res.series,
    pets: res.pets || [],
    progress: res.progress || { total: 0, collected: 0 },
  };
}
