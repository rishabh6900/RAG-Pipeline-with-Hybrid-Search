import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import {
  QueryRequest,
  QueryResponse,
  ChunkingCompareResponse,
  SystemStatusResponse,
  DocumentsResponse
} from '../models/rag.models';

@Injectable({
  providedIn: 'root'
})
export class RagApiService {
  private readonly baseUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  askQuestion(request: QueryRequest): Observable<QueryResponse> {
    return this.http.post<QueryResponse>(`${this.baseUrl}/v1/ask`, request);
  }

  compareChunkingStrategies(request: QueryRequest): Observable<ChunkingCompareResponse> {
    return this.http.post<ChunkingCompareResponse>(`${this.baseUrl}/v1/chunking/compare`, request);
  }

  getSystemStatus(): Observable<SystemStatusResponse> {
    return this.http.get<SystemStatusResponse>(`${this.baseUrl}/healthz`).pipe(
      catchError(err => of({
        status: 'disconnected',
        total_chunks_dense: 0,
        total_chunks_sparse: 0,
        embedding_model: 'text-embedding-3-small',
        llm_model: 'gpt-4o',
        reranker_model: 'cross-encoder/ms-marco-MiniLM-L-6-v2'
      }))
    );
  }

  getDocuments(): Observable<DocumentsResponse> {
    return this.http.get<DocumentsResponse>(`${this.baseUrl}/v1/documents`).pipe(
      catchError(() => of({
        total_indexed_chunks_dense: 0,
        total_indexed_chunks_sparse: 0,
        raw_documents_count: 0,
        raw_documents: []
      }))
    );
  }

  ingestDocument(file: File, strategy: string = 'structure_aware'): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('strategy', strategy);
    return this.http.post(`${this.baseUrl}/v1/ingest`, formData);
  }

  syncRawDocuments(strategy: string = 'all'): Observable<any> {
    return this.http.post(`${this.baseUrl}/v1/ingest/sync-raw?strategy=${strategy}`, {});
  }
}
