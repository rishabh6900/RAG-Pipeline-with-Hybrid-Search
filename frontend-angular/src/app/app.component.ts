import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from './components/header/header.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { AnswerViewComponent } from './components/answer-view/answer-view.component';
import { ConfidenceGaugeComponent } from './components/confidence-gauge/confidence-gauge.component';
import { CitationDrawerComponent } from './components/citation-drawer/citation-drawer.component';
import { StrategyCompareComponent } from './components/strategy-compare/strategy-compare.component';
import { DocumentIngestComponent } from './components/document-ingest/document-ingest.component';
import { RagApiService } from './services/rag-api.service';
import {
  QueryRequest,
  QueryResponse,
  ChunkingCompareResponse,
  SystemStatusResponse,
  DocumentsResponse
} from './models/rag.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    HeaderComponent,
    SearchBarComponent,
    AnswerViewComponent,
    ConfidenceGaugeComponent,
    CitationDrawerComponent,
    StrategyCompareComponent,
    DocumentIngestComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Enterprise Hybrid RAG';
  
  systemStatus: SystemStatusResponse | null = null;
  documentsData: DocumentsResponse | null = null;
  queryResponse: QueryResponse | null = null;
  comparisonData: ChunkingCompareResponse | null = null;

  isLoading = false;
  isComparing = false;
  isUploading = false;
  isDrawerOpen = false;
  activeMainTab: 'query' | 'ablation' | 'corpus' = 'query';

  constructor(private ragApi: RagApiService) {}

  ngOnInit(): void {
    this.fetchSystemStatus();
    this.fetchDocuments();
  }

  fetchSystemStatus(): void {
    this.ragApi.getSystemStatus().subscribe(status => {
      this.systemStatus = status;
    });
  }

  fetchDocuments(): void {
    this.ragApi.getDocuments().subscribe(docs => {
      this.documentsData = docs;
    });
  }

  onQuerySubmit(request: QueryRequest): void {
    this.isLoading = true;
    this.ragApi.askQuestion(request).subscribe({
      next: (res) => {
        this.queryResponse = res;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Query failed:', err);
        this.isLoading = false;
      }
    });
  }

  runStrategyComparison(request: QueryRequest): void {
    this.isComparing = true;
    this.activeMainTab = 'ablation';
    this.ragApi.compareChunkingStrategies(request).subscribe({
      next: (res) => {
        this.comparisonData = res;
        this.isComparing = false;
      },
      error: (err) => {
        console.error('Comparison failed:', err);
        this.isComparing = false;
      }
    });
  }

  onDocumentIngest(event: { file: File; strategy: string }): void {
    this.isUploading = true;
    this.ragApi.ingestDocument(event.file, event.strategy).subscribe({
      next: () => {
        this.isUploading = false;
        this.fetchDocuments();
        this.fetchSystemStatus();
      },
      error: (err) => {
        console.error('Ingest failed:', err);
        this.isUploading = false;
      }
    });
  }

  onSyncRawDocuments(strategy: string): void {
    this.isUploading = true;
    this.ragApi.syncRawDocuments(strategy).subscribe({
      next: () => {
        this.isUploading = false;
        this.fetchDocuments();
        this.fetchSystemStatus();
      },
      error: (err) => {
        console.error('Sync failed:', err);
        this.isUploading = false;
      }
    });
  }
}
