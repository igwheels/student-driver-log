# Official state forms

These are the states' own published PDFs, served as-is and filled in the
browser by `src/utils/stateFormFill.js`. Nothing here is a reconstruction: the
app writes into the fields the publisher provided, or draws at measured
positions on the publisher's page where there are no fields.

| File | State | Form | Shape |
|---|---|---|---|
| `ny-mv-262.pdf` | New York | MV-262 Certification of Supervised Driving | AcroForm, 52 fields |
| `nj-ba-csd.pdf` | New Jersey | BA-CSD Certification of Supervised Driving (rev 1/25) | flat scan, no fields |

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
   against the blank form before relying on it.

## What is never filled

Signature lines. The app records hours; it does not sign for anyone. Fields the
app has no knowledge of — permit numbers, addresses, instructor details — are
left blank for the parent, as guessing on a document that warns false
information may be a crime is not a risk worth taking.
