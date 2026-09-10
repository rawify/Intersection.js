# Intersection.js - 2D Intersections in JavaScript

[![NPM Package](https://img.shields.io/npm/v/intersection.svg?style=flat)](https://npmjs.org/package/intersection "View this project on npm")
[![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://opensource.org/licenses/MIT)

Finding where two geometric shapes meet sounds simple until ellipses are
rotated, curves touch without crossing, or coordinates become large enough for
a fixed epsilon to fail. *Intersection.js* handles these cases for the
primitives used in 2D vector graphics: line segments, circles, ellipses,
elliptical arcs, and Bezier curves.

The package name is [`intersection`](https://www.npmjs.com/package/intersection). Use it when exact primitive pairs, curve parameters, tangencies, or analytic bounds are needed. Use a spatial index before it when many unrelated shapes need broad-phase filtering, and use polygon clipping or a geometry engine when overlapping areas rather than discrete intersection points are required.

A line-segment intersection can be calculated as follows:

```javascript
import { lineLine } from 'intersection';

const points = lineLine(
  { x: -1, y: 2 },
  { x: 5, y: 2 },
  { x: 1, y: -1 },
  { x: 4, y: 4 },
);

console.log(points);
// [{ x: 2.8, y: 2, t1: 0.6333333333333333, t2: 0.6 }]
```

The returned point also contains its position on both operands. This makes the
result useful for more than drawing a dot, where you can split a path, sort collisions
along a stroke, or interpolate another value exactly where the shapes meet.

Every intersection function returns an array. No intersection is represented
by `[]`; a tangent produces one point, and ordinary crossings produce as many
points as the pair of shapes permits. Invalid or degenerate geometry also
returns `[]` instead of throwing an exception.

## Examples / Motivation

The examples below are task-oriented recipes with complete imports and observable results. All angles are in radians, all shapes use plain structural objects, and inputs are not mutated.

### Intersect a line segment and a circle

A line segment can meet a circle in zero, one, or two points. Results are
ordered along the segment:

```javascript
import { lineCircle } from 'intersection';

const points = lineCircle(
  { x: -3, y: 0 },
  { x: 3, y: 0 },
  { x: 0, y: 0, r: 2 },
);

console.log(points.map(({ x, y }) => ({ x, y })));
// [{ x: -2, y: 0 }, { x: 2, y: 0 }]
```

### Intersect a line segment and a Bezier curve

A cubic Bezier curve can cross one line segment up to three times. The
[line segment / Bezier curve intersection](https://raw.org/book/computer-graphics/line-segment-bezier-curve-intersection/)
reduces the problem to [solving a cubic equation](https://raw.org/book/algebra/solving-cubic-equations/)
directly, without sampling the curve:

```javascript
import { lineBezier } from 'intersection';

const curve = {
  p0: { x: 0, y: 0 },
  p1: { x: 1, y: 3 },
  p2: { x: 2, y: -3 },
  p3: { x: 3, y: 0 },
};

const points = lineBezier(
  { x: -1, y: 0 },
  { x: 4, y: 0 },
  curve,
);

console.log(points.length); // 3
console.log(points.map((point) => point.t1)); // [0, 0.5, 1]
```

For a quadratic Bezier curve, use `quadraticToCubic()` first. Degree elevation
is exact and does not alter the shape.

### Intersect rotated ellipses

Ellipses may be rotated independently. Their rotations are given in radians:

```javascript
import { ellipseEllipse } from 'intersection';

const first = { x: 0, y: 0, rx: 5, ry: 2, phi: Math.PI / 6 };
const second = { x: 2, y: 0, rx: 4, ry: 1.5, phi: -Math.PI / 8 };

const points = ellipseEllipse(first, second);
// zero to four intersection points
```

The first ellipse is transformed to a unit circle. Substituting the rational
parametrization of that circle leaves a quartic equation, so all intersections
can be found without tracing or sampling either ellipse.

### Intersect two Bezier curves

Two cubic Bezier curves can have up to nine intersections:

```javascript
import { bezierBezier } from 'intersection';

const first = {
  p0: { x: 0, y: 0 },
  p1: { x: 1, y: 4 },
  p2: { x: 3, y: -4 },
  p3: { x: 4, y: 0 },
};

const second = {
  p0: { x: 0, y: 2 },
  p1: { x: 1, y: -2 },
  p2: { x: 3, y: 4 },
  p3: { x: 4, y: -2 },
};

const points = bezierBezier(first, second);
```

The curves are subdivided to isolate candidates and each candidate is refined
with damped least squares. The damping is important for tangencies, where an
ordinary Newton iteration has a singular Jacobian.

### Convert an SVG arc

SVG path data describes an elliptical arc by two endpoints, two radii, a
rotation, and two flags. `arcFromSvg()` converts an `A` command into the centre
form used by the intersection functions:

```javascript
import { arcFromSvg, lineArc } from 'intersection';

// <path d="M 100 100 A 60 40 30 0 1 200 160" />
const arc = arcFromSvg(
  { x: 100, y: 100 },
  60,
  40,
  30 * Math.PI / 180,
  false,
  true,
  { x: 200, y: 160 },
);

if (arc !== null) {
  const points = lineArc(
    { x: 0, y: 120 },
    { x: 300, y: 120 },
    arc,
  );
}
```

The rotation passed to `arcFromSvg()` is in radians, while SVG path data stores
it in degrees. If the specified radii are too small to connect the endpoints,
they are enlarged according to the SVG implementation notes.

`arcFromSvg()` returns `null` when coincident endpoints describe no arc or when
a zero radius turns the command into a straight line.

### Calculate exact bounding boxes

The bounding-box helpers calculate extrema analytically rather than sampling:

```javascript
import { boundsOfCubic, boundsOverlap } from 'intersection';

const firstBounds = boundsOfCubic(first);
const secondBounds = boundsOfCubic(second);

if (boundsOverlap(firstBounds, secondBounds)) {
  // A detailed intersection test may be worthwhile.
}
```

This is useful as a fast rejection step before a more expensive curve
intersection.

## Shapes

*Intersection.js* accepts plain objects. Types are structural, so `DOMPoint`,
`@rawify/vector2`, and any other object containing finite `x` and `y` values can
be used as a point.

### Point

```javascript
{ x: 10, y: 20 }
```

### Circle

```javascript
{ x: 10, y: 20, r: 5 }
```

### Ellipse

```javascript
{ x: 10, y: 20, rx: 8, ry: 4, phi: Math.PI / 6 }
```

The optional `phi` property rotates the `rx` axis in radians and defaults to
zero.

### Arc

```javascript
{
  x: 10,
  y: 20,
  rx: 8,
  ry: 4,
  phi: Math.PI / 6,
  alpha: 0,
  beta: Math.PI,
}
```

An arc is swept counter-clockwise from `alpha` to `beta`. Equal angles modulo
`2 * Math.PI` represent the whole ellipse rather than an empty sweep.

### Cubic Bezier

```javascript
{
  p0: { x: 0, y: 0 },
  p1: { x: 1, y: 3 },
  p2: { x: 2, y: -3 },
  p3: { x: 3, y: 0 },
}
```

### Quadratic Bezier

```javascript
{
  p0: { x: 0, y: 0 },
  p1: { x: 1.5, y: 3 },
  p2: { x: 3, y: 0 },
}
```

Quadratic curves can be converted with `quadraticToCubic()` before they are
passed to an intersection function.

## Intersection results

Each result contains the Cartesian point and one parameter for each operand:

```typescript
interface Intersection {
  x: number;
  y: number;
  t1: number;
  t2: number;
}
```

For a line segment or Bezier curve, its parameter lies in `[0, 1]` from start
to end. For a circle, ellipse, or arc, it is the parametric angle in `[0, 2π)`.
The parameters are assigned as follows:

| functions | `t1` | `t2` |
| --- | --- | --- |
| `lineLine()` | first segment | second segment |
| `lineCircle()`, `lineEllipse()`, `lineArc()` | line segment | circle, ellipse, or arc |
| `lineBezier()` | Bezier curve | line segment |
| `circleCircle()`, `ellipseEllipse()`, `arcArc()` | first shape | second shape |
| `bezierCircle()`, `bezierEllipse()`, `bezierArc()` | Bezier curve | circle, ellipse, or arc |
| `bezierBezier()` | first curve | second curve |

The parametric angle of an ellipse is the `t` in
`center + R(phi) * (rx cos(t), ry sin(t))`. It is not generally the polar angle
seen from the centre; both angles are equal only for a circle. Use
`ellipsePointAt()` and `ellipseAngleAt()` to convert between a point and the
ellipse parameter.

Results are ordered by `t1` and duplicate points are removed. A tangency is
therefore returned once rather than as two coincident points.

## Functions

### lineLine(a1, b1, a2, b2)

Returns at most one intersection between two line segments. Parallel,
collinear, overlapping, and zero-length segments return `[]`. Use
`isParallel()` or `isCollinear()` when the distinction matters. For
`isCollinear()`, a zero-length segment is treated as a point on the other
segment's supporting line; two point segments are considered collinear.

### lineCircle(a, b, circle)

Returns up to two intersections between a line segment and a circle.

### lineEllipse(a, b, ellipse)

Returns up to two points from the
[intersection between a line segment and a full ellipse](https://raw.org/math/computer-graphics/line-segment-ellipse-intersection/).
Rotated ellipses are supported.

### lineArc(a, b, arc)

Returns up to two intersections between a line segment and an elliptical arc.
It has the same result as `lineEllipse()`, filtered to the arc's sweep.

### lineBezier(a, b, curve)

Returns up to three intersections between a line segment and a cubic Bezier
curve.

### circleCircle(first, second)

Returns up to two [intersection points of two circles](https://raw.org/math/geometry/calculate-the-intersection-points-of-two-circles/).
Concentric circles return `[]`, including identical circles that share
infinitely many points.

### ellipseEllipse(first, second)

Returns up to four intersections between two full ellipses. Circles and rotated
ellipses are accepted. Coincident ellipses return `[]` because their
intersection is not a finite list of points.

### arcArc(first, second)

Returns up to four intersections between two elliptical arcs.

### bezierCircle(curve, circle)

Returns up to six intersections between a cubic Bezier curve and a circle.

### bezierEllipse(curve, ellipse)

Returns up to six intersections between a cubic Bezier curve and a full
ellipse.

### bezierArc(curve, arc)

Returns up to six intersections between a cubic Bezier curve and an elliptical
arc.

### bezierBezier(first, second)

Returns up to nine intersections between two cubic Bezier curves.

### arcFromSvg(start, rx, ry, phi, largeArc, sweep, end)

Converts an SVG elliptical arc command from endpoint form to centre form. The
function returns an `Arc` or `null` when the SVG command does not describe an
arc.

### arcFromCircle(circle, alpha, beta)

Converts a circle and two angles into an `Arc` for use with the arc functions.

### quadraticToCubic(curve)

Raises a quadratic Bezier curve to a cubic Bezier curve without changing its
shape.

### Bezier helpers

`cubicPointAt()`, `cubicTangentAt()`, `splitCubic()`, and
`cubicControlPoints()` evaluate and manipulate cubic Bezier curves.

### Ellipse and angle helpers

`circleToEllipse()`, `ellipsePointAt()`, `ellipseAngleAt()`,
`normalizeAngle()`, and `isAngleInArc()` convert shapes, points, and angles.
`TAU` contains the value `2 * Math.PI`.

### Bounding-box helpers

`boundsOfPoints()`, `boundsOfSegment()`, `boundsOfCubic()`,
`boundsOfCubicHull()`, `boundsOfCircle()`, and `boundsOfEllipse()` return boxes
in `{ minX, minY, maxX, maxY }` form.

`boundsOverlap()` checks two such boxes. `rectRect()` performs the same test for
boxes in `{ left, top, right, bottom }` form, including objects returned by
`getBoundingClientRect()`.

## Behaviour at the edges

Geometry algorithms are often decided by their edge cases. *Intersection.js*
uses the following rules consistently:

- A tangency returns one point.
- Collinear or overlapping segments return `[]` because the common part is a
  segment rather than one intersection point.
- Coincident ellipses and curves sharing a span return `[]` because they have
  infinitely many common points.
- Zero-length segments, non-positive radii, non-finite coordinates, and
  non-finite control points return `[]`.
- Tolerances scale with the magnitude of the input. Coordinates in the millions
  therefore behave like coordinates around the unit square.

Every pair except `bezierBezier()` reduces to a polynomial. Equations up to
degree three are solved in closed form; higher degrees use bracketed Newton
iteration. `bezierBezier()` uses subdivision followed by damped least squares.

## Installation

You can install *Intersection.js* via npm:

```bash
npm install intersection
```

Or with yarn:

```bash
yarn add intersection
```

Alternatively, download or clone the repository:

```bash
git clone https://github.com/rawify/Intersection.js.git
```

## Usage

In an ES module project:

```javascript
import { lineLine, circleCircle, bezierEllipse } from 'intersection';
```

Or in a CommonJS project:

```javascript
const { lineLine, circleCircle, bezierEllipse } = require('intersection');
```

The package supports Node.js 18 or newer and ships ESM, CommonJS, source maps, and TypeScript declarations. It has no runtime dependencies and does not publish a browser-global bundle; browser projects should use the ESM entry through a bundler or native module loading.

All public TypeScript types are exported from the package:

```typescript
import type {
  Arc,
  Bounds,
  Circle,
  CubicBezier,
  Ellipse,
  Intersection,
  Point,
  QuadraticBezier,
  Rect,
} from 'intersection';
```

## Building the library

After cloning the Git repository, install the dependencies and build the
package:

```bash
npm install
npm run build
```

The build creates ESM, CommonJS, source maps, and TypeScript declarations in
`dist/`.

## Run the tests

Testing the source against the shipped test suite is as easy as:

```bash
npm test
```

To run the type checker and the complete test suite together:

```bash
npm run check
```

## Copyright and licensing

Copyright (c) 2026, [Robert Eisele](https://raw.org/)
Licensed under the MIT license.