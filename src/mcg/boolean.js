import * as Sweep from "./sweep";
import {Operations} from "./sweepOperations";

export const union = function(a, b, params) {
        const op = Operations.union(params);

        return Sweep.sweep(op, a, b);
    };

export const intersection = function(a, b, params) {
        const op = Operations.intersection(params);
        const context = a.context;

        if (a.count() === 0 || b.count() === 0) return op.initStore(context).result;

        return Sweep.sweep(op, a, b);
    };

export const intersectionOpen = function(a, b, params) {
        const op = Operations.intersectionOpen(params);
        const context = a.context;

        if (a.count() === 0 || b.count() === 0) return op.initStore(context).result;

        return Sweep.sweep(op, a, b);
    };

export const difference = function(a, b, params) {
        const op = Operations.difference(params);
        const context = a.context;

        if (a.count() === 0) return op.initStore(context).result;
        if (b.count() === 0) return a;

        return Sweep.sweep(op, a, b);
    };

export const fullDifference = function(a, b, params) {
        const op = Operations.fullDifference(params);
        const context = a.context;

        if (a.count() === 0) {
            var result = op.initStore(context).result;
            result.BminusA = b;
            return result;
        }

        if (b.count() === 0) {
            var result = op.initStore(context).result;
            result.AminusB = a;
            return result;
        }

        return Sweep.sweep(op, a, b);
    };

