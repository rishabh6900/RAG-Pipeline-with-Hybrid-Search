import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemStatusResponse } from '../../models/rag.models';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="header-container glass-panel">
      <!-- Left Logo & Title -->
      <div class="logo-group">
        <div class="logo-icon-wrapper">
          <div class="logo-icon-glow"></div>
          <div class="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
        </div>
        <div class="logo-text">
          <div class="title-row">
            <h1 class="logo-title">Enterprise Hybrid <span class="text-gradient">RAG</span></h1>
            <span class="version-badge">v1.0 Pro</span>
          </div>
          <p class="logo-subtitle">
            <span class="highlight-dense">Dense Qdrant</span>
            <span class="sub-sep">•</span>
            <span class="highlight-sparse">Sparse BM25</span>
            <span class="sub-sep">•</span>
            <span class="highlight-rerank">Cross-Encoder</span>
          </p>
        </div>
      </div>

      <!-- Right Telemetry & Theme Switcher -->
      <div class="status-cluster">
        <!-- Live Connection State -->
        <div class="status-capsule" [ngClass]="{'online': status?.status === 'healthy'}">
          <div class="radar-dot-wrapper">
            <span class="radar-ring"></span>
            <span class="radar-core"></span>
          </div>
          <span class="status-label">Pipeline:</span>
          <span class="status-state">{{ status?.status === 'healthy' ? 'Active' : 'Standby' }}</span>
        </div>

        <!-- Qdrant Dense Vector Count -->
        <div class="telemetry-pill dense-pill" title="Indexed high-dimensional embeddings in Qdrant">
          <div class="pill-icon-wrap cyan">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
            </svg>
          </div>
          <div class="pill-info">
            <span class="pill-title">Qdrant DB</span>
            <span class="pill-val">{{ status?.total_chunks_dense || 0 }} Vectors</span>
          </div>
        </div>

        <!-- BM25 Sparse Index Count -->
        <div class="telemetry-pill sparse-pill" title="Technical tokenized inverted index">
          <div class="pill-icon-wrap amber">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
            </svg>
          </div>
          <div class="pill-info">
            <span class="pill-title">BM25 Okapi</span>
            <span class="pill-val">{{ status?.total_chunks_sparse || 0 }} Chunks</span>
          </div>
        </div>

        <!-- Model Engine -->
        <div class="telemetry-pill model-pill" title="Inference model for generation and citation judging">
          <div class="pill-icon-wrap violet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2a4 4 0 0 0-4 4c0 .8.2 1.5.7 2.1L3.3 13.5a2 2 0 0 0 0 2.8l4.4 4.4a2 2 0 0 0 2.8 0l5.4-5.4c.6.5 1.3.7 2.1.7a4 4 0 0 0 4-4 4 4 0 0 0-4-4c-.8 0-1.5.2-2.1.7L10.5 3.3A4 4 0 0 0 12 2z"></path>
            </svg>
          </div>
          <div class="pill-info">
            <span class="pill-title">LLM Judge</span>
            <span class="pill-val font-mono">{{ formatModelName(status?.llm_model) }}</span>
          </div>
        </div>

        <!-- Dark / Light Mode Toggle Button -->
        <button
          (click)="themeService.toggleTheme()"
          class="theme-toggle-btn"
          [title]="(themeService.currentTheme$ | async) === 'dark' ? 'Switch to Light Studio Mode' : 'Switch to Dark Cyber Mode'"
        >
          <!-- Sun Icon (shown in Dark mode to switch to light) -->
          <svg *ngIf="(themeService.currentTheme$ | async) === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon sun-icon">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>

          <!-- Moon Icon (shown in Light mode to switch to dark) -->
          <svg *ngIf="(themeService.currentTheme$ | async) === 'light'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon moon-icon">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <span class="theme-label">{{ (themeService.currentTheme$ | async) === 'dark' ? 'Light' : 'Dark' }}</span>
        </button>
      </div>
    </header>
  `,
  styles: [`
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.1rem 1.75rem;
      margin-bottom: 1.75rem;
      border-radius: var(--radius-lg);
      background: var(--bg-glass-1);
      border: 1px solid var(--border-glass-subtle);
      box-shadow: var(--shadow-md);
    }

    .logo-group {
      display: flex;
      align-items: center;
      gap: 1.15rem;
    }

    .logo-icon-wrapper {
      position: relative;
      width: 48px;
      height: 48px;
    }

    .logo-icon-glow {
      position: absolute;
      inset: -3px;
      background: var(--grad-primary);
      border-radius: 16px;
      filter: blur(10px);
      opacity: 0.6;
      animation: pulseGlow 3s ease-in-out infinite alternate;
    }

    .logo-icon {
      position: relative;
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: var(--grad-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.45);
      z-index: 1;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .logo-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--text-pure);
      letter-spacing: -0.03em;
    }

    .version-badge {
      font-size: 0.68rem;
      padding: 0.18rem 0.6rem;
      background: rgba(99, 102, 241, 0.14);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: var(--neon-indigo);
      border-radius: var(--radius-full);
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    html.dark .version-badge { color: #a5b4fc; }

    .logo-subtitle {
      font-size: 0.78rem;
      color: var(--text-2);
      margin-top: 0.15rem;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .sub-sep {
      color: var(--text-3);
      font-size: 0.6rem;
      opacity: 0.7;
    }

    .highlight-dense { color: #0284c7; font-weight: 600; }
    html.dark .highlight-dense { color: #38bdf8; }
    
    .highlight-sparse { color: #d97706; font-weight: 600; }
    html.dark .highlight-sparse { color: #fbbf24; }
    
    .highlight-rerank { color: #059669; font-weight: 600; }
    html.dark .highlight-rerank { color: #34d399; }

    .status-cluster {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .status-capsule {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.85rem;
      background: rgba(244, 63, 94, 0.08);
      border: 1px solid rgba(244, 63, 94, 0.25);
      border-radius: var(--radius-full);
      font-size: 0.76rem;
    }

    .status-capsule.online {
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.35);
    }

    .radar-dot-wrapper {
      position: relative;
      width: 10px;
      height: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .radar-core {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--neon-rose);
      box-shadow: 0 0 10px var(--neon-rose);
    }

    .status-capsule.online .radar-core {
      background: var(--neon-emerald);
      box-shadow: 0 0 10px var(--neon-emerald);
    }

    .radar-ring {
      position: absolute;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(244, 63, 94, 0.6);
      animation: pulseRadar 2s infinite ease-out;
    }

    .status-capsule.online .radar-ring {
      background: rgba(16, 185, 129, 0.6);
    }

    .status-label {
      color: var(--text-3);
      font-weight: 500;
    }

    .status-state {
      color: var(--text-1);
      font-weight: 700;
    }

    .telemetry-pill {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.4rem 0.8rem;
      border-radius: var(--radius-sm);
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .telemetry-pill:hover {
      background: var(--bg-glass-card-hover);
      border-color: var(--border-glass-medium);
      transform: translateY(-1px);
    }

    .pill-icon-wrap {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pill-icon-wrap.cyan { background: rgba(6, 182, 212, 0.15); color: #0284c7; }
    html.dark .pill-icon-wrap.cyan { color: #38bdf8; }

    .pill-icon-wrap.amber { background: rgba(245, 158, 11, 0.15); color: #d97706; }
    html.dark .pill-icon-wrap.amber { color: #fbbf24; }

    .pill-icon-wrap.violet { background: rgba(139, 92, 246, 0.15); color: #7c3aed; }
    html.dark .pill-icon-wrap.violet { color: #c084fc; }

    .pill-info {
      display: flex;
      flex-direction: column;
    }

    .pill-title {
      font-size: 0.63rem;
      color: var(--text-3);
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .pill-val {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-1);
    }

    .dense-pill .pill-val { color: #0284c7; }
    html.dark .dense-pill .pill-val { color: #38bdf8; }

    .sparse-pill .pill-val { color: #d97706; }
    html.dark .sparse-pill .pill-val { color: #fbbf24; }

    .model-pill .pill-val { color: #4f46e5; }
    html.dark .model-pill .pill-val { color: #a5b4fc; }

    .font-mono { font-family: var(--font-mono); }

    /* Theme Switcher Button */
    .theme-toggle-btn {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      color: var(--text-1);
      padding: 0.45rem 0.85rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .theme-toggle-btn:hover {
      background: var(--bg-glass-card-hover);
      border-color: var(--border-glass-medium);
      color: var(--neon-indigo);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    }

    .sun-icon { color: #f59e0b; }
    .moon-icon { color: #6366f1; }

    @media (max-width: 1024px) {
      .header-container {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
      .status-cluster {
        width: 100%;
        justify-content: flex-start;
      }
    }
  `]
})
export class HeaderComponent {
  @Input() status: SystemStatusResponse | null = null;

  constructor(public themeService: ThemeService) {}

  formatModelName(model: string | undefined): string {
    if (!model) return 'llama-3.1';
    return model.replace('llama-', 'L-').replace('-versatile', '').replace('-instant', '');
  }
}
