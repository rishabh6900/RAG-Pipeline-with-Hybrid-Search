import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QueryRequest } from '../../models/rag.models';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-panel glass-panel">
      <!-- Search Input Box -->
      <div class="input-container" [class.is-focused]="isInputFocused">
        <div class="search-icon-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        <textarea
          [(ngModel)]="request.question"
          (keydown.enter)="onEnterPressed($event)"
          (focus)="isInputFocused = true"
          (blur)="isInputFocused = false"
          placeholder="Ask any technical query across internal documentation (e.g., How to rotate Vault DB credentials or configure K8s MaxSurge?)..."
          rows="2"
          class="search-textarea"
          [disabled]="isLoading"
        ></textarea>

        <div class="input-actions">
          <button
            *ngIf="request.question"
            (click)="request.question = ''"
            class="clear-btn"
            title="Clear prompt"
          >
            ✕
          </button>
          
          <button
            (click)="submitQuery()"
            class="submit-button"
            [disabled]="isLoading || !request.question.trim()"
          >
            <div class="btn-content" *ngIf="!isLoading">
              <span class="btn-text">Search & Synthesize</span>
              <span class="key-hint">↵</span>
            </div>
            <div class="btn-loading" *ngIf="isLoading">
              <span class="spinner"></span>
              <span>Evaluating Context...</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Quick Suggestion Prompts -->
      <div class="quick-prompts">
        <div class="prompt-label-group">
          <span class="prompt-label">Quick Starters:</span>
        </div>
        <div class="chips-container">
          <button (click)="setPrompt('What is the CLI command to rotate database secrets in Vault?')" class="prompt-chip">
            Vault Secret Rotation
          </button>
          <button (click)="setPrompt('What are the zero downtime deployment settings for Kubernetes?')" class="prompt-chip">
            K8s Zero-Downtime
          </button>
          <button (click)="setPrompt('What is the error code when a JWT timestamp is expired?')" class="prompt-chip">
            JWT Expiry Errors
          </button>
          <button (click)="setPrompt('What is the connection pool max size and timeout for PostgreSQL?')" class="prompt-chip">
            PgBouncer Pool Limits
          </button>
        </div>
      </div>

      <!-- Mode & Advanced Settings Toggle Bar -->
      <div class="mode-toggle-bar">
        <button
          type="button"
          (click)="showAdvanced = !showAdvanced"
          class="advanced-toggle-btn"
          [class.active]="showAdvanced"
        >
          <span class="toggle-icon">{{ showAdvanced ? '▼' : '▶' }}</span>
          <span>{{ showAdvanced ? 'Hide Advanced Settings' : 'Advanced Pipeline Settings' }}</span>
          <span class="active-mode-pill" *ngIf="!showAdvanced">Hybrid RRF (70/30) • Rerank ON</span>
        </button>
      </div>

      <!-- Advanced Filter & Hyperparameter Tuning Controls -->
      <div class="controls-bar animate-fade-in" *ngIf="showAdvanced">
        <!-- Chunking Strategy Selector -->
        <div class="control-group">
          <label class="control-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Chunking Strategy
          </label>
          <div class="segmented-control">
            <button
              [class.active]="request.chunking_strategy === 'structure_aware'"
              (click)="request.chunking_strategy = 'structure_aware'"
              class="seg-btn"
            >
              <span class="dot-indicator green"></span>
              Structure-Aware
            </button>
            <button
              [class.active]="request.chunking_strategy === 'fixed'"
              (click)="request.chunking_strategy = 'fixed'"
              class="seg-btn"
            >
              <span class="dot-indicator cyan"></span>
              Fixed-512
            </button>
            <button
              [class.active]="request.chunking_strategy === 'semantic'"
              (click)="request.chunking_strategy = 'semantic'"
              class="seg-btn"
            >
              <span class="dot-indicator purple"></span>
              Semantic (LangChain)
            </button>
          </div>
        </div>

        <!-- Retrieval Mode Selector -->
        <div class="control-group">
          <label class="control-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
            Retrieval Mode
          </label>
          <div class="segmented-control">
            <button
              [class.active]="request.retrieval_mode === 'hybrid'"
              (click)="request.retrieval_mode = 'hybrid'"
              class="seg-btn hybrid-active"
            >
              Hybrid (RRF)
            </button>
            <button
              [class.active]="request.retrieval_mode === 'dense'"
              (click)="request.retrieval_mode = 'dense'"
              class="seg-btn"
            >
              Dense
            </button>
            <button
              [class.active]="request.retrieval_mode === 'sparse'"
              (click)="request.retrieval_mode = 'sparse'"
              class="seg-btn"
            >
              BM25
            </button>
          </div>
        </div>

        <!-- Weight Slider (if Hybrid) -->
        <div *ngIf="request.retrieval_mode === 'hybrid'" class="control-group slider-group">
          <div class="slider-header">
            <label class="control-label">Alpha Fusion Balance:</label>
            <div class="weight-labels">
              <span class="dense-val">Dense {{ denseWeightPercent }}%</span>
              <span class="slash">/</span>
              <span class="sparse-val">BM25 {{ sparseWeightPercent }}%</span>
            </div>
          </div>
          <div class="slider-wrapper">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              [ngModel]="request.hybrid_weights?.dense"
              (ngModelChange)="onWeightChange($event)"
              class="custom-slider"
            />
          </div>
        </div>

        <!-- Toggles: Reranker & Citation Judge -->
        <div class="control-group toggles-container">
          <label class="switch-card" [class.checked]="request.use_reranker">
            <input type="checkbox" [(ngModel)]="request.use_reranker" class="hidden-chk">
            <span class="switch-pill">
              <span class="switch-knob"></span>
            </span>
            <span class="switch-title">Cross-Encoder</span>
          </label>

          <label class="switch-card" [class.checked]="request.verify_citations">
            <input type="checkbox" [(ngModel)]="request.verify_citations" class="hidden-chk">
            <span class="switch-pill">
              <span class="switch-knob"></span>
            </span>
            <span class="switch-title">Citation Judge</span>
          </label>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .search-panel {
      padding: 1.6rem;
      margin-bottom: 2rem;
      border-radius: var(--radius-lg);
      background: var(--bg-glass-1);
      border: 1px solid var(--border-glass-subtle);
      box-shadow: var(--shadow-md);
    }

    .input-container {
      position: relative;
      display: flex;
      align-items: center;
      background: var(--bg-glass-input);
      border: 1px solid var(--border-glass-subtle);
      border-radius: var(--radius-md);
      padding: 0.85rem 1.1rem;
      box-shadow: var(--shadow-sm);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .input-container.is-focused {
      border-color: var(--neon-indigo);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2), 0 0 25px rgba(99, 102, 241, 0.25);
    }

    .search-icon-box {
      color: var(--neon-indigo);
      display: flex;
      align-items: center;
      margin-right: 0.85rem;
    }

    .search-textarea {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-pure);
      font-size: 1.02rem;
      font-family: var(--font-sans);
      resize: none;
      padding: 0.25rem 0;
      line-height: 1.55;
    }

    .search-textarea::placeholder {
      color: var(--text-3);
    }

    .input-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: 0.75rem;
    }

    .clear-btn {
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      color: var(--text-2);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s ease;
    }

    .clear-btn:hover {
      background: rgba(244, 63, 94, 0.2);
      color: #fb7185;
      border-color: rgba(244, 63, 94, 0.4);
      transform: scale(1.1);
    }

    .submit-button {
      background: var(--grad-primary);
      color: #ffffff;
      border: none;
      border-radius: var(--radius-sm);
      padding: 0.75rem 1.45rem;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 4px 18px rgba(99, 102, 241, 0.35);
    }

    .submit-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(6, 182, 212, 0.45);
    }

    .submit-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .btn-content {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    .btn-text {
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .key-hint {
      background: rgba(0, 0, 0, 0.22);
      padding: 0.12rem 0.45rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-family: var(--font-mono);
      color: #ffffff;
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

    /* Quick Starter Prompt Chips */
    .quick-prompts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-top: 1.15rem;
      padding-bottom: 1.15rem;
      border-bottom: 1px solid var(--border-glass-subtle);
    }

    .prompt-label-group {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .sparkle-tag { font-size: 0.9rem; }

    .prompt-label {
      font-size: 0.78rem;
      color: var(--text-2);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .prompt-chip {
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      color: var(--text-1);
      font-size: 0.82rem;
      font-weight: 600;
      padding: 0.35rem 0.8rem;
      border-radius: var(--radius-full);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .prompt-chip:hover {
      background: rgba(99, 102, 241, 0.16);
      border-color: rgba(99, 102, 241, 0.45);
      color: var(--neon-indigo);
      transform: translateY(-2px);
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.18);
    }
    html.dark .prompt-chip:hover { color: #a5b4fc; }

    .chip-emoji { font-size: 0.85rem; }

    /* Mode Toggle Bar */
    .mode-toggle-bar {
      margin-top: 1rem;
      display: flex;
      justify-content: flex-end;
    }

    .advanced-toggle-btn {
      background: transparent;
      border: 1px solid var(--border-glass-subtle);
      color: var(--text-2);
      padding: 0.45rem 0.9rem;
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      transition: all 0.2s ease;
    }

    .advanced-toggle-btn:hover, .advanced-toggle-btn.active {
      background: var(--bg-glass-card);
      color: var(--text-pure);
      border-color: var(--border-glass-medium);
    }

    .toggle-icon {
      font-size: 0.65rem;
      opacity: 0.7;
    }

    .active-mode-pill {
      background: rgba(99, 102, 241, 0.14);
      color: var(--neon-indigo);
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 800;
    }
    html.dark .active-mode-pill { color: #a5b4fc; }

    /* Controls Bar & Segmented Pills */
    .controls-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px dashed var(--border-glass-subtle);
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .control-label {
      font-size: 0.74rem;
      color: var(--text-2);
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .segmented-control {
      display: flex;
      background: var(--bg-inner-box);
      padding: 0.25rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-glass-subtle);
      gap: 0.25rem;
    }

    .seg-btn {
      background: transparent;
      border: none;
      color: var(--text-2);
      padding: 0.45rem 0.9rem;
      font-size: 0.8rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      transition: all 0.2s ease;
    }

    .seg-btn:hover {
      color: var(--text-pure);
      background: var(--bg-glass-card-hover);
    }

    .seg-btn.active {
      background: rgba(99, 102, 241, 0.2);
      color: var(--neon-indigo);
      border: 1px solid rgba(99, 102, 241, 0.4);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    html.dark .seg-btn.active {
      color: #ffffff;
      border-color: transparent;
    }

    .seg-btn.hybrid-active.active {
      background: var(--grad-primary);
      color: #ffffff;
      border: none;
      box-shadow: 0 2px 12px rgba(99, 102, 241, 0.4);
    }

    .dot-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .dot-indicator.green { background: var(--neon-emerald); }
    .dot-indicator.cyan { background: var(--neon-cyan); }
    .dot-indicator.purple { background: var(--neon-violet); }

    /* Slider Group */
    .slider-group {
      min-width: 230px;
    }

    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .weight-labels {
      font-size: 0.76rem;
      font-weight: 800;
    }

    .dense-val { color: #0284c7; }
    html.dark .dense-val { color: #38bdf8; }

    .sparse-val { color: #d97706; }
    html.dark .sparse-val { color: #fbbf24; }

    .slash { color: var(--text-3); margin: 0 0.2rem; }

    .slider-wrapper {
      padding-top: 0.35rem;
    }

    .custom-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #fbbf24 100%);
      outline: none;
      cursor: pointer;
    }

    .custom-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 0 8px rgba(99, 102, 241, 0.6);
      border: 2px solid var(--neon-indigo);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .custom-slider::-webkit-slider-thumb:hover {
      transform: scale(1.25);
    }

    /* Toggles */
    .toggles-container {
      flex-direction: row;
      align-items: center;
      gap: 0.75rem;
      margin-top: auto;
    }

    .switch-card {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.45rem 0.8rem;
      background: var(--bg-inner-box);
      border: 1px solid var(--border-glass-subtle);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .switch-card:hover {
      background: var(--bg-glass-card-hover);
      border-color: var(--border-glass-medium);
    }

    .switch-card.checked {
      border-color: rgba(99, 102, 241, 0.4);
      background: rgba(99, 102, 241, 0.12);
    }

    .hidden-chk { display: none; }

    .switch-pill {
      position: relative;
      width: 32px;
      height: 18px;
      border-radius: var(--radius-full);
      background: rgba(100, 116, 139, 0.3);
      transition: all 0.2s ease;
    }

    .switch-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .switch-card.checked .switch-pill {
      background: var(--neon-indigo);
      box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
    }

    .switch-card.checked .switch-knob {
      transform: translateX(14px);
    }

    .switch-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-2);
    }

    .switch-card.checked .switch-title {
      color: var(--text-pure);
    }
  `]
})
export class SearchBarComponent {
  @Input() isLoading = false;
  @Output() querySubmit = new EventEmitter<QueryRequest>();

  isInputFocused = false;
  showAdvanced = false;

  request: QueryRequest = {
    question: '',
    top_k: 5,
    retrieval_mode: 'hybrid',
    chunking_strategy: 'structure_aware',
    hybrid_weights: { dense: 0.70, sparse: 0.30 },
    use_reranker: true,
    verify_citations: true
  };

  onEnterPressed(e: Event) {
    e.preventDefault();
    if (!this.isLoading && this.request.question.trim()) {
      this.submitQuery();
    }
  }

  setPrompt(p: string) {
    this.request.question = p;
    this.submitQuery();
  }

  get denseWeightPercent(): number {
    return Math.round((this.request.hybrid_weights?.dense !== undefined ? this.request.hybrid_weights.dense : 0.70) * 100);
  }

  get sparseWeightPercent(): number {
    return Math.round((this.request.hybrid_weights?.sparse !== undefined ? this.request.hybrid_weights.sparse : 0.30) * 100);
  }

  onWeightChange(denseVal: number) {
    const d = parseFloat(denseVal.toString());
    const s = parseFloat((1.0 - d).toFixed(2));
    this.request.hybrid_weights = { dense: d, sparse: s };
  }

  submitQuery() {
    this.querySubmit.emit(this.request);
  }
}
