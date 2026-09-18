import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfidenceScores } from '../../models/rag.models';

@Component({
  selector: 'app-confidence-gauge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gauge-card glass-panel">
      <div class="gauge-header">
        <div class="gauge-title-box">
          <div>
            <h3 class="gauge-title">Grounding & Confidence</h3>
            <p class="gauge-subtitle">Multivariate Evidence Metric</p>
          </div>
        </div>
        <span class="status-chip" [ngClass]="getScoreColorClass(scores?.composite || 0)">
          {{ getScoreStatusText(scores?.composite || 0) }}
        </span>
      </div>

      <!-- Main Radial Meter -->
      <div class="meter-wrapper">
        <div class="radial-gauge">
          <svg viewBox="0 0 100 100" class="gauge-svg">
            <defs>
              <linearGradient id="gaugeGradEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#059669" />
              </linearGradient>
              <linearGradient id="gaugeGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#d97706" />
              </linearGradient>
              <linearGradient id="gaugeGradRose" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fb7185" />
                <stop offset="100%" stop-color="#e11d48" />
              </linearGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle cx="50" cy="50" r="42" class="gauge-bg"></circle>
            <circle
              cx="50"
              cy="50"
              r="42"
              class="gauge-progress"
              [style.strokeDashoffset]="getDashOffset(scores?.composite || 0)"
              [attr.stroke]="getStrokeGradient(scores?.composite || 0)"
              filter="url(#glowFilter)"
            ></circle>
          </svg>
          <div class="gauge-value-box">
            <span class="gauge-percentage">{{ ((scores?.composite || 0) * 100) | number:'1.0-0' }}%</span>
            <span class="gauge-sublabel">Composite</span>
          </div>
        </div>

        <div class="gauge-info-panel">
          <div class="score-level-badge">
            <span class="level-indicator" [style.background]="getScoreColor(scores?.composite || 0)"></span>
            <span class="level-text">{{ getScoreVerdict(scores?.composite || 0) }}</span>
          </div>
          <p class="score-summary-desc">
            Harmonic alignment of dense vector proximity, BM25 exact matching, and LLM-as-a-judge claim entailment.
          </p>
        </div>
      </div>

      <!-- Metric Breakdown Bars -->
      <div class="breakdown-list">
        <div class="metric-row">
          <div class="metric-info">
            <span class="metric-name">
              <span class="metric-dot cyan-dot"></span>
              Retrieval Relevance (40%)
            </span>
            <span class="metric-val cyan-val">{{ ((scores?.retrieval_relevance || 0) * 100) | number:'1.0-0' }}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill cyan-fill" [style.width.%]="(scores?.retrieval_relevance || 0) * 100"></div>
          </div>
        </div>

        <div class="metric-row">
          <div class="metric-info">
            <span class="metric-name">
              <span class="metric-dot emerald-dot"></span>
              Citation Grounding (35%)
            </span>
            <span class="metric-val emerald-val">{{ ((scores?.citation_grounding || 0) * 100) | number:'1.0-0' }}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill emerald-fill" [style.width.%]="(scores?.citation_grounding || 0) * 100"></div>
          </div>
        </div>

        <div class="metric-row">
          <div class="metric-info">
            <span class="metric-name">
              <span class="metric-dot indigo-dot"></span>
              Answer Completeness (25%)
            </span>
            <span class="metric-val indigo-val">{{ ((scores?.answer_completeness || 0) * 100) | number:'1.0-0' }}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill indigo-fill" [style.width.%]="(scores?.answer_completeness || 0) * 100"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .gauge-card {
      padding: 1.6rem;
      border-radius: var(--radius-lg);
      background: var(--bg-glass-1);
      border: 1px solid var(--border-glass-subtle);
      box-shadow: var(--shadow-md);
    }

    .gauge-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.4rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-glass-subtle);
      gap: 0.5rem;
    }

    .gauge-title-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .gauge-icon { font-size: 1.25rem; }

    .gauge-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-pure);
    }

    .gauge-subtitle {
      font-size: 0.76rem;
      color: var(--text-2);
    }

    .status-chip {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      border-radius: var(--radius-full);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .status-chip.high {
      background: rgba(16, 185, 129, 0.15);
      color: #059669;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }
    html.dark .status-chip.high { color: #34d399; }

    .status-chip.medium {
      background: rgba(245, 158, 11, 0.15);
      color: #d97706;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }
    html.dark .status-chip.medium { color: #fbbf24; }

    .status-chip.low {
      background: rgba(244, 63, 94, 0.15);
      color: #e11d48;
      border: 1px solid rgba(244, 63, 94, 0.35);
    }
    html.dark .status-chip.low { color: #fb7185; }

    .meter-wrapper {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      margin-bottom: 1.6rem;
      padding: 0.85rem;
      background: var(--bg-inner-box);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-glass-subtle);
    }

    .radial-gauge {
      position: relative;
      width: 105px;
      height: 105px;
      flex-shrink: 0;
    }

    .gauge-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .gauge-bg {
      fill: none;
      stroke: var(--border-glass-medium);
      stroke-width: 9;
    }

    .gauge-progress {
      fill: none;
      stroke-width: 9;
      stroke-linecap: round;
      stroke-dasharray: 264;
      transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .gauge-value-box {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .gauge-percentage {
      font-size: 1.45rem;
      font-weight: 900;
      font-family: var(--font-display);
      color: var(--text-pure);
      line-height: 1;
    }

    .gauge-sublabel {
      font-size: 0.65rem;
      color: var(--text-2);
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-top: 0.2rem;
    }

    .gauge-info-panel {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .score-level-badge {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .level-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .level-text {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-pure);
    }

    .score-summary-desc {
      font-size: 0.74rem;
      color: var(--text-2);
      line-height: 1.45;
    }

    /* Breakdown List */
    .breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
    }

    .metric-row {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .metric-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.78rem;
    }

    .metric-name {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      color: var(--text-2);
      font-weight: 600;
    }

    .metric-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .cyan-dot { background: var(--neon-cyan); }
    .emerald-dot { background: var(--neon-emerald); }
    .indigo-dot { background: var(--neon-indigo); }

    .metric-val {
      font-weight: 700;
      font-family: var(--font-mono);
    }

    .cyan-val { color: #0284c7; }
    html.dark .cyan-val { color: #38bdf8; }

    .emerald-val { color: #059669; }
    html.dark .emerald-val { color: #34d399; }

    .indigo-val { color: #4f46e5; }
    html.dark .indigo-val { color: #818cf8; }

    .bar-track {
      height: 6px;
      background: var(--bg-inner-box);
      border: 1px solid var(--border-glass-subtle);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: var(--radius-full);
      transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .cyan-fill { background: linear-gradient(90deg, #06b6d4, #38bdf8); }
    .emerald-fill { background: linear-gradient(90deg, #059669, #34d399); }
    .indigo-fill { background: linear-gradient(90deg, #4f46e5, #818cf8); }

    @media (max-width: 680px) {
      .gauge-card {
        padding: 1.15rem 1rem;
      }

      .gauge-title {
        font-size: 1rem;
      }

      .meter-wrapper {
        padding: 0.75rem;
        gap: 0.85rem;
      }

      .radial-gauge {
        width: 85px;
        height: 85px;
      }

      .gauge-percentage {
        font-size: 1.2rem;
      }
    }

    @media (max-width: 480px) {
      .meter-wrapper {
        flex-direction: column;
        text-align: center;
        padding: 1rem 0.75rem;
      }

      .score-level-badge {
        justify-content: center;
      }
    }
  `]
})
export class ConfidenceGaugeComponent {
  @Input() scores: ConfidenceScores | null = null;

  getDashOffset(score: number): number {
    const circumference = 2 * Math.PI * 42; // ~263.89
    return circumference * (1 - score);
  }

  getStrokeGradient(score: number): string {
    if (score >= 0.70) return 'url(#gaugeGradEmerald)';
    if (score >= 0.50) return 'url(#gaugeGradAmber)';
    return 'url(#gaugeGradRose)';
  }

  getScoreColor(score: number): string {
    if (score >= 0.70) return '#10b981';
    if (score >= 0.50) return '#f59e0b';
    return '#f43f5e';
  }

  getScoreColorClass(score: number): string {
    if (score >= 0.70) return 'high';
    if (score >= 0.50) return 'medium';
    return 'low';
  }

  getScoreStatusText(score: number): string {
    if (score >= 0.70) return 'Verified Grounded';
    if (score >= 0.50) return 'Moderate Evidence';
    return 'Low Grounding';
  }

  getScoreVerdict(score: number): string {
    if (score >= 0.70) return 'High Reliability Factuality';
    if (score >= 0.50) return 'Partial Context Coverage';
    return 'Gated Below Confidence Threshold';
  }
}
