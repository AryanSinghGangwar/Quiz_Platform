'use client';

// Registration Page
// Collects participant info and checks for existing attempts

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegisterRequest, RegisterResponse } from '@/types';

export default function RegistrationPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterRequest>({
    name: '',
    class: '',
    school: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/quiz/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

if (!response.ok) {
  setError(data.error || 'Registration failed');
  setLoading(false);
  return;
}

      // Store participant ID in localStorage
      localStorage.setItem('participantId', data.participant.id);
      
      if (data.hasActiveAttempt && data.attemptId) {
        localStorage.setItem('attemptId', data.attemptId);
      }

      // Navigate to quiz page
      router.push('/quiz');
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
          Quiz Competition
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          Enter your details to start the quiz
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <input
              type="text"
              required
              value={formData.class}
              onChange={(e) => setFormData({ ...formData, class: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 10th Grade"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School
            </label>
            <input
              type="text"
              required
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your school name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="10-digit phone number"
              pattern="[0-9]{10}"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter 10 digits without spaces or dashes
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processing...' : 'Start Quiz'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-medium text-gray-800 mb-2">Quiz Rules:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Duration: 2 hours</li>
            <li>• Timer continues even if you refresh</li>
            <li>• Stay in fullscreen mode</li>
            <li>• Auto-submit when time ends</li>
            <li>• You can resume if disconnected</li>
          </ul>
        </div>
      </div>
    </div>
  );
}