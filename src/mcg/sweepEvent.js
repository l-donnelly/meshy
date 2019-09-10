import {Vector} from "./vector";
import * as MCGMath from "./math";
    // signifies an event's position (inside a polygon or at a boundary or neither)
export const EventPositionFlags = {
        none: 0,
        // inside polygon A
        insideA: 1,
        // inside polygon B
        insideB: 2,
        // on the border of A (crosses from non-positive to positive or vice versa)
        boundaryA: 4,
        // on the border of B
        boundaryB: 8,
        // transition from inside A to inside B (or vice versa)
        fromAtoB: 16
    };



    export    function SweepEvent(p, id) {
        // MCG.Vector at which this event is located
        this.p = p;

        // store parent for testing collinearity and slopes - this prevents drift
        // from multiple split points snapping to the integer grid
        this.parent = this;

        // used as a last-resort ordering criterion for events; the factory
        // guarantees that event ids are unique
        this.id = id !== undefined ? id : -1;

        this.isLeft = false;
        this.twin = null;
    }

    Object.assign(SweepEvent.prototype, {

        clone(p, id) {
            const e = new this.constructor(p);

            // copy properties and set point
            Object.assign(e, this);
            e.p = p;
            e.id = id !== undefined ? id : -1;
            e.t = -1;

            return e;
        },

        isParent() {
            return this === this.parent;
        },

        vertical() {
            return this.p.h === this.twin.p.h;
        },

        horizontal() {
            return this.p.v === this.twin.p.v;
        },

        // determine which of two events comes first in a left-right sweep
        sweepcompare(other) {
            const a = this;
            const b = other;

            // in case events are the same
            if (a.id === b.id) return 0;

            // primary sorting on horizontal coordinate (x if up axis is z)
            // secondary sorting on vertical coordinate (y if up axis is z)
            const hvcomp = a.hvcompare(b);
            if (hvcomp !== 0) return hvcomp;

            // tertiary sorting on left/right (right goes first so that, given two
            //   segments sharing an endpoint but with no vertical overlap, the first
            //   segment leaves the sweep status structure before the next goes in)
            const lrcomp = a.lrcompare(b);
            if (lrcomp !== 0) return lrcomp;

            // quaternary sorting on slope (increasing)
            const scomp = a.scompare(b);
            if (scomp !== 0) return scomp;

            // comparison based on parent extents
            const pcomp = a.pcompare(b);
            if (pcomp !== 0) return pcomp;

            return Math.sign(a.id - b.id);
        },

        // comparison for two left events along a vertical line passing through both
        // at the earliest point where they have vertical overlap (i.e., horizontal
        // coordinate of the later event)
        linecompare(other) {
            const a = this;
            const b = other;

            // in case events are the same
            if (a.id === b.id) return 0;

            // primary sorting on vertical coordinate at the start of the later event
            // (y if up axis is z)
            const vcomp = a.vlinecompare(b);
            if (vcomp !== 0) return vcomp;

            // secondary sorting on slope
            const scomp = a.scompare(b);
            if (scomp !== 0) return scomp;

            // tertiary sorting on time
            const tcomp = a.tcompare(b);
            if (tcomp !== 0) return tcomp;

            // comparison based on parent extents
            const pcomp = a.pcompare(b);
            if (pcomp !== 0) return pcomp;

            return Math.sign(a.id - b.id);
        },

        // return horizontal comparison
        hcompare({p}) {
            return this.p.hcompare(p);
        },

        // return vertical comparison
        vcompare({p}) {
            return this.p.vcompare(p);
        },

        // return horizontal comparison if unequal; else, return vertical comparison
        hvcompare(other) {
            const a = this;
            const b = other;
            const pa = a.p;
            const pb = b.p;

            const hcomp = pa.hcompare(pb);
            if (hcomp !== 0) return hcomp;

            return pa.vcompare(pb);
        },

        hvcomparept(pt) {
            const pa = this.p;

            const hcomp = pa.hcompare(pt);
            if (hcomp !== 0) return hcomp;

            return pa.vcompare(pt);
        },

        // return left-right comparison for two events (right goes first)
        lrcompare({isLeft}) {
            if (!this.isLeft && isLeft) return -1;
            else if (this.isLeft && !isLeft) return 1;
            else return 0;
        },

        // returns slope comparison for two events that share at least one point:
        //   a's slope is greater if a's twin is to b-b.twin's left (above b);
        //   a's slope is less if a's twin is to b-b.twin's right (below b);
        //   equal slopes if collinear
        scompare(other) {
            const a = this.isLeft ? this : this.twin;
            const b = other.isLeft ? other : other.twin;

            // basic checks if one or both are vertical
            const va = a.vertical();

            const vb = b.vertical();

            if (va && vb) return 0;
            else if (!va && vb) return -1;
            else if (va && !vb) return 1;

            const pa = a.p;
            const pta = a.twin.p;
            const pb = b.p;
            const ptb = b.twin.p;

            // if start points coincident, use strict left comparison
            if (MCGMath.coincident(pa, pb)) {
                const ls = MCGMath.leftCompareStrict(pb, ptb, pta);
                return ls < 0 ? -1 : ls > 0 ? 1 : 0
            }

            const lc = MCGMath.leftCompare;

            const lta = lc(pb, ptb, pta);
            const ltb = lc(pa, pta, ptb);

            if (lta === -1 || ltb === 1) return -1;
            if (lta === 1 || ltb === -1) return 1;

            const la = lc(pb, ptb, pa);
            const lb = lc(pa, pta, pb);

            if (la === 1 || lb === -1) return -1;
            if (la === -1 || lb === 1) return 1;

            return 0;
        },

        tcompare({t}) {
            return Math.sign(this.t - t);
        },

        // returns comparison between two left/two right events based on their
        // parent extents
        pcompare(other) {
            const a = this;
            const b = other;

            // parent comparison function
            const pcompare = a.vertical() || b.vertical() ? "vcompare" : "hcompare";

            const pcomp = a.parent.p[pcompare](b.parent.p);
            if (pcomp !== 0) return pcomp;

            const ptcomp = a.twin.parent.p[pcompare](b.twin.parent.p);
            if (ptcomp !== 0) return ptcomp;

            return 0;
        },

        toString(pref) {
            const src = this.isLeft ? this : this.twin;
            const pst = (src.weightA!==0?"A":"-") + (src.weightB!==0?"B":"-");
            pref = (pref || pst);

            var d = 4;
            const diff = src.p.vectorTo(src.twin.p);
            const slope = src.vertical() ? Infinity : diff.v/diff.h;
            const cslope = slope===Infinity
                ? "v"
                : (slope===0
                    ? 0
                    : (Math.sign(slope)==1
                        ? `+${slope>0.5 ? "^" : ">"}`
                        : `-${slope<-0.5 ? "v" : ">"}`));
            const t = `${this.isLeft ? this.t : ""} `;

            const data =
                [t, this.isLeft ? "L " : "R ", this.id, this.twin.id,
                    '(', this.p.h,
                    this.p.v, ')',
                    '(', this.twin.p.h,
                    this.twin.p.v, ')',
                    cslope, slope.toFixed(6),
                    this.p.vectorTo(this.twin.p).length().toFixed(0),
                    "w", src.weightA, src.weightB,
                    "d", src.depthBelowA, src.depthBelowA+src.weightA, src.depthBelowB, src.depthBelowB+src.weightB,
                    src.contributing ? "t" : "f"];
            const p =
                [5, 1, 5, 5,
                    2, d+3,
                    d+3, 1,
                    2, d+3,
                    d+3, 1,
                    2, 10,
                    9,
                    2, 2, 2,
                    2, 4, 4, 4, 4,
                    1];
            let r = "";
            for (var d=0; d<data.length; d++) r += lpad(data[d], p[d]);

            return `${pref} ${r}`;

            function lpad(s, n) {
                n++;
                const ss = `${s}`;
                const l = ss.length;
                return " ".repeat(Math.max(n-l, 0)) + ss;
            }
        }

    });


    export class RightSweepEvent extends SweepEvent {
        constructor(p, id) {
            super(p, id);
        }
    }

    Object.assign(RightSweepEvent.prototype, {
        constructor: RightSweepEvent
    });


    export class LeftSweepEvent extends SweepEvent {
        constructor(p, id) {
            super(p, id);

            this.isLeft = true;

            this.depthBelowA = 0;
            this.weightA = 0;
            this.depthBelowB = 0;
            this.weightB = 0;

            this.contributing = true;

            // time at which the event occurs; used as a tiebreaker to position more
            // recent events above past events
            this.t = -1;
        }
    }

    Object.assign(LeftSweepEvent.prototype, {

        constructor: LeftSweepEvent,

        setT(t) {
            this.t = t;

            return this;
        },

        setDepthFromBelow(below) {
            this.depthBelowA = below !== null ? below.depthBelowA + below.weightA : 0;
            this.depthBelowB = below !== null ? below.depthBelowB + below.weightB : 0;
        },

        setDepthFrom({depthBelowA, depthBelowB}) {
            this.depthBelowA = depthBelowA;
            this.depthBelowB = depthBelowB;
        },

        setWeightFrom({weightA, weightB}, negate) {
            this.weightA = negate ? -weightA : weightA;
            this.weightB = negate ? -weightB : weightB;
        },

        addWeightFrom({weightA, weightB}) {
            this.weightA += weightA;
            this.weightB += weightB;
        },

        zeroWeight() {
            return this.weightA === 0 && this.weightB === 0;
        },

        // get a status code that indicates the event's position (inside or at the
        // boundary of one of the polygons)
        getPosition(minDepthA, minDepthB) {
            const flags = EventPositionFlags;
            const mdA = minDepthA || 1;
            const mdB = minDepthB || 1;

            if (!this.contributing) return flags.none;

            const wA = this.weightA;
            const wB = this.weightB;

            // depths above and below for A
            const dbA = this.depthBelowA;
            const daA = dbA + wA;

            // depths above and below for B
            const dbB = this.depthBelowB;
            const daB = dbB + wB;

            let result = flags.none;

            const boundaryA = (daA < mdA && dbA >= mdA) || (daA >= mdA && dbA < mdA);
            const boundaryB = (daB < mdB && dbB >= mdB) || (daB >= mdB && dbB < mdB);
            const signChange = Math.sign(wA) === -Math.sign(wB);

            if (dbA >= mdA && daA >= mdA) result |= flags.insideA;
            if (dbB >= mdB && daB >= mdB) result |= flags.insideB;
            if (boundaryA) result |= flags.boundaryA;
            if (boundaryB) result |= flags.boundaryB;
            if (boundaryA && boundaryB && signChange) result |= flags.fromAtoB;

            return result;
        },

        addSegmentToSet(s, invert, weight) {
            const w = weight === undefined ? this.weightA + this.weightB : weight;

            const pf = w < 0 ? this.twin.p : this.p;
            const ps = w < 0 ? this.p : this.twin.p;

            if (invert) s.addPointPair(ps, pf);
            else s.addPointPair(pf, ps);
        },

        // return vertical axis comparison for two left events at the later event's
        // horizontal coordinate
        vlinecompare(other) {
            const a = this;
            const b = other;
            const pa = a.p;
            const pb = b.p;
            const pta = a.twin.p;
            const ptb = b.twin.p;
            const pah = pa.h;
            const pbh = pb.h;
            const ptah = pta.h;
            const ptbh = ptb.h;
            const pav = pa.v;
            const pbv = pb.v;

            // if events horizontally coincident, just test the vertical coordinate
            if (pah === pbh) return pa.vcompare(pb);

            // if the end of one is horizontally coincident with the other's start,
            // test that directly
            if (pah === ptbh) return pa.vcompare(ptb);
            if (ptah === pbh) return pta.vcompare(pb);

            const ptav = a.twin.p.v;
            const ptbv = b.twin.p.v;

            // if no vertical overlap, decide by which is higher/lower
            if (Math.max(pav, ptav) < Math.min(pbv, ptbv)) return -1;
            if (Math.max(pbv, ptbv) < Math.min(pav, ptav)) return 1;

            // first and second events by horizontal coordinate
            const f = pah < pbh ? a : b;
            const s = pah < pbh ? b : a;
            const ps = s.p;

            if (0) {
                let lc = MCGMath.leftCompare(f.p, f.twin.p, s.p);
                if (pah < pbh) lc *= -1;
                return lc;
            }

            const v = f.interpolate(ps.h).v;

            let result = Math.sign(ps.v - v);

            // flip result if necessary
            if (pah < pbh) result *= -1;

            return result;
        },

        // interpolate a (non-vertical) left event's segment to a given horizontal
        // coordinate
        interpolate(h) {
            const context = this.p.context;
            const pa = this.p;
            const pat = this.twin.p;

            const v = pa.v + (pat.v - pa.v) * (h - pa.h) / (pat.h - pa.h);

            return new MCGVector(context, h, v);
        },

        hcontains(h) {
            return this.p.h <= h && h <= this.twin.p.h;
        },

        vcontains(v) {
            return this.p.v <= v && v <= this.twin.p.v;
        },

        contains({h, v}) {
            return this.hcontains(h) || this.vcontains(v);
        },

        collinear(other) {
            const a = this;
            const b = other;
            const pa = a.p;
            const pat = a.twin.p;
            const pb = b.p;
            const pbt = b.twin.p;

            // verify that the event pairs actually overlap
            if (a.horizontal() && b.horizontal()) {
                if (Math.max(pa.h, pat.h) <= Math.min(pb.h, pbt.h)) return false;
                if (Math.max(pb.h, pbt.h) <= Math.min(pa.h, pat.h)) return false;
            }
            else {
                if (Math.max(pa.v, pat.v) <= Math.min(pb.v, pbt.v)) return false;
                if (Math.max(pb.v, pbt.v) <= Math.min(pa.v, pat.v)) return false;
            }

            if (a.vertical() && b.vertical()) return true;

            const collinear = MCGMath.collinear;

            return collinear(pa, pat, pb) && collinear(pa, pat, pbt);
        },

        endpointsCoincident({p, twin}) {
            if (MCGMath.coincident(this.p, p)) return true;
            if (MCGMath.coincident(this.twin.p, twin.p)) return true;

            return false;
        },

        segmentsCoincident({p, twin}) {
            const coincident = MCGMath.coincident;

            return coincident(this.p, p) && coincident(this.twin.p, twin.p);
        },

        // returns MCG.Math.IntersectionFlags
        intersects(other) {
            const a = this;
            const b = other;
            const pa = a.p;
            const pta = a.twin.p;
            const pb = b.p;
            const ptb = b.twin.p;

            return MCGMath.intersect(pa, pta, pb, ptb);
        },

        intersection(other) {
            const a = this;
            const b = other;

            if (a.endpointsCoincident(b)) return null;

            const pa = a.p;
            const pta = a.twin.p;
            const pb = b.p;
            const ptb = b.twin.p;

            return MCGMath.intersection(pa, pta, pb, ptb);
        },

        setNoncontributing() {
            this.contributing = false;
        }

    });



    export function SweepEventFactory() {
        this.id = 0;
    }

    Object.assign(SweepEventFactory.prototype, {
        createLeft(p) {
            return new LeftSweepEvent(p, this.id++);
        },

        createRight(p) {
            return new RightSweepEvent(p, this.id++);
        },

        clone(e, p) {
            return e.clone(p, this.id++);
        },

        count() {
            return this.id;
        }

    });