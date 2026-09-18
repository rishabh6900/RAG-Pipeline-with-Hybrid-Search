import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CitationInfo, RetrievedChunkInfo } from '../../models/rag.models';
import { formatMarkdownHtml } from '../../utils/markdown-formatter';

@Component({
  selector: 'app-citation-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="drawer-overlay" *ngIf="isOpen" (click)="close()">
      <div class="drawer-container glass-panel" (click)="$event.stopPropagation()">
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="header-left">
            <div>
              <h2 class="drawer-title">Context & Citation Matrix</h2>
              <p class="drawer-subtitle">Inspect raw document chunks, BM25 lexical matches, and Cross-Encoder attention spans</p>
            </div>
          </div>
          <button class="close-btn" (click)="close()" title="Close drawer">✕</button>
        </div>

        <!-- Tab Selector: Chunks vs Citations -->
        <div class="drawer-tabs">
          <button
            [class.active]="activeTab === 'citations'"
            (click)="activeTab = 'citations'"
            class="tab-btn"
          >
            <span>Verified Claims & Citations ({{ citations.length }})</span>
          </button>
          <button
            [class.active]="activeTab === 'chunks'"
            (click)="activeTab = 'chunks'"
            class="tab-btn"
          >
            <span>Retrieved Context Chunks ({{ chunks.length }})</span>
          </button>
        </div>

        <div class="drawer-body">
          <!-- Citations Tab -->
          <div *ngIf="activeTab === 'citations'" class="tab-content animate-fade-in">
            <div *ngFor="let cit of citations; let cIdx = index" class="citation-card glass-card">
              <div class="cit-card-top">
                <div class="cit-tag-group">
                  <span class="cit-tag">[{{ cit.citation_id }}]</span>
                  <span class="badge" [ngClass]="cit.verified ? 'badge-emerald' : 'badge-rose'">
                    {{ cit.verdict }}
                  </span>
                </div>
                <div class="cit-top-right">
                  <span class="cit-source" [title]="cit.source_file + ' > ' + cit.section">
                    {{ cleanFileName(cit.source_file) }} &gt; {{ cit.section }}
                  </span>
                  <button class="mini-copy-btn" (click)="copyText(cit.snippet, 'cit_' + cIdx)" [title]="copiedKey === 'cit_' + cIdx ? 'Copied!' : 'Copy Snippet'">
                    {{ copiedKey === 'cit_' + cIdx ? '✓ Copied' : 'Copy' }}
                  </button>
                </div>
              </div>

              <div class="claim-box">
                <span class="claim-label">Asserted Fact / Claim:</span>
                <div class="claim-text-formatted" [innerHTML]="formatClaimHtml(cit.claim)"></div>
              </div>

              <div class="reasoning-box">
                <span class="reasoning-label">LLM-Judge Verification Rationale:</span>
                <p class="reasoning-text">{{ cit.reasoning }}</p>
              </div>

              <div class="snippet-box">
                <span class="snippet-label">Source Document Evidence Snippet:</span>
                <div class="snippet-code" [innerHTML]="formatChunkHtml(cit.snippet)"></div>
              </div>
            </div>

            <div *ngIf="!citations || citations.length === 0" class="empty-state glass-card">
              <p>No citation tags generated for this response.</p>
            </div>
          </div>

          <!-- Chunks Tab -->
          <div *ngIf="activeTab === 'chunks'" class="tab-content animate-fade-in">
            <div *ngFor="let chunk of chunks; let idx = index" class="chunk-card glass-card">
              <div class="chunk-card-header">
                <div class="chunk-id-group">
                  <span class="chunk-rank-badge">#{{ idx + 1 }}</span>
                  <span class="chunk-title" [title]="chunk.source_path">{{ cleanFileName(chunk.source_path) }}</span>
                </div>
                <div class="scores-cluster">
                  <span *ngIf="chunk.rerank_score !== undefined && chunk.rerank_score !== null" class="score-badge rerank">
                    Rerank: {{ chunk.rerank_score | number:'1.2-2' }}
                  </span>
                  <span *ngIf="chunk.rrf_score !== undefined && chunk.rrf_score !== null" class="score-badge rrf">
                    RRF: {{ chunk.rrf_score | number:'1.4-4' }}
                  </span>
                  <span *ngIf="chunk.dense_score !== undefined && chunk.dense_score !== null" class="score-badge dense">
                    Dense: {{ chunk.dense_score | number:'1.2-2' }}
                  </span>
                  <span *ngIf="chunk.sparse_score !== undefined && chunk.sparse_score !== null" class="score-badge sparse">
                    BM25: {{ chunk.sparse_score | number:'1.1-1' }}
                  </span>
                </div>
              </div>

              <div class="chunk-meta-sub">
                <span>Section: <strong>{{ chunk.section_title }}</strong></span>
                <div class="meta-right">
                  <span>Tokens: <strong>{{ chunk.token_count }}</strong></span>
                  <button class="mini-copy-btn" (click)="copyText(chunk.text, 'chunk_' + idx)" [title]="copiedKey === 'chunk_' + idx ? 'Copied!' : 'Copy chunk text'">
                    {{ copiedKey === 'chunk_' + idx ? '✓ Copied' : 'Copy' }}
                  </button>
                </div>
              </div>

              <div class="chunk-text-box" [innerHTML]="formatChunkHtml(chunk.text)"></div>
            </div>

            <div *ngIf="!chunks || chunks.length === 0" class="empty-state glass-card">
              <p>No chunks retrieved for this query.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: var(--overlay-bg);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      display: flex;
      justify-content: flex-end;
      z-index: 9999;
      animation: fadeInScale 0.25s ease-out;
    }

    .drawer-container {
      width: 100%;
      max-width: 760px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--bg-drawer);
      border-left: 1px solid var(--border-glass-medium);
      border-radius: 0;
      padding: 2rem;
      box-shadow: -20px 0 60px rgba(0, 0, 0, 0.5);
      animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideLeft {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-glass-subtle);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .drawer-icon { font-size: 1.6rem; }

    .drawer-title {
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--text-pure);
      letter-spacing: -0.02em;
    }

    .drawer-subtitle {
      font-size: 0.8rem;
      color: var(--text-2);
      margin-top: 0.15rem;
    }

    .close-btn {
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      color: var(--text-2);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: rgba(244, 63, 94, 0.2);
      color: #fb7185;
      border-color: rgba(244, 63, 94, 0.4);
      transform: rotate(90deg);
    }

    /* Tabs */
    .drawer-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-glass-subtle);
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-2);
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }

    .tab-btn:hover {
      color: var(--text-pure);
      background: var(--bg-glass-card-hover);
    }

    .tab-btn.active {
      background: rgba(99, 102, 241, 0.18);
      color: var(--neon-indigo);
      border: 1px solid rgba(99, 102, 241, 0.4);
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
    }
    html.dark .tab-btn.active { color: #a5b4fc; }

    .tab-icon { font-size: 0.95rem; }

    /* Drawer Body */
    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding-right: 0.5rem;
    }

    .tab-content {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* Citation Card */
    .citation-card {
      padding: 1.4rem;
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      border-radius: var(--radius-md);
    }

    .cit-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .cit-tag-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .cit-top-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .cit-tag {
      background: var(--grad-primary);
      color: #ffffff;
      font-weight: 800;
      font-size: 0.78rem;
      padding: 0.15rem 0.55rem;
      border-radius: 4px;
      font-family: var(--font-mono);
    }

    .cit-source {
      font-size: 0.76rem;
      color: var(--text-2);
      font-weight: 600;
    }

    .mini-copy-btn {
      background: var(--bg-inner-box);
      border: 1px solid var(--border-glass-subtle);
      color: var(--text-2);
      font-size: 0.72rem;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .mini-copy-btn:hover {
      background: var(--bg-glass-card-hover);
      color: var(--text-pure);
      border-color: var(--border-glass-medium);
    }

    .claim-box, .reasoning-box, .snippet-box {
      margin-bottom: 0.85rem;
    }

    .claim-label, .reasoning-label, .snippet-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      display: block;
      margin-bottom: 0.25rem;
    }

    .claim-text, .claim-text-formatted {
      font-size: 0.92rem;
      color: var(--text-pure);
      font-weight: 500;
      line-height: 1.6;
    }

    .claim-text-formatted p {
      margin-bottom: 0.5rem;
    }
    .claim-text-formatted p:last-child {
      margin-bottom: 0;
    }

    .reasoning-text {
      font-size: 0.84rem;
      color: var(--neon-indigo);
      background: rgba(99, 102, 241, 0.08);
      border-left: 3px solid var(--neon-indigo);
      padding: 0.55rem 0.85rem;
      border-radius: 0 6px 6px 0;
      line-height: 1.55;
    }
    html.dark .reasoning-text { color: #a5b4fc; }

    .snippet-code, .chunk-text-box {
      font-family: var(--font-sans);
      font-size: 0.88rem;
      background: var(--bg-inner-box);
      padding: 1rem 1.15rem;
      border-radius: 8px;
      color: var(--text-1);
      border: 1px solid var(--border-glass-subtle);
      line-height: 1.7;
      letter-spacing: -0.005em;
    }

    /* Chunk Card */
    .chunk-card {
      padding: 1.4rem;
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      border-radius: var(--radius-md);
    }

    .chunk-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .chunk-id-group {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    .chunk-rank-badge {
      background: var(--grad-primary);
      color: #ffffff;
      font-weight: 800;
      font-size: 0.75rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-family: var(--font-mono);
    }

    .chunk-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-pure);
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .scores-cluster {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .score-badge {
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-weight: 700;
      font-family: var(--font-mono);
    }

    .score-badge.rerank { background: rgba(16, 185, 129, 0.15); color: #059669; }
    html.dark .score-badge.rerank { color: #34d399; }
    
    .score-badge.rrf { background: rgba(99, 102, 241, 0.15); color: #4f46e5; }
    html.dark .score-badge.rrf { color: #818cf8; }
    
    .score-badge.dense { background: rgba(6, 182, 212, 0.15); color: #0284c7; }
    html.dark .score-badge.dense { color: #38bdf8; }
    
    .score-badge.sparse { background: rgba(245, 158, 11, 0.15); color: #d97706; }
    html.dark .score-badge.sparse { color: #fbbf24; }

    .chunk-meta-sub {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.76rem;
      color: var(--text-2);
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-glass-subtle);
    }

    .meta-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    ::ng-deep .chunk-breadcrumb-tag {
      display: inline-block;
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--neon-indigo);
      background: rgba(99, 102, 241, 0.12);
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      margin-bottom: 0.65rem;
      border: 1px solid rgba(99, 102, 241, 0.25);
    }
    html.dark ::ng-deep .chunk-breadcrumb-tag { color: #a5b4fc; }

    ::ng-deep .chunk-p {
      margin-bottom: 0.65rem;
    }

    ::ng-deep .chunk-p:last-child {
      margin-bottom: 0;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: var(--text-2);
      background: var(--bg-glass-card);
    }

    .empty-icon { font-size: 2.2rem; margin-bottom: 0.5rem; }

    @media (max-width: 680px) {
      .drawer-container {
        padding: 1.15rem 0.9rem;
        max-width: 100vw;
      }

      .drawer-header {
        margin-bottom: 1rem;
        padding-bottom: 0.85rem;
      }

      .drawer-title {
        font-size: 1.15rem;
      }

      .drawer-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.35rem;
        padding-bottom: 0.75rem;
        margin-bottom: 1rem;
      }

      .tab-btn {
        font-size: 0.72rem;
        padding: 0.45rem 0.35rem;
        text-align: center;
        justify-content: center;
      }

      .citation-card, .chunk-card {
        padding: 1rem 0.85rem;
      }

      .cit-card-top {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .cit-top-right {
        width: 100%;
        justify-content: space-between;
      }

      .chunk-card-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .chunk-title {
        max-width: 180px;
      }

      .scores-cluster {
        width: 100%;
        gap: 0.25rem;
      }

      .score-badge {
        font-size: 0.65rem;
        padding: 0.12rem 0.35rem;
      }
    }
  `]
})
export class CitationDrawerComponent {
  @Input() isOpen = false;
  @Input() citations: CitationInfo[] = [];
  @Input() chunks: RetrievedChunkInfo[] = [];
  @Output() closeDrawer = new EventEmitter<void>();

  activeTab: 'citations' | 'chunks' = 'citations';
  copiedKey: string | null = null;

  cleanFileName(path: string): string {
    if (!path) return 'Document';
    const normalized = path.replace(/\\/g, '/');
    const name = normalized.split('/').pop() || path;
    return name;
  }

  copyText(text: string, key: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    this.copiedKey = key;
    setTimeout(() => {
      if (this.copiedKey === key) {
        this.copiedKey = null;
      }
    }, 2000);
  }

  formatClaimHtml(raw: string): string {
    if (!raw) return '';
    return formatMarkdownHtml(raw, { enableCitations: false, isCitationView: true });
  }

  formatChunkHtml(raw: string): string {
    if (!raw) return '';
    return formatMarkdownHtml(raw, { enableCitations: false, isCitationView: true });
  }

  close() {
    this.closeDrawer.emit();
  }
}

