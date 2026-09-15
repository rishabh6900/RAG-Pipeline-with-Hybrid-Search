import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'rag-app-theme';
  private currentThemeSubject = new BehaviorSubject<AppTheme>('dark');
  public currentTheme$ = this.currentThemeSubject.asObservable();

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem(this.storageKey) as AppTheme | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.setTheme(savedTheme);
    } else {
      // Default to dark mode for enterprise studio look
      this.setTheme('dark');
    }
  }

  public get isDarkMode(): boolean {
    return this.currentThemeSubject.value === 'dark';
  }

  public toggleTheme(): void {
    const nextTheme: AppTheme = this.isDarkMode ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  public setTheme(theme: AppTheme): void {
    this.currentThemeSubject.next(theme);
    localStorage.setItem(this.storageKey, theme);

    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    if (theme === 'light') {
      htmlEl.classList.remove('dark');
      htmlEl.classList.add('light');
      bodyEl.classList.remove('dark');
      bodyEl.classList.add('light');
    } else {
      htmlEl.classList.remove('light');
      htmlEl.classList.add('dark');
      bodyEl.classList.remove('light');
      bodyEl.classList.add('dark');
    }
  }
}
