// A piece arrangement is an array of entries [int targetSlot, int rotationQuarterSteps].
// Thanks to our preprocessing every piece is square.
(function attachArrangementHelpers(global) {
    function computeOptimalArrangement(sourceCanvas, targetCanvas, rows, cols) {
        if (!sourceCanvas || !targetCanvas) {
            return [];
        }

        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
            return [];
        }

        const totalPieces = rows * cols;
        const metrics = global.PuzzleMetrics;
        const solver = global.AssignmentSolver;

        if (!metrics || !solver || typeof metrics.computeDistanceAndRotationMatrices !== "function") {
            return [];
        }

        const { distanceMatrix, rotationMatrix } = metrics.computeDistanceAndRotationMatrices(sourceCanvas, targetCanvas);
        return buildArrangement(distanceMatrix, rotationMatrix, totalPieces, solver);
    }

    function computeOptimalArrangementAsync(sourceCanvas, targetCanvas, rows, cols, options = {}) {
        if (!sourceCanvas || !targetCanvas) {
            return Promise.resolve([]);
        }

        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
            return Promise.resolve([]);
        }

        const totalPieces = rows * cols;
        const metrics = global.PuzzleMetrics;
        const solver = global.AssignmentSolver;

        if (!metrics || !solver || typeof metrics.computeDistanceAndRotationMatricesAsync !== "function") {
            return Promise.resolve([]);
        }

        return metrics.computeDistanceAndRotationMatricesAsync(sourceCanvas, targetCanvas, options)
            .then(({ distanceMatrix, rotationMatrix }) => (
                buildArrangement(distanceMatrix, rotationMatrix, totalPieces, solver)
            ));
    }

    function invertArrangement(arrangement) {
        if (!Array.isArray(arrangement)) {
            return [];
        }

        const inverted = new Array(arrangement.length);

        arrangement.forEach((entry, sourceIndex) => {
            if (!Array.isArray(entry) || entry.length < 2) {
                return;
            }
            const [targetIndex, rotationRaw] = entry;
            if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= arrangement.length) {
                return;
            }

            const normalizedRotation = mod(rotationRaw, 4);
            const reverseRotation = mod(-normalizedRotation, 4);

            inverted[targetIndex] = [sourceIndex, reverseRotation];
        });

        for (let i = 0; i < inverted.length; i += 1) {
            if (!Array.isArray(inverted[i])) {
                inverted[i] = [i, 0];
            }
        }

        return inverted;
    }

    function applyArrangementToCanvas(sourceCanvas, rows, cols, arrangement, destinationCanvas) {
        if (!sourceCanvas || !destinationCanvas) {
            return;
        }

        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
            return;
        }

        if (!Array.isArray(arrangement) || arrangement.length !== rows * cols) {
            destinationCanvas.width = sourceCanvas.width;
            destinationCanvas.height = sourceCanvas.height;
            const destCtx = destinationCanvas.getContext("2d");
            destCtx.clearRect(0, 0, destinationCanvas.width, destinationCanvas.height);
            destCtx.drawImage(sourceCanvas, 0, 0);
            return;
        }

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        if (!width || !height) {
            return;
        }

        const pieceWidth = width / cols;
        const pieceHeight = height / rows;

        destinationCanvas.width = width;
        destinationCanvas.height = height;
        const destCtx = destinationCanvas.getContext("2d");
        destCtx.save();
        destCtx.setTransform(1, 0, 0, 1, 0, 0);
        destCtx.clearRect(0, 0, width, height);

        arrangement.forEach((entry, sourceIndex) => {
            if (!Array.isArray(entry) || entry.length < 2) {
                return;
            }

            const [targetIndex, rotationRaw] = entry;
            const targetRow = Math.floor(targetIndex / cols);
            const targetCol = targetIndex % cols;
            const dstCenterX = targetCol * pieceWidth + pieceWidth / 2;
            const dstCenterY = targetRow * pieceHeight + pieceHeight / 2;

            const srcRow = Math.floor(sourceIndex / cols);
            const srcCol = sourceIndex % cols;
            const srcX = srcCol * pieceWidth;
            const srcY = srcRow * pieceHeight;

            const rotationQuarterSteps = mod(rotationRaw, 4);

            destCtx.save();
            destCtx.translate(dstCenterX, dstCenterY);
            destCtx.rotate(rotationQuarterSteps * (Math.PI / 2));
            destCtx.drawImage(
                sourceCanvas,
                srcX,
                srcY,
                pieceWidth,
                pieceHeight,
                -pieceWidth / 2,
                -pieceHeight / 2,
                pieceWidth,
                pieceHeight
            );
            destCtx.restore();
        });

        destCtx.restore();
    }

    function buildArrangement(distanceMatrix, rotationMatrix, totalPieces, solver) {
        if (
            !Array.isArray(distanceMatrix) ||
            distanceMatrix.length !== totalPieces ||
            !Array.isArray(rotationMatrix) ||
            rotationMatrix.length !== totalPieces ||
            !solver || typeof solver.solveAssignment !== "function"
        ) {
            return [];
        }

        const solution = solver.solveAssignment(distanceMatrix);
        if (!solution || !Array.isArray(solution.assignment) || solution.assignment.length !== totalPieces) {
            return [];
        }

        const arrangement = new Array(totalPieces);

        solution.assignment.forEach(({ sourceIndex, targetIndex }) => {
            if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= totalPieces) {
                return;
            }

            let resolvedTarget = targetIndex;
            if (!Number.isInteger(resolvedTarget) || resolvedTarget < 0 || resolvedTarget >= totalPieces) {
                resolvedTarget = sourceIndex;
            }

            const rotationMatrixRow = rotationMatrix[sourceIndex] || [];
            let rotation = rotationMatrixRow[resolvedTarget];
            if (!Number.isInteger(rotation)) {
                rotation = 0;
            }

            arrangement[sourceIndex] = [resolvedTarget, mod(rotation, 4)];
        });

        for (let i = 0; i < arrangement.length; i += 1) {
            if (!Array.isArray(arrangement[i])) {
                arrangement[i] = [i, 0];
            }
        }

        return arrangement;
    }

    function mod(value, divisor) {
        const normalizedDivisor = divisor || 1;
        return ((value % normalizedDivisor) + normalizedDivisor) % normalizedDivisor;
    }

    global.PuzzleArrangements = {
        computeOptimalArrangement,
        computeOptimalArrangementAsync,
        invertArrangement,
        applyArrangementToCanvas
    };
})(window);
