import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:4000';

  constructor(private http: HttpClient) {}

  health(): Observable<any> { return this.http.get(`${this.base}/health`); }

  getGroups(): Observable<any[]> { return this.http.get<any[]>(`${this.base}/groups`); }

  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      }
    }
    return this.http.get<T>(`${this.base}${path}`, { params: httpParams });
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  /**
   * DELETE with optional JSON body, always returns the response body type T.
   * Usage: this.api.delete<{ ok: boolean }>(`/url`, { body: {...} })
   */
  delete<T>(
    path: string,
    options: { body?: any; params?: Record<string, any> } = {}
  ): Observable<T> {
    let httpParams = new HttpParams();
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      }
    }

    return this.http.request<T>('DELETE', `${this.base}${path}`, {
      body: options.body,
      params: httpParams,
      // 👇 Forces Observable<T> (body), prevents HttpEvent inference
      observe: 'body'
    });
  }
}


