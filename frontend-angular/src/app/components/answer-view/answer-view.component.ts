import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryResponse } from '../../models/rag.models';
import { formatMarkdownHtml } from '../../utils/markdown-formatter';

@Component({
  selector: 'app-answer-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="answer-card glass-panel" *ngIf="response">
      <!-- Card Header -->
      <div class="answer-header">
        <div class="header-title-box">
          <div class="icon-sparkle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
          </div>
          <div>
            <div class="title-with-badge">
              <h2 class="section-title">Verified Synthesis</h2>
              <span class="badge" [ngClass]="response.confidence_scores.composite >= 0.70 ? 'badge-emerald' : 'badge-amber'">
                <span class="badge-dot" [class.green]="response.confidence_scores.composite >= 0.70"></span>
                {{ response.confidence_scores.composite >= 0.70 ? 'Grounding Verified' : 'Review Suggested' }}
              </span>
            </div>
            <p class="processing-tag">
              Generated in <span class="highlight-stat">{{ response.processing_time_ms }} ms</span> • 
              <span>{{ response.retrieved_chunks_count }} Passages Evaluated</span>
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button (click)="copyAnswer()" class="action-btn copy-btn" [class.copied]="isCopied" title="Copy answer text">
            <svg *ngIf="!isCopied" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <svg *ngIf="isCopied" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{{ isCopied ? 'Copied!' : 'Copy' }}</span>
          </button>

          <button class="action-btn inspect-btn" (click)="openDrawer.emit()" title="Inspect claim verifications and raw context passages">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <span>Inspect Citations ({{ response.citations.length }})</span>
          </button>
        </div>
      </div>

      <!-- Fallback Alert Box (if confidence is below threshold) -->
      <div *ngIf="response.status === 'low_confidence_fallback' && response.fallback_report" class="fallback-alert glass-card">
        <div class="fallback-header">
          <div class="fallback-tag-wrap">
            <span class="warning-icon">⚠️</span>
            <span class="fallback-title">Graceful Degradation Triggered</span>
          </div>
          <span class="badge badge-amber">Confidence Gated (&lt; 60%)</span>
        </div>
        <p class="fallback-msg">{{ response.fallback_report.message }}</p>
        <div class="partially-relevant" *ngIf="response.fallback_report.partially_relevant_documents?.length">
          <span class="fallback-label">Partially Relevant Sources Located in Index:</span>
          <ul class="fallback-list">
            <li *ngFor="let doc of response.fallback_report.partially_relevant_documents">{{ doc }}</li>
          </ul>
        </div>
      </div>

      <!-- Main Answer Text with Illuminated Citations -->
      <div class="answer-body">
        <div class="formatted-text" (click)="onAnswerBodyClick($event)" [innerHTML]="formatAnswerHtml(response.answer)"></div>
      </div>

      <!-- Citations Pill Bar -->
      <div class="citations-pill-bar" *ngIf="response.citations.length > 0">
        <div class="sources-label-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          <span class="sources-label">Attributed Sources:</span>
        </div>
        <div class="citation-chips-wrap">
          <button
            *ngFor="let cit of response.citations"
            (click)="openDrawer.emit()"
            class="citation-pill"
            [ngClass]="cit.verified ? 'verified-pill' : 'unverified-pill'"
            [title]="cit.source_file + ' (' + cit.section + ')'"
          >
            <span class="pill-id">[{{ cit.citation_id }}]</span>
            <span class="pill-src">{{ cleanFileName(cit.source_file) }}</span>
            <span class="pill-status-dot" [class.verified]="cit.verified"></span>
            <span class="pill-verdict">{{ cit.verdict }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .answer-card {
      padding: 2rem;
      border-radius: var(--radius-lg);
      background: var(--bg-glass-1);
      border: 1px solid var(--border-glass-subtle);
      box-shadow: var(--shadow-md);
    }

    .answer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-glass-subtle);
      gap: 1rem;
    }

    .header-title-box {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .icon-sparkle {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: var(--neon-indigo);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
    }

    .title-with-badge {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--neon-amber);
    }
    .badge-dot.green {
      background: var(--neon-emerald);
      box-shadow: 0 0 6px var(--neon-emerald);
    }

    .section-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--text-pure);
      letter-spacing: -0.025em;
    }

    .processing-tag {
      font-size: 0.8rem;
      color: var(--text-2);
      margin-top: 0.2rem;
    }

    .highlight-stat {
      color: #0284c7;
      font-weight: 700;
      font-family: var(--font-mono);
    }
    html.dark .highlight-stat { color: #38bdf8; }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .action-btn {
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      color: var(--text-1);
      padding: 0.55rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .action-btn:hover {
      background: var(--bg-glass-card-hover);
      border-color: var(--border-glass-medium);
      transform: translateY(-1px);
    }

    .inspect-btn {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.4);
      color: var(--neon-indigo);
    }
    html.dark .inspect-btn { color: #a5b4fc; }

    .inspect-btn:hover {
      background: rgba(99, 102, 241, 0.25);
      border-color: rgba(99, 102, 241, 0.6);
      box-shadow: 0 4px 18px rgba(99, 102, 241, 0.25);
    }

    .copy-btn.copied {
      background: rgba(16, 185, 129, 0.2);
      border-color: rgba(16, 185, 129, 0.5);
      color: #059669;
    }
    html.dark .copy-btn.copied { color: #34d399; }

    /* Fallback Warning Box */
    .fallback-alert {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      border-radius: var(--radius-md);
    }

    .fallback-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.65rem;
    }

    .fallback-tag-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .warning-icon { font-size: 1.1rem; }

    .fallback-title {
      font-size: 0.92rem;
      font-weight: 700;
      color: #d97706;
    }
    html.dark .fallback-title { color: #fbbf24; }

    .fallback-msg {
      font-size: 0.88rem;
      color: var(--text-1);
      line-height: 1.6;
      margin-bottom: 0.75rem;
    }

    .fallback-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: #d97706;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.4rem;
      display: block;
    }
    html.dark .fallback-label { color: #f59e0b; }

    .fallback-list {
      padding-left: 1.4rem;
      font-size: 0.84rem;
      color: var(--text-2);
    }

    /* Main Answer Body & Markdown Styles */
    .answer-body {
      margin-bottom: 1.75rem;
      line-height: 1.8;
    }

    .formatted-text {
      font-size: 1.02rem;
      color: var(--text-1);
      letter-spacing: -0.01em;
    }

    ::ng-deep .ans-p {
      margin-bottom: 1rem;
      line-height: 1.75;
    }

    ::ng-deep .ans-p:last-child {
      margin-bottom: 0;
    }

    ::ng-deep .inline-code {
      font-family: var(--font-mono);
      font-size: 0.88em;
      background: rgba(15, 23, 42, 0.08);
      color: var(--neon-indigo);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      border: 1px solid rgba(99, 102, 241, 0.2);
    }
    html.dark ::ng-deep .inline-code {
      background: rgba(15, 23, 42, 0.6);
      color: #818cf8;
      border-color: rgba(99, 102, 241, 0.3);
    }

    ::ng-deep .code-block-container {
      background: #0b1120;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      margin: 1.1rem 0;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }

    ::ng-deep .code-lang-tag {
      background: #1e293b;
      color: #94a3b8;
      font-size: 0.72rem;
      font-family: var(--font-mono);
      padding: 0.35rem 0.85rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    ::ng-deep .code-pre {
      margin: 0;
      padding: 1.1rem;
      overflow-x: auto;
      color: #f8fafc;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      line-height: 1.6;
    }

    ::ng-deep .citation-chip-inline {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(99, 102, 241, 0.18);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: var(--neon-indigo);
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 0.78rem;
      padding: 0.08rem 0.48rem;
      margin: 0 0.25rem;
      border-radius: 5px;
      cursor: pointer;
      vertical-align: middle;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    html.dark ::ng-deep .citation-chip-inline { color: #a5b4fc; }

    ::ng-deep .citation-chip-inline:hover {
      background: var(--neon-indigo);
      color: #ffffff;
      transform: translateY(-2px);
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.6);
    }

    /* Citations Pill Bar */
    .citations-pill-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.85rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border-glass-subtle);
    }

    .sources-label-wrap {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-3);
    }

    .sources-label {
      font-size: 0.78rem;
      color: var(--text-2);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .citation-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .citation-pill {
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      border-radius: var(--radius-full);
      padding: 0.35rem 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: var(--text-1);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .citation-pill:hover {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.45);
      transform: translateY(-1px);
    }

    .pill-id {
      font-weight: 800;
      color: var(--neon-indigo);
      font-family: var(--font-mono);
    }
    html.dark .pill-id { color: #a5b4fc; }

    .pill-src {
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-2);
    }

    .pill-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--neon-rose);
    }

    .pill-status-dot.verified {
      background: var(--neon-emerald);
      box-shadow: 0 0 6px var(--neon-emerald);
    }

    .pill-verdict {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .verified-pill .pill-verdict { color: #059669; }
    html.dark .verified-pill .pill-verdict { color: #34d399; }
    
    .unverified-pill .pill-verdict { color: #e11d48; }
    html.dark .unverified-pill .pill-verdict { color: #fb7185; }

    @media (max-width: 680px) {
      .answer-card {
        padding: 1.15rem 1rem;
      }

      .answer-header {
        flex-direction: column;
        align-items: stretch;
        gap: 0.85rem;
      }

      .header-title-box {
        gap: 0.75rem;
      }

      .icon-sparkle {
        width: 38px;
        height: 38px;
        border-radius: 11px;
        flex-shrink: 0;
      }

      .icon-sparkle svg {
        width: 18px;
        height: 18px;
      }

      .section-title {
        font-size: 1.15rem;
      }

      .title-with-badge {
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .header-actions {
        width: 100%;
        display: flex;
        gap: 0.5rem;
      }

      .action-btn {
        flex: 1;
        justify-content: center;
        padding: 0.5rem 0.6rem;
        font-size: 0.78rem;
      }

      .formatted-text {
        font-size: 0.92rem;
        word-break: break-word;
      }

      .citations-pill-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.65rem;
      }

      .citation-chips-wrap {
        display: flex;
        flex-direction: column;
        width: 100%;
      }

      .citation-pill {
        width: 100%;
        justify-content: space-between;
      }

      .pill-src {
        max-width: 140px;
      }
    }
  `]
})
export class AnswerViewComponent {
  @Input() response: QueryResponse | null = null;
  @Output() openDrawer = new EventEmitter<void>();

  isCopied = false;

  cleanFileName(path: string): string {
    if (!path) return 'Document';
    const normalized = path.replace(/\\/g, '/');
    const name = normalized.split('/').pop() || path;
    return name;
  }

  onAnswerBodyClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target && target.classList.contains('citation-chip-inline')) {
      this.openDrawer.emit();
    }
  }

  formatAnswerHtml(raw: string): string {
    return formatMarkdownHtml(raw, { enableCitations: true });
  }

  copyAnswer() {
    if (this.response?.answer) {
      navigator.clipboard.writeText(this.response.answer);
      this.isCopied = true;
      setTimeout(() => this.isCopied = false, 2500);
    }
  }
}

