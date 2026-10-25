import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deploymentSafetyReport, main } from "../tools/deploy-preflight.mjs";

const state = () => ({ publicReadings: [{id:"r",status:"ready"},{id:"f",status:"failed"}], outbox:[{status:"sent"}] });
test("deployment preflight refuses every queued/generating job even with an expired lease", () => {
  for (const status of ["queued","generating"]) {
    const data=state();data.publicReadings.push({status,generation:{leaseUntil:"2000-01-01"}});
    const result=deploymentSafetyReport(data);
    assert.equal(result.safeAtSnapshot,false);assert.ok(result.reasons.includes("ACTIVE_GENERATIONS"));
  }
});
test("deployment preflight refuses pending or sending notifications and malformed storage", () => {
  for (const status of ["pending","sending"]) {
    const data=state();data.outbox.push({status});
    assert.ok(deploymentSafetyReport(data).reasons.includes("PENDING_NOTIFICATIONS"));
  }
  assert.equal(deploymentSafetyReport({}).safeAtSnapshot,false);
  const invalid=state();invalid.outbox.push(null);
  assert.ok(deploymentSafetyReport(invalid).reasons.includes("UNKNOWN_NOTIFICATION_STATUS"));
  const data=state();data.publicReadings.push({status:"unexpected"});
  assert.ok(deploymentSafetyReport(data).reasons.includes("UNKNOWN_READING_STATUS"));
});
test("deployment preflight reports only a read-only snapshot and no customer information", async () => {
  const dir=await mkdtemp(join(tmpdir(),"lastro-preflight-"));const file=join(dir,"data.json");
  try {
    const data=state();data.outbox.push({type:"email_verification"});data.publicReadings[0].email="private@example.invalid";data.publicReadings[0].token="PRIVATE_TOKEN";
    const original=JSON.stringify(data);await writeFile(file,original);
    const lines=[];const io={log:x=>lines.push(x),error:x=>lines.push(x)};
    assert.equal(await main(["--db",file],io),0);
    assert.equal(await readFile(file,"utf8"),original);
    assert.doesNotMatch(lines.join(""),/private@example|PRIVATE_TOKEN/);
    assert.equal(JSON.parse(lines[0]).snapshotOnly,true);
    data.publicReadings.push({status:"generating"});await writeFile(file,JSON.stringify(data));
    assert.equal(await main(["--db",file],io),2);
    assert.equal(await main(["--db",join(dir,"missing")],io),1);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test("legacy exhausted notifications are distinguished from delivery proof and retryable mail",()=>{
 const data=state();data.outbox.push({type:"public_reading_link",attempts:99});
 const report=deploymentSafetyReport(data);
 assert.equal(report.safeAtSnapshot,true);assert.equal(report.counts.legacyExhaustedNotifications,1);
 data.outbox.push({type:"public_reading_link",attempts:0});
 assert.equal(deploymentSafetyReport(data).safeAtSnapshot,false);
 assert.ok(deploymentSafetyReport(data).reasons.includes("PENDING_NOTIFICATIONS"));
});
