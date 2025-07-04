import type { FullObject } from "@hylimo/core";
import { objectToList } from "@hylimo/core";
import type { Size, Element, Bounds, MarkerLayoutInformation } from "@hylimo/diagram-common";
import {
    Point,
    Canvas,
    CanvasElement,
    CanvasConnection,
    AbsolutePoint,
    RelativePoint,
    LinePoint,
    Math2D,
    svgPathBbox
} from "@hylimo/diagram-common";
import type { LayoutElement } from "../../layoutElement.js";
import { ContentCardinality } from "../../layoutElement.js";
import type { Layout } from "../../engine/layout.js";
import { StyledElementLayoutConfig } from "../styledElementLayoutConfig.js";
import { elementType } from "../../../module/base/types.js";
import type { CanvasContentLayoutConfig } from "./canvasContentLayoutConfig.js";

/**
 * Layout config for the canvas
 */
export class CanvasLayoutConfig extends StyledElementLayoutConfig {
    override type = Canvas.TYPE;

    constructor() {
        super(
            [],
            [],
            elementType(
                CanvasElement.TYPE,
                CanvasConnection.TYPE,
                AbsolutePoint.TYPE,
                RelativePoint.TYPE,
                LinePoint.TYPE
            ),
            ContentCardinality.Many
        );
    }

    override measure(layout: Layout, element: LayoutElement): Size {
        const contents = element.children;
        contents.map((content) =>
            layout.measure(content, {
                min: { width: 0, height: 0 },
                max: { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY }
            })
        );

        const children: Element[] = [];
        const layoutChildren: Element[] = [];
        for (const content of contents) {
            const newChildren = layout.layout(content, Point.ORIGIN, content.measuredSize!);
            if ((content.layoutConfig as CanvasContentLayoutConfig).isLayoutContent || content.isHidden) {
                layoutChildren.push(...newChildren);
            } else {
                children.push(...newChildren);
            }
        }
        const childBounds: Bounds[] = [];
        for (const child of children) {
            if (child.type == CanvasElement.TYPE) {
                childBounds.push(this.calculateCanvasElementBounds(child as CanvasElement, layout));
            } else if (child.type == CanvasConnection.TYPE) {
                childBounds.push(...this.calculateConnectionBounds(child as CanvasConnection, layout));
            }
        }
        const bounds = Math2D.mergeBounds(childBounds);
        element.childElements = [...children, ...layoutChildren];
        element.canvasBounds = bounds;

        return bounds.size;
    }

    override layout(layout: Layout, element: LayoutElement, position: Point, size: Size, id: string): Element[] {
        const bounds = element.canvasBounds as Bounds;
        const children = element.childElements as Element[];
        const result: Canvas = {
            type: Canvas.TYPE,
            id,
            ...position,
            ...size,
            dx: position.x - bounds.position.x,
            dy: position.y - bounds.position.y,
            children: children,
            edits: element.edits
        };
        return [result];
    }

    /**
     * Calculates the bounds of a rotated rectangle
     * Model:
     * A rectangle is located at pos (where pos is the top left corner).
     * The rectangle has the given width and height.
     * The rectangle is then moved by x and y relative to pos, and then rotated by rotation around pos.
     * The model was chosen as it maps relatively well to the bounding box of a canvas element and marker.
     *
     * @param pos the position of the element
     * @param rotation the rotation of the element in degrees
     * @param x the relative x position
     * @param y the relative y position
     * @param width the width of the element
     * @param height the height of the element
     * @returns the bounds of the element
     */
    private calculateRotatedRectangleBounds(
        pos: Point,
        rotation: number,
        x: number,
        y: number,
        width: number,
        height: number
    ): Bounds {
        const bounds = Math2D.rotateBounds(
            { position: { x: x, y: y }, size: { width, height } },
            (rotation * Math.PI) / 180
        );
        return {
            position: {
                x: bounds.position.x + pos.x,
                y: bounds.position.y + pos.y
            },
            size: bounds.size
        };
    }

    /**
     * Calculates the bounds for the given canvas element
     *
     * @param element the element to calculate the bounds for
     * @param layout the layout providing the canvas layout engine
     * @returns the bounds of the element
     */
    private calculateCanvasElementBounds(element: CanvasElement, layout: Layout): Bounds {
        const pos = layout.layoutEngine.layoutElement(element);
        return this.calculateRotatedRectangleBounds(
            pos,
            element.rotation,
            element.dx,
            element.dy,
            element.width,
            element.height
        );
    }

    /**
     * Calculates the bounds for the given canvas connection
     *
     * @param connection the connection to calculate the bounds for
     * @param layout the layout providing the canvas layout engine
     * @returns the bounds of the connection (and if existing, the markers)
     */
    private calculateConnectionBounds(connection: CanvasConnection, layout: Layout): Bounds[] {
        const connectionLayout = layout.layoutEngine.layoutConnection(connection);
        const pathBounds = svgPathBbox(connectionLayout.path, connection.stroke);
        const bounds: Bounds[] = [
            {
                position: {
                    x: pathBounds.x - pathBounds.overflow.left,
                    y: pathBounds.y - pathBounds.overflow.top
                },
                size: {
                    width: pathBounds.width + pathBounds.overflow.left + pathBounds.overflow.right,
                    height: pathBounds.height + pathBounds.overflow.top + pathBounds.overflow.bottom
                }
            }
        ];
        if (connectionLayout.startMarker != undefined) {
            bounds.push(this.calculateMarkerBounds(connectionLayout.startMarker));
        }
        if (connectionLayout.endMarker != undefined) {
            bounds.push(this.calculateMarkerBounds(connectionLayout.endMarker));
        }
        return bounds;
    }

    /**
     * Calculates the bounds for the given marker
     * See {@link Marker} how a marker is aligned relative to the connection start or end
     *
     * @param markerLayout the layout information of the marker
     * @returns the bounds of the marker
     */
    private calculateMarkerBounds(markerLayout: MarkerLayoutInformation): Bounds {
        const marker = markerLayout.marker;
        const x = -marker.width * markerLayout.marker.refX;
        const y = -marker.height * markerLayout.marker.refY;
        return this.calculateRotatedRectangleBounds(
            markerLayout.position,
            markerLayout.rotation,
            x,
            y,
            marker.width,
            marker.height
        );
    }

    override getChildren(element: LayoutElement): FullObject[] {
        const contents = element.element.getLocalFieldOrUndefined("contents")?.value as FullObject | undefined;
        if (contents) {
            return objectToList(contents) as FullObject[];
        } else {
            return [];
        }
    }
}
