import type { Pet } from '../api/epet';
import { collisionMap } from '../game/CollisionMap';

export type WanderState = 'idle' | 'walking' | 'shaking' | 'eating' | 'sleeping' | 'working';

/** 定时行为数据（从 API 返回） */
export interface ScheduledBehavior {
  id: number;
  pet_model_id: number;
  name: string;
  behavior_type: string;  // idle/walk/eat/sleep/shake/work
  time_start: string;
  time_end: string;
  position_x: number | null;
  position_y: number | null;
  is_active: boolean;
  sort_order: number;
}

/** 宠物行为模式 */
export type BehaviorMode = 'free' | 'scheduled' | 'user_guided';

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
  private _collisionRadius = 0.035; // viewport-width fraction; ~13px at 375, ~26px at 750

  // Animation timers
  private _shakeStart: number = 0;
  private _eatingStart: number = 0;

  // ═══════ 定时行为系统 ═══════
  private _behaviorMode: BehaviorMode = 'free';
  private _scheduledBehavior: ScheduledBehavior | null = null;
  private _userGuidedUntil: number = 0;   // 用户引导结束时间戳，之后1分钟恢复定时行为
  private _animFrameIndex: number = 0;    // 当前动画帧索引
  private _animFrameTimer: number = 0;    // 帧切换计时器
  private _animFrameInterval: number = 200; // 帧间隔 ms (默认, 会被 animConfig 覆盖)

  // ═══════ 卡住脱困系统 ═══════
  private _stuckCheckStart: number = 0;   // 开始检测卡住的时间
  private _lastStuckX: number = -1;       // 上次检测时的 X
  private _lastStuckY: number = -1;       // 上次检测时的 Y
  private static readonly STUCK_THRESHOLD = 3000;  // 3秒未移动视为卡住
  private static readonly STUCK_MOVE_TOLERANCE = 2; // 移动小于2px视为未移动

  // ═══════ 行走进展停滞检测 ═══════
  private _walkStuckStart: number = 0;    // 开始检测行走停滞的时间
  private _walkStuckDist: number = Infinity; // 开始检测时到目标的距离
  private static readonly WALK_STUCK_THRESHOLD = 2000; // 2秒进展停滞则换方向
  private static readonly WALK_STUCK_MIN_PROGRESS = 5;  // 距离缩小小于5px视为无进展
  sizeMult: number = 1.0;  // 庭院大小比例 (来自 pet_models.size_mult)
  animConfig: Record<string, number> = {}; // 各动作帧间隔 (来自 pet_models.anim_config)

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
    this._walkBounds = { xMin: 0.02, xMax: 0.98, yMin: 0.02, yMax: 0.98 };
  }

  /** Set the walkable area as fractions of viewport (0-1) */
  setWalkBounds(b: { xMin: number; xMax: number; yMin: number; yMax: number }) {
    this._walkBounds = b;
  }

  // ═══════ 定时行为 API ═══════

  /** 设置当前定时行为（由外部 API 轮询调用） */
  setScheduledBehavior(behavior: ScheduledBehavior | null, vpW: number, vpH: number) {
    // 如果正在用户引导中，不切换行为
    if (this._behaviorMode === 'user_guided') {
      this._scheduledBehavior = behavior; // 记住但暂不执行
      return;
    }

    this._scheduledBehavior = behavior;

    if (behavior) {
      this._behaviorMode = 'scheduled';
      // 切换到对应行为状态
      const stateMap: Record<string, WanderState> = {
        idle: 'idle',
        walk: 'walking',
        eat: 'eating',
        sleep: 'sleeping',
        shake: 'shaking',
        work: 'working',
      };
      this.state = stateMap[behavior.behavior_type] || 'idle';

      // 如果行为指定了位置，移动过去（先检查碰撞，避免初始化卡在家具里）
      if (behavior.position_x != null && behavior.position_y != null) {
        const targetX = vpW * behavior.position_x;
        const targetY = vpH * behavior.position_y;
        const cr = vpW * this._collisionRadius;
        if (collisionMap.isLoaded && !collisionMap.isWalkableArea(targetX, targetY, cr, vpW, vpH)) {
          // 目标位置在家具内 → 螺旋搜索附近可行走位置
          const escape = this._findNearbyWalkable(targetX, targetY, vpW, vpH);
          if (escape) {
            this.x = escape.x;
            this.y = escape.y;
            console.log(`🐾 Pet ${this.displayName} scheduled position inside furniture → adjusted to (${escape.x.toFixed(1)}, ${escape.y.toFixed(1)})`);
          } else {
            this.x = targetX;
            this.y = targetY;
          }
        } else {
          this.x = targetX;
          this.y = targetY;
        }
      }

      // scheduled idle 不需要再 pickTarget
      if (this.state === 'idle') {
        this._idleUntil = Infinity;
      } else if (this.state === 'walking') {
        this._pickTarget(vpW, vpH);
      }
    } else {
      // 无定时行为 → 自由模式
      this._behaviorMode = 'free';
      if (this.state === 'sleeping' || this.state === 'working') {
        // 从睡觉/工作中醒来 → 恢复随机走动
        this.state = 'idle';
        this._idleUntil = 0;
      }
    }
  }

  /** 用户点击引导移动 → 中断定时行为 */
  moveTo(targetX: number, targetY: number, vpW: number, vpH: number) {
    // 进入用户引导模式，持续1分钟
    this._behaviorMode = 'user_guided';
    this._userGuidedUntil = Date.now() + 60_000; // 1分钟后恢复

    // Clamp to walk bounds
    const cx = Math.max(vpW * this._walkBounds.xMin, Math.min(vpW * this._walkBounds.xMax, targetX));
    const cy = Math.max(vpH * this._walkBounds.yMin, Math.min(vpH * this._walkBounds.yMax, targetY));

    // Check if target is walkable (5-point volume check)
    const cr = vpW * this._collisionRadius;
    if (collisionMap.isLoaded && !collisionMap.isWalkableArea(cx, cy, cr, vpW, vpH)) {
      const found = this._findNearbyWalkable(cx, cy, vpW, vpH);
      if (found) {
        this._targetX = found.x;
        this._targetY = found.y;
      } else {
        return;
      }
    } else {
      this._targetX = cx;
      this._targetY = cy;
    }

    this._walkSpeed = 0.6 + Math.random() * 0.6;
    this.state = 'walking';
    this._idleUntil = Infinity;
  }

  /** 获取当前行为模式 */
  get behaviorMode(): BehaviorMode {
    return this._behaviorMode;
  }

  /** 获取当前定时行为 */
  get scheduledBehavior(): ScheduledBehavior | null {
    return this._scheduledBehavior;
  }

  /** 获取当前应显示的动画帧 URL */
  getCurrentAnimationFrame(): string | null {
    const stateKey = this._getStateAnimationKey();
    const frames = this.animations[stateKey];
    if (!frames || frames.length === 0) return null;
    if (frames.length === 1) return frames[0];
    return frames[this._animFrameIndex % frames.length];
  }

  /** 获取状态对应的 animations key */
  private _getStateAnimationKey(): string {
    switch (this.state) {
      case 'walking': return 'walk';
      case 'eating': return 'eat';
      case 'sleeping': return 'sleep';
      case 'shaking': return 'shake';
      case 'working': return 'work';
      default: return 'idle';
    }
  }

  /** 获取当前动画状态 key（供装扮帧同步使用） */
  getAnimStateKey(): string {
    return this._getStateAnimationKey();
  }

  /** 获取当前动画帧索引（供装扮帧同步使用） */
  getAnimFrameIndex(): number {
    return this._animFrameIndex;
  }

  /** Find a walkable position near (x,y) using spiral search */
  private _findNearbyWalkable(x: number, y: number, vpW: number, vpH: number): { x: number; y: number } | null {
    const step = Math.min(vpW, vpH) * 0.03;
    const cr = vpW * this._collisionRadius;
    for (let r = 1; r <= 5; r++) {
      for (let angle = 0; angle < 8 * r; angle++) {
        const a = (angle / (8 * r)) * Math.PI * 2;
        const tx = x + Math.cos(a) * step * r;
        const ty = y + Math.sin(a) * step * r;
        if (collisionMap.isWalkableArea(tx, ty, cr, vpW, vpH) &&
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
    const cr = vpW * this._collisionRadius;
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = vpW * (this._walkBounds.xMin + Math.random() * (this._walkBounds.xMax - this._walkBounds.xMin));
      const ty = vpH * (this._walkBounds.yMin + Math.random() * (this._walkBounds.yMax - this._walkBounds.yMin));
      if (!collisionMap.isLoaded || collisionMap.isWalkableArea(tx, ty, cr, vpW, vpH)) {
        this._targetX = tx;
        this._targetY = ty;
        this._walkSpeed = 0.3 + Math.random() * 0.9;
        return;
      }
    }
    this._targetX = vpW * (this._walkBounds.xMin + 0.5 * (this._walkBounds.xMax - this._walkBounds.xMin));
    this._targetY = vpH * (this._walkBounds.yMin + 0.5 * (this._walkBounds.yMax - this._walkBounds.yMin));
    this._walkSpeed = 0.3 + Math.random() * 0.9;
  }

  update(now: number, vpW: number, vpH: number): void {
    // ── 卡住脱困检测 ──
    // 如果宠物连续 3 秒几乎没移动，且当前位置不可行走，自动螺旋搜索脱困
    if (collisionMap.isLoaded && now - this._stuckCheckStart >= 1000) {
      const moved = Math.abs(this.x - this._lastStuckX) + Math.abs(this.y - this._lastStuckY);
      if (moved < PetEntity.STUCK_MOVE_TOLERANCE) {
        // 检查当前是否在不通行区域
        const cr = vpW * this._collisionRadius;
        if (!collisionMap.isWalkableArea(this.x, this.y, cr, vpW, vpH)) {
          // 已经卡了至少1秒，累计检测
          if (this._stuckCheckStart > 0 && now - this._stuckCheckStart >= PetEntity.STUCK_THRESHOLD) {
            // 卡住超过阈值 → 螺旋搜索脱困
            const escape = this._findNearbyWalkable(this.x, this.y, vpW, vpH);
            if (escape) {
              console.log(`🐾 Pet ${this.displayName} stuck → escaped to (${escape.x.toFixed(1)}, ${escape.y.toFixed(1)})`);
              this.x = escape.x;
              this.y = escape.y;
              this.state = 'idle';
              this._idleUntil = now + 500 + Math.random() * 1000;
            } else {
              // 螺旋搜索也找不到 → 强制移到可行走区域中心
              const cx = vpW * (this._walkBounds.xMin + 0.5 * (this._walkBounds.xMax - this._walkBounds.xMin));
              const cy = vpH * (this._walkBounds.yMin + 0.5 * (this._walkBounds.yMax - this._walkBounds.yMin));
              if (collisionMap.isWalkableArea(cx, cy, cr, vpW, vpH)) {
                console.log(`🐾 Pet ${this.displayName} stuck → forced reset to center`);
                this.x = cx;
                this.y = cy;
              }
              this.state = 'idle';
              this._idleUntil = now + 500;
            }
            // 重置检测
            this._stuckCheckStart = 0;
            this._lastStuckX = this.x;
            this._lastStuckY = this.y;
          } else if (this._stuckCheckStart === 0) {
            // 开始计时
            this._stuckCheckStart = now;
          }
        } else {
          // 当前位置可行走，重置
          this._stuckCheckStart = 0;
        }
      } else {
        // 有移动，重置
        this._stuckCheckStart = 0;
      }
      this._lastStuckX = this.x;
      this._lastStuckY = this.y;
    }

    // ── 动画帧切换 (使用 animConfig 中对应动作的帧间隔) ──
    const stateKey = this._getStateAnimationKey();
    const frameInterval = this.animConfig[stateKey] || this._animFrameInterval;
    this._animFrameTimer += 16; // ~60fps
    if (this._animFrameTimer >= frameInterval) {
      this._animFrameTimer = 0;
      const frames = this.animations[stateKey];
      if (frames && frames.length > 1) {
        this._animFrameIndex = (this._animFrameIndex + 1) % frames.length;
      }
    }

    // ── 用户引导模式1分钟到期 → 恢复定时行为 ──
    if (this._behaviorMode === 'user_guided' && now > this._userGuidedUntil) {
      if (this._scheduledBehavior) {
        this._behaviorMode = 'scheduled';
        const stateMap: Record<string, WanderState> = {
          idle: 'idle', walk: 'walking', eat: 'eating',
          sleep: 'sleeping', shake: 'shaking', work: 'working',
        };
        this.state = stateMap[this._scheduledBehavior.behavior_type] || 'idle';
        if (this._scheduledBehavior.position_x != null && this._scheduledBehavior.position_y != null) {
          this.x = vpW * this._scheduledBehavior.position_x;
          this.y = vpH * this._scheduledBehavior.position_y;
        }
        if (this.state === 'idle') {
          this._idleUntil = Infinity;
        } else if (this.state === 'walking') {
          this._pickTarget(vpW, vpH);
        }
      } else {
        this._behaviorMode = 'free';
        this.state = 'idle';
        this._idleUntil = 0;
      }
    }

    // ── 定时行为的 walk 状态持续走动 ──
    // (walk 类型的定时行为 = 持续在区域内散步)

    // ── Animation state expiry (仅 free 模式) ──
    if (this._behaviorMode === 'free') {
      if (this.state === 'shaking' && now - this._shakeStart > 600) {
        this.state = 'idle';
        this._idleUntil = now + 1000 + Math.random() * 2000;
      }
      if (this.state === 'eating' && now - this._eatingStart > 5000) {
        this.state = 'idle';
        this._idleUntil = now + 2000 + Math.random() * 3000;
      }
    }

    // ── Wander state machine ──
    // sleeping/working 定时行为：原地不动
    if (this.state === 'sleeping' || this.state === 'working') {
      // 定时行为中，保持静止
      if (this._behaviorMode === 'scheduled') return;
      // free 模式下不应该到这些状态，但防御性处理
    }

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

      // ── 行走进展停滞检测 ──
      // 如果连续 2 秒离目标距离没缩小超过 5px，说明这条路走不通 → 换方向
      if (this._walkStuckStart === 0) {
        // 刚开始走，记录基准
        this._walkStuckStart = now;
        this._walkStuckDist = dist;
      } else if (now - this._walkStuckStart >= PetEntity.WALK_STUCK_THRESHOLD) {
        const progress = this._walkStuckDist - dist; // 距离缩小了多少
        if (progress < PetEntity.WALK_STUCK_MIN_PROGRESS) {
          // 进展不足 → 换方向
          console.log(`🐾 Pet ${this.displayName} walk stalled (progress=${progress.toFixed(1)}px in 2s) → picking new target`);
          this._pickTarget(vpW, vpH);
          this._walkStuckStart = 0; // 重置检测
          this._walkStuckDist = Infinity;
          // 跳过本帧移动，下帧从新目标开始
        } else {
          // 有进展，重置基准继续检测
          this._walkStuckStart = now;
          this._walkStuckDist = dist;
        }
      }

      if (dist < 5) {
        // Reached target
        this._walkStuckStart = 0; // 重置行走停滞检测
        if (this._behaviorMode === 'scheduled' && this._scheduledBehavior?.behavior_type === 'walk') {
          // 定时散步：到达后立刻选下一个目标（持续走）
          this._pickTarget(vpW, vpH);
        } else if (this._behaviorMode === 'user_guided') {
          // 用户引导走完一段 → 短暂停后继续随机走
          this.state = 'idle';
          this._idleUntil = now + 1500 + Math.random() * 2000;
        } else {
          this.state = 'idle';
          this._idleUntil = now + 1500 + Math.random() * 4000;
        }
      } else {
        const step = this._walkSpeed * (vpW / 375);
        const ratio = Math.min(step / dist, 1);
        const nextX = this.x + dx * ratio;
        const nextY = this.y + dy * ratio;
        const cr = vpW * this._collisionRadius;

        const walkable = collisionMap.findWalkableArea(this.x, this.y, nextX, nextY, cr, vpW, vpH);

        if (walkable.x === this.x && walkable.y === this.y) {
          if (this._behaviorMode === 'scheduled' && this._scheduledBehavior?.behavior_type === 'walk') {
            // 定时散步被卡住 → 换方向
            this._pickTarget(vpW, vpH);
          } else {
            this.state = 'idle';
            this._idleUntil = now + 500 + Math.random() * 1000;
          }
        } else {
          this.x = walkable.x;
          this.y = walkable.y;
        }

        if (Math.abs(dx) > 0.3) {
          this.facingRight = dx > 0;
        }

        this._bobPhase += 0.15;
      }
    }

    // 正交视角：无近大远小效果
    this.scale = 1.0;
  }

  triggerShake(now: number): void {
    this.state = 'shaking';
    this._shakeStart = now;
  }

  triggerEating(now: number): void {
    this.state = 'eating';
    this._eatingStart = now;
  }

  /** Bob offset for walking animation */
  get bobY(): number {
    if (this.state !== 'walking') return 0;
    return Math.sin(this._bobPhase) * 3;
  }

  getImageName(): string {
    // 优先用当前行为动画帧
    const animFrame = this.getCurrentAnimationFrame();
    if (animFrame) return animFrame;

    // fallback 立绘
    if (this.imageUrl) return this.imageUrl;

    const colorMap: Record<string, string> = {
      white: 'pet-white.png',
      blue: 'pet-blue.png',
      pink: 'pet-pink.png',
    };
    const file = colorMap[this.monsterType] || 'pet-idle.png';
    return `/epet/${file}`;
  }
}
