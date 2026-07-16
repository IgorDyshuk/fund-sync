const coinColors = [
  "#4f7ee8",
  "#3ba6bd",
  "#38b982",
  "#88b92d",
  "#d3c64d",
  "#f0a93c",
  "#e77e67",
  "#e45d7a",
];

export function getMonthlyCoinColor(index: number) {
  return coinColors[index % coinColors.length];
}
