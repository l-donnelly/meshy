import * as SweepEvent from "./sweepEvent";
import * as MCGMath from "./math";
import PriorityQueue from "js-priority-queue";
import "bintrees/dist/rbtree";

export const printEvents = false;
export const drawEvents = false;

export function sweep(operation, srcA, srcB) {
        if (!srcA) return null;

        const context = srcA.context;

        const axis = context.axis;
        const ah = context.ah;
        const av = context.av;
        const p = context.p;

        // the farthest event that has occurred (with respect to the scanline) -
        // used to catch events that occur in the past
        let front = null;

        const efactory = new SweepEvent.SweepEventFactory(context);

        const store = operation.initStore(context, srcA, srcB);
        const handleIntersections = store.handleIntersections;
        const dbg = store.dbg;

        // priority queue storing events from left to right
        const events = new PriorityQueue({
            comparator(a, b) { return a.sweepcompare(b); }
        });

        // structure storing the sweep line status
        const status = new RBTree(
            (a, b) => a.linecompare(b)
        );

        // add events for srcA
        srcA.forEachPointPair(addPointPairA);

        // if available, also add for srcB
        if (srcB !== undefined) srcB.forEachPointPair(addPointPairB);

        // process events in order

        let ct = 0;

        while (events.length > 0) {
            const ev = dequeue();

            updateFront(ev);

            if (ev.hvcompare(front) < 0) break;

            if (ev.isLeft) {
                if (!ev.contributing) continue;

                ev.setT(ct++);

                const ins = insert(ev);

                var [up, dn] = eventGetAdjacent(ev);

                // if the up event has the same starting point, it's possible that it
                // was initially below the current event in slope but then became above
                // in slope due to an intersection, so now the current is is below when
                // it should've been above according to the initial placement in the
                // queue; requeue both and continue
                if (up && ev.hvcompare(up) === 0) {
                    requeue(up);
                    requeue(ev);

                    continue;
                }

                ev.setDepthFromBelow(dn);

                if (handleIntersections) {
                    handleEventIntersection(ev, dn);
                    handleEventIntersection(up, ev);
                }
            }
            else {
                const tev = ev.twin;

                if (!tev.contributing) continue;

                handleRightEvent(ev);

                var up = null;
                var dn = null;

                // removing an event causes its two adjacent events to become adjacent
                // to each other, so they may intersect
                [up, dn] = eventGetAdjacent(tev);

                remove(tev);

                // handle possible intersection
                if (handleIntersections) handleEventIntersection(up, dn);
            }
        }

        return store.result;
    }
// create an event pair for a p1-p2 segment
export function createPointPair(p1, p2, wA, wB) {
    if (MCGMath.coincident(p1, p2)) return null;

    // determine direction: if dir, p1 is left and p2 is right; reverse if !dir
    const vertical = p1.h === p2.h;
    const dir = vertical ? (p1.v < p2.v) : (p1.h < p2.h);

    // make events
    const el = efactory.createLeft(dir ? p1 : p2);
    const er = efactory.createRight(dir ? p2 : p1);

    // weight is +1 if vertical line going up through p1 -> p2 edge transitions
    // from outside polygon to inside, else -1)
    el.weightA = dir ? wA : -wA;
    el.weightB = dir ? wB : -wB;

    // link events to each other
    el.twin = er;
    er.twin = el;

    return el;
}

// create and queue an event pair for a p1-p2 segment
export function addPointPair(p1, p2, wA, wB) {
    const el = createPointPair(p1, p2, wA, wB);

    if (el === null) return null;

    const er = el.twin;

    queue(el);
    queue(er);

    return el;
}

// functions for adding source A and B
export function addPointPairA(p1, p2) {
    return addPointPair(p1, p2, 1, 0);
}
export function addPointPairB(p1, p2) {
    return addPointPair(p1, p2, 0, 1);
}

// if an event pair's left-right events are in the incorrect order (this can
// potentially occur when splitting events), recreate the event pair in the
// correct order
export function handleSwappedEventPair(ev) {
    const tev = ev.twin;

    if (ev.hvcompare(tev) < 0) return ev;

    eventInvalidate(ev);

    const el = createPointPair(tev.p, ev.p);
    if (el === null) return null;

    // assign weight and depth
    el.setWeightFrom(ev, true);
    el.depthBelowA = ev.depthBelowA + ev.weightA;
    el.depthBelowB = ev.depthBelowB + ev.weightB;

    return el;
}

export function eventGetAdjacent(ev) {
    const it = status.findIter(ev);

    // if event not found for some reason, check if it's actually present;
    // this is an error
    if (!it) {
        let present = false;
        const iter = status.iterator();
        let e;
        while ((e=iter.next()) !== null) {
            if (e==ev) {
                present = true;
                break;
            }
        }
        if (present) {
            //throw "failed to find event in status " + ev.id + " " + ev.twin.id;
            console.log("failed to find event in status", ev.id, ev.twin.id);
            return;
        }
    }

    let prev = null;
    let next = null;
    if (it) {
        prev = it.prev();
        it.next();
        next = it.next();
    }

    return [next, prev];
}

export function queue(e) {
    if (e === null) return false;
    return events.queue(e);
}

export function dequeue() {
    return events.dequeue();
}

export function requeue(e) {
    if (e === null) return null;

    remove(e);
    return queue(e);
}

export function insert(e) {
    if (!e.contributing) return;

    const ins = status.insert(e);

    return ins;
}

export function remove(e) {
    const rm = status.remove(e);

    return rm;
}

export function handleRightEvent({twin}) {
    const te = twin;

    operation.handleEvent(te, status, store);
    eventInvalidate(te);
}

export function updateFront(ev) {
    if (front === null || ev.hvcompare(front) > 0) front = ev;
}

// if two segments are exactly coincident, merge b into a and invalidate b
export function mergeEvents(a, b) {
    a.setDepthFrom(b);
    a.addWeightFrom(b);

    eventInvalidate(b);

    if (a.zeroWeight()) {
        eventInvalidate(a);
        return null;
    }
    else {
        return a;
    }
}

// handle a possible intersection between a pair of left events;
// event a is above event b
export function handleEventIntersection(a, b) {
    if (a === null || b === null) return null;
    if (!a.contributing || !b.contributing) return null;

    let ta = a.twin;
    let tb = b.twin;
    const coincident = MCGMath.coincident;

    // h-v comparison of start points and end points - 0 if coincident
    const hvcomp = a.hvcompare(b);
    const thvcomp = ta.hvcompare(tb);

    // if two segments are exactly coincident, merge b into a and invalidate b
    if (hvcomp === 0 && thvcomp === 0) {
        remove(a);
        remove(b);

        a = mergeEvents(a, b);
        if (a !== null) {
            insert(a);
            return a.p;
        }
        else return null;
    }

    const flags = MCGMath.IntersectionFlags;
    const intersection = a.intersects(b);

    if (intersection === flags.none) return null;

    const pa = a.p;
    const pb = b.p;
    const pta = ta.p;
    const ptb = tb.p;

    // if events are not horizontal and have no vertical overlap, return
    if (!a.horizontal() && !b.horizontal()) {
        if (Math.max(pa.v, pta.v) < Math.min(pb.v, ptb.v)) return null;
        if (Math.max(pb.v, ptb.v) < Math.min(pa.v, pta.v)) return null;
    }

    // point of intersection
    let pi = null;

    // if intersection is somewhere along both segments, calculate it
    if (intersection === flags.intermediate) {
        pi = a.intersection(b);
    }
    // else, if starting points aren't coincident and intersection includes
    // one or both of them, set intersection point to one of them
    else if ((hvcomp !== 0) && (intersection & flags.a0b0)) {
        const ia0 = intersection & flags.a0;
        const ib0 = intersection & flags.b0;

        // if potential intersection on either start point, pick the later one
        if (ia0 && ib0) pi = hvcomp > 0 ? pa : pb;
        else if (ia0) pi = pa;
        else if (ib0) pi = pb;
    }
    // else, if ending points aren't coincident and intersection includes
    // one or both of them, set intersection point to one of them
    else if ((thvcomp !== 0) && (intersection & flags.a1b1)) {
        const ia1 = intersection & flags.a1;
        const ib1 = intersection & flags.b1;

        // if potential intersection on either end point, pick the earlier one
        if (ia1 && ib1) pi = thvcomp > 0 ? ptb : pta;
        else if (ia1) pi = pta;
        else if (ib1) pi = ptb;
    }

    // return if no intersection
    if (pi === null) return null;

    // coincidence of intersection point with endpoints
    let ca = coincident(pi, pa);

    let cta = coincident(pi, pta);
    let cb = coincident(pi, pb);
    let ctb = coincident(pi, ptb);

    // if intersection point is earlier than the front, need to shift it so
    // that it's at least in the present
    const fphvcomp = front.hvcomparept(pi);
    if (fphvcomp > 0) {
        const h = Math.max(pi.h, front.p.h) + 1;
        const t = b.vertical() ? a : b;

        pi = t.interpolate(h);

        // update coincidence flags
        ca = coincident(pi, pa), cta = coincident(pi, pta);
        cb = coincident(pi, pb), ctb = coincident(pi, ptb);
    }

    // if intersection point is established, split one or both segments
    if (pi !== null) {
        // remove both events - due to numeric imprecision, their place in the
        // status structure may change after splitting
        const rma = remove(a);
        const rmb = remove(b);

        // new events formed by a split
        let ita = null;

        let itb = null;

        // if intersection point is not on either endpoint of a, split a
        if (!(ca || cta)) {
            ita = eventSplit(a, pi);

            a = handleSwappedEventPair(a);
            ita = handleSwappedEventPair(ita);

            queue(ita);
            queue(ita.twin);
        }

        // likewise for b
        if (!(cb || ctb)) {
            itb = eventSplit(b, pi);

            b = handleSwappedEventPair(b);
            itb = handleSwappedEventPair(itb);

            queue(itb);
            queue(itb.twin);
        }

        // a and b may have become coincident; if so, merge them and return
        if (a.segmentsCoincident(b)) {
            a = mergeEvents(a, b);

            if (a !== null) {
                insert(a);
                return a.p;
            }
            else return null;
        }

        ta = a.twin;
        tb = b.twin;

        let ia = false;
        let ib = false;

        // if a's twin is before or at the front, a is entirely in the past, so
        // handle its right event immediately
        if (front.hvcompare(ta) >= 0) handleRightEvent(ta);
        // else, if a split b, it may not have the correct depth, so requeue it
        else if (ca) queue(a);
        // else, just insert it back
        else if (rma) ia = insert(a);

        // likewise for b
        if (front.hvcompare(tb) >= 0) handleRightEvent(tb);
        else if (cb) queue(b);
        else if (rmb) ib = insert(b);

        // error correction: it's possible that initially adjacent events are
        // reinserted into the status structure but now they're not neighbors
        // (b appears below some events sharing the same start point, and/or
        // a appears above some events sharing the same start point)
        if (ia && ib) {
            const iter = status.findIter(b);
            const next = iter.next();

            if (next !== a) {
                // prev initialized to event below b, curr initialized to b
                iter.prev();
                let prev = iter.prev();
                let curr = iter.next();

                // iterate upward from b, updating depths for all events that cross
                // the scanline at the same point b/c those used to be above b
                while (curr && curr.vlinecompare(b) === 0 && curr !== a) {
                    curr.setDepthFromBelow(prev);

                    prev = curr;
                    curr = iter.next();
                }
            }
        }
    }

    return pi;
}

export function eventInvalidate(e) {
    e.setNoncontributing();
}

// given the left endpoint e of an event pair, split it at vertex pi
// returns newly created left event
export function eventSplit(e, pi) {
    const te = e.twin;

    // right and left events at intersection point
    const ei = efactory.clone(te, pi);
    const ite = efactory.clone(e, pi);

    e.twin = ei;
    te.twin = ite;

    queue(ei);

    return ite;
}

// left event is valid if
// 1. it is contributing,
// 2. one side has depth 0 and the other has positive depth
// (right events are not guaranteed to carry the correct depth information)
export function eventValid(e) {
    if (!e.isLeft) e = e.twin;

    if (!e.contributing) return false;

    const pos = e.getPosition();

    return pos & Sweep.EventPositionFlags.boundaryAB;
}

export function statusString() {
    const iter = status.iterator();
    let r = "[ ";
    let e;

    while ((e = iter.next())!==null) {
        r += `${e.id} `;
    }
    r += "]";

    return r;
}

export function statusPrintShort(force) {
    if (!printEvents && !force) return;

    console.log(statusString());
}

export function statusPrint(vmin, vmax, force) {
    if (!printEvents && !force) return;

    if (vmin === undefined) vmin = -Infinity;
    if (vmax === undefined) vmax = Infinity;

    const iter = status.iterator();
    let e;
    let p = null;
    while ((e = iter.prev()) !== null) {
        if (e.p.v < vmin || e.p.v > vmax) continue;
        if (p) eventPairComparisonPrint(p, e, force);
        eventPrint(e, ">N", force);
        p = e;
    }
}

export function eventPairComparisonPrint(ep, ee, force) {
    if (!printEvents && !force) return;

    const lc = MCGMath.leftCompare;
    if (printEvents && ep && ee) {
        const ef = ep.p.h < ee.p.h ? ep : ee;
        const es = ep.p.h < ee.p.h ? ee : ep;
        console.log(
            ep.linecompare(ee), ee.linecompare(ep),
            ep.vlinecompare(ee), ee.vlinecompare(ep),
            ep.scompare(ee), ee.scompare(ep),
            lc(ep.p, ep.twin.p, ee.twin.p), lc(ee.p, ee.twin.p, ep.twin.p),
            lc(ep.p, ep.twin.p, ee.p), lc(ee.p, ee.twin.p, ep.p),
            ee.intersects(ep),
            ef.interpolate(es.p.h).h, ef.interpolate(es.p.h).v
        );
    }
}

export function statusDraw(ev, factor, d, force) {
    if (!drawEvents && !force) return;

    const iter = status.iterator();
    let e;
    let vmin = Infinity;
    let vmax = -Infinity;
    const ctx = Object.assign({}, context);
    ctx.d += d;
    while ((e = iter.next()) !== null) {
        const ep = e.p;
        const etp = e.twin.p;
        vmin = Math.min(vmin, ep.v, etp.v);
        vmax = Math.max(vmax, ep.v, etp.v);
        const epc = ep.clone().multiplyScalar(factor);
        const etpc = etp.clone().multiplyScalar(factor);
        debug.line(epc.toVector3(THREE.Vector3, ctx), etpc.toVector3(THREE.Vector3, ctx), 1, false, 0, ctx.axis);
    }

    const top = ev.p.clone().setV(vmax).multiplyScalar(factor);
    const bot = ev.p.clone().setV(vmin).multiplyScalar(factor);
    debug.line(top.toVector3(THREE.Vector3, ctx), bot.toVector3(THREE.Vector3, ctx), 1, false, 0, ctx.axis);
}

export function statusValid() {
    const iter = status.iterator();
    let e;
    let p = null;
    while ((e = iter.prev()) !== null) {
        if (p) {
            const cpe = p.linecompare(e);
            const cep = e.linecompare(p);
            if (cpe === cep || cpe === 0 || cep === 0) return false;
        }
        p = e;
    }

    return true;
}

export function eventPrint(e, pref, force) {
    if (!force && !printEvents) return;

    if (e===null) console.log(pref, "null");
    else if (e===undefined) console.log(pref, "undefined");
    else console.log(e.toString(pref));
}

export function eventDraw(e, offset, color, force) {
    if (!e || (!force && !drawEvents)) return;

    offset = offset || 0;
    color = color || eventColor(e);
    debug.oneline(e.p.toVector3(THREE.Vector3, context), e.twin.p.toVector3(THREE.Vector3, context), offset, axis, color);
}

export function eventColor({isLeft, twin, contributing}) {
    if (!isLeft) {
        if (eventValid(twin)) return 0x66ff66;
        else return 0xff0000;
    }
    else if (contributing) return 0xff6666;
    else return 0x6666ff;
}
