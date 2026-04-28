import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'inspector-management-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSubject = new BehaviorSubject<ThemeMode>(this.getInitialMode());
  readonly mode$ = this.modeSubject.asObservable();

  constructor() {
    this.applyTheme(this.modeSubject.value);
  }

  get mode(): ThemeMode {
    return this.modeSubject.value;
  }

  toggle(): void {
    const nextMode: ThemeMode = this.mode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, nextMode);
    this.modeSubject.next(nextMode);
    this.applyTheme(nextMode);
  }

  private getInitialMode(): ThemeMode {
    const savedMode = localStorage.getItem(STORAGE_KEY);
    return savedMode === 'light' || savedMode === 'dark' ? savedMode : 'dark';
  }

  private applyTheme(mode: ThemeMode): void {
    document.documentElement.dataset['theme'] = mode;
  }
}
