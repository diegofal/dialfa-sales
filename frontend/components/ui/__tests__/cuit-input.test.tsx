import { render, screen, fireEvent } from '@testing-library/react';
import { CUITInput } from '../cuit-input';

describe('CUITInput', () => {
  it('formatea el CUIT mientras se escribe', () => {
    const handleChange = jest.fn();
    render(<CUITInput value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Escribir solo números
    fireEvent.change(input, { target: { value: '20' } });
    expect(input.value).toBe('20');
    expect(handleChange).toHaveBeenCalledWith('20');

    // Escribir más números
    fireEvent.change(input, { target: { value: '2012345678' } });
    expect(input.value).toBe('20-12345678');
    expect(handleChange).toHaveBeenCalledWith('2012345678');

    // Escribir el último dígito
    fireEvent.change(input, { target: { value: '20123456789' } });
    expect(input.value).toBe('20-12345678-9');
    expect(handleChange).toHaveBeenCalledWith('20123456789');
  });

  it('limita a 11 dígitos', () => {
    const handleChange = jest.fn();
    render(<CUITInput value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Intentar escribir más de 11 dígitos
    fireEvent.change(input, { target: { value: '201234567891234' } });
    expect(input.value).toBe('20-12345678-9');
    expect(handleChange).toHaveBeenCalledWith('20123456789');
  });

  it('solo permite números', () => {
    const handleChange = jest.fn();
    render(<CUITInput value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Intentar escribir letras
    fireEvent.change(input, { target: { value: 'abc123def' } });
    expect(input.value).toBe('12-3');
    expect(handleChange).toHaveBeenCalledWith('123');
  });

  it('maneja valor inicial formateado', () => {
    const handleChange = jest.fn();
    render(<CUITInput value="20123456789" onChange={handleChange} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('20-12345678-9');
  });

  it('maneja valor inicial sin formato', () => {
    const handleChange = jest.fn();
    render(<CUITInput value="20-12345678-9" onChange={handleChange} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('20-12345678-9');
  });

  it('devuelve valor limpio (sin guiones) en onChange', () => {
    const handleChange = jest.fn();
    render(<CUITInput value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox');

    // Usuario escribe con guiones
    fireEvent.change(input, { target: { value: '20-12345678-9' } });

    // onChange debe recibir solo números
    expect(handleChange).toHaveBeenCalledWith('20123456789');
  });

  it('usa placeholder por defecto', () => {
    render(<CUITInput value="" onChange={jest.fn()} />);
    const input = screen.getByPlaceholderText('20-12345678-9');
    expect(input).toBeInTheDocument();
  });

  it('permite placeholder personalizado', () => {
    render(<CUITInput value="" onChange={jest.fn()} placeholder="Ingrese CUIT" />);
    const input = screen.getByPlaceholderText('Ingrese CUIT');
    expect(input).toBeInTheDocument();
  });
});
