CREATE OR REPLACE FUNCTION "appforge_reject_project_evidence_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'project_evidence is append-only; % is not allowed', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS "project_evidence_append_only" ON "project_evidence";
CREATE TRIGGER "project_evidence_append_only"
BEFORE UPDATE OR DELETE ON "project_evidence"
FOR EACH ROW
EXECUTE FUNCTION "appforge_reject_project_evidence_mutation"();
