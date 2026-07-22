import { Application, Container, Sprite, Assets, Text, Graphics, Texture } from 'pixi.js';
import { PetEntity, type ScheduledBehavior } from '../entities/Pet';
import { collisionMap, type SceneObjectData, computeCollisionBounds, fillScanlineHoles } from './CollisionMap';
import { useGameStore } from './GameState';

/** Max texture dimension (px) — oversized textures are auto-downscaled to prevent GPU OOM crash */
const MAX_TEX_DIM = 1024;

/** Pre-loaded texture cache: url → Texture (avoids per-frame async loading during animation) */
const _texCache = new Map<string, Texture>();

// Default walk bounds for PORTRAIT mode (overridden by API scene config)
// Large range — let scene objects (colliders) limit walking, not hard bounds
let walkBounds = { xMin: 0.02, xMax: 0.98, yMin: 0.02, yMax: 0.98 };

/** Pet size multiplier: 1.21 = 10% + 10% bigger than original */
// PET_SIZE_MULT moved to per-model pet_models.size_mult (default 1.0, 墩墩=1.21)

function getViewport() {
  return { W: window.innerWidth, H: window.innerHeight };
}

/** Furniture placement target info (from store) */
export interface PlacingFurnitureInfo {
  shopItemId: number;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
}

export interface PetEventCallbacks {
  onPetTap?: (petId: string, pet: PetEntity) => void;
  onReady?: () => void;
  onFurniturePlaced?: (shopItemId: number, posX: number, posY: number) => void;
  onFurnitureRemove?: (furnitureId: number) => void;
  onFurnitureCancel?: () => void;
  onEmotionDropCollect?: (dropId: number) => void;
}

export class Game {
  app: Application | null = null;
  bgContainer: Container | null = null;        // Layer 0: background (sky/ground)
  sortedContainer: Container | null = null;     // Layer 1: Y-sorted objects (pets, tree trunks, fences)
  canopyContainer: Container | null = null;     // Layer 2: always-on-top (tree canopies)
  petContainer: Container | null = null;        // sub-container inside sortedContainer
  furnitureContainer: Container | null = null;  // furniture sprites inside sortedContainer
  petSprites = new Map<string, Sprite>();
  petEntities = new Map<string, PetEntity>();
  private _sceneObjects: SceneObjectData[] = [];  // from API
  private _sceneSprites: Sprite[] = [];           // rendered scene object sprites
  private _furnitureSprites = new Map<number, Container>(); // furniture id → container (sprite + remove btn)
  private _furnitureData = new Map<number, SceneObjectData>(); // furniture id → data (for collision rebuild)
  private _placingSprite: Sprite | null = null;   // ghost preview while placing
  private _placingPreview: Container | null = null;  // fixed preview with confirm/cancel buttons
  private _placingPreviewPos = { x: 0, y: 0 };     // confirmed position in viewport coords
  private _removingMode = false;                  // when true, show × buttons on placed furniture
  private _placingInfo: PlacingFurnitureInfo | null = null;
  private _ready = false;
  private _bgLoaded = false;
  private _callbacks: PetEventCallbacks = {};
  private _readyNotified = false;
  private _behaviorPollTimer: ReturnType<typeof setInterval> | null = null;
  private _scenePollTimer: ReturnType<typeof setInterval> | null = null;
  private _lastBgUrl: string | null = null;  // track current bg to detect changes
  private _lastBehaviorFrame = new Map<string, string>(); // petId → last texture URL
  private _emotionDropSprites = new Map<number, Container>(); // drop id → sprite container
  private _emotionDropIconUrl: string | null = null; // icon from epet_icons
  private _petShadows = new Map<string, Graphics>(); // petId → shadow ellipse
  // Light config: will be set from API scene.current_light
  private _lightAngle = 315 * Math.PI / 180;
  private _shadowOffset = 0.4;

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

      // Background will be loaded by _loadSceneConfig after getting bg_image_url from API
      // (fallback to default if no API scene)

      // Layer 1: Y-sorted objects (pets, tree trunks, fences, etc.)
      this.sortedContainer = new Container();
      this.sortedContainer.label = 'sorted';
      app.stage.addChild(this.sortedContainer);

      // Pet sub-container lives inside sortedContainer so Y-sort includes them
      this.petContainer = new Container();
      this.petContainer.label = 'pets';
      this.sortedContainer.addChild(this.petContainer);

      // Furniture sub-container inside sortedContainer (Y-sorted with pets)
      this.furnitureContainer = new Container();
      this.furnitureContainer.label = 'furniture';
      this.sortedContainer.addChild(this.furnitureContainer);

      // Layer 2: Canopy / always-on-top (tree canopies, roof eaves)
      this.canopyContainer = new Container();
      this.canopyContainer.label = 'canopy';
      app.stage.addChild(this.canopyContainer);

      // Initialize collision system
      await collisionMap.init();

      // Load scene config from API
      await this._loadSceneConfig();

      // Poll scene for background changes (e.g. demo time switch)
      this._startScenePoll();

      // Click-to-move: tap on empty yard area → pet walks there
      app.stage.eventMode = 'static';
      app.stage.hitArea = { contains: () => true }; // entire stage is hit area
      app.stage.on('pointerdown', (e: any) => {
        this._handleStageClick(e.globalX, e.globalY);
      });

      app.ticker.add(this._loop.bind(this));
      this._ready = true;
      this._notifyReady();
      console.log('✅ Game initialized (3-layer + collision + scene + click-to-move)');
    } catch (e) {
      console.error('Game.init failed:', e);
      throw e;
    }
  }

  /** Handle click on empty yard area — move the nearest pet to click position, or place furniture */
  private _handleStageClick(cx: number, cy: number): void {
    // If in furniture placement mode and preview is showing (confirm/cancel)
    if (this._placingInfo && this._placingPreview) {
      return; // ignore clicks while preview is shown, wait for confirm/cancel
    }

    // If in furniture placement mode, fix position and show confirm/cancel
    if (this._placingInfo) {
      this._showPlacingPreview(cx, cy);
      return;
    }

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

  private _sceneBgUrl: string | null = null;

  /** Load background image — uses scene bg_image_url if available, falls back to default */
  private async _loadBackground(urlOverride?: string): Promise<void> {
    if (!this.bgContainer) return;
    try {
      const bgUrl = urlOverride
        || this._sceneBgUrl
        || `${window.location.protocol}//${window.location.host}/epet/static/yard-bg.png`;

      // Remove old background if exists
      const oldBg = this.bgContainer.getChildByLabel('yard-bg');
      if (oldBg) {
        this.bgContainer.removeChild(oldBg);
        oldBg.destroy();
      }

      // Clear PixiJS asset cache for this URL to force reload
      try { Assets.get(bgUrl) && Assets.dispose(bgUrl); } catch (_e) { /* not cached yet, ok */ }

      const tex = await Assets.load(bgUrl);
      const bg = new Sprite(tex);
      bg.label = 'yard-bg';

      const { W, H } = getViewport();
      const scaleX = W / tex.width;
      const scaleY = H / tex.height;
      const scale = Math.max(scaleX, scaleY);  // cover mode — fill entire screen
      bg.scale.set(scale);
      bg.anchor.set(0.5, 0.5);
      bg.x = W / 2;
      bg.y = H / 2;

      this.bgContainer.addChild(bg);
      this._bgLoaded = true;
      this._lastBgUrl = bgUrl;
      console.log('✅ Background loaded:', bgUrl, { size: `${tex.width}x${tex.height}`, scale, viewport: `${W}x${H}` });
      this._notifyReady();
    } catch (e) {
      console.warn('Background load failed:', e);
      this._bgLoaded = true;
      this._notifyReady();
    }
  }

  /** Poll scene API every 30s to detect background changes (e.g. demo time switch) */
  private _startScenePoll(): void {
    if (this._scenePollTimer) return;
    this._scenePollTimer = setInterval(async () => {
      try {
        const userIdStr = localStorage.getItem('epet_user_id');
        const userId = userIdStr ? parseInt(userIdStr) : '';
        const url = userId ? `/api/epet1/yard/scene?user_id=${userId}` : '/api/epet1/yard/scene';
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.success || !data.scene?.bg_image_url) return;

        const newBgUrl = data.scene.bg_image_url.startsWith('/')
          ? `${window.location.protocol}//${window.location.host}${data.scene.bg_image_url}`
          : data.scene.bg_image_url;

        if (newBgUrl !== this._lastBgUrl) {
          console.log(`🌅 Background changed: ${this._lastBgUrl} → ${newBgUrl}`);
          this._sceneBgUrl = newBgUrl;
          await this._loadBackground();
        }
      } catch (_) { /* poll failure is non-critical */ }
    }, 30_000);
  }

  /** Stop scene background polling */
  stopScenePoll(): void {
    if (this._scenePollTimer) {
      clearInterval(this._scenePollTimer);
      this._scenePollTimer = null;
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
    entity.sizeMult = (opts as any)?.sizeMult ?? 1.0;
    entity.animConfig = (opts as any)?.animConfig ?? {};

    const { W, H } = getViewport();
    entity.setWalkBounds(walkBounds);

    // Find safe spawn position (avoid obstacles)
    const spawn = this._findSafeSpawn(W, H, opts?.x, opts?.y);
    entity.x = spawn.x;
    entity.y = spawn.y;

    this.petEntities.set(petId, entity);

    // Pre-load all animation frame textures upfront (avoid per-frame async load during walk)
    await this._preloadAnimationTextures(entity.animations);

    const imgPath = entity.getImageName();
    const base = `${window.location.protocol}//${window.location.host}`;
    const url = imgPath.startsWith('/') ? `${base}${imgPath}` : imgPath;

    try {
      const tex = await this._loadTextureSafe(url);
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

      // Create shadow ellipse
      const shadow = new Graphics();
      shadow.label = `shadow-${petId}`;
      this._petShadows.set(petId, shadow);
      this.petContainer.addChild(shadow);
      // Ensure shadow is below the sprite
      this.petContainer.addChild(sprite); // re-add sprite so it's on top of shadow
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
    const shadow = this._petShadows.get(petId);
    if (shadow && this.petContainer) {
      this.petContainer.removeChild(shadow);
      shadow.destroy();
      this._petShadows.delete(petId);
    }
    this.petEntities.delete(petId);
  }

  triggerShake(petId: string): void {
    this.petEntities.get(petId)?.triggerShake(Date.now());
  }

  triggerEating(petId: string): void {
    this.petEntities.get(petId)?.triggerEating(Date.now());
  }

  /** Pre-load all animation frame textures upfront to avoid per-frame async loading during walk/eat/etc */
  private async _preloadAnimationTextures(animations: Record<string, string[]>): Promise<void> {
    const base = `${window.location.protocol}//${window.location.host}`;
    const allUrls: string[] = [];
    for (const frames of Object.values(animations)) {
      for (const path of frames) {
        const url = path.startsWith('/') ? `${base}${path}` : path;
        if (!_texCache.has(url)) allUrls.push(url);
      }
    }
    if (allUrls.length === 0) return;
    console.log(`[Game] Pre-loading ${allUrls.length} animation textures...`);
    const t0 = performance.now();
    // Load sequentially to avoid GPU memory spike
    for (const url of allUrls) {
      try {
        const tex = await this._loadTextureSafe(url);
        if (tex) _texCache.set(url, tex);
      } catch (_e) { /* skip failed */ }
    }
    console.log(`[Game] Animation textures pre-loaded in ${(performance.now() - t0).toFixed(0)}ms`);
  }

  /** Load a texture with auto-downscale for oversized images (prevents GPU OOM) */
  private async _loadTextureSafe(url: string): Promise<Texture | null> {
    // Check cache first
    if (_texCache.has(url)) return _texCache.get(url)!;

    try {
      // Fetch image as blob to check dimensions before giving to PixiJS
      const resp = await fetch(url);
      const blob = await resp.blob();

      const bmp = await createImageBitmap(blob);
      const origW = bmp.width;
      const origH = bmp.height;

      if (origW <= MAX_TEX_DIM && origH <= MAX_TEX_DIM) {
        // Within limit — load normally via PixiJS Assets
        bmp.close();
        const tex = await Assets.load(url);
        return tex;
      }

      // Oversized — downscale using canvas
      const scale = MAX_TEX_DIM / Math.max(origW, origH);
      const newW = Math.round(origW * scale);
      const newH = Math.round(origH * scale);
      console.warn(`⚠️ Oversized texture ${origW}x${origH} → downscale to ${newW}x${newH}: ${url.split('/').pop()}`);

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0, newW, newH);
      bmp.close();

      const tex = Texture.from(canvas);
      return tex;
    } catch (e) {
      console.warn('Texture load failed:', url, e);
      return null;
    }
  }

  /** 更新宠物 sprite 的纹理（动画帧切换 — uses pre-loaded cache）*/
  private _updatePetTexture(petId: string, sprite: Sprite, imgPath: string): void {
    const base = `${window.location.protocol}//${window.location.host}`;
    const url = imgPath.startsWith('/') ? `${base}${imgPath}` : imgPath;
    const tex = _texCache.get(url);
    if (tex && sprite && !sprite.destroyed) {
      sprite.texture = tex;
    } else if (!tex) {
      // Fallback: load async (shouldn't happen if pre-load worked, but safe)
      this._loadTextureSafe(url).then(t => {
        if (t && sprite && !sprite.destroyed) {
          _texCache.set(url, t);
          sprite.texture = t;
        }
      });
    }
  }

  /** 启动定时行为轮询 */
  startBehaviorPolling(intervalMs: number = 60000): void {
    this.stopBehaviorPolling();
    // 立即执行一次
    this._pollBehaviors();
    this._behaviorPollTimer = setInterval(() => this._pollBehaviors(), intervalMs);
  }

  /** 停止定时行为轮询 */
  stopBehaviorPolling(): void {
    if (this._behaviorPollTimer) {
      clearInterval(this._behaviorPollTimer);
      this._behaviorPollTimer = null;
    }
  }

  /** 外部手动触发一次行为轮询（宠物添加后调用）*/
  pollBehaviorsOnce(): void {
    this._pollBehaviors();
  }

  /** 轮询行为 API */
  private async _pollBehaviors(): Promise<void> {
    if (this.petEntities.size === 0) return;

    // 收集所有宠物 model id
    const modelIds = new Set<number>();
    const petsByModel = new Map<number, { petId: string; entity: PetEntity }[]>();
    for (const [petId, entity] of this.petEntities) {
      modelIds.add(entity.modelId);
      if (!petsByModel.has(entity.modelId)) petsByModel.set(entity.modelId, []);
      petsByModel.get(entity.modelId)!.push({ petId, entity });
    }

    if (modelIds.size === 0) return;

    try {
      const { W, H } = getViewport();
      const res = await fetch(`/api/epet1/pet-behavior/match?pet_model_ids=${Array.from(modelIds).join(',')}`);
      const data = await res.json();
      if (!data.success) return;

      const behaviors: Record<number, ScheduledBehavior> = data.behaviors || {};
      console.log('[Game] Behavior poll result:', JSON.stringify({ modelIds: Array.from(modelIds), behaviorKeys: Object.keys(behaviors) }));

      for (const [modelId, pets] of petsByModel) {
        const behavior = behaviors[modelId] || null;
        for (const { petId, entity } of pets) {
          console.log(`[Game] Pet ${petId} modelId=${entity.modelId}: behavior=${behavior ? behavior.behavior_type : 'none'}, animations keys=${Object.keys(entity.animations).join(',')}`);
          entity.setScheduledBehavior(behavior, W, H);
        }
      }
    } catch (err) {
      console.warn('[Game] Behavior poll failed:', err);
    }
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

      const baseSize = Math.min(80, W * 0.12) * (entity.sizeMult || 1.0);
      const s = (baseSize * entity.scale) / (sprite.texture.width || 1);
      sprite.scale.set(
        entity.facingRight ? Math.abs(s) : -Math.abs(s),
        Math.abs(s),
      );
      sprite.x = entity.x;
      sprite.y = entity.y + entity.bobY;

      // Update shadow position
      const shadow = this._petShadows.get(petId);
      if (shadow) {
        const petH = baseSize * entity.scale;
        const sw = petH * 0.55; // shadow ellipse width
        const sh = petH * 0.18; // shadow ellipse height (flat)
        // Light direction offset
        const sdx = Math.cos(this._lightAngle) * petH * this._shadowOffset;
        const sdy = Math.sin(this._lightAngle) * petH * this._shadowOffset * 0.5;
        shadow.clear();
        shadow.ellipse(
          entity.x + sdx,
          entity.y + sdy + petH * 0.02, // slightly below feet
          sw, sh
        );
        shadow.fill({ color: 0x000000, alpha: 0.15 });
      }

      // Animations
      if (entity.state === 'shaking') {
        const age = now - (entity as any)._shakeStart;
        sprite.rotation = Math.sin(age * 0.06) * 0.09 * Math.max(0, 1 - age / 600);
      } else if (entity.state === 'eating') {
        sprite.rotation = Math.sin(now * 0.015) * 0.12;
      } else {
        sprite.rotation = 0;
      }

      // ── 动画帧切换 ──
      const animFrame = entity.getCurrentAnimationFrame();
      if (animFrame) {
        const lastFrame = this._lastBehaviorFrame.get(petId);
        if (animFrame !== lastFrame) {
          this._lastBehaviorFrame.set(petId, animFrame);
          this._updatePetTexture(petId, sprite, animFrame);
        }
      } else {
        // 无动画帧 → 用 getImageName fallback
        const imgPath = entity.getImageName();
        const lastFrame = this._lastBehaviorFrame.get(petId);
        if (imgPath !== lastFrame) {
          this._lastBehaviorFrame.set(petId, imgPath);
          this._updatePetTexture(petId, sprite, imgPath);
        }
      }
    });

    // Y-sort: arrange pet sprites by foot Y so closer pets overlap farther ones
    this._ySortPets();

    // Emotion drop bob animation
    this._emotionDropSprites.forEach((container) => {
      container.emit('tick');
    });
  }

  /** Load scene configuration from API and render scene objects */
  private async _loadSceneConfig(): Promise<void> {
    try {
      // Try to get user_id from localStorage (set by App.tsx)
      const userIdStr = localStorage.getItem('epet_user_id');
      const userId = userIdStr ? parseInt(userIdStr) : '';
      const url = userId ? `/api/epet1/yard/scene?user_id=${userId}` : '/api/epet1/yard/scene';
      const resp = await fetch(url);
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

      // Load/update background image from API (or fallback to default)
      if (data.scene.bg_image_url) {
        this._sceneBgUrl = data.scene.bg_image_url.startsWith('/')
          ? `${window.location.protocol}//${window.location.host}${data.scene.bg_image_url}`
          : data.scene.bg_image_url;
      }

      // Apply light config from API
      if (data.scene.current_light) {
        const cl = data.scene.current_light;
        this._lightAngle = (cl.light_angle ?? 315) * Math.PI / 180;
        this._shadowOffset = cl.shadow_offset ?? 0.4;
        console.log(`✅ Light config: angle=${cl.light_angle}°, offset=${cl.shadow_offset}`);
      }

      await this._loadBackground();

      // Load collision obstacles from scene objects
      const objects: SceneObjectData[] = data.objects || [];
      this._sceneObjects = objects;
      await collisionMap.loadFromSceneObjects(objects);

      // Render scene objects (trees, fences, etc.)
      await this._renderSceneObjects(objects);

      // Render user furniture (collision registered in _addFurnitureSprite)
      const furniture: SceneObjectData[] = data.furniture || [];
      if (furniture.length > 0) {
        await this._renderFurniture(furniture);
        console.log(`✅ ${furniture.length} user furniture rendered & collision added`);
      }

      // Store icons in game state for HUD
      if (data.icons && data.icons.length > 0) {
        const iconMap: Record<string, any> = {};
        for (const icon of data.icons) {
          if (icon.image_url) {
            iconMap[icon.icon_key] = icon;
          }
        }
        useGameStore.getState().setIcons(iconMap);
        console.log(`✅ ${Object.keys(iconMap).length} icons loaded`);
      }
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

  /** Render user furniture into the sorted layer with remove buttons */
  private async _renderFurniture(furniture: SceneObjectData[]): Promise<void> {
    if (!this.furnitureContainer) return;
    const { W, H } = getViewport();

    for (const f of furniture) {
      if (!f.image_url) continue;
      await this._addFurnitureSprite(f);
    }
  }

  /** Add a single furniture sprite (with remove button) to the furniture container */
  private async _addFurnitureSprite(f: SceneObjectData): Promise<void> {
    if (!this.furnitureContainer) return;
    const { W, H } = getViewport();
    const targetW = f.width * W;
    const targetH = f.height * H;

    const container = new Container();
    container.label = `furniture-${f.id}`;

    let sprite: Container;
    try {
      const base = `${window.location.protocol}//${window.location.host}`;
      const url = f.image_url.startsWith('/') ? `${base}${f.image_url}` : f.image_url;
      const tex = await Assets.load(url);
      if (!tex) throw new Error('no texture');
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.85);
      const scaleX = targetW / tex.width;
      const scaleY = targetH / tex.height;
      s.scale.set(Math.min(scaleX, scaleY));
      sprite = s;
      // Store pixel dimensions for aspect-fit collision
      (f as any).img_pixel_w = tex.width;
      (f as any).img_pixel_h = tex.height;
    } catch (e) {
      // Image not found — use colored placeholder
      console.warn(`[Game] Furniture image missing: ${f.label}, using placeholder`);
      const g = new Graphics();
      g.roundRect(-targetW / 2, -targetH * 0.85, targetW, targetH, 6);
      g.fill({ color: 0xC49B2A, alpha: 0.5 });
      g.stroke({ color: 0x8B6914, width: 2 });
      const label = new Text({ text: f.label, style: { fontSize: 14, fill: 0xFFFFFF, fontWeight: 'bold' } });
      label.anchor.set(0.5);
      label.x = 0;
      label.y = -targetH * 0.35;
      g.addChild(label);
      sprite = g;
    }

    sprite.x = f.pos_x * W;
    sprite.y = f.pos_y * H;
    container.addChild(sprite);

    // Remove button (×) — hidden by default, shown in removing mode
    const spriteBounds = sprite.getBounds();
    const btnSize = Math.max(20, Math.min(28, spriteBounds.width * 0.35));
    const btnX = spriteBounds.x + spriteBounds.width - btnSize * 0.3;
    const btnY = spriteBounds.y + btnSize * 0.3;

    const btnBg = new Graphics();
    btnBg.circle(0, 0, btnSize / 2);
    btnBg.fill({ color: 0xFF4444, alpha: 0.85 });
    btnBg.eventMode = 'static';
    btnBg.cursor = 'pointer';
    btnBg.x = btnX;
    btnBg.y = btnY;
    btnBg.visible = this._removingMode;
    btnBg.label = 'furniture-remove-btn';
    container.addChild(btnBg);

    const btnLabel = new Text({ text: '×', style: { fontSize: btnSize * 0.8, fill: 0xFFFFFF, fontWeight: 'bold' } });
    btnLabel.anchor.set(0.5);
    btnLabel.x = btnX;
    btnLabel.y = btnY;
    btnLabel.eventMode = 'static';
    btnLabel.cursor = 'pointer';
    btnLabel.visible = this._removingMode;
    btnLabel.label = 'furniture-remove-btn';
    container.addChild(btnLabel);

    // Click handler for remove button
    const furnitureId = f.id;
    const handleRemove = (e: any) => {
      e.stopPropagation?.();
      console.log(`[Game] Remove furniture: ${furnitureId}`);
      this._callbacks.onFurnitureRemove?.(furnitureId);
    };
    btnBg.on('pointerdown', handleRemove);
    btnLabel.on('pointerdown', handleRemove);

    this.furnitureContainer.addChild(container);
    this._furnitureSprites.set(f.id, container);
    // Store full data including image_url for pixel-accurate collision
    this._furnitureData.set(f.id, f);

    // Register furniture collision — per-pixel with scanline hole-fill.
    // Scanline fill closes interior transparent holes (pets can't walk through)
    // while preserving exterior transparent areas (pets CAN walk beside outline).
    try {
      const base = `${window.location.protocol}//${window.location.host}`;
      const url = f.image_url.startsWith('/') ? `${base}${f.image_url}` : f.image_url;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
      });

      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        const bounds = computeCollisionBounds(f, imgW, imgH);

        // Extract pixel data from the image
        const canvas = document.createElement('canvas');
        canvas.width = imgW;
        canvas.height = imgH;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, imgW, imgH);
        const pixels = new Uint8ClampedArray(imgData.data);

        // Y-flip pixel data (PixiJS renders textures with Y-flip:
        // image row 0 = visual bottom, not visual top)
        const flippedData = new Uint8ClampedArray(pixels.length);
        const rowBytes = imgW * 4;
        for (let y = 0; y < imgH; y++) {
          const srcOffset = y * rowBytes;
          const dstOffset = (imgH - 1 - y) * rowBytes;
          flippedData.set(pixels.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
        }

        // Scanline hole-fill: close interior transparent areas
        fillScanlineHoles(flippedData, imgW, imgH);

        collisionMap.addSpriteCollision({
          label: `furniture-${f.id}`,
          xMin: bounds.xMin, yMin: bounds.yMin,
          xMax: bounds.xMax, yMax: bounds.yMax,
          pixels: flippedData,
          pixelW: imgW,
          pixelH: imgH,
        });
        console.log(`✅ Furniture SPRITE+SCANLINE collision: ${f.label} (${imgW}x${imgH}), bounds=`, bounds);
      } else {
        // Fallback: use rect collision (no aspect-fit)
        collisionMap.addObstacle({
          xMin: f.pos_x - f.width / 2, yMin: f.pos_y - f.height * 0.85,
          xMax: f.pos_x + f.width / 2, yMax: f.pos_y + f.height * 0.15,
          label: `furniture-${f.id}`,
        });
        console.log(`✅ Furniture RECT collision (fallback): ${f.label}, bounds from width/height`);
      }
    } catch (e) {
      // Image failed — still register rect collision using configured width/height
      collisionMap.addObstacle({
        xMin: f.pos_x - f.width / 2, yMin: f.pos_y - f.height * 0.85,
        xMax: f.pos_x + f.width / 2, yMax: f.pos_y + f.height * 0.15,
        label: `furniture-${f.id}`,
      });
      console.warn(`⚠️ Furniture image load failed, using rect collision: ${f.label}`, e);
    }
    console.log(`  🪑 Furniture: ${f.label} at (${f.pos_x.toFixed(2)}, ${f.pos_y.toFixed(2)})`);
  }

  /** Start furniture placement mode — shows ghost preview following cursor */
  startPlacing(info: PlacingFurnitureInfo): void {
    if (!this.app || !this.sortedContainer) return;
    this.cancelPlacing(); // clean up any previous
    this._placingInfo = info;

    const base = `${window.location.protocol}//${window.location.host}`;
    const url = info.imageUrl.startsWith('/') ? `${base}${info.imageUrl}` : info.imageUrl;

    const { W, H } = getViewport();
    const targetW = info.width * W;
    const targetH = info.height * H;

    Assets.load(url).then((tex) => {
      if (!tex || !this.sortedContainer) return;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.85);
      sprite.alpha = 0.5; // ghost preview
      sprite.label = 'placing-ghost';
      const scaleX = targetW / tex.width;
      const scaleY = targetH / tex.height;
      sprite.scale.set(Math.min(scaleX, scaleY));
      sprite.x = W / 2;
      sprite.y = H / 2;
      this.sortedContainer.addChild(sprite);
      this._placingSprite = sprite;
    }).catch(() => {
      // Image failed — show colored placeholder rectangle
      console.warn('[Game] Furniture image not found, using placeholder for:', info.name);
      const g = new Graphics();
      g.roundRect(-targetW / 2, -targetH * 0.85, targetW, targetH, 6);
      g.fill({ color: 0xC49B2A, alpha: 0.35 });
      g.stroke({ color: 0x8B6914, width: 2, alpha: 0.6 });
      // Label
      const label = new Text({ text: info.name, style: { fontSize: 14, fill: 0x8B6914, fontWeight: 'bold' } });
      label.anchor.set(0.5);
      label.x = 0;
      label.y = -targetH * 0.35;
      g.addChild(label);
      g.x = W / 2;
      g.y = H / 2;
      g.label = 'placing-ghost';
      this.sortedContainer.addChild(g);
      this._placingSprite = g as any;
    });

    // Move ghost with pointer
    this.app!.stage.on('pointermove', this._onPlacingMove, this);
    console.log(`[Game] Placement mode: ${info.name}`);
  }

  /** Move the ghost preview sprite with the pointer */
  private _onPlacingMove(e: any): void {
    if (!this._placingSprite) return;
    this._placingSprite.x = e.globalX;
    this._placingSprite.y = e.globalY;
  }

  /** Show fixed preview with confirm/cancel buttons */
  private _showPlacingPreview(cx: number, cy: number): void {
    if (!this._placingInfo || !this.sortedContainer) return;

    // Remove previous preview if any
    this._removePlacingPreview();

    // Fix ghost at clicked position
    if (this._placingSprite) {
      this._placingSprite.x = cx;
      this._placingSprite.y = cy;
      this._placingSprite.alpha = 0.7; // slightly more visible
      // Stop following pointer
      if (this.app) {
        this.app.stage.off('pointermove', this._onPlacingMove, this);
      }
    }

    const info = this._placingInfo;
    const { W, H } = getViewport();
    const targetW = info.width * W;
    const targetH = info.height * H;

    // Create confirm/cancel button container — position based on actual sprite bounds
    const spriteBounds = this._placingSprite?.getBounds();
    const btnY = spriteBounds ? spriteBounds.y - 36 : cy - targetH * 0.85 - 36;
    const btnContainer = new Container();
    btnContainer.label = 'placing-preview-buttons';
    btnContainer.x = cx;
    btnContainer.y = btnY;

    // Cancel button (❌)
    const cancelBtn = new Graphics();
    cancelBtn.circle(0, 0, 20);
    cancelBtn.fill({ color: 0xFF4444, alpha: 0.9 });
    cancelBtn.eventMode = 'static';
    cancelBtn.cursor = 'pointer';
    cancelBtn.x = -28;
    const cancelLabel = new Text({ text: '✕', style: { fontSize: 18, fill: 0xFFFFFF, fontWeight: 'bold' } });
    cancelLabel.anchor.set(0.5);
    cancelLabel.x = -28;
    cancelLabel.eventMode = 'static';
    cancelLabel.cursor = 'pointer';

    // Confirm button (✅)
    const confirmBtn = new Graphics();
    confirmBtn.circle(0, 0, 20);
    confirmBtn.fill({ color: 0x44BB44, alpha: 0.9 });
    confirmBtn.eventMode = 'static';
    confirmBtn.cursor = 'pointer';
    confirmBtn.x = 28;
    const confirmLabel = new Text({ text: '✓', style: { fontSize: 20, fill: 0xFFFFFF, fontWeight: 'bold' } });
    confirmLabel.anchor.set(0.5);
    confirmLabel.x = 28;
    confirmLabel.eventMode = 'static';
    confirmLabel.cursor = 'pointer';

    btnContainer.addChild(cancelBtn, cancelLabel, confirmBtn, confirmLabel);
    this.sortedContainer.addChild(btnContainer);
    this._placingPreview = btnContainer;
    this._placingPreviewPos = { x: cx, y: cy };

    // Click handlers
    const handleCancel = (e: any) => {
      e?.stopPropagation?.();
      this._removePlacingPreview();
      // Resume ghost following mode
      if (this._placingSprite) {
        this._placingSprite.alpha = 0.5;
        if (this.app) {
          this.app.stage.on('pointermove', this._onPlacingMove, this);
        }
      }
    };

    const handleConfirm = (e: any) => {
      e?.stopPropagation?.();
      const { W: w, H: h } = getViewport();
      const posX = this._placingPreviewPos.x / w;
      const posY = this._placingPreviewPos.y / h;
      const shopItemId = info.shopItemId; // capture before clearing
      console.log('[Game] handleConfirm:', { shopItemId, posX, posY });
      this._removePlacingPreview();
      // Clear ghost and placing mode immediately (before API callback)
      if (this._placingSprite) {
        this._placingSprite.destroy();
        this._placingSprite = null;
      }
      this._placingInfo = null;
      if (this.app) {
        this.app.stage.off('pointermove', this._onPlacingMove, this);
      }
      this._callbacks.onFurniturePlaced?.(shopItemId, posX, posY);
    };

    cancelBtn.on('pointerdown', handleCancel);
    cancelLabel.on('pointerdown', handleCancel);
    confirmBtn.on('pointerdown', handleConfirm);
    confirmLabel.on('pointerdown', handleConfirm);

    console.log(`[Game] Placement preview at (${cx.toFixed(0)}, ${cy.toFixed(0)})`);
  }

  /** Remove the confirm/cancel preview buttons */
  private _removePlacingPreview(): void {
    if (this._placingPreview) {
      this._placingPreview.destroy();
      this._placingPreview = null;
    }
  }

  /** Cancel furniture placement mode */
  cancelPlacing(): void {
    this._removePlacingPreview();
    if (this._placingSprite) {
      this._placingSprite.destroy();
      this._placingSprite = null;
    }
    this._placingInfo = null;
    if (this.app) {
      this.app.stage.off('pointermove', this._onPlacingMove, this);
    }
    console.log('[Game] Placement mode cancelled');
  }

  /** Confirm furniture placement — render the placed furniture and add collision */
  async confirmPlacement(furnitureData: SceneObjectData): Promise<void> {
    // Clean up any remaining placing state (ghost already cleared in handleConfirm)
    this._removePlacingPreview();
    if (this._placingSprite) {
      this._placingSprite.destroy();
      this._placingSprite = null;
    }
    this._placingInfo = null;
    if (this.app) {
      this.app.stage.off('pointermove', this._onPlacingMove, this);
    }

    // Render the placed furniture (includes sprite collision registration)
    await this._addFurnitureSprite(furnitureData);

    console.log(`[Game] Furniture placed: ${furnitureData.label}`);
  }

  /** Remove a furniture sprite and its collision from the yard */
  removeFurnitureSprite(furnitureId: number): void {
    const container = this._furnitureSprites.get(furnitureId);
    if (container && this.furnitureContainer) {
      this.furnitureContainer.removeChild(container);
      container.destroy();
      this._furnitureSprites.delete(furnitureId);
    }
    this._furnitureData.delete(furnitureId);
    // Remove the furniture's sprite collision
    collisionMap.removeSpriteCollision(`furniture-${furnitureId}`);
    console.log(`[Game] Furniture sprite removed: ${furnitureId}`);
  }

  /** Show × remove buttons on all placed furniture (enter removing mode) */
  showRemoveButtons(): void {
    this._removingMode = true;
    this._toggleRemoveButtons(true);
  }

  /** Hide × remove buttons on all placed furniture (exit removing mode) */
  hideRemoveButtons(): void {
    this._removingMode = false;
    this._toggleRemoveButtons(false);
  }

  /** Toggle visibility of all furniture remove buttons */
  private _toggleRemoveButtons(visible: boolean): void {
    for (const container of this._furnitureSprites.values()) {
      for (const child of container.children) {
        if (child.label === 'furniture-remove-btn') {
          child.visible = visible;
        }
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
    this.furnitureContainer = null;
    this._sceneObjects = [];
    this._sceneSprites = [];
    this._furnitureSprites.clear();
    this._furnitureData.clear();
    this._placingSprite = null;
    this._placingPreview = null;
    this._placingInfo = null;
    this._ready = false;
    this._bgLoaded = false;
    this._readyNotified = false;
    this.petEntities.clear();
    this.petSprites.clear();
    this._emotionDropSprites.clear();
    this._petShadows.clear();
  }

  // ─── Emotion Drops ─────────────────────────────────────

  /** Set the icon URL for emotion drops (from epet_icons) */
  setEmotionDropIcon(url: string | null): void {
    this._emotionDropIconUrl = url;
  }

  /** Update light/shadow parameters */
  setLightConfig(lightAngle: number, shadowOffset: number): void {
    this._lightAngle = lightAngle * Math.PI / 180;
    this._shadowOffset = shadowOffset;
  }

  /** Render emotion drops on the yard */
  async renderEmotionDrops(drops: { id: number; pos_x: number; pos_y: number; amount: number }[]): Promise<void> {
    if (!this.sortedContainer) return;
    const { W, H } = getViewport();

    // Remove stale sprites
    for (const [id, container] of this._emotionDropSprites) {
      if (!drops.find(d => d.id === id)) {
        container.destroy();
        this._emotionDropSprites.delete(id);
      }
    }

    for (const drop of drops) {
      if (this._emotionDropSprites.has(drop.id)) continue; // already rendered

      const container = new Container();
      container.label = `emotion-drop-${drop.id}`;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      let sprite: Container;
      const iconSize = Math.min(W, H) * 0.07; // 7% of smaller dimension

      if (this._emotionDropIconUrl) {
        try {
          const base = `${window.location.protocol}//${window.location.host}`;
          const url = this._emotionDropIconUrl.startsWith('/') ? `${base}${this._emotionDropIconUrl}` : this._emotionDropIconUrl;
          const tex = await Assets.load(url);
          const s = new Sprite(tex);
          s.anchor.set(0.5);
          const scale = iconSize / Math.max(tex.width, tex.height);
          s.scale.set(scale);
          sprite = s;
        } catch {
          sprite = this._createEmotionDropPlaceholder(iconSize, drop.amount);
        }
      } else {
        sprite = this._createEmotionDropPlaceholder(iconSize, drop.amount);
      }

      container.addChild(sprite);

      // Amount label
      const label = new Text({
        text: `+${drop.amount}`,
        style: { fontSize: Math.max(10, iconSize * 0.35), fill: 0xFFFFFF, fontWeight: 'bold', stroke: { color: 0x000000, width: 2 } },
      });
      label.anchor.set(0.5);
      label.y = iconSize * 0.55;
      container.addChild(label);

      container.x = drop.pos_x * W;
      container.y = drop.pos_y * H;

      // Bob animation
      const startY = container.y;
      const startTime = Date.now() + Math.random() * 2000;
      container.on('tick', () => {
        const t = (Date.now() - startTime) / 1000;
        container.y = startY + Math.sin(t * 2) * 3;
      });

      // Click handler
      const dropId = drop.id;
      container.on('pointertap', (e: any) => {
        e.stopPropagation?.();
        console.log(`[Game] Emotion drop collected: ${dropId}`);
        this._callbacks.onEmotionDropCollect?.(dropId);
      });

      this.sortedContainer.addChild(container);
      this._emotionDropSprites.set(drop.id, container);
    }
  }

  /** Remove a single emotion drop sprite */
  removeEmotionDrop(dropId: number): void {
    const container = this._emotionDropSprites.get(dropId);
    if (container) {
      // Quick scale-down animation
      container.scale.set(1.5);
      container.alpha = 0;
      setTimeout(() => {
        container.destroy();
      }, 100);
      this._emotionDropSprites.delete(dropId);
    }
  }

  /** Create a placeholder graphic for emotion drops */
  private _createEmotionDropPlaceholder(size: number, amount: number): Container {
    const g = new Graphics();
    const r = size / 2;
    // Yellow diamond shape
    g.moveTo(0, -r);
    g.lineTo(r * 0.7, 0);
    g.lineTo(0, r);
    g.lineTo(-r * 0.7, 0);
    g.closePath();
    g.fill({ color: 0xFFD700, alpha: 0.9 });
    g.stroke({ color: 0xFFA500, width: 2 });
    // Inner glow
    g.moveTo(0, -r * 0.5);
    g.lineTo(r * 0.35, 0);
    g.lineTo(0, r * 0.5);
    g.lineTo(-r * 0.35, 0);
    g.closePath();
    g.fill({ color: 0xFFEF44, alpha: 0.7 });
    return g;
  }
}

export const gameInstance = new Game();
