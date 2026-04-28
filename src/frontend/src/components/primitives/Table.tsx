import { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export const Table = ({ className, ...rest }: HTMLAttributes<HTMLTableElement>) => (
  <table className={clsx('w-full text-sm tabular-nums', className)} {...rest} />
);
export const THead = ({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={clsx('text-ink-tertiary uppercase tracking-wide text-xs', className)} {...rest} />
);
export const TBody = (props: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />;
export const Tr = ({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={clsx('border-b border-surface-overlay/40 hover:bg-surface-raised/40', className)} {...rest} />
);
export const Th = ({ className, ...rest }: ThHTMLAttributes<HTMLTableHeaderCellElement>) => (
  <th className={clsx('text-left font-[520] py-2 px-3', className)} {...rest} />
);
export const Td = ({ className, ...rest }: TdHTMLAttributes<HTMLTableDataCellElement>) => (
  <td className={clsx('py-2 px-3 text-ink-primary', className)} {...rest} />
);

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

export function DataTable<T>({ rows, columns, empty }: { rows: T[]; columns: DataTableColumn<T>[]; empty?: ReactNode }) {
  return (
    <Table>
      <THead>
        <Tr>
          {columns.map((c) => (
            <Th key={String(c.key)} className={clsx(c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
              {c.header}
            </Th>
          ))}
        </Tr>
      </THead>
      <TBody>
        {rows.length === 0 && empty ? (
          <Tr>
            <Td colSpan={columns.length} className="text-center text-ink-tertiary py-8">{empty}</Td>
          </Tr>
        ) : (
          rows.map((row, i) => (
            <Tr key={i}>
              {columns.map((c) => (
                <Td key={String(c.key)} className={clsx(c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                  {c.cell(row)}
                </Td>
              ))}
            </Tr>
          ))
        )}
      </TBody>
    </Table>
  );
}
