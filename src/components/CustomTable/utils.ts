export const sortNumber = (
  direction: 'asc' | 'desc',
  valueA: number,
  valueB: number,
) => {
  return direction === 'asc'
    ? (valueA as number) - (valueB as number)
    : (valueB as number) - (valueA as number);
};

export const sortDate = (
  direction: 'asc' | 'desc',
  valueA: string,
  valueB: string,
) => {
  return direction === 'asc'
    ? new Date(valueA as string).getTime() -
        new Date(valueB as string).getTime()
    : new Date(valueB as string).getTime() -
        new Date(valueA as string).getTime();
};

export const sortString = (
  direction: 'asc' | 'desc',
  valueA: string,
  valueB: string,
) => {
  return direction === 'asc'
    ? (valueA.toString()).localeCompare(valueB.toString())
    : (valueB.toString()).localeCompare(valueA.toString());
};
