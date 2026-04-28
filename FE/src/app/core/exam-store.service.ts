import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface ExamOptionDraft {
  key: OptionKey;
  text: string;
  imageDataUrl: string | null;
  imageName: string | null;
}

export interface ExamQuestionDraft {
  id: number;
  text: string;
  imageDataUrl: string | null;
  imageName: string | null;
  options: ExamOptionDraft[];
  correctOption: OptionKey;
}

export interface ExamDraftData {
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
}

export interface SavedExamRecord {
  id: string;
  exam: ExamDraftData;
  questions: ExamQuestionDraft[];
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ExamStoreService {
  private readonly storageKey = 'ims_saved_exam_records';
  private readonly recordsSubject = new BehaviorSubject<SavedExamRecord[]>(this.loadInitialRecords());

  readonly records$ = this.recordsSubject.asObservable();

  get records(): SavedExamRecord[] {
    return this.recordsSubject.value;
  }

  getById(id: string): SavedExamRecord | null {
    const found = this.records.find((record) => record.id === id);
    if (!found) {
      return null;
    }

    return this.clone(found);
  }

  upsert(input: { id?: string; exam: ExamDraftData; questions: ExamQuestionDraft[] }): string {
    const now = new Date().toISOString();
    const current = this.records;
    const nextRecord: SavedExamRecord = {
      id: input.id ?? `exam-${Date.now()}`,
      exam: this.clone(input.exam),
      questions: this.clone(input.questions),
      updatedAt: now
    };
    const index = current.findIndex((record) => record.id === nextRecord.id);

    let next: SavedExamRecord[];
    if (index >= 0) {
      next = [...current];
      next[index] = nextRecord;
    } else {
      next = [nextRecord, ...current];
    }

    this.recordsSubject.next(next);
    this.persist(next);

    return nextRecord.id;
  }

  delete(id: string): void {
    const next = this.records.filter((record) => record.id !== id);
    this.recordsSubject.next(next);
    this.persist(next);
  }

  private loadInitialRecords(): SavedExamRecord[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as SavedExamRecord[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed;
    } catch {
      return [];
    }
  }

  private persist(records: SavedExamRecord[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(records));
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
