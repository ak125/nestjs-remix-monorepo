import * as React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
  onValueChange?: (value: string) => void;
}

function Select({ children, className = "", placeholder, onValueChange, onChange, ...props }: SelectProps) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (onValueChange) {
      onValueChange(event.target.value);
    }
    if (onChange) {
      onChange(event);
    }
  };

  return (
    <select 
      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
      onChange={handleChange}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

export interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  children: React.ReactNode;
}

function SelectItem({ children, ...props }: SelectItemProps) {
  return <option {...props}>{children}</option>;
}

export { Select, SelectItem };
export const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SelectTrigger = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
);
export const SelectValue = ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>;
