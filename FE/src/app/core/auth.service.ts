import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: number;
    employeeId: string;
    employeeNo: string | null;
    username: string;
    email: string | null;
    fullName: string | null;
    partCode: string | null;
    roles: string[];
  };
}

const TOKEN_KEY = 'inspector-management-token';
const USER_KEY = 'inspector-management-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = 'http://localhost:3000/api';

  constructor(private readonly http: HttpClient) {}

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, payload).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      })
    );
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }
}
