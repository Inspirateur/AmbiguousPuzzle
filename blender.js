(function () {
  function blendWithArrangement(primary, secondary, rows, cols, arrangement) {
    if (!primary || !secondary) {
      return null;
    }
    if (primary.width !== secondary.width || primary.height !== secondary.height) {
      return null;
    }

    const pieceCount = rows * cols;

    if (!Array.isArray(arrangement) || arrangement.length !== pieceCount) {
      return null;
    }

  const reversed = reverseArrangement(arrangement);
    if (!reversed) {
      return null;
    }

  const scrambledSecondary = applyArrangementToImage(secondary, rows, cols, reversed);
    if (!scrambledSecondary) {
      return null;
    }

    const width = primary.width;
    const height = primary.height;
    const output = new ImageData(width, height);
    const destData = output.data;
    const primaryData = primary.data;
    const scrambledData = scrambledSecondary.data;

    for (let offset = 0; offset < destData.length; offset += 4) {
      destData[offset] = averageChannel(primaryData[offset], scrambledData[offset]);
      destData[offset + 1] = averageChannel(primaryData[offset + 1], scrambledData[offset + 1]);
      destData[offset + 2] = averageChannel(primaryData[offset + 2], scrambledData[offset + 2]);
      destData[offset + 3] = 0xff;
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

  function averageChannel(a, b) {
    return (a + b) >> 1;
  }

  function reverseArrangement(arrangement) {
    if (!Array.isArray(arrangement)) {
      return null;
    }

    const pieceCount = arrangement.length;

    const reversed = new Array(pieceCount);

    for (let pieceIndex = 0; pieceIndex < pieceCount; pieceIndex += 1) {
      const entry = arrangement[pieceIndex];
      if (!Array.isArray(entry) || entry.length === 0) {
        return null;
      }

      const slotIndex = entry[0];
      if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex >= pieceCount) {
        return null;
      }

      const rotation = entry.length > 1 ? entry[1] : 0;
      const inverseRotation = (4 - (rotation & 3)) & 3;
      reversed[slotIndex] = [pieceIndex, inverseRotation];
    }

    if (reversed.some((entry) => !entry)) {
      return null;
    }

    return reversed;
  }

  function applyArrangementToImage(imageData, rows, cols, arrangement) {
    if (!imageData) {
      return null;
    }

    const width = imageData.width;
    const height = imageData.height;
    const pieceCount = rows * cols;

    if (!Array.isArray(arrangement) || arrangement.length !== pieceCount) {
      return null;
    }

    const output = new ImageData(width, height);
    const destData = output.data;
    const sourceData = imageData.data;
    const computeStops = window.tileMath?.computeStops;
    if (typeof computeStops !== 'function') {
      return null;
    }

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
        if (!Array.isArray(entry)) {
          continue;
        }

        const slotIndex = entry[0];
        const rotation = entry.length > 1 ? entry[1] & 3 : 0;

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

  window.blender = {
    blendWithArrangement
  };
})();
