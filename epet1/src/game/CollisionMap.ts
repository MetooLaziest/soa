import { Assets, Texture } from 'pixi.js';

/** Scene object from API */
export interface SceneObjectData {
  id: number;
  label: string;
  object_type: string;
  layer: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  image_url: string;
  collidable: boolean;
  sort_priority: number;
  is_user_furniture?: boolean;
  img_pixel_w?: number;
  img_pixel_h?: number;
}

/** A rectangle obstacle in viewport-fraction coords (0-1) */
export interface RectObstacle {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  label?: string;
  /** Ground Y (anchor Y) in viewport-fraction — for Y-aware collision (Plan B) */
  groundY?: number;
}

/** Per-sprite pixel collision data */
export interface SpriteCollision {
  label: string;
  /** Viewport-fraction bounds matching render (anchor 0.5, 0.85, aspect-fit) */
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  /** Pixel data (RGBA) */
  pixels: Uint8ClampedArray;
  pixelW: number;
  pixelH: number;
  /** Ground Y (anchor Y) in viewport-fraction — for Y-aware collision (Plan B) */
  groundY?: number;
} /**
 * Compute the actual viewport-fraction collision bounds for an object,
 * accounting for aspect-fit (Math.min(scaleX, scaleY)) scaling
 * and the anchor (0.5, 0.85) used in PixiJS rendering.
 *
 * This mirrors the rendering logic in Game.ts:
 *   targetW = width * W, targetH = height * H
 *   scale = Math.min(targetW / imgW, targetH / imgH)
 *   actualW = imgW * scale, actualH = imgH * scale
 *   sprite at (pos_x * W, pos_y * H) with anchor (0.5, 0.85)
 *   → visual bounds in viewport px:
 *       left   = pos_x * W - actualW / 2
 *       top    = pos_y * H - actualH * 0.85
 *       right  = pos_x * W + actualW / 2
 *       bottom = pos_y * H + actualH * 0.15
 *   → in viewport-fraction (divide by W, H):
 *       xMin = pos_x - actualW / (2 * W) = pos_x - (actualW/W) / 2
 *       xMax = pos_x + (actualW/W) / 2
 *       yMin = pos_y - (actualH/H) * 0.85
 *       yMax = pos_y + (actualH/H) * 0.15
 */
export function computeCollisionBounds(
  o: { pos_x: number; pos_y: number; width: number; height: number },
  imgW: number, imgH: number,
): { xMin: number; yMin: number; xMax: number; yMax: number; groundY: number } {
  const scaleX = o.width / imgW;
  const scaleY = o.height / imgH;
  const actualScale = Math.min(scaleX, scaleY);
  const actualW = imgW * actualScale; // in viewport-fraction (width units)
  const actualH = imgH * actualScale; // in viewport-fraction (height units)

  return {
    xMin: o.pos_x - actualW / 2,
    xMax: o.pos_x + actualW / 2,
    yMin: o.pos_y - actualH * 0.85,
    yMax: o.pos_y + actualH * 0.15,
    groundY: o.pos_y, // anchor Y = ground position (where feet touch)
  };
}

/**
 * Compute collision bounds for objects without images (rect-only mode).
 * Uses the full width/height as-is (no aspect-fit), matching the admin editor preview.
 */
function computeRectCollisionBounds(
  o: { pos_x: number; pos_y: number; width: number; height: number },
): { xMin: number; yMin: number; xMax: number; yMax: number; groundY: number } {
  return {
    xMin: o.pos_x - o.width / 2,
    xMax: o.pos_x + o.width / 2,
    yMin: o.pos_y - o.height * 0.85,
    yMax: o.pos_y + o.height * 0.15,
    groundY: o.pos_y, // anchor Y = ground position (where feet touch)
  };
}

const ALPHA_THRESHOLD = 30; // alpha > 30 = solid

/**
 * Scanline hole-fill: for each row, find the first and last opaque pixel,
 * then fill all transparent pixels between them as opaque.
 * This closes interior "holes" (preventing pets from walking through
 * transparent areas inside a furniture outline) while preserving
 * exterior transparent areas (allowing pets to walk beside the outline).
 */
export function fillScanlineHoles(data: Uint8ClampedArray, w: number, h: number): void {
  const rowBytes = w * 4;
  for (let y = 0; y < h; y++) {
    const rowStart = y * rowBytes;
    // Find first opaque pixel in this row
    let first = -1;
    for (let x = 0; x < w; x++) {
      if (data[rowStart + x * 4 + 3] > ALPHA_THRESHOLD) {
        first = x;
        break;
      }
    }
    if (first === -1) continue; // entire row transparent — skip

    // Find last opaque pixel in this row
    let last = -1;
    for (let x = w - 1; x >= 0; x--) {
      if (data[rowStart + x * 4 + 3] > ALPHA_THRESHOLD) {
        last = x;
        break;
      }
    }

    // Fill all pixels between first and last as opaque
    for (let x = first; x <= last; x++) {
      const idx = rowStart + x * 4;
      if (data[idx + 3] <= ALPHA_THRESHOLD) {
        data[idx] = 255;   // R
        data[idx + 1] = 255; // G
        data[idx + 2] = 255; // B
        data[idx + 3] = 255; // A — mark as solid
      }
    }
  }
}

/**
 * Plan A: Footprint-only collision mask.
 * Clear (set alpha=0) all pixels above a certain row ratio,
 * keeping only the bottom portion as collidable.
 * This prevents pets from colliding with the "air" above furniture
 * (e.g., chair back, swing chains) while still blocking the footprint.
 *
 * @param data   RGBA pixel data (Y-flipped, same as after fillScanlineHoles)
 * @param w      Image width in pixels
 * @param h      Image height in pixels
 * @param keepRatio  Fraction of image height from bottom to KEEP as collidable (0.25 = bottom 25%)
 */
export function clearUpperPixels(data: Uint8ClampedArray, w: number, h: number, keepRatio: number = 0.25): void {
  // In Y-flipped data: row 0 = visual TOP, row (h-1) = visual BOTTOM
  // We want to keep the bottom `keepRatio` portion → rows from (h * (1 - keepRatio)) to (h-1)
  // Clear everything from row 0 to the cutoff row
  const cutoffRow = Math.floor(h * (1 - keepRatio));
  const rowBytes = w * 4;
  for (let y = 0; y < cutoffRow; y++) {
    const rowStart = y * rowBytes;
    for (let x = 0; x < w; x++) {
      const idx = rowStart + x * 4;
      data[idx + 3] = 0; // Set alpha to 0 = transparent/non-collidable
    }
  }
}

export class CollisionMap {
  private _obstacles: RectObstacle[] = [];
  private _spriteCollisions: SpriteCollision[] = [];
  private _loaded = false;

  /** Add a sprite collision entry directly (used by Game for furniture with pre-loaded textures) */
  addSpriteCollision(sc: SpriteCollision): void {
    // Remove any existing entry with the same label
    this._spriteCollisions = this._spriteCollisions.filter(s => s.label !== sc.label);
    this._spriteCollisions.push(sc);
  }

  /** Remove a sprite collision entry by label */
  removeSpriteCollision(label: string): void {
    this._spriteCollisions = this._spriteCollisions.filter(s => s.label !== label);
  }

  /** Set fallback rect obstacles (used when no sprite data available) */
  setObstacles(obs: RectObstacle[]) {
    this._obstacles = obs;
  }

  /** Add a single rect obstacle (for furniture full-bounding-box collision) */
  addObstacle(obs: RectObstacle): void {
    // Remove any existing entry with the same label
    if (obs.label) {
      this._obstacles = this._obstacles.filter(o => o.label !== obs.label);
    }
    this._obstacles.push(obs);
  }

  /** Remove a rect obstacle by label */
  removeObstacle(label: string): void {
    this._obstacles = this._obstacles.filter(o => o.label !== label);
  }

  /** Load obstacles from API scene objects — loads sprite pixel data for collidable objects */
  async loadFromSceneObjects(objects: SceneObjectData[]): Promise<void> {
    const obs: RectObstacle[] = [];
    const spriteCols: SpriteCollision[] = [];

    for (const o of objects) {
      if (!o.collidable) continue;

      // 家具碰撞由 Game._addFurnitureSprite 直接注册 sprite collision，这里跳过
      if (o.is_user_furniture) {
        continue;
      }

      if (o.image_url) {
        try {
          const base = `${window.location.protocol}//${window.location.host}`;
          const url = o.image_url.startsWith('/') ? `${base}${o.image_url}` : o.image_url;
          const resp = await fetch(url);
          const blob = await resp.blob();
          const bmp = await createImageBitmap(blob);

          // Fallback to rect if sprite dimensions are 0 (broken/empty image)
          if (bmp.width === 0 || bmp.height === 0) {
            bmp.close();
            console.warn(`⚠️ Sprite collision 0x0, fallback to rect: ${o.label}`);
            obs.push({ ...computeRectCollisionBounds(o), label: o.label, groundY: o.pos_y });
            continue;
          }

          // Compute aspect-fit collision bounds (matching PixiJS rendering)
          const bounds = computeCollisionBounds(o, bmp.width, bmp.height);

          const canvas = document.createElement('canvas');
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(bmp, 0, 0);
          const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height);

          // ⚠️ Save dimensions BEFORE closing the bitmap — after close(), width/height return 0
          const bmpW = bmp.width;
          const bmpH = bmp.height;
          bmp.close();

          // Y-flip pixel data (PixiJS renders textures with Y-flip,
          // so image row 0 = visual bottom, not visual top.
          // Must match the flip applied to furniture sprites in Game.ts)
          const flippedData = new Uint8ClampedArray(imgData.data.length);
          const rowBytes = bmpW * 4;
          for (let y = 0; y < bmpH; y++) {
            const srcOffset = y * rowBytes;
            const dstOffset = (bmpH - 1 - y) * rowBytes;
            flippedData.set(imgData.data.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
          }

          // Plan A: footprint-only collision mask
          // 1. Fill scanline holes first (close interior gaps in the footprint area)
          fillScanlineHoles(flippedData, bmpW, bmpH);
          // 2. Clear upper ~75% of pixels — only keep bottom 25% as collidable
          //    This prevents collision with "air" above furniture (chair backs, swing chains, etc.)
          clearUpperPixels(flippedData, bmpW, bmpH, 0.25);

          spriteCols.push({
            label: o.label,
            xMin: bounds.xMin,
            yMin: bounds.yMin,
            xMax: bounds.xMax,
            yMax: bounds.yMax,
            pixels: flippedData,
            pixelW: bmpW,
            pixelH: bmpH,
            groundY: bounds.groundY,
          });
          console.log(`✅ Sprite collision (footprint-only, aspect-fit): ${o.label} (${bmpW}x${bmpH}), bounds=`, bounds);
        } catch (e) {
          console.warn(`Failed to load sprite for collision: ${o.label}`, e);
          // Fallback to rect
          obs.push({ ...computeRectCollisionBounds(o), label: o.label, groundY: o.pos_y });
        }
      } else {
        // No image — use rect collision
        obs.push({ ...computeRectCollisionBounds(o), label: o.label, groundY: o.pos_y });
      }
    }

    this._obstacles = obs;
    this._spriteCollisions = spriteCols;
    this._loaded = true;
    console.log(`✅ Collision: ${obs.length} rect + ${spriteCols.length} sprite-based obstacles`);
  }

  /** Try loading a collision map PNG; falls back to rect mode */
  async init(mapUrl?: string): Promise<void> {
    if (mapUrl) {
      try {
        const tex = await Assets.load(mapUrl) as Texture;
        const source = tex.source;
        const w = source.width;
        const h = source.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        const resp = await fetch(mapUrl);
        const blob = await resp.blob();
        const bmp = await createImageBitmap(blob);
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const imgData = ctx.getImageData(0, 0, w, h);
        // Store as a single full-screen sprite collision
        this._spriteCollisions.push({
          label: 'collision-map',
          xMin: 0, yMin: 0, xMax: 1, yMax: 1,
          pixels: imgData.data,
          pixelW: w,
          pixelH: h,
        });
        this._mode = 'pixel';
        this._loaded = true;
        console.log(`✅ Collision map loaded: ${w}x${h} (pixel mode)`);
        return;
      } catch (e) {
        console.warn('Collision map load failed, using rect obstacles:', e);
      }
    }
    this._loaded = true;
    console.log(`✅ Collision system: rect+sprite mode (${this._obstacles.length} rect, ${this._spriteCollisions.length} sprite)`);
  }

  private _mode: 'rects' | 'pixel' = 'rects';

  get isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * Check if a screen-space position is walkable.
   * Checks both rect obstacles and sprite pixel data.
   * Plan B: Y-aware collision — if pet's Y position is at or below the
   * obstacle's groundY (pet is in front of / below the furniture),
   * the pet can walk through freely.
   */
  isWalkable(x: number, y: number, vpW: number, vpH: number, petY?: number): boolean {
    if (!this._loaded) return true;

    const nx = x / vpW;
    const ny = y / vpH;
    const petNY = petY != null ? petY / vpH : undefined;

    // Check rect obstacles
    for (const r of this._obstacles) {
      // Plan B: skip obstacle if pet is in front of it (pet Y >= groundY)
      if (petNY != null && r.groundY != null && petNY >= r.groundY) {
        continue;
      }
      if (nx >= r.xMin && nx <= r.xMax && ny >= r.yMin && ny <= r.yMax) {
        return false;
      }
    }

    // Check sprite-based collisions (per-pixel alpha)
    for (const sc of this._spriteCollisions) {
      // Plan B: skip sprite collision if pet is in front of it (pet Y >= groundY)
      if (petNY != null && sc.groundY != null && petNY >= sc.groundY) {
        continue;
      }
      if (nx < sc.xMin || nx > sc.xMax || ny < sc.yMin || ny > sc.yMax) continue;

      // Convert to sprite pixel coords
      const u = (nx - sc.xMin) / (sc.xMax - sc.xMin);
      const v = (ny - sc.yMin) / (sc.yMax - sc.yMin);
      const px = Math.floor(u * sc.pixelW);
      const py = Math.floor(v * sc.pixelH);

      if (px < 0 || px >= sc.pixelW || py < 0 || py >= sc.pixelH) continue;

      const idx = (py * sc.pixelW + px) * 4;
      const alpha = sc.pixels[idx + 3]; // RGBA alpha channel

      if (alpha > ALPHA_THRESHOLD) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a screen-space area (pet body) is walkable.
   * Samples 5 points: center + 4 cardinal directions at radius r.
   * All 5 must be walkable for the area to be considered walkable.
   * petY is the pet's actual Y position for Y-aware collision (Plan B).
   */
  isWalkableArea(x: number, y: number, r: number, vpW: number, vpH: number, petY?: number): boolean {
    return (
      this.isWalkable(x, y, vpW, vpH, petY) &&
      this.isWalkable(x - r, y, vpW, vpH, petY) &&
      this.isWalkable(x + r, y, vpW, vpH, petY) &&
      this.isWalkable(x, y - r, vpW, vpH, petY) &&
      this.isWalkable(x, y + r, vpW, vpH, petY)
    );
  }

  /** Find a nearby walkable position (slide along obstacles) */
  findWalkable(fromX: number, fromY: number, toX: number, toY: number, vpW: number, vpH: number, petY?: number): { x: number; y: number } {
    if (this.isWalkable(toX, toY, vpW, vpH, petY)) {
      return { x: toX, y: toY };
    }

    // Try sliding along X only
    if (this.isWalkable(toX, fromY, vpW, vpH, petY)) {
      return { x: toX, y: fromY };
    }

    // Try sliding along Y only
    if (this.isWalkable(fromX, toY, vpW, vpH, petY)) {
      return { x: fromX, y: toY };
    }

    // Both blocked — stay put
    return { x: fromX, y: fromY };
  }

  /** Find a nearby walkable position for a pet body (volume-aware sliding collision) */
  findWalkableArea(fromX: number, fromY: number, toX: number, toY: number, r: number, vpW: number, vpH: number, petY?: number): { x: number; y: number } {
    if (this.isWalkableArea(toX, toY, r, vpW, vpH, petY)) {
      return { x: toX, y: toY };
    }

    // Try sliding along X only
    if (this.isWalkableArea(toX, fromY, r, vpW, vpH, petY)) {
      return { x: toX, y: fromY };
    }

    // Try sliding along Y only
    if (this.isWalkableArea(fromX, toY, r, vpW, vpH, petY)) {
      return { x: fromX, y: toY };
    }

    // Both blocked — stay put
    return { x: fromX, y: fromY };
  }
}

/** Singleton collision map instance */
export const collisionMap = new CollisionMap();
