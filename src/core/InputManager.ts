export interface JoystickVisual {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
  radius: number;
}

export class InputManager {
  public moveX = 0;
  public moveY = 0;

  public readonly joystick: JoystickVisual = {
    active: false,
    originX: 0,
    originY: 0,
    knobX: 0,
    knobY: 0,
    radius: 54
  };

  private dashQueued = false;
  private overdriveQueued = false;
  private pauseQueued = false;

  private joyPointerId: number | null = null;
  private keys = new Set<string>();
  private canvas: HTMLCanvasElement;
  private onUserGesture: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    dashBtn: HTMLButtonElement,
    overdriveBtn: HTMLButtonElement,
    onUserGesture: () => void
  ) {
    this.canvas = canvas;
    this.onUserGesture = onUserGesture;

    canvas.addEventListener('pointerdown', this.handleCanvasPointerDown);
    window.addEventListener('pointermove', this.handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', this.handleWindowPointerUp);
    window.addEventListener('pointercancel', this.handleWindowPointerUp);

    dashBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onUserGesture();
      this.dashQueued = true;
    });

    overdriveBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onUserGesture();
      this.overdriveQueued = true;
    });

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.resetAll);
  }

  private handleCanvasPointerDown = (e: PointerEvent): void => {
    this.onUserGesture();
    if (this.joyPointerId !== null) return;

    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    if (localX <= rect.width * 0.6) {
      this.joyPointerId = e.pointerId;
      this.joystick.active = true;
      this.joystick.originX = localX;
      this.joystick.originY = e.clientY - rect.top;
      this.joystick.knobX = this.joystick.originX;
      this.joystick.knobY = this.joystick.originY;
      this.updateTouchVector();
    }
  };

  private handleWindowPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.joyPointerId) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const dx = localX - this.joystick.originX;
    const dy = localY - this.joystick.originY;
    const dist = Math.hypot(dx, dy);
    const maxR = this.joystick.radius;

    if (dist > maxR) {
      const scale = maxR / dist;
      this.joystick.knobX = this.joystick.originX + dx * scale;
      this.joystick.knobY = this.joystick.originY + dy * scale;
    } else {
      this.joystick.knobX = localX;
      this.joystick.knobY = localY;
    }
    this.updateTouchVector();
  };

  private handleWindowPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.joyPointerId) return;
    this.joyPointerId = null;
    this.joystick.active = false;
    this.moveX = 0;
    this.moveY = 0;
  };

  private updateTouchVector(): void {
    const dx = this.joystick.knobX - this.joystick.originX;
    const dy = this.joystick.knobY - this.joystick.originY;
    const maxR = this.joystick.radius;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      this.moveX = 0;
      this.moveY = 0;
      return;
    }
    const mag = Math.min(1, dist / maxR);
    this.moveX = (dx / dist) * mag;
    this.moveY = (dy / dist) * mag;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.onUserGesture();
    const code = e.code;
    this.keys.add(code);
    if (code === 'Space') {
      e.preventDefault();
      this.dashQueued = true;
    } else if (code === 'KeyE' || code === 'ShiftLeft' || code === 'ShiftRight') {
      this.overdriveQueued = true;
    } else if (code === 'Escape' || code === 'KeyP') {
      this.pauseQueued = true;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  public syncKeyboardMovement(): void {
    if (this.joystick.active) return;
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;

    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      this.moveX = kx / len;
      this.moveY = ky / len;
    } else {
      this.moveX = 0;
      this.moveY = 0;
    }
  }

  public consumeDash(): boolean {
    const v = this.dashQueued;
    this.dashQueued = false;
    return v;
  }

  public consumeOverdrive(): boolean {
    const v = this.overdriveQueued;
    this.overdriveQueued = false;
    return v;
  }

  public consumePause(): boolean {
    const v = this.pauseQueued;
    this.pauseQueued = false;
    return v;
  }

  public resetAll = (): void => {
    this.joyPointerId = null;
    this.joystick.active = false;
    this.keys.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.dashQueued = false;
    this.overdriveQueued = false;
    this.pauseQueued = false;
  };
}
