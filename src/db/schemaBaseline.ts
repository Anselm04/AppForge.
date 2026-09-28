/**
 * Immutable baseline schema SQL (migration 20260703_001).
 * Do not edit after production apply — add a new migration instead.
 */
import { SCHEMA_SQL_PART1 } from "./schemaBaselinePart1.js";
import { SCHEMA_SQL_PART2 } from "./schemaBaselinePart2.js";

const SCHEMA_SQL = SCHEMA_SQL_PART1 + SCHEMA_SQL_PART2;

export { SCHEMA_SQL };
