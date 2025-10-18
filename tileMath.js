(function () {
  function computeStops(size, segments) {
    if (segments <= 0) {
      return [0, size];
    }
    const base = Math.floor(size / segments);
    const remainder = size % segments;
    const stops = [0];
    let cursor = 0;
    for (let i = 0; i < segments; i += 1) {
      const span = base + (i < remainder ? 1 : 0);
      cursor += span;
      stops.push(cursor);
    }
    return stops;
  }

  window.tileMath = {
    computeStops
  };
})();
