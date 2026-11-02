# QA US verification scenarios

Portal: `https://qa-web-us.vctrials.com`. These are legacy Site/Admin UI tests,
not tests of the Angular admin application.

| Case | Automated test | Expected result |
|---|---|---|
| Happy path | `site-verification/successfulVerification.spec.ts` | Successfully Verified |
| Age above maximum | `site-verification/ageViolation.spec.ts` | Verification Failure; age 100 outside 1-99 |
| Compound washout | `study-exclusions/studyExclusions.spec.ts`, `Compound washout` | One compound alert; choose failure; persisted Verification Failure |
| Study lockout | `study-exclusions/studyExclusions.spec.ts`, `Study lockout` | Direct Verification Failure; one LBDD-to-Admission violation |
| Compound exception positive | `compound-exception/compoundException.spec.ts`, `permits verification` | LDD elapsed 30 days > 29: Success / In Screening |
| Compound exception boundary | Same spec, `rejects exact 29-day` | LDD elapsed exactly 29 days: one CMP29 failure |

Admin protocol opening is a separate navigation test, not a seventh verification
outcome. Compound-class exceptions and email delivery are not covered here.

## Safety and evidence

Use only fresh synthetic identities, three-letter names and a middle initial,
adult DOB `17/APR/1988` (except the age test), Male, Passport, random five-character
ID suffix, and subject numbers `Auto-DDMMYY-HHMMSS` in runner-local time.
Every scenario stores its exact input and result in Playwright report attachments.
The two-study tests also preserve the B1 dates, B2 input, screenshots, same-subject
history assertion, and persisted statuses. Portal-relative dates use GMT-5.

Do not reuse the historical samples below: previous RA2 enrollments, especially
Screen Failure, can add a second violation. Each two-study test creates its own
identity, uses it for B1 and B2, and assigns different subject numbers. The washout
and lockout tests create B1 through Admin; B2 always goes through the normal Site
verification flow. No test overrides a failure.

Tests never edit protocols, restore protocol settings, or clean up subjects.
Synthetic records, including development/debugging records, remain in QA.
Protocol preparation requires live inspection, an exact Before/After proposal,
and explicit user approval before Remove/Add/Save. Opt-in environment variables
authorize only the documented synthetic-record operations, not protocol edits.
Missing prerequisites must fail before subject creation; do not weaken assertions
or silently change a protocol to make a test pass.

## Protocol fixtures

All protocols belong to **Test Sponsor**. Inspect through Admin first.

| Fixture | Required configuration |
|---|---|
| RA2: AutoTest RA 2 | Age 1-99 inclusive; no cohorts; Adams Clinical / `08053, TEST Location 3` |
| RA2 study lockout | 1 Months, Last Blood Draw Date -> Check-in / Admission Date |
| RA2 compound | TestCompound: 12 Months washout, Radioactive isotope, half-life 1 Hours |
| RA2 other compound | TestCompound 2: no exclusions, Radioactive isotope, half-life 2 Hours |
| RA2 compound exception | Test / 29 Days / Screening Date / CMP29; no class exceptions |
| Source AutoTest RA | TestCompound: 1 Days washout, Radioactive isotope, half-life 10 Hours; Test Site / Test Location 2 / Acne Group |
| Source AutoTest RA 3 | Test: 300 Days washout, Radioactive isotope, half-life 5 Hours; no cohorts; biometric study |

On 15/OCT/2026, the user explicitly approved restoring only RA2 TestCompound
`1 Days -> 12 Months` via Remove/Add/Save. The saved 12-month value was subsequently
read back and used by the automated compound alert. RA2 study lockout, Test/CMP29,
other compound properties and RA3 were not intentionally changed.
This supersedes the earlier one-day RA2 TestCompound setup used for the original
isolated Lockout manual experiment.

## 1. Happy path

1. Log in at `/site/index.aspx`; select **Adams Clinical**.
2. Open **Verify Subject**.
3. Select **AutoTest RA 2-Test Sponsor**, location **08053, TEST Location 3**,
   cohort **NOT A DOSING/COHORT STUDY**.
4. Fill a new synthetic adult identity, subject number, gender and ID; accept terms.
5. Record the complete form input, then Submit.
6. Expect the exact subject-name **Successfully Verified** headline and links
   **Download Subject Verification Certificate** and **New Verification**.
   An unexpected popup/dialog fails this case.

Historical success: `QA2610141018`, QAT Z TST, DOB 17/APR/1988.

## 2. Age violation

1. Read RA2 age limits through Admin; require **1-99**.
2. Log into Site / Adams Clinical and open the same RA2 form as the happy path.
3. Use a fresh identity with DOB **01/JAN/(portal year minus 100)**. All other
   required fields follow the happy path.
4. Save the input and Submit. Do not override.
5. Expect **Verification Failure**, a singular violation heading, and the exact
   message identifying the entered DOB and required age range **1 - 99**.
6. Confirm the certificate and New Verification links; search the new subject
   number through Admin and confirm persisted **Verification Failure**.

Historical manual evidence: `Auto-141026-105621`, DOB 01/JAN/1926, age 100.
Its PDF was manually compared with input and the age violation. The automated
age test checks the result/certificate link, not PDF content. The known PDF
wording defect ("Details related to this prescreen") remains a reported bug;
ID/location omission, disabled-cohort omission and GMT-5 time were accepted.

## 3-4. Compound washout and study lockout

The following deliberately separates the two causes without changing a protocol
between runs. `D` is the current portal calendar date.

| B1 field | Compound washout case | Study lockout case |
|---|---|---|
| Verification / Screening | D-75 | D-385 |
| Randomized / First Dosing | D-61 | D-371 |
| Actual Last Dosing | D-60 | D-370 |
| Actual Last Blood Draw | D-59 | D-1 |
| Actual Study Completion | D-59 | D-1 |
| Final B1 status | Completed | Completed |
| Target cause | 12-month compound period still active | 1-month LBDD lockout still active |
| Other cause | LBDD month already elapsed | Compound year already elapsed |

1. Read the source and RA2 protocol fixtures. Do not edit them in the test.
2. In Admin, **Add new subject**: AutoTest RA / Test Sponsor, Test Site,
   Test Location 2, Acne Group. Enter a fresh synthetic identity and Auto number,
   **In Screening**, and the Screening date from the table. Submit.
3. Open its **Click Here** visit schedule. Set First Dosing and estimated Last
   Dosing/LBDD/Completion to the corresponding dates. Enable **Turn off
   auto-complete**, Submit, and confirm **Randomized**.
4. Open **Update** for this subject; choose **Completed**. Explicitly enter Actual
   Study Completion, Actual Last Dosing and Actual Last Blood Draw dates from the
   table. Submit. Re-read Completed and the individual dates under history /
   **View Dosing Dates**; planned dates alone are not sufficient evidence.
5. Log into Site / Adams Clinical. Verify the same identity with a new Auto number
   in RA2 / TEST Location 3 / no-cohort. Save input and Submit.
6. For **compound washout**, expect exactly one Verification Alert for
   **12 Months washout from past exposure to TestCompound** and an admission date
   of B1 LDD + 12 calendar months. Choose **verification failure**, then **Proceed**.
   Never choose verification success.
7. For **study lockout**, expect a direct failure, not the compound-choice popup.
   The reason must identify **1 Months from last blood draw date to check-in /
   admission date**, with an eligible admission date of B1 LBDD + 1 calendar month.
   The Site UI calls this rule "washout"; it is the protocol's study lockout.
8. Confirm final **Verification Failure**, no CMP29 or prior-SF warning,
   certificate link, persisted B2 failure, matching B1/B2 history URL and B1 still
   **Completed**. The compound case requires one alert, not a compound plus lockout
   combination.

This tests normal Site verification before B2 has a dosing schedule. It does not
prove how a subsequently entered B2 First Dosing date would recalculate Admission
from RA visit offsets. Do not equate Admission with First Dosing for that separate
calculation.

Historical manual compound case: WAS H HCK, source LDD 13/OCT/2026,
RA2 eligible admission 13/OCT/2027. Historical manual lockout:
`Test-1410-1914`, source LBDD 14/OCT/2026, eligible 14/NOV/2026.
Old session-only instructions are superseded by these repository-backed steps.

## 5-6. Compound exception positive and boundary failure

| B1 field | Positive | Negative |
|---|---|---|
| Screening | D-44 | D-44 |
| Randomized / First Dosing | D-30 | D-30 |
| Last Dosing | D-30 | D-29 |
| LBDD / Completion | D+31 | D+31 |
| Turn off auto-complete | Checked | Checked |
| B1 final status | Randomized | Randomized |
| B2 result | Success / In Screening | Failure, exactly one CMP29 violation |

1. Read RA3 Test/300-day washout and RA2 Test/29-day/Screening Date/CMP29 rules;
   require the expected month lockout and unchecked SF exclusion setting.
2. Log into Site / Adams Clinical; create fresh B1 in RA3 / TEST Location 3 /
   no-cohort. For this biometric protocol, choose **VCT Biometrics is not installed**.
3. Confirm successful verification; find B1 through Admin and update Screening
   through its verification editor, preserving the full synthetic identity.
4. Set B1 visit schedule dates from the table, enable Turn off auto-complete, Submit,
   then re-read all dates and **Randomized**.
5. In Site, use **New Verification**, the same identity and a different Auto number;
   select RA2 / TEST Location 3 / no-cohort. Confirm the portal date has not changed.
6. Submit. Positive: exact Success headline plus **previously entered ... not
   violating any ... exclusion criteria**. Negative: Verification Failure,
   singular violation and exact **CMP29** explanation; no prior-SF warning.
7. Confirm the certificate/New Verification links, persisted B2 status, matching
   B1/B2 history URL, and B1 still Randomized.

The anchor is **Last Dosing Date**, not Randomized status date. The strict boundary
is 30 > 29 allowed, 29 = 29 rejected. CMP29 is display-only criterion text.
Do not transfer these expectations to study-pair exceptions or assume an email
was sent.

Historical clean positive: B1 `Auto-151026-154935`, B2 `Auto-151026-155019`.
Historical clean negative: B1 `Auto-151026-155034`, B2 `Auto-151026-155118`.
Manual repeat `Auto-151026-154337` had CMP29 **and** prior same-study SF and is not
isolated boundary evidence.

## Running

From `e2e`, set `TEST_USERNAME` and `TEST_PASSWORD`; optionally use separate
`LEGACY_ADMIN_USERNAME` / `LEGACY_ADMIN_PASSWORD`. No credentials belong in reports
or committed test data.

```powershell
npm run test:verification:happy
npm run test:verification:age
$env:RUN_STUDY_EXCLUSIONS = '1'
npm run test:verification:exclusions
$env:RUN_COMPOUND_EXCEPTION = '1'
npm run test:verification:compound
```

Each project is QA-only, single-worker and retries=0; historical setup tests
reject repeat-each execution. Do not run persistent tests concurrently. View
inputs/results and screenshots with `npm run test:report`; retain the report
before another run replaces it.

## Recorded automation verification

On 15/OCT/2026 all six scenarios passed together on QA US: **6 passed, 0 skipped,
0 flaky**. After adding calendar-month end-of-month clamping, both exclusion
scenarios passed again; January 31, leap-year February, February 29 + 12 months,
year rollover and the observed October-to-November calculation were also checked.
TypeScript and project isolation/discovery checks passed.

The six-case report and input/result summary are retained as session artifacts
`verification-six-report` and `verification-six-summary.json`, in addition to the
ignored local Playwright report. These reports are execution evidence, not
protocol-configuration authority; always re-read live fixtures before a later run.
