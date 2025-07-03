'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext({
  user: null,
  setUser: () => {},
});

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // Wait until mounted before accessing localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user, hasMounted]);

  if (!hasMounted) return null; // Prevent mismatch

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
