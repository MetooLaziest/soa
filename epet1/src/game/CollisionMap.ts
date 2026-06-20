import { Assets, Texture, Sprite, CanvasSource } from 'pixi.js';

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
}

/**
 * Collision system for the yard scene.
 *
 * Two modes:
 * 1. **Collision map** (pixel-precise): loads a black-and-white PNG where
 *    white = walkable, black = blocked. Preferred when a map image is available.
 * 2. **Rect obstacles** (fallback): list of axis-aligned rectangles in viewport
 *    fraction coordinates. Used when no collision map image exists yet.
 *
 * Usage:
 *   const cm = new CollisionMap();
 *   await cm.init();                       // loads map or falls back to rects
 *   cm.isWalkable(screenX, screenY, vpW, vpH);  // true/false
 */

/** A rectangle obstacle in viewport-fraction coords (0-1) */
export interface RectObstacle {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  label?: string;
}

// Default obstacles for the yard scene (viewport fractions)
// These are initial estimates — Admin editor can override later
const DEFAULT_OBSTACLES: RectObstacle[] = [
  // Left fence
  { xMin: 0.00, yMin: 0.40, xMax: 0.06, yMax: 0.80, label: 'left-fence' },
  // Right fence
  { xMin: 0.88, yMin: 0.40, xMax: 1.00, yMax: 0.80, label: 'right-fence' },
  // Top edge (grass border / planter)
  { xMin: 0.05, yMin: 0.42, xMax: 0.88, yMax: 0.47, label: 'top-border' },
  // Bottom edge (front fence / path)
  { xMin: 0.05, yMin: 0.77, xMax: 0.88, yMax: 0.80, label: 'bottom-border' },
  // Center tree trunk (small circle approximated as rect)
  { xMin: 0.42, yMin: 0.48, xMax: 0.50, yMax: 0.56, label: 'tree-trunk' },
  // Left flower bed
  { xMin: 0.08, yMin: 0.64, xMax: 0.18, yMax: 0.72, label: 'flower-bed-l' },
  // Right rock
  { xMin: 0.74, yMin: 0.68, xMax: 0.84, yMax: 0.75, label: 'rock-r' },
];

export class CollisionMap {
  private _mode: 'rects' | 'pixel' = 'rects';
  private _obstacles: RectObstacle[] = DEFAULT_OBSTACLES;
  private _pixelData: ImageData | null = null;
  private _mapWidth = 0;
  private _mapHeight = 0;
  private _loaded = false;

  /** Custom obstacles override (e.g. from API config) */
  setObstacles(obs: RectObstacle[]) {
    this._obstacles = obs;
  }

  /** Load obstacles from API scene objects
   *  Anchor is (0.5, 0.85) — pos_y = foot position, not center.
   *  Visual top = pos_y - height*0.85, visual bottom = pos_y + height*0.15
   *  Collision rect matches the visual sprite bounds.
   */
  loadFromSceneObjects(objects: SceneObjectData[]) {
    const obs: RectObstacle[] = objects
      .filter(o => o.collidable)
      .map(o => ({
        xMin: o.pos_x - o.width / 2,
        yMin: o.pos_y - o.height * 0.85,
        xMax: o.pos_x + o.width / 2,
        yMax: o.pos_y + o.height * 0.15,
        label: o.label,
      }));
    this._obstacles = obs;
    console.log(`✅ Collision: loaded ${obs.length} obstacles from API`);
  }

  /** Try loading a collision map PNG; falls back to rect mode */
  async init(mapUrl?: string): Promise<void> {
    if (mapUrl) {
      try {
        const tex = await Assets.load(mapUrl) as Texture;
        // Extract pixel data from the texture
        const source = tex.source;
        const w = source.width;
        const h = source.height;

        // Use a temporary canvas to read pixels
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;

        // Draw the texture to canvas
        const sprite = new Sprite(tex);
        // @ts-ignore — render sprite to canvas
        // We need to use PIXI's extract or a workaround
        // Simpler: use fetch + createImageBitmap
        const resp = await fetch(mapUrl);
        const blob = await resp.blob();
        const bmp = await createImageBitmap(blob);
        ctx.drawImage(bmp, 0, 0);
        bmp.close();

        this._pixelData = ctx.getImageData(0, 0, w, h);
        this._mapWidth = w;
        this._mapHeight = h;
        this._mode = 'pixel';
        this._loaded = true;
        console.log(`✅ Collision map loaded: ${w}x${h} (pixel mode)`);
        return;
      } catch (e) {
        console.warn('Collision map load failed, using rect obstacles:', e);
      }
    }
    this._mode = 'rects';
    this._loaded = true;
    console.log(`✅ Collision system: rect mode (${this._obstacles.length} obstacles)`);
  }

  get isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * Check if a screen-space position is walkable.
   * @param x  screen X (px)
   * @param y  screen Y (px)
   * @param vpW viewport width
   * @param vpH viewport height
   */
  isWalkable(x: number, y: number, vpW: number, vpH: number): boolean {
    if (!this._loaded) return true; // allow all before loaded

    if (this._mode === 'pixel' && this._pixelData) {
      return this._isWalkablePixel(x, y, vpW, vpH);
    }
    return this._isWalkableRect(x, y, vpW, vpH);
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

  private _isWalkableRect(x: number, y: number, vpW: number, vpH: number): boolean {
    const nx = x / vpW; // normalized 0-1
    const ny = y / vpH;

    for (const r of this._obstacles) {
      if (nx >= r.xMin && nx <= r.xMax && ny >= r.yMin && ny <= r.yMax) {
        return false;
      }
    }
    return true;
  }

  private _isWalkablePixel(x: number, y: number, vpW: number, vpH: number): boolean {
    if (!this._pixelData) return true;
    // Map viewport coords to collision map coords
    const mx = Math.floor((x / vpW) * this._mapWidth);
    const my = Math.floor((y / vpH) * this._mapHeight);
    if (mx < 0 || mx >= this._mapWidth || my < 0 || my >= this._mapHeight) return false;

    const idx = (my * this._mapWidth + mx) * 4;
    const r = this._pixelData.data[idx];
    // White (walkable) = high R value; Black (blocked) = low R
    return r > 128;
  }
}

/** Singleton collision map instance */
export const collisionMap = new CollisionMap();
