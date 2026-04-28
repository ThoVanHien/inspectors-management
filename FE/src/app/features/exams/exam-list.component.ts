import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { ExamStoreService, SavedExamRecord } from '../../core/exam-store.service';

@Component({
  selector: 'app-exam-list',
  templateUrl: './exam-list.component.html',
  styleUrl: './exam-list.component.scss'
})
export class ExamListComponent {
  readonly displayedColumns = ['code', 'name', 'duration', 'questionCount', 'updatedAt', 'actions'];
  readonly exams$: Observable<SavedExamRecord[]>;

  constructor(private readonly examStore: ExamStoreService) {
    this.exams$ = this.examStore.records$;
  }

  formatDate(isoDate: string): string {
    return new Intl.DateTimeFormat('en-CA').format(new Date(isoDate));
  }

  deleteExam(record: SavedExamRecord): void {
    const shouldDelete = window.confirm(`Delete exam "${record.exam.code} - ${record.exam.name}"?`);
    if (!shouldDelete) {
      return;
    }

    this.examStore.delete(record.id);
  }
}
