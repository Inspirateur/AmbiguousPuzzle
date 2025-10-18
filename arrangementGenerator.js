(function () {
  function createArrangement(imageA, imageB, rows, cols) {
    const pieceCount = Math.max(0, rows * cols);
    if (!pieceCount || !imageA || !imageB) {
      return [];
    }

    if (imageA.width !== imageB.width || imageA.height !== imageB.height) {
      return [];
    }

    const computeStops = window.tileMath?.computeStops;
    if (typeof computeStops !== 'function') {
      return [];
    }

    const width = imageA.width;
    const height = imageA.height;
    const colStops = computeStops(width, cols);
    const rowStops = computeStops(height, rows);

    const brightnessA = measureTileBrightness(imageA, rows, cols, rowStops, colStops);
    const brightnessB = measureTileBrightness(imageB, rows, cols, rowStops, colStops);

    const sortedA = brightnessA
      .map((value, index) => ({ index, value }))
      .sort((lhs, rhs) => lhs.value - rhs.value);
    const sortedB = brightnessB
      .map((value, index) => ({ index, value }))
      .sort((lhs, rhs) => lhs.value - rhs.value);

    const arrangement = new Array(pieceCount);
    for (let i = 0; i < pieceCount; i += 1) {
      const destIndex = sortedA[i].index;
      const slotIndex = sortedB[i].index;
      arrangement[destIndex] = [slotIndex, 0];
    }

    return arrangement;
  }

  function measureTileBrightness(imageData, rows, cols, rowStops, colStops) {
    const result = new Array(rows * cols).fill(0);
    const data = imageData.data;
    const width = imageData.width;

    for (let pieceRow = 0; pieceRow < rows; pieceRow += 1) {
      const rowStart = rowStops[pieceRow];
      const rowEnd = rowStops[pieceRow + 1];
      const tileHeight = Math.max(1, rowEnd - rowStart);
      for (let pieceCol = 0; pieceCol < cols; pieceCol += 1) {
        const colStart = colStops[pieceCol];
        const colEnd = colStops[pieceCol + 1];
        const tileWidth = Math.max(1, colEnd - colStart);
        const tilePixelCount = tileWidth * tileHeight;
        let sum = 0;

        for (let y = rowStart; y < rowEnd; y += 1) {
          for (let x = colStart; x < colEnd; x += 1) {
            const offset = (y * width + x) * 4;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            sum += (r * 0.299 + g * 0.587 + b * 0.114);
          }
        }

        const pieceIndex = pieceRow * cols + pieceCol;
        result[pieceIndex] = sum / tilePixelCount;
      }
    }

    return result;
  }

  window.arrangementGenerator = {
    createArrangement
  };
})();
