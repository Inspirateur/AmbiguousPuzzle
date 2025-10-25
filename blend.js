(function attachBlendHelpers(global) {
    function blendArrangedImage(sourceCanvas, targetCanvas, arrangement) {
        if (!sourceCanvas || !targetCanvas || !Array.isArray(arrangement)) {
            return null;
        }

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        if (!width || !height || targetCanvas.width !== width || targetCanvas.height !== height) {
            return null;
        }

        const rows = parseInt(sourceCanvas.dataset.rows, 10);
        const cols = parseInt(sourceCanvas.dataset.cols, 10);
        const targetRows = parseInt(targetCanvas.dataset.rows, 10);
        const targetCols = parseInt(targetCanvas.dataset.cols, 10);

        if (
            !Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 ||
            rows !== targetRows || cols !== targetCols ||
            arrangement.length !== rows * cols
        ) {
            return null;
        }

        const pieceSize = width / cols;
        const tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = width;
        tmpCanvas.height = height;
        const tmpCtx = tmpCanvas.getContext("2d");
        tmpCtx.clearRect(0, 0, width, height);

        arrangement.forEach((entry, sourceIndex) => {
            if (!Array.isArray(entry) || entry.length < 2) {
                return;
            }

            const [targetIndex, rotationRaw] = entry;
            const sourceRow = Math.floor(sourceIndex / cols);
            const sourceCol = sourceIndex % cols;
            const srcX = sourceCol * pieceSize;
            const srcY = sourceRow * pieceSize;

            const targetRow = Math.floor(targetIndex / cols);
            const targetCol = targetIndex % cols;
            const dstCenterX = targetCol * pieceSize + pieceSize / 2;
            const dstCenterY = targetRow * pieceSize + pieceSize / 2;

            const rotationQuarterSteps = mod(rotationRaw, 4);

            tmpCtx.save();
            tmpCtx.translate(dstCenterX, dstCenterY);
            tmpCtx.rotate(rotationQuarterSteps * (Math.PI / 2));
            tmpCtx.drawImage(
                sourceCanvas,
                srcX,
                srcY,
                pieceSize,
                pieceSize,
                -pieceSize / 2,
                -pieceSize / 2,
                pieceSize,
                pieceSize
            );
            tmpCtx.restore();
        });

        const blendedCanvas = document.createElement("canvas");
        blendedCanvas.width = width;
        blendedCanvas.height = height;
        const blendedCtx = blendedCanvas.getContext("2d");
        blendedCtx.clearRect(0, 0, width, height);

        blendedCtx.globalAlpha = 1;
        blendedCtx.drawImage(targetCanvas, 0, 0);

    blendedCtx.globalAlpha = 0.5;
        blendedCtx.drawImage(tmpCanvas, 0, 0);
        blendedCtx.globalAlpha = 1;

    blendedCanvas.dataset.rows = String(rows);
    blendedCanvas.dataset.cols = String(cols);

        return blendedCanvas;
    }

    function mod(value, divisor) {
        const normalizedDivisor = divisor || 1;
        return ((value % normalizedDivisor) + normalizedDivisor) % normalizedDivisor;
    }

    global.PuzzleBlend = {
        blendArrangedImage
    };
})(window);
