import * as React from 'react';

/**
 * Shared hook that gives any MUI table drag-to-resize column functionality.
 *
 * Usage:
 *   const colIds = ['name', 'status', 'actions'];
 *   const { getWidth, totalWidth, setHoveredCol, ResizeHandle } = useResizableColumns(colIds);
 *
 *   On every <TableCell> in <TableHead>:
 *     style={{ position: 'relative', width: getWidth('name'), userSelect: 'none' }}
 *     onMouseEnter={() => setHoveredCol('name')}
 *     onMouseLeave={() => setHoveredCol(null)}
 *   After the label text, render: <ResizeHandle colId="name" />
 *
 *   On <Table>: sx={{ tableLayout: 'fixed', minWidth: totalWidth }}
 */

// Stable module-level component — never recreated, so React won't remount on every render.
export const ResizeHandle = React.memo(function ResizeHandle({
  colId,
  isActions = false,
  hoveredCol,
  activeCol,
  onMouseDown,
}: {
  colId: string;
  isActions?: boolean;
  hoveredCol: string | null;
  activeCol: string | null;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
}) {
  if (isActions) return null;
  const active = hoveredCol === colId || activeCol === colId;
  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: active ? 4 : 2,
        cursor: 'col-resize',
        backgroundColor: active ? 'hsl(var(--primary))' : 'hsl(var(--border))',
        zIndex: 2,
        transition: 'width 0.1s, background-color 0.1s',
      }}
      onMouseDown={e => onMouseDown(e, colId)}
    />
  );
});

export function useResizableColumns(
  columnIds: string[],
  defaultWidths: Record<string, number> = {},
  fallbackWidth = 150
) {
  const [widths, setWidths] = React.useState<Record<string, number>>({});
  const [hoveredCol, setHoveredCol] = React.useState<string | null>(null);
  const [activeCol, setActiveCol] = React.useState<string | null>(null);
  const resizeRef = React.useRef<{ id: string; startX: number; startW: number } | null>(null);

  const getWidth = React.useCallback(
    (id: string) => widths[id] ?? defaultWidths[id] ?? fallbackWidth,
    [widths, defaultWidths, fallbackWidth]
  );

  const totalWidth = React.useMemo(
    () => columnIds.reduce((sum, id) => sum + getWidth(id), 0),
    [columnIds, getWidth]
  );

  const startResize = React.useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startW = getWidth(id);
      resizeRef.current = { id, startX: e.clientX, startW };
      setActiveCol(id);
      document.body.style.cursor = 'col-resize';
      (document.body.style as any).userSelect = 'none';

      const onMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const { id, startX, startW } = resizeRef.current;
        setWidths(prev => ({ ...prev, [id]: Math.max(60, startW + (ev.clientX - startX)) }));
      };
      const onUp = () => {
        resizeRef.current = null;
        setActiveCol(null);
        document.body.style.cursor = '';
        (document.body.style as any).userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [getWidth]
  );

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      (document.body.style as any).userSelect = '';
    };
  }, []);

  return { getWidth, totalWidth, setHoveredCol, hoveredCol, activeCol, startResize };
}
