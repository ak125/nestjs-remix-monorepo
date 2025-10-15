/**
 * Table Component - Version simple pour les tableaux
 */

import  { type ReactNode } from "react";

interface TableProps {
  className?: string;
  children: ReactNode;
}

interface TableHeaderProps {
  children: ReactNode;
}

interface TableBodyProps {
  children: ReactNode;
}

interface TableRowProps {
  className?: string;
  children: ReactNode;
}

interface TableHeadProps {
  className?: string;
  children: ReactNode;
}

interface TableCellProps {
  className?: string;
  children: ReactNode;
}

export function Table({ className = "", children }: TableProps) {
  return (
    <table className={`w-full caption-bottom text-sm ${className}`}>
      {children}
    </table>
  );
}

export function TableHeader({ children }: TableHeaderProps) {
  return <thead className="[&_tr]:border-b">{children}</thead>;
}

export function TableBody({ children }: TableBodyProps) {
  return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
}

export function TableRow({ className = "", children }: TableRowProps) {
  return (
    <tr className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${className}`}>
      {children}
    </tr>
  );
}

export function TableHead({ className = "", children }: TableHeadProps) {
  return (
    <th className={`h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ className = "", children }: TableCellProps) {
  return (
    <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}>
      {children}
    </td>
  );
}
