import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ExamEditorComponent } from './features/exams/exam-editor.component';
import { ExamListComponent } from './features/exams/exam-list.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'exams', component: ExamListComponent },
  { path: 'exams/new', component: ExamEditorComponent },
  { path: 'exams/:id/edit', component: ExamEditorComponent },
  { path: 'certificates', component: DashboardComponent },
  { path: 'uploads', component: DashboardComponent },
  { path: 'people', component: DashboardComponent },
  { path: '', component: DashboardComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
