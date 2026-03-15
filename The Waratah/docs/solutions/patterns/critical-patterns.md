# Critical Patterns - PREP SYSTEM

**Required Reading Before Development**

These patterns represent mistakes that have been made multiple times. Review before writing any automation code.

---

## Pattern 1: Always Use Batch Size 50

**Symptom:** Script hangs, memory errors, or Airtable rate limiting
**Wrong approach:** Processing all records at once
**Correct approach:** Use CONFIG.batchSize of 50

❌ **WRONG:**
```javascript
const records = await table.select().all();
await table.update(records.map(r => ({ id: r.id, fields: { ... } })));
```

✅ **CORRECT:**
```javascript
const records = await table.select().all();
for (let i = 0; i < records.length; i += CONFIG.batchSize) {
  const batch = records.slice(i, i + CONFIG.batchSize);
  await table.update(batch.map(r => ({ id: r.id, fields: { ... } })));
}
```

---

## Pattern 2: Never Hardcode Credentials

**Symptom:** Security breach, credentials exposed in git history
**Wrong approach:** API keys in source code
**Correct approach:** Store in Script Properties

❌ **WRONG:**
```javascript
const AIRTABLE_PAT = 'patXXXXXXXX';
const SLACK_WEBHOOK = 'https://hooks.slack.com/...';
```

✅ **CORRECT:**
```javascript
const props = PropertiesService.getScriptProperties();
const AIRTABLE_PAT = props.getProperty('AIRTABLE_PAT');
const SLACK_WEBHOOK = props.getProperty('SLACK_WEBHOOK_PREP');
```

---

## Pattern 3: Always Log to Audit Table

**Symptom:** No visibility into automation failures
**Wrong approach:** Only console.log or no logging
**Correct approach:** Write to Audit Log table with structured data

❌ **WRONG:**
```javascript
console.log('Script completed');
```

✅ **CORRECT:**
```javascript
await logToAudit(scriptName, 'Success', 'Completed', {
  recordsProcessed: count,
  executionTime: elapsed,
  user: lastModifiedBy
});
```

---

## Pattern 4: Support Dry-Run Mode

**Symptom:** Can't test without affecting production data
**Wrong approach:** Always write to Airtable
**Correct approach:** Check dryRun flag before mutations

❌ **WRONG:**
```javascript
function main() {
  await table.update(records);
}
```

✅ **CORRECT:**
```javascript
function main(options = { dryRun: false }) {
  if (options.dryRun) {
    console.log(`Would update ${records.length} records`);
    return;
  }
  await table.update(records);
}
```

---

## Pattern 5: Use Sydney Timezone

**Symptom:** Dates off by hours, stocktake times wrong
**Wrong approach:** Using UTC or system timezone
**Correct approach:** Explicitly use Australia/Sydney

❌ **WRONG:**
```javascript
const now = new Date();
const formatted = now.toISOString();
```

✅ **CORRECT:**
```javascript
const now = new Date();
const formatted = Utilities.formatDate(now, 'Australia/Sydney', 'yyyy-MM-dd HH:mm:ss');
```

---

## Pattern 6: Template Placeholders Use Double Braces

**Symptom:** Placeholders not replaced in Google Docs
**Wrong approach:** Single braces or other syntax
**Correct approach:** Use `{{PLACEHOLDER}}` format

❌ **WRONG:**
```javascript
body.replaceText('{DATE}', formattedDate);
body.replaceText('$DATE$', formattedDate);
```

✅ **CORRECT:**
```javascript
body.replaceText('{{DATE}}', formattedDate);
body.replaceText('{{STAFF_NAME}}', staffName);
```

---

*Add new critical patterns as they're discovered. Each pattern should have:*
1. *Clear symptom description*
2. *Wrong vs. correct code examples*
3. *Link to original solution document*
