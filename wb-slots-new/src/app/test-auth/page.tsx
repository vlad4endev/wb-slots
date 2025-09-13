'use client';

import { useState, useEffect } from 'react';

export default function TestAuthPage() {
  const [cookies, setCookies] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Получаем cookies
    setCookies(document.cookie);
    
    // Проверяем авторизацию
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        console.log('Auth check response:', data);
        setUser(data.data?.user || null);
        setLoading(false);
      })
      .catch(err => {
        console.error('Auth check error:', err);
        setLoading(false);
      });
  }, []);

  const testLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });

      const data = await response.json();
      console.log('Login test response:', data);
      
      if (data.success) {
        // Обновляем cookies
        setCookies(document.cookie);
        // Перезагружаем страницу
        window.location.reload();
      }
    } catch (error) {
      console.error('Login test error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Тест авторизации</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Cookies</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {cookies || 'Нет cookies'}
            </pre>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Пользователь</h2>
            {loading ? (
              <p>Загрузка...</p>
            ) : user ? (
              <pre className="bg-gray-100 p-4 rounded text-sm">
                {JSON.stringify(user, null, 2)}
              </pre>
            ) : (
              <p className="text-red-500">Не авторизован</p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={testLogin}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Тест логина
          </button>
        </div>
      </div>
    </div>
  );
}

