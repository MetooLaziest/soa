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
}

/** Per-sprite pixel collision data */
interface SpriteCollision {
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
function computeCollisionBounds(
  o: { pos_x: number; pos_y: number; width: number; height: number },
  imgW: number, imgH: number,
): { xMin: number; yMin: number; xMax: number; yMax: number } {
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
  };
}

/**
 * Compute collision bounds for objects without images (rect-only mode).
 * Uses the full width/height as-is (no aspect-fit), matching the admin editor preview.
 */
function computeRectCollisionBounds(
  o: { pos_x: number; pos_y: number; width: number; height: number },
): { xMin: number; yMin: number; xMax: number; yMax: number } {
  return {
    xMin: o.pos_x - o.width / 2,
    xMax: o.pos_x + o.width / 2,
    yMin: o.pos_y - o.height * 0.85,
    yMax: o.pos_y + o.height * 0.15,
  };
}

const ALPHA_THRESHOLD = 30; // alpha > 30 = solid

export class CollisionMap {
  private _obstacles: RectObstacle[] = [];
  private _spriteCollisions: SpriteCollision[] = [];
  private _loaded = false;

  /** Set fallback rect obstacles (used when no sprite data available) */
  setObstacles(obs: RectObstacle[]) {
    this._obstacles = obs;
  }

  /** Load obstacles from API scene objects — loads sprite pixel data for collidable objects */
  async loadFromSceneObjects(objects: SceneObjectData[]): Promise<void> {
    const obs: RectObstacle[] = [];
    const spriteCols: SpriteCollision[] = [];

    for (const o of objects) {
      if (!o.collidable) continue;

      // 家具碰撞：基于 aspect-fit 碰撞框，向内缩小以排除边缘视觉空白区域
      if (o.is_user_furniture) {
        if (o.img_pixel_w && o.img_pixel_h) {
          const baseBounds = computeCollisionBounds(o, o.img_pixel_w, o.img_pixel_h);
          // Shrink collision rect by 15% on each side to exclude edge transparency/visual whitespace
          const shrinkX = (baseBounds.xMax - baseBounds.xMin) * 0.15;
          const shrinkY = (baseBounds.yMax - baseBounds.yMin) * 0.15;
          obs.push({
            xMin: baseBounds.xMin + shrinkX,
            yMin: baseBounds.yMin + shrinkY,
            xMax: baseBounds.xMax - shrinkX,
            yMax: baseBounds.yMax - shrinkY,
            label: o.label,
          });
          console.log(`✅ Furniture collision (shrunk): ${o.label}`, {
            xMin: (baseBounds.xMin + shrinkX).toFixed(3),
            yMin: (baseBounds.yMin + shrinkY).toFixed(3),
            xMax: (baseBounds.xMax - shrinkX).toFixed(3),
            yMax: (baseBounds.yMax - shrinkY).toFixed(3),
          });
        } else {
          obs.push({ ...computeRectCollisionBounds(o), label: o.label });
        }
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
            obs.push({ ...computeRectCollisionBounds(o), label: o.label });
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
          bmp.close();

          spriteCols.push({
            label: o.label,
            xMin: bounds.xMin,
            yMin: bounds.yMin,
            xMax: bounds.xMax,
            yMax: bounds.yMax,
            pixels: imgData.data,
            pixelW: bmp.width,
            pixelH: bmp.height,
          });
          console.log(`✅ Sprite collision (aspect-fit): ${o.label} (${bmp.width}x${bmp.height}), bounds=`, bounds);
        } catch (e) {
          console.warn(`Failed to load sprite for collision: ${o.label}`, e);
          // Fallback to rect
          obs.push({ ...computeRectCollisionBounds(o), label: o.label });
        }
      } else {
        // No image — use rect collision
        obs.push({ ...computeRectCollisionBounds(o), label: o.label });
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
   */
  isWalkable(x: number, y: number, vpW: number, vpH: number): boolean {
    if (!this._loaded) return true;

    const nx = x / vpW;
    const ny = y / vpH;

    // Check rect obstacles
    for (const r of this._obstacles) {
      if (nx >= r.xMin && nx <= r.xMax && ny >= r.yMin && ny <= r.yMax) {
        return false;
      }
    }

    // Check sprite-based collisions (per-pixel alpha)
    for (const sc of this._spriteCollisions) {
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

  /** Find a nearby walkable position (slide along obstacles) */
  findWalkable(fromX: number, fromY: number, toX: number, toY: number, vpW: number, vpH: number): { x: number; y: number } {
    if (this.isWalkable(toX, toY, vpW, vpH)) {
      return { x: toX, y: toY };
    }

    // Try sliding along X only
    if (this.isWalkable(toX, fromY, vpW, vpH)) {
      return { x: toX, y: fromY };
    }

    // Try sliding along Y only
    if (this.isWalkable(fromX, toY, vpW, vpH)) {
      return { x: fromX, y: toY };
    }

    // Both blocked — stay put
    return { x: fromX, y: fromY };
  }
}

/** Singleton collision map instance */
export const collisionMap = new CollisionMap();
