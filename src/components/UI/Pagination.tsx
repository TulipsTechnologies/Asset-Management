import { FC } from 'react';
import TableMetaData from './TableMetaData';

interface PaginationProps {
  pageNumber: number;
  totalPages: number;
  pageSize: number | null;
  totalCount?: number;
  updateFilters: (filter: Partial<any>) => void;
}

const Pagination: FC<PaginationProps> = ({
  pageNumber,
  totalPages,
  pageSize,
  totalCount,
  updateFilters,
}) => {
  const getPaginationButtons = () => {
    const buttons = [];
    const maxButtons = 5;

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(i);
      }
    } else {
      const ellipsis = '...';

      if (pageNumber <= maxButtons - 2) {
        for (let i = 1; i <= maxButtons - 1; i++) {
          buttons.push(i);
        }
        buttons.push(ellipsis, totalPages);
      } else if (pageNumber >= totalPages - (maxButtons - 3)) {
        buttons.push(1, ellipsis);
        for (let i = totalPages - (maxButtons - 2); i <= totalPages; i++) {
          buttons.push(i);
        }
      } else {
        buttons.push(1, ellipsis);
        for (let i = pageNumber - 1; i <= pageNumber + 1; i++) {
          buttons.push(i);
        }
        buttons.push(ellipsis, totalPages);
      }
    }

    return buttons;
  };

  return (
    <div className="w-full flex flex-wrap justify-center gap-x-6 gap-y-3 sm:justify-between items-center mt-4 px-2">
      <div className="flex items-center">
        <label htmlFor="recordsPerPage" className="mr-2 text-[13px]">
          Records to display
        </label>
        <select
          id="recordsPerPage"
          value={pageSize || Number(process.env.NEXT_DEFAULT_ITEM_COUNT)}
          onChange={(e) => updateFilters({ pageSize: Number(e.target.value) })}
          className="border rounded p-1 text-sm min-w-14"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={500}>500</option>
          <option value={1000}>1000</option>
        </select>
      </div>
      {!!totalCount && (
        <TableMetaData
          currentPage={pageNumber}
          totalCount={totalCount}
          pageSize={pageSize || Number(process.env.NEXT_DEFAULT_ITEM_COUNT)}
        />
      )}
      <div className="flex flex-wrap justify-center gap-y-2 sm:justify-end">
        <button
          onClick={() => updateFilters({ pageNumber: 1 })}
          className={`rounded-full w-8 h-8 flex justify-center items-center px-1.5 py-1 text-sm border mx-0.5 sm:mx-1 hover:bg-bgBtnGray ${
            pageNumber === 1 ? 'cursor-not-allowed opacity-50' : ''
          }`}
          disabled={pageNumber === 1}
        >
          <i className="icon icon-double-left text-xs" />
        </button>
        <button
          onClick={() =>
            pageNumber > 1 && updateFilters({ pageNumber: pageNumber - 1 })
          }
          className={`rounded-full w-8 h-8 flex justify-center items-center px-1.5 py-1 text-sm border mx-0.5 sm:mx-1 hover:bg-bgBtnGray ${
            pageNumber === 1 ? 'cursor-not-allowed opacity-50' : ''
          }`}
          disabled={pageNumber === 1}
        >
          <i className="icon icon-left text-xs" />
        </button>
        {getPaginationButtons()?.map((page, index) => (
          <button
            key={index}
            onClick={() =>
              typeof page === 'number' && updateFilters({ pageNumber: page })
            }
            className={`rounded-full w-8 h-8 flex justify-center items-center px-1.5 py-1 text-sm border mx-0.5 sm:mx-1 ${
              pageNumber === page
                ? 'bg-primarycolor border-primarycolor text-white '
                : ''
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() =>
            pageNumber < totalPages &&
            updateFilters({ pageNumber: pageNumber + 1 })
          }
          className={`rounded-full w-8 h-8 flex justify-center items-center px-1.5 py-1 text-sm border mx-0.5 sm:mx-1 hover:bg-bgBtnGray ${
            pageNumber === totalPages || totalPages === 0
              ? 'cursor-not-allowed opacity-50'
              : ''
          }`}
          disabled={pageNumber === totalPages || totalPages === 0}
        >
          <i className="icon icon-right text-xs" />
        </button>
        <button
          onClick={() => updateFilters({ pageNumber: totalPages })}
          className={`rounded-full w-8 h-8 flex justify-center items-center px-1.5 py-1 text-sm border mx-0.5 sm:mx-1 hover:bg-bgBtnGray ${
            pageNumber === totalPages || totalPages === 0
              ? 'cursor-not-allowed opacity-50'
              : ''
          }`}
          disabled={pageNumber === totalPages || totalPages === 0}
        >
          <i className="icon icon-double-right text-xs" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
