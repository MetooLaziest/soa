import { create } from 'zustand';
import type { Pet } from '../api/epet';

export type PetState = 'idle' | 'walking' | 'eating' | 'sleeping' | 'hungry' | 'sick' | 'dead';

export interface VisiblePet extends Pet {
  petState: PetState;
  animX: number;
  animY: number;
  scale: number;
  animClass: string;
}

interface GameStore {
  visiblePets: VisiblePet[];
  allPets: Pet[];
  loading: boolean;
  activePetId: string | null;
  eatingPetId: string | null;
  lastPettedAt: Record<string, number>;
  travelingPetId: string | null;
  travelEndTime: number | null;

  setVisiblePets: (pets: VisiblePet[]) => void;
  setAllPets: (pets: Pet[]) => void;
  setLoading: (v: boolean) => void;
  setActivePet: (petId: string | null) => void;
  setEatingPet: (petId: string | null) => void;
  markPetted: (petId: string) => void;
  startTravel: (petId: string, durationMs: number) => void;
  endTravel: () => void;
  refreshPet: (updatedPet: Pet) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  visiblePets: [],
  allPets: [],
  loading: true,
  activePetId: null,
  eatingPetId: null,
  lastPettedAt: {},
  travelingPetId: null,
  travelEndTime: null,

  setVisiblePets: (pets) => set({ visiblePets: pets }),
  setAllPets: (pets) => set({ allPets: pets }),
  setLoading: (v) => set({ loading: v }),
  setActivePet: (petId) => set({ activePetId: petId }),
  setEatingPet: (petId) => set({ eatingPetId: petId }),

  markPetted: (petId) =>
    set((s) => ({
      lastPettedAt: { ...s.lastPettedAt, [petId]: Date.now() },
    })),

  startTravel: (petId, durationMs) =>
    set({ travelingPetId: petId, travelEndTime: Date.now() + durationMs }),

  endTravel: () =>
    set({ travelingPetId: null, travelEndTime: null }),

  refreshPet: (updatedPet) =>
    set((s) => ({
      visiblePets: s.visiblePets.map((p) =>
        p.petId === updatedPet.petId ? { ...p, ...updatedPet } : p
      ),
      allPets: s.allPets.map((p) =>
        p.petId === updatedPet.petId ? updatedPet : p
      ),
    })),
}));
