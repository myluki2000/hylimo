import { ArcSegment, type Size, type Line, LineSegment, type Point, type Element } from "@hylimo/diagram-common";
import type { Layout } from "../engine/layout.js";
import type { LayoutElement, SizeConstraints } from "../layoutElement.js";

/**
 * Base class for ElementLayoutConfig and ContentLayoutConfig providing common functionality
 */
export abstract class BaseLayoutConfig {
    /**
     * Called to determine the size the element requires
     *
     * @param layout performs the layout
     * @param element the element to measure
     * @param constraints defines min and max size
     * @returns the calculated size
     */
    abstract measure(layout: Layout, element: LayoutElement, constraints: SizeConstraints): Size;

    /**
     * Called to render the element
     *
     * @param layout performs the layout
     * @param element the element to render
     * @param position offset in current context
     * @param size the size of the element
     * @param id the id of the element
     * @returns the rendered element
     */
    abstract layout(layout: Layout, element: LayoutElement, position: Point, size: Size, id: string): Element[];

    /**
     * Called to create the outline of an element.
     * Default implementation just returns the bounding box rect, starting at the center right position
     *
     * @param layout performs the layout
     * @param element the element to get the outline of
     * @param position offset in current context
     * @param size the size of the element
     * @param id the id of the element
     * @returns the outline of the element
     */
    outline(layout: Layout, element: LayoutElement, position: Point, size: Size, id: string): Line {
        const { x, y } = position;
        const { width, height } = size;
        const startPos = {
            x: x + width,
            y: y + height / 2
        };
        const segments: LineSegment[] = [
            this.lineSegment(x + width, y + height, id, 0),
            this.lineSegment(x + width / 2, y + height, id, 1),
            this.lineSegment(x, y + height, id, 2),
            this.lineSegment(x, y + height / 2, id, 3),
            this.lineSegment(x, y, id, 4),
            this.lineSegment(x + width / 2, y, id, 5),
            this.lineSegment(x + width, y, id, 6),
            this.lineSegment(startPos.x, startPos.y, id, 7)
        ];
        return {
            start: startPos,
            segments,
            isClosed: true
        };
    }

    /**
     * Helper to create a line segment
     *
     * @param x the end x coordinate
     * @param y the end y coordiate
     * @param origin the origin of the segment
     * @param originSegment the index of the segment of {@link origin} this segment originates from
     * @returns the generated line segment
     */
    protected lineSegment(x: number, y: number, origin: string, originSegment: number): LineSegment {
        return {
            type: LineSegment.TYPE,
            end: {
                x,
                y
            },
            origin,
            originSegment
        };
    }

    /**
     * Helper to create a clockwise arc segment
     *
     * @param cx x coordinate of the center
     * @param cy y coordinate of the center
     * @param endX x coordinate of the end
     * @param endY y coordinate of the end
     * @param radius both x and y radius
     * @param origin the origin of the segment
     * @param originSegment the index of the segment of {@link origin} this segment originates from
     * @returns the created arc segment
     */
    protected arcSegment(
        cx: number,
        cy: number,
        endX: number,
        endY: number,
        radius: number,
        origin: string,
        originSegment: number
    ): ArcSegment {
        return {
            type: ArcSegment.TYPE,
            clockwise: true,
            end: {
                x: endX,
                y: endY
            },
            center: {
                x: cx,
                y: cy
            },
            radiusX: radius,
            radiusY: radius,
            origin,
            originSegment
        };
    }
}
