// All the code needed to ensure that both image have the same dimensions and that the puzzle pieces are square
;(function attachResolutionHelpers(global) {
    function computeCropDimensions(imgWidth, imgHeight, ratio) {
        const targetWidthByHeight = imgHeight * ratio;
        const targetHeightByWidth = imgWidth / ratio;

        const options = [];

        if (targetWidthByHeight <= imgWidth) {
            const width = Math.max(1, Math.floor(targetWidthByHeight));
            const height = Math.max(1, Math.floor(width / ratio));
            const cropArea = imgWidth * imgHeight - width * height;
            options.push({
                width,
                height,
                sx: (imgWidth - width) / 2,
                sy: (imgHeight - height) / 2,
                cropArea
            });
        }

        if (targetHeightByWidth <= imgHeight) {
            const height = Math.max(1, Math.floor(targetHeightByWidth));
            const width = Math.max(1, Math.floor(height * ratio));
            const cropArea = imgWidth * imgHeight - width * height;
            options.push({
                width,
                height,
                sx: (imgWidth - width) / 2,
                sy: (imgHeight - height) / 2,
                cropArea
            });
        }

        if (!options.length) {
            return {
                width: imgWidth,
                height: imgHeight,
                sx: 0,
                sy: 0
            };
        }

        const best = options.reduce((selected, current) => {
            if (!selected || current.cropArea < selected.cropArea) {
                return current;
            }
            return selected;
        }, null);

        return {
            width: best.width,
            height: best.height,
            sx: best.sx,
            sy: best.sy
        };
    }

    function snapToGrid(crop, rows, cols) {
        if (!crop || rows <= 0 || cols <= 0) {
            return { width: 0, height: 0, pieceSize: 0 };
        }

        const basePiece = Math.floor(Math.min(crop.width / cols, crop.height / rows));
        const pieceSize = Math.max(1, basePiece);

        return {
            width: pieceSize * cols,
            height: pieceSize * rows,
            pieceSize
        };
    }

    function drawProcessedImage(canvas, imageData, targetWidth, targetHeight, cropInfo) {
        const ctx = canvas.getContext("2d");
        canvas.width = Math.round(targetWidth);
        canvas.height = Math.round(targetHeight);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(
            imageData.image,
            cropInfo.sx,
            cropInfo.sy,
            cropInfo.width,
            cropInfo.height,
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    function clearCanvas(canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
    }

    global.PuzzleResolution = {
        computeCropDimensions,
        snapToGrid,
        drawProcessedImage,
        clearCanvas
    };
})(window);
