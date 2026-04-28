import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ExamDraftData,
  ExamQuestionDraft,
  ExamStoreService,
  OptionKey
} from '../../core/exam-store.service';

@Component({
  selector: 'app-exam-editor',
  templateUrl: './exam-editor.component.html',
  styleUrl: './exam-editor.component.scss'
})
export class ExamEditorComponent {
  readonly optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
  editingExamId: string | null = null;

  exam: ExamDraftData = {
    code: '',
    name: '',
    description: '',
    durationMinutes: 60
  };

  questions: ExamQuestionDraft[] = [this.createQuestion(1)];
  savedPayload: string | null = null;

  constructor(
    private readonly examStore: ExamStoreService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    const examId = this.route.snapshot.paramMap.get('id');
    if (!examId) {
      return;
    }

    const record = this.examStore.getById(examId);
    if (!record) {
      return;
    }

    this.editingExamId = record.id;
    this.exam = record.exam;
    this.questions = record.questions.length > 0 ? record.questions : [this.createQuestion(1)];
  }

  addQuestion(): void {
    this.questions.push(this.createQuestion(this.questions.length + 1));
  }

  removeQuestion(index: number): void {
    if (this.questions.length === 1) {
      return;
    }

    this.questions.splice(index, 1);
    this.reorderQuestions();
  }

  onQuestionImageChange(question: ExamQuestionDraft, event: Event): void {
    this.onImageChange(event, (dataUrl, fileName) => {
      question.imageDataUrl = dataUrl;
      question.imageName = fileName;
    });
  }

  clearQuestionImage(question: ExamQuestionDraft): void {
    question.imageDataUrl = null;
    question.imageName = null;
  }

  onOptionImageChange(option: ExamQuestionDraft['options'][number], event: Event): void {
    this.onImageChange(event, (dataUrl, fileName) => {
      option.imageDataUrl = dataUrl;
      option.imageName = fileName;
    });
  }

  clearOptionImage(option: ExamQuestionDraft['options'][number]): void {
    option.imageDataUrl = null;
    option.imageName = null;
  }

  saveExam(): void {
    const payload = {
      exam: this.exam,
      questions: this.questions.map((question) => ({
        order: question.id,
        text: question.text,
        imageName: question.imageName,
        correctOption: question.correctOption,
        options: question.options.map((option) => ({
          key: option.key,
          text: option.text,
          imageName: option.imageName
        }))
      }))
    };

    this.savedPayload = JSON.stringify(payload, null, 2);
    this.examStore.upsert({
      id: this.editingExamId ?? undefined,
      exam: this.exam,
      questions: this.questions
    });

    this.router.navigate(['/exams']);
  }

  trackByQuestionId(_index: number, question: ExamQuestionDraft): number {
    return question.id;
  }

  private createQuestion(id: number): ExamQuestionDraft {
    return {
      id,
      text: '',
      imageDataUrl: null,
      imageName: null,
      correctOption: 'A',
      options: this.optionKeys.map((key) => ({
        key,
        text: '',
        imageDataUrl: null,
        imageName: null
      }))
    };
  }

  private reorderQuestions(): void {
    this.questions = this.questions.map((question, index) => ({
      ...question,
      id: index + 1
    }));
  }

  private onImageChange(event: Event, callback: (dataUrl: string, fileName: string) => void): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;

      if (typeof result === 'string') {
        callback(result, file.name);
      }
    };

    reader.readAsDataURL(file);
    input.value = '';
  }
}
