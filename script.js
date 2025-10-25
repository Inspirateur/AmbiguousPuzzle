const formatSelect = document.getElementById("formatSelect");
const pieceSelect = document.getElementById("pieceSelect");
const fileInputA = document.getElementById("fileInputA");
const fileInputB = document.getElementById("fileInputB");
const canvasA = document.getElementById("canvasA");
const canvasB = document.getElementById("canvasB");
const metaA = document.getElementById("metaA");
const metaB = document.getElementById("metaB");
const arrangementCanvasA = document.getElementById("arrangementCanvasA");
const arrangementCanvasB = document.getElementById("arrangementCanvasB");
const arrangementMetaA = document.getElementById("arrangementMetaA");
const arrangementMetaB = document.getElementById("arrangementMetaB");
const loadingIndicatorA = document.getElementById("loadingIndicatorA");
const loadingIndicatorB = document.getElementById("loadingIndicatorB");

const puzzleOptions = {
    "4x6": { rows: 6, cols: 4 },
    "6x9": { rows: 9, cols: 6 },
    "8x12": { rows: 12, cols: 8 },
    "10x15": { rows: 15, cols: 10 }
};

const loadedImages = [null, null];

const resolutionHelpers = window.PuzzleResolution;

if (!resolutionHelpers) {
    throw new Error("PuzzleResolution helpers failed to load. Ensure resolution.js is included before script.js.");
}

const {
    computeCropDimensions,
    snapToGrid,
    drawProcessedImage,
    clearCanvas
} = resolutionHelpers;

const arrangementHelpers = window.PuzzleArrangements;

if (!arrangementHelpers) {
    throw new Error("PuzzleArrangements helpers failed to load. Ensure arrangements.js is included before script.js.");
}

const {
    computeOptimalArrangement,
    computeOptimalArrangementAsync,
    invertArrangement,
    applyArrangementToCanvas
} = arrangementHelpers;

const metricsHelpers = window.PuzzleMetrics;

if (!metricsHelpers) {
    throw new Error("PuzzleMetrics helpers failed to load. Ensure metrics.js is included before script.js.");
}

const {
    computeArrangementAverageDistance
} = metricsHelpers;

const blendHelpers = window.PuzzleBlend;

if (!blendHelpers) {
    throw new Error("PuzzleBlend helpers failed to load. Ensure blend.js is included before script.js.");
}

const { blendArrangedImage } = blendHelpers;

let pendingArrangementHandle = null;
let pendingArrangementUsesIdle = false;
let latestArrangementConfig = null;
let currentArrangement = null;
let arrangementAbortController = null;
let arrangementPromise = null;

function drawCanvasToDestination(sourceCanvas, destinationCanvas) {
    if (!sourceCanvas || !destinationCanvas) {
        return;
    }

    destinationCanvas.width = sourceCanvas.width;
    destinationCanvas.height = sourceCanvas.height;
    const destCtx = destinationCanvas.getContext("2d");
    destCtx.clearRect(0, 0, destinationCanvas.width, destinationCanvas.height);
    destCtx.drawImage(sourceCanvas, 0, 0);
}

function setCanvasGridMetadata(canvas, rows, cols) {
    if (!canvas) {
        return;
    }

    if (Number.isInteger(rows) && Number.isInteger(cols) && rows > 0 && cols > 0) {
        canvas.dataset.rows = String(rows);
        canvas.dataset.cols = String(cols);
    } else {
        delete canvas.dataset.rows;
        delete canvas.dataset.cols;
    }
}

function formatDistanceValue(distance) {
    if (Number.isFinite(distance)) {
        return distance.toFixed(2);
    }
    return "N/A";
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

function createAbortController() {
    if (typeof AbortController === "function") {
        return new AbortController();
    }

    let aborted = false;
    const signal = {
        get aborted() {
            return aborted;
        },
        addEventListener() {},
        removeEventListener() {}
    };

    return {
        abort() {
            aborted = true;
        },
        signal
    };
}

function setLoadingState(showA, showB) {
    toggleLoadingIndicator(loadingIndicatorA, showA);
    toggleLoadingIndicator(loadingIndicatorB, showB);
}

function toggleLoadingIndicator(indicator, show) {
    if (!indicator) {
        return;
    }

    const active = Boolean(show);
    indicator.classList.toggle("active", active);
    indicator.hidden = !active;
    indicator.setAttribute("aria-hidden", active ? "false" : "true");
    indicator.style.display = active ? "flex" : "";
}

function getPuzzleDimensions() {
            setLoadingState(false, false);
    const selected = pieceSelect.value;
    const base = puzzleOptions[selected];
    if (!base) {
        return { rows: 4, cols: 6 };
    }

    if (formatSelect.value === "landscape") {
        return { rows: base.cols, cols: base.rows };
    }

    return { rows: base.rows, cols: base.cols };
}
function updateMeta(metaElement, resolution, pieceSize, message) {
    if (!resolution) {
        metaElement.textContent = message || "Awaiting image...";
        return;
    }

    const { width, height } = resolution;
    const pieceText = typeof pieceSize === "number"
        ? `${Math.round(pieceSize)} px`
        : "--";

    const baseText = `Resolution: ${Math.round(width)} × ${Math.round(height)} px | Piece size: ${pieceText}`;
    metaElement.textContent = message ? `${baseText} | ${message}` : baseText;
}

function cancelPendingArrangement() {
    if (pendingArrangementHandle !== null) {
        if (pendingArrangementUsesIdle && typeof window.cancelIdleCallback === "function") {
            window.cancelIdleCallback(pendingArrangementHandle);
        } else {
            window.clearTimeout(pendingArrangementHandle);
        }
    }

    pendingArrangementHandle = null;
    pendingArrangementUsesIdle = false;

    if (arrangementAbortController) {
        arrangementAbortController.abort();
        arrangementAbortController = null;
    }

    arrangementPromise = null;
}

function resetArrangementOutputs(messageA = "Awaiting both images...", messageB = messageA) {
    cancelPendingArrangement();
    latestArrangementConfig = null;
    currentArrangement = null;
    clearCanvas(arrangementCanvasA);
    clearCanvas(arrangementCanvasB);
    setCanvasGridMetadata(arrangementCanvasA);
    setCanvasGridMetadata(arrangementCanvasB);
    arrangementMetaA.textContent = messageA;
    arrangementMetaB.textContent = messageB;
    setLoadingState(false, false);
}

function scheduleArrangementProcessing(config) {
    cancelPendingArrangement();

    latestArrangementConfig = config;

    if (!config) {
        currentArrangement = null;
        return;
    }

    const { rows, cols } = config;
    if (Number.isInteger(rows) && Number.isInteger(cols)) {
        arrangementMetaA.textContent = `Computing ${cols} x ${rows} arrangement...`;
        arrangementMetaB.textContent = `Computing ${cols} x ${rows} arrangement...`;
    } else {
        arrangementMetaA.textContent = "Computing optimal arrangement...";
        arrangementMetaB.textContent = "Computing optimal arrangement...";
    }
    setLoadingState(true, true);

    const runner = () => {
        pendingArrangementHandle = null;
        pendingArrangementUsesIdle = false;
        runArrangementProcessing(config);
    };

    if (typeof window.requestIdleCallback === "function") {
        pendingArrangementUsesIdle = true;
        pendingArrangementHandle = window.requestIdleCallback(runner, { timeout: 500 });
    } else {
        pendingArrangementHandle = window.setTimeout(runner, 16);
    }
}

function runArrangementProcessing(config) {
    if (config !== latestArrangementConfig) {
        return;
    }

    const { rows, cols, pieceSize } = config;
    const effectivePieceCount = rows * cols;

    if (!Number.isInteger(effectivePieceCount) || effectivePieceCount <= 0) {
        resetArrangementOutputs("Unable to compute arrangement.");
        return;
    }

    if (!canvasA.width || !canvasA.height || !canvasB.width || !canvasB.height) {
        setLoadingState(false, false);
        return;
    }
        const abortController = createAbortController();
        arrangementAbortController = abortController;

    const asyncOptions = { signal: abortController.signal };

    const arrangementComputation = typeof computeOptimalArrangementAsync === "function"
        ? computeOptimalArrangementAsync(canvasA, canvasB, rows, cols, asyncOptions)
        : new Promise((resolve, reject) => {
            setTimeout(() => {
                if (abortController.signal.aborted) {
                    reject(createAbortError());
                    return;
                }
                try {
                    const arrangement = computeOptimalArrangement(canvasA, canvasB, rows, cols);
                    resolve(arrangement);
                } catch (error) {
                    reject(error);
                }
            }, 0);
        });

    arrangementPromise = arrangementComputation;

    arrangementComputation.then((arrangement) => {
        if (
            abortController.signal.aborted ||
            arrangementComputation !== arrangementPromise ||
            config !== latestArrangementConfig
        ) {
            return;
        }

        if (!Array.isArray(arrangement) || arrangement.length !== effectivePieceCount) {
            resetArrangementOutputs("Failed to compute arrangement.");
            return;
        }

        currentArrangement = arrangement;

        try {
            const blendedForward = blendArrangedImage(canvasA, canvasB, arrangement);
            if (blendedForward) {
                drawCanvasToDestination(blendedForward, arrangementCanvasB);
                const blendRows = Number.parseInt(blendedForward.dataset.rows, 10);
                const blendCols = Number.parseInt(blendedForward.dataset.cols, 10);
                setCanvasGridMetadata(
                    arrangementCanvasB,
                    Number.isInteger(blendRows) ? blendRows : rows,
                    Number.isInteger(blendCols) ? blendCols : cols
                );
            } else {
                applyArrangementToCanvas(canvasA, rows, cols, arrangement, arrangementCanvasB);
                setCanvasGridMetadata(arrangementCanvasB, rows, cols);
            }
            const forwardDistance = computeArrangementAverageDistance(canvasA, canvasB, arrangement);
            arrangementMetaB.textContent = `${cols} x ${rows} Arrangement for Image B | Avg distance: ${formatDistanceValue(forwardDistance)}`;

            const inverseArrangement = invertArrangement(arrangement);
            const blendedReverse = blendArrangedImage(canvasB, canvasA, inverseArrangement);
            if (blendedReverse) {
                drawCanvasToDestination(blendedReverse, arrangementCanvasA);
                const blendRows = Number.parseInt(blendedReverse.dataset.rows, 10);
                const blendCols = Number.parseInt(blendedReverse.dataset.cols, 10);
                setCanvasGridMetadata(
                    arrangementCanvasA,
                    Number.isInteger(blendRows) ? blendRows : rows,
                    Number.isInteger(blendCols) ? blendCols : cols
                );
            } else {
                applyArrangementToCanvas(canvasB, rows, cols, inverseArrangement, arrangementCanvasA);
                setCanvasGridMetadata(arrangementCanvasA, rows, cols);
            }
                const reverseDistance = computeArrangementAverageDistance(canvasB, canvasA, inverseArrangement);
                arrangementMetaA.textContent = `${cols} x ${rows} Arrangement for Image A | Avg distance:: ${formatDistanceValue(reverseDistance)}`;
        } catch (error) {
            console.error("Arrangement post-processing failed", error);
            resetArrangementOutputs("Arrangement processing failed.", "Arrangement processing failed.");
        }
    }).catch((error) => {
        if (abortController.signal.aborted || (error && error.name === "AbortError")) {
            return;
        }
        console.error("Arrangement processing failed", error);
        resetArrangementOutputs("Arrangement processing failed.", "Arrangement processing failed.");
    }).finally(() => {
        if (arrangementPromise === arrangementComputation) {
            arrangementPromise = null;
        }
        if (arrangementAbortController === abortController) {
            arrangementAbortController = null;
        }
        setLoadingState(false, false);
    });
}

function processImages() {
    const { rows, cols } = getPuzzleDimensions();
    const ratio = cols / rows;

    const prepared = loadedImages.map((data) => {
        if (!data) {
            return null;
        }
        const { width, height } = data;
        const crop = computeCropDimensions(width, height, ratio);
        return { ...data, crop };
    });

    const loadedCount = prepared.filter(Boolean).length;

    if (loadedCount === 0) {
        updateMeta(metaA, null, null);
        updateMeta(metaB, null, null);
        [canvasA, canvasB].forEach((canvas) => {
            clearCanvas(canvas);
            setCanvasGridMetadata(canvas);
        });
        resetArrangementOutputs();
        return;
    }

    if (loadedCount === 1) {
        prepared.forEach((imageData, index) => {
            const canvas = index === 0 ? canvasA : canvasB;
            const meta = index === 0 ? metaA : metaB;
            if (!imageData) {
                updateMeta(meta, null, null);
                clearCanvas(canvas);
                setCanvasGridMetadata(canvas);
                return;
            }

            const snapped = snapToGrid(imageData.crop, rows, cols);

            drawProcessedImage(canvas, imageData, snapped.width, snapped.height, imageData.crop);
            setCanvasGridMetadata(canvas, rows, cols);
            updateMeta(
                meta,
                { width: snapped.width, height: snapped.height },
                snapped.pieceSize,
                "Waiting for both images"
            );
        });
        resetArrangementOutputs();
        return;
    }

    const areas = prepared.map(({ crop }) => crop.width * crop.height);
    const maxAreaIndex = areas[0] >= areas[1] ? 0 : 1;
    const referenceCrop = prepared[maxAreaIndex].crop;
    const snappedReference = snapToGrid(referenceCrop, rows, cols);
    const { width: targetWidth, height: targetHeight, pieceSize } = snappedReference;

    prepared.forEach((imageData, index) => {
        drawProcessedImage(
            index === 0 ? canvasA : canvasB,
            imageData,
            targetWidth,
            targetHeight,
            imageData.crop
        );
        setCanvasGridMetadata(index === 0 ? canvasA : canvasB, rows, cols);
    });

    updateMeta(metaA, { width: targetWidth, height: targetHeight }, pieceSize);
    updateMeta(metaB, { width: targetWidth, height: targetHeight }, pieceSize);

    scheduleArrangementProcessing({
        rows,
        cols,
        pieceSize
    });
}

function handleFileInput(event, slot) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
        loadedImages[slot] = null;
        processImages();
        return;
    }

    const img = new Image();
    img.onload = () => {
        loadedImages[slot] = {
            file,
            width: img.naturalWidth,
            height: img.naturalHeight,
            image: img
        };
        processImages();
    };
    img.onerror = () => {
        loadedImages[slot] = null;
        if (slot === 0) {
            metaA.textContent = "Failed to load image.";
        } else {
            metaB.textContent = "Failed to load image.";
        }
    };

    const reader = new FileReader();
    reader.onload = () => {
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

fileInputA.addEventListener("change", (event) => handleFileInput(event, 0));
fileInputB.addEventListener("change", (event) => handleFileInput(event, 1));
formatSelect.addEventListener("change", processImages);
pieceSelect.addEventListener("change", processImages);

updateMeta(metaA, null, null);
updateMeta(metaB, null, null);
resetArrangementOutputs();
