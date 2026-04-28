# Inspectors Management

Exam and certificate management system.

## Structure

- `BE`: Node.js, Express.js, TypeScript, MySQL
- `FE`: Angular 17, NgModule architecture, Angular Material

## Backend

```bash
cd BE
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Default API URL: `http://localhost:3000/api`

### Backend API

Auth:

- `POST /api/auth/bootstrap-admin`
- `POST /api/auth/login`
- `GET /api/auth/me`

Core:

- `GET /api/users`
- `POST /api/users`
- `GET /api/roles`
- `GET /api/exams`
- `POST /api/exams`
- `GET /api/exams/:id`
- `POST /api/exams/:id/questions`
- `GET /api/exams/:id/take`
- `POST /api/exams/:id/submit`
- `GET /api/attempts/:id/review`
- `GET /api/attempts/:id/pdf`
- `GET /api/certificates`
- `POST /api/certificates`
- `POST /api/exams/:examId/certificates`
- `GET /api/employee-certificates`
- `POST /api/files`

Local bootstrap admin created during setup:

```text
username: admin
password: Admin@123456
```

## Frontend

```bash
cd FE
npm install
npm start
```

Default app URL: `http://localhost:4200`
