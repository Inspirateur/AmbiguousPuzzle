(function () {
  function applyArrangement(imageData, rows, cols, arrangement) {
    if (!imageData) {
      return null;
    }

    const width = imageData.width;
    const height = imageData.height;
    const pieceCount = rows * cols;

    if (!Array.isArray(arrangement) || arrangement.length !== pieceCount) {
      return null;
    }

    const computeStops = window.tileMath?.computeStops;
    if (typeof computeStops !== 'function') {
      return null;
    }

    const output = new ImageData(width, height);
    const destData = output.data;
    const sourceData = imageData.data;
    const colStops = computeStops(width, cols);
    const rowStops = computeStops(height, rows);

    for (let pieceRow = 0; pieceRow < rows; pieceRow += 1) {
      const rowStart = rowStops[pieceRow];
      const rowEnd = rowStops[pieceRow + 1];
      const tileHeight = rowEnd - rowStart;
      for (let pieceCol = 0; pieceCol < cols; pieceCol += 1) {
        const colStart = colStops[pieceCol];
        const colEnd = colStops[pieceCol + 1];
        const tileWidth = colEnd - colStart;
        const pieceIndex = pieceRow * cols + pieceCol;
        const entry = arrangement[pieceIndex];
        const slotIndex = Array.isArray(entry) ? entry[0] : pieceIndex;
        const rotation = Array.isArray(entry) ? entry[1] & 3 : 0;

        const slotCol = Math.max(0, Math.min(cols - 1, slotIndex % cols));
        const slotRow = Math.max(0, Math.min(rows - 1, Math.floor(slotIndex / cols)));
        const slotColStart = colStops[slotCol];
        const slotColEnd = colStops[slotCol + 1];
        const slotRowStart = rowStops[slotRow];
        const slotRowEnd = rowStops[slotRow + 1];
        const slotWidth = Math.max(1, slotColEnd - slotColStart);
        const slotHeight = Math.max(1, slotRowEnd - slotRowStart);

        for (let localY = 0; localY < tileHeight; localY += 1) {
          const destY = rowStart + localY;
          const v = tileHeight > 1 ? (localY + 0.5) / tileHeight : 0.5;
          for (let localX = 0; localX < tileWidth; localX += 1) {
            const destX = colStart + localX;
            const u = tileWidth > 1 ? (localX + 0.5) / tileWidth : 0.5;
            const destOffset = (destY * width + destX) * 4;

            const [rotU, rotV] = rotateUV(u, v, rotation);
            const srcX = slotColStart + clampToInt(rotU, slotWidth);
            const srcY = slotRowStart + clampToInt(rotV, slotHeight);
            const srcOffset = (srcY * width + srcX) * 4;

            destData[destOffset] = sourceData[srcOffset];
            destData[destOffset + 1] = sourceData[srcOffset + 1];
            destData[destOffset + 2] = sourceData[srcOffset + 2];
            destData[destOffset + 3] = sourceData[srcOffset + 3];
          }
        }
      }
    }

    return output;
  }

  function rotateUV(u, v, rotation) {
    switch (rotation & 3) {
      case 1:
        return [1 - v, u];
      case 2:
        return [1 - u, 1 - v];
      case 3:
        return [v, 1 - u];
      default:
        return [u, v];
    }
  }

  function clampToInt(value, span) {
    if (span <= 1) {
      return 0;
    }
    const scaled = Math.floor(value * span);
    return Math.max(0, Math.min(span - 1, scaled));
  }

  window.rearranger = {
    applyArrangement
  };
})();
