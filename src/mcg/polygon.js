import {Vector} from "./vector";
import * as MCGMath from "./math";

const Polygon = (() => {

    function Polygon(context, sourcePoints, params) {
        this.context = context;

        // closed by default
        this.closed = !(params && params.open);

        this.points = [];
        this.bisectors = null;
        this.angles = null;

        this.area = 0;

        this.min = null;
        this.max = null;

        this.initBounds();

        // construct the polygon

        if (!sourcePoints) return this;
        if (this.closed && sourcePoints.length < 3) return this;

        // build the points array, eliminating collinear vertices
        const points = this.points;
        const collinear = MCGMath.collinear;

        const ns = sourcePoints.length;
        for (let si = 0; si < ns; si++) {
            const spt = sourcePoints[si];
            var ct = points.length;

            // if last three points are collinear, replace last point with new point
            if (ct > 1 && collinear(points[ct-2], points[ct-1], spt)) {
                points[ct-1] = spt;
            }
            // else, just add the new point
            else {
                points.push(spt);
            }
        }

        if (!this.valid()) return this;

        if (this.closed) {
            // eliminate points 0 and/or 1 if they are collinear with their neighbors
            var ct = this.count();
            if (collinear(points[ct-2], points[ct-1], points[0])) points.splice(--ct, 1);
            if (collinear(points[ct-1], points[0], points[1])) points.splice(0, 1);

            this.calculateArea();
        }

        if (!this.valid()) return this;

        this.calculateBounds();

        return this;
    }

    Object.assign(Polygon.prototype, {

        count() {
            return this.points.length;
        },

        // for each point
        forEach(f) {
            const points = this.points;
            const ct = points.length;
            const bisectors = this.bisectors;

            for (let i = 0; i < ct; i++) {
                const b = bisectors !== null ? bisectors[i] : undefined;

                f(points[i], b);
            }
        },

        // for each sequence of two points
        forEachPointPair(f) {
            const points = this.points;
            const ct = points.length;
            const ct1 = ct - 1;

            for (let i = 0; i < ct; i++) {
                const p1 = points[i];
                const p2 = points[(i < ct1) ? i+1 : (i+1+ct)%ct];

                f(p1, p2);
            }
        },

        // for each sequence of three points
        forEachSegmentPair(f) {
            const points = this.points;
            const ct = points.length;
            const ct1 = ct - 1;
            const ct2 = ct - 2;

            for (let i = 0; i < ct; i++) {
                const p1 = points[i];
                const p2 = points[(i < ct1) ? i+1 : (i+1+ct)%ct];
                const p3 = points[(i < ct2) ? i+2 : (i+2+ct)%ct];

                f(p1, p2, p3);
            }
        },

        initBounds() {
            const context = this.context;

            this.min = new Vector(context).setScalar(Infinity);
            this.max = new Vector(context).setScalar(-Infinity);
        },

        initArea() {
            this.area = 0;
        },

        updateBounds(pt) {
            this.min.min(pt);
            this.max.max(pt);
        },

        updateBoundsFromThis(min, max) {
            min.min(this.min);
            max.max(this.max);
        },

        calculateBounds() {
            const context = this.context;

            this.initBounds();

            const _this = this;

            this.forEach(p => {
                _this.updateBounds(p);
            });
        },

        calculateArea() {
            this.area = 0;

            if (!this.closed) return;

            const area = MCGMath.area;
            const points = this.points;
            const ct = this.count();

            for (let i = 1; i < ct - 1; i++) {
                this.area += area(points[0], points[i], points[i+1]);
            }
        },

        perimeter() {
            let result = 0;

            this.forEachPointPair((p1, p2) => {
                result += p1.distanceTo(p2);
            });

            return result;
        },

        isSliver(tol = this.context.p / 100) {
            return Math.abs(this.area) / this.perimeter() < tol;
        },

        fAreaGreaterThanTolerance(ftol) {
            const tol = MCGMath.ftoi(ftol, this.context);

            return this.areaGreaterThanTolerance(tol);
        },

        areaGreaterThanTolerance(tol) {
            return Math.abs(this.area) > tol;
        },

        size() {
            return this.min.vectorTo(this.max);
        },

        valid() {
            if (this.closed) return this.count() >= 3;
            else return this.count() > 1;
        },

        invalidate() {
            this.points = [];
            this.initArea();
            this.initBounds();

            return this;
        },

        createNew() {
            return new this.constructor(this.context, undefined, this.closed);
        },

        clone(recursive) {
            const clone = this.createNew();

            Object.assign(clone, this);

            if (recursive) {
                // make a new array
                clone.points = [];

                // clone the points
                const ct = this.count();
                for (let i = 0; i < ct; i++) {
                    clone.points[i] = this.points[i].clone();
                }
            }

            return clone;
        },

        // points is an array of vectors
        // mk is an optional array of bools indicating valid points
        fromPoints(points, mk) {
            if (mk) {
                const rpoints = [];

                for (let i = 0; i < points.length; i++) {
                    if (mk[i]) rpoints.push(points[i]);
                }

                this.points = rpoints;
            }
            else {
                this.points = points;
            }

            this.calculateArea();
            this.calculateBounds();

            return this;
        },

        rotate(angle) {
            this.forEach(point => {
                point.rotate(angle);
            });

            this.calculateBounds();

            return this;
        },

        // compute bisectors and angles between each edge pair and its bisector
        computeBisectors() {
            // return if bisectors already calculated or if polygon is open
            if (this.bisectors !== null || !this.closed) return;

            this.bisectors = [];
            this.angles = [];

            const bisectors = this.bisectors;
            const angles = this.angles;
            const points = this.points;

            const ct = this.count();

            for (let i = 0; i < ct; i++) {
                const p1 = points[(i-1+ct)%ct];
                const p2 = points[i];
                const p3 = points[(i+1+ct)%ct];

                const b = MCGMath.bisector(p1, p2, p3);

                bisectors.push(b);
                angles.push(p2.vectorTo(p3).angleTo(b));
            }
        },

        // offset, but the arguments are given in floating-point space
        foffset(fdist, ftol) {
            const context = this.context;
            const dist = MCGMath.ftoi(fdist, context);
            const tol = ftol !== undefined ? MCGMath.ftoi(ftol, context): 0;

            return this.offset(dist, tol);
        },

        // offset every point in the polygon by a given distance (positive for
        // outward, negative for inward, given in integer-space units)
        offset(dist, tol) {
            if (dist === 0) return this;

            const result = this.createNew();

            if (!this.valid()) return result;

            const size = this.size();
            const area = this.area;
            const minsize = Math.min(size.h, size.v);
            const fdist = MCGMath.itof(dist, this.context);
            var tol = tol || 0;
            const tolsq = tol * tol;

            // invalid offset if:
            // normal poly and inward offset is too large, or
            // hole and outward offset is too large
            if (this.area > 0 && dist < -minsize / 2) return result;
            if (this.area < 0 && dist > minsize / 2) return result;

            this.computeBisectors();

            const bisectors = this.bisectors;
            const angles = this.angles;
            const points = this.points;
            const rpoints = [];
            const ct = points.length;

            const pi = Math.PI;
            const pi_2 = pi / 2;
            const capThreshold = pi * 5 / 6;
            const orthogonalRightVector = MCGMath.orthogonalRightVector;
            const coincident = MCGMath.coincident;

            for (var i = 0; i < ct; i++) {
                const b = bisectors[i];
                const pti = points[i];

                // angle between the offset vector and the neighboring segments (because
                // the angles array stores the angle relative to the outward-facing
                // bisector, which may be antiparallel to the offset vector)
                var a = fdist > 0 ? angles[i] : (pi - angles[i]);

                // should occur rarely - ignore this point if the angle is 0 because
                // dividing by sin(a) gives infinity
                if (a === 0) continue;

                // scale for bisector
                const d = fdist / Math.sin(a);
                // displace by this much
                const displacement = b.clone().multiplyScalar(d);
                // displaced point
                const ptnew = pti.clone().add(displacement);

                // if angle is too sharp, cap the resulting spike
                if (a > capThreshold) {
                    // half-angle between displacement and vector orthogonal to segment
                    const ha = (a - pi_2) / 2;

                    // half-length of the cap for the spike
                    const hl = fdist * Math.tan(ha);

                    // orthogonal vector from the end of the displacement vector
                    const ov = orthogonalRightVector(pti.vectorTo(ptnew));

                    // midpoint of the cap
                    const mc = pti.clone().addScaledVector(b, fdist);

                    // endpoints of the cap segment
                    const p0 = mc.clone().addScaledVector(ov, -hl);
                    const p1 = mc.clone().addScaledVector(ov, hl);

                    const fpt = fdist > 0 ? p0 : p1;
                    const spt = fdist > 0 ? p1 : p0;

                    rpoints.push(fpt);
                    rpoints.push(spt);
                }
                else {
                    rpoints.push(ptnew);
                }
            }

            // determine valid points

            const rlen = rpoints.length;
            const rlen1 = rlen - 1;
            let ri = 0;
            const mk = new Array(rlen);
            const lcs = MCGMath.leftCompareStrict;

            // if displacement is larger than min polygon size, point is invalid;
            // else, if previous point is to the right of bisector or next point is
            // to its left, point is invalid
            for (var i = 0; i < points.length; i++) {
                var a = fdist > 0 ? angles[i] : (pi - angles[i]);

                if (a === 0) continue;

                if (a > capThreshold) {
                    mk[ri++] = true;
                    mk[ri++] = true;
                }
                else {
                    const rpprev = rpoints[ri === 0 ? rlen1 : ri - 1];
                    const rpnext = rpoints[ri === rlen1 ? 0 : ri + 1];
                    const rp = rpoints[ri];

                    const p = points[i];

                    //if (rpprev.distanceToSq(rp) < tolsq / 4) mk[ri] = false;

                    // validity check that's true if both neighboring offset vertices are
                    // on the correct side of the current bisector
                    mk[ri] = lcs(p, rp, rpprev) === -1 && lcs(p, rp, rpnext) === 1;
                    // reverse if inward offset
                    if (dist < 0) mk[ri] = !mk[ri];

                    ri++;
                }
            }

            result.fromPoints(rpoints, mk);

            // if result area is too small, invalidate it
            if (Math.abs(result.area) < tolsq) return result.invalidate();

            return result;
        },

        fdecimate(ftol) {
            const tol = MCGMath.ftoi(ftol, this.context);

            return this.decimate(tol);
        },

        // reduce vertex count
        // source: http://geomalgorithms.com/a16-_decimate-1.html
        // NB: this mutates the polygon
        decimate(tol) {
            if (tol <= 0) return this;

            // source points
            const spts = this.points;

            // first, decimate by vertex reduction
            const vrpts = decimateVR(spts, tol);

            this.fromPoints(vrpts);

            if (Math.abs(this.area) < tol * tol / 4) this.invalidate();

            return this;

            function decimateVR(pts, tol) {
                const ct = pts.length;
                const tolsq = tol * tol;

                // index of the reference point
                let refidx = 0;

                // result points
                const rpts = [];
                rpts.push(pts[0]);

                for (let si = 1; si < ct; si++) {
                    const spt = pts[si];

                    // if distance is < tolerance, ignore the point
                    if (pts[refidx].distanceToSq(spt) < tolsq) continue;

                    // else, include it and set it as the new reference point
                    rpts.push(spt);
                    refidx = si;
                }

                return rpts;
            }

            function decimateCollinear(pts, tol) {
                const ct = pts.length;
                const ct1 = ct - 1;
                const tolsq = tol * tol;

                // result points
                const rpoints = [];

                const narea = MCGMath.narea;

                for (let si = 0; si < ct; si++) {
                    const pt0 = si === 0 ? pts[ct1] : pts[si-1];
                    const pt1 = pts[si];
                    const pt2 = si === ct1 ? pts[0] : pts[si+1];

                    if (narea(pt0, pt1, pt2) < tolsq) rpoints.push(pt1);
                }

                return rpoints;
            }

            function decimateDP(pts, tol) {
                const ct = pts.length;

                // marker array
                const mk = new Array(ct);
                mk[0] = mk[ct-1] = true;

                // build the mk array
                decimateDPRecursive(pts, mk, tol, 0, ct-1);

                // result points
                const rpts = [];

                // if a point is marked, include it in the result
                for (let i = 0; i < ct; i++) {
                    if (mk[i]) rpts.push(pts[i]);
                }

                return rpts;
            }

            // recursive Douglas-Peucker procedure
            function decimateDPRecursive(pts, mk, tol, i, j) {
                if (i >= j-1) return;

                const tolsq = tol * tol;
                let maxdistsq = 0;
                let idx = -1;

                const distanceToLineSq = MCGMath.distanceToLineSq;
                const pti = pts[i];
                const ptj = pts[j];

                for (let k = i+1; k < j; k++) {
                    var distsq = distanceToLineSq(pti, ptj, pts[k]);
                    if (distsq > maxdistsq) {
                        maxdistsq = distsq;
                        idx = k;
                    }
                }

                if (distsq > tolsq) {
                    mk[idx] = true;

                    decimateDPRecursive(pts, mk, tol, i, idx);
                    decimateDPRecursive(pts, mk, tol, idx, j);
                }
            }
        }

    });

    return Polygon;

})();

export { Polygon };
