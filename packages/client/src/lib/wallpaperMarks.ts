import {
  type drawPattern,
  type WallpaperGradient,
  wallpaperGrowth,
} from '@owl/shared';

export const WALLPAPER_REPEAT_SCALE = 0.5;

type Tile = ReturnType<typeof drawPattern>;

/** Repeat the tile at a stable pitch while its individual marks follow the light. */
export function paintWallpaperMarks(
  canvas: HTMLCanvasElement,
  tile: Tile,
  gradient: WallpaperGradient,
  width: number,
  height: number
): void {
  if (width < 1 || height < 1) return;
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * density);
  const pixelHeight = Math.round(height * density);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const context = canvas.getContext('2d');
  if (!context) return;

  context.resetTransform();
  context.clearRect(0, 0, pixelWidth, pixelHeight);
  context.scale(
    (pixelWidth / width) * WALLPAPER_REPEAT_SCALE,
    (pixelHeight / height) * WALLPAPER_REPEAT_SCALE
  );
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const extentX = width / WALLPAPER_REPEAT_SCALE;
  const extentY = height / WALLPAPER_REPEAT_SCALE;
  const growthAt = wallpaperGrowth(gradient);
  const marks = tile.marks.map((mark) => ({
    ...mark,
    path: new Path2D(mark.d),
  }));
  const points = marks.filter((mark) => mark.center);
  const lines = marks.filter((mark) => !mark.center);

  for (let y = -tile.height; y < extentY + tile.height; y += tile.height) {
    for (let x = -tile.width; x < extentX + tile.width; x += tile.width) {
      context.save();
      context.translate(x, y);
      if (lines.length && x >= 0 && y >= 0 && x < extentX && y < extentY) {
        // Crop continuous lines to the tile seam. Their width follows the
        // gradient while the geometry stays joined across adjacent tiles.
        const strength = growthAt(
          (x + tile.width / 2) / extentX,
          (y + tile.height / 2) / extentY
        );
        context.save();
        context.beginPath();
        context.rect(0, 0, tile.width, tile.height);
        context.clip();
        for (const mark of lines) {
          context.strokeStyle = tile.palette[mark.tone];
          context.lineWidth = Math.max(
            1.65,
            (mark.strokeWidth ?? tile.weight + 0.6) * strength
          );
          context.stroke(mark.path);
        }
        context.restore();
      }

      for (const mark of points) {
        const [cx, cy] = mark.center!;
        const strength = growthAt((x + cx) / extentX, (y + cy) / extentY);
        context.save();
        context.translate(cx, cy);
        context.scale(strength, strength);
        if (mark.radius) {
          context.rotate(((mark.rotation ?? 0) * Math.PI) / 180);
          context.scale(mark.radius, mark.radius);
        } else {
          context.translate(-cx, -cy);
        }
        if (mark.fill) {
          context.fillStyle = tile.palette[mark.tone];
          context.fill(mark.path, 'evenodd');
        } else {
          context.strokeStyle = tile.palette[mark.tone];
          context.lineWidth = Math.max(1.9 / strength, tile.weight);
          context.stroke(mark.path);
        }
        context.restore();
      }
      context.restore();
    }
  }
}
