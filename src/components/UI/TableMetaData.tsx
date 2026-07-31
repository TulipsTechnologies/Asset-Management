import { FC } from 'react';

interface TableMetaDataProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
}

const TableMetaData: FC<TableMetaDataProps> = ({
  currentPage,
  totalCount,
  pageSize,
}) => {
  const entriesStart = (currentPage - 1) * pageSize + 1;
  const entriesEnd = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="text-sm">
      {entriesStart && entriesEnd && totalCount
        ? `Showing ${entriesStart} to ${entriesEnd} of ${totalCount} entries.`
        : ''}
    </div>
  );
};

export default TableMetaData;
