/**
 * 🪝 HOOKS REACT PERSONNALISÉS POUR VALIDATION ZOD
 * 
 * Collection de hooks pour validation de formulaires en temps réel
 * avec Zod et gestion d'état React optimisée
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { z } from 'zod';

// Types pour les résultats de validation
export interface ValidationResult<T> {
  data?: T;
  errors?: Record<string, string>;
  isValid: boolean;
  isValidating: boolean;
  isDirty: boolean;
  touchedFields: Record<string, boolean>;
}

// Types pour les options de validation
export interface ValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  mode?: 'onChange' | 'onBlur' | 'onSubmit';
}

/**
 * Hook principal pour validation de formulaire avec Zod
 */
export function useZodForm<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  initialValues: Partial<T> = {},
  options: ValidationOptions = {}
) {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    mode = 'onChange'
  } = options;

  // État du formulaire
  const [values, setValues] = useState<Partial<T>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Timer pour debounce
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  /**
   * Valide les données avec le schéma Zod
   */
  const validateData = useCallback(async (data: Partial<T>): Promise<ValidationResult<T>> => {
    setIsValidating(true);
    
    try {
      const validData = await schema.parseAsync(data);
      setErrors({});
      return {
        data: validData,
        isValid: true,
        isValidating: false,
        isDirty,
        touchedFields,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          const fieldName = err.path.join('.');
          fieldErrors[fieldName] = err.message;
        });
        setErrors(fieldErrors);
        return {
          errors: fieldErrors,
          isValid: false,
          isValidating: false,
          isDirty,
          touchedFields,
        };
      }
      throw error;
    } finally {
      setIsValidating(false);
    }
  }, [schema, isDirty, touchedFields]);

  /**
   * Valide un champ spécifique
   */
  const validateField = useCallback(async (fieldName: keyof T, value: any) => {
    try {
      // Créer un schéma partiel pour ce champ
      const fieldSchema = schema.pick({ [fieldName]: true } as any);
      await fieldSchema.parseAsync({ [fieldName]: value });
      
      // Supprimer l'erreur pour ce champ
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldName as string];
        return next;
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.errors.find(err => err.path.includes(fieldName as string));
        if (fieldError) {
          setErrors(prev => ({
            ...prev,
            [fieldName]: fieldError.message,
          }));
        }
      }
    }
  }, [schema]);

  /**
   * Met à jour une valeur de champ
   */
  const setValue = useCallback((fieldName: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    setIsDirty(true);

    // Validation en temps réel selon le mode
    if (validateOnChange && mode === 'onChange') {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      const timer = setTimeout(() => {
        validateField(fieldName, value);
      }, debounceMs);
      
      setDebounceTimer(timer);
    }
  }, [validateOnChange, mode, debounceMs, debounceTimer, validateField]);

  /**
   * Marque un champ comme touché
   */
  const setFieldTouched = useCallback((fieldName: keyof T, touched = true) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: touched }));
    
    // Validation onBlur si activée
    if (validateOnBlur && touched && mode === 'onBlur') {
      const value = values[fieldName];
      validateField(fieldName, value);
    }
  }, [validateOnBlur, mode, values, validateField]);

  /**
   * Réinitialise le formulaire
   */
  const reset = useCallback((newValues: Partial<T> = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouchedFields({});
    setIsDirty(false);
    setIsSubmitting(false);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  }, [initialValues, debounceTimer]);

  /**
   * Soumission du formulaire
   */
  const handleSubmit = useCallback(async (onSubmit: (data: T) => Promise<void> | void) => {
    setIsSubmitting(true);
    
    try {
      const result = await validateData(values);
      if (result.isValid && result.data) {
        await onSubmit(result.data);
        reset();
      }
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateData, reset]);

  // Nettoyage du timer
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // État calculé
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);
  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  return {
    // Valeurs et état
    values,
    errors,
    touchedFields,
    isValid,
    hasErrors,
    isValidating,
    isSubmitting,
    isDirty,
    
    // Actions
    setValue,
    setFieldTouched,
    validateData,
    validateField,
    reset,
    handleSubmit,
    
    // Utilitaires
    getFieldProps: (fieldName: keyof T) => ({
      value: values[fieldName] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(fieldName, e.target.value),
      onBlur: () => setFieldTouched(fieldName),
      error: errors[fieldName as string],
      touched: touchedFields[fieldName as string],
    }),
  };
}

/**
 * Hook pour validation simple d'une valeur
 */
export function useZodValidation<T>(schema: z.ZodSchema<T>, initialValue?: T) {
  const [value, setValue] = useState<T | undefined>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(async (newValue: T) => {
    setIsValidating(true);
    try {
      const result = await schema.parseAsync(newValue);
      setError(null);
      return result;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0]?.message || 'Valeur invalide');
      }
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [schema]);

  const updateValue = useCallback(async (newValue: T) => {
    setValue(newValue);
    return await validate(newValue);
  }, [validate]);

  return {
    value,
    error,
    isValidating,
    isValid: error === null,
    validate,
    updateValue,
    setValue,
  };
}

/**
 * Hook pour validation asynchrone avec cache
 */
export function useAsyncZodValidation<T>(
  schema: z.ZodSchema<T>,
  asyncValidator?: (value: T) => Promise<boolean>
) {
  const [validationCache, setValidationCache] = useState<Map<string, boolean>>(new Map());
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAsync = useCallback(async (value: T): Promise<boolean> => {
    setIsValidating(true);
    setError(null);

    try {
      // Validation Zod synchrone d'abord
      const validData = await schema.parseAsync(value);
      
      // Vérifier le cache pour la validation async
      const cacheKey = JSON.stringify(validData);
      if (validationCache.has(cacheKey)) {
        return validationCache.get(cacheKey)!;
      }

      // Validation asynchrone si fournie
      if (asyncValidator) {
        const isValid = await asyncValidator(validData);
        setValidationCache(prev => new Map(prev).set(cacheKey, isValid));
        
        if (!isValid) {
          setError('Validation asynchrone échouée');
        }
        
        return isValid;
      }

      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0]?.message || 'Valeur invalide');
      } else {
        setError('Erreur de validation');
      }
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [schema, asyncValidator, validationCache]);

  const clearCache = useCallback(() => {
    setValidationCache(new Map());
  }, []);

  return {
    validateAsync,
    isValidating,
    error,
    clearCache,
    cacheSize: validationCache.size,
  };
}

/**
 * Hook pour validation de liste/tableau
 */
export function useZodArrayValidation<T>(itemSchema: z.ZodSchema<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  const arraySchema = useMemo(() => z.array(itemSchema), [itemSchema]);

  const validateArray = useCallback(async (newItems: T[]) => {
    setIsValidating(true);
    
    try {
      const validItems = await arraySchema.parseAsync(newItems);
      setErrors({});
      return validItems;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<number, string> = {};
        error.errors.forEach(err => {
          const index = err.path[0];
          if (typeof index === 'number') {
            fieldErrors[index] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [arraySchema]);

  const addItem = useCallback(async (item: T) => {
    const newItems = [...items, item];
    setItems(newItems);
    return await validateArray(newItems);
  }, [items, validateArray]);

  const updateItem = useCallback(async (index: number, item: T) => {
    const newItems = [...items];
    newItems[index] = item;
    setItems(newItems);
    return await validateArray(newItems);
  }, [items, validateArray]);

  const removeItem = useCallback(async (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    return await validateArray(newItems);
  }, [items, validateArray]);

  return {
    items,
    errors,
    isValidating,
    isValid: Object.keys(errors).length === 0,
    validateArray,
    addItem,
    updateItem,
    removeItem,
    setItems,
  };
}