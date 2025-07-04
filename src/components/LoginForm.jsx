'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import firebaseApp from '../lib/firebase';
import { FaTimes } from 'react-icons/fa';
import { useUser } from '../context/UserContext';

export default function LoginForm() {
  const [error, setError] = useState('');
  const [show, setShow] = useState(true);
  const router = useRouter();
  const { setUser } = useUser();

  const handleGoogleLogin = async () => {
    setError('');
    const auth = getAuth(firebaseApp);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      // Check if user is allowed
      const res = await fetch('/api/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.allowed) {
        setUser({ email });
        router.push('/dashboard');
      } else {
        await signOut(auth);
        setError('You are not allowed to access this application.');
      }
    } catch (err) {
      setError('Google login failed. Please try again.');
    }
  };

  if (!show) return null;

  return (
 
    <div className="min-h-screen w-full flex flex-col md:flex-row">
    {/* Left Pane */}
    <div className="w-full md:w-2/3 bg-gray-50 flex flex-col items-center justify-center p-6">
      <img
        src="https://mdbcdn.b-cdn.net/img/Photos/new-templates/bootstrap-login-form/draw2.webp"
        alt="Login illustration"
      />

      <div className="mt-6 text-center md:text-center">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
          Teaching Analytics Chatbot
        </h3>
        <p className="text-base sm:text-lg text-gray-600 mt-2">
          Ask questions related to your past lectures.
        </p>
      </div>
    </div>

    {/* Right Pane */}
    <main className="w-full md:w-1/3 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 md:space-y-8 text-center md:text-left">
        <h3 className="sm:text-4xl md:text-5xl font-extrabold text-dark">
          Teaching Analytics Dashboard
        </h3>

        <p className="text-gray-700 text-base sm:text-lg leading-relaxed">
          Welcome to your personalized teaching insights dashboard. Sign in to:
        </p>

        <ul className="list-disc list-inside text-gray-600 text-base sm:text-lg space-y-3">
          <li>📊 View past lecture transcripts</li>
          <li>🤖 Interact with your lectures using AI Chatbot</li>
          <li>📈 Discover teaching insights and statistics</li>
        </ul>

        <button
          onClick={handleGoogleLogin}
          className="mt-4 w-full sm:w-auto inline-flex items-center justify-center bg-blue-600 hover:bg-blue-800 text-white font-semibold text-lg rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
         <svg className="w-7 h-7 mr-4" viewBox="0 0 48 48">
        <g>
          <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C36.68 2.7 30.74 0 24 0 14.82 0 6.73 5.8 2.69 14.09l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/>
          <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.59C43.93 37.13 46.1 31.3 46.1 24.55z"/>
          <path fill="#FBBC05" d="M10.67 28.29c-1.13-3.36-1.13-6.97 0-10.33l-7.98-6.2C.7 15.27 0 19.51 0 24s.7 8.73 2.69 12.24l7.98-6.2z"/>
          <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.15 15.9-5.85l-7.19-5.59c-2.01 1.35-4.59 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.79l-7.98 6.2C6.73 42.2 14.82 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </g>
      </svg>
          Sign in with Google
        </button>
      </div>
    </main>
  </div>
  );
}