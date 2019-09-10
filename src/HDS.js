/* Typical halfedge data structure. */
import * as Utils from "./utils";

class HDSHalfedge {
    constructor(node, face) {
        // node at the start of this halfedge
        if (node!==undefined) {
            this.node = node;
            node.halfedge = this;
        }
        else {
            this.node = null;
        }
        // next halfedge CCW around the same face
        this.next = null;
        // twin halfedge
        this.twin = null;
        // HDS face to the left of this halfedge
        this.face = face;
    }

    prev() {
        let twin = this.twin;

        while (twin.next != this) {
            if (!twin || !twin.next) return null;
            twin = twin.next.twin;
        }

        return twin;
    }

    nstart() {
        return this.node;
    }

    nend() {
        if (!this.next) return null;
        return this.next.node;
    }

    rotated() {
        if (!this.twin) return null;
        return this.twin.next;
    }
}

class HDSNode {
    constructor(v) {
        // vertex
        this.v = v!==undefined ? v : null;
        // one of the 1+ halfedges starting at this node
        this.halfedge = null;
    }

    isolated() {
        return this.halfedge == null;
    }

    terminal() {
        return this.halfedge.twin.next == this.halfedge;
    }
}



function HDSFace(he, face3) {
    this.id = -1;
    // one of the halfedges on this face
    this.halfedge = he!==undefined ? he : null;
    // THREE.Face3 object
    this.face3 = face3;
}



class HDSFaceArray {
    constructor(vs) {
        this.vs = vs;
        this.faces = [];
        this.count = 0;
        this.area = 0;
    }

    addFace(face) {
        // add face
        this.faces.push(face);
        this.count++;
        this.area += Utils.faceGetArea(face.face3, this.vs);
    }
}

class HDS {
    constructor(sourceVertices, sourceFaces) {
        const vs = sourceVertices;
        const fs = sourceFaces;

        this.vs = vs;

        const nv = vs.length;
        const nf = fs.length;

        const nodes = new Array(nv);
        const halfedges = [];
        const faces = new Array(nf);

        this.nodes = nodes;
        this.halfedges = halfedges;
        this.faces = faces;

        // maps tuples of vertex indices (each signifying a CCW-directed edge) to a
        // halfedge array index
        const hemap = {};

        // prepopulate node array
        for (let n = 0; n < nv; n++) {
            nodes[n] = new HDSNode(vs[n]);
        }

        // populate face and halfedge arrays
        for (let f = 0; f < nf; f++) {
            const face3 = fs[f];

            var face = new HDSFace(null, face3);
            face.id = f;
            faces[f] = face;

            const a = face3.a;
            const b = face3.b;
            const c = face3.c;

            const heab = addHalfedge(a, b);
            const hebc = addHalfedge(b, c);
            const heca = addHalfedge(c, a);

            heab.next = hebc;
            hebc.next = heca;
            heca.next = heab;

            face.halfedge = heab;
        }

        function addHalfedge(i, j) {
            // create new halfedge from i to j
            const he = new HDSHalfedge(nodes[i]);

            const hash = tupleHash(j, i);

            // if halfedge map has a twin for this halfedge, assign their .twins
            if (hemap.hasOwnProperty(hash)) {
                const twin = halfedges[hemap[hash]];

                twin.twin = he;
                he.twin = twin;
            }

            // store hashmap entry
            const idx = halfedges.length;
            hemap[tupleHash(i, j)] = idx;

            // store halfedge
            halfedges.push(he);

            he.face = face;

            return he;
        }

        function tupleHash(i, j) { return `${i}_${j}`; }
    }

    // extract groups of connected faces that satisfy the given criterion
    groupIntoIslands(valid) {
        if (valid===undefined) valid = () => true

        const faces = this.faces;
        const vs = this.vs;
        const nf = faces.length;

        const seen = new Array(nf);
        seen.fill(false);

        const islands = [];

        // go over every face
        for (let f = 0; f < nf; f++) {
            if (seen[f]) continue;

            const fstart = faces[f];

            // if face is valid, perform a DFS for all reachable valid faces
            if (valid(fstart)) {
                const island = search(fstart);

                if (island.count > 0) islands.push(island);
            }
            else seen[f] = true;
        }

        return islands;

        // does the depth-first search
        function search(fstart) {
            const island = new HDSFaceArray(vs);

            const faceStack = [];

            faceStack.push(fstart);
            while (faceStack.length > 0) {
                const face = faceStack.pop();

                if (seen[face.id]) continue;
                seen[face.id] = true;

                if (valid(face)) {
                    island.addFace(face);

                    const hestart = face.halfedge;
                    let he = hestart;
                    do {
                        if (he.twin) {
                            const neighbor = he.twin.face;
                            if (neighbor) faceStack.push(neighbor);
                        }
                        he = he.next;
                    } while (he != hestart);
                }
            }

            return island;
        }
    }

    filterFaces(valid) {
        const faces = this.faces;
        const nf = faces.length;

        const result = new HDSFaceArray(this.vs);

        for (let f = 0; f < nf; f++) {
            const face = faces[f];
            if (valid(face)) result.addFace(face);
        }

        return result;
    }
}

export { HDS }