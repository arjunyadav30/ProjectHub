# ProjectHub — College Project Management System

Full-stack MERN app with three roles: Admin, Faculty, Student.

## Quick Start

### Backend
```bash
cd backend && npm install && npm run dev
```

### Frontend
```bash
cd frontend && npm install && npm run dev
```

## Environment Variables (backend/.env)
```
MONGODB_URI=mongodb+srv://user:Arjun_30@firstproject.n9k3th1.mongodb.net/ProjectManagement?retryWrites=true&w=majority
JWT_ACCESS_SECRET=college_pm_access_secret_key_2024_xyz
JWT_REFRESH_SECRET=college_pm_refresh_secret_key_2024_abc
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:5173
PORT=5000
NODE_ENV=development
```

## Seed First Admin
POST http://localhost:5000/api/auth/signup
{ "name": "Admin", "email": "admin@college.edu", "password": "admin123", "role": "admin" }

## Roles
- **Admin**: Manage students/faculty, events, teams, website
- **Faculty**: View assigned teams, give marks, review submissions
- **Student**: Register for events, form teams, Kanban, chat

## Tech Stack
- Frontend: React + Vite + Tailwind + Socket.io-client
- Backend: Node.js + Express + Socket.io
- DB: MongoDB Atlas + Mongoose
- Auth: JWT + bcryptjs
- Files: Cloudinary + Multer
- Email: Nodemailer

## New Project Board Features
- Advanced tasks: dependencies (`blocked_by`), recurring tasks, task templates (`template_key`), priorities, bulk updates
- Productivity: per-task time tracking (start/stop timer), workload view, sprint velocity analytics
- Collaboration: threaded task comments, `@mentions`, project audit timeline
- Reporting: KPI dashboard (completed/overdue/cycle-time), burndown and cumulative flow snapshots
- UX/API: global search (`teams/tasks/users`) and saved custom project views

## New API Endpoints
- `GET /api/projects/search/global?q=...`
- `GET /api/projects/teams/:id/board`
- `POST /api/projects/teams/:id/tasks`
- `PUT /api/projects/teams/:id/tasks/bulk`
- `POST /api/projects/teams/:id/tasks/:moduleId/comments`
- `POST /api/projects/teams/:id/tasks/:moduleId/timer/start`
- `POST /api/projects/teams/:id/tasks/:moduleId/timer/stop`
- `GET /api/projects/teams/:id/workload`
- `GET /api/projects/teams/:id/sprint-analytics`
- `GET /api/projects/teams/:id/dashboard`
- `POST /api/projects/teams/:id/saved-views`

## Tests
```bash
cd backend && npm test
```
