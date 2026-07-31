'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { CustomTableProps, ICacheData, RowWithFieldProps, TTableColumn } from './CustomTableInterface';
import { sortDate, sortNumber, sortString } from './utils';
import SelectionBar from './SelectionBar';
import Tooltip from '../UI/Tooltip';
import Drawer from '../UI/Drawer';
import { LoadingSvg } from '@tulipstechnologies/common';

const SquareCheckbox = dynamic(() => import('@/components/UI/SquareCheckBox'), {
  ssr: false,
});
const RecordsNotFound = dynamic(
  () => import('@/components/UI/RecordsNotFound'),
  { ssr: false },
);

const CHECKBOX_COL_WIDTH = 44;
const SERIAL_COL_WIDTH = 56;

const CustomTable = ({
  tableName,
  columns: initialColumns,
  rows: initialRows,
  tableHeaderLeft,
  tableHeaderRight,
  isLoading = false,
  onRowClick,
  containerClassName,
  striped = false,
  updateFilters,
  selectable = true,
  showSerial = true,
  serialOffset = 0,
  getRowId,
  onSelectionChange,
  entityLabel,
  bulkActions,
}: CustomTableProps) => {
  const [columns, setColumns] = useState<TTableColumn[]>(
    initialColumns.map((col) => ({ ...col, visible: col.visible ?? true })),
  );
  const [rows, setRows] = useState<RowWithFieldProps[]>(initialRows);
  // Fixed cell padding — the "Row Spacing" control was removed to match the
  // main TulipsHRM employee toolbar (8px == the old "Medium" default).
  const spacing = 8;
  const [columsOpen, setColumnsOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    columnKey: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const manageColumnsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [remainingWidth, setRemainingWidth] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
    new Set(),
  );

  const resolveRowId = (row: RowWithFieldProps, index: number) =>
    getRowId?.(row, index) ?? row.id ?? index;

  // Width reserved by the leading selection + serial columns.
  const leadingWidth =
    (selectable ? CHECKBOX_COL_WIDTH : 0) + (showSerial ? SERIAL_COL_WIDTH : 0);

  // Clear stale selection whenever the underlying rows change (paging/filter).
  useEffect(() => {
    setSelectedIds(new Set());
  }, [initialRows]);

  useEffect(() => {
    if (!onSelectionChange) return;
    const selectedRows = rows.filter((row, index) =>
      selectedIds.has(resolveRowId(row, index)),
    );
    onSelectionChange(selectedRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const allSelected =
    rows.length > 0 &&
    rows.every((row, index) => selectedIds.has(resolveRowId(row, index)));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (rows.length > 0 && rows.every((row, index) =>
        prev.has(resolveRowId(row, index)))) {
        return new Set();
      }
      return new Set(rows.map((row, index) => resolveRowId(row, index)));
    });
  };

  const toggleSelectRow = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedRows = rows.filter((row, index) =>
    selectedIds.has(resolveRowId(row, index)),
  );

  useEffect(() => {
    if (containerRef.current && tableRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const totalWidth = getTotalWidth(columns) + leadingWidth;
      const widthDifference = containerWidth - totalWidth;

      if (totalWidth < containerWidth) {
        setRemainingWidth(widthDifference);
      } else {
        setRemainingWidth(0);
      }
    }
  }, [columns]);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    if (tableName) {
      const columnCache = localStorage.getItem(tableName);

      if (columnCache) {
        const widthDistributions: ICacheData[] = JSON.parse(columnCache);

        // Merge the cached layout onto the CURRENT column set: cached
        // order/width/locked/visible win for matching keys, columns added
        // since the cache was written are inserted at their code-defined
        // position, and cached keys that no longer exist are dropped.
        setColumns((prevColumns) => {
          const cachedKeys = new Set(widthDistributions.map((i) => i.key));
          const merged = widthDistributions
            .filter((item) => prevColumns.some((col) => col.key === item.key))
            .map((item) => {
              const prevCol = prevColumns.find((col) => col.key === item.key)!;
              return {
                ...prevCol,
                width: item.width,
                locked: item.locked,
                visible: item.visible,
              };
            }) as TTableColumn[];

          prevColumns.forEach((col, index) => {
            if (!cachedKeys.has(col.key)) {
              merged.splice(Math.min(index, merged.length), 0, col);
            }
          });

          return merged;
        });
      }
    }
  }, [tableName]);

  // const initialColLoad = useRef(true);
  useEffect(() => {
    // if (initialColLoad.current) {
    //   initialColLoad.current = false;

    //   return;
    // }

    if (columns && columns.length > 0) {
      const cacheInfo: ICacheData[] = [];

      columns.forEach((col) => {
        cacheInfo.push({
          key: col.key,
          locked: col.locked ?? false,
          width: col.width,
          visible: col.visible ?? false,
        });
      });

      localStorage.setItem(tableName, JSON.stringify(cacheInfo));
    }
  }, [columns]);

  const handleSort = (columnKey: string) => {
    const column = columns.find((col) => col.key === columnKey);
    if (!column || !column.type) return;

    const direction =
      sortConfig?.columnKey === columnKey && sortConfig.direction === 'asc'
        ? 'desc'
        : 'asc';

    setSortConfig({ columnKey, direction });
    updateFilters?.({
      sortBy: columnKey,
      desc: direction === 'desc',
    });

    setRows((prevRows) => {
      const sortedRows = [...prevRows].sort((a, b) => {
        const valueA = a[columnKey];
        const valueB = b[columnKey];

        if (!valueA || !valueB) return 0;

        if (column.type === 'number') {
          return sortNumber(direction, valueA, valueB);
        }

        if (column.type === 'date') {
          return sortDate(direction, valueA, valueB);
        }

        if (column.type === 'string') {
          return sortString(direction, valueA, valueB);
        }

        if (column.type === 'custom') {
          const dataA = a[columnKey];
          const dataB = b[columnKey];
          const valueA = dataA.value;
          const valueB = dataB.value;

          if (dataA.type === 'string') {
            return sortString(direction, valueA, valueB);
          }
          if (dataA.type === 'number') {
            return sortNumber(direction, valueA, valueB);
          }
          if (dataA.type === 'date') {
            return sortDate(direction, valueA, valueB);
          }
        }

        return 0;
      });

      return sortedRows;
    });
  };

  const getSortIcon = (columnKey: string) => {
    const column = columns.find((col) => col.key === columnKey);
    if (!column || !column.type) return null;

    return (
      <span className="text-base text-gray-400">
        {sortConfig?.columnKey === columnKey ? (
          sortConfig.direction === 'asc' ? (
            <i className="icon icon-up text-[6px]" />
          ) : (
            <i className="icon icon-down text-[6px]" />
          )
        ) : (
          <i className="icon icon-sort text-[10px]" />
        )}
      </span>
    );
  };

  const renderCellContent = (col: TTableColumn, data: any) => {
    switch (col.type) {
      case 'custom':
        return data.content ?? <></>;
      default:
        return data;
    }
  };

  const renderHeaderField = (col: TTableColumn) => {
    switch (col.type) {
      case 'custom':
        return col.custom?.content ?? <></>;
      default:
        return col.label;
    }
  };
  const toggleColumnVisibility = (columnKey: string) => {
    setColumns((prevColumns) =>
      prevColumns.map((col) =>
        col.key === columnKey ? { ...col, visible: !col.visible } : col,
      ),
    );
  };

  const toggleDrawer = (newOpen: boolean) => () => {
    setColumnsOpen(newOpen);
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    const sourceIndex = source.index;
    const destinationIndex = destination.index;

    if (columns[sourceIndex].locked || columns[destinationIndex]?.locked)
      return;

    const reorderedColumns = [...columns];
    const [moved] = reorderedColumns.splice(sourceIndex, 1);
    reorderedColumns.splice(destinationIndex, 0, moved);

    setColumns(reorderedColumns);
  };

  const toggleColumnLock = (columnKey: string) => {
    setColumns((prevColumns) =>
      prevColumns.map((col) =>
        col.key === columnKey ? { ...col, locked: !col.locked } : col,
      ),
    );
  };

  const handleResize = (columnKey: string, deltaX: number) => {
    setColumns((prevColumns) =>
      prevColumns.map((col) => {
        const defaultWidth = initialColumns.find(
          (init) => init.key === columnKey,
        )?.width;

        return col.key === columnKey
          ? { ...col, width: Math.max(defaultWidth ?? 80, col.width + deltaX) }
          : col;
      }),
    );
  };

  const startResizing = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    columnKey: string,
  ) => {
    let initialX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - initialX;
      handleResize(columnKey, deltaX);
      initialX = moveEvent.clientX;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  const setColDefault = (columnKey: string) => {
    const initialCol = initialColumns.find((col) => col.key === columnKey);

    setColumns((prevColumns) =>
      prevColumns.map((col) =>
        col.key === columnKey
          ? { ...col, width: initialCol?.width ?? 200 }
          : col,
      ),
    );
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset this table settings?',
    );
    if (confirmed) {
      localStorage.removeItem(tableName);
      if (window) {
        window.location.reload();
      }
    }
  };

  const DrawerList = (
    <div style={{ width: 320 }}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="columns">
          {(provided) => (
            <ul
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="sortable-list"
            >
              <li>
                <div className="flex justify-between items-center p-2 bg-gray-100">
                  <Tooltip
                    text={
                      <div className="text-sm p-2">
                        <ul className="list-disc gap-y-2 list-inside flex flex-col justify-stretch items-stretch font-normal">
                          <li>Drag and drop columns to change their order.</li>
                          <li>
                            Click the
                            <i className="icon icon-lock inline-block text-xl" />{' '}
                            icon to keep a column locked while scrolling.
                          </li>
                          <li>
                            Use the checkboxes to control which columns are
                            visible
                          </li>
                        </ul>
                      </div>
                    }
                  >
                    <span className="flex items-center gap-x-2 text-sm">
                      <i className="icon icon-info text-xl text-primarycolor" />{' '}
                      Organize
                    </span>
                  </Tooltip>

                  <button
                    type="button"
                    className="text-white flex items-center justify-center text-sm gap-x-2 bg-red-500 py-1 px-2 rounded-full"
                    onClick={handleReset}
                  >
                    <i className="icon icon-redo text-sm" /> <span>Reset</span>
                  </button>
                </div>
              </li>
              {columns.map((col, index) => {
                if (col.canReposition === false) return;
                if (!col.key || col.key.trim() === '') return;

                return (
                  <Draggable
                    key={col.key}
                    draggableId={col.key}
                    index={index}
                    isDragDisabled={col.locked}
                  >
                    {(provided, snapshot) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`sortable-item  ${col.locked ? 'locked' : ''
                          }  ${snapshot.isDragging ? 'dragging' : ''}`}
                      >
                        <div className="flex items-center gap-x-2 justify-start">
                          <i className="icon icon-move text-sm" />
                          {col.canToggle === false ? (
                            <span className="ml-2 text-gray-700">
                              {col.label}
                            </span>
                          ) : (
                            <SquareCheckbox
                              checked={col.visible ?? false}
                              onChange={() => toggleColumnVisibility(col.key)}
                              title={col.label}
                            />
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleColumnLock(col.key)}
                          className="text-xl"
                        >
                          {col.locked ? (
                            <i className="icon icon-lock  text-sm" />
                          ) : (
                            <i className="icon icon-unlock  text-sm" />
                          )}
                        </button>
                      </li>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );

  const getStickyOffsets = (columns: TTableColumn[]) => {
    let offset = 0;
    return columns.map((col) => {
      if (col.locked) {
        const currentOffset = offset;
        offset += col.width;
        return currentOffset;
      }
      return null;
    });
  };
  const getTotalWidth = (columns: TTableColumn[]) => {
    let totalWidth = 0;

    columns.forEach((col) => {
      if (col.visible) {
        totalWidth += col.width;
      }
    });

    return totalWidth;
  };


  return (
    <>
      {/* Bulk-selection banner — mirrors the TulipsHRM employee module */}
      {selectable && (
        <SelectionBar
          count={selectedRows.length}
          entityLabel={entityLabel}
          bulkActions={bulkActions}
          selectedIds={selectedRows.map((row) =>
            resolveRowId(row, rows.indexOf(row)),
          )}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 w-full mb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {tableHeaderLeft}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-8">
          <button
            ref={manageColumnsButtonRef}
            type="button"
            onClick={() => {
              setColumnsOpen(!columsOpen);
            }}
            className="text-sm flex items-center justify-start gap-x-2 font-medium whitespace-nowrap"
          >
            <i className="icon icon-three-cols text-gray-500 text-base" />{' '}
            Manage Columns
          </button>
          {tableHeaderRight}
        </div>
      </div>
      {/* Spacing Menu */}

      {/* Columns Drawer */}
      <Drawer
        isOpen={columsOpen}
        onClose={() => setColumnsOpen(false)}
        excludeButtonRef={manageColumnsButtonRef}
      >
        {DrawerList}
      </Drawer>

      {/* Mobile (< md): rows degrade to stacked cards built from visible columns */}
      <div className="md:hidden space-y-2.5 overflow-y-auto max-h-[calc(100vh-260px)]">
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <LoadingSvg bgColor="#3AC47D" size="50" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-500 border border-gray-200 rounded-lg">
            No Records Found
          </div>
        ) : (
          rows.map((row, rowIndex) => {
            const visibleCols = columns.filter((col) => col.visible);
            const actionsCol = visibleCols.find(
              (col) => col.name === 'actions',
            );
            const dataCols = visibleCols.filter(
              (col) => col.name !== 'actions',
            );
            const [primaryCol, ...restCols] = dataCols;
            return (
              <div
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                className={`border border-gray-200 rounded-lg p-3 ${
                  onRowClick ? 'cursor-pointer active:bg-gray-50' : ''
                }`}
                style={
                  row.rowColor
                    ? { backgroundColor: row.rowColor }
                    : { backgroundColor: 'white' }
                }
              >
                <div className="flex items-start justify-between gap-2">
                  {selectable &&
                    (() => {
                      const rowId = resolveRowId(row, rowIndex);
                      const isSelected = selectedIds.has(rowId);
                      return (
                        <i
                          role="checkbox"
                          aria-checked={isSelected}
                          className={`icon ${isSelected ? 'icon-checked text-primarycolor' : 'icon-unchecked text-gray-300'} text-xl mt-1 shrink-0 cursor-pointer`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectRow(rowId);
                          }}
                          aria-label="Select row"
                        />
                      );
                    })()}
                  <div className="min-w-0 flex-1">
                    {showSerial && (
                      <span className="inline-block mb-0.5 text-[11px] font-medium text-gray-400">
                        #{serialOffset + rowIndex + 1}
                      </span>
                    )}
                    {primaryCol && (
                      <>
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">
                          {renderHeaderField(primaryCol)}
                        </p>
                        <div className="text-sm font-semibold text-secondaryColor break-words">
                          {renderCellContent(primaryCol, row[primaryCol.key])}
                        </div>
                      </>
                    )}
                  </div>
                  {actionsCol && (
                    <div
                      className="shrink-0 -mt-1 -mr-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {renderCellContent(actionsCol, row[actionsCol.key])}
                    </div>
                  )}
                </div>
                {restCols.length > 0 && (
                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                    {restCols.map((col) => (
                      <div key={col.key} className="min-w-0">
                        <dt className="text-[11px] uppercase tracking-wide text-gray-400">
                          {renderHeaderField(col)}
                        </dt>
                        <dd className="text-sm text-gray-700 break-words">
                          {renderCellContent(col, row[col.key]) ?? '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop (md+): unchanged data grid */}
      <div
        className={`customTable-container custom-scroller hidden md:block ${containerClassName}`}
        ref={containerRef}
      >
        <table
          className="customTable"
          style={{ width: `${getTotalWidth(columns) + leadingWidth}px` }}
          ref={tableRef}
        >
          <thead
            className={`${striped ? 'bg-white' : 'bg-gray-50'
              } sticky top-0 z-10`}
          >
            <tr className="table-header">
              {selectable && (
                <th
                  style={{ width: `${CHECKBOX_COL_WIDTH}px` }}
                  className="!text-center"
                >
                  <i
                    role="checkbox"
                    aria-checked={allSelected}
                    className={`icon ${allSelected || someSelected ? 'icon-checked text-primarycolor' : 'icon-unchecked text-gray-300'} text-xl cursor-pointer align-middle`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectAll();
                    }}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {showSerial && (
                <th
                  style={{ width: `${SERIAL_COL_WIDTH}px` }}
                  className="!text-center whitespace-nowrap"
                >
                  SN
                </th>
              )}
              {columns.map((col, index) => {
                const stickyOffset = getStickyOffsets(columns)[index];

                return (
                  col.visible && (
                    <th
                      key={col.key}
                      style={{
                        width: `${col.width}px`,
                        left: col.locked ? `${stickyOffset}px` : undefined,
                        textAlign:
                          col.contentAlign && col.isSortable === false
                            ? col.contentAlign
                            : 'left',
                      }}
                      className={`group ${col.locked ? `!sticky bg-gray-50 z-[2]` : ''
                        } ${col.name === 'actions'
                          ? '!sticky bg-gray-50 z-[2] !left-auto right-0'
                          : ''
                        }`}
                    >
                      <div
                        className={`flex items-center ${col.contentAlign === 'center' &&
                          col.isSortable === false
                          ? 'justify-center'
                          : 'justify-between'
                          }`}
                      >
                        <span className="flex items-center gap-x-2 whitespace-nowrap">
                          {renderHeaderField(col)}
                        </span>
                        {col.type && col.isSortable !== false && (
                          <span onClick={() => handleSort(col.key)}>
                            {getSortIcon(col.key)}
                          </span>
                        )}
                      </div>
                      <div
                        className="resize-handle opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => startResizing(e, col.key)}
                        onDoubleClick={(e) => setColDefault(col.key)}
                      />
                    </th>
                  )
                );
              })}

              {remainingWidth > 0 && (
                <th
                  style={{
                    width: `${remainingWidth}px`,
                  }}
                ></th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-4">
                  <LoadingSvg bgColor="#3AC47D" size="50" />
                </td>
              </tr>
            ) : (
              <>
                {rows.length > 0 ? (
                  rows.map((row, rowIndex) => {
                    let rowBackgroundColor: string | undefined;

                    if (striped && !row.rowColor) {
                      rowBackgroundColor =
                        rowIndex % 2 === 0 ? '#f9fafb' : 'white';
                    } else if (row.rowColor) {
                      rowBackgroundColor = row.rowColor;
                    }

                    return (
                      <tr
                        key={rowIndex}
                        onClick={() => onRowClick?.(row)}
                        className={`group ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                          }`}
                        style={{
                          backgroundColor: rowBackgroundColor,
                          ...(rowBackgroundColor && onRowClick
                            ? {
                              '--tw-bg-opacity': '0.95',
                              '&:hover': {
                                '--tw-bg-opacity': '1',
                              },
                            }
                            : {}),
                        }}
                      >
                        {selectable &&
                          (() => {
                            const rowId = resolveRowId(row, rowIndex);
                            const isSelected = selectedIds.has(rowId);
                            return (
                              <td
                                style={{ paddingBlock: `${spacing}px` }}
                                className="!text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <i
                                  role="checkbox"
                                  aria-checked={isSelected}
                                  className={`icon ${isSelected ? 'icon-checked text-primarycolor' : 'icon-unchecked text-gray-300'} text-xl cursor-pointer align-middle`}
                                  onClick={() => toggleSelectRow(rowId)}
                                  aria-label="Select row"
                                />
                              </td>
                            );
                          })()}
                        {showSerial && (
                          <td
                            style={{ paddingBlock: `${spacing}px` }}
                            className="!text-center text-gray-500"
                          >
                            {serialOffset + rowIndex + 1}
                          </td>
                        )}
                        {columns.map((col, index) => {
                          const stickyOffset = getStickyOffsets(columns)[index];

                          return (
                            col.visible && (
                              <td
                                key={col.key}
                                style={{
                                  paddingBlock: `${spacing}px`,
                                  left: col.locked
                                    ? `${stickyOffset}px`
                                    : undefined,
                                  textAlign: col.contentAlign
                                    ? col.contentAlign
                                    : 'left',
                                  ...(col.locked && rowBackgroundColor
                                    ? { backgroundColor: rowBackgroundColor }
                                    : {}),
                                }}
                                className={`group ${col.locked
                                  ? `!sticky bg-white ${onRowClick ? 'group-hover:bg-gray-50' : ''
                                  } z-[2]`
                                  : ''
                                  }  ${col.name === 'actions'
                                    ? '!sticky !bg-transparent z-[2] !left-auto right-0'
                                    : ''
                                  }`}
                              >
                                {renderCellContent(col, row[col.key])}
                              </td>
                            )
                          );
                        })}
                        {remainingWidth > 0 && <td></td>}
                      </tr>
                    );
                  })
                ) : (
                  <RecordsNotFound
                    colspan={
                      columns.length +
                      (selectable ? 1 : 0) +
                      (showSerial ? 1 : 0) +
                      (remainingWidth > 0 ? 1 : 0)
                    }
                  />
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default CustomTable;
