"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import firebaseApp from "../lib/firebase";
import { FaTimes } from "react-icons/fa";
import { useUser } from "../context/UserContext";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [show, setShow] = useState(true);
  const router = useRouter();
  const { setUser } = useUser();

  const handleGoogleLogin = async () => {
    setError("");
    const auth = getAuth(firebaseApp);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      // Check if user is allowed
      const res = await fetch("/api/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.allowed) {
        setUser({ email });
        router.push("/dashboard");
      } else {
        await signOut(auth);
        setError("You are not allowed to access this application.");
      }
    } catch (err) {
      setError("Google login failed. Please try again.");
    }
  };
  const handleMicrosoftLogin = async () => {
    setError("");
    const auth = getAuth(firebaseApp);
    const provider = new OAuthProvider("microsoft.com");
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      // Check if user is allowed
      const res = await fetch("/api/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.allowed) {
        setUser({ email });
        router.push("/dashboard");
      } else {
        await signOut(auth);
        setError("You are not allowed to access this application.");
      }
    } catch (err) {
      setError("Microsoft login failed. Please try again.");
    }
  };

  if (!show) return null;

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white dark:bg-gray-950 transition-colors duration-200">
      {/* Left Pane (Image & App Title) */}
      <div className="relative w-full md:w-2/3 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6">
        {/* Close Button (Mobile Only) */}
        <button
          aria-label="Close login"
          className="absolute top-3 right-3 md:hidden text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          onClick={() => setShow(false)}
        >
          <FaTimes size={22} />
        </button>

        <img
          src="https://mdbcdn.b-cdn.net/img/Photos/new-templates/bootstrap-login-form/draw2.webp"
          alt="Login illustration"
          className="w-full max-w-xs md:max-w-sm xl:max-w-md aspect-[4/3] object-contain mx-auto select-none"
        />

        <div className="mt-4 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
            Teaching Analytics Chatbot
          </h3>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 mt-2">
            Ask questions related to your past lessons.
          </p>
        </div>
      </div>

      {/* Right Pane (Login Area) */}
      <main className="w-full md:w-1/3 flex items-center justify-center p-6 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md space-y-6">
          <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            Teaching Analytics Dashboard
          </h3>
          <p className="text-gray-700 dark:text-gray-200 text-base md:text-lg leading-relaxed">
            Welcome to your personalized teaching insights dashboard. Sign in
            to:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 text-base md:text-lg space-y-2">
            <li>📊 View past lecture transcripts</li>
            <li>🤖 Interact with your lessons using AI Chatbot</li>
            <li>📈 Discover teaching insights and statistics</li>
          </ul>
          {error && (
            <div className="bg-red-100 text-red-800 rounded px-4 py-2 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={handleGoogleLogin}
            className="mt-4 w-full flex items-center justify-center bg-blue-600 hover:bg-blue-800 text-white font-semibold text-lg rounded-lg px-6 py-3 shadow-md transition hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50"
          >
            <svg className="w-7 h-7 mr-3" viewBox="0 0 48 48">
              <g>
                <path
                  fill="#4285F4"
                  d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C36.68 2.7 30.74 0 24 0 14.82 0 6.73 5.8 2.69 14.09l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"
                />
                <path
                  fill="#34A853"
                  d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.59C43.93 37.13 46.1 31.3 46.1 24.55z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.67 28.29c-1.13-3.36-1.13-6.97 0-10.33l-7.98-6.2C.7 15.27 0 19.51 0 24s.7 8.73 2.69 12.24l7.98-6.2z"
                />
                <path
                  fill="#EA4335"
                  d="M24 48c6.48 0 11.93-2.15 15.9-5.85l-7.19-5.59c-2.01 1.35-4.59 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.79l-7.98 6.2C6.73 42.2 14.82 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </g>
            </svg>
            Sign in with Google
          </button>
          {/* Microsoft Login */}
          <button
            onClick={handleMicrosoftLogin}
            className="mt-4 w-full flex items-center justify-center bg-gray-800 hover:bg-gray-900 text-white font-semibold text-lg rounded-lg px-6 py-3 shadow-md transition hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-gray-400 focus:ring-opacity-50"
          >
            <svg className="w-7 h-7 mr-3" viewBox="0 0 23 23">
              <rect x="1" y="1" width="9" height="9" fill="#f35325" />
              <rect x="13" y="1" width="9" height="9" fill="#81bc06" />
              <rect x="1" y="13" width="9" height="9" fill="#05a6f0" />
              <rect x="13" y="13" width="9" height="9" fill="#ffba08" />
            </svg>
            Sign in with Microsoft
          </button>
        </div>
      </main>
    </div>
  );
}
