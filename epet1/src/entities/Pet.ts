import type { Pet } from '../api/epet';

export type WanderState = 'idle' | 'walking' | 'shaking' | 'eating';

export class PetEntity {
  petId: string;
  modelId: number;
  monsterType: string;
  displayName: string;
  nickname: string;
  fullness: number;
  lastFeedAt: string;
  lastInteractAt: string;
  totalFeeds: number;
  totalPets: number;

  // Wander AI
  state: WanderState = 'idle';
  x: number = 0;
  y: number = 0;
  scale: number = 1;
  facingRight: boolean = true;
  private _targetX: number = 0;
  private _targetY: number = 0;
  private _idleUntil: number = 0;
  private _walkSpeed: number = 0.5; // px per tick (60fps)
  private _bobPhase: number = 0;
  private _walkBounds: { xMin: number; xMax: number; yMin: number; yMax: number };

  // Animation timers
  private _shakeStart: number = 0;
  private _eatingStart: number = 0;

  constructor(pet: Pet & { pet_model_id?: number; nickname?: string }) {
    this.petId = pet.petId;
    this.modelId = (pet as any).pet_model_id ?? 0;
    this.monsterType = pet.monsterType;
    this.displayName = pet.displayName;
    this.nickname = (pet as any).nickname || pet.displayName;
    this.fullness = pet.fullness;
    this.lastFeedAt = pet.lastFeedAt;
    this.lastInteractAt = pet.lastInteractAt;
    this.totalFeeds = pet.totalFeeds;
    this.totalPets = pet.totalPets;
    this._walkBounds = { xMin: 0.05, xMax: 0.95, yMin: 0.35, yMax: 0.78 };
  }

  /** Set the walkable area as fractions of viewport (0-1) */
  setWalkBounds(b: { xMin: number; xMax: number; yMin: number; yMax: number }) {
    this._walkBounds = b;
  }

  /** Pick a random target within walkable bounds */
  private _pickTarget(vpW: number, vpH: number) {
    this._targetX = vpW * (this._walkBounds.xMin + Math.random() * (this._walkBounds.xMax - this._walkBounds.xMin));
    this._targetY = vpH * (this._walkBounds.yMin + Math.random() * (this._walkBounds.yMax - this._walkBounds.yMin));
    this._walkSpeed = 0.3 + Math.random() * 0.9; // slower = more leisurely
  }

  update(now: number, vpW: number, vpH: number): void {
    // Animation state expiry
    if (this.state === 'shaking' && now - this._shakeStart > 600) {
      this.state = 'idle';
      this._idleUntil = now + 1000 + Math.random() * 2000;
    }
    if (this.state === 'eating' && now - this._eatingStart > 5000) {
      this.state = 'idle';
      this._idleUntil = now + 2000 + Math.random() * 3000;
    }

    // Wander state machine
    if (this.state === 'idle') {
      this._bobPhase = 0;
      if (now >= this._idleUntil) {
        this._pickTarget(vpW, vpH);
        this.state = 'walking';
      }
    } else if (this.state === 'walking') {
      const dx = this._targetX - this.x;
      const dy = this._targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        // Reached target → idle
        this.state = 'idle';
        this._idleUntil = now + 1500 + Math.random() * 4000;
      } else {
        const step = this._walkSpeed * (vpW / 375); // scale speed to viewport
        const ratio = Math.min(step / dist, 1);
        this.x += dx * ratio;
        this.y += dy * ratio;

        // Face direction of movement
        if (Math.abs(dx) > 0.3) {
          this.facingRight = dx > 0;
        }

        // Bob while walking
        this._bobPhase += 0.15;
      }
    }

    // Scale based on y-position (lower = closer = larger)
    const yNorm = (this.y - vpH * this._walkBounds.yMin) / (vpH * (this._walkBounds.yMax - this._walkBounds.yMin));
    this.scale = 0.7 + yNorm * 0.5; // 0.7 (far) to 1.2 (close)
  }

  triggerShake(now: number): void {
    this.state = 'shaking';
    this._shakeStart = now;
  }

  triggerEating(now: number): void {
    this.state = 'eating';
    this._eatingStart = now;
  }

  /** Bob offset for walking animation (used by renderer) */
  get bobY(): number {
    if (this.state !== 'walking') return 0;
    return Math.sin(this._bobPhase) * 3;
  }

  getImageName(): string {
    const colorMap: Record<string, string> = {
      white: 'pet-white.png',
      blue: 'pet-blue.png',
      pink: 'pet-pink.png',
    };
    const file = colorMap[this.monsterType] || 'pet-idle.png';
    return `/epet/${file}`;
  }
}
