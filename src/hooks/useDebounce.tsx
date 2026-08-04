import { useState, useEffect } from 'react';

/**
 * Holds a value back until it stops changing for `delay` ms.
 *
 * Generic rather than `any`: every caller debounces a search string and hands the result to
 * a typed filter, so an untyped return quietly erased the type at each call site and let a
 * mistake through the compiler.
 */
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default useDebounce;
