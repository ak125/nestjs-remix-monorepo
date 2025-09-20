import * as React from "react";

export interface RadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function RadioGroup({ value, onValueChange, className, children }: RadioGroupProps) {
  return (
    <div className={className} role="radiogroup">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            checked: child.props.value === value,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.checked) {
                onValueChange?.(child.props.value);
              }
            }
          });
        }
        return child;
      })}
    </div>
  );
}

export interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  children: React.ReactNode;
}

export function RadioGroupItem({ value, children, className, ...props }: RadioGroupItemProps) {
  return (
    <label className={`flex items-center space-x-2 cursor-pointer ${className || ''}`}>
      <input
        type="radio"
        value={value}
        className="text-blue-600 focus:ring-blue-500"
        {...props}
      />
      <span>{children}</span>
    </label>
  );
}
