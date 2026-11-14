export class ObjectPool<T> {
  public readonly items: T[];
  public activeCount = 0;

  constructor(capacity: number, factory: () => T) {
    this.items = new Array<T>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = factory();
    }
  }

  public acquire(): T | null {
    if (this.activeCount >= this.items.length) {
      return null;
    }
    const item = this.items[this.activeCount];
    this.activeCount++;
    return item;
  }

  public releaseAt(index: number): void {
    const last = this.activeCount - 1;
    if (index < last) {
      const tmp = this.items[index];
      this.items[index] = this.items[last];
      this.items[last] = tmp;
    }
    this.activeCount--;
  }

  public clear(): void {
    this.activeCount = 0;
  }
}
