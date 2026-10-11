import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  small?: boolean;
}

export function Button({ variant = 'primary', small, className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={`btn btn-${variant}${small ? ' small' : ''} ${className}`} {...rest} />;
}
