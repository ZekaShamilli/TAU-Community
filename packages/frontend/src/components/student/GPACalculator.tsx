import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { useNavigate } from 'react-router-dom';

interface Course {
  id: string;
  name: string;
  credits: number;
  grade: string;
}

type GradingSystem = 'AA/BA/BB' | 'A1/A2/A3' | 'A+/A/A-' | 'AA/BA+/BA';

const gradingSystems: { [key in GradingSystem]: { [grade: string]: number } } = {
  'AA/BA/BB': {
    'AA': 4.0,
    'BA': 3.5,
    'BB': 3.0,
    'CB': 2.5,
    'CC': 2.0,
    'DC': 1.5,
    'DD': 1.0,
    'FD': 0.5,
    'FF': 0.0,
  },
  'A1/A2/A3': {
    'A1': 4.0,
    'A2': 3.7,
    'B1': 3.3,
    'B2': 3.0,
    'B3': 2.7,
    'C1': 2.3,
    'C2': 2.0,
    'C3': 1.7,
    'D': 1.0,
    'F': 0.0,
  },
  'A+/A/A-': {
    'A+': 4.0,
    'A': 4.0,
    'A-': 3.7,
    'B+': 3.3,
    'B': 3.0,
    'B-': 2.7,
    'C+': 2.3,
    'C': 2.0,
    'C-': 1.7,
    'D+': 1.3,
    'D': 1.0,
    'F': 0.0,
  },
  'AA/BA+/BA': {
    'AA': 4.0,
    'BA+': 3.75,
    'BA': 3.5,
    'BB+': 3.25,
    'BB': 3.0,
    'CB+': 2.75,
    'CB': 2.5,
    'CC+': 2.25,
    'CC': 2.0,
    'DC+': 1.75,
    'DC': 1.5,
    'DD+': 1.25,
    'DD': 1.0,
    'F': 0.0,
    'P': 0.0,
  },
};

const GPACalculator: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [gradingSystem, setGradingSystem] = useState<GradingSystem>('AA/BA/BB');
  const [courses, setCourses] = useState<Course[]>([
    { id: '1', name: '', credits: 3, grade: Object.keys(gradingSystems['AA/BA/BB'])[0] },
  ]);
  const [calculatedGPA, setCalculatedGPA] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [previousCGPA, setPreviousCGPA] = useState<string>('');
  const [previousCredits, setPreviousCredits] = useState<string>('');
  const [newCGPA, setNewCGPA] = useState<number | null>(null);

  const gradePoints = gradingSystems[gradingSystem];

  const updateGPAMutation = useMutation({
    mutationFn: (gpa: number) => userService.updateGPA(user!.id, gpa),
    onSuccess: () => {
      setSaveMessage(t('gpa.savedSuccess', 'GPA saved to your profile!'));
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      setTimeout(() => setSaveMessage(''), 3000);
    },
    onError: () => {
      setSaveMessage(t('gpa.savedError', 'Failed to save GPA'));
    },
  });

  const addCourse = () => {
    setCourses([
      ...courses,
      { id: Date.now().toString(), name: '', credits: 3, grade: Object.keys(gradePoints)[0] },
    ]);
  };

  const removeCourse = (id: string) => {
    if (courses.length > 1) {
      setCourses(courses.filter((c) => c.id !== id));
    }
  };

  const updateCourse = (id: string, field: keyof Course, value: string | number) => {
    setCourses(
      courses.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleGradingSystemChange = (newSystem: GradingSystem) => {
    setGradingSystem(newSystem);
    // Reset courses with first grade of new system
    const firstGrade = Object.keys(gradingSystems[newSystem])[0];
    setCourses(courses.map(c => ({ ...c, grade: firstGrade })));
    setCalculatedGPA(null);
  };

  const calculateGPA = () => {
    let totalPoints = 0;
    let totalCredits = 0;

    courses.forEach((course) => {
      if (course.credits > 0 && course.grade) {
        const points = gradePoints[course.grade] || 0;
        totalPoints += points * course.credits;
        totalCredits += course.credits;
      }
    });

    const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
    setCalculatedGPA(gpa);

    // Calculate new CGPA if previous CGPA and credits are provided
    if (previousCGPA && previousCredits) {
      const prevCGPA = parseFloat(previousCGPA);
      const prevCredits = parseFloat(previousCredits);
      
      if (!isNaN(prevCGPA) && !isNaN(prevCredits) && prevCredits > 0) {
        const totalPreviousPoints = prevCGPA * prevCredits;
        const combinedPoints = totalPreviousPoints + totalPoints;
        const combinedCredits = prevCredits + totalCredits;
        const cgpa = combinedCredits > 0 ? combinedPoints / combinedCredits : 0;
        setNewCGPA(cgpa);
      } else {
        setNewCGPA(null);
      }
    } else {
      setNewCGPA(null);
    }
  };

  const saveGPA = () => {
    if (calculatedGPA !== null && user) {
      updateGPAMutation.mutate(calculatedGPA);
    }
  };

  const clearAll = () => {
    setCourses([{ id: '1', name: '', credits: 3, grade: Object.keys(gradePoints)[0] }]);
    setCalculatedGPA(null);
    setSaveMessage('');
    setPreviousCGPA('');
    setPreviousCredits('');
    setNewCGPA(null);
  };

  return (
    <div className="min-h-screen animated-gradient-bg py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Home Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white border border-gray-300 rounded-lg text-gray-700 hover:text-gray-900 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('common.home', 'Home')}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl p-6 md:p-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('gpa.calculator', 'GPA Calculator')}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('gpa.calculatorDesc', 'Add your courses and grades to calculate your GPA')}
          </p>

          {/* Grading System Selector */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('gpa.gradingSystem', 'Choose Your Grading System')}:
            </label>
            <select
              value={gradingSystem}
              onChange={(e) => handleGradingSystemChange(e.target.value as GradingSystem)}
              className="w-full md:w-auto px-4 py-2 bg-white border border-blue-300 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="AA/BA/BB">AA/BA/BB (Simple)</option>
              <option value="AA/BA+/BA">AA/BA+/BA (Detailed)</option>
              <option value="A1/A2/A3">A1/A2/A3</option>
              <option value="A+/A/A-">A+/A/A-</option>
            </select>
          </div>

          {/* Previous CGPA Section */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {t('gpa.previousCGPA', 'Previous CGPA (Optional)')}
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              {t('gpa.previousCGPADesc', 'Enter your previous CGPA and total credits to calculate your new cumulative GPA')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('gpa.previousCGPALabel', 'Previous CGPA')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  value={previousCGPA}
                  onChange={(e) => setPreviousCGPA(e.target.value)}
                  placeholder="3.50"
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('gpa.previousCreditsLabel', 'Total Previous Credits')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={previousCredits}
                  onChange={(e) => setPreviousCredits(e.target.value)}
                  placeholder="60"
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Courses Table */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700 px-2">
              <div className="col-span-5">{t('gpa.courseName', 'Course Name')}</div>
              <div className="col-span-2">{t('gpa.credits', 'Credits')}</div>
              <div className="col-span-3">{t('gpa.grade', 'Grade')}</div>
              <div className="col-span-2"></div>
            </div>

            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="grid grid-cols-12 gap-2 items-center"
              >
                <input
                  type="text"
                  value={course.name}
                  onChange={(e) => updateCourse(course.id, 'name', e.target.value)}
                  placeholder={t('gpa.courseNamePlaceholder', 'e.g., Mathematics')}
                  className="col-span-5 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={course.credits}
                  onChange={(e) => updateCourse(course.id, 'credits', parseInt(e.target.value) || 0)}
                  className="col-span-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <select
                  value={course.grade}
                  onChange={(e) => updateCourse(course.id, 'grade', e.target.value)}
                  className="col-span-3 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  {Object.keys(gradePoints).map((grade) => (
                    <option key={grade} value={grade} className="bg-white">
                      {grade} ({gradePoints[grade].toFixed(2)})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeCourse(course.id)}
                  disabled={courses.length === 1}
                  className="col-span-2 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t('common.delete', 'Sil')}
                </button>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={addCourse}
              className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              + {t('gpa.addCourse', 'Add Course')}
            </button>
            <button
              onClick={calculateGPA}
              className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors font-semibold shadow-lg shadow-red-500/30"
            >
              {t('gpa.calculate', 'Calculate GPA')}
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 bg-gray-100 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
              {t('gpa.clearAll', 'Clear All')}
            </button>
          </div>

          {/* Result */}
          {calculatedGPA !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6 mb-6"
            >
              <div className="text-center">
                <p className="text-gray-700 font-medium mb-2">{t('gpa.semesterGPA', 'Semester GPA')}</p>
                <p className="text-5xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent mb-4">
                  {calculatedGPA.toFixed(2)}
                </p>
                
                {newCGPA !== null && (
                  <div className="mt-4 pt-4 border-t border-red-300">
                    <p className="text-gray-700 font-medium mb-2">{t('gpa.newCGPA', 'New Cumulative GPA (CGPA)')}</p>
                    <p className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent mb-2">
                      {newCGPA.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {t('gpa.cgpaCalculation', 'Based on previous CGPA and new semester grades')}
                    </p>
                  </div>
                )}
                
                {user && (
                  <button
                    onClick={saveGPA}
                    disabled={updateGPAMutation.isPending}
                    className="mt-4 px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors font-semibold disabled:opacity-50 shadow-lg"
                  >
                    {updateGPAMutation.isPending
                      ? t('common.saving', 'Saving...')
                      : t('gpa.saveToProfile', 'Save to Profile')}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Save Message */}
          {saveMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-green-600 font-semibold mb-4"
            >
              {saveMessage}
            </motion.div>
          )}

          {/* Grade Scale Reference */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {t('gpa.gradeScale', 'Grade Scale')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {Object.entries(gradePoints).map(([grade, points]) => (
                <div key={grade} className="flex justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-gray-900 font-semibold">{grade}</span>
                  <span className="text-gray-600">{points.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GPACalculator;
