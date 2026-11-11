const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(process.env.TEST_URL || 'file://' + path.resolve(__dirname,'../index.html') + '#quote');
    await page.locator('#quoteSubmitBtn').waitFor();
    assert.equal(await page.locator('#quoteSubmitBtn').textContent(),'Request a Truck');
    await page.locator('#q-name').fill('WEBSITE TEST — not a booking');
    for (const [id,value] of Object.entries({'q-paddress':'123 Test Street, Augusta, GA','q-daddress':'456 Test Road, Aiken, SC','q-pzip':'30907','q-dzip':'30901','q-pallets':'2','q-weight':'1200','q-commodity':'TEST ONLY','q-date':'2027-01-15','q-ddate':'2027-01-15','q-pwindow':'9 AM–noon Eastern','q-dwindow':'1–4 PM Eastern','q-dimensions':'48 x 40 x 48 inches','q-email':'test@example.com'})) await page.locator('#'+id).fill(value);
    for (const group of ['Pickup','Dropoff']) {
      assert.deepEqual(await page.locator(`input[name="${group}"]`).evaluateAll(els=>els.map(e=>e.value)),['Loading dock','Forklift available','Liftgate needed','Unsure']);
      assert.equal(await page.locator(`input[name="${group}"]:checked`).count(),0);
      await page.locator(`input[name="${group}"][value="Unsure"]`).check();
    }
    await page.locator('#q-timing').selectOption('Appointment-only');
    // Early-stage requests can start with ZIPs and tentative timing.
    for (const id of ['q-paddress','q-daddress','q-date','q-ddate','q-pwindow','q-dwindow']) {
      const field = page.locator('#'+id);
      const original = await field.inputValue();
      await field.fill('');
      assert.equal(await field.evaluate(e=>e.required),false, id+' must allow an unknown detail');
      await field.fill(original);
    }
    for (const id of ['q-paddress-unknown','q-daddress-unknown','q-delivery-flexible','q-weight-estimated']) await page.locator('#'+id).check();
    await page.locator('#q-shipment-type').selectOption('Recurring route');
    const extra = await page.locator('#quoteForm').evaluate(f=>Object.fromEntries(new FormData(f)));
    assert.equal(extra['Shipment type'],'Recurring route');
    assert.equal(extra['Weight is estimated'],'Yes');
    assert.equal(extra['Delivery date flexible'],'Yes');
    assert.equal(extra['Pickup exact address unavailable'],'Yes');
    assert.equal(extra['Delivery exact address unavailable'],'Yes');
    const tentative = {};
    for (const id of ['q-paddress','q-daddress','q-date','q-ddate','q-pwindow','q-dwindow']) {
      tentative[id] = await page.locator('#'+id).inputValue();
      await page.locator('#'+id).fill('');
    }
    await page.locator('#q-timing').selectOption('Unsure');
    assert.equal(await page.locator('#quoteForm').evaluate(f=>f.checkValidity()),true,'Tentative request must be valid without exact addresses or dates');
    for (const [id,value] of Object.entries(tentative)) await page.locator('#'+id).fill(value);
    await page.locator('#q-timing').selectOption('Appointment-only');
    assert.deepEqual(await page.locator('#q-shipment-type option').evaluateAll(els=>els.slice(1).map(e=>e.value)),['One-time shipment','Recurring route','Overflow / backup capacity']);
    const limits = await page.locator('#freight-limits').textContent();
    for (const text of ['8,800','2,500','94','individual pallet']) assert.ok(limits.includes(text),text);
    assert.equal(await page.locator('#quoteSuccess a[href="tel:+17067269949"]').count(),1);
    assert.equal(await page.locator('#quoteSuccess a[href="sms:+17067269949"]').count(),1);
    assert.equal(await page.locator('#quoteForm').evaluate(f=>f.checkValidity()),true);
    const data = await page.locator('#quoteForm').evaluate(f=>Object.fromEntries(new FormData(f)));
    assert.equal(data['Pickup address'],'123 Test Street, Augusta, GA');
    assert.equal(data['Delivery time window'],'1–4 PM Eastern');
    assert.equal(data['Timing flexibility'],'Appointment-only');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),'No mobile horizontal overflow');
    // Intercept provider requests: exercise UI without sending invented leads.
    let posts=0;
    await page.route('https://formspree.io/**',async route=>{posts++; await route.fulfill({status:422,contentType:'application/json',body:'{"error":"test failure"}'});});
    await page.locator('#quoteSubmitBtn').click();
    await page.waitForFunction(()=>!document.getElementById('quoteSubmitBtn').disabled);
    assert.equal(await page.locator('#quoteSubmitBtn').textContent(),'Request a Truck');
    assert.ok(await page.locator('#quoteError').isVisible());
    await page.locator('#q-email').fill('');
    await page.locator('#quoteSubmitBtn').click();
    assert.match(await page.locator('#quoteError').textContent(),/provide a phone number or an email/);
    assert.equal(posts,1,'Missing contact must not send');
    await page.locator('#q-email').fill('test@example.com');
    await page.unroute('https://formspree.io/**');
    await page.route('https://formspree.io/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
    await page.locator('#quoteSubmitBtn').click();
    await page.locator('#quoteSuccess').waitFor({state:'visible'});
    assert.match(await page.locator('#quoteSuccess').textContent(),/not booked until we agree/);
    assert.equal(await page.locator('#quoteForm').isVisible(),false);
    await page.setViewportSize({width:1440,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),'No desktop horizontal overflow');
    console.log('PASS: fields, payload, access choices, timing, mobile/desktop layout, error retry, missing contact, success and booking disclaimer. Provider mocked; no live lead sent.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
