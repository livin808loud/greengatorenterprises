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
