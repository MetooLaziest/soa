import { Application, Container, Sprite, Assets } from 'pixi.js';
import { PetEntity } from '../entities/Pet';

// Walkable area as fractions of viewport (mapped to the treehouse ground)
const WALK_BOUNDS = { xMin: 0.05, xMax: 0.88, yMin: 0.45, yMax: 0.78 };

function getViewport() {
  return { W: window.innerWidth, H: window.innerHeight };
}

export interface PetEventCallbacks {
  onPetTap?: (petId: string, pet: PetEntity) => void;
  onReady?: () => void;
}

export class Game {
  app: Application | null = null;
  bgContainer: Container | null = null;
  petContainer: Container | null = null;
  petSprites = new Map<string, Sprite>();
  petEntities = new Map<string, PetEntity>();
  private _ready = false;
  private _bgLoaded = false;
  private _callbacks: PetEventCallbacks = {};
  private _readyNotified = false;

  /** Set tap handler for pets */
  setCallbacks(cb: PetEventCallbacks) {
    this._callbacks = cb;
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    try {
      const app = new Application();
      await app.init({
        canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      this.app = app;

      // Layer 0: Background
      this.bgContainer = new Container();
      app.stage.addChild(this.bgContainer);

      // Load treehouse background
      this._loadBackground();

      // Layer 1: Pets
      this.petContainer = new Container();
      app.stage.addChild(this.petContainer);

      app.ticker.add(this._loop.bind(this));
      this._ready = true;
      console.log('✅ Game initialized');
    } catch (e) {
      console.error('Game.init failed:', e);
      throw e;
    }
  }

  private _notifyReady() {
    if (this._readyNotified || !this.isReady) return;
    this._readyNotified = true;
    this._callbacks.onReady?.();
  }

  private async _loadBackground() {
    if (!this.bgContainer) return;
    try {
      const bgUrl = `${window.location.protocol}//${window.location.host}/epet/yard-bg.jpg`;
      const tex = await Assets.load(bgUrl);
      const bg = new Sprite(tex);
      bg.label = 'yard-bg';

      const { W, H } = getViewport();
      // 用 contain 模式：图片完整显示，必要时上下/左右有黑边
      // 这样横图在竖屏下不会被裁切关键内容
      const scaleX = W / tex.width;
      const scaleY = H / tex.height;
      const scale = Math.min(scaleX, scaleY);  // ✅ contain 模式
      bg.scale.set(scale);
      bg.anchor.set(0.5, 0.5);  // 中心锚点
      bg.x = W / 2;
      bg.y = H / 2;  // 垂直居中

      this.bgContainer.addChild(bg);
      this._bgLoaded = true;
      console.log('✅ Background loaded:', { size: `${tex.width}x${tex.height}`, scale, viewport: `${W}x${H}` });
      this._notifyReady();
    } catch (e) {
      console.warn('Background load failed:', e);
      this._bgLoaded = true;
      this._notifyReady();
    }
  }

  get isReady(): boolean {
    return this._ready && this._bgLoaded;
  }

  async addPet(
    petId: string,
    monsterType: string,
    displayName: string = '',
    opts?: { modelId?: number; nickname?: string; x?: number; y?: number },
  ): Promise<void> {
    if (this.petEntities.has(petId)) return;
    if (!this.app || !this.petContainer) return;

    const entity = new PetEntity({
      petId,
      monsterType,
      displayName: displayName || monsterType,
      nfc: petId,
      userId: '',
      fullness: 50,
      lastFeedAt: '',
      lastInteractAt: '',
      totalFeeds: 0,
      totalPets: 0,
      totalPoops: 0,
      totalCleans: 0,
      currentPoops: 0,
      isVisible: true,
      displayOrder: 0,
      modelId: '',
      pet_model_id: opts?.modelId ?? 0,
      nickname: opts?.nickname ?? displayName,
    } as any);

    const { W, H } = getViewport();
    entity.setWalkBounds(WALK_BOUNDS);

    // Initial position
    entity.x = opts?.x ?? W * (0.15 + Math.random() * 0.7);
    entity.y = opts?.y ?? H * (0.5 + Math.random() * 0.25);

    this.petEntities.set(petId, entity);

    const imgPath = entity.getImageName();
    const base = `${window.location.protocol}//${window.location.host}`;
    const url = imgPath.startsWith('/') ? `${base}${imgPath}` : imgPath;

    try {
      const tex = await Assets.load(url);
      if (!tex) return;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.85); // anchor near feet
      sprite.label = petId;
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';

      // Tap handler
      sprite.on('pointerdown', () => {
        console.log('[Game] Pet tapped:', petId);
        this._callbacks.onPetTap?.(petId, entity);
      });

      this.petSprites.set(petId, sprite);
      this.petContainer.addChild(sprite);
    } catch (e) {
      console.warn(`Failed to load pet texture: ${imgPath}`, e);
    }
  }

  removePet(petId: string): void {
    const sprite = this.petSprites.get(petId);
    if (sprite && this.petContainer) {
      this.petContainer.removeChild(sprite);
      sprite.destroy();
      this.petSprites.delete(petId);
    }
    this.petEntities.delete(petId);
  }

  triggerShake(petId: string): void {
    this.petEntities.get(petId)?.triggerShake(Date.now());
  }

  triggerEating(petId: string): void {
    this.petEntities.get(petId)?.triggerEating(Date.now());
  }

  /** Get pet center coordinates in viewport space (for UI overlays) */
  getPetScreenPos(petId: string): { x: number; y: number } | null {
    const sprite = this.petSprites.get(petId);
    if (!sprite || !this.app) return null;
    const g = sprite.getGlobalPosition();
    return { x: g.x, y: g.y - 40 }; // slightly above sprite
  }

  private _loop(): void {
    if (!this.app || !this.petContainer) return;
    const now = Date.now();
    const { W, H } = getViewport();

    this.petEntities.forEach((entity, petId) => {
      entity.update(now, W, H);
      const sprite = this.petSprites.get(petId);
      if (!sprite) return;

      const baseSize = Math.min(80, W * 0.12);
      const s = (baseSize * entity.scale) / (sprite.texture.width || 1);
      sprite.scale.set(
        entity.facingRight ? Math.abs(s) : -Math.abs(s),
        Math.abs(s),
      );
      sprite.x = entity.x;
      sprite.y = entity.y + entity.bobY;

      // Animations
      if (entity.state === 'shaking') {
        const age = now - (entity as any)._shakeStart;
        sprite.rotation = Math.sin(age * 0.06) * 0.09 * Math.max(0, 1 - age / 600);
      } else if (entity.state === 'eating') {
        sprite.rotation = Math.sin(now * 0.015) * 0.12;
      } else {
        sprite.rotation = 0;
      }
    });
  }

  destroy(): void {
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.bgContainer = null;
    this.petContainer = null;
    this._ready = false;
    this._bgLoaded = false;
  }
}

export const gameInstance = new Game();
