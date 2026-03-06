import {
  Calculator,
  Globe,
  FlaskConical,
  BookOpen,
} from 'lucide-react';
import React from 'react';
import { backend } from '../../../wailsjs/go/models';

// Use the generated models from the backend
export type Class = backend.CourseClass;
export type ClasslistEntry = backend.ClasslistEntry;
export type Attendance = backend.Attendance;
export type ClassStudent = backend.ClassStudent;
export type User = backend.User;
export type Subject = backend.Subject;

// Helper function to get subject icon and color
export function getSubjectIconAndColor(subjectCode: string, subjectName: string) {
  const code = subjectCode.toLowerCase();
  const name = subjectName.toLowerCase();

  if (code.includes('math') || name.includes('math')) {
    return {
      icon: React.createElement(Calculator, { className: 'h-6 w-6' }),
      headerColor: 'bg-blue-600',
      iconColor: 'text-blue-200'
    };
  }
  if (code.includes('hist') || name.includes('history') || name.includes('civics')) {
    return {
      icon: React.createElement(Globe, { className: 'h-6 w-6' }),
      headerColor: 'bg-green-600',
      iconColor: 'text-green-200'
    };
  }
  if (code.includes('sci') || name.includes('science') || name.includes('lab')) {
    return {
      icon: React.createElement(FlaskConical, { className: 'h-6 w-6' }),
      headerColor: 'bg-green-600',
      iconColor: 'text-green-200'
    };
  }
  if (code.includes('eng') || name.includes('english') || name.includes('literature')) {
    return {
      icon: React.createElement(BookOpen, { className: 'h-6 w-6' }),
      headerColor: 'bg-purple-600',
      iconColor: 'text-purple-200'
    };
  }
  // Default
  return {
    icon: null,
    headerColor: 'bg-indigo-600',
    iconColor: 'text-indigo-200'
  };
}
