import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentsResponse } from '../../models/rag.models';

@Component({
  selector: 'app-document-ingest',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ingest-card glass-panel">
      <!-- Section Header -->
      <div class="ingest-header">
        <div class="header-left">
          <div class="header-icon">📚</div>
          <div>
            <h2 class="ingest-title">Internal Documentation Corpus</h2>
            <p class="ingest-subtitle">Multi-format enterprise ingestion with automated structure parsing, deduplication, and dual-store indexing</p>
          </div>
        </div>
        <div class="corpus-stats-badge">
          <span class="count-num">{{ documentsData?.raw_documents_count || 0 }}</span>
          <span class="count-label">Indexed Documents</span>
        </div>
      </div>

      <!-- Ingestion Form & Dropzone -->
      <div class="upload-section">
        <div
          class="dropzone-box"
          [class.has-file]="selectedFile"
          [class.drag-over]="isDragging"
          (dragover)="onDragOver($event)"
          (dragleave)="isDragging = false"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
        >
          <input
            type="file"
            #fileInput
            (change)="onFileSelected($event)"
            accept=".md,.mdx,.html,.htm,.pdf,.txt"
            class="hidden-file-input"
          />
          
          <div class="dropzone-content">
            <div class="upload-icon-circle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div class="dropzone-text">
              <span class="drop-primary">{{ selectedFile ? selectedFile.name : 'Click to upload or drag & drop technical files' }}</span>
              <span class="drop-secondary">Supported formats: PDF (.pdf), Markdown (.md), HTML (.html), Plain Text (.txt)</span>
            </div>
            <span *ngIf="selectedFile" class="file-size-badge">{{ (selectedFile.size / 1024) | number:'1.1-1' }} KB</span>
          </div>
        </div>

        <!-- Strategy & Submit Action Bar -->
        <div class="action-bar">
          <div class="strategy-selector-wrapper">
            <label class="strategy-label">Indexing Strategy:</label>
            <select [(ngModel)]="selectedStrategy" class="strategy-select">
              <option value="all">⚡ All Strategies (Structure + Fixed + Semantic for Benchmark)</option>
              <option value="structure_aware">🏗️ Structure-Aware (Header Tree Splitter)</option>
              <option value="fixed">📏 Fixed-Size Window (512 tokens / 64 overlap)</option>
              <option value="semantic">🧠 LangChain SemanticChunker (Adaptive Topic Splitter)</option>
            </select>
          </div>

          <div class="action-buttons-group">
            <button
              class="sync-all-btn"
              (click)="syncAllFiles()"
              [disabled]="isUploading"
              title="Index all files currently present in data/raw"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span>Sync All Files in /data/raw</span>
            </button>

            <button
              class="ingest-submit-btn"
              (click)="uploadAndIngest()"
              [disabled]="!selectedFile || isUploading"
            >
              <div class="btn-inner" *ngIf="!isUploading">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
                <span>Ingest & Dual-Index</span>
              </div>
              <div class="btn-loading" *ngIf="isUploading">
                <span class="spinner"></span>
                <span>Chunking & Embedding...</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Success Alert Toast -->
      <div *ngIf="uploadSuccessMessage" class="upload-success-alert glass-card animate-fade-in">
        <div class="success-content">
          <span class="success-icon">✓</span>
          <span class="success-text">{{ uploadSuccessMessage }}</span>
        </div>
        <button (click)="goToSearch.emit()" class="ask-now-btn">
          💬 Ask Questions Now →
        </button>
      </div>

      <!-- Indexed Document List -->
      <div class="corpus-explorer">
        <div class="explorer-header">
          <div>
            <h3 class="explorer-title">Active Corpus Files</h3>
            <span class="explorer-sub">Synced across Qdrant Vector Collection & In-Memory BM25 Lexical Store</span>
          </div>
          <button
            class="sync-pill-btn"
            (click)="syncAllFiles()"
            [disabled]="isUploading"
          >
            ⚡ Re-Index All Files
          </button>
        </div>

        <div class="docs-grid" *ngIf="documentsData?.raw_documents?.length">
          <div *ngFor="let doc of documentsData?.raw_documents" class="doc-card glass-card">
            <div class="doc-header">
              <div class="doc-file-badge">
                <span class="doc-icon">{{ getFileIcon(doc) }}</span>
                <span class="doc-type-label">{{ getFileType(doc) }}</span>
              </div>
              <span class="dual-indexed-tag">
                <span class="tag-dot"></span> Dual Indexed
              </span>
            </div>

            <div class="doc-name-box">
              <h4 class="doc-name" [title]="doc">{{ doc }}</h4>
            </div>

            <div class="doc-footer">
              <div class="storage-tags">
                <span class="storage-pill dense">Qdrant DB</span>
                <span class="storage-pill sparse">BM25</span>
              </div>
              <span class="ready-status">Ready</span>
            </div>
          </div>
        </div>

        <div *ngIf="!documentsData?.raw_documents || documentsData?.raw_documents?.length === 0" class="empty-corpus-state glass-card">
          <div class="empty-icon">📁</div>
          <h4 class="empty-title">Corpus Index Ready for Documents</h4>
          <p class="empty-desc">Upload your internal technical runbooks, architecture specs, or API guides above to begin querying.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ingest-card {
      padding: 2rem;
      margin-top: 1rem;
      border-radius: var(--radius-lg);
      background: var(--bg-glass-1);
      border: 1px solid var(--border-glass-subtle);
    }

    .ingest-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-glass-subtle);
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-icon { font-size: 1.8rem; }

    .ingest-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--text-pure);
      letter-spacing: -0.025em;
    }

    .ingest-subtitle {
      font-size: 0.82rem;
      color: var(--text-2);
      margin-top: 0.2rem;
    }

    .corpus-stats-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 0.45rem 1rem;
      border-radius: var(--radius-md);
    }

    .count-num {
      font-size: 1.25rem;
      font-weight: 900;
      font-family: var(--font-display);
      color: #0284c7;
      line-height: 1;
    }
    html.dark .count-num { color: #38bdf8; }

    .count-label {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* Dropzone Box */
    .dropzone-box {
      border: 2px dashed rgba(99, 102, 241, 0.35);
      border-radius: var(--radius-md);
      padding: 2.25rem 2rem;
      background: var(--bg-inner-box);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      margin-bottom: 1.25rem;
    }

    .dropzone-box:hover, .dropzone-box.drag-over {
      border-color: var(--neon-cyan);
      background: rgba(99, 102, 241, 0.08);
      box-shadow: 0 0 25px rgba(6, 182, 212, 0.15);
    }

    .dropzone-box.has-file {
      border-color: var(--neon-emerald);
      background: rgba(16, 185, 129, 0.06);
    }

    .hidden-file-input { display: none; }

    .dropzone-content {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .upload-icon-circle {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: var(--neon-indigo);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .dropzone-text {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .drop-primary {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-pure);
      margin-bottom: 0.2rem;
    }

    .drop-secondary {
      font-size: 0.78rem;
      color: var(--text-2);
    }

    .file-size-badge {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #059669;
      font-size: 0.75rem;
      font-family: var(--font-mono);
      font-weight: 700;
      padding: 0.2rem 0.65rem;
      border-radius: var(--radius-full);
    }
    html.dark .file-size-badge { color: #34d399; }

    /* Action Bar */
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }

    .strategy-selector-wrapper {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .strategy-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .strategy-select {
      background: var(--bg-glass-input);
      border: 1px solid var(--border-glass-subtle);
      color: var(--text-pure);
      padding: 0.65rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-family: var(--font-sans);
      outline: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .strategy-select:focus {
      border-color: var(--neon-indigo);
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
    }

    .ingest-submit-btn {
      background: var(--grad-primary);
      color: #ffffff;
      border: none;
      padding: 0.75rem 1.6rem;
      border-radius: var(--radius-sm);
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 4px 18px rgba(99, 102, 241, 0.35);
    }

    .ingest-submit-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(6, 182, 212, 0.45);
    }

    .ingest-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .btn-inner {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    .btn-loading {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Success Toast */
    .upload-success-alert {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: var(--radius-md);
      margin-bottom: 2rem;
      color: var(--text-pure);
    }

    .success-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .success-icon {
      font-weight: 900;
      font-size: 1.1rem;
      color: #10b981;
    }

    .ask-now-btn {
      background: var(--neon-indigo);
      color: white;
      border: none;
      padding: 0.45rem 1rem;
      border-radius: var(--radius-full);
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
    }

    .ask-now-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
    }

    /* Corpus Explorer & Docs Grid */
    .corpus-explorer {
      margin-top: 1.5rem;
    }

    .explorer-header {
      margin-bottom: 1.25rem;
    }

    .explorer-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-pure);
    }

    .explorer-sub {
      font-size: 0.78rem;
      color: var(--text-2);
    }

    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.1rem;
    }

    .doc-card {
      padding: 1.2rem;
      background: var(--bg-glass-card);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-glass-subtle);
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .doc-card:hover {
      transform: translateY(-3px);
      border-color: var(--border-glass-medium);
      box-shadow: var(--shadow-md);
    }

    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .doc-file-badge {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .doc-icon { font-size: 1.2rem; }

    .doc-type-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-2);
      text-transform: uppercase;
      font-family: var(--font-mono);
    }

    .dual-indexed-tag {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      font-weight: 700;
      color: #059669;
      background: rgba(16, 185, 129, 0.12);
      padding: 0.15rem 0.55rem;
      border-radius: var(--radius-full);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    html.dark .dual-indexed-tag { color: #34d399; }

    .tag-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
    }

    .doc-name {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-pure);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doc-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.6rem;
      border-top: 1px solid var(--border-glass-subtle);
    }

    .storage-tags {
      display: flex;
      gap: 0.35rem;
    }

    .storage-pill {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
    }

    .storage-pill.dense { background: rgba(6, 182, 212, 0.15); color: #0284c7; }
    html.dark .storage-pill.dense { color: #38bdf8; }

    .storage-pill.sparse { background: rgba(245, 158, 11, 0.15); color: #d97706; }
    html.dark .storage-pill.sparse { color: #fbbf24; }

    .ready-status {
      font-size: 0.72rem;
      color: var(--text-3);
      font-weight: 600;
    }

    .action-buttons-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .sync-all-btn {
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-medium);
      color: var(--text-1);
      padding: 0.75rem 1.25rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .sync-all-btn:hover:not(:disabled) {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.45);
      color: var(--neon-indigo);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
    }
    html.dark .sync-all-btn:hover:not(:disabled) { color: #a5b4fc; }

    .sync-all-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .sync-pill-btn {
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: var(--neon-indigo);
      padding: 0.35rem 0.85rem;
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    html.dark .sync-pill-btn { color: #a5b4fc; }

    .sync-pill-btn:hover:not(:disabled) {
      background: var(--neon-indigo);
      color: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
    }

    .empty-corpus-state {
      text-align: center;
      padding: 3rem 2rem;
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
    }

    .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
    .empty-title { font-size: 1.1rem; color: var(--text-pure); margin-bottom: 0.35rem; }
    .empty-desc { font-size: 0.84rem; color: var(--text-2); max-width: 500px; margin: 0 auto; }
  `]
})
export class DocumentIngestComponent {
  @Input() documentsData: DocumentsResponse | null = null;
  @Input() isUploading = false;
  @Output() ingestRequest = new EventEmitter<{ file: File; strategy: string }>();
  @Output() syncRawRequest = new EventEmitter<string>();
  @Output() goToSearch = new EventEmitter<void>();

  selectedFile: File | null = null;
  selectedStrategy = 'all';
  uploadSuccessMessage: string | null = null;
  isDragging = false;

  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.selectedFile = event.target.files[0];
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.selectedFile = event.dataTransfer.files[0];
    }
  }

  uploadAndIngest() {
    if (this.selectedFile) {
      this.ingestRequest.emit({
        file: this.selectedFile,
        strategy: this.selectedStrategy
      });
      this.uploadSuccessMessage = `Successfully parsed, chunked, and dual-indexed: ${this.selectedFile.name}`;
      setTimeout(() => this.uploadSuccessMessage = null, 5000);
      this.selectedFile = null;
    }
  }

  syncAllFiles() {
    this.syncRawRequest.emit(this.selectedStrategy);
    this.uploadSuccessMessage = `Synchronizing and indexing all files in './data/raw' across all chunking strategies...`;
    setTimeout(() => this.uploadSuccessMessage = null, 6000);
  }

  getFileIcon(filename: string): string {
    if (filename.endsWith('.pdf')) return '📕';
    if (filename.endsWith('.md') || filename.endsWith('.mdx')) return '📝';
    if (filename.endsWith('.html') || filename.endsWith('.htm')) return '🌐';
    return '📄';
  }

  getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toUpperCase();
    return ext || 'DOC';
  }
}
