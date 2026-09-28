/**
 * Incremental schema SQL migrations after the immutable baseline.
 */
import { SCHEMA_PATCH_SQL } from "./schemaPatchSql.js";
import { SECTION18_INTEGRITY_SQL } from "./schemaSection18Sql.js";
import { SECTION24_RECOVERY_CHECKPOINTS_SQL } from "./schemaSection24Sql.js";

export {
  SCHEMA_PATCH_SQL,
  SECTION18_INTEGRITY_SQL,
  SECTION24_RECOVERY_CHECKPOINTS_SQL,
};
