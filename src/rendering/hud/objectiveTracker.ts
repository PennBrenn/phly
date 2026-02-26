import type { MissionObjective } from '@/utils/dataLoader';

export interface ObjectiveProgress {
  id: string;
  label: string;
  current: number;
  target: number;
  completed: boolean;
}

export class ObjectiveTracker {
  private container: HTMLDivElement;
  private objectives: ObjectiveProgress[] = [];
  private timerEl: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'objective-tracker';
    this.container.style.cssText = `
      position:fixed;top:80px;right:20px;
      font-family:'Courier New',monospace;color:#fff;font-size:12px;
      pointer-events:none;z-index:100;text-align:right;
      text-shadow:0 1px 3px rgba(0,0,0,0.7);
    `;
    this.timerEl = document.createElement('div');
    this.timerEl.style.cssText = 'font-size:14px;margin-bottom:10px;opacity:0.7;letter-spacing:2px;';
    this.container.appendChild(this.timerEl);
    document.body.appendChild(this.container);
  }

  setObjectives(missionObjectives: MissionObjective[]): void {
    this.objectives = missionObjectives.map(o => ({
      id: o.id,
      label: o.label,
      current: 0,
      target: o.count ?? 1,
      completed: false,
    }));
    this.render();
  }

  updateProgress(id: string, current: number): void {
    const obj = this.objectives.find(o => o.id === id);
    if (obj) {
      obj.current = Math.min(current, obj.target);
      obj.completed = obj.current >= obj.target;
      this.render();
    }
  }

  updateTimer(secondsLeft: number): void {
    if (secondsLeft <= 0) {
      this.timerEl.textContent = 'TIME UP';
      this.timerEl.style.color = '#ff4444';
    } else {
      const m = Math.floor(secondsLeft / 60);
      const s = Math.floor(secondsLeft % 60);
      this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      this.timerEl.style.color = secondsLeft < 30 ? '#ff4444' : '#fff';
    }
  }

  allComplete(): boolean {
    return this.objectives.length > 0 && this.objectives.every(o => o.completed);
  }

  show(): void { this.container.style.display = 'block'; }
  hide(): void { this.container.style.display = 'none'; }

  private render(): void {
    // Keep timer, rebuild objective list
    while (this.container.children.length > 1) {
      this.container.removeChild(this.container.lastChild!);
    }
    for (const obj of this.objectives) {
      const el = document.createElement('div');
      el.style.cssText = `margin-bottom:6px;opacity:${obj.completed ? '0.4' : '0.9'};`;
      const check = obj.completed ? '✓' : '○';
      const color = obj.completed ? '#44ff88' : '#fff';
      el.innerHTML = `<span style="color:${color}">${check}</span> ${obj.label}${obj.target > 1 ? ` (${obj.current}/${obj.target})` : ''}`;
      if (obj.completed) el.style.textDecoration = 'line-through';
      this.container.appendChild(el);
    }
  }
}
