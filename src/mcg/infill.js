import * as Sweep from "./sweep";
import {Operations} from "./sweepOperations";

export const Types = {
        none: 0,
        linear: 1,
        grid: 2,
        triangle: 4,
        hex: 8
    };

export function generate(contour, type, params = {}) {
        if (type === Types.linear) {
            return generateLinear(contour, params.angle, params.spacing, params.parity, params.connectLines);
        }
        if (type === Types.grid) {
            return generateGrid(contour, params.angle, params.spacing, params.connectLines);
        }
        if (type === Types.triangle) {
            return generateTriangle(contour, params.spacing);
        }
        /*if (type === Types.hex) {
          return generateHex(contour, params.spacing, params.linewidth, params.parity);
        }*/

        return null;
    }

export function generateLinear(contour, angle, spacing, parity, connectLines) {
        let context = contour.context;
        angle = angle || 0;
        spacing = spacing || context.p;
        parity = parity || 0;
        connectLines = connectLines || false;

        // constants
        const pi = Math.PI;
        const pi2 = pi * 2;
        const pi_2 = pi / 2;

        // rotate by 90 degrees if nonzero parity
        if (parity !== 0) angle += pi_2;

        const contourRotated = contour.clone(true).rotate(angle);

        const op = Operations.linearInfill({
            spacing,
            connectLines
        });

        const infillRotated = Sweep.sweep(op, contourRotated).infill;

        return infillRotated.rotate(-angle);
    }

export function generateGrid(contour, angle, spacing, connectLines) {
        let context = contour.context;
        angle = angle || 0;
        spacing = spacing || context.p;
        connectLines = connectLines || false;

        // constants
        const pi = Math.PI;
        const pi2 = pi * 2;
        const pi_2 = pi / 2;

        // make the sweep operation
        const op = Operations.linearInfill({
            spacing,
            connectLines,
            handleIntersections: false
        });

        // clone and rotate the contour by the initial angle
        const contourRotated = contour.clone(true).rotate(angle);
        // construct the infill in one direction
        const infillRotated0 = Sweep.sweep(op, contourRotated).infill;

        // rotate by pi/2 further
        contourRotated.rotate(pi_2);
        // construct the infill in the orthogonal direction
        const infillRotated1 = Sweep.sweep(op, contourRotated).infill;

        // unrotate second direction, merge with first direction, unrotate both
        return infillRotated1.rotate(-pi_2).merge(infillRotated0).rotate(-angle);
    }


