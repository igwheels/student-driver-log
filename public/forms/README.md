# Official state forms

These are the states' own published PDFs, served as-is and filled in the
browser by `src/utils/stateFormFill.js`. Nothing here is a reconstruction: the
app writes into the fields the publisher provided, or draws at measured
positions on the publisher's page where there are no fields.

| File | State | Form | Shape |
|---|---|---|---|
| `ny-mv-262.pdf` | New York | MV-262 Certification of Supervised Driving | AcroForm, 52 fields |
| `nj-ba-csd.pdf` | New Jersey | BA-CSD Certification of Supervised Driving (rev 1/25) | flat scan, no fields |
| `fl-71143.pdf` | Florida | HSMV 71143 Certification of Driving Experience of a Minor (Rev 01/11) | AcroForm, 14 fields |
| `ok-affidavit.pdf` | Oklahoma | Affidavit of Driver Training (SOK 12/2025) | AcroForm, 23 fields |
| `in-54706.pdf` | Indiana | State Form 54706 Log of Supervised Driving Practice (R5/8-24) | AcroForm, 335 fields (decrypted — see below) |
| `me-mve21.pdf` | Maine | MVE-21 Driving Log (Rev. 10/25) | AcroForm, 260 fields |
| `az-96-0223.pdf` | Arizona | 96-0223 Driving Practice Certificate (R07/25) | AcroForm, 7 fields (decrypted — see below) |
| `pa-dl-180c.pdf` | Pennsylvania | DL-180C Parent or Guardian Certification Form (6-25) | AcroForm, 6 fields |
| `nv-dld130.pdf` | Nevada | DLD130 Beginning Driver Experience Log (1/2023) | flat scan, no fields — two-column day/night log grid |
| `vt-vn210.pdf` | Vermont | VN-210 Driving Practice Log Sheet (2M 07/2019) | AcroForm, 359 fields (cover page only — see below) |
| `co-dr2324.pdf` | Colorado | DR 2324 Drive Time Log Sheet (02/11/22) | AcroForm, 73 fields |
| `ne-dmv0691.pdf` | Nebraska | DMV 06-91 50 Hour Certification (1/08) | flat scan, no fields |
| `dc-grad-hr40.pdf` | District of Columbia | DMV-GRAD-HR40 Certification of Eligibility for Provisional License (Rev.08/24/09) | flat scan, no fields — single day/night pool |
| `il-dsdx152.pdf` | Illinois | DSD X152 Practice Driving Log (152.4, March 2026) | AcroForm, 577 fields (64 usable rows) |
| `ks-deib01.pdf` | Kansas | DE-IB01 Teen Driving Experience Log (6/99) | flat scan, no fields |
| `nc-dl4a.pdf` | North Carolina | DL-4A Driving Log to Advance to N.C. Level 2 Limited Provisional Driver License (09/2011) | AcroForm, ~370 fields (56 usable rows) |
| `nh-dsmv509.pdf` | New Hampshire | DSMV 509 Certification of Additional Supervised Driving (Rev. 6/23) | AcroForm (decrypted — see below) — cumulative day/night totals, 52 usable rows |
| `ky-practicelog.pdf` | Kentucky | Practice Driving Log (as published; unnumbered) | flat scan, no fields — separate day/night pages |
| `tn-sf1256.pdf` | Tennessee | SF-1256 Certification of 50 Hours Behind the Wheel Driving Experience (02/13) | flat scan, no fields |
| `wy-fsgdl01.pdf` | Wyoming | FSGDL-01 Behind-the-Wheel Driving Certification (20190620) | AcroForm, 8 fields |
| `wv-dmv10gdl.pdf` | West Virginia | DMV-10-GDL 50-Hour Certification Log for Driver's License Applicants Under Age 18 (REV 09/14) | flat scan, no fields — 22 usable rows across 2 pages |
| `wa-dle520003.pdf` | Washington | DLE-520-003 Parental Authorization Affidavit (R4/25) | AcroForm, 19 fields — notarized |
| `ak-form433.pdf` | Alaska | Form 433 Parent/Guardian Consent for a Minor (Rev. 08/28/2018) | AcroForm, 13 fields — notarized if parent not present |
| `tx-des150n.pdf` | Texas | TDLR DES150N Driver Education 30 Hour Behind the Wheel Log (rev December 2024) | flat scan, no fields — organized by skill category, not by date |
| `mn-supervised-log.pdf` | Minnesota | Supervised Driving Log (Rev. 06/2021) | flat scan, no fields — two side-by-side row blocks per page |
| `al-dl31.pdf` | Alabama | DL-31 Graduated Driver License Form (Rev 09/21) | flat scan, no fields |
| `ms-roadtestwaiver.pdf` | Mississippi | Affidavit for Road Test Waiver (§63-1-33, Miss. Code Ann. 1972) | flat scan, no fields — optional road-test-waiver path, not a blanket requirement |
| `md-rd006.pdf` | Maryland | RD-006 New Driver & Coach Practice Guide (5-page booklet) | flat scan, no fields — practice log runs across 4 pages, 88 usable rows |

## Preparing a new form

1. Download the current PDF from the state's own site. Do not take it from a
   third-party mirror, and check the revision — a superseded revision is worse
   than no template at all.
2. Check whether it is encrypted and whether it has form fields:

   ```bash
   python3 -c "
   import pikepdf, sys
   p = pikepdf.open(sys.argv[1])
   print('encrypted:', p.is_encrypted)
   if p.is_encrypted: print('allows fill:', p.allow.modify_form, '| allows modify:', p.allow.modify_other)
   f = p.Root.get('/AcroForm', {}).get('/Fields')
   print('fields:', len(f) if f is not None else 0)
   " form.pdf
   ```

3. **If encrypted**, decrypt it once here. No browser PDF library can decrypt
   AES-256, so this cannot happen at runtime:

   ```bash
   python3 -c "
   import pikepdf, sys; pikepdf.open(sys.argv[1]).save(sys.argv[2])
   " form.pdf public/forms/xx-name.pdf
   ```

   Check the permission bits first. New York's MV-262 permits form filling and
   forbids modifying content, so filling its fields is the operation the state
   itself allows. A form that forbids filling should not get a template.

4. **If it has fields**, list their names — the template maps to them exactly,
   including any typos in the published names:

   ```bash
   node -e "
   const {PDFDocument}=require('pdf-lib');const fs=require('fs');
   PDFDocument.load(fs.readFileSync('public/forms/xx-name.pdf')).then(d=>
     d.getForm().getFields().forEach(f=>console.log(f.constructor.name, JSON.stringify(f.getName()))));
   "
   ```

5. **If it has no fields**, measure where the printed rules sit rather than
   estimating. Render the page and find the long dark horizontal runs; divide
   render coordinates by the render scale, and subtract from the page height to
   get PDF coordinates, which run from the bottom-left.

6. Add the entry to `src/data/stateFormTemplates.js` and check the output
   against the blank form before relying on it. **If the fields are a
   repeating driving-log grid** (a date/day-hours/night-hours row repeated
   dozens of times, as Indiana and Maine both publish), use `kind:
   'acroform-log'` instead of `'acroform'` — list the row suffixes in the
   order they actually read on the printed page (top to bottom, left column
   before right, page one before page two) and `src/utils/stateFormFill.js`
   maps the student's logged drives onto them automatically, most recent
   first if there are more drives than rows.

## What is never filled

Signature lines. The app records hours; it does not sign for anyone. Fields the
app has no knowledge of — permit numbers, addresses, instructor details — are
left blank for the parent, as guessing on a document that warns false
information may be a crime is not a risk worth taking.

## States evaluated and skipped

- **Ohio (BMV 5791, Fifty Hour Affidavit)**: encrypted, and its permission
  bits forbid both form-filling and content modification (`modify_form:
  false`, `modify_other: false`). There is no operation on this specific
  document the app is allowed to perform — not even the overlay approach,
  which still counts as modifying content. Re-check if Ohio ever republishes
  it with different permissions; don't build a template against a copy with
  these bits.
- **Georgia (DDS-7, Driving Experience Affidavit)**: not published for the
  public to fill in advance — Georgia hands it out and completes it in
  person at a DDS office. There is no PDF to build a template from.
