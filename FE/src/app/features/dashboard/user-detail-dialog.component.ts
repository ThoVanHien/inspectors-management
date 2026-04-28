import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';

type CertificateStatus = 'Complete' | 'Warning' | 'Urgent';

export interface EmployeeCertificateRow {
  no: number;
  idUser: string;
  name: string;
  team: string;
  part: string;
  lastCertificate: Date;
  nextCertificateDate: Date;
  status: CertificateStatus;
  remainingDate: number;
}

export interface ExamCertificateResult {
  examCode: string;
  examName: string;
  examDate: Date;
  score: number;
  result: 'Passed' | 'Failed';
  certificateCode: string;
  certificateName: string;
  issuedDate: Date | null;
  certificateStatus: 'Active' | 'Expired' | 'Pending';
  examPdfName?: string;
  certificatePdfName?: string;
}

interface UserDetailDialogData {
  employee: EmployeeCertificateRow;
  results: ExamCertificateResult[];
}

@Component({
  selector: 'app-user-detail-dialog',
  templateUrl: './user-detail-dialog.component.html',
  styleUrl: './user-detail-dialog.component.scss'
})
export class UserDetailDialogComponent {
  readonly pageSizeOptions = [5, 10, 20, 50];
  pageIndex = 0;
  pageSize = 5;

  resultColumns = [
    'examCode',
    'examName',
    'examDate',
    'score',
    'result',
    'certificateCode',
    'certificateName',
    'issuedDate',
    'certificateStatus',
    'examFile',
    'certificateFile',
    'actions'
  ];
  editingResult: ExamCertificateResult | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: UserDetailDialogData,
    private readonly dialogRef: MatDialogRef<UserDetailDialogComponent>
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  getStatusClass(status: string): string {
    return status.toLowerCase();
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-CA').format(date);
  }

  formatRemainingDate(days: number): string {
    if (days < 0) {
      return `${Math.abs(days)} days overdue`;
    }

    return `${days} days`;
  }

  editResult(result: ExamCertificateResult): void {
    this.editingResult = result;
  }

  deleteResult(result: ExamCertificateResult): void {
    const shouldDelete = window.confirm(
      `Delete exam result "${result.examCode} - ${result.examName}"?`
    );

    if (!shouldDelete) {
      return;
    }

    const targetIndex = this.data.results.indexOf(result);

    if (targetIndex < 0) {
      return;
    }

    this.data.results.splice(targetIndex, 1);

    if (this.editingResult === result) {
      this.finishEdit();
    }

    const maxPageIndex = Math.max(Math.ceil(this.data.results.length / this.pageSize) - 1, 0);
    if (this.pageIndex > maxPageIndex) {
      this.pageIndex = maxPageIndex;
    }
  }

  finishEdit(): void {
    this.editingResult = null;
  }

  isEditing(result: ExamCertificateResult): boolean {
    return this.editingResult === result;
  }

  get pagedResults(): ExamCertificateResult[] {
    const start = this.pageIndex * this.pageSize;
    return this.data.results.slice(start, start + this.pageSize);
  }

  onResultPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.finishEdit();
  }

  toDateInputValue(date: Date): string {
    return new Intl.DateTimeFormat('en-CA').format(date);
  }

  updateExamDate(result: ExamCertificateResult, value: string): void {
    if (!value) {
      return;
    }

    result.examDate = new Date(value);
  }

  uploadPdf(result: ExamCertificateResult, type: 'exam' | 'certificate', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (type === 'exam') {
      result.examPdfName = file.name;
    } else {
      result.certificatePdfName = file.name;
    }

    input.value = '';
  }
}
