import {Context} from "./context";
    // float to integer
export function ftoi(f, context) {
        if (context === undefined) context = new Context();

        return Math.round(f * context.p);
    }

    // integer to float
export function itof(i, context) {
        if (context === undefined) context = new Context();

        return i / context.p;
    }

    // true if two points are coincident
export function coincident({h1, v1}, {h2, v2}) {
        return h1 === h2 && v1 === v2;
    }

    // area of a-b-c triangle in integer space
export function area({v1, h1}, {h2, v2}, {h3, v3}) {
        const cross = (h3-h2) * (v1-v2) - (v3-v2) * (h1-h2);
        return cross / 2;
    }

    // area of a-b-c triangle using normalized a-b and a-c edges
export function narea(a, b, c) {
        const bc = b.vectorTo(c).normalize();
        const ba = b.vectorTo(a).normalize();

        return bc.cross(ba) / 2;
    }

    // area of a-b-c triangle in floating-point space
export function farea(a, b, c) {
        const ash = a.sh();
        const asv = a.sv();
        const bsh = b.sh();
        const bsv = b.sv();
        const csh = c.sh();
        const csv = c.sv();

        const cross = (bsh-ash) * (csv-asv) - (bsv-asv) * (csh-ash);
        return cross / 2;
    }

    // distance squared from point p to line subtended by a-b segment
export function distanceToLineSq(a, b, p) {
        const ab = b.vectorTo(a);
        const ap = p.vectorTo(a);

        const dot = ab.dot(ap);

        if (dot === 0) return ap.lengthSq();

        const ablensq = ab.lengthSq();
        const proj = ab.multiplyScalar(dot / ablensq);

        return proj.distanceToSq(ap);
    }

export function distanceToLine(a, b, p) {
        return Math.sqrt(distanceToLineSq(a, b, p));
    }

    // returns 0 if c collinear with a-b, 1 if c left of a-b, else -1
export function leftCompare(a, b, c) {
        if (distanceToLineSq(a, b, c) <= 2) return 0;
        else return Math.sign(area(a, b, c));
    }

export function leftCompareStrict(a, b, c) {
        return Math.sign(area(a, b, c));
    }

    // signifies special types of intersection between a0-a1 and b0-b1 segments
export const IntersectionFlags = (() => {
        const a0 = 2;
        const a1 = 4;
        const b0 = 8;
        const b1 = 16;
        const a0b0 = a0 | b0;
        const a1b1 = a1 | b1;
        const a0b1 = a0 | b1;
        const a1b0 = a1 | b0;
        const a01 = a0 | a1;
        const b01 = b0 | b1;

        return {
            none: 0,                // no intersection
            intermediate: 1,        // intersection excludes endpoints
            a0,                 // a0 is on b0-b1
            a1,                 // a1 is on b0-b1
            b0,                 // b0 is on a0-a1
            b1,                 // b1 is on a0-a1
            a: a01,                 // a0 and a1 are on b0-b1
            b: b01,                 // b0 and b1 are on a0-a1
            a0b0,            // intersection point is start of both segments
            a1b1,              // intersection point is end of both segments
            a0b1,             // intersection point is a start and b end
            a1b0,             // intersection point is a end and b start
            collinear: a0b0 | a1b1  // a and b are collinear
        };
    })();

    // create a normalized vector that is orthogonal to and right of vector d
export function orthogonalRightVector(d, len) {
        const h = d.h;
        const v = d.v;

        // opposite inverse slope makes an orthogonal vector
        const r = d.clone().set(v, -h);

        if (len !== undefined) return r.setLength(len);
        else return r.normalize();
    }

export function collinear(a, b, c) {
        // consecutive vertices a, b, c are collinear if b is on a-c segment
        return leftCompare(a, c, b) === 0;
    };

export function left(a, b, c) {
        return leftCompare(a, b, c) > 0;
    };

export function leftOn(a, b, c) {
        return leftCompare(a, b, c) >= 0;
    };

export function collinearStrict(a, b, c) {
        return leftCompareStrict(a, b, c) === 0;
    };

export function leftStrict(a, b, c) {
        return leftCompareStrict(a, b, c) > 0;
    };

export function leftOnStrict(a, b, c) {
        return leftCompareStrict(a, b, c) >= 0;
    };

// intersection predicate: return true if a-b segment intersects c-d
// segment; returns
export function intersect(a, b, c, d) {
        const flags = IntersectionFlags;

        // leftness checks for the endpoint of one segment against the other segment
        const labc = leftCompare(a, b, c);

        const labd = leftCompare(a, b, d);
        const lcda = leftCompare(c, d, a);
        const lcdb = leftCompare(c, d, b);

        let result = flags.none;

        // a-b segment is between endpoints of c-d segment
        const abBtwn = labc !== labd || labc === 0;
        // c-d segment is between endpoints of a-b segment
        const cdBtwn = lcda !== lcdb || lcda === 0;

        // check if one endpoint lies on the other segment

        // c lies on a-b and between a-b
        if (labc === 0 && cdBtwn) result |= flags.b0;
        if (labd === 0 && cdBtwn) result |= flags.b1;
        if (lcda === 0 && abBtwn) result |= flags.a0;
        if (lcdb === 0 && abBtwn) result |= flags.a1;

        // if one segment registers as collinear with the other, say both segments
        // are collinear
        //if (result & flags.a0 && result & flags.a1) return flags.collinear;
        //if (result & flags.b0 && result & flags.b1) return flags.collinear;
        //if (result & flags.a0 && result & flags.b1) return flags.collinear;
        //if (result & flags.a1 && result & flags.b0) return flags.collinear;

        // possible intersection on intermediate points
        if (result === flags.none) {
            if (abBtwn && cdBtwn) {
                result = flags.intermediate;
            }
        }

        return result;
    };

// calculate intersection point of a0-a1 segment and b0-b1 segment
export function intersection(a0, a1, {v0, h0}, {v1, h1}) {
        // denominator
        const d = a0.h * (v1 - v0) + a1.h * (v0 - v1) +
            h1 * (a1.v - a0.v) + h0 * (a0.v - a1.v);
        // if denominator is 0, segments are parallel
        if (d === 0) return null;

        // numerator
        let n;

        // calculate pa
        n = a0.h * (v1 - v0) + h0 * (a0.v - v1) + h1 * (v0 - a0.v);
        const pa = n / d;

        const ixn = a0.clone().addScaledVector(a0.vectorTo(a1), pa);

        // if intersection is outside segment a's bounds, it's invalid
        if (!inRange(ixn.h, Math.min(a0.h, a1.h), Math.max(a0.h, a1.h))) return null;
        if (!inRange(ixn.v, Math.min(a0.v, a1.v), Math.max(a0.v, a1.v))) return null;

        return ixn;
    };
// the bisector of a-b and b-c segments, looking right of both segments
export function bisector(a, b, c) {
        const abr = orthogonalRightVector(a.vectorTo(b));
        const bcr = orthogonalRightVector(b.vectorTo(c));

        return abr.add(bcr).normalize();
    };

export function cycleAxis(a) {
        if (a === "h") return "v";
        else if (a === "v") return "h";
        else if (a === "x") return "y";
        else if (a === "y") return "z";
        else return "x";
    };

