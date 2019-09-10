import {Types} from "./types"
import * as MCGMath from "./math"

export const AdjacencyMap = (() => {

    function AdjacencyMap(context) {
        this.context = context;

        this.type = Types.abstractAdjacencyMap;
    }

    return AdjacencyMap;

})();

export const DirectedAdjacencyMap = (() => {
    class DirectedAdjacencyMap {
        constructor(context) {
            AdjacencyMap.call(this, context);

            this.map = {};

            this.type = Types.directedAdjacencyMap;
        }

        addSegment(s) {
            const m = this.map;

            const p1 = s.p1;
            const p2 = s.p2;
            const hash1 = p1.hash();
            const hash2 = p2.hash();

            if (!m.hasOwnProperty(hash1)) {
                m[hash1] = new AdjacencyMapNode(p1, this.context);
            }
            if (!m.hasOwnProperty(hash2)) {
                m[hash2] = new AdjacencyMapNode(p2, this.context);
            }

            const node1 = m[hash1];
            const node2 = m[hash2];

            node1.addNode(node2);
        }

        getKeyWithNoPredecessors() {
            return this.getKey(DirectedAdjacencyMap.NodeSelectors.noPredecessors);
        }

        getKeyWithOneNeighbor() {
            return this.getKey(DirectedAdjacencyMap.NodeSelectors.oneNeighbor);
        }

        // get a key that has some neighbors; prioritize nodes with one neighbor
        getKeyWithNeighbors() {
            let res = this.getKey(DirectedAdjacencyMap.NodeSelectors.oneNeighbor);
            if (res) return res;

            return this.getKey(DirectedAdjacencyMap.NodeSelectors.neighbors);
        }

        getKeyWithNoNeighbors() {
            return this.getKey(DirectedAdjacencyMap.NodeSelectors.noNeighbors);
        }

        // get the key to a node that satisfies selector sel
        getKey(sel) {
            const m = this.map;
            if (sel === undefined) sel = DirectedAdjacencyMap.NodeSelectors.oneNeighbor;

            for (const key in m) {
                if (sel(m[key])) return key;
            }

            return null;
        }

        // return a loop of points
        // if allowOpen (true by default), get the open vertex loops first and count
        // them as closed, then the closed loops
        // NB: this mutates the adjacency map
        getLoop(allowOpen) {
            const m = this.map;
            const _this = this;
            if (allowOpen === undefined) allowOpen = true;

            let startkey;

            // get a key from the map
            while ((startkey = getNewKey()) !== null) {
                const start = m[startkey];
                let current = start;
                let prev = null;

                const loop = [];

                // iterate until we circle back to the start
                do {
                    loop.push(current.pt);

                    const next = current.nextNode(prev);
                    if (next === null) break;

                    prev = current;
                    current = next;
                } while (current !== start);

                // if complete loop, return that
                if (current === start || allowOpen) return loop;
            }

            // failed to find a loop
            return null;

            function getNewKey() {
                let key = null;

                // if allowing open polygons, find the start of an open vertex chain
                if (allowOpen) key = _this.getKeyWithNoPredecessors();

                // didn't find a key at the start of an open vertex chain; now just find
                // a key with some neighbors
                if (key === null) {
                    key = _this.getKeyWithNeighbors();
                    allowOpen = false;
                }

                return key;
            }
        }

        // return as many loops as the adjacency map has
        // NB: this mutates the adjacency map
        getLoops() {
            const m = this.map;
            const loops = [];

            let loop = null;

            while ((loop = this.getLoop()) !== null) {
                loops.push(loop);
            }

            return loops;
        }
    }

    DirectedAdjacencyMap.NodeSelectors = {
        noPredecessors({predcount, count}) { return predcount === 0 && count > 0; },
        oneNeighbor({count}) { return count === 1; },
        neighbors({count}) { return count > 0; },
        noNeighbors({count}) { return count === 0; }
    };

    return DirectedAdjacencyMap;
})();

export const AdjacencyMapNode = (() => {
    // one node signifies one point; a neighbor is another point
    // if count == 0, the node has no neighbor and is either isolated or at the end
    // of a (directed) chain of edges
    // if count == 1, the node points to one neighbor and a traversal can go to
    // that neighbor
    // if count > 1, the node has multiple outgoing directed paths; in that case,
    // neighbor information is recorded in the neighbors array
    class AdjacencyMapNode {
        constructor(pt, context) {
            this.pt = pt;
            this.count = 0;
            this.predcount = 0;

            // neighbor; is set if count === 1
            this.neighbor = null;
            // array of neighbor nodes; is set if count > 1
            this.neighbors = null;
        }

        // if no neighbors, set neighbor to other
        // if 1+ neighbors already exist, push to neighbors array (init if necessary)
        addNode(other) {
            if (this.count === 0) this.neighbor = other;
            else {
                if (this.count === 1) {
                    this.neighbors = [];
                    this.neighbors.push(this.neighbor);

                    this.neighbor = null;
                }

                this.neighbors.push(other);
            }

            this.count++;
            other.predcount++;
        }

        removeNode(node) {
            let n = null;

            // only one neighbor; get it and null out the current neighbor
            if (this.count === 1) {
                if (this.neighbor === node) {
                    n = this.neighbor;
                    this.neighbor = null;
                    this.count--;
                }
            }
            // multiple neighbors
            else if (this.count > 1) {
                // find neighbor
                const idx = this.neighbors.indexOf(node);

                // if found neighbor, get it and remove it from neighbors array
                if (idx > -1) {
                    n = this.neighbors[idx];
                    this.neighbors.splice(idx, 1);
                    this.count--;

                    // if 1 neighbor left, move it to .neighbor and null out neighbors
                    if (this.count === 1) {
                        this.neighbor = this.neighbors[0];
                        this.neighbors = null;
                    }
                }
            }

            if (n !== null) n.predcount--;

            return n;
        }

        // get the neighbor node:
        //  if there is one neighbor, return that
        //  if there are multiple neighbors, take the rightmost possible turn
        nextNode(prev) {
            if (this.count < 1) {
                return null;
            }
            else {
                let p = null;

                if (this.count === 1) p = this.neighbor;
                else p = this.getRightmostNode(prev);

                const result = p !== null ? this.removeNode(p) : null;

                return result;
            }
        }

        getRightmostNode(prev) {
            // traversal might have started at a node with two neighbors without getting
            // there from a previous node; in that case, just pick one of the neighbors
            if (prev === null) return this.neighbors[0];

            const neighbors = this.neighbors;
            const pt = this.pt;
            const prevpt = prev.pt;

            const inDir = prevpt.vectorTo(pt);

            const PI = Math.PI;

            let anglemax = -PI;
            let anglemaxidx = -1;

            const left = MCGMath.left;

            for (let ni = 0; ni < neighbors.length; ni++) {
                const npt = neighbors[ni].pt;

                const d = pt.vectorTo(npt);
                let angle = inDir.angleTo(d);

                // correct for negative angles
                if (left(prevpt, pt, npt)) angle = -angle;

                if (angle > PI) angle = -PI;

                if (angle >= anglemax) {
                    anglemax = angle;
                    anglemaxidx = ni;
                }
            }

            const p = anglemaxidx > -1 ? neighbors[anglemaxidx] : null;

            return p;
        }
    }

    return AdjacencyMapNode;
})();