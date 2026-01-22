# Client-Side Form Validation System

## Overview

This system provides a reusable, type-safe way to implement client-side form validation in React components.

## Components

### 1. `useFormValidation` Hook (`hooks/useFormValidation.ts`)

A generic React hook that manages validation state and logic.

#### Features
- Type-safe validation rules
- Built-in common validators
- Custom validation support
- Error state management
- Field-level error clearing

#### Usage Example

```typescript
import { useFormValidation, validators } from '@/hooks/useFormValidation';

interface FormData {
  email: string;
  paymentTermId: number;
  quantity: number;
}

const { validate, hasError, getError, clearError } = useFormValidation<FormData>([
  {
    field: 'email',
    validate: validators.email('Email inválido'),
  },
  {
    field: 'paymentTermId',
    validate: validators.required('Debe seleccionar una condición de pago'),
  },
  {
    field: 'quantity',
    validate: validators.min(1, 'La cantidad debe ser mayor a 0'),
  },
]);

// In submit handler
if (!validate(formData)) {
  // Validation failed, errors are set
  return;
}
```

### 2. `FormField` Component (`components/ui/form-field.tsx`)

A wrapper component that provides consistent styling and error display.

#### Features
- Automatic error message display
- Required field indicator
- Optional field description
- Error animations
- Destructive styling for errors

#### Usage Example

```tsx
<FormField
  label="Condición de Pago"
  required
  error={getError('paymentTermId')}
  description="Define descuentos por categoría"
>
  <Select value={paymentTermId} onValueChange={handleChange}>
    {/* Select content */}
  </Select>
</FormField>
```

## Built-in Validators

### `validators.required(message?)`
Ensures the field has a value (not null, undefined, empty string, or empty array).

### `validators.minLength(min, message?)`
Validates string minimum length.

### `validators.maxLength(max, message?)`
Validates string maximum length.

### `validators.min(min, message?)`
Validates number minimum value.

### `validators.max(max, message?)`
Validates number maximum value.

### `validators.email(message?)`
Validates email format.

### `validators.pattern(regex, message)`
Validates against a custom regex pattern.

### `validators.custom(validator, message)`
Allows custom validation logic with access to the entire form data.

## Custom Validators

You can create custom validators by providing a validation function:

```typescript
{
  field: 'password',
  validate: (value, formData) => {
    if (value.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (value !== formData.confirmPassword) {
      return 'Las contraseñas no coinciden';
    }
    return null; // Valid
  }
}
```

## Integration with Existing Forms

To integrate this system into an existing form:

1. **Import the hook and component**:
```typescript
import { useFormValidation, validators } from '@/hooks/useFormValidation';
import { FormField } from '@/components/ui/form-field';
```

2. **Define validation rules**:
```typescript
const { validate, hasError, getError, clearError } = useFormValidation([
  // ... your rules
]);
```

3. **Wrap form fields with FormField**:
```tsx
<FormField label="Field Name" required error={getError('fieldName')}>
  <Input value={value} onChange={onChange} />
</FormField>
```

4. **Validate on submit**:
```typescript
const handleSubmit = () => {
  if (!validate(formData)) {
    return;
  }
  // Proceed with submission
};
```

## Example: Sales Order Form

See `components/salesOrders/SingleStepOrderForm.tsx` for a complete example of:
- Payment term validation
- Integration with existing form logic
- API calls after validation
- Error clearing on field change

## Benefits

- **Type Safety**: Full TypeScript support
- **Reusability**: Use the same validation logic across forms
- **Consistency**: Unified error display and styling
- **Maintainability**: Centralized validation rules
- **Accessibility**: Proper label associations and ARIA attributes
- **UX**: Smooth animations and clear error messages

## Future Enhancements

Consider adding:
- Async validation support
- Field-level validation on blur
- Cross-field validation helpers
- Validation schemas from Zod (integration)
- Internationalization support for error messages
