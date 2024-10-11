export const splitAtIndex = <
  T extends { slice: (start?: number, end?: number) => T }, // LOL I AM GENIUS
>(xs: T, index: number): [T, T] => {
  return [
    xs.slice(0, index),
    xs.slice(index),
  ];
};
