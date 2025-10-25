(function attachAssignmentSolver(global) {
    function solveAssignment(costMatrix) {
        if (!Array.isArray(costMatrix) || !costMatrix.length) {
            return {
                assignment: [],
                totalCost: Number.POSITIVE_INFINITY
            };
        }

        const n = costMatrix.length;
        for (let i = 0; i < n; i += 1) {
            if (!Array.isArray(costMatrix[i]) || costMatrix[i].length !== n) {
                return {
                    assignment: [],
                    totalCost: Number.POSITIVE_INFINITY
                };
            }
        }

        const maxCost = 1e12;
        const a = Array.from({ length: n }, (_, row) => (
            costMatrix[row].map((value) => (Number.isFinite(value) ? value : maxCost))
        ));

        const u = new Array(n + 1).fill(0);
        const v = new Array(n + 1).fill(0);
        const p = new Array(n + 1).fill(0);
        const way = new Array(n + 1).fill(0);

        for (let i = 1; i <= n; i += 1) {
            p[0] = i;
            const minv = new Array(n + 1).fill(Infinity);
            const used = new Array(n + 1).fill(false);
            let j0 = 0;

            do {
                used[j0] = true;
                const i0 = p[j0];
                let delta = Infinity;
                let j1 = 0;
                for (let j = 1; j <= n; j += 1) {
                    if (used[j]) {
                        continue;
                    }
                    const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
                    if (cur < minv[j]) {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if (minv[j] < delta) {
                        delta = minv[j];
                        j1 = j;
                    }
                }

                for (let j = 0; j <= n; j += 1) {
                    if (used[j]) {
                        u[p[j]] += delta;
                        v[j] -= delta;
                    } else {
                        minv[j] -= delta;
                    }
                }

                j0 = j1;
            } while (p[j0] !== 0);

            do {
                const j1 = way[j0];
                p[j0] = p[j1];
                j0 = j1;
            } while (j0 !== 0);
        }

        const assignment = new Array(n).fill(-1);
        for (let j = 1; j <= n; j += 1) {
            if (p[j] > 0) {
                assignment[p[j] - 1] = j - 1;
            }
        }

        let totalCost = 0;
        assignment.forEach((targetIndex, sourceIndex) => {
            if (targetIndex >= 0) {
                totalCost += costMatrix[sourceIndex][targetIndex];
            }
        });

        return {
            assignment: assignment.map((targetIndex, sourceIndex) => ({
                sourceIndex,
                targetIndex
            })),
            totalCost
        };
    }

    global.AssignmentSolver = {
        solveAssignment
    };
})(window);
