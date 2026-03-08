/**
 * Enhanced Form Hook
 * Provides comprehensive form handling with error management, loading states, and user feedback
 */

import { useState, useCallback, useRef } from 'react';
import { useNotifications } from '../components/common/NotificationSystem';
import { ApiError } from '../lib/api';

export interface FormField<T = any> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

export interface FormState<T extends Record<string, any>> {
  fields: { [K in keyof T]: FormField<T[K]> };
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  submitCount: number;
}

export interface ValidationRule<T = any> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T) => string | undefined;
}

export interface FormConfig<T extends Record<string, any>> {
  initialValues: T;
  validationRules?: { [K in keyof T]?: ValidationRule<T[K]> };
  onSubmit: (values: T) => Promise<void> | void;
  onSuccess?: (values: T) => void;
  onError?: (error: Error, values: T) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showSuccessMessage?: boolean;
  successMessage?: string;
}

export function useEnhancedForm<T extends Record<string, any>>(config: FormConfig<T>) {
  const notifications = useNotifications();
  const initialStateRef = useRef<FormState<T>>();

  // Initialize form state
  if (!initialStateRef.current) {
    initialStateRef.current = {
      fields: Object.keys(config.initialValues).reduce((acc, key) => {
        acc[key as keyof T] = {
          value: config.initialValues[key],
          error: undefined,
          touched: false,
          dirty: false,
        };
        return acc;
      }, {} as FormState<T>['fields']),
      isValid: true,
      isDirty: false,
      isSubmitting: false,
      submitCount: 0,
    };
  }

  const [formState, setFormState] = useState<FormState<T>>(initialStateRef.current);

  // Validation function
  const validateField = useCallback((name: keyof T, value: T[keyof T]): string | undefined => {
    const rules = config.validationRules?.[name];
    if (!rules) return undefined;

    // Required validation
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${String(name)} is required`;
    }

    // String-specific validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        return `${String(name)} must be at least ${rules.minLength} characters`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return `${String(name)} must be no more than ${rules.maxLength} characters`;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        return `${String(name)} format is invalid`;
      }
    }

    // Custom validation
    if (rules.custom) {
      return rules.custom(value);
    }

    return undefined;
  }, [config.validationRules]);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newFields = { ...formState.fields };
    let isValid = true;

    Object.keys(newFields).forEach((key) => {
      const fieldKey = key as keyof T;
      const error = validateField(fieldKey, newFields[fieldKey].value);
      newFields[fieldKey] = { ...newFields[fieldKey], error };
      if (error) isValid = false;
    });

    setFormState(prev => ({
      ...prev,
      fields: newFields,
      isValid,
    }));

    return isValid;
  }, [formState.fields, validateField]);

  // Set field value
  const setFieldValue = useCallback((name: keyof T, value: T[keyof T]) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      const field = newFields[name];
      
      newFields[name] = {
        ...field,
        value,
        dirty: value !== config.initialValues[name],
        error: config.validateOnChange ? validateField(name, value) : field.error,
      };

      const isDirty = Object.values(newFields).some(f => f.dirty);
      const isValid = Object.values(newFields).every(f => !f.error);

      return {
        ...prev,
        fields: newFields,
        isDirty,
        isValid,
      };
    });
  }, [config.initialValues, config.validateOnChange, validateField]);

  // Set field touched
  const setFieldTouched = useCallback((name: keyof T, touched: boolean = true) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      const field = newFields[name];
      
      newFields[name] = {
        ...field,
        touched,
        error: touched && config.validateOnBlur ? validateField(name, field.value) : field.error,
      };

      const isValid = Object.values(newFields).every(f => !f.error);

      return {
        ...prev,
        fields: newFields,
        isValid,
      };
    });
  }, [config.validateOnBlur, validateField]);

  // Set field error
  const setFieldError = useCallback((name: keyof T, error: string | undefined) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      newFields[name] = { ...newFields[name], error };
      
      const isValid = Object.values(newFields).every(f => !f.error);

      return {
        ...prev,
        fields: newFields,
        isValid,
      };
    });
  }, []);

  // Set multiple field errors (from API response)
  const setFieldErrors = useCallback((errors: Record<string, string>) => {
    setFormState(prev => {
      const newFields = { ...prev.fields };
      
      // Clear existing errors
      Object.keys(newFields).forEach(key => {
        newFields[key as keyof T] = { ...newFields[key as keyof T], error: undefined };
      });

      // Set new errors
      Object.entries(errors).forEach(([key, error]) => {
        if (newFields[key as keyof T]) {
          newFields[key as keyof T] = { ...newFields[key as keyof T], error };
        }
      });

      const isValid = Object.values(newFields).every(f => !f.error);

      return {
        ...prev,
        fields: newFields,
        isValid,
      };
    });
  }, []);

  // Get current form values
  const getValues = useCallback((): T => {
    return Object.keys(formState.fields).reduce((acc, key) => {
      acc[key as keyof T] = formState.fields[key as keyof T].value;
      return acc;
    }, {} as T);
  }, [formState.fields]);

  // Reset form
  const reset = useCallback((newValues?: Partial<T>) => {
    const resetValues = { ...config.initialValues, ...newValues };
    
    setFormState({
      fields: Object.keys(resetValues).reduce((acc, key) => {
        acc[key as keyof T] = {
          value: resetValues[key],
          error: undefined,
          touched: false,
          dirty: false,
        };
        return acc;
      }, {} as FormState<T>['fields']),
      isValid: true,
      isDirty: false,
      isSubmitting: false,
      submitCount: 0,
    });
  }, [config.initialValues]);

  // Submit form
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Mark all fields as touched
    setFormState(prev => {
      const newFields = { ...prev.fields };
      Object.keys(newFields).forEach(key => {
        newFields[key as keyof T] = { ...newFields[key as keyof T], touched: true };
      });
      return { ...prev, fields: newFields };
    });

    // Validate form
    const isValid = validateForm();
    if (!isValid) {
      notifications.showError('Please fix the validation errors before submitting.');
      return;
    }

    setFormState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const values = getValues();
      await config.onSubmit(values);
      
      setFormState(prev => ({ 
        ...prev, 
        isSubmitting: false, 
        submitCount: prev.submitCount + 1 
      }));

      if (config.showSuccessMessage !== false) {
        notifications.showSuccess(
          config.successMessage || 'Form submitted successfully!'
        );
      }

      if (config.onSuccess) {
        config.onSuccess(values);
      }
    } catch (error) {
      setFormState(prev => ({ 
        ...prev, 
        isSubmitting: false, 
        submitCount: prev.submitCount + 1 
      }));

      // Handle API validation errors
      if (error instanceof ApiError && error.hasFieldErrors()) {
        setFieldErrors(error.getFieldErrors());
        notifications.showError('Please fix the validation errors and try again.');
      } else {
        // Handle other errors
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        notifications.showError(errorMessage);
      }

      if (config.onError) {
        config.onError(error as Error, getValues());
      }
    }
  }, [validateForm, getValues, config, notifications, setFieldErrors]);

  // Helper function to get field props for input components
  const getFieldProps = useCallback((name: keyof T) => {
    const field = formState.fields[name];
    return {
      name: String(name),
      value: field.value,
      error: field.touched ? field.error : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setFieldValue(name, e.target.value as T[keyof T]);
      },
      onBlur: () => {
        setFieldTouched(name, true);
      },
    };
  }, [formState.fields, setFieldValue, setFieldTouched]);

  return {
    // Form state
    fields: formState.fields,
    isValid: formState.isValid,
    isDirty: formState.isDirty,
    isSubmitting: formState.isSubmitting,
    submitCount: formState.submitCount,

    // Form actions
    setFieldValue,
    setFieldTouched,
    setFieldError,
    setFieldErrors,
    getValues,
    reset,
    handleSubmit,
    validateForm,

    // Helper functions
    getFieldProps,
  };
}