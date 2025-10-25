(function attachMetricsHelpers(global) {
    function computePieceDistance(sourceCanvas, targetCanvas, sourceSlot, sourceRotation, targetSlot) {
        if (!sourceCanvas || !targetCanvas) {
            return Number.POSITIVE_INFINITY;
        }

        const rows = parseInt(sourceCanvas.dataset.rows, 10);
        const cols = parseInt(sourceCanvas.dataset.cols, 10);
        const targetRows = parseInt(targetCanvas.dataset.rows, 10);
        const targetCols = parseInt(targetCanvas.dataset.cols, 10);

        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
            return Number.POSITIVE_INFINITY;
        }

        if (rows !== targetRows || cols !== targetCols) {
            return Number.POSITIVE_INFINITY;
        }

        const totalPieces = rows * cols;
        if (!Number.isInteger(sourceSlot) || sourceSlot < 0 || sourceSlot >= totalPieces) {
            return Number.POSITIVE_INFINITY;
        }
        if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= totalPieces) {
            return Number.POSITIVE_INFINITY;
        }

        const pieceSize = Math.round(sourceCanvas.width / cols);
        if (!pieceSize) {
            return Number.POSITIVE_INFINITY;
        }

        const normalizedRotation = mod(sourceRotation, 4);

        const srcCtx = sourceCanvas.getContext("2d");
        const tgtCtx = targetCanvas.getContext("2d");

        const sourceCol = sourceSlot % cols;
        const sourceRow = Math.floor(sourceSlot / cols);
        const targetCol = targetSlot % cols;
        const targetRow = Math.floor(targetSlot / cols);

        const srcImageData = srcCtx.getImageData(sourceCol * pieceSize, sourceRow * pieceSize, pieceSize, pieceSize);
        const tgtImageData = tgtCtx.getImageData(targetCol * pieceSize, targetRow * pieceSize, pieceSize, pieceSize);

        return computePieceDistanceFromBuffers(srcImageData.data, tgtImageData.data, pieceSize, normalizedRotation);
    }

    function computeArrangementAverageDistance(sourceCanvas, targetCanvas, arrangement) {
        if (!Array.isArray(arrangement) || !arrangement.length) {
            return Number.POSITIVE_INFINITY;
        }

        const rows = parseInt(sourceCanvas.dataset.rows, 10);
        const cols = parseInt(sourceCanvas.dataset.cols, 10);
        const targetRows = parseInt(targetCanvas.dataset.rows, 10);
        const targetCols = parseInt(targetCanvas.dataset.cols, 10);
        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
            return Number.POSITIVE_INFINITY;
        }
        if (rows !== targetRows || cols !== targetCols) {
            return Number.POSITIVE_INFINITY;
        }
        const totalPieces = rows * cols;

        if (arrangement.length !== totalPieces) {
            return Number.POSITIVE_INFINITY;
        }

        let cumulative = 0;
        let countedPieces = 0;

        for (let i = 0; i < arrangement.length; i += 1) {
            const entry = arrangement[i];
            if (!Array.isArray(entry) || entry.length < 2) {
                continue;
            }
            const [targetSlot, rotation] = entry;
            const pieceDistance = computePieceDistance(sourceCanvas, targetCanvas, i, rotation, targetSlot);
            if (!Number.isFinite(pieceDistance)) {
                continue;
            }
            cumulative += pieceDistance;
            countedPieces += 1;
        }

        if (!countedPieces) {
            return Number.POSITIVE_INFINITY;
        }

        return cumulative / countedPieces;
    }

    function computeBestRotationForSlot(sourceCanvas, targetCanvas, sourceSlot, targetSlot) {
        const rows = parseInt(sourceCanvas.dataset.rows, 10);
        const cols = parseInt(sourceCanvas.dataset.cols, 10);
        const targetRows = parseInt(targetCanvas.dataset.rows, 10);
        const targetCols = parseInt(targetCanvas.dataset.cols, 10);

        if (
            !Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 ||
            rows !== targetRows || cols !== targetCols
        ) {
            return { rotation: 0, distance: Number.POSITIVE_INFINITY };
        }

        const totalPieces = rows * cols;
        if (
            !Number.isInteger(sourceSlot) || sourceSlot < 0 || sourceSlot >= totalPieces ||
            !Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= totalPieces
        ) {
            return { rotation: 0, distance: Number.POSITIVE_INFINITY };
        }

        let bestRotation = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let rotation = 0; rotation < 4; rotation += 1) {
            const distance = computePieceDistance(sourceCanvas, targetCanvas, sourceSlot, rotation, targetSlot);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestRotation = rotation;
            }
        }

        return { rotation: bestRotation, distance: bestDistance };
    }

    function computeDistanceAndRotationMatrices(sourceCanvas, targetCanvas) {
        const rows = parseInt(sourceCanvas.dataset.rows, 10);
        const cols = parseInt(sourceCanvas.dataset.cols, 10);
        const targetRows = parseInt(targetCanvas.dataset.rows, 10);
        const targetCols = parseInt(targetCanvas.dataset.cols, 10);

        if (
            !Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 ||
            rows !== targetRows || cols !== targetCols
        ) {
            return {
                distanceMatrix: [],
                rotationMatrix: []
            };
        }

        const totalPieces = rows * cols;
        const distanceMatrix = Array.from({ length: totalPieces }, () => new Array(totalPieces).fill(Number.POSITIVE_INFINITY));
        const rotationMatrix = Array.from({ length: totalPieces }, () => new Array(totalPieces).fill(0));

        for (let sourceSlot = 0; sourceSlot < totalPieces; sourceSlot += 1) {
            for (let targetSlot = 0; targetSlot < totalPieces; targetSlot += 1) {
                const { rotation, distance } = computeBestRotationForSlot(
                    sourceCanvas,
                    targetCanvas,
                    sourceSlot,
                    targetSlot
                );
                rotationMatrix[sourceSlot][targetSlot] = rotation;
                distanceMatrix[sourceSlot][targetSlot] = distance;
            }
        }

        return { distanceMatrix, rotationMatrix };
    }

    function computeDistanceAndRotationMatricesAsync(sourceCanvas, targetCanvas, options = {}) {
        const rows = parseInt(sourceCanvas.dataset.rows, 10);
        const cols = parseInt(sourceCanvas.dataset.cols, 10);
        const targetRows = parseInt(targetCanvas.dataset.rows, 10);
        const targetCols = parseInt(targetCanvas.dataset.cols, 10);

        if (
            !Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 ||
            rows !== targetRows || cols !== targetCols
        ) {
            return Promise.resolve({
                distanceMatrix: [],
                rotationMatrix: []
            });
        }

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        if (!width || !height || targetCanvas.width !== width || targetCanvas.height !== height) {
            return Promise.resolve({
                distanceMatrix: [],
                rotationMatrix: []
            });
        }

        const totalPieces = rows * cols;
        const pieceSize = Math.round(width / cols);
        if (!pieceSize) {
            return Promise.resolve({
                distanceMatrix: [],
                rotationMatrix: []
            });
        }

        const maxChunkMs = typeof options.maxChunkMs === "number" && options.maxChunkMs > 0
            ? options.maxChunkMs
            : 12;
        const chunkSize = Math.max(1, Number.isInteger(options.chunkSize) ? options.chunkSize : Math.ceil(totalPieces / 12));

        const signal = options.signal;

        const distanceMatrix = Array.from({ length: totalPieces }, () => new Array(totalPieces).fill(Number.POSITIVE_INFINITY));
        const rotationMatrix = Array.from({ length: totalPieces }, () => new Array(totalPieces).fill(0));

        const sourceCtx = sourceCanvas.getContext("2d");
        const targetCtx = targetCanvas.getContext("2d");

        let sourceBuffers;
        let targetBuffers;

        try {
            sourceBuffers = extractPieceBuffers(sourceCtx, pieceSize, rows, cols, signal);
            targetBuffers = extractPieceBuffers(targetCtx, pieceSize, rows, cols, signal);
        } catch (error) {
            if (error && error.name === "AbortError") {
                return Promise.reject(error);
            }
            return Promise.reject(error);
        }

        return new Promise((resolve, reject) => {
            if (signal && signal.aborted) {
                reject(createAbortError());
                return;
            }

            let sourceSlot = 0;
            let scheduledHandle = null;
            let cancelled = false;

            const cleanup = () => {
                if (signal) {
                    signal.removeEventListener("abort", onAbort);
                }
                if (scheduledHandle !== null) {
                    clearTimeout(scheduledHandle);
                    scheduledHandle = null;
                }
            };

            const onAbort = () => {
                cancelled = true;
                cleanup();
                reject(createAbortError());
            };

            if (signal) {
                signal.addEventListener("abort", onAbort);
            }

            const processChunk = () => {
                scheduledHandle = null;
                if (cancelled) {
                    return;
                }

                try {
                    const start = performance.now();
                    let processed = 0;

                    while (sourceSlot < totalPieces && processed < chunkSize) {
                        if (signal && signal.aborted) {
                            onAbort();
                            return;
                        }

                        const srcBuffer = sourceBuffers[sourceSlot];

                        for (let targetSlot = 0; targetSlot < totalPieces; targetSlot += 1) {
                            const tgtBuffer = targetBuffers[targetSlot];

                            let bestRotation = 0;
                            let bestDistance = Number.POSITIVE_INFINITY;

                            for (let rotation = 0; rotation < 4; rotation += 1) {
                                const distance = computePieceDistanceFromBuffers(srcBuffer, tgtBuffer, pieceSize, rotation);
                                if (distance < bestDistance) {
                                    bestDistance = distance;
                                    bestRotation = rotation;
                                }
                            }

                            rotationMatrix[sourceSlot][targetSlot] = bestRotation;
                            distanceMatrix[sourceSlot][targetSlot] = bestDistance;
                        }

                        sourceSlot += 1;
                        processed += 1;

                        if (performance.now() - start >= maxChunkMs) {
                            break;
                        }
                    }

                    if (sourceSlot < totalPieces) {
                        scheduledHandle = setTimeout(processChunk, 0);
                    } else {
                        cleanup();
                        resolve({ distanceMatrix, rotationMatrix });
                    }
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };

            scheduledHandle = setTimeout(processChunk, 0);
        });
    }

    function rotateCoord(x, y, size, rotation) {
        switch (rotation % 4) {
            case 1:
                return { x: y, y: size - 1 - x };
            case 2:
                return { x: size - 1 - x, y: size - 1 - y };
            case 3:
                return { x: size - 1 - y, y: x };
            default:
                return { x, y };
        }
    }

    function toGrayscale(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    function computePieceDistanceFromBuffers(srcBuffer, tgtBuffer, pieceSize, rotation) {
        if (!srcBuffer || !tgtBuffer || pieceSize <= 0) {
            return Number.POSITIVE_INFINITY;
        }

        const normalizedRotation = mod(rotation, 4);
        let sumSquares = 0;
        const pixelCount = pieceSize * pieceSize;

        for (let y = 0; y < pieceSize; y += 1) {
            for (let x = 0; x < pieceSize; x += 1) {
                const rotated = rotateCoord(x, y, pieceSize, normalizedRotation);
                const srcIndex = (rotated.y * pieceSize + rotated.x) * 4;
                const tgtIndex = (y * pieceSize + x) * 4;

                if (
                    srcIndex < 0 ||
                    srcIndex + 3 >= srcBuffer.length ||
                    tgtIndex < 0 ||
                    tgtIndex + 3 >= tgtBuffer.length
                ) {
                    continue;
                }

                const srcGray = toGrayscale(srcBuffer[srcIndex], srcBuffer[srcIndex + 1], srcBuffer[srcIndex + 2]);
                const tgtGray = toGrayscale(tgtBuffer[tgtIndex], tgtBuffer[tgtIndex + 1], tgtBuffer[tgtIndex + 2]);
                const diff = srcGray - tgtGray;
                sumSquares += diff * diff;
            }
        }

        return sumSquares / pixelCount;
    }

    function extractPieceBuffers(ctx, pieceSize, rows, cols, signal) {
        const totalPieces = rows * cols;
        const buffers = new Array(totalPieces);

        for (let index = 0; index < totalPieces; index += 1) {
            if (signal && signal.aborted) {
                throw createAbortError();
            }

            const row = Math.floor(index / cols);
            const col = index % cols;
            const imageData = ctx.getImageData(col * pieceSize, row * pieceSize, pieceSize, pieceSize);
            buffers[index] = imageData.data;
        }

        return buffers;
    }

    function createAbortError() {
        try {
            return new DOMException("Aborted", "AbortError");
        } catch (error) {
            const fallback = new Error("Aborted");
            fallback.name = "AbortError";
            return fallback;
        }
    }

    function mod(value, divisor) {
        const normalizedDivisor = divisor || 1;
        return ((value % normalizedDivisor) + normalizedDivisor) % normalizedDivisor;
    }

    global.PuzzleMetrics = {
        computePieceDistance,
        computeArrangementAverageDistance,
        computeBestRotationForSlot,
        computeDistanceAndRotationMatrices,
        computeDistanceAndRotationMatricesAsync
    };
})(window);
