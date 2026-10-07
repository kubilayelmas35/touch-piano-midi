/** Frame gap (ms) while nothing on screen moves on its own (paused, no touch, no sound). */
export const IDLE_GAP = 1000 / 30;
/** Frame gap (ms) while idle behind a dialog that covers the game. */
export const COVERED_GAP = 100;

/**
 * Decides which animation frames get drawn. Drawing is what heats a phone: on 120 Hz screens every other frame
 * is enough (still ~60 fps), and an idle game only needs to refresh a few times a second. Input, audio and
 * string physics keep running every frame; only the drawing is skipped.
 */
export class FramePacer {
  /** Smoothed time between animation frames (ms). */
  private interval = 1000 / 60;
  private last = 0;
  private lastDraw = -Infinity;
  private odd = false;

  /** Whether to draw this frame; `gap` is the minimum time between drawn frames (0 = as smooth as ~60 fps allows). */
  due(now: number, gap = 0): boolean {
    if (this.last) this.interval += (Math.min(50, now - this.last) - this.interval) * 0.05;
    this.last = now;
    if (gap > 0) {
      // A little slack so a frame arriving just early still counts at the steady rate.
      if (now - this.lastDraw < gap - 4) return false;
    } else if (this.interval < 10) {
      // 100 Hz and above: every other frame.
      this.odd = !this.odd;
      if (this.odd && now - this.lastDraw < 20) return false;
    }
    this.lastDraw = now;
    return true;
  }
}
