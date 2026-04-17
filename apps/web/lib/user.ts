'use client';

import { useState, useEffect } from 'react';

export function useUserId(): [string, (id: string) => void] {
  const [userId, setUserIdState] = useState('anonymous');

  useEffect(() => {
    const stored = localStorage.getItem('lmk_user_id');
    if (stored) setUserIdState(stored);
  }, []);

  function setUserId(id: string) {
    localStorage.setItem('lmk_user_id', id);
    setUserIdState(id);
  }

  return [userId, setUserId];
}
