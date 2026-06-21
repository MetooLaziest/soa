import { Application, Container, Sprite, Assets } from 'pixi.js';
import { PetEntity } from '../entities/Pet';
import { collisionMap, type SceneObjectData } from './CollisionMap';

// Default walk bounds for PORTRAIT mode (overridden by API scene config)
// Large range — let scene objects (colliders) limit walking, not hard bounds
let walkBounds = { xMin: 0.05, xMax: 0.95, yMin: 0.15, yMax: 0.92 };

/** Pet size multiplier: 1.21 = 10% + 10% bigger than original */
const PET_SIZE_MULT = 1.21;

function getViewport() {
  return { W: window.innerWidth, H: window.innerHeight };
}

export interface PetEventCallbacks {
  onPetTap?: (petId: string, pet: PetEntity) => void;
  onReady?: () => void;
}

export class Game {
  app: Application | null = null;
  bgContainer: Container | null = null;        // Layer 0: background (sky/ground)
  sortedContainer: Container | null = null;     // Layer 1: Y-sorted objects (pets, tree trunks, fences)
  canopyContainer: Container | null = null;     // Layer 2: always-on-top (tree canopies)
  petContainer: Container | null = null;        // sub-container inside sortedContainer
  petSprites = new Map<string, Sprite>();
  petEntities = new Map<string, PetEntity>();
  private _sceneObjects: SceneObjectData[] = [];  // from API
  private _sceneSprites: Sprite[] = [];           // rendered scene object sprites
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

      // Layer 0: Background (sky, ground, distant scenery)
      this.bgContainer = new Container();
      app.stage.addChild(this.bgContainer);

      // Load yard background
      this._loadBackground();

      // Layer 1: Y-sorted objects (pets, tree trunks, fences, etc.)
      this.sortedContainer = new Container();
      this.sortedContainer.label = 'sorted';
      app.stage.addChild(this.sortedContainer);

      // Pet sub-container lives inside sortedContainer so Y-sort includes them
      this.petContainer = new Container();
      this.petContainer.label = 'pets';
      this.sortedContainer.addChild(this.petContainer);

      // Layer 2: Canopy / always-on-top (tree canopies, roof eaves)
      this.canopyContainer = new Container();
      this.canopyContainer.label = 'canopy';
      app.stage.addChild(this.canopyContainer);

      // Initialize collision system
      await collisionMap.init();

      // Load scene config from API
      await this._loadSceneConfig();

      // Click-to-move: tap on empty yard area → pet walks there
      app.stage.eventMode = 'static';
      app.stage.hitArea = { contains: () => true }; // entire stage is hit area
      app.stage.on('pointerdown', (e: any) => {
        this._handleStageClick(e.globalX, e.globalY);
      });

      app.ticker.add(this._loop.bind(this));
      this._ready = true;
      console.log('✅ Game initialized (3-layer + collision + scene + click-to-move)');
    } catch (e) {
      console.error('Game.init failed:', e);
      throw e;
    }
  }

  /** Handle click on empty yard area — move the nearest pet to click position */
  private _handleStageClick(cx: number, cy: number): void {
    // Check if click hit a pet sprite — if so, ignore (pet tap handled separately)
    for (const [petId, sprite] of this.petSprites) {
      const b = sprite.getBounds();
      if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) {
        return; // clicked on a pet, don't move
      }
    }

    // Find the nearest pet to the click position
    let nearestPet: PetEntity | null = null;
    let nearestDist = Infinity;
    for (const entity of this.petEntities.values()) {
      const dx = entity.x - cx;
      const dy = entity.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPet = entity;
      }
    }

    if (nearestPet) {
      const { W, H } = getViewport();
      nearestPet.moveTo(cx, cy, W, H);
      console.log(`[Game] Click-to-move: ${nearestPet.petId} → (${cx.toFixed(0)}, ${cy.toFixed(0)})`);
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
      const bgUrl = `${window.location.protocol}//${window.location.host}/epet/static/yard-bg.png`;
      const tex = await Assets.load(bgUrl);
      const bg = new Sprite(tex);
      bg.label = 'yard-bg';

      const { W, H } = getViewport();
      const scaleX = W / tex.width;
      const scaleY = H / tex.height;
      const scale = Math.min(scaleX, scaleY);  // contain mode
      bg.scale.set(scale);
      bg.anchor.set(0.5, 0.5);
      bg.x = W / 2;
      bg.y = H / 2;

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

  /** Find a safe spawn position (not inside an obstacle) */
  private _findSafeSpawn(vpW: number, vpH: number, preferredX?: number, preferredY?: number): { x: number; y: number } {
    const x = preferredX ?? vpW * (0.15 + Math.random() * 0.7);
    const y = preferredY ?? vpH * (0.6 + Math.random() * 0.2);

    // Check if spawn position is walkable
    if (!collisionMap.isLoaded || collisionMap.isWalkable(x, y, vpW, vpH)) {
      return { x, y };
    }

    // Try spiral search for a walkable spot
    const entity = new PetEntity({ petId: '__spawn_check__', monsterType: '', displayName: '', nfc: '', userId: '', fullness: 50, lastFeedAt: '', lastInteractAt: '', totalFeeds: 0, totalPets: 0, totalPoops: 0, totalCleans: 0, currentPoops: 0, isVisible: true, displayOrder: 0, modelId: '', pet_model_id: 0 } as any);
    entity.setWalkBounds(walkBounds);
    const found = (entity as any)._findNearbyWalkable(x, y, vpW, vpH) as { x: number; y: number } | null;
    if (found) return found;

    // Ultimate fallback: center of walk bounds
    return {
      x: vpW * (walkBounds.xMin + walkBounds.xMax) / 2,
      y: vpH * (walkBounds.yMin + walkBounds.yMax) / 2,
    };
  }

  async addPet(
    petId: string,
    monsterType: string,
    displayName: string = '',
    opts?: { modelId?: number; nickname?: string; x?: number; y?: number; imageUrl?: string; animations?: Record<string, string[]> },
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
    entity.imageUrl = opts?.imageUrl || '';
    entity.animations = opts?.animations || {};

    const { W, H } = getViewport();
    entity.setWalkBounds(walkBounds);

    // Find safe spawn position (avoid obstacles)
    const spawn = this._findSafeSpawn(W, H, opts?.x, opts?.y);
    entity.x = spawn.x;
    entity.y = spawn.y;

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
      sprite.on('pointerdown', (e: any) => {
        e.stopPropagation?.(); // prevent stage click
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
    return { x: g.x, y: g.y - 40 };
  }

  private _loop(): void {
    if (!this.app || !this.petContainer) return;
    const now = Date.now();
    const { W, H } = getViewport();

    this.petEntities.forEach((entity, petId) => {
      entity.update(now, W, H);
      const sprite = this.petSprites.get(petId);
      if (!sprite) return;

      const baseSize = Math.min(80, W * 0.12) * PET_SIZE_MULT;
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

    // Y-sort: arrange pet sprites by foot Y so closer pets overlap farther ones
    this._ySortPets();
  }

  /** Load scene configuration from API and render scene objects */
  private async _loadSceneConfig(): Promise<void> {
    try {
      const resp = await fetch('/api/epet1/yard/scene');
      const data = await resp.json();
      if (!data.success || !data.scene) {
        console.log('ℹ️ No scene config from API, using defaults');
        return;
      }

      // Update walk bounds
      if (data.scene.walk_bounds) {
        walkBounds = data.scene.walk_bounds;
        console.log('✅ Walk bounds from API:', walkBounds);
      }

      // Load collision obstacles from scene objects
      const objects: SceneObjectData[] = data.objects || [];
      this._sceneObjects = objects;
      await collisionMap.loadFromSceneObjects(objects);

      // Render scene objects (trees, fences, etc.)
      await this._renderSceneObjects(objects);
    } catch (e) {
      console.warn('Scene config load failed, using defaults:', e);
    }
  }

  /** Render scene objects into the 3-layer system */
  private async _renderSceneObjects(objects: SceneObjectData[]): Promise<void> {
    if (!this.bgContainer || !this.sortedContainer || !this.canopyContainer) return;
    const { W, H } = getViewport();

    for (const obj of objects) {
      if (!obj.image_url) continue;

      try {
        const base = `${window.location.protocol}//${window.location.host}`;
        const url = obj.image_url.startsWith('/') ? `${base}${obj.image_url}` : obj.image_url;
        const tex = await Assets.load(url);
        if (!tex) continue;

        const sprite = new Sprite(tex);
        sprite.label = `scene-${obj.id}-${obj.label}`;
        sprite.anchor.set(0.5, 0.85);

        sprite.x = obj.pos_x * W;
        sprite.y = obj.pos_y * H;

        const targetW = obj.width * W;
        const targetH = obj.height * H;
        const scaleX = targetW / tex.width;
        const scaleY = targetH / tex.height;
        const s = Math.min(scaleX, scaleY);
        sprite.scale.set(s);

        if (obj.layer === 0) {
          this.bgContainer.addChild(sprite);
        } else if (obj.layer === 2) {
          this.canopyContainer.addChild(sprite);
        } else {
          this.sortedContainer.addChild(sprite);
        }

        this._sceneSprites.push(sprite);
        console.log(`  🎨 Scene object: ${obj.label} (L${obj.layer}) at (${obj.pos_x.toFixed(2)}, ${obj.pos_y.toFixed(2)})`);
      } catch (e) {
        console.warn(`  Failed to load scene object: ${obj.label}`, e);
      }
    }
  }

  /** Sort petContainer children by Y position (lower Y = farther = drawn first) */
  private _ySortPets(): void {
    if (!this.petContainer) return;
    const children = [...this.petContainer.children];
    children.sort((a, b) => a.y - b.y);
    for (let i = 0; i < children.length; i++) {
      this.petContainer.addChildAt(children[i], i);
    }
  }

  destroy(): void {
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.bgContainer = null;
    this.sortedContainer = null;
    this.canopyContainer = null;
    this.petContainer = null;
    this._sceneObjects = [];
    this._sceneSprites = [];
    this._ready = false;
    this._bgLoaded = false;
  }
}

export const gameInstance = new Game();
