const API = '/api/epet';

interface Stats {
  totalFeeds: number;
  totalPets: number;
  totalPoops: number;
  currentPoops: number;
  lastInteractAt: string;
}

export interface Pet {
  nfc: string;
  petId: string;
  userId: string;
  displayName: string;
  monsterType: string;
  isVisible: boolean;
  displayOrder: number;
  fullness: number;
  lastFeedAt: string;
  lastInteractAt: string;
  totalFeeds: number;
  totalPets: number;
  totalPoops: number;
  totalCleans: number;
  currentPoops: number;
  modelId: string | number;
}

// Raw shape from /monsters list endpoint (stats nested, no fullness)
export interface MonsterApiItem {
  petId: string;
  displayName: string;
  monsterType: string;
  isVisible: boolean;
  displayOrder: number;
  stats: Stats;
  modelId: string | number;
  monster: {
    name: string;
    image: string;
    color: string;
  };
}

interface MonstersApiResponse {
  success: boolean;
  monsters: MonsterApiItem[];
}

interface PetApiResponse {
  success: boolean;
  pet: Pet;
}

// Transform raw monsters item → Pet shape
export function transformMonsterItem(item: MonsterApiItem): Pet {
  return {
    nfc: item.petId,
    petId: item.petId,
    userId: '',
    displayName: item.displayName,
    monsterType: item.monsterType,
    isVisible: item.isVisible,
    displayOrder: item.displayOrder,
    fullness: 50, // not provided in list; fetch individual pet to get real value
    lastFeedAt: '',
    lastInteractAt: item.stats.lastInteractAt,
    totalFeeds: item.stats.totalFeeds,
    totalPets: item.stats.totalPets,
    totalPoops: item.stats.totalPoops,
    totalCleans: 0,
    currentPoops: item.stats.currentPoops,
    modelId: item.modelId,
  };
}

export async function fetchModels(): Promise<Pet[]> {
  const res = await fetch(`${API}/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function fetchVisiblePets(): Promise<Pet[]> {
  const res = await fetch(`${API}/monsters`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch pets: ${res.status} ${text}`);
  }
  const data: MonstersApiResponse = await res.json();
  return (data.monsters ?? []).map(transformMonsterItem);
}

export async function fetchPet(petId: string): Promise<Pet> {
  const res = await fetch(`${API}/${petId}`);
  if (!res.ok) throw new Error('Failed to fetch pet');
  const data: PetApiResponse = await res.json();
  return data.pet;
}

export async function feedPet(petId: string): Promise<void> {
  await fetch(`${API}/${petId}/feed`, { method: 'POST' });
}

export async function petInteract(petId: string): Promise<void> {
  await fetch(`${API}/${petId}/pet`, { method: 'POST' });
}

export async function cleanPet(petId: string): Promise<void> {
  await fetch(`${API}/${petId}/clean`, { method: 'POST' });
}

export async function toggleVisibility(
  petId: string,
  currentVisible: boolean
): Promise<{ visible: boolean; monsters: MonsterApiItem[] }> {
  const res = await fetch(`${API}/${petId}/visibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visible: !currentVisible }),
  });
  if (!res.ok) throw new Error(`toggle failed: ${res.status}`);
  const data = await res.json();
  return { visible: data.visible, monsters: data.monsters ?? [] };
}