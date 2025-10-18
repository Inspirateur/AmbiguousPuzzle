(function () {
  const DEFAULT_CANVAS_SIZE = 512;
  const PUZZLE_SIZES = [
    { key: '4x6', cols: 4, rows: 6 },
    { key: '6x9', cols: 6, rows: 9 },
    { key: '8x12', cols: 8, rows: 12 },
    { key: '10x15', cols: 10, rows: 15 },
    { key: '12x18', cols: 12, rows: 18 }
  ];

  const state = {
    format: 'portrait',
    puzzleSizeKey: '4x6',
    images: [null, null],
    processed: [null, null],
    processedData: [null, null],
    outputSize: null,
    puzzleArrangement: [],
    fusionOutput: null
  };

  const formatSelector = document.getElementById('formatSelector');
  const puzzleSizeSelect = document.getElementById('puzzleSize');
  const fileInputs = [document.getElementById('fileInput0'), document.getElementById('fileInput1')];
  const previews = [document.getElementById('preview0'), document.getElementById('preview1')];
  const infos = [document.getElementById('info0'), document.getElementById('info1')];
  const status = document.getElementById('status');
  const fusionCanvas = document.getElementById('fusionCanvas');
  const fusionCtx = fusionCanvas.getContext('2d', { willReadFrequently: true });
  const puzzleCanvas = document.getElementById('puzzleCanvas');
  const puzzleCtx = puzzleCanvas.getContext('2d', { willReadFrequently: true });

  puzzleSizeSelect.value = state.puzzleSizeKey;
  puzzleCtx.imageSmoothingEnabled = true;
  puzzleCtx.imageSmoothingQuality = 'high';

  syncPuzzleOptions();

  formatSelector.addEventListener('change', (event) => {
    state.format = event.target.value;
    state.puzzleArrangement = [];
    syncPuzzleOptions();
    processImages();
  });

  puzzleSizeSelect.addEventListener('change', (event) => {
    state.puzzleSizeKey = event.target.value;
    state.puzzleArrangement = [];
    updateFusionCanvas();
    updatePuzzleCanvas();
  });

  fileInputs.forEach((input, index) => {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) {
        return;
      }
      loadImage(index, file);
      input.value = '';
    });
  });

  function updateStatus(message) {
    status.textContent = message;
  }

  function syncPuzzleOptions() {
    const isLandscape = state.format === 'landscape';
    Array.from(puzzleSizeSelect.options).forEach((option) => {
      const base = PUZZLE_SIZES.find((size) => size.key === option.value);
      if (!base) {
        return;
      }
      const cols = isLandscape ? base.rows : base.cols;
      const rows = isLandscape ? base.cols : base.rows;
      option.textContent = `${cols} x ${rows}`;
    });
  }

  function ensureCanvasSize(canvas, width, height) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function loadImage(slot, file) {
    updateStatus('Loading image...');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      state.images[slot] = {
        element: img,
        name: file.name,
        width: img.naturalWidth,
        height: img.naturalHeight
      };
      URL.revokeObjectURL(url);
      processImages();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      updateStatus('Unable to load one of the images. Please try a different file.');
    };
    img.src = url;
  }

  function processImages() {
    const ratioValue = state.format === 'portrait' ? 2 / 3 : 3 / 2;
    const ratioCss = state.format === 'portrait' ? '2 / 3' : '3 / 2';
    document.documentElement.style.setProperty('--preview-ratio', ratioCss);

    const crops = state.images.map((entry) => (entry ? cropToRatio(entry.element, ratioValue) : null));
    const finalSize = resolveFinalSize(crops, ratioValue);
    state.outputSize = finalSize || null;

    if (!finalSize) {
      state.processed = [null, null];
      state.processedData = [null, null];
      state.fusionOutput = null;
      previews.forEach((img, idx) => {
        img.removeAttribute('src');
        infos[idx].textContent = 'Awaiting image';
      });
      updateStatus('Upload both images to see the fusion blend.');
      resetFusionCanvas();
      resetPuzzleCanvas();
      return;
    }

    const processed = crops.map((crop) => (crop ? resampleCanvas(crop.canvas, finalSize.width, finalSize.height) : null));

    processed.forEach((canvas, idx) => {
      state.processed[idx] = canvas;
      if (!canvas) {
        previews[idx].removeAttribute('src');
        infos[idx].textContent = 'Awaiting image';
        state.processedData[idx] = null;
        return;
      }
      previews[idx].src = canvas.toDataURL('image/png');
      infos[idx].textContent = `${state.images[idx].name || 'Image'} → ${canvas.width} × ${canvas.height}px`;
      const ctx = canvas.getContext('2d');
      state.processedData[idx] = ctx.getImageData(0, 0, finalSize.width, finalSize.height);
    });

    const availableCount = processed.filter(Boolean).length;
    const { cols, rows } = getActivePuzzleSize();

    if (availableCount === 2) {
      ensurePuzzleArrangement(rows, cols, true);
      updateStatus(`Fusion ready at ${finalSize.width} × ${finalSize.height}px (${state.format}).`);
    } else {
      updateStatus(`Waiting for the second image. Current output ${finalSize.width} × ${finalSize.height}px (${state.format}).`);
      state.fusionOutput = null;
    }

    updateFusionCanvas();
    updatePuzzleCanvas();
  }

  function cropToRatio(image, ratio) {
    const srcWidth = image.naturalWidth;
    const srcHeight = image.naturalHeight;
    const currentRatio = srcWidth / srcHeight;
    let cropWidth;
    let cropHeight;

    if (currentRatio > ratio) {
      cropHeight = srcHeight;
      cropWidth = Math.round(srcHeight * ratio);
    } else {
      cropWidth = srcWidth;
      cropHeight = Math.round(srcWidth / ratio);
    }

    const offsetX = Math.round((srcWidth - cropWidth) / 2);
    const offsetY = Math.round((srcHeight - cropHeight) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, offsetX, offsetY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return { canvas, width: cropWidth, height: cropHeight };
  }

  function resolveFinalSize(crops, ratio) {
    const active = crops.filter(Boolean);
    if (active.length === 0) {
      return null;
    }
    if (active.length === 1) {
      return { width: active[0].width, height: active[0].height };
    }

    const maxWidth = Math.max(...active.map((crop) => crop.width));
    const maxHeight = Math.max(...active.map((crop) => crop.height));
    const widthFromWidth = maxWidth;
    const heightFromWidth = Math.round(maxWidth / ratio);

    if (heightFromWidth < maxHeight) {
      const widthFromHeight = Math.round(maxHeight * ratio);
      return { width: widthFromHeight, height: maxHeight };
    }

    return { width: widthFromWidth, height: heightFromWidth };
  }

  function resampleCanvas(sourceCanvas, targetWidth, targetHeight) {
    if (sourceCanvas.width === targetWidth && sourceCanvas.height === targetHeight) {
      return sourceCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    return canvas;
  }

  function resetFusionCanvas(width, height) {
    const resolvedWidth = width || DEFAULT_CANVAS_SIZE;
    const resolvedHeight = height || DEFAULT_CANVAS_SIZE;
    ensureCanvasSize(fusionCanvas, resolvedWidth, resolvedHeight);
    fusionCtx.clearRect(0, 0, resolvedWidth, resolvedHeight);
    fusionCtx.fillStyle = '#dbe3ff';
    fusionCtx.fillRect(0, 0, resolvedWidth, resolvedHeight);
  }

  function resetPuzzleCanvas(width, height) {
    const resolvedWidth = width || DEFAULT_CANVAS_SIZE;
    const resolvedHeight = height || DEFAULT_CANVAS_SIZE;
    ensureCanvasSize(puzzleCanvas, resolvedWidth, resolvedHeight);
    puzzleCtx.clearRect(0, 0, resolvedWidth, resolvedHeight);
    puzzleCtx.fillStyle = '#ecf4ee';
    puzzleCtx.fillRect(0, 0, resolvedWidth, resolvedHeight);
  }

  function updateFusionCanvas() {
    const width = state.outputSize?.width;
    const height = state.outputSize?.height;

    if (!width || !height) {
      resetFusionCanvas();
      state.fusionOutput = null;
      return;
    }

    const primary = state.processedData[0];
    const secondary = state.processedData[1];

    if (!primary && !secondary) {
      resetFusionCanvas(width, height);
      state.fusionOutput = null;
      return;
    }

    ensureCanvasSize(fusionCanvas, width, height);

    if (!secondary || !primary) {
      const single = primary || secondary;
      state.fusionOutput = single || null;
      fusionCtx.putImageData(single, 0, 0);
      return;
    }

    const { cols, rows } = getActivePuzzleSize();
    ensurePuzzleArrangement(rows, cols);
    const arrangement = state.puzzleArrangement;
    const blendFn = window.blender?.blendWithArrangement;

    if (!Array.isArray(arrangement) || arrangement.length !== rows * cols || typeof blendFn !== 'function') {
      resetFusionCanvas(width, height);
      state.fusionOutput = null;
      return;
    }

    const blended = blendFn(primary, secondary, rows, cols, arrangement);
    if (!blended || blended.width !== width || blended.height !== height) {
      resetFusionCanvas(width, height);
      state.fusionOutput = null;
      return;
    }

    state.fusionOutput = blended;
    fusionCtx.putImageData(blended, 0, 0);
  }

  function updatePuzzleCanvas() {
    const width = state.outputSize?.width;
    const height = state.outputSize?.height;

    if (!width || !height) {
      resetPuzzleCanvas();
      return;
    }

    const fusionOutput = state.fusionOutput;
    if (!fusionOutput || fusionOutput.width !== width || fusionOutput.height !== height) {
      resetPuzzleCanvas(width, height);
      return;
    }

    const { cols, rows } = getActivePuzzleSize();
    ensurePuzzleArrangement(rows, cols);
    const arrangement = state.puzzleArrangement;
    const rearrangeFn = window.rearranger?.applyArrangement;

    if (!Array.isArray(arrangement) || arrangement.length !== rows * cols || typeof rearrangeFn !== 'function') {
      resetPuzzleCanvas(width, height);
      return;
    }

    const rearranged = rearrangeFn(fusionOutput, rows, cols, arrangement);
    if (!rearranged || rearranged.width !== width || rearranged.height !== height) {
      resetPuzzleCanvas(width, height);
      return;
    }

    ensureCanvasSize(puzzleCanvas, width, height);
    puzzleCtx.putImageData(rearranged, 0, 0);
  }

  function getActivePuzzleSize() {
    const base = PUZZLE_SIZES.find((size) => size.key === state.puzzleSizeKey) || PUZZLE_SIZES[0];
    if (state.format === 'landscape') {
      return { cols: base.rows, rows: base.cols };
    }
    return { cols: base.cols, rows: base.rows };
  }

  function ensurePuzzleArrangement(rows, cols, force = false) {
    const pieceCount = rows * cols;

    if (!state.processedData[0] || !state.processedData[1]) {
      state.puzzleArrangement = [];
      return;
    }

    if (!force && Array.isArray(state.puzzleArrangement) && state.puzzleArrangement.length === pieceCount) {
      return;
    }

    const generator = window.arrangementGenerator?.createArrangement;
    state.puzzleArrangement = typeof generator === 'function'
      ? generator(state.processedData[0], state.processedData[1], rows, cols)
      : [];
  }

  resetFusionCanvas();
  resetPuzzleCanvas();
})();
