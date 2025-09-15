# Frontend Documentation: Teaching Analytics Chatbot

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Folder Structure](#folder-structure)
3. [Setup & Installation](#setup--installation)
4. [Environment Variables](#environment-variables)
5. [Running the Application](#running-the-application)
6. [Core Features](#core-features)
7. [Component Architecture](#component-architecture)
8. [API & Data Flow](#api--data-flow)
9. [Authentication](#authentication)
10. [File Management](#file-management)
11. [Analytics & Visualization](#analytics--visualization)
12. [Styling & UI](#styling--ui)
13. [Dependencies](#dependencies)
14. [Customization & Extending](#customization--extending)
15. [Deployment](#deployment)
16. [Troubleshooting & FAQ](#troubleshooting--faq)
17. [Contributing](#contributing)
18. [License](#license)

---

## Project Overview

This folder contains the **frontend** for the Teaching Analytics Chatbot platform. Built with [Next.js](https://nextjs.org/) (App Router), React 19, and Tailwind CSS, it provides a modern, responsive, and interactive dashboard for teachers to upload lesson data, chat with an AI assistant, and visualize teaching analytics. The frontend integrates with a backend API, Supabase (for file storage and metadata), and Firebase (for authentication).

---

## Folder Structure

```
frontend/
├── public/                # Static assets (icons, images)
├── scripts/               # Utility scripts (e.g., file migration)
├── src/
│   ├── app/               # Next.js app directory (routing, pages, layouts)
│   ├── components/        # Reusable React components (dashboard, charts, modals, forms, etc.)
│   ├── context/           # React context for user authentication state
│   ├── lib/               # API utilities, Supabase and Firebase clients
│   └── styles/            # Global CSS (Tailwind)
├── package.json           # Project dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.mjs     # PostCSS configuration
├── jsconfig.json          # JS/TS path aliases
├── README.md              # Basic Next.js usage info
└── ...
```

---

## Setup & Installation

### 1. Install Dependencies

From the `frontend` directory, run:

```bash
npm install
# or
yarn install
```

### 2. Environment Variables

Create a `.env.local` file in the `frontend` directory with the following variables (replace with your actual keys):

```
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_KEY=your_supabase_key
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

---

## Running the Application

### Development

```bash
npm run dev
# or
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

---

## Core Features

- **Authentication**: Google login via Firebase, with user state managed in `UserContext`.
- **Dashboard**: Overview of uploaded lessons, chat sessions, and analytics.
- **Chatbot**: Interactive chat with backend AI, supporting file-based context.
- **Analytics**: Visualizations (trends, word clouds, summaries) using Recharts and D3.
- **File Upload & Management**: Upload lesson files, view storage, and manage files via Supabase.
- **Responsive UI**: Built with Tailwind CSS and Radix UI for accessibility and modern design.

---

## Component Architecture

### App Directory (`src/app/`)
- `layout.js`: Root layout, applies global styles and wraps all pages in `UserProvider`.
- `page.js`: Redirects to `/login` by default.
- `login/page.js`: Login page with Google authentication.
- `dashboard/page.js`: Main dashboard, renders `Dashboard` component.
- `chatbot/page.js`: Chatbot interface, passes file context to `Chatbot`.
- `analytics/page.js`: (Reserved for analytics dashboard, can be extended.)

### Components (`src/components/`)
- **Dashboard & Navigation**
  - `Dashboard.jsx`: Main dashboard, summary cards, charts, file table, upload form.
  - `TopNav.jsx`: Navigation bar with user info and logout.
  - `SummaryCard.jsx`: Displays summary statistics (subjects, lessons, chat sessions).
- **Chat & Analytics**
  - `Chatbot.jsx`: Chat interface with streaming responses and file context.
  - `TrendChart.jsx`: Visualizes teaching area trends across lessons.
  - `WordCloudSection.jsx`: Word cloud visualization of teaching style.
  - `GraphRenderer.jsx`: Renders various analytics charts.
- **File Management**
  - `ClassFileTable.jsx`: Table of uploaded lessons, with selection and chat integration.
  - `DataUploadForm.jsx` & `FileUploadModal.jsx`: File upload workflow.
  - `StorageFilesModal.jsx`: Modal for browsing and managing stored files.
- **Modals & Utilities**
  - `Modal.jsx`: Generic modal for displaying content.
  - `ChatHistoryModal.jsx`: Modal for viewing past chat sessions.
- **Authentication**
  - `LoginForm.jsx`: Google authentication form.
- **Other**
  - `DirectFileUpload.jsx`: (Reserved for direct file upload, currently empty.)

### Context (`src/context/`)
- `UserContext.jsx`: Provides user authentication state and persistence via localStorage.

### Lib (`src/lib/`)
- `api.js`: API calls to backend and Supabase.
- `api-config.js`: Backend API base URL.
- `supabaseClient.js`: Supabase client setup.
- `firebase.js`: Firebase app initialization.

---

## API & Data Flow

- **Backend API**: All API calls are routed via `src/lib/api.js`, using the `NEXT_PUBLIC_BACKEND_API_URL` environment variable. Endpoints include chat, file summaries, and more.
- **Supabase**: Used for file storage and metadata. The app interacts with Supabase tables such as `users` and `files`.
- **Firebase**: Used for authentication. Google sign-in is implemented via Firebase Auth.

---

## Authentication

- **Google Login**: Users authenticate via Google using Firebase Auth. Only allowed users (checked via `/api/check-user`) can access the dashboard.
- **User State**: Managed globally via `UserContext`, persisted in localStorage for session continuity.
- **Logout**: Handled via Firebase Auth and context reset.

---

## File Management

- **Upload**: Teachers can upload lesson files (audio, transcripts) via `DataUploadForm` and `FileUploadModal`. Files are stored in Supabase Storage.
- **Organization**: Files are organized by subject, class, and date. Naming conventions are enforced for clarity.
- **Storage Browser**: `StorageFilesModal` allows users to browse, download, and manage their uploaded files.

---

## Analytics & Visualization

- **TrendChart**: Visualizes teaching area statistics (e.g., interaction, questioning) across lessons. Supports line, grouped bar, and total distribution views.
- **WordCloudSection**: Displays a word cloud of teaching style keywords.
- **GraphRenderer & Modal**: Render detailed analytics and allow exporting charts as images or PDFs.
- **Summary Cards**: Show quick stats on subjects, lessons, and chat sessions.

---

## Styling & UI

- **Tailwind CSS**: Utility-first CSS framework for rapid UI development. Configured in `tailwind.config.js`.
- **Radix UI**: Accessible UI primitives for dialogs, tooltips, progress bars, etc.
- **Lucide React & React Icons**: Icon libraries for consistent, modern icons.
- **Responsive Design**: All components are mobile-friendly and adapt to various screen sizes.

---

## Dependencies

### Main
- `next` (App Router)
- `react`, `react-dom`
- `tailwindcss`
- `@supabase/supabase-js`
- `firebase`
- `recharts`, `react-d3-cloud`
- `styled-components`
- `@radix-ui/react-*` (UI primitives)
- `lucide-react`, `react-icons`
- `html-to-image`, `jspdf` (exporting charts)

### Dev
- `eslint`, `eslint-config-next`
- `@tailwindcss/postcss`

---

## Customization & Extending

- **Pages**: Add new routes in `src/app/` (e.g., analytics, settings).
- **Components**: Add or modify UI in `src/components/`.
- **API**: Update endpoints in `src/lib/api.js` and environment variables as needed.
- **Styling**: Edit `src/styles/global.css` and Tailwind config.
- **Authentication**: Extend `UserContext` for roles, permissions, or additional providers.

---

## Deployment

- The app is ready for deployment on [Vercel](https://vercel.com/) or any platform supporting Next.js.
- For Vercel, push your repo and connect it via the dashboard. Environment variables must be set in the Vercel project settings.
- For other platforms, build with `npm run build` and serve with `npm start`.

---

## Troubleshooting & FAQ

**Q: The app can't connect to the backend or Supabase.**
- Check your `.env.local` variables and ensure the backend and Supabase are running and accessible.

**Q: Google login fails.**
- Ensure Firebase credentials are correct and the Google provider is enabled in your Firebase project.

**Q: File uploads fail.**
- Check Supabase storage rules and ensure your API keys are correct.

**Q: Styling looks broken.**
- Make sure Tailwind CSS is installed and configured. Try restarting the dev server.

---

## Contributing

1. Fork the repository and create a new branch.
2. Make your changes, following the existing code style and structure.
3. Test your changes locally.
4. Submit a pull request with a clear description of your changes.

---

## License

This project is licensed under the MIT License. See the root `LICENSE` file for details.

---

## Additional Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com/primitives/docs/overview/getting-started)

---

For further questions or support, please contact the project maintainer or open an issue in the repository.
