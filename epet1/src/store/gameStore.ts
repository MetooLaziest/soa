import { create } from 'zustand';
import type { PetInstance, TravelRecord, YardFurniture } from '../api/epet1';

type ModalType = 'collection' | 'postcard' | 'travel' | 'drift' | 'shop' | 'game' | 'chat' | 'nfc' | 'inventory' | null;

interface GameStore {
  // User
  userId: number | null;
  emotionPoints: number;
  // Pets
  yardPets: PetInstance[];
  allPets: PetInstance[];
  // Travel
  activeTravel: TravelRecord | null;
  // Modals
  activeModal: ModalType;
  // Chat target
  chatPetId: number | null;
  // Loading
  loading: boolean;
  // Furniture placement
  yardFurniture: YardFurniture[];
  placingFurniture: { shopItemId: number; name: string; imageUrl: string; width: number; height: number } | null;

  setUser: (userId: number, emotionPoints: number) => void;
  setYardPets: (pets: PetInstance[]) => void;
  setAllPets: (pets: PetInstance[]) => void;
  setEmotionPoints: (pts: number) => void;
  addEmotionPoints: (pts: number) => void;
  setActiveTravel: (t: TravelRecord | null) => void;
  setActiveModal: (m: ModalType) => void;
  setChatPetId: (id: number | null) => void;
  setLoading: (v: boolean) => void;
  refreshPet: (updated: PetInstance) => void;
  setYardFurniture: (f: YardFurniture[]) => void;
  addYardFurniture: (f: YardFurniture) => void;
  removeYardFurniture: (id: number) => void;
  setPlacingFurniture: (f: { shopItemId: number; name: string; imageUrl: string; width: number; height: number } | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  userId: null,
  emotionPoints: 0,
  yardPets: [],
  allPets: [],
  activeTravel: null,
  activeModal: null,
  chatPetId: null,
  loading: true,
  yardFurniture: [],
  placingFurniture: null,

  setUser: (userId, emotionPoints) => set({ userId, emotionPoints }),
  setYardPets: (yardPets) => set({ yardPets }),
  setAllPets: (allPets) => set({ allPets }),
  setEmotionPoints: (emotionPoints) => set({ emotionPoints }),
  addEmotionPoints: (pts) => set((s) => ({ emotionPoints: s.emotionPoints + pts })),
  setActiveTravel: (activeTravel) => set({ activeTravel }),
  setActiveModal: (activeModal) => set({ activeModal }),
  setChatPetId: (chatPetId) => set({ chatPetId }),
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
}));
