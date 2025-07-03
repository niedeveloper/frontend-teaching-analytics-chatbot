'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import firebaseApp from '../lib/firebase';
import styled from 'styled-components';
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
    <Overlay>
      <Card>
        <Title>Login for Teaching Analytics Dashboard</Title>
        <Description>
          Welcome to the Teaching Analytics Dashboard!
          <ul>
            <li>View your past lecture transcripts in Excel files</li>
            <li>Choose files and ask questions related to your lectures</li>
            <li>See statistics and insights about your teaching style</li>
          </ul>
        </Description>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Row>
          <CustomButton type="button" onClick={handleGoogleLogin}>
            <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48" style={{ marginRight: '12px' }}><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C36.68 2.7 30.74 0 24 0 14.82 0 6.73 5.8 2.69 14.09l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.59C43.93 37.13 46.1 31.3 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.29c-1.13-3.36-1.13-6.97 0-10.33l-7.98-6.2C.7 15.27 0 19.51 0 24s.7 8.73 2.69 12.24l7.98-6.2z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.15 15.9-5.85l-7.19-5.59c-2.01 1.35-4.59 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.79l-7.98 6.2C6.73 42.2 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
            Sign in with Google
          </CustomButton>
        </Row>
      </Card>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(30, 64, 175, 0.10);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
`;

const Card = styled.div`
  position: relative;
  background: #fff;
  border-radius: 1.2rem;
  box-shadow: 0 8px 32px rgba(30, 64, 175, 0.15);
  padding: 5rem 3rem 3rem 3rem;
  max-width: 36rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CloseIconContainer = styled.div`
  position: absolute;
  right: 2rem;
  top: 2rem;
  cursor: pointer;
  color: #64748b;
  font-size: 2rem;
  transition: color 0.2s;
  &:hover { color: #1e40af; }
`;

const Title = styled.h1`
  font-size: 2.2rem;
  font-weight: 800;
  text-align: center;
  color: #1e40af;
  margin-bottom: 1.2rem;
`;

const Description = styled.div`
  color: #334155;
  font-size: 1.1rem;
  text-align: center;
  margin-bottom: 2rem;
  ul {
    margin: 1rem 0 0 0;
    padding: 0;
    list-style: disc inside;
    text-align: left;
  }
  li {
    margin-bottom: 0.5rem;
  }
`;

const ErrorMessage = styled.p`
  color: #ef4444;
  font-size: 1rem;
  margin: 1rem 0;
  text-align: center;
`;

const Row = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 2rem;
`;

const CustomButton = styled.button`
  background: #2563eb;
  color: #fff;
  font-weight: 600;
  font-size: 1.1rem;
  border: none;
  border-radius: 0.5rem;
  padding: 1rem 2.2rem;
  box-shadow: 0 2px 8px rgba(30, 64, 175, 0.10);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background 0.2s;
  &:hover {
    background: #1e40af;
  }
`;