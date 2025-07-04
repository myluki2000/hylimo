import { DefaultEditTypes, LinePoint } from "@hylimo/diagram-common";
import type { ModelIndexImpl } from "sprotty";
import { findParentByFeature } from "sprotty";
import { SAbsolutePoint } from "../../model/canvas/sAbsolutePoint.js";
import { SCanvasConnection } from "../../model/canvas/sCanvasConnection.js";
import type { SCanvasContent } from "../../model/canvas/sCanvasContent.js";
import { SCanvasElement } from "../../model/canvas/sCanvasElement.js";
import { SCanvasPoint } from "../../model/canvas/sCanvasPoint.js";
import { SLinePoint } from "../../model/canvas/sLinePoint.js";
import { SRelativePoint } from "../../model/canvas/sRelativePoint.js";
import { SMarker } from "../../model/canvas/sMarker.js";
import { SCanvasBezierSegment } from "../../model/canvas/sCanvasBezierSegment.js";
import type { CanvasLike } from "../../model/canvas/canvasLike.js";
import type { SElement } from "../../model/sElement.js";

/**
 * Helper to select the points and elements which have to be modified during a move edit.
 * Automatically detects which points are implicitly moved by other points.
 * If a relative point is not editable, it tries to move the target instead.
 * After initialization the result can be found in the following fields:
 * - movedElements: Elements which are moved.
 * - hasConflict: True if there is any conflict that prevents the move.
 */
export class MovedElementsSelector {
    /**
     * Elements (canvas elements and points) which are moved.
     */
    movedElements: Set<SCanvasElement | SCanvasPoint> = new Set();

    /**
     * Elements which are implicitely moved.
     */
    implicitlyMovedElements: Set<SCanvasElement | SCanvasPoint> = new Set();

    /**
     * True if there is any conflict that prevents the move
     */
    hasConflict = false;

    /**
     * True if the element is moved
     */
    private readonly isMovedLookup: Map<string, boolean> = new Map();

    /**
     * Returns the (implicitely) moved element ids
     */
    get movedOrImplicitlyMovedElementIds(): Set<string> {
        const movedOrImplicitlyMovedElementIds = new Set<string>();
        for (const element of this.movedElements) {
            movedOrImplicitlyMovedElementIds.add(element.id);
        }
        for (const element of this.implicitlyMovedElements) {
            movedOrImplicitlyMovedElementIds.add(element.id);
        }
        return movedOrImplicitlyMovedElementIds;
    }

    /**
     * Creates a new moved elements selector.
     * The results are available immediately after creation.
     *
     * @param selected the selected elements
     * @param index index for element lookup
     */
    constructor(
        readonly selected: (SCanvasElement | SCanvasPoint | SMarker)[],
        private readonly index: ModelIndexImpl
    ) {
        this.registerElements(new Set(selected));
        this.pruneMovedElements();
        this.registerAdditionalImplicitlyMovedElements();
    }

    /**
     * Registers the points and elements which are required to move so that elements are moved as a whole.
     * Does not perform pruning of implicitly moved elements
     *
     * @param points the points to move
     */
    private registerElements(elements: Set<SCanvasPoint | SCanvasElement | SMarker>) {
        let currentElements: Set<SCanvasContent | SMarker> = elements;
        while (currentElements.size > 0) {
            const newElements = new Set<SCanvasContent>();
            for (const element of currentElements) {
                if (element instanceof SCanvasConnection) {
                    newElements.add(this.index.getById(element.segments.at(-1)!.end) as SCanvasContent);
                } else if (element instanceof SMarker) {
                    newElements.add(this.index.getById(element.posId) as SCanvasContent);
                } else {
                    this.movedElements.add(element as SCanvasPoint | SCanvasElement);
                }
                if (element instanceof SCanvasElement) {
                    if (element.pos != undefined) {
                        newElements.add(this.index.getById(element.pos) as SCanvasContent);
                    }
                } else if (element instanceof SRelativePoint) {
                    const editable =
                        DefaultEditTypes.MOVE_X in element.edits || DefaultEditTypes.MOVE_Y in element.edits;
                    if (!editable) {
                        newElements.add(this.index.getById(element.target) as SCanvasContent);
                    }
                }
            }
            currentElements = newElements;
        }
    }

    /**
     * Registers all elements which are implicitly moved.
     * This is done by checking if the element is moved and if it is not already in the moved elements set.
     */
    private registerAdditionalImplicitlyMovedElements(): void {
        for (const element of this.index.all()) {
            if (element instanceof SCanvasElement || element instanceof SCanvasPoint) {
                if (!this.movedElements.has(element) && this.isElementImplicitlyMoved(element, false)) {
                    this.implicitlyMovedElements.add(element);
                }
            }
        }
    }

    /**
     * Prunes the moved elements and points to remove implicitly moved elements.
     */
    private pruneMovedElements() {
        for (const element of this.movedElements) {
            if (this.isElementImplicitlyMoved(element, true)) {
                this.implicitlyMovedElements.add(element);
            }
        }
        for (const element of this.implicitlyMovedElements) {
            this.movedElements.delete(element);
        }
    }

    /**
     * Checks if an element is moved.
     *
     * @param elementId the id of the element to check
     * @param consistencyChecks if false, consistency checks are skipped
     * @returns true if the element is moved, otherwise false
     */
    private isMoved(elementId: string, consistencyChecks: boolean): boolean {
        const fromLookup = this.isMovedLookup.get(elementId);
        if (fromLookup != undefined) {
            return fromLookup;
        }
        const element = this.index.getById(elementId);
        if (element instanceof SCanvasElement || element instanceof SCanvasPoint) {
            const isMoved = this.isElementMoved(element, consistencyChecks);
            this.isMovedLookup.set(elementId, isMoved);
            return isMoved;
        } else {
            throw new Error("Invalid element (should not be reachable)");
        }
    }

    /**
     * Checks if an element is moved.
     *
     * @param element the element to check
     * @param consistencyChecks if false, consistency checks are skipped
     * @returns true if the element is moved, otherwise false
     */
    private isElementMoved(element: SCanvasElement | SCanvasPoint, consistencyChecks: boolean): boolean {
        if (this.movedElements.has(element)) {
            return true;
        }
        return this.isElementImplicitlyMoved(element, consistencyChecks);
    }

    /**
     * Checks if an element is implicitly moved.
     * - A canvas element is moved if its position is moved, if it is moved explicitly, or if the parent canvas is moved.
     * - A relative point is moved if the target is moved.
     * - A line point is moved if the (relevant segment of the) line provider is moved.
     * - An absolute point is moved if the parent canvas is moved.
     *
     * @param element the element to check
     * @param consistencyChecks if false, consistency checks are skipped
     * @returns true if the element is implicitly moved, otherwise false
     */
    private isElementImplicitlyMoved(element: SCanvasElement | SCanvasPoint, consistencyChecks: boolean): boolean {
        if (element instanceof SCanvasElement) {
            if (element.pos != undefined) {
                return this.isMoved(element.pos, consistencyChecks);
            }
            return this.isParentCanvasImplicitlyMoved(element, consistencyChecks);
        } else if (element instanceof SRelativePoint) {
            const target = this.index.getById(element.target) as SCanvasPoint | SCanvasElement | SCanvasConnection;
            if (target instanceof SCanvasConnection) {
                return this.isMoved(target.segments.at(-1)!.end, consistencyChecks);
            } else {
                return this.isMoved(element.target, consistencyChecks);
            }
        } else if (element instanceof SLinePoint) {
            const lineProviderId = element.lineProvider;
            const lineProvider = this.index.getById(lineProviderId) as SCanvasContent;
            if (lineProvider instanceof SCanvasElement) {
                return this.isMoved(lineProviderId, consistencyChecks);
            }
            if (lineProvider instanceof SCanvasConnection) {
                const affectedSegment = LinePoint.calcSegmentIndex(element.pos, lineProvider.segments.length);
                return this.isCanvasConnectionSegmentMoved(lineProvider, affectedSegment, consistencyChecks);
            }
        } else if (element instanceof SAbsolutePoint) {
            return this.isParentCanvasImplicitlyMoved(element, consistencyChecks);
        }
        return false;
    }

    /**
     * Checks if a canvas connection segment is moved
     * It is moved if all relevant points (start, end, control points) are moved.
     * If only some points are moved, it is considered a conflict, for which the hasConflict flag is set.
     *
     * @param connection the connection to check
     * @param segmentIndex the index of the segment to check
     * @param consistencyChecks if false, consistency checks are skipped
     * @returns true if the segment is moved, otherwise false
     */
    private isCanvasConnectionSegmentMoved(
        connection: SCanvasConnection,
        segmentIndex: number,
        consistencyChecks: boolean
    ): boolean {
        const relevantPoints: string[] = [];
        if (segmentIndex === 0) {
            relevantPoints.push(connection.start);
        } else {
            relevantPoints.push(connection.segments[segmentIndex - 1].end);
        }
        const segment = connection.segments[segmentIndex];
        relevantPoints.push(segment.end);
        if (segment instanceof SCanvasBezierSegment) {
            relevantPoints.push(segment.startControlPoint, segment.endControlPoint);
        }
        const isMoved = relevantPoints.map((point) => this.isMoved(point, consistencyChecks));
        const result = isMoved.some((moved) => moved);
        if (consistencyChecks && result && isMoved.some((moved) => !moved)) {
            this.hasConflict = true;
        }
        return result;
    }

    /**
     * Checks if an element is moved implicitly by a parent canvas (which is located inside another SCanvasElement or SMarker).
     *
     * @param element the element to check
     * @param consistencyChecks if false, consistency checks are skipped
     * @returns true if the element is moved implicitly by a parent canvas, otherwise false
     */
    private isParentCanvasImplicitlyMoved(
        element: SCanvasElement | SAbsolutePoint,
        consistencyChecks: boolean
    ): boolean {
        const canvas = element.parent as CanvasLike & SElement;
        const isCanvasMoved = this.isMovedLookup.get(canvas.id);
        if (isCanvasMoved != undefined) {
            return isCanvasMoved;
        }
        const parentCanvasContent = findParentByFeature(
            canvas,
            (parent) => parent instanceof SMarker || parent instanceof SCanvasElement
        ) as SMarker | SCanvasElement | undefined;
        let isParentCanvasMoved = false;
        if (parentCanvasContent instanceof SCanvasElement) {
            isParentCanvasMoved = this.isMoved(parentCanvasContent.id, consistencyChecks);
        } else if (parentCanvasContent instanceof SMarker) {
            const connection = parentCanvasContent.parent as SCanvasConnection;
            const segmentIndex = parentCanvasContent.pos == "start" ? 0 : connection.segments.length - 1;
            isParentCanvasMoved = this.isCanvasConnectionSegmentMoved(connection, segmentIndex, consistencyChecks);
        }
        this.isMovedLookup.set(canvas.id, isParentCanvasMoved);
        return isParentCanvasMoved;
    }
}
