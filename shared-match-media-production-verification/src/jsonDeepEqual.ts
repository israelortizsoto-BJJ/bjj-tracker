/**
 * Runtime-neutral deep equality for JSON-compatible verification-record values.
 *
 * Replaces Node's `util.isDeepStrictEqual` so the Worker graph needs no
 * `nodejs_compat` for admission prefix checks.
 *
 * Semantics aligned to persisted JSON record structures:
 * - object key insertion order is ignored
 * - array element order is exact
 * - present vs missing own properties are distinct
 * - JSON scalar types (string, number, boolean, null) compare by value
 * - Object.is for number edge cases (NaN, ±0) matching isDeepStrictEqual
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function jsonDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (left === null || right === null) {
    return left === right;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!jsonDeepEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }

  if (isPlainObject(left)) {
    if (!isPlainObject(right)) {
      return false;
    }
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) {
        return false;
      }
      if (!jsonDeepEqual(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}
