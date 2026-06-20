import type { Pet } from '../api/epet';
import { collisionMap } from '../game/CollisionMap';

export type WanderState = 'idle' | 'walking' | 'shaking' | 'eating';

export class PetEntity {
  petId: string;
  modelId: number;
  monsterType: string;
  displayName: string;
  nickname: string;
  imageUrl: string = '';
  animations: Record<string, string[]> = {};
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

  /** Move to a specific position (from user tap) — respects walk bounds & collision */
  moveTo(targetX: number, targetY: number, vpW: number, vpH: number) {
    // Clamp to walk bounds
    const cx = Math.max(vpW * this._walkBounds.xMin, Math.min(vpW * this._walkBounds.xMax, targetX));
    const cy = Math.max(vpH * this._walkBounds.yMin, Math.min(vpH * this._walkBounds.yMax, targetY));

    // Check if target is walkable
    if (collisionMap.isLoaded && !collisionMap.isWalkable(cx, cy, vpW, vpH)) {
      // Target is inside an obstacle — try nearby positions in a spiral
      const found = this._findNearbyWalkable(cx, cy, vpW, vpH);
      if (found) {
        this._targetX = found.x;
        this._targetY = found.y;
      } else {
        return; // no walkable position found, ignore
      }
    } else {
      this._targetX = cx;
      this._targetY = cy;
    }

    this._walkSpeed = 0.6 + Math.random() * 0.6;
    this.state = 'walking';
    // Cancel idle timer
    this._idleUntil = Infinity;
  }

  /** Find a walkable position near (x,y) using spiral search */
  private _findNearbyWalkable(x: number, y: number, vpW: number, vpH: number): { x: number; y: number } | null {
    const step = Math.min(vpW, vpH) * 0.03; // 3% of viewport
    for (let r = 1; r <= 5; r++) {
      for (let angle = 0; angle < 8 * r; angle++) {
        const a = (angle / (8 * r)) * Math.PI * 2;
        const tx = x + Math.cos(a) * step * r;
        const ty = y + Math.sin(a) * step * r;
        if (collisionMap.isWalkable(tx, ty, vpW, vpH) &&
            tx >= vpW * this._walkBounds.xMin && tx <= vpW * this._walkBounds.xMax &&
            ty >= vpH * this._walkBounds.yMin && ty <= vpH * this._walkBounds.yMax) {
          return { x: tx, y: ty };
        }
      }
    }
    return null;
  }

  /** Pick a random target within walkable bounds */
  private _pickTarget(vpW: number, vpH: number) {
    // Try up to 10 times to find a walkable target
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = vpW * (this._walkBounds.xMin + Math.random() * (this._walkBounds.xMax - this._walkBounds.xMin));
      const ty = vpH * (this._walkBounds.yMin + Math.random() * (this._walkBounds.yMax - this._walkBounds.yMin));
      if (!collisionMap.isLoaded || collisionMap.isWalkable(tx, ty, vpW, vpH)) {
        this._targetX = tx;
        this._targetY = ty;
        this._walkSpeed = 0.3 + Math.random() * 0.9;
        return;
      }
    }
    // Fallback: just pick something (shouldn't happen often)
    this._targetX = vpW * (this._walkBounds.xMin + 0.5 * (this._walkBounds.xMax - this._walkBounds.xMin));
    this._targetY = vpH * (this._walkBounds.yMin + 0.5 * (this._walkBounds.yMax - this._walkBounds.yMin));
    this._walkSpeed = 0.3 + Math.random() * 0.9;
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
        const nextX = this.x + dx * ratio;
        const nextY = this.y + dy * ratio;

        // Collision check: slide along obstacles
        const walkable = collisionMap.findWalkable(this.x, this.y, nextX, nextY, vpW, vpH);

        if (walkable.x === this.x && walkable.y === this.y) {
          // Completely blocked → pick a new target after brief pause
          this.state = 'idle';
          this._idleUntil = now + 500 + Math.random() * 1000;
        } else {
          this.x = walkable.x;
          this.y = walkable.y;
        }

        // Face direction of actual movement
        if (Math.abs(dx) > 0.3) {
          this.facingRight = dx > 0;
        }

        // Bob while walking
        this._bobPhase += 0.15;
      }
    }

    // Scale based on y-position (lower = closer = larger)
    const yNorm = (this.y - vpH * this._walkBounds.yMin) / (vpH * (this._walkBounds.yMax - this._walkBounds.yMin));
    this.scale = 0.7 + Math.max(0, Math.min(1, yNorm)) * 0.5; // 0.7 (far) to 1.2 (close)
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
    // 优先用 sprite 动画 (庭院行走图)
    if (this.animations) {
      const walk = this.animations.walk?.[0];
      if (walk) return walk;
      const idle = this.animations.idle?.[0];
      if (idle) return idle;
    }
    // fallback 立绘 (用户上传的 portrait)
    if (this.imageUrl) return this.imageUrl;
    // fallback 静态占位
    const colorMap: Record<string, string> = {
      white: 'pet-white.png',
      blue: 'pet-blue.png',
      pink: 'pet-pink.png',
    };
    const file = colorMap[this.monsterType] || 'pet-idle.png';
    return `/epet/${file}`;
  }
}
