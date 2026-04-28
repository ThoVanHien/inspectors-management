import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import {
  type EmployeeCertificateRow,
  type ExamCertificateResult,
  UserDetailDialogComponent
} from './user-detail-dialog.component';

type CertificateStatus = 'Complete' | 'Warning' | 'Urgent';

interface EmployeeCertificate {
  idUser: string;
  name: string;
  team: string;
  part: string;
  lastCertificate: Date;
}

interface NewEmployeeForm {
  idUser: string;
  name: string;
  team: string;
  part: string;
  lastCertificate: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  readonly pageSizeOptions = [5, 10, 20, 50];
  pageIndex = 0;
  pageSize = 10;
  isSelectMode = false;
  showAddUserForm = false;
  selectedUserIds = new Set<string>();

  filters = {
    keyword: '',
    team: 'All',
    part: 'All',
    status: 'All' as CertificateStatus | 'All'
  };

  private readonly today = new Date();
  private readonly employees: EmployeeCertificate[] = [
    {
      idUser: 'a.nguyen',
      name: 'Nguyễn Văn An',
      team: 'DA',
      part: 'Mobile SW',
      lastCertificate: new Date('2024-05-12')
    },
    {
      idUser: 'b.tran',
      name: 'Trần Thị Bích',
      team: 'VD',
      part: 'Embedded SW',
      lastCertificate: new Date('2024-04-29')
    },
    {
      idUser: 'c.le',
      name: 'Lê Minh Cường',
      team: 'DA',
      part: 'Mobile SW',
      lastCertificate: new Date('2024-03-18')
    },
    {
      idUser: 'd.pham',
      name: 'Phạm Hoàng Dũng',
      team: 'VD',
      part: 'System QA',
      lastCertificate: new Date('2025-01-08')
    },
    {
      idUser: 'h.vo',
      name: 'Võ Thanh Hiền',
      team: 'DA',
      part: 'Mobile SW',
      lastCertificate: new Date('2024-04-20')
    }
  ];

  newUserForm: NewEmployeeForm = this.createNewUserForm();

  queues = [
    { label: 'Offline paper scans', value: 7, progress: 64 },
    { label: 'Certificate PDFs', value: 12, progress: 78 },
    { label: 'Leader approvals', value: 4, progress: 36 }
  ];

  employeeCertificateRows: EmployeeCertificateRow[] = this.employees.map((employee, index) => {
    const nextCertificateDate = this.addYears(employee.lastCertificate, 2);
    const remainingDate = this.getRemainingDays(nextCertificateDate);

    return {
      ...employee,
      no: index + 1,
      nextCertificateDate,
      remainingDate,
      status: this.getCertificateStatus(remainingDate)
    };
  });

  private readonly baseDisplayedColumns = [
    'no',
    'idUser',
    'name',
    'team',
    'part',
    'nextCertificateDate',
    'lastCertificate',
    'status',
    'remainingDate'
  ];

  statuses: Array<CertificateStatus | 'All'> = ['All', 'Complete', 'Warning', 'Urgent'];

  activity = [
    'PART_LEADER uploaded paper exam scan for INS-102.',
    'EMPLOYEE passed Line Inspection Safety with 100 points.',
    'ADMIN issued certificate PDF for employee 123456.'
  ];

  constructor(private readonly dialog: MatDialog) {}

  get stats(): Array<{ label: string; value: number; delta: string; icon: string }> {
    return [
      {
        label: 'Total employees',
        value: this.employeeCertificateRows.length,
        delta: 'Visible to Super Admin',
        icon: 'groups'
      },
      {
        label: 'Complete',
        value: this.countByStatus('Complete'),
        delta: 'More than 30 days left',
        icon: 'verified'
      },
      {
        label: 'Warning',
        value: this.countByStatus('Warning'),
        delta: 'Due within 30 days',
        icon: 'warning'
      },
      {
        label: 'Urgent',
        value: this.countByStatus('Urgent'),
        delta: 'Overdue certificate',
        icon: 'priority_high'
      }
    ];
  }

  get displayedColumns(): string[] {
    if (this.isSelectMode) {
      return ['select', ...this.baseDisplayedColumns];
    }

    return this.baseDisplayedColumns;
  }

  get teams(): string[] {
    return ['All', ...new Set(this.employeeCertificateRows.map((row) => row.team))];
  }

  get parts(): string[] {
    return ['All', ...new Set(this.employeeCertificateRows.map((row) => row.part))];
  }

  get filteredEmployeeCertificateRows(): EmployeeCertificateRow[] {
    const normalizedKeyword = this.filters.keyword.trim().toLowerCase();

    return this.employeeCertificateRows.filter((row) => {
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        row.idUser.toLowerCase().includes(normalizedKeyword) ||
        row.name.toLowerCase().includes(normalizedKeyword);
      const matchesTeam = this.filters.team === 'All' || row.team === this.filters.team;
      const matchesPart = this.filters.part === 'All' || row.part === this.filters.part;
      const matchesStatus = this.filters.status === 'All' || row.status === this.filters.status;

      return matchesKeyword && matchesTeam && matchesPart && matchesStatus;
    });
  }

  get pagedEmployeeCertificateRows(): EmployeeCertificateRow[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredEmployeeCertificateRows.slice(start, start + this.pageSize);
  }

  get selectedCount(): number {
    return this.selectedUserIds.size;
  }

  get areAllVisibleSelected(): boolean {
    if (this.pagedEmployeeCertificateRows.length === 0) {
      return false;
    }

    return this.pagedEmployeeCertificateRows.every((row) => this.selectedUserIds.has(row.idUser));
  }

  selectEmployee(employee: EmployeeCertificateRow): void {
    if (this.isSelectMode) {
      this.toggleRowSelection(employee);
      return;
    }

    this.dialog.open(UserDetailDialogComponent, {
      width: 'min(1180px, calc(100vw - 32px))',
      maxWidth: '1180px',
      panelClass: 'user-detail-dialog',
      autoFocus: false,
      data: {
        employee,
        results: this.getResultsByUser(employee.idUser)
      }
    });
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

  clearFilters(): void {
    this.filters = {
      keyword: '',
      team: 'All',
      part: 'All',
      status: 'All'
    };
    this.pageIndex = 0;
  }

  onFilterChange(): void {
    this.pageIndex = 0;
  }

  onEmployeePageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  toggleAddUserForm(): void {
    this.showAddUserForm = !this.showAddUserForm;

    if (this.showAddUserForm) {
      this.newUserForm = this.createNewUserForm();
    }
  }

  addUser(): void {
    const idUser = this.newUserForm.idUser.trim();
    const name = this.newUserForm.name.trim();
    const team = this.newUserForm.team.trim();
    const part = this.newUserForm.part.trim();
    const lastCertificate = this.newUserForm.lastCertificate;

    if (!idUser || !name || !team || !part || !lastCertificate) {
      return;
    }

    const duplicate = this.employeeCertificateRows.some((row) => row.idUser.toLowerCase() === idUser.toLowerCase());
    if (duplicate) {
      return;
    }

    const parsedLastCertificate = new Date(lastCertificate);
    if (Number.isNaN(parsedLastCertificate.getTime())) {
      return;
    }

    const nextCertificateDate = this.addYears(parsedLastCertificate, 2);
    const remainingDate = this.getRemainingDays(nextCertificateDate);

    this.employeeCertificateRows = [
      ...this.employeeCertificateRows,
      {
        no: this.employeeCertificateRows.length + 1,
        idUser,
        name,
        team,
        part,
        lastCertificate: parsedLastCertificate,
        nextCertificateDate,
        remainingDate,
        status: this.getCertificateStatus(remainingDate)
      }
    ];

    this.refreshRowOrder();
    this.showAddUserForm = false;
    this.newUserForm = this.createNewUserForm();
    this.pageIndex = 0;
  }

  toggleSelectMode(): void {
    this.isSelectMode = !this.isSelectMode;
    this.selectedUserIds.clear();
  }

  onSelectAllChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;

    this.pagedEmployeeCertificateRows.forEach((row) => {
      if (checked) {
        this.selectedUserIds.add(row.idUser);
      } else {
        this.selectedUserIds.delete(row.idUser);
      }
    });
  }

  onRowCheckboxChange(row: EmployeeCertificateRow, event: Event): void {
    event.stopPropagation();
    this.toggleRowSelection(row);
  }

  deleteSelectedUsers(): void {
    if (this.selectedUserIds.size === 0) {
      return;
    }

    this.employeeCertificateRows = this.employeeCertificateRows.filter((row) => !this.selectedUserIds.has(row.idUser));
    this.selectedUserIds.clear();
    this.refreshRowOrder();
    this.normalizePageIndex();
  }

  exportExcel(): void {
    const header = [
      'No',
      'idUser',
      'Name',
      'Team',
      'Part',
      'Next Certificate Date',
      'Last Certificate',
      'Status',
      'Remaining Date'
    ];
    const rows = this.filteredEmployeeCertificateRows.map((row) => [
      row.no,
      row.idUser,
      row.name,
      row.team,
      row.part,
      this.formatDate(row.nextCertificateDate),
      this.formatDate(row.lastCertificate),
      row.status,
      this.formatRemainingDate(row.remainingDate)
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `employee-certificate-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private countByStatus(status: CertificateStatus): number {
    return this.employeeCertificateRows.filter((row) => row.status === status).length;
  }

  private addYears(date: Date, years: number): Date {
    const nextDate = new Date(date);
    nextDate.setFullYear(nextDate.getFullYear() + years);
    return nextDate;
  }

  private getRemainingDays(nextCertificateDate: Date): number {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const today = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    const target = new Date(
      nextCertificateDate.getFullYear(),
      nextCertificateDate.getMonth(),
      nextCertificateDate.getDate()
    );

    return Math.ceil((target.getTime() - today.getTime()) / millisecondsPerDay);
  }

  private getCertificateStatus(remainingDate: number): CertificateStatus {
    if (remainingDate < 0) {
      return 'Urgent';
    }

    if (remainingDate <= 30) {
      return 'Warning';
    }

    return 'Complete';
  }

  private createNewUserForm(): NewEmployeeForm {
    return {
      idUser: '',
      name: '',
      team: '',
      part: '',
      lastCertificate: new Intl.DateTimeFormat('en-CA').format(new Date())
    };
  }

  private toggleRowSelection(row: EmployeeCertificateRow): void {
    if (this.selectedUserIds.has(row.idUser)) {
      this.selectedUserIds.delete(row.idUser);
    } else {
      this.selectedUserIds.add(row.idUser);
    }
  }

  private refreshRowOrder(): void {
    this.employeeCertificateRows = this.employeeCertificateRows.map((row, index) => ({
      ...row,
      no: index + 1
    }));
  }

  private normalizePageIndex(): void {
    const totalRows = this.filteredEmployeeCertificateRows.length;
    const maxPageIndex = Math.max(Math.ceil(totalRows / this.pageSize) - 1, 0);
    if (this.pageIndex > maxPageIndex) {
      this.pageIndex = maxPageIndex;
    }
  }

  private getResultsByUser(idUser: string): ExamCertificateResult[] {
    const results: Record<string, ExamCertificateResult[]> = {
      'a.nguyen': [
        {
          examCode: 'MOB-201',
          examName: 'Mobile SW Inspector Basic',
          examDate: new Date('2024-05-12'),
          score: 100,
          result: 'Passed',
          certificateCode: 'CERT-MOB-201',
          certificateName: 'Mobile SW Inspection Certificate',
          issuedDate: new Date('2024-05-12'),
          certificateStatus: 'Active'
        },
        {
          examCode: 'SAFE-101',
          examName: 'Line Safety Awareness',
          examDate: new Date('2023-11-03'),
          score: 100,
          result: 'Passed',
          certificateCode: 'CERT-SAFE-101',
          certificateName: 'Safety Awareness Certificate',
          issuedDate: new Date('2023-11-03'),
          certificateStatus: 'Active'
        }
      ],
      'b.tran': [
        {
          examCode: 'EMB-104',
          examName: 'Embedded SW Inspection',
          examDate: new Date('2024-04-29'),
          score: 100,
          result: 'Passed',
          certificateCode: 'CERT-EMB-104',
          certificateName: 'Embedded SW Certificate',
          issuedDate: new Date('2024-04-29'),
          certificateStatus: 'Active'
        }
      ],
      'c.le': [
        {
          examCode: 'MOB-201',
          examName: 'Mobile SW Inspector Basic',
          examDate: new Date('2024-03-18'),
          score: 100,
          result: 'Passed',
          certificateCode: 'CERT-MOB-201',
          certificateName: 'Mobile SW Inspection Certificate',
          issuedDate: new Date('2024-03-18'),
          certificateStatus: 'Expired'
        }
      ],
      'd.pham': [
        {
          examCode: 'QA-330',
          examName: 'System QA Inspector',
          examDate: new Date('2025-01-08'),
          score: 100,
          result: 'Passed',
          certificateCode: 'CERT-QA-330',
          certificateName: 'System QA Certificate',
          issuedDate: new Date('2025-01-08'),
          certificateStatus: 'Active'
        }
      ],
      'h.vo': [
        {
          examCode: 'MOB-401',
          examName: 'Advanced Mobile SW Inspection',
          examDate: new Date('2024-04-20'),
          score: 100,
          result: 'Passed',
          certificateCode: 'CERT-MOB-401',
          certificateName: 'Advanced Mobile SW Certificate',
          issuedDate: new Date('2024-04-20'),
          certificateStatus: 'Active'
        },
        {
          examCode: 'DOC-210',
          examName: 'Inspection Document Control',
          examDate: new Date('2024-01-11'),
          score: 96,
          result: 'Failed',
          certificateCode: '-',
          certificateName: '-',
          issuedDate: null,
          certificateStatus: 'Pending'
        }
      ]
    };

    return results[idUser] ?? [];
  }
}
