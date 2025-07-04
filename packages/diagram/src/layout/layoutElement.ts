import type { ExecutableAbstractFunctionExpression, FullObject, Type } from "@hylimo/core";
import type { EditSpecification, Element, Line, Point, Size } from "@hylimo/diagram-common";
import type { Layout } from "./engine/layout.js";
import type { Bounds } from "@hylimo/diagram-common";
import type { Matrix } from "transformation-matrix";

/**
 * Size constraints from min to max size
 */
export interface SizeConstraints {
    min: Size;
    max: Size;
}

/**
 * Adds an additive value to height and width of both max and min of a SizeConstraints
 *
 * @param constraints the basis for the new computed constraints
 * @param additiveWidth the value to add to width
 * @param additiveHeight the value to add to height
 * @returns the new computed size constraints
 */
export function addToConstraints(
    constraints: SizeConstraints,
    additiveWidth: number,
    additiveHeight: number
): SizeConstraints {
    return {
        min: addToSize(constraints.min, additiveWidth, additiveHeight),
        max: addToSize(constraints.max, additiveWidth, additiveHeight)
    };
}

/**
 * Adds an additive value to height and width of the size
 *
 * @param size the base size
 * @param additiveWidth the value to add to width
 * @param additiveHeight the value to add to height
 * @returns the new computed size constraints
 */
export function addToSize(size: Size, additiveWidth: number, additiveHeight: number): Size {
    return {
        width: size.width + additiveWidth,
        height: size.height + additiveHeight
    };
}

/**
 * Creats a size that fits the constraints, assuming the constraints are well-defined
 *
 * @param size the size to fit
 * @param constraints the constraints for the size
 */
export function matchToConstraints(size: Size, constraints: SizeConstraints): Size {
    return {
        width: Math.min(Math.max(constraints.min.width, size.width), constraints.max.width),
        height: Math.min(Math.max(constraints.min.height, size.height), constraints.max.height)
    };
}

/**
 * Controls the horizontal alignment of an element
 */
export enum HorizontalAlignment {
    LEFT = "left",
    CENTER = "center",
    RIGHT = "right"
}

/**
 * Controls the vertical alignment of an element
 */
export enum VerticalAlignment {
    TOP = "top",
    CENTER = "center",
    BOTTOM = "bottom"
}

/**
 * Style based information required for the layout
 */
export interface LayoutInformation {
    /**
     * Top margin
     */
    marginTop: number;
    /**
     * Bottom margin
     */
    marginBottom: number;
    /**
     * Left margin
     */
    marginLeft: number;
    /**
     * Right margin
     */
    marginRight: number;
}

/**
 * Controls the visibility of an element
 */
export enum Visibility {
    /**
     * The element is visible
     */
    VISIBLE = "visible",
    /**
     * The element is invisible, but still takes up space
     */
    HIDDEN = "hidden",
    /**
     * The element is invisible, and does not take up space
     */
    COLLAPSE = "collapse"
}

/**
 * Defines the layout of a container element
 */
export enum ContainerLayout {
    /**
     * The element is laid out in a vertical box
     * The children are stacked vertically
     */
    VBOX = "vbox",
    /**
     * The element is laid out in a horizontal box
     * The children are stacked horizontally
     */
    HBOX = "hbox",
    /**
     * The element is laid out in a stack
     * The children are stacked on top of each other
     */
    STACK = "stack"
}

/**
 * The element to layout
 */
export interface LayoutElement {
    /**
     * The id of the element
     */
    id: string;
    /**
     * The element to layout
     */
    element: FullObject;
    /**
     * The parent element, required for style matching
     */
    parent?: LayoutElement;
    /**
     * The children of the element
     */
    children: LayoutElement[];
    /**
     * Computed styles
     */
    styles: Record<string, any>;
    /**
     * Edit specifications for the element
     */
    edits: EditSpecification;
    /**
     * After measure the computed size
     */
    measuredSize?: Size;
    /**
     * The size the element requested
     */
    requestedSize?: Size;
    /**
     * The size constraints for the element computed during measure
     */
    sizeConstraints?: SizeConstraints;
    /**
     * Bounds provided at layout
     */
    layoutBounds?: Bounds;
    /**
     * Layout information required to be present after style computation
     */
    layoutInformation?: LayoutInformation;
    /**
     * Helper for layouting
     */
    layoutConfig: LayoutConfig;
    /**
     * Set of classes
     */
    class: Set<string>;
    /**
     * If true, this element should not be rendered
     */
    isHidden: boolean;
    /**
     * If true, this element should be collapsed and not rendered
     * Implies isHidden
     */
    isCollapsed: boolean;
    /**
     * Other required layout data
     */
    [key: string]: any;
}

/**
 * Defines a style attribute
 */
export interface AttributeConfig {
    /**
     * The name of the attribute
     */
    name: string;
    /**
     * The type the attribute must have (unset is always allowed)
     */
    type: Type;
    /**
     * Documentation of the attribute
     */
    description: string;
}

/**
 * Defines the cardinality of the contents attribute
 */
export enum ContentCardinality {
    /**
     * 0
     */
    None,
    /**
     * 0..*
     */
    Many,
    /**
     * 1..*
     */
    AtLeastOne
}

/**
 * Interface defining how to layout a UI element
 */
export interface LayoutConfig {
    /**
     * What type of element is supported
     */
    type: string;
    /**
     * A string prefix which uses a specific group of ids for the element
     * To keep short ids, should be short / a single character
     */
    idGroup: string;
    /**
     * List of style attributes it supports
     */
    styleAttributes: AttributeConfig[];
    /**
     * Non-style attributes it supports
     */
    attributes: AttributeConfig[];
    /**
     * The content or contents attribute if present, otherwise an empty array
     */
    contentAttributes: AttributeConfig[];
    /**
     * The type of the contents attribute
     */
    contentType: Type;
    /**
     * The cardinality of the contents attribute
     */
    contentCardinality: ContentCardinality;
    /**
     * Returns the children of the element
     *
     * @param element the element to get the children of
     * @returns the children of the element
     */
    getChildren(element: LayoutElement): FullObject[];
    /**
     * Called to determine the size the element requires
     *
     * @param layout performs the layout
     * @param element the element to measure
     * @param constraints defines min and max size
     * @returns the calculated size
     */
    measure(layout: Layout, element: LayoutElement, constraints: SizeConstraints): Size;
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
    layout(layout: Layout, element: LayoutElement, position: Point, size: Size, id: string): Element[];
    /**
     * Called to create the outline of an element
     *
     * @param layout performs the layout
     * @param element the element to get the outline of
     * @param position offset in current context
     * @param size the size of the element
     * @param id the id of the element
     * @returns the outline of the element
     */
    outline(layout: Layout, element: LayoutElement, position: Point, size: Size, id: string): Line;
    /**
     * Called to provide a function which evaluates to the prototype of the element.
     * The function will be called with the general element prototype as first argument.
     *
     * @returns the prototype generation function
     */
    createPrototype(): ExecutableAbstractFunctionExpression;
    /**
     * Creates a matrix which transforms from the local to the parent coordinate system
     * Can return undefined if the element does not have a parent or if the transformation is the identity matrix
     *
     * @param element the element to transform
     * @returns the transformation matrix
     */
    localToParent(element: LayoutElement): Matrix | undefined;
}
