import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChunkingCompareResponse } from '../../models/rag.models';
import { formatMarkdownHtml } from '../../utils/markdown-formatter';

@Component({
  selector: 'app-strategy-compare',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="compare-container glass-panel" *ngIf="comparisonData">
      <div class="compare-header">
        <div class="header-left">
          <div>
            <h2 class="compare-title">Chunking Strategy Ablation & Benchmark</h2>
            <p class="compare-subtitle">Evaluating Fixed-Size (512/64) vs Structure-Aware Header Splitting vs Semantic Topic Boundaries</p>
          </div>
        </div>
        <div class="benchmark-pill">
          <span class="live-dot"></span>
          <span>Side-by-Side In-Flight Benchmark</span>
        </div>
      </div>

      <div class="strategy-grid">
        <!-- Strategy 1: Structure-Aware (Champion) -->
        <div class="strategy-card glass-card champion-card">
          <div class="champion-glow"></div>
          
          <div class="card-top">
            <div class="card-badge-row">
              <span class="badge badge-emerald">Champion • Structure-Aware</span>
              <span class="latency-tag">{{ comparisonData.structure_aware_strategy_answer.processing_time_ms }} ms</span>
            </div>
            <h3 class="card-name">Structure-Aware Chunking</h3>
            <p class="card-desc">Hierarchically slices on Markdown & PDF header levels, retaining document tree breadcrumbs and metadata context.</p>
          </div>

          <div class="card-metrics">
            <div class="metric-item">
              <span class="m-label">Composite Grounding:</span>
              <span class="m-val emerald">{{ (comparisonData.structure_aware_strategy_answer.confidence_scores.composite * 100) | number:'1.0-0' }}%</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-fill emerald-fill" [style.width.%]="comparisonData.structure_aware_strategy_answer.confidence_scores.composite * 100"></div>
            </div>

            <div class="sub-metrics-row">
              <div class="sub-m-item">
                <span class="sub-label">Citations Verified:</span>
                <span class="sub-val">{{ comparisonData.structure_aware_strategy_answer.citations.length }}</span>
              </div>
              <div class="sub-m-item">
                <span class="sub-label">Retrieved Passages:</span>
                <span class="sub-val">{{ comparisonData.structure_aware_strategy_answer.retrieved_chunks_count }}</span>
              </div>
            </div>
          </div>

          <div class="card-answer-box">
            <span class="box-label">Synthesized Output:</span>
            <div class="answer-text" [innerHTML]="formatAnswerHtml(comparisonData.structure_aware_strategy_answer.answer)"></div>
          </div>
        </div>

        <!-- Strategy 2: Fixed-Size Overlap (Baseline) -->
        <div class="strategy-card glass-card">
          <div class="card-top">
            <div class="card-badge-row">
              <span class="badge badge-cyan">Baseline • Fixed Window</span>
              <span class="latency-tag">{{ comparisonData.fixed_strategy_answer.processing_time_ms }} ms</span>
            </div>
            <h3 class="card-name">Fixed-Size Overlap (512 / 64)</h3>
            <p class="card-desc">Naive sliding window token split. High risk of truncating code blocks, table definitions, and list items.</p>
          </div>

          <div class="card-metrics">
            <div class="metric-item">
              <span class="m-label">Composite Grounding:</span>
              <span class="m-val cyan">{{ (comparisonData.fixed_strategy_answer.confidence_scores.composite * 100) | number:'1.0-0' }}%</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-fill cyan-fill" [style.width.%]="comparisonData.fixed_strategy_answer.confidence_scores.composite * 100"></div>
            </div>

            <div class="sub-metrics-row">
              <div class="sub-m-item">
                <span class="sub-label">Citations Verified:</span>
                <span class="sub-val">{{ comparisonData.fixed_strategy_answer.citations.length }}</span>
              </div>
              <div class="sub-m-item">
                <span class="sub-label">Retrieved Passages:</span>
                <span class="sub-val">{{ comparisonData.fixed_strategy_answer.retrieved_chunks_count }}</span>
              </div>
            </div>
          </div>

          <div class="card-answer-box">
            <span class="box-label">Synthesized Output:</span>
            <div class="answer-text" [innerHTML]="formatAnswerHtml(comparisonData.fixed_strategy_answer.answer)"></div>
          </div>
        </div>

        <!-- Strategy 3: Semantic Topic Splitter -->
        <div class="strategy-card glass-card">
          <div class="card-top">
            <div class="card-badge-row">
              <span class="badge badge-amber">Adaptive • Semantic Split</span>
              <span class="latency-tag">{{ comparisonData.semantic_strategy_answer.processing_time_ms }} ms</span>
            </div>
            <h3 class="card-name">Semantic Topic Boundaries</h3>
            <p class="card-desc">Calculates sliding sentence embedding cosine distances, cutting chunks where thematic distance spikes above threshold.</p>
          </div>

          <div class="card-metrics">
            <div class="metric-item">
              <span class="m-label">Composite Grounding:</span>
              <span class="m-val amber">{{ (comparisonData.semantic_strategy_answer.confidence_scores.composite * 100) | number:'1.0-0' }}%</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-fill amber-fill" [style.width.%]="comparisonData.semantic_strategy_answer.confidence_scores.composite * 100"></div>
            </div>

            <div class="sub-metrics-row">
              <div class="sub-m-item">
                <span class="sub-label">Citations Verified:</span>
                <span class="sub-val">{{ comparisonData.semantic_strategy_answer.citations.length }}</span>
              </div>
              <div class="sub-m-item">
                <span class="sub-label">Retrieved Passages:</span>
                <span class="sub-val">{{ comparisonData.semantic_strategy_answer.retrieved_chunks_count }}</span>
              </div>
            </div>
          </div>

          <div class="card-answer-box">
            <span class="box-label">Synthesized Output:</span>
            <div class="answer-text" [innerHTML]="formatAnswerHtml(comparisonData.semantic_strategy_answer.answer)"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .compare-container {
      padding: 2rem;
      margin-top: 1rem;
      margin-bottom: 2rem;
      border-radius: var(--radius-lg);
      background: var(--bg-glass-1);
      border: 1px solid var(--border-glass-subtle);
    }

    .compare-header {
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

    .arena-icon { font-size: 1.8rem; }

    .compare-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--text-pure);
      letter-spacing: -0.025em;
    }

    .compare-subtitle {
      font-size: 0.82rem;
      color: var(--text-2);
      margin-top: 0.2rem;
    }

    .benchmark-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--neon-indigo);
    }
    html.dark .benchmark-pill { color: #a5b4fc; }

    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--neon-cyan);
    }

    .strategy-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .strategy-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
      border-radius: var(--radius-md);
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      padding: 1.5rem;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .strategy-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
    }

    .champion-card {
      border-color: rgba(16, 185, 129, 0.45);
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.12);
    }

    .card-top {
      margin-bottom: 1.25rem;
    }

    .card-badge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .latency-tag {
      font-size: 0.75rem;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-weight: 600;
    }

    .card-name {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-pure);
      margin-bottom: 0.35rem;
    }

    .card-desc {
      font-size: 0.8rem;
      color: var(--text-2);
      line-height: 1.5;
    }

    .card-metrics {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      background: var(--bg-inner-box);
      padding: 1rem;
      border-radius: var(--radius-sm);
      margin-bottom: 1.25rem;
      border: 1px solid var(--border-glass-subtle);
    }

    .metric-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.82rem;
    }

    .m-label { color: var(--text-2); font-weight: 600; }
    .m-val { font-weight: 800; font-family: var(--font-mono); }
    .m-val.emerald { color: #059669; }
    html.dark .m-val.emerald { color: #34d399; }
    
    .m-val.cyan { color: #0284c7; }
    html.dark .m-val.cyan { color: #38bdf8; }
    
    .m-val.amber { color: #d97706; }
    html.dark .m-val.amber { color: #fbbf24; }

    .progress-bar-wrap {
      height: 6px;
      background: var(--bg-glass-card);
      border: 1px solid var(--border-glass-subtle);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: var(--radius-full);
      transition: width 0.8s ease;
    }

    .emerald-fill { background: linear-gradient(90deg, #059669, #34d399); }
    .cyan-fill { background: linear-gradient(90deg, #06b6d4, #38bdf8); }
    .amber-fill { background: linear-gradient(90deg, #d97706, #fbbf24); }

    .sub-metrics-row {
      display: flex;
      justify-content: space-between;
      padding-top: 0.4rem;
      border-top: 1px solid var(--border-glass-subtle);
    }

    .sub-m-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.76rem;
    }

    .sub-label { color: var(--text-3); }
    .sub-val { color: var(--text-1); font-weight: 700; font-family: var(--font-mono); }

    .card-answer-box {
      flex: 1;
      background: var(--bg-inner-box);
      padding: 1.15rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-glass-subtle);
      display: flex;
      flex-direction: column;
    }

    .box-label {
      font-size: 0.72rem;
      color: var(--text-3);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.6rem;
    }

    .answer-text {
      font-size: 0.88rem;
      color: var(--text-1);
      line-height: 1.65;
    }

    ::ng-deep .inline-code {
      font-family: var(--font-mono);
      font-size: 0.85em;
      background: rgba(15, 23, 42, 0.08);
      color: var(--neon-indigo);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
    }
    html.dark ::ng-deep .inline-code {
      background: rgba(15, 23, 42, 0.6);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    ::ng-deep .citation-chip-inline {
      display: inline-flex;
      align-items: center;
      background: rgba(99, 102, 241, 0.18);
      color: var(--neon-indigo);
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 0.74rem;
      padding: 0.02rem 0.35rem;
      margin: 0 0.2rem;
      border-radius: 4px;
    }
    html.dark ::ng-deep .citation-chip-inline { color: #a5b4fc; }

    @media (max-width: 768px) {
      .compare-container {
        padding: 1.15rem 1rem;
        margin-top: 0.75rem;
      }

      .compare-header {
        margin-bottom: 1.25rem;
        padding-bottom: 1rem;
        gap: 0.75rem;
      }

      .compare-title {
        font-size: 1.15rem;
      }

      .strategy-grid {
        grid-template-columns: 1fr;
        gap: 1.15rem;
      }

      .strategy-card {
        padding: 1.15rem 1rem;
      }

      .card-badge-row {
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .sub-metrics-row {
        flex-wrap: wrap;
        gap: 0.5rem;
      }
    }
  `]
})
export class StrategyCompareComponent {
  @Input() comparisonData: ChunkingCompareResponse | null = null;

  formatAnswerHtml(raw: string): string {
    return formatMarkdownHtml(raw, { enableCitations: true });
  }
}

