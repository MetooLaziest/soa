import { create } from 'zustand';
import type { PetInstance, TravelRecord, YardFurniture, UserSettings, UnlockConfig, PetModel } from '../api/epet1';

type ModalType = 'postcard' | 'travel' | 'drift' | 'shop' | 'game' | 'chat' | 'nfc' | 'inventory' | 'intro-video' | 'match3' | 'collection' | 'fishing' | 'cooking' | 'outfit' | 'pet-action' | null;
type PageType = 'home' | 'collection' | 'postcard' | 'travel' | 'drift' | 'shop' | 'inventory' | 'game' | 'chat';
type HomeMode = 'yard' | 'live';

export interface EmotionFloatItem { id: number; text: string; positive: boolean }

interface GameStore {
  // User
  userId: number | null;
  emotionPoints: number;
  // Emotion float feedback
  emotionFloats: EmotionFloatItem[];
  // Pets
  yardPets: PetInstance[];
  allPets: PetInstance[];
  // Travel
  activeTravel: TravelRecord | null;
  // Modals
  activeModal: ModalType;
  // Page routing (for full-screen pages)
  currentPage: PageType;
  // Chat target
  chatPetId: number | null;
  // Intro video data
  introVideoData: { id: number; video_url: string; duration_sec: number; name: string } | null;
  // Loading
  loading: boolean;
  // Furniture placement
  yardFurniture: YardFurniture[];
  placingFurniture: { shopItemId: number; name: string; imageUrl: string; width: number; height: number } | null;
  removingFurnitureMode: boolean;
  // Match3 消消乐
  match3LevelId: number | null;
  match3ShopItemId: number | null;
  // 全屏视频播放
  fullscreenVideoUrl: string | null;
  // 首页模式 (yard=庭院, live=直播画面)
  homeMode: HomeMode;
  // 用户设置
  userSettings: UserSettings | null;
  // 升级解锁提示
  unlockPromptData: { level: number; config: UnlockConfig; petName: string } | null;
  // 宠物型号缓存 (含 growth_unlock_config, 供升级/装扮等使用)
  petModels: PetModel[];
  // 庭院点击机伴浮层
  tappedPetPos: { x: number; y: number } | null;
  showPetActionOverlay: boolean;
  // PixiJS Game 实例引用 (HomePanel 初始化后 set 进来，供 OutfitPanel 等组件使用)
  gameRef: any;

  setUser: (userId: number, emotionPoints: number) => void;
  setYardPets: (pets: PetInstance[]) => void;
  setAllPets: (pets: PetInstance[]) => void;
  setEmotionPoints: (pts: number) => void;
  addEmotionPoints: (pts: number) => void;
  showEmotionFloat: (pts: number) => void;
  removeEmotionFloat: (id: number) => void;
  setActiveTravel: (t: TravelRecord | null) => void;
  setActiveModal: (m: ModalType) => void;
  setCurrentPage: (p: PageType) => void;
  setChatPetId: (id: number | null) => void;
  setIntroVideoData: (data: { id: number; video_url: string; duration_sec: number; name: string } | null) => void;
  setLoading: (v: boolean) => void;
  refreshPet: (updated: PetInstance) => void;
  setYardFurniture: (f: YardFurniture[]) => void;
  addYardFurniture: (f: YardFurniture) => void;
  removeYardFurniture: (id: number) => void;
  setPlacingFurniture: (f: { shopItemId: number; name: string; imageUrl: string; width: number; height: number } | null) => void;
  setRemovingFurnitureMode: (v: boolean) => void;
  setMatch3LevelId: (levelId: number | null, shopItemId?: number | null) => void;
  setFullscreenVideoUrl: (url: string | null) => void;
  setHomeMode: (mode: HomeMode) => void;
  setUserSettings: (settings: UserSettings | null) => void;
  setUnlockPromptData: (data: { level: number; config: UnlockConfig; petName: string } | null) => void;
  setPetModels: (models: PetModel[]) => void;
  setTappedPetPos: (pos: { x: number; y: number } | null) => void;
  setShowPetActionOverlay: (v: boolean) => void;
  setGameRef: (ref: any) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  userId: null,
  emotionPoints: 0,
  emotionFloats: [],
  yardPets: [],
  allPets: [],
  activeTravel: null,
  activeModal: null,
  currentPage: 'home',
  chatPetId: null,
  introVideoData: null,
  loading: true,
  yardFurniture: [],
  placingFurniture: null,
  removingFurnitureMode: false,
  match3LevelId: null,
  match3ShopItemId: null,
  fullscreenVideoUrl: null,
  homeMode: 'yard',
  userSettings: null,
  unlockPromptData: null,
  petModels: [],
  tappedPetPos: null,
  showPetActionOverlay: false,
  gameRef: null,

  setUser: (userId, emotionPoints) => set({ userId, emotionPoints }),
  setYardPets: (yardPets) => set({ yardPets }),
  setAllPets: (allPets) => set({ allPets }),
  setEmotionPoints: (emotionPoints) => set({ emotionPoints }),
  addEmotionPoints: (pts) => set((s) => ({ emotionPoints: s.emotionPoints + pts })),
  showEmotionFloat: (pts) => set((s) => {
    const id = Date.now() + Math.random();
    const text = pts > 0 ? `💛 +${pts}` : `💛 ${pts}`;
    return { emotionFloats: [...s.emotionFloats, { id, text, positive: pts > 0 }] };
  }),
  removeEmotionFloat: (id) => set((s) => ({ emotionFloats: s.emotionFloats.filter((f) => f.id !== id) })),
  setActiveTravel: (activeTravel) => set({ activeTravel }),
  setActiveModal: (activeModal) => set({ activeModal }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setChatPetId: (chatPetId) => set({ chatPetId }),
  setIntroVideoData: (introVideoData) => set({ introVideoData }),
  setLoading: (loading) => set({ loading }),

  refreshPet: (updated) =>
    set((s) => ({
      yardPets: s.yardPets.map((p) => (p.id === updated.id ? updated : p)),
      allPets: s.allPets.map((p) => (p.id === updated.id ? updated : p)),
    })),

  setYardFurniture: (yardFurniture) => set({ yardFurniture }),
  addYardFurniture: (f) => set((s) => ({ yardFurniture: [...s.yardFurniture, f] })),
  removeYardFurniture: (id) => set((s) => ({ yardFurniture: s.yardFurniture.filter((f) => f.id !== id) })),
  setPlacingFurniture: (placingFurniture) => set({ placingFurniture }),
  setRemovingFurnitureMode: (removingFurnitureMode) => set({ removingFurnitureMode }),
  setMatch3LevelId: (levelId, shopItemId) => set({ match3LevelId: levelId, match3ShopItemId: shopItemId ?? null }),
  setFullscreenVideoUrl: (fullscreenVideoUrl) => set({ fullscreenVideoUrl }),
  setHomeMode: (homeMode) => set({ homeMode }),
  setUserSettings: (userSettings) => set({ userSettings }),
  setUnlockPromptData: (unlockPromptData) => set({ unlockPromptData }),
  setPetModels: (petModels) => set({ petModels }),
  setTappedPetPos: (tappedPetPos) => set({ tappedPetPos }),
  setShowPetActionOverlay: (showPetActionOverlay) => set({ showPetActionOverlay }),
  setGameRef: (gameRef) => set({ gameRef }),
}));
