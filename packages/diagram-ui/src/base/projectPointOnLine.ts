import { LineEngine } from "@hylimo/diagram-common";
import type { ProjectionResult } from "@hylimo/diagram-common";
import type { Point } from "@hylimo/diagram-common";
import type { TransformedLine } from "@hylimo/diagram-common";
import { Math2D } from "@hylimo/diagram-common";
import { SharedSettings } from "@hylimo/diagram-protocol";

/**
 * Rounding information for the projectPointOnLine function
 */
export interface RoundingInformation {
    /**
     * Provider for precisions
     */
    settings: SharedSettings;
    /**
     * Whether to round the relativePos (true) or the pos (false)
     */
    hasSegment: boolean;
}

/**
 * Projects a point on a line, similar to LineEngine.projectPoint, but with additional rounding.
 *
 * @param point the point to project onto the line
 * @param transformedLine the line with its transform
 * @param roundingInformation information on how to round the result
 * @param forcedDistance optional distance to force
 * @returns the projection result with possible rounding applied
 */
export function projectPointOnLine(
    point: Point,
    transformedLine: TransformedLine,
    roundingInformation: RoundingInformation,
    forcedDistance: number | undefined
): ProjectionResult {
    const originalProjection = LineEngine.DEFAULT.projectPoint(point, transformedLine, forcedDistance);
    const {
        settings: { linePointPosPrecision: posPrecision },
        hasSegment: isSegment
    } = roundingInformation;
    if (posPrecision == undefined && isSegment) {
        return originalProjection;
    }
    const valueToRound = isSegment ? originalProjection.relativePos : originalProjection.pos;
    const optionsToTest: number[] = [];
    if (posPrecision == undefined) {
        const roundedValue = Number(valueToRound.toPrecision(15));
        optionsToTest.push(roundedValue, roundedValue + 10 ** -15, roundedValue - 10 ** -15);
    } else {
        const roundedValue = Math.min(Math.max(SharedSettings.roundToPrecision(valueToRound, posPrecision), 0), 1);
        optionsToTest.push(roundedValue, roundedValue + posPrecision, roundedValue - posPrecision);
    }

    if (forcedDistance !== undefined) {
        return findBestProjectionWithFixedDistance(
            point,
            transformedLine,
            optionsToTest,
            originalProjection,
            isSegment,
            forcedDistance
        );
    } else {
        return findBestProjectionWithOptimalDistance(
            point,
            transformedLine,
            optionsToTest,
            originalProjection,
            isSegment,
            roundingInformation.settings
        );
    }
}

/**
 * Finds the best projection result with a fixed distance from the provided options
 *
 * @param point the point to project onto the line
 * @param transformedLine the line with its transform
 * @param optionsToTest the rounded position values to test
 * @param originalProjection the original projection result
 * @param isSegment whether the rounded value is the relative position
 * @param forcedDistance the fixed distance to use
 * @returns the best projection result
 */
function findBestProjectionWithFixedDistance(
    point: Point,
    transformedLine: TransformedLine,
    optionsToTest: number[],
    originalProjection: ProjectionResult,
    isSegment: boolean,
    forcedDistance: number
): ProjectionResult {
    let bestResult = originalProjection;
    let minDistance = Number.POSITIVE_INFINITY;

    for (const roundedValue of optionsToTest) {
        if (roundedValue < 0 || roundedValue > 1) {
            continue;
        }
        const result = createProjectionResult(
            roundedValue,
            isSegment,
            transformedLine,
            forcedDistance,
            originalProjection.segment
        );

        const pointOnLine = isSegment
            ? LineEngine.DEFAULT.getPoint(result.relativePos, result.segment, forcedDistance, transformedLine)
            : LineEngine.DEFAULT.getPoint(result.pos, undefined, forcedDistance, transformedLine);
        const distance = Math2D.distance(point, pointOnLine);

        if (distance < minDistance) {
            minDistance = distance;
            bestResult = result;
        }
    }

    return bestResult;
}

/**
 * Finds the best projection result with an optimal distance from the provided options
 *
 * @param point the point to project onto the line
 * @param transformedLine the line with its transform
 * @param optionsToTest the rounded position values to test
 * @param originalProjection the original projection result
 * @param isSegment whether the rounded value is the relative position
 * @param settings the shared settings used for rounding the distance
 * @returns the best projection result
 */
function findBestProjectionWithOptimalDistance(
    point: Point,
    transformedLine: TransformedLine,
    optionsToTest: number[],
    originalProjection: ProjectionResult,
    isSegment: boolean,
    settings: SharedSettings
): ProjectionResult {
    let bestResult = originalProjection;
    let minDistance = Number.POSITIVE_INFINITY;
    for (const roundedValue of optionsToTest) {
        const baseResult = createProjectionResult(
            roundedValue,
            isSegment,
            transformedLine,
            0,
            originalProjection.segment
        );

        const optimalDistance = findOptimalDistanceFromLine(
            isSegment ? baseResult.relativePos : baseResult.pos,
            isSegment ? baseResult.segment : undefined,
            transformedLine,
            point
        );

        const result = {
            ...baseResult,
            distance: optimalDistance
        };

        const projectedPoint = isSegment
            ? LineEngine.DEFAULT.getPoint(result.relativePos, result.segment, optimalDistance, transformedLine)
            : LineEngine.DEFAULT.getPoint(result.pos, undefined, optimalDistance, transformedLine);
        const distanceToPoint = Math2D.distance(point, projectedPoint);

        if (distanceToPoint < minDistance) {
            minDistance = distanceToPoint;
            bestResult = result;
        }
    }
    bestResult.distance = SharedSettings.roundToLinePointDistancePrecision(settings, bestResult.distance);
    return bestResult;
}

export function findOptimalDistanceFromLine(
    pos: number,
    segment: number | undefined,
    transformedLine: TransformedLine,
    point: Point
) {
    const pointOnLine = LineEngine.DEFAULT.getPoint(pos, segment, 0, transformedLine);
    const normalVector = LineEngine.DEFAULT.getNormalVector(pos, segment, transformedLine);
    const dx = point.x - pointOnLine.x;
    const dy = point.y - pointOnLine.y;
    const d2 = normalVector.x ** 2 + normalVector.y ** 2;
    const optimalDistance = (dx * normalVector.x + dy * normalVector.y) / d2;
    return optimalDistance;
}

/**
 * Helper function to create a projection result with the given position value
 *
 * @param value The value that was rounded (either pos or relativePos)
 * @param isSegment Whether the rounded value is the relative position
 * @param transformedLine The line with its transform
 * @param distance The distance to use
 * @param originalSegment The original segment from projection
 * @returns A new projection result
 */
function createProjectionResult(
    value: number,
    isSegment: boolean,
    transformedLine: TransformedLine,
    distance: number,
    originalSegment: number
): ProjectionResult {
    if (isSegment) {
        return {
            relativePos: value,
            segment: originalSegment,
            pos: (originalSegment + value) / transformedLine.line.segments.length,
            distance
        };
    } else {
        const segmentIndex = Math.floor(value * transformedLine.line.segments.length);
        return {
            pos: value,
            segment: segmentIndex,
            relativePos: value * transformedLine.line.segments.length - segmentIndex,
            distance
        };
    }
}
