import { useEffect, useState } from 'react';

interface SearchBoxProps {
  onSearch: (query: string) => void;
  searchVal?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({ onSearch, searchVal = '' }) => {
  const [query, setQuery] = useState(searchVal);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    
    // Only search if the value doesn't end with a space
    if (!value.endsWith(' ')) {
      onSearch(value);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Search on Enter key press, trimming any trailing spaces
      onSearch(query.trim());
    }
  };

  useEffect(() => {
    if (searchVal) {
      setQuery(searchVal);
    }
  }, [searchVal]);

  return (
    <div className="relative  flex items-center h-[40px] w-full  lg:w-fit text-sm">
      <input
        type="text"
        value={query}
        placeholder="Search by name..."
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        className="h-[40px] pr-10 focus:outline-none bg-transparent text-sm border-b"
      />
      <button
        className="absolute right-0 top-0 h-full py-2 pl-3 text-gray-500 flex items-center justify-center focus:outline-none  text-sm bg-transparent"
        disabled
      >
        <i className="icon icon-search text-sm" />
      </button>
    </div>
  );
};

export default SearchBox;
