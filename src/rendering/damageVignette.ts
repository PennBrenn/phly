export class DamageVignette {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'damage-vignette';
    const style = this.el.style;
    style.position = 'fixed';
    style.top = '0';
    style.left = '0';
    style.width = '100%';
    style.height = '100%';
    style.pointerEvents = 'none';
    style.zIndex = '200';
    style.opacity = '0';
    style.background = 'radial-gradient(ellipse at center, transparent 40%, rgba(180,0,0,0.6) 100%)';
    document.getElementById('app')!.appendChild(this.el);
  }

  /** flash = 0..1, where 1 is full red vignette */
  update(flash: number): void {
    this.el.style.opacity = String(Math.min(flash * 3, 1));
  }
}
